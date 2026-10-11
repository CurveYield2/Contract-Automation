// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.28;
import {StakingHubCompatibility_v2, StakingConfig, RampBuffer} from "./StakingHubCompatibility_v2.t.sol";
import {Vm, TokenMock, GaugeMock, VlMock, StashMock} from "./FunctionalVerification_v3.t.sol";
import {BoostHub} from "../contracts/BoostHub.sol";
import {StakeDaoMerkleClaimExecutor} from "../contracts/StakeDaoMerkleClaimExecutor.sol";

interface RewardRefresh {
    function update_reward_tokens() external returns (uint256);
    function reward_tokens(uint256) external view returns (address);
}

contract RewardTokenSyncTest {
    event log_named_uint(string key, uint256 value);
    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    address constant USER = address(0xBEEF);
    address constant RECEIVER = address(0xFEED);
    TokenMock want; TokenMock reward; TokenMock gov;
    GaugeMock gauge; BoostHub hub; StakeDaoMerkleClaimExecutor helper;
    StakingConfig staking;

    function setUp() public {
        vm.warp(1800000000 / 28800 * 28800);
        want = new TokenMock(); reward = new TokenMock(); gov = new TokenMock();
        gauge = new GaugeMock(address(want), address(reward));
        helper = new StakeDaoMerkleClaimExecutor(address(this), address(new StashMock()));
        hub = new BoostHub(address(this), address(new VlMock()), address(helper));
        helper.setBoostHub(address(hub));
        address[] memory assets = new address[](1); assets[0] = address(want);
        address[] memory gauges = new address[](1); gauges[0] = address(gauge);
        address[][] memory tokens = new address[][](1); tokens[0] = new address[](1); tokens[0][0] = address(reward);
        hub.addPoolsBatch(assets, gauges, tokens); _configure(address(this));
        want.mint(address(this), 1000e18); want.approve(address(hub), type(uint256).max);
        want.mint(USER, 1000e18);
    }

    function _configure(address depositor) internal {
        uint256[] memory p = new uint256[](1);
        address[] memory d = new address[](1); d[0] = depositor;
        bool[] memory locked = new bool[](1); bool[] memory active = new bool[](1); active[0] = true;
        bytes4[] memory selectors = new bytes4[](1);
        BoostHub.FeeConfig[] memory fees = new BoostHub.FeeConfig[](1); fees[0] = BoostHub.FeeConfig(0, RECEIVER);
        hub.setDepositors(p, d, locked, selectors, fees, active); hub.executeTransactions();
    }

    function _create(address[8] memory tokens, uint256 smoothing) internal returns (address deployed) {
        bytes memory code = vm.parseBytes(vm.readFile("evidence/staking.bytecode"));
        bytes memory init = abi.encodePacked(code, abi.encode(address(want), address(hub), uint256(0), address(this), tokens, RECEIVER, smoothing, address(this)));
        assembly { deployed := create(0, add(init, 32), mload(init)) }
    }

    function _start(bool initialReward, uint256 smoothing) internal {
        address[8] memory tokens;
        if (initialReward) { tokens[0] = address(reward); }
        address deployed = _create(tokens, smoothing);
        require(deployed != address(0), "staking must deploy against BoostHub v11 using its provided methods");
        staking = StakingConfig(deployed); _configure(deployed);
        vm.prank(USER); want.approve(deployed, type(uint256).max);
        vm.prank(USER); staking.deposit(100e18);
    }

    function _failed(bytes memory data) internal returns (bool) { (bool ok,) = address(staking).call(data); return !ok; }
    function _registerGaugeToken(uint256 index, address token) internal { gauge.setReward(index, token); hub.harvest(0); }


    function testSyncConstructorDiscoversHubRewardsWithEmptyArgumentArray() public {
        _start(false, 0);
        require(staking.reward_count() == 2, "constructor did not import Hub reward");
        require(staking.reward_from_boosthub(address(reward)), "Hub source flag missing");
    }

    function testSyncHarvestDiscoversGaugeRewardAndClaimsItInSameTransaction() public {
        _start(true, 0); vm.warp(vm.getBlockTimestamp() + 45 days); staking.checkpoint(USER);
        gauge.setReward(1, address(gov)); gauge.seed(address(hub), address(gov), 20e18);
        staking.harvest(); vm.prank(USER); staking.claim_reward(address(gov));
        require(staking.reward_from_boosthub(address(gov)), "late Hub reward not discovered");
        require(gov.balanceOf(USER) == 20e18, "new reward not claimed immediately");
    }

    function testSyncPermissionlessRefreshIsIdempotent() public {
        _start(true, 0); _registerGaugeToken(1, address(gov));
        vm.prank(USER); uint256 added = RewardRefresh(address(staking)).update_reward_tokens();
        require(added == 1 && staking.reward_count() == 3, "permissionless refresh failed");
        require(RewardRefresh(address(staking)).update_reward_tokens() == 0, "duplicate reward added");
        require(staking.reward_count() == 3, "duplicate refresh changed count");
    }

    function testSyncPromotesLatePrincipalRewardWithoutDuplicateSlot() public {
        _start(true, 0); vm.warp(vm.getBlockTimestamp() + 45 days); staking.checkpoint(USER);
        gauge.setReward(1, address(want)); gauge.seed(address(hub), address(want), 20e18);
        staking.harvest(); vm.prank(USER); staking.claim_reward(address(want));
        require(staking.reward_from_boosthub(address(want)) && staking.reward_count() == 2, "principal promotion failed");
        require(want.balanceOf(USER) == 920e18 && hub.positionInfo(0, address(staking)).principal == 100e18, "principal/reward accounting changed");
    }

    function testSyncDisabledTokenRemainsDisabled() public {
        _start(true, 0); staking.disable_reward(address(reward));
        RewardRefresh(address(staking)).update_reward_tokens();
        gauge.seed(address(hub), address(reward), 20e18); staking.harvest();
        require(staking.reward_disabled(address(reward)), "refresh reenabled reward");
        require(reward.balanceOf(address(staking)) == 0 && hub.positionInfo(0, address(staking)).pendingRewards[0] == 20e18, "disabled reward was claimed");
    }

    function testSyncExistingExternalStreamSurvivesHubSourcePromotion() public {
        _start(true, 10); vm.warp(vm.getBlockTimestamp() + 45 days); staking.checkpoint(USER);
        staking.add_external_reward(address(gov)); gov.mint(address(this), 100e18); gov.approve(address(staking), 100e18);
        staking.deposit_reward_token(address(gov), 100e18); uint256 start = vm.getBlockTimestamp();
        gauge.setReward(1, address(gov)); gauge.seed(address(hub), address(gov), 50e18);
        staking.harvest(); require(staking.reward_from_boosthub(address(gov)) && staking.reward_count() == 3, "external token was duplicated");
        vm.warp(start + 1 days); vm.prank(USER); staking.claim_reward(address(gov));
        require(gov.balanceOf(USER) >= 150e18 - 200 && gov.balanceOf(USER) <= 150e18, "existing stream lost in promotion");
        require(_failed(abi.encodeCall(staking.deposit_reward_token, (address(gov), 1))), "promoted Hub reward accepted external funding");
    }

    function testSyncEightNonPrincipalHubRewardsFitWithPrincipal() public {
        _start(true, 0);
        for (uint256 i = 1; i < 8; ++i) { gauge.setReward(i, address(new TokenMock())); }
        vm.warp(vm.getBlockTimestamp() + 45 days); staking.checkpoint(USER);
        for (uint256 i; i < 8; ++i) { gauge.seed(address(hub), gauge.reward_tokens(i), 10e18); }
        staking.harvest(); require(staking.reward_count() == 9, "full Hub reward list does not fit");
        vm.prank(USER); staking.claim_rewards();
        for (uint256 i; i < 8; ++i) { require(TokenMock(gauge.reward_tokens(i)).balanceOf(USER) == 10e18, "full Hub reward list not payable"); }
    }

    function testSyncNewRewardUsesAllTokenRampSplit() public {
        _start(true, 0); gauge.setReward(1, address(gov)); gauge.seed(address(hub), address(gov), 100e18);
        staking.harvest();
        require(gov.balanceOf(RECEIVER) == 35e18 && RampBuffer(address(staking)).active_reward_redistribution_buffer(address(gov)) == 65e18, "new reward bypassed ramp");
        vm.warp(vm.getBlockTimestamp() + 28800); vm.prank(USER); staking.claim_reward(address(gov));
        require(gov.balanceOf(USER) >= 65e18 - 200 && gov.balanceOf(USER) <= 65e18, "new reward redistribution lost");
    }

    function testSyncCapacityFailureIsAtomicAndPrincipalExitStillWorks() public {
        _start(true, 0);
        for (uint256 i; i < 7; ++i) { staking.add_external_reward(address(new TokenMock())); }
        gauge.setReward(1, address(gov)); hub.harvest(0);
        require(_failed(abi.encodeCall(RewardRefresh(address(staking)).update_reward_tokens, ())), "capacity overflow accepted");
        require(!staking.reward_from_boosthub(address(gov)) && staking.reward_count() == 9, "partial registration on overflow");
        vm.prank(USER); staking.withdraw(100e18); require(want.balanceOf(USER) == 1000e18, "capacity blocked principal exit");
    }

    function testSyncRefreshDoesNotHarvestGaugeOrMovePrincipal() public {
        _start(true, 0); _registerGaugeToken(1, address(gov)); gauge.seed(address(hub), address(gov), 10e18);
        gauge.setFailClaim(true); vm.prank(USER); RewardRefresh(address(staking)).update_reward_tokens();
        require(staking.reward_from_boosthub(address(gov)), "read-only registry refresh failed");
        require(gauge.claimable_reward(address(hub), address(gov)) == 10e18 && staking.total_staked() == 100e18, "refresh moved rewards/principal");
    }
}
