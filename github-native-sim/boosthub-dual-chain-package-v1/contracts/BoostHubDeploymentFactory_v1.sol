// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.28;
import {CREATE3} from "solmate/src/utils/CREATE3.sol";

/// @notice Deploys the same address across chains independently of constructor arguments.
/// @dev Caller-scoped salts prevent another account from occupying a deployer's namespace.
contract BoostHubDeploymentFactory {
    function deploy(bytes32 salt, bytes calldata creationCode) external payable returns (address) {
        return CREATE3.deploy(keccak256(abi.encode(msg.sender, salt)), creationCode, msg.value);
    }

    function getDeployed(address deployer, bytes32 salt) external view returns (address) {
        return CREATE3.getDeployed(keccak256(abi.encode(deployer, salt)));
    }
}
