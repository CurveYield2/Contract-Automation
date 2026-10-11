// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.28;
import {BoostHub} from "../contracts/BoostHub.sol";
import {StakeDaoMerkleClaimExecutor} from "../contracts/StakeDaoMerkleClaimExecutor.sol";
import {Vm, Staking, TokenMock, GaugeMock, VlMock, StashMock} from "./FunctionalVerification_v3.t.sol";

interface RampBuffer {
    function active_reward_redistribution_buffer(address) external view returns (uint256);
    function pending_admin_fee(address) external view returns (uint256);
    function last_activation_boundary() external view returns (uint256);
}

interface StakingConfig is Staking {
    function reward_from_boosthub(address) external view returns (bool);
}

// Uses the exact supplied Hub/helper; only external tokens, gauge, stash are doubles.
contract StakingHubCompatibility_v2 {
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

    function testDeployAndConfigureWithBoostHubV11() public {
        _start(false, 0);
        require(!staking.reward_from_boosthub(address(want)));
        require(staking.total_staked() == 100e18 && hub.positionInfo(0, address(staking)).principal == 100e18);
    }
    function testConstructorRegistersSupportedInitialReward() public {
        _start(true, 0); require(staking.reward_from_boosthub(address(reward)) && staking.reward_count() == 2);
    }
    function testConstructorRejectsUnregisteredReward() public {
        address[8] memory tokens;
        tokens[0] = address(gov);
        require(_create(tokens, 0) == address(0));
    }
    function testConstructorRecognizesRegisteredWant() public {
        hub.deposit(0, 1e18); _registerGaugeToken(1, address(want)); hub.withdraw(0, 1e18);
        _start(false, 0); require(staking.reward_from_boosthub(address(want)));
    }
    function testPrincipalPartialAndFullExitAgainstHub() public {
        _start(true, 0); vm.prank(USER); staking.withdraw(40e18);
        require(staking.staked_balance(USER) == 60e18 && hub.positionInfo(0, address(staking)).principal == 60e18);
        vm.prank(USER); staking.withdraw(60e18);
        require(staking.total_staked() == 0 && want.balanceOf(USER) == 1000e18);
    }
    function testAddRewardUsesCurrentPoolMembership() public {
        _start(false, 0); _registerGaugeToken(1, address(gov)); staking.add_reward(address(gov));
        require(staking.reward_from_boosthub(address(gov)) && staking.reward_count() == 3);
    }
    function testAddRewardRejectsUnknownDuplicateAndUnauthorized() public {
        _start(true, 0);
        require(_failed(abi.encodeCall(staking.add_reward, (address(gov)))));
        require(_failed(abi.encodeCall(staking.add_reward, (address(reward)))));
        _registerGaugeToken(1, address(gov)); vm.prank(USER);
        require(_failed(abi.encodeCall(staking.add_reward, (address(gov)))));
    }
    function testHarvestSelectedNonWantRewardWithoutYieldFee() public {
        _start(true, 0); vm.warp(vm.getBlockTimestamp()+45 days); staking.checkpoint(USER); gauge.seed(address(hub), address(reward), 100e18); staking.harvest();
        vm.prank(USER); staking.claim_reward(address(reward));
        require(reward.balanceOf(USER) == 100e18 && hub.positionInfo(0, address(staking)).pendingRewards[0] == 0);
        require(want.balanceOf(address(hub)) == 0);
    }
    function testHarvestWantWithMatureRampHasNoYieldFee() public {
        hub.deposit(0, 1e18); _registerGaugeToken(1, address(want)); hub.withdraw(0, 1e18);
        _start(false, 0); vm.warp(vm.getBlockTimestamp() + 45 days); staking.checkpoint(USER);
        gauge.seed(address(hub), address(want), 100e18); staking.harvest();
        vm.prank(USER); staking.claim_reward(address(want));
        require(want.balanceOf(USER) == 1000e18 && want.balanceOf(address(hub)) == 0 && gauge.balanceOf(address(hub)) == 100e18);
    }
    function testDisableHubRewardWithNoFreshAmount() public {
        _start(true, 0); staking.disable_reward(address(reward)); require(staking.reward_disabled(address(reward)));
    }
    function testDisableFreshHubRewardRevertsThenHarvestAllowsDisable() public {
        _start(true, 0); vm.warp(vm.getBlockTimestamp()+45 days); staking.checkpoint(USER); gauge.seed(address(hub), address(reward), 10e18);
        require(_failed(abi.encodeCall(staking.disable_reward, (address(reward)))));
        require(!staking.reward_disabled(address(reward)) && gauge.claimable_reward(address(hub), address(reward)) == 10e18);
        staking.harvest(); staking.disable_reward(address(reward));
        vm.prank(USER); staking.claim_reward(address(reward)); require(reward.balanceOf(USER) == 10e18);
    }
    function testSmoothedHubRewardCanBeClaimedAtStreamEnd() public {
        _start(true, 10); vm.warp(vm.getBlockTimestamp()+45 days); staking.checkpoint(USER); gauge.seed(address(hub), address(reward), 100e18); staking.harvest();
        vm.warp(vm.getBlockTimestamp() + 1 days); vm.prank(USER); staking.claim_reward(address(reward));
        require(reward.balanceOf(USER) >= 100e18 - 100 && reward.balanceOf(USER) <= 100e18);
        require(staking.reward_remaining(address(reward)) == 0);
    }
    function testExternalGovernanceFundingRemainsSeparateFromHubClaims() public {
        _start(false, 0); vm.warp(vm.getBlockTimestamp()+45 days); staking.checkpoint(USER); staking.add_external_reward(address(gov));
        gov.mint(address(this), 20e18); gov.approve(address(staking), 20e18); staking.deposit_reward_token(address(gov), 20e18);
        staking.harvest(); vm.prank(USER); staking.claim_reward(address(gov));
        require(gov.balanceOf(USER) == 20e18 && !staking.reward_from_boosthub(address(gov)));
    }
    function testTwoHubRewardsUseSeparateSelectedClaims() public {
        _start(true, 0); vm.warp(vm.getBlockTimestamp()+45 days); staking.checkpoint(USER); _registerGaugeToken(1, address(gov)); staking.add_reward(address(gov));
        gauge.seed(address(hub), address(reward), 10e18); gauge.seed(address(hub), address(gov), 20e18);
        staking.harvest(); vm.prank(USER); staking.claim_reward(address(reward));
        vm.prank(USER); staking.claim_reward(address(gov));
        require(reward.balanceOf(USER) == 10e18 && gov.balanceOf(USER) == 20e18);
        require(hub.positionInfo(0, address(staking)).pendingRewards[0] == 0 && hub.positionInfo(0, address(staking)).pendingRewards[1] == 0);
    }
    function testPoolInfoDecodesEightHubRewardsAndAllIndexes() public {
        hub.deposit(0, 1e18);
        address[8] memory tokens; tokens[0] = address(reward);
        for (uint256 i = 1; i < 8; ++i) { TokenMock t = new TokenMock(); gauge.setReward(i, address(t)); if (i < 7) { tokens[i] = address(t); } }
        hub.harvest(0); hub.withdraw(0, 1e18);
        require(hub.poolInfo(0).rewardTokens.length == 8 && hub.poolInfo(0).accRewardPerShare.length == 8);
        address deployed = _create(tokens, 0); require(deployed != address(0)); staking = StakingConfig(deployed);
        require(staking.reward_count() == 9 && staking.reward_from_boosthub(tokens[6]));
        require(_failed(abi.encodeCall(staking.add_reward, (hub.poolInfo(0).rewardTokens[7]))));
    }
    function testAssetGaugeRewardsStayFullyClaimableWithoutRestaking() public {
        gauge.setReward(1, address(want)); hub.deposit(0, 100e18);
        gauge.seed(address(hub), address(want), 100e18); hub.harvest(0);
        require(gauge.balanceOf(address(hub)) == 100e18, "reward was restaked");
        address[] memory selected = new address[](1); selected[0] = address(want);
        hub.claim(0, selected, USER);
        require(want.balanceOf(USER) == 1100e18, "asset reward was taxed");
    }
    function testDonationRemainsUnstakedThroughClaimDepositAndExit() public {
        hub.deposit(0, 100e18); want.mint(address(hub), 5e18);
        address[] memory selected = new address[](0); hub.claim(0, selected, USER);
        require(gauge.balanceOf(address(hub)) == 100e18, "claim staked donation");
        hub.deposit(0, 10e18); require(gauge.balanceOf(address(hub)) == 110e18, "deposit staked donation");
        hub.withdraw(0, 110e18);
        require(want.balanceOf(address(hub)) == 5e18 && gauge.balanceOf(address(hub)) == 0, "exit changed donation");
    }
    function testHubRewardsReachStakerWithoutFeeConversion() public {
        _start(true, 0); vm.warp(vm.getBlockTimestamp() + 45 days); staking.checkpoint(USER); gauge.seed(address(hub), address(reward), 100e18); staking.harvest();
        vm.prank(USER); staking.claim_reward(address(reward));
        require(reward.balanceOf(USER) == 100e18, "staking reward was taxed");
        require(want.balanceOf(address(hub)) == 0, "fee sent to hub");
    }
    function testInitialHubRewardNeedsNoConverter() public {
        address[8] memory tokens; tokens[0] = address(reward);
        require(_create(tokens, 0) != address(0), "converter still required");
    }
    function testExternalNonGovernanceRewardNeedsNoConverterOrTax() public {
        TokenMock directReward = new TokenMock();
        _start(false, 0); vm.warp(vm.getBlockTimestamp() + 45 days); staking.checkpoint(USER); staking.add_external_reward(address(directReward));
        directReward.mint(address(this), 100e18); directReward.approve(address(staking), 100e18);
        staking.deposit_reward_token(address(directReward), 100e18);
        vm.prank(USER); staking.claim_reward(address(directReward));
        require(directReward.balanceOf(USER) == 100e18, "external reward was taxed");
    }
    function testForegoneWantBuffersSixtyFivePercentAndSendsNoHubAllocation() public {
        _start(false, 0); want.approve(address(staking), 100e18);
        staking.deposit_reward_token(address(want), 100e18);
        require(want.balanceOf(RECEIVER) == 35e18, "ramp admin allocation changed");
        require(want.balanceOf(address(hub)) == 0, "ramp funded retained hub stake");
        require(RampBuffer(address(staking)).active_reward_redistribution_buffer(address(want)) == 65e18, "removed allocation not returned to stakers");
    }

    function testAllRewardTokensPayRampAdminShareIncludingGovernance() public {
        _start(false, 0); staking.add_external_reward(address(gov));
        gov.mint(address(this), 100e18); gov.approve(address(staking), 100e18);
        staking.deposit_reward_token(address(gov), 100e18);
        require(gov.balanceOf(RECEIVER) == 35e18, "non-want ramp fee missing");
        vm.prank(USER); staking.claim_reward(address(gov));
        require(gov.balanceOf(USER) == 0, "fresh deposit earned unvested reward");
    }
    function testMatureAndFreshStakersShareEveryRewardByRampWeight() public {
        _start(false, 0); vm.warp(vm.getBlockTimestamp() + 45 days); staking.checkpoint(USER);
        address fresh = address(0xCAFE); want.mint(fresh, 100e18);
        vm.prank(fresh); want.approve(address(staking), 100e18);
        vm.prank(fresh); staking.deposit(100e18);
        staking.add_external_reward(address(gov)); gov.mint(address(this), 100e18); gov.approve(address(staking), 100e18);
        staking.deposit_reward_token(address(gov), 100e18);
        require(gov.balanceOf(RECEIVER) == 175e17, "non-want admin fee must follow inactive weight");
        vm.prank(USER); staking.claim_reward(address(gov));
        vm.prank(fresh); staking.claim_reward(address(gov));
        require(gov.balanceOf(USER) >= 825e17 - 100 && gov.balanceOf(USER) <= 825e17, "active redistribution missing");
        require(gov.balanceOf(fresh) == 0, "fresh staker received ramp reward");
    }
    function testSmoothedNonWantRewardUsesRampAndReleasesBuffer() public {
        _start(false, 1); staking.add_external_reward(address(gov));
        gov.mint(address(this), 100e18); gov.approve(address(staking), 100e18);
        staking.deposit_reward_token(address(gov), 100e18);
        uint256 start = vm.getBlockTimestamp(); vm.warp(start + 8640); staking.checkpoint(USER); staking.harvest();
        require(gov.balanceOf(RECEIVER) == 35e18, "streamed non-want ramp fee missing");
        vm.warp(start + 28800); vm.prank(USER); staking.claim_reward(address(gov));
        require(gov.balanceOf(USER) >= 65e18 - 200 && gov.balanceOf(USER) <= 65e18, "buffer not released to active staker");
    }

    function testAllEightRewardTokensKeepIndependentRampBalances() public {
        _start(true, 0); address[7] memory tokens; tokens[0] = address(reward);
        for (uint256 i = 1; i < 7; ++i) {
            tokens[i] = address(new TokenMock()); _registerGaugeToken(i, tokens[i]); staking.add_reward(tokens[i]);
        }
        want.approve(address(staking), 100e18); staking.deposit_reward_token(address(want), 100e18);
        for (uint256 i; i < 7; ++i) { gauge.seed(address(hub), tokens[i], 100e18); }
        staking.harvest();
        require(staking.reward_count() == 8 && want.balanceOf(RECEIVER) == 35e18);
        for (uint256 i; i < 7; ++i) {
            require(TokenMock(tokens[i]).balanceOf(RECEIVER) == 35e18);
            require(RampBuffer(address(staking)).active_reward_redistribution_buffer(tokens[i]) == 65e18);
        }
        vm.prank(USER); staking.claim_rewards();
        for (uint256 i; i < 7; ++i) { require(TokenMock(tokens[i]).balanceOf(USER) == 0); }
        vm.warp(vm.getBlockTimestamp()+28800); vm.prank(USER); staking.claim_rewards();
        for (uint256 i; i < 7; ++i) {
            require(TokenMock(tokens[i]).balanceOf(USER) >= 65e18-200 && TokenMock(tokens[i]).balanceOf(USER) <= 65e18);
            require(RampBuffer(address(staking)).active_reward_redistribution_buffer(tokens[i]) == 0);
        }
        require(want.balanceOf(USER) >= 965e18-200 && want.balanceOf(USER) <= 965e18);
        require(gauge.balanceOf(address(hub)) == 100e18 && want.balanceOf(address(hub)) == 0);
    }
    function testLateRewardRegistrationUsesCurrentRampWeight() public {
        _start(false, 0); vm.warp(vm.getBlockTimestamp()+3 days); staking.checkpoint(USER);
        staking.add_external_reward(address(gov)); gov.mint(address(this), 100e18); gov.approve(address(staking), 100e18);
        staking.deposit_reward_token(address(gov), 100e18); vm.prank(USER); staking.claim_reward(address(gov));
        require(gov.balanceOf(RECEIVER) == 315e17);
        require(gov.balanceOf(USER) >= 685e17-200 && gov.balanceOf(USER) <= 685e17);
    }
    function testAdminRewardTransferFailureRevertsFundingAndAccounting() public {
        _start(false, 0); staking.add_external_reward(address(gov)); gov.mint(address(this), 100e18); gov.approve(address(staking), 100e18);
        gov.setFalseRecipient(RECEIVER, true);
        require(_failed(abi.encodeCall(staking.deposit_reward_token, (address(gov), 100e18))));
        require(gov.balanceOf(address(this)) == 100e18 && gov.balanceOf(address(staking)) == 0);
        require(RampBuffer(address(staking)).pending_admin_fee(address(gov)) == 0);
        require(RampBuffer(address(staking)).active_reward_redistribution_buffer(address(gov)) == 0);
    }
    function testAssetMerkleRewardHasNoRetentionAndHelperDecodesRevisedPool() public {
        gauge.setReward(1, address(want)); hub.deposit(0, 100e18);
        StashMock stash = StashMock(address(helper.merkleStash())); stash.configure(address(want), 7, address(hub), 100e18);
        bytes32[] memory proof = new bytes32[](0); helper.supplyClaim(0, address(want), 7, 100e18, proof);
        hub.claimStakeDaoRewards(0); require(gauge.balanceOf(address(hub)) == 100e18);
        address[] memory selected = new address[](1); selected[0] = address(want); hub.claim(0, selected, USER);
        require(want.balanceOf(USER) == 1100e18 && !helper.hasPendingClaims(0));
    }
    function testFuzzEveryRewardRampMilestoneConservesFunds(uint8 rawPhase, uint96 rawAmount) public {
        _start(false, 0); uint256[5] memory ages = [uint256(0), 3, 33, 41, 45];
        uint256[5] memory inactivePercent = [uint256(100), 90, 50, 30, 0]; uint256 phase = rawPhase % 5;
        vm.warp(vm.getBlockTimestamp()+ages[phase]*1 days); staking.checkpoint(USER);
        staking.add_external_reward(address(gov)); uint256 amount = uint256(rawAmount) % 1000e18 + 1000000;
        gov.mint(address(this), amount); gov.approve(address(staking), amount); staking.deposit_reward_token(address(gov), amount);
        uint256 adminShare = (amount*inactivePercent[phase]/100)*35/100;
        require(gov.balanceOf(RECEIVER) == adminShare, "incorrect ramp fee");
        vm.prank(USER); staking.claim_reward(address(gov));
        if (phase == 0) { require(gov.balanceOf(USER) == 0); vm.warp(vm.getBlockTimestamp()+28800); vm.prank(USER); staking.claim_reward(address(gov)); }
        uint256 tolerance = amount/1e18*100+300;
        require(gov.balanceOf(USER) <= amount-adminShare && gov.balanceOf(USER)+tolerance >= amount-adminShare, "incorrect active redistribution");
        require(gov.balanceOf(USER)+gov.balanceOf(RECEIVER)+gov.balanceOf(address(staking)) == amount, "reward conservation");
    }
    function testEightFundedRewardsCheckpointAfterLongIdleWithinGasBudget() public {
        _start(false, 0); address[8] memory tokens; tokens[0] = address(want);
        for (uint256 i = 1; i < 8; ++i) { tokens[i] = address(new TokenMock()); staking.add_external_reward(tokens[i]); }
        for (uint256 i; i < 8; ++i) {
            if (i != 0) TokenMock(tokens[i]).mint(address(this), 100e18);
            TokenMock(tokens[i]).approve(address(staking), 100e18); staking.deposit_reward_token(tokens[i], 100e18);
        }
        vm.warp(vm.getBlockTimestamp()+45 days); uint256 beforeGas = gasleft(); staking.checkpoint(USER);
        uint256 spent = beforeGas-gasleft(); emit log_named_uint("eight_reward_idle_checkpoint_gas", spent);
        // Conservative engineering budget for the newly expanded eight-token path.
        require(spent < 15_000_000, "eight-token idle checkpoint exceeds budget");
        vm.prank(USER); staking.claim_rewards();
        for (uint256 i = 1; i < 8; ++i) {
            require(TokenMock(tokens[i]).balanceOf(USER) >= 65e18-200 && TokenMock(tokens[i]).balanceOf(USER) <= 65e18);
            require(TokenMock(tokens[i]).balanceOf(RECEIVER) == 35e18);
        }
    }
    function testBoundedRampCheckpointProgressesThroughLongIdle() public {
        _start(false, 0); uint256 start = vm.getBlockTimestamp(); vm.warp(start+45 days);
        uint256 prior = RampBuffer(address(staking)).last_activation_boundary(); bool done;
        for (uint256 i; i < 9; ++i) {
            (bool ok, bytes memory data) = address(staking).call(abi.encodeWithSignature("checkpoint_ramp(uint256)", 16));
            require(ok, "bounded checkpoint unavailable"); done = abi.decode(data, (bool));
            uint256 next = RampBuffer(address(staking)).last_activation_boundary();
            require(next > prior && next-prior <= 16*28800, "checkpoint did not make bounded progress"); prior = next;
            if (done) break;
        }
        require(done && prior == start+45 days); staking.checkpoint(USER); require(staking.active_balance(USER) == 100e18);
        require(_failed(abi.encodeWithSignature("checkpoint_ramp(uint256)", 0)));
        require(_failed(abi.encodeWithSignature("checkpoint_ramp(uint256)", 17)));
        require(RampBuffer(address(staking)).last_activation_boundary() == prior);
    }
    function testBoundedCheckpointsHandleEightRewardsAnd135DepositCohorts() public {
        _start(false, 0); address[8] memory tokens; tokens[0] = address(want);
        for (uint256 i = 1; i < 8; ++i) { tokens[i] = address(new TokenMock()); staking.add_external_reward(tokens[i]); }
        for (uint256 i; i < 135; ++i) { vm.prank(USER); staking.deposit(1e18); vm.warp(vm.getBlockTimestamp()+28800); }
        for (uint256 i; i < 8; ++i) {
            if (i != 0) TokenMock(tokens[i]).mint(address(this), 100e18);
            TokenMock(tokens[i]).approve(address(staking), 100e18); staking.deposit_reward_token(tokens[i], 100e18);
        }
        uint256 adminShare = TokenMock(tokens[1]).balanceOf(RECEIVER); uint256 largest;
        vm.warp(vm.getBlockTimestamp()+45 days); bool done;
        for (uint256 i; i < 9; ++i) {
            uint256 beforeGas = gasleft(); (bool ok, bytes memory data) = address(staking).call(abi.encodeWithSignature("checkpoint_ramp(uint256)", 16));
            uint256 spent = beforeGas-gasleft(); if (spent > largest) largest = spent;
            require(ok && spent < 15_000_000, "bounded backlog checkpoint failed"); done = abi.decode(data, (bool)); if (done) break;
        }
        emit log_named_uint("eight_reward_135_cohort_max_batch_gas", largest); require(done);
        vm.prank(USER); staking.claim_rewards();
        for (uint256 i = 1; i < 8; ++i) {
            uint256 paid = TokenMock(tokens[i]).balanceOf(USER);
            require(paid <= 100e18-adminShare && paid+100000 >= 100e18-adminShare, "cohort rewards lost or overpaid");
            require(paid+TokenMock(tokens[i]).balanceOf(RECEIVER)+TokenMock(tokens[i]).balanceOf(address(staking)) == 100e18);
        }
        vm.prank(USER); staking.withdraw(235e18); require(want.balanceOf(USER) >= 1000e18+100e18-adminShare-100000);
    }
}
