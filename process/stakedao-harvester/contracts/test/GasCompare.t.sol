// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test, console2} from "forge-std/Test.sol";
import {StakeDaoHarvester} from "../src/StakeDaoHarvester.sol";

/// Gas of the CRV -> ETH top-off vs one vault harvest, on a mainnet fork.
contract GasCompareTest is Test {
    address constant FEE_SAFE = 0x47623C62f281807D615eeb4A2CEee9d97F9D3C49;
    address constant CRV = 0xD533a949740bb3306d119CC777fa900bA034cd52;
    address bot = makeAddr("bot");
    StakeDaoHarvester h;

    function setUp() public {
        vm.createSelectFork(vm.envString("ETH_RPC_URL"));
        h = new StakeDaoHarvester(FEE_SAFE, bot, FEE_SAFE, 0.001 ether);
        vm.deal(bot, 0.001 ether);
    }

    function _gasOf(address[] memory gauges) internal returns (uint256 used) {
        vm.prank(bot);
        uint256 g = gasleft();
        h.harvest(gauges, 0, 0, 0, 300);
        used = g - gasleft();
    }

    function test_gas() public {
        vm.txGasPrice(0);
        address[] memory one = new address[](1);
        one[0] = 0x6b3A14e237a70c7703A4ac4590c2c254065FB8dd;
        address[] memory three = new address[](3);
        three[0] = 0x6b3A14e237a70c7703A4ac4590c2c254065FB8dd;
        three[1] = 0xAD6D1a4B1B2F33712A8b18BeDc95c0A1f9832269;
        three[2] = 0xfB18127c1471131468a1AaD4785c19678e521D86;

        uint256 snap = vm.snapshotState();
        uint256 h1 = _gasOf(one);
        vm.revertToState(snap);
        uint256 h3 = _gasOf(three);
        vm.revertToState(snap);
        deal(CRV, address(h), 500 ether);
        uint256 swapOnly = _gasOf(new address[](0));
        console2.log("1 vault: harvest+swap+settle   ", h1);
        console2.log("3 vaults: harvest+swap+settle  ", h3);
        console2.log("no vault: swap+settle only     ", swapOnly);
    }
}
