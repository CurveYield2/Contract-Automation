// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.30;

// Test-only overlay compiled in GitHub Actions against unmodified, SHA-256-bound source.
// These fixtures distinguish admitted-source semantics from unproven installed-runtime reachability.
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {QuestSigningLayerTest, MockIporFactoryBase} from "./QuestSigningLayer.t.sol";
import {CurveYieldVaultBase1271} from "../../src/katana/CurveYieldVaultBase1271.sol";
import {CurveYieldGovernanceGate} from "../../src/governance/CurveYieldGovernanceGate.sol";
import {IporRoleMock} from "../governance/IporRoleMocks.sol";

contract MasterTargetedQuestAndContext_v1 is QuestSigningLayerTest {
    function _signed(bytes memory message, bytes32 hash, uint256 privateKey) private returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, hash);
        return abi.encode(message, abi.encodePacked(r, s, v));
    }

    function test_MTT_positive_messagingBindingCorrectHash() public {
        bytes memory message = bytes.concat(prefix, bytes("nonce:valid"));
        bytes32 expectedHash = MessageHashUtils.toEthSignedMessageHash(message);
        assertEq(CurveYieldVaultBase1271(address(vault)).isValidSignature(
            expectedHash, _signed(message, expectedHash, SIGNER_PK)), MAGIC);
    }

    function test_MTT_negative_unauthorizedSignerRejected() public {
        bytes memory message = bytes.concat(prefix, bytes("nonce:unauthorized"));
        bytes32 hash = MessageHashUtils.toEthSignedMessageHash(message);
        assertEq(CurveYieldVaultBase1271(address(vault)).isValidSignature(
            hash, _signed(message, hash, SECOND_PK)), INVALID);
    }

    function test_MTT_detect_shortMessageHashMismatchAccepted() public {
        bytes memory message = bytes.concat(prefix, bytes("n"));
        bytes32 actualHash = MessageHashUtils.toEthSignedMessageHash(message);
        bytes32 unrelatedHash = keccak256("master-targeted-benign-unrelated-hash-v1");
        assertTrue(actualHash != unrelatedHash);
        assertLe(message.length, prefix.length + 64);
        bytes4 observed = CurveYieldVaultBase1271(address(vault)).isValidSignature(
            unrelatedHash, _signed(message, unrelatedHash, SIGNER_PK));
        emit log_named_bytes32("expected EIP191 hash", actualHash);
        emit log_named_bytes32("supplied unrelated hash", unrelatedHash);
        assertEq(observed, MAGIC, "expected observable admitted-source mismatch");
    }

    function test_MTT_negative_longMessageMismatchedHashRejected() public {
        bytes memory message = bytes.concat(prefix,
            bytes("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ01234567890123456789"));
        bytes32 actualHash = MessageHashUtils.toEthSignedMessageHash(message);
        bytes32 unrelatedHash = keccak256("master-targeted-benign-unrelated-hash-v1");
        assertTrue(actualHash != unrelatedHash);
        assertGt(message.length, prefix.length + 64);
        assertEq(CurveYieldVaultBase1271(address(vault)).isValidSignature(
            unrelatedHash, _signed(message, unrelatedHash, SIGNER_PK)), INVALID);
    }

    function test_MTT_detect_fallbackOriginalBaseSeesVaultNotUser() public {
        address directCaller = original.delegatedCaller();
        address fallbackCaller = MockIporFactoryBase(address(vault)).delegatedCaller();
        emit log_named_address("direct original base observed caller", directCaller);
        emit log_named_address("fallback original base observed caller", fallbackCaller);
        assertEq(directCaller, address(this));
        assertEq(vault.base(), address(wrapper));
        assertEq(fallbackCaller, address(vault), "admitted CALL must execute under vault caller");
        assertTrue(fallbackCaller != directCaller);
    }
}

contract MasterTargetedFeeAuthority_v1 is QuestSigningLayerTest {
    function test_MTT_detect_differentCallerAndSafeConstructorHolderMismatch() public {
        IporRoleMock mgr = new IporRoleMock();
        address safe = makeAddr("targetedFeeSafe");
        address deployer = makeAddr("targetedDeployer");
        vm.recordLogs();
        vm.prank(deployer, deployer);
        CurveYieldGovernanceGate gate = new CurveYieldGovernanceGate(address(mgr), safe);
        Vm.Log[] memory events = vm.getRecordedLogs();
        bytes32 eventSignature = keccak256("AdminFeeRoleTransferred(address,address)");
        bool found = false;
        for (uint256 i; i < events.length; i++) {
            if (events[i].emitter == address(gate) && events[i].topics.length == 3
                && events[i].topics[0] == eventSignature) {
                found = true;
                assertEq(address(uint160(uint256(events[i].topics[2]))), safe,
                    "event reports Safe as initial role holder");
            }
        }
        assertTrue(found, "expected constructor event");
        emit log_named_address("actual initial fee role holder", gate.adminFeeRoleHolder());
        emit log_named_address("documented fee Safe", safe);
        assertEq(gate.adminReceiver(), safe);
        assertEq(gate.adminFeeRoleHolder(), deployer);
        vm.prank(safe);
        vm.expectRevert(abi.encodeWithSelector(CurveYieldGovernanceGate.NotAdminFeeRole.selector, safe));
        gate.activateFeeHandover();
        vm.prank(deployer);
        gate.activateFeeHandover();
        assertTrue(gate.feeHandoverComplete());
    }

    function test_MTT_control_sameOriginAndSafeDoesNotMisassignHolder() public {
        IporRoleMock mgr = new IporRoleMock();
        address safe = makeAddr("targetedFeeSafe");
        vm.prank(safe, safe);
        CurveYieldGovernanceGate gate = new CurveYieldGovernanceGate(address(mgr), safe);
        assertEq(gate.adminFeeRoleHolder(), safe);
        vm.prank(safe);
        gate.activateFeeHandover();
        assertTrue(gate.feeHandoverComplete());
    }
}
