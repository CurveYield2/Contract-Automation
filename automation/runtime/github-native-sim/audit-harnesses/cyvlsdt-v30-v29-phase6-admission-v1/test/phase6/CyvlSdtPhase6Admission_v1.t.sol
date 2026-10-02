// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.28;

import {CurveYieldVlSDTToken} from "../../contracts/CurveYieldVlSDTToken.sol";

/// @notice P6.0-only source-bound Medusa/Foundry discovery and runtime admission smoke.
/// @dev It intentionally makes no protocol-security claim and is not a Phase-6B campaign.
contract CyvlSdtPhase6AdmissionV1 {
    uint256 public observed;

    function actionAdmission(uint8 value) external {
        observed = uint256(value);
    }

    function property_phase6_admission_source_fence() external pure returns (bool) {
        return type(CurveYieldVlSDTToken).creationCode.length > 0;
    }

    function test_phase6_admission_source_fence() external pure {
        require(type(CurveYieldVlSDTToken).creationCode.length > 0, "source fence");
    }
}
