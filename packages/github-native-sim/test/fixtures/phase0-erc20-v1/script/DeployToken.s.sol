// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {MiniToken} from "../src/MiniToken.sol";

interface Vm {
    function startBroadcast() external;
    function stopBroadcast() external;
}

/// Dependency-free stand-in for forge-std's Script base.
abstract contract Script {
    bool public IS_SCRIPT = true;
    Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
}

/// Deploys and configures the fixture token: mint to the broadcaster, then a configuration transfer.
contract DeployToken is Script {
    address internal constant TREASURY = address(0x7EA5);

    function run() external {
        vm.startBroadcast();
        MiniToken token = new MiniToken(1_000_000e18);
        require(token.transfer(TREASURY, 1e18), "configure");
        vm.stopBroadcast();
    }
}
