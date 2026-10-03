// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test, console2} from "forge-std/Test.sol";
import {StakeDaoHarvester} from "../src/StakeDaoHarvester.sol";

interface IAccountantB {
    function harvest(address[] calldata gauges, bytes[] calldata harvestData, address receiver) external;
}

interface IERC20B {
    function balanceOf(address) external view returns (uint256);
}

/// v1.1 (SPEC.md): per-vault `harvest` vs `harvestBatch` (swap / no swap) vs a direct Accountant call, live fork.
contract BatchGasTest is Test {
    address constant FEE_SAFE = 0x47623C62f281807D615eeb4A2CEee9d97F9D3C49;
    address constant CRV = 0xD533a949740bb3306d119CC777fa900bA034cd52;
    IAccountantB constant ACC = IAccountantB(0x93b4B9bd266fFA8AF68e39EDFa8cFe2A62011Ce0);
    address bot = makeAddr("bot");
    StakeDaoHarvester h;
    // the 5 gauges with the most pending CRV on 2026-10-02
    address[] all = [
        0xF429AeC167C92aCA16cD77aef54F196B1988cBA3,
        0x6b3A14e237a70c7703A4ac4590c2c254065FB8dd,
        0x512bC2AeE29F8E641f903B339D40947595A5bFe8,
        0xEEBC06d495c96E57542A6d829184A907A02ef602,
        0x415F30505368fa1dB82Feea02EB778be04e75907
    ];

    function setUp() public {
        vm.createSelectFork(vm.envString("ETH_RPC_URL"));
        h = new StakeDaoHarvester(FEE_SAFE, bot, FEE_SAFE, 0.001 ether);
        vm.deal(address(h), 0); // the fork address may already hold mainnet ETH
        vm.txGasPrice(0);
    }

    function _first(uint256 n) internal view returns (address[] memory g) {
        g = new address[](n);
        for (uint256 i; i < n; ++i) g[i] = all[i];
    }

    function test_gas_perVault_vs_batch() public {
        for (uint256 n = 1; n <= 5; ++n) {
            address[] memory g = _first(n);
            uint256 snap = vm.snapshotState();
            vm.prank(bot);
            uint256 a = gasleft();
            h.harvest(g, 0, 0, 0, 300);
            uint256 perVault = a - gasleft();
            vm.revertToState(snap);
            vm.prank(bot);
            a = gasleft();
            h.harvestBatch(g, 0, 0, 300, true);
            uint256 batchSwap = a - gasleft();
            vm.revertToState(snap);
            vm.prank(bot);
            a = gasleft();
            h.harvestBatch(g, 0, 0, 300, false);
            uint256 batchNoSwap = a - gasleft();
            vm.revertToState(snap);
            a = gasleft();
            ACC.harvest(g, new bytes[](n), address(this));
            uint256 direct = a - gasleft();
            vm.revertToState(snap);
            console2.log("vaults", n);
            console2.log("  per-vault harvest + swap ", perVault);
            console2.log("  harvestBatch + swap      ", batchSwap);
            console2.log("  harvestBatch, no swap    ", batchNoSwap);
            console2.log("  direct Accountant call   ", direct);
        }
    }

    function test_batch_swap_paysEthAndRefillsBot() public {
        vm.deal(bot, 0);
        uint256 safe0 = FEE_SAFE.balance;
        vm.prank(bot);
        int256 profit = h.harvestBatch(_first(3), 0, 0, 300, true);
        assertGt(profit, 0);
        // the bot is refilled toward the reserve from the proceeds; anything above the reserve goes to the fee Safe
        assertGt(bot.balance, 0, "bot refilled from the proceeds");
        assertLe(bot.balance, 0.001 ether);
        assertEq(address(h).balance, 0, "no ETH left in the contract");
        if (bot.balance < 0.001 ether) assertEq(FEE_SAFE.balance, safe0, "proceeds below the shortfall: all to the bot");
        else assertGt(FEE_SAFE.balance, safe0, "rest to the fee Safe");
        assertEq(IERC20B(CRV).balanceOf(address(h)), 0);
    }

    function test_batch_noSwap_sendsCrvToAdmin() public {
        vm.deal(bot, 0.0005 ether);
        uint256 crv0 = IERC20B(CRV).balanceOf(FEE_SAFE);
        vm.prank(bot);
        int256 profit = h.harvestBatch(_first(3), 0, 0, 300, false);
        assertGt(profit, 0);
        assertGt(IERC20B(CRV).balanceOf(FEE_SAFE), crv0, "CRV to the fee Safe");
        assertEq(bot.balance, 0.0005 ether, "no swap: bot untouched");
        assertEq(IERC20B(CRV).balanceOf(address(h)), 0);
        assertEq(address(h).balance, 0);
    }

    function test_batch_unprofitable_reverts() public {
        vm.txGasPrice(1000 gwei); // absurd gas: the batch can never pay
        vm.prank(bot);
        vm.expectRevert();
        h.harvestBatch(_first(2), 0, 0, 300, true);
        vm.prank(bot);
        vm.expectRevert();
        h.harvestBatch(_first(2), 0, 0, 300, false);
    }

    function test_batch_badGauge_revertsWhole() public {
        address[] memory g = _first(2);
        g[1] = address(0xBEEF);
        vm.prank(bot);
        vm.expectRevert();
        h.harvestBatch(g, 0, 0, 300, true);
    }

    function test_batch_onlyBot() public {
        vm.expectRevert(StakeDaoHarvester.NotBot.selector);
        h.harvestBatch(_first(1), 0, 0, 300, true);
    }
}
