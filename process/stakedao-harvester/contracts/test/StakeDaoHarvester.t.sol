// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test, console2} from "forge-std/Test.sol";
import {Vm} from "forge-std/Vm.sol";
import {StakeDaoHarvester} from "../src/StakeDaoHarvester.sol";

interface IERC20Full {
    function balanceOf(address) external view returns (uint256);
    function allowance(address, address) external view returns (uint256);
    function transfer(address, uint256) external returns (bool);
}

/// Fork test suite for StakeDaoHarvester (SPEC.md §6): real Accountant, real gauges, real tricrv swap.
contract StakeDaoHarvesterTest is Test {
    address constant FEE_SAFE = 0x47623C62f281807D615eeb4A2CEee9d97F9D3C49;
    address constant CRV = 0xD533a949740bb3306d119CC777fa900bA034cd52;
    uint256 constant DEFAULT_BOT_RESERVE = 0.001 ether;

    address bot = makeAddr("bot");
    address rnd = makeAddr("rnd");
    StakeDaoHarvester h;

    address[] gauges = [
        0x6b3A14e237a70c7703A4ac4590c2c254065FB8dd,
        0xAD6D1a4B1B2F33712A8b18BeDc95c0A1f9832269,
        0xfB18127c1471131468a1AaD4785c19678e521D86
    ];

    // the real Accountant's own zero-arg error, used to check the Skipped reason for a non-gauge address
    error InvalidVault();

    bytes32 constant HARVESTED_SIG = keccak256("Harvested(address,uint256,uint256,uint256)");
    bytes32 constant SKIPPED_SIG = keccak256("Skipped(address,bytes)");
    bytes32 constant SETTLED_SIG = keccak256("Settled(uint256,uint256,uint256,uint256,uint256,int256)");

    function setUp() public {
        vm.createSelectFork(vm.envString("ETH_RPC_URL"), 26_098_347);
        h = new StakeDaoHarvester(FEE_SAFE, bot, FEE_SAFE, DEFAULT_BOT_RESERVE);
        vm.deal(address(h), 0); // the fork address may already hold mainnet ETH
    }

    // ---------------------------------------------------------------- helpers

    function _harvestedFrom(Vm.Log[] memory logs, address gauge)
        internal
        pure
        returns (bool found, uint256 crv, uint256 gasUsed, uint256 profit)
    {
        for (uint256 i; i < logs.length; ++i) {
            if (logs[i].topics.length == 2 && logs[i].topics[0] == HARVESTED_SIG) {
                if (address(uint160(uint256(logs[i].topics[1]))) == gauge) {
                    (crv, gasUsed, profit) = abi.decode(logs[i].data, (uint256, uint256, uint256));
                    found = true;
                }
            }
        }
    }

    function _skippedReasonFor(Vm.Log[] memory logs, address gauge) internal pure returns (bool found, bytes memory reason) {
        for (uint256 i; i < logs.length; ++i) {
            if (logs[i].topics.length == 2 && logs[i].topics[0] == SKIPPED_SIG) {
                if (address(uint160(uint256(logs[i].topics[1]))) == gauge) {
                    reason = abi.decode(logs[i].data, (bytes));
                    found = true;
                }
            }
        }
    }

    // ---------------------------------------------------------------- 1. access control

    function test_deploy_setsFieldsAndApproval() public view {
        assertEq(h.owner(), FEE_SAFE);
        assertEq(h.bot(), bot);
        assertEq(h.admin(), FEE_SAFE);
        assertEq(h.botReserve(), DEFAULT_BOT_RESERVE);
        assertEq(
            IERC20Full(CRV).allowance(address(h), address(h.TRICRV())),
            type(uint256).max,
            "CRV->tricrv allowance is not max after deploy"
        );
    }

    function test_constructor_zeroAddress_reverts() public {
        vm.expectRevert(StakeDaoHarvester.ZeroAddress.selector);
        new StakeDaoHarvester(address(0), bot, FEE_SAFE, DEFAULT_BOT_RESERVE);
        vm.expectRevert(StakeDaoHarvester.ZeroAddress.selector);
        new StakeDaoHarvester(FEE_SAFE, address(0), FEE_SAFE, DEFAULT_BOT_RESERVE);
        vm.expectRevert(StakeDaoHarvester.ZeroAddress.selector);
        new StakeDaoHarvester(FEE_SAFE, bot, address(0), DEFAULT_BOT_RESERVE);
    }

    function test_harvest_notBot_reverts() public {
        vm.prank(rnd);
        vm.expectRevert(StakeDaoHarvester.NotBot.selector);
        h.harvest(gauges, 0, 0, 0, 250);
    }

    function test_harvestOne_notSelf_reverts() public {
        vm.prank(rnd);
        vm.expectRevert(StakeDaoHarvester.NotSelf.selector);
        h.harvestOne(gauges[0], 0, 1e14);
        // not even the bot or the owner may call it directly
        vm.prank(bot);
        vm.expectRevert(StakeDaoHarvester.NotSelf.selector);
        h.harvestOne(gauges[0], 0, 1e14);
        vm.prank(FEE_SAFE);
        vm.expectRevert(StakeDaoHarvester.NotSelf.selector);
        h.harvestOne(gauges[0], 0, 1e14);
    }

    function test_setBot_onlyOwner_andZeroAddressRejected() public {
        vm.prank(rnd);
        vm.expectRevert(StakeDaoHarvester.NotOwner.selector);
        h.setBot(rnd);

        vm.prank(FEE_SAFE);
        vm.expectRevert(StakeDaoHarvester.ZeroAddress.selector);
        h.setBot(address(0));

        vm.prank(FEE_SAFE);
        h.setBot(rnd);
        assertEq(h.bot(), rnd);
    }

    function test_setAdmin_onlyOwner_andZeroAddressRejected() public {
        vm.prank(rnd);
        vm.expectRevert(StakeDaoHarvester.NotOwner.selector);
        h.setAdmin(rnd);

        vm.prank(FEE_SAFE);
        vm.expectRevert(StakeDaoHarvester.ZeroAddress.selector);
        h.setAdmin(address(0));

        vm.prank(FEE_SAFE);
        h.setAdmin(rnd);
        assertEq(h.admin(), rnd);
    }

    function test_setBotReserve_onlyOwner() public {
        vm.prank(rnd);
        vm.expectRevert(StakeDaoHarvester.NotOwner.selector);
        h.setBotReserve(1 ether);

        vm.prank(FEE_SAFE);
        h.setBotReserve(1 ether);
        assertEq(h.botReserve(), 1 ether);
        // botReserve takes no address, so there is nothing to reject as zero: 0 is a legitimate value
        vm.prank(FEE_SAFE);
        h.setBotReserve(0);
        assertEq(h.botReserve(), 0);
    }

    function test_transferOwnership_twoStep() public {
        vm.prank(rnd);
        vm.expectRevert(StakeDaoHarvester.NotOwner.selector);
        h.transferOwnership(rnd);

        vm.prank(FEE_SAFE);
        h.transferOwnership(rnd);
        assertEq(h.pendingOwner(), rnd);
        assertEq(h.owner(), FEE_SAFE, "owner changed before acceptance");

        vm.prank(address(0xBAD));
        vm.expectRevert(StakeDaoHarvester.NotOwner.selector);
        h.acceptOwnership();

        vm.prank(rnd);
        h.acceptOwnership();
        assertEq(h.owner(), rnd);
        assertEq(h.pendingOwner(), address(0));

        // the old owner has lost its privileges
        vm.prank(FEE_SAFE);
        vm.expectRevert(StakeDaoHarvester.NotOwner.selector);
        h.setBot(bot);
    }

    function test_rescue_onlyOwner_andZeroToRejected() public {
        vm.deal(address(h), 1 ether);
        vm.prank(rnd);
        vm.expectRevert(StakeDaoHarvester.NotOwner.selector);
        h.rescue(address(0), rnd, 1 ether);

        vm.prank(FEE_SAFE);
        vm.expectRevert(StakeDaoHarvester.ZeroAddress.selector);
        h.rescue(address(0), address(0), 1 ether);
    }

    function test_rescue_eth() public {
        vm.deal(address(h), 1 ether);
        uint256 before = rnd.balance;
        vm.prank(FEE_SAFE);
        h.rescue(address(0), rnd, 0.4 ether);
        assertEq(rnd.balance - before, 0.4 ether);
        assertEq(address(h).balance, 0.6 ether);
    }

    function test_rescue_erc20_crv() public {
        deal(CRV, address(h), 100 ether);
        uint256 before = IERC20Full(CRV).balanceOf(rnd);
        vm.prank(FEE_SAFE);
        h.rescue(CRV, rnd, 40 ether);
        assertEq(IERC20Full(CRV).balanceOf(rnd) - before, 40 ether);
        assertEq(IERC20Full(CRV).balanceOf(address(h)), 60 ether);
    }

    // ---------------------------------------------------------------- 2. per-vault skip

    /// Measures each gauge's own breakeven gas price (CRV value at the Chainlink price / its own harvestOne gas),
    /// then picks a tx.gasprice between two of them so one gauge is just profitable and the other isn't — without
    /// touching src. A CRV buffer is pre-funded so the *whole* tx still clears minTotalProfitWei=0 regardless of
    /// which gauge gets skipped (that overall-profitability behavior is covered separately in section 3).
    /// Probes two gauges' own breakeven tx.gasprice (CRV value at the Chainlink price / that gauge's own harvestOne
    /// gas) at zero gas price, then reverts the probe and returns a gas price strictly between the two breakevens.
    ///
    /// Each gauge is probed SOLO (its own single-element harvest, its own snapshot/revert) rather than batched
    /// together: when the two are later harvested together and the first one reverts (VaultUnprofitable), the
    /// shared gauge-controller infra it touched does *not* stay warm for the second gauge in this fork's EVM (a
    /// revert rolling back warm/cold tracking along with storage) — a solo, from-cold measurement is what actually
    /// predicts each gauge's cost in that batch, whereas a "both succeed" probe would under-measure the second one.
    function _pickBreakevenSplit(address[] memory two) internal returns (address profitable, address unprofitable, uint256 midGasPrice) {
        uint256 breakeven0 = _soloBreakevenGasPrice(two[0]);
        uint256 breakeven1 = _soloBreakevenGasPrice(two[1]);
        require(breakeven0 != breakeven1, "probe: breakevens are identical, cannot separate the two gauges");

        (profitable, unprofitable, midGasPrice) = breakeven0 > breakeven1
            ? (two[0], two[1], (breakeven1 + breakeven0) / 2)
            : (two[1], two[0], (breakeven0 + breakeven1) / 2);
        console2.log("breakeven gauge0 / gauge1 / chosen tx.gasprice (wei/gas)", breakeven0, breakeven1, midGasPrice);
    }

    function _soloBreakevenGasPrice(address gauge) internal returns (uint256) {
        uint256 snap = vm.snapshotState();
        vm.txGasPrice(0);
        uint256 price = h.crvEthPrice();
        address[] memory solo = new address[](1);
        solo[0] = gauge;
        vm.recordLogs();
        vm.prank(bot);
        h.harvest(solo, 0, 0, 0, 250);
        Vm.Log[] memory probeLogs = vm.getRecordedLogs();
        (, uint256 crv, uint256 gasUsed,) = _harvestedFrom(probeLogs, gauge);
        require(gasUsed != 0, "probe: gauge did not harvest cleanly at zero gas price");
        vm.revertToState(snap);
        return (crv * price / 1e18) / gasUsed;
    }

    function test_perVaultSkip_unprofitableRolledBack_profitableHarvested() public {
        address[] memory two = new address[](2);
        two[0] = gauges[0];
        two[1] = gauges[1];

        (address profitableGauge, address unprofitableGauge, uint256 midGasPrice) = _pickBreakevenSplit(two);

        // The skip candidate must run first so it pays its own (stable) solo breakeven cost; putting the profit
        // candidate second means it inherits whatever warm/cold state the reverted first call leaves behind, but
        // its own solo breakeven is already the more conservative (cold) bound, so it stays profitable either way.
        address[] memory ordered = new address[](2);
        ordered[0] = unprofitableGauge;
        ordered[1] = profitableGauge;

        // generous CRV buffer so the overall tx is profitable no matter which gauge is skipped
        deal(CRV, address(h), 50 ether);

        vm.txGasPrice(midGasPrice);
        vm.recordLogs();
        vm.prank(bot);
        (uint256 n,) = h.harvest(ordered, 0, 0, 0, 250);
        Vm.Log[] memory logs = vm.getRecordedLogs();

        assertEq(n, 1, "exactly one gauge should have been harvested");
        (bool harvestedOk, uint256 crvOut,,) = _harvestedFrom(logs, profitableGauge);
        assertTrue(harvestedOk, "profitable gauge did not emit Harvested");
        assertGt(crvOut, 0, "profitable gauge's CRV received should be > 0");

        (bool skippedOk, bytes memory reason) = _skippedReasonFor(logs, unprofitableGauge);
        assertTrue(skippedOk, "unprofitable gauge did not emit Skipped");
        assertEq(bytes4(reason), StakeDaoHarvester.VaultUnprofitable.selector, "wrong skip reason");

        // the skipped gauge's whole sub-call (including the Accountant's internal checkpoint and any CRV transfer
        // to the harvester) was reverted by the EVM; confirm no stray CRV reached the harvester from it: the step-2
        // swap (every harvest sells 100% of CRV held) must have sold exactly the pre-funded buffer plus the
        // profitable gauge's own harvest, nothing more.
        (, uint256 crvSold,,,,) = abi.decode(logs[_settledIndex(logs)].data, (uint256, uint256, uint256, uint256, uint256, int256));
        assertEq(crvSold, 50 ether + crvOut, "CRV sold was more than just the buffer plus the profitable gauge's harvest");
    }

    function _settledIndex(Vm.Log[] memory logs) internal pure returns (uint256) {
        for (uint256 i; i < logs.length; ++i) {
            if (logs[i].topics.length == 1 && logs[i].topics[0] == SETTLED_SIG) return i;
        }
        revert("Settled event not found");
    }

    // ---------------------------------------------------------------- 3. total minimum (and §7's combined harvest+swap)

    /// Runs one real harvest of every gauge and returns (a) its actual returned profit and (b) an independently
    /// reconstructed estimate: sum(CRV x Chainlink price) - gasUsed*gasPrice - intrinsicGas*gasPrice. Also asserts
    /// the per-vault gas-sanity bound (§8) on each Harvested event along the way.
    function _measureProfitAndEstimate(uint256 gasPrice, uint256 intrinsicGas) internal returns (int256 actualProfit, int256 estimate) {
        vm.txGasPrice(gasPrice);
        uint256 price = h.crvEthPrice();
        vm.recordLogs();
        uint256 gBefore = gasleft();
        vm.prank(bot);
        uint256 n0;
        (n0, actualProfit) = h.harvest(gauges, 0, 0, intrinsicGas, 250);
        uint256 outerGasUsed = gBefore - gasleft();
        Vm.Log[] memory logs = vm.getRecordedLogs();
        assertEq(n0, gauges.length, "expected every gauge to be profitable at this low gas price");
        assertGt(actualProfit, 0, "test premise requires a positive profit to probe the boundary");

        uint256 crvValueSum;
        for (uint256 i; i < gauges.length; ++i) {
            (bool ok, uint256 crv, uint256 gasUsed,) = _harvestedFrom(logs, gauges[i]);
            assertTrue(ok, "expected a Harvested event for every gauge");
            crvValueSum += crv * price / 1e18;
            assertGe(gasUsed, 300_000, "gasUsed below the sane per-vault floor");
            assertLe(gasUsed, 1_000_000, "gasUsed above the sane per-vault ceiling");
        }
        estimate = int256(crvValueSum) - int256(outerGasUsed * gasPrice) - int256(intrinsicGas * gasPrice);
    }

    function test_totalMinimum_boundaryAndProfitEstimate() public {
        uint256 intrinsicGas = 21_000;
        uint256 gasPrice = 0.03 gwei;
        uint256 snap = vm.snapshotState();

        (int256 actualProfit, int256 estimate) = _measureProfitAndEstimate(gasPrice, intrinsicGas);
        int256 diff = actualProfit > estimate ? actualProfit - estimate : estimate - actualProfit;
        uint256 tolerance = uint256(actualProfit) / 10 + 1; // within 10%, +1 to tolerate rounding at tiny values
        assertLe(uint256(diff), tolerance, "actual profit diverges from the independent estimate by more than 10%");

        vm.revertToState(snap);
        vm.txGasPrice(gasPrice);

        // Replaying the identical call after a snapshot revert reproduces the same ethOut (same pool state) but can
        // land a handful of SLOADs on a different warm/cold boundary, shifting the self-measured gasUsed by a few
        // thousand gas — observed up to ~0.8% of profitWei on this fork. A 5% margin comfortably clears that noise
        // while still exercising "just above / just below" the real boundary.
        uint256 margin = uint256(actualProfit) / 20 + 1;
        _expectRevertJustAbove(actualProfit, intrinsicGas, margin);
        // the EVM has already unwound that call; no gauge should show as harvested
        assertEq(IERC20Full(CRV).balanceOf(address(h)), 0, "CRV balance should be unchanged after a full revert");

        _succeedJustBelow(actualProfit, intrinsicGas, margin);
    }

    function _expectRevertJustAbove(int256 actualProfit, uint256 intrinsicGas, uint256 margin) internal {
        vm.prank(bot);
        vm.expectPartialRevert(StakeDaoHarvester.TotalUnprofitable.selector);
        h.harvest(gauges, 0, uint256(actualProfit) + margin, intrinsicGas, 250);
    }

    function _succeedJustBelow(int256 actualProfit, uint256 intrinsicGas, uint256 margin) internal {
        vm.prank(bot);
        (uint256 n1, int256 profit1) = h.harvest(gauges, 0, uint256(actualProfit) - margin, intrinsicGas, 250);
        assertEq(n1, gauges.length);
        assertGe(profit1, int256(uint256(actualProfit) - margin), "profit should still clear the lowered minimum");
    }

    // ---------------------------------------------------------------- 4. a reverting gauge is skipped, not fatal

    function test_invalidGaugeAddress_isSkippedNotFatal() public {
        address notAGauge = address(0x1111111111111111111111111111111111111111);
        address[] memory mixed = new address[](2);
        mixed[0] = gauges[0];
        mixed[1] = notAGauge;

        vm.txGasPrice(0);
        vm.recordLogs();
        vm.prank(bot);
        (uint256 n,) = h.harvest(mixed, 0, 0, 0, 250);
        Vm.Log[] memory logs = vm.getRecordedLogs();

        assertEq(n, 1, "the real gauge should still be harvested");
        (bool harvestedOk,,,) = _harvestedFrom(logs, gauges[0]);
        assertTrue(harvestedOk);

        (bool skippedOk, bytes memory reason) = _skippedReasonFor(logs, notAGauge);
        assertTrue(skippedOk, "the bad address should have been skipped, not reverted the whole tx");
        assertEq(bytes4(reason), InvalidVault.selector, "expected the Accountant's InvalidVault to bubble up as the skip reason");
    }

    // ---------------------------------------------------------------- 5. stale price

    function test_stalePrice_oldUpdatedAt_reverts() public {
        address feed = address(h.CRV_ETH_FEED());
        vm.mockCall(
            feed,
            abi.encodeWithSignature("latestRoundData()"),
            abi.encode(uint80(1), int256(1.4e14), uint256(0), block.timestamp - 26 hours - 1, uint80(1))
        );
        vm.prank(bot);
        vm.expectRevert(StakeDaoHarvester.StalePrice.selector);
        h.harvest(gauges, 0, 0, 0, 250);
    }

    function test_stalePrice_nonPositiveAnswer_reverts() public {
        address feed = address(h.CRV_ETH_FEED());
        vm.mockCall(
            feed, abi.encodeWithSignature("latestRoundData()"), abi.encode(uint80(1), int256(0), uint256(0), block.timestamp, uint80(1))
        );
        vm.prank(bot);
        vm.expectRevert(StakeDaoHarvester.StalePrice.selector);
        h.harvest(gauges, 0, 0, 0, 250);

        vm.mockCall(
            feed, abi.encodeWithSignature("latestRoundData()"), abi.encode(uint80(1), int256(-1), uint256(0), block.timestamp, uint80(1))
        );
        vm.prank(bot);
        vm.expectRevert(StakeDaoHarvester.StalePrice.selector);
        h.harvest(gauges, 0, 0, 0, 250);
    }

    // ---------------------------------------------------------------- 6. payout / reserve distribution

    function test_payout_botBelowReserve_filledExactly_restToAdmin() public {
        deal(CRV, address(h), 5_000 ether);
        uint256 adminBefore = FEE_SAFE.balance;
        vm.txGasPrice(0);
        vm.prank(bot);
        (, int256 ethOut) = h.harvest(new address[](0), 0, 0, 0, 250);
        assertGt(uint256(ethOut), DEFAULT_BOT_RESERVE, "test premise: swap proceeds must exceed the reserve");
        assertEq(bot.balance, DEFAULT_BOT_RESERVE, "bot should be filled to exactly botReserve");
        assertEq(FEE_SAFE.balance - adminBefore, uint256(ethOut) - DEFAULT_BOT_RESERVE, "admin should get the rest");
    }

    function test_payout_botAboveReserve_allToAdmin() public {
        vm.deal(bot, DEFAULT_BOT_RESERVE + 0.01 ether);
        uint256 botBefore = bot.balance;
        deal(CRV, address(h), 5_000 ether);
        uint256 adminBefore = FEE_SAFE.balance;
        vm.txGasPrice(0);
        vm.prank(bot);
        (, int256 ethOut) = h.harvest(new address[](0), 0, 0, 0, 250);
        assertEq(bot.balance, botBefore, "bot already above reserve should receive nothing");
        assertEq(FEE_SAFE.balance - adminBefore, uint256(ethOut), "admin should get all of it");
    }

    function test_payout_ethOutBelowShortfall_allToBot_adminZero() public {
        vm.prank(FEE_SAFE);
        h.setBotReserve(1 ether); // a shortfall no small swap can cover
        deal(CRV, address(h), 0.01 ether);
        uint256 adminBefore = FEE_SAFE.balance;
        vm.txGasPrice(0);
        vm.prank(bot);
        (, int256 ethOut) = h.harvest(new address[](0), 0, 0, 0, 250);
        assertGt(uint256(ethOut), 0, "test premise: the swap must produce some ETH");
        assertEq(bot.balance, uint256(ethOut), "all proceeds should go to the bot when they can't fill the reserve");
        assertEq(FEE_SAFE.balance, adminBefore, "admin should get nothing");
    }

    function test_slippage_tooHigh_reverts() public {
        vm.prank(bot);
        vm.expectRevert(StakeDaoHarvester.BadSlippage.selector);
        h.harvest(new address[](0), 0, 0, 0, 501);
    }

    function test_slippage_tooTight_revertsInPool() public {
        deal(CRV, address(h), 500 ether);
        vm.txGasPrice(0);
        vm.prank(bot);
        vm.expectRevert(); // the pool's own min_dy check, not one of the contract's named errors
        h.harvest(new address[](0), 0, 0, 0, 0);
    }

    function test_emptyGauges_profitCheckPasses() public {
        deal(CRV, address(h), 5_000 ether);
        vm.txGasPrice(0);
        vm.prank(bot);
        (uint256 n, int256 profit) = h.harvest(new address[](0), 0, 0, 0, 250);
        assertEq(n, 0);
        assertGt(profit, 0);
    }

    function test_emptyGauges_profitCheckReverts_whenMinTooHigh() public {
        deal(CRV, address(h), 5_000 ether);
        vm.txGasPrice(0);
        vm.prank(bot);
        vm.expectRevert(); // TotalUnprofitable, exact profitWei depends on the live pool quote
        h.harvest(new address[](0), 0, 1_000 ether, 0, 250);
    }
}
