// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test, console2} from "forge-std/Test.sol";
import {StakeDaoHarvester} from "../src/StakeDaoHarvester.sol";

/// A gas limit that is too small must harvest fewer vaults, never revert the whole transaction.
contract GasLimitTest is Test {
    address constant FEE_SAFE = 0x47623C62f281807D615eeb4A2CEee9d97F9D3C49;
    address bot = makeAddr("bot");
    StakeDaoHarvester h;
    address[] gauges = [
        0x6b3A14e237a70c7703A4ac4590c2c254065FB8dd,
        0xAD6D1a4B1B2F33712A8b18BeDc95c0A1f9832269,
        0xfB18127c1471131468a1AaD4785c19678e521D86
    ];

    function setUp() public {
        vm.createSelectFork(vm.envString("ETH_RPC_URL"));
        h = new StakeDaoHarvester(FEE_SAFE, bot, FEE_SAFE, 0.001 ether);
        vm.deal(address(h), 0);
    }

    function test_tightGas_harvestsFewer_settles() public {
        vm.txGasPrice(0);
        vm.prank(bot);
        // enough for ~1–2 vaults + settlement, not 3
        (uint256 n,) = h.harvest{gas: 1_300_000}(gauges, 0, 0, 0, 250);
        console2.log("harvested with 1.3M gas:", n);
        assertGt(n, 0);
        assertLt(n, 3);
        assertEq(h.CRV().balanceOf(address(h)), 0, "settled: CRV swapped");
    }
}
