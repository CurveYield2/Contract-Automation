// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test, console2} from "forge-std/Test.sol";
import {StakeDaoHarvester} from "../src/StakeDaoHarvester.sol";

/// Smoke test on a mainnet fork (ETH_RPC_URL): real Accountant, real gauges, real tricrv swap.
contract SmokeTest is Test {
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
        vm.deal(address(h), 0); // the fork address may already hold mainnet ETH
    }

    /// free gas: all three harvested, CRV swapped, bot (empty) filled to its 0.001 ETH reserve first, rest to the Safe
    function test_harvestSwapSettle_freeGas() public {
        vm.txGasPrice(0);
        uint256 safeBefore = FEE_SAFE.balance;
        vm.prank(bot);
        (uint256 n, int256 profit) = h.harvest(gauges, 0, 0, 0, 250);
        assertEq(n, 3);
        assertEq(h.CRV().balanceOf(address(h)), 0, "CRV left");
        assertEq(address(h).balance, 0, "ETH left");
        uint256 toSafe = FEE_SAFE.balance - safeBefore;
        console2.log("ETH out", uint256(profit));
        console2.log("bot", bot.balance);
        console2.log("safe", toSafe);
        assertEq(bot.balance + toSafe, uint256(profit));
        if (uint256(profit) <= 0.001 ether) assertEq(toSafe, 0);
        else assertEq(bot.balance, 0.001 ether);
    }

    /// bot already above its reserve: everything goes to the Safe
    function test_botAboveLow_allToSafe() public {
        vm.txGasPrice(0);
        vm.deal(bot, 0.0015 ether);
        uint256 safeBefore = FEE_SAFE.balance;
        vm.prank(bot);
        (, int256 profit) = h.harvest(gauges, 0, 0, 0, 250);
        assertEq(bot.balance, 0.0015 ether);
        assertEq(FEE_SAFE.balance - safeBefore, uint256(profit));
    }

    function test_realGas_allSkipped_revertsWhole() public {
        vm.txGasPrice(0.12 gwei);
        vm.prank(bot);
        vm.expectPartialRevert(StakeDaoHarvester.TotalUnprofitable.selector);
        h.harvest(gauges, 0.000001 ether, 0, 21_000, 250);
    }
}
