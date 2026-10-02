import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG as cfg, candidates, selectSet, breakEvenGasPrice, feePlan, intrinsicGasOf } from '../src/plan.js';

const crvEth = 0.000142; // ETH per CRV
const ethUsd = 2700;
const gwei = (n) => n * 1e9;
// harvester fee needed to break even on one vault at `g` gwei with `gas` gas, plus the per-vault minimum
const feeFor = (g, gas) => ((gas * gwei(g)) / 1e18 + cfg.minVaultProfitUsd / ethUsd) / crvEth;

test('selectSet harvests every vault that clears the per-vault minimum, highest fee first', () => {
  const vaults = [
    { gauge: 'a', feeCrv: 5 }, { gauge: 'b', feeCrv: 0.01 }, { gauge: 'c', feeCrv: 3 }, { gauge: 'd', feeCrv: 2 },
  ];
  const r = selectSet(vaults, gwei(0.03), crvEth, ethUsd, cfg, 30_000);
  assert.deepEqual(r.chosen.map((v) => v.gauge), ['a', 'c', 'd']);
  assert.equal(r.ok, true);
});

test('selectSet can take 15+ vaults in one transaction', () => {
  const vaults = Array.from({ length: 18 }, (_, i) => ({ gauge: `g${i}`, feeCrv: 4 + i * 0.1 }));
  const r = selectSet(vaults, gwei(0.02), crvEth, ethUsd, cfg, 40_000);
  assert.equal(r.chosen.length, 18);
});

test('total minimum: one marginal vault alone is rejected, enough of them pass', () => {
  const marginal = feeFor(0.05, cfg.firstVaultGas) * 1.01;
  assert.equal(selectSet([{ gauge: 'x', feeCrv: marginal }], gwei(0.05), crvEth, ethUsd, cfg, 30_000).ok, false);
});

test('breakEvenGasPrice: the set exactly meets the minimums at that price', () => {
  const vaults = [{ gauge: 'a', feeCrv: 6 }, { gauge: 'b', feeCrv: 4 }];
  const be = breakEvenGasPrice(vaults, crvEth, ethUsd, cfg, 30_000);
  assert.ok(selectSet(vaults, be, crvEth, ethUsd, cfg, 30_000).ok, 'profitable at break-even');
  assert.equal(selectSet(vaults, be * 1.05, crvEth, ethUsd, cfg, 30_000).chosen.length === 2
    && selectSet(vaults, be * 1.05, crvEth, ethUsd, cfg, 30_000).ok, false, 'not both above it');
});

test('feePlan normal: maxFee = base × 1.05, profit judged at base + tip', () => {
  const vaults = [{ gauge: 'a', feeCrv: 20 }, { gauge: 'b', feeCrv: 15 }];
  const p = feePlan({ vaults, baseFeeWei: gwei(0.05), tipWei: gwei(0.002), crvEth, ethUsd, cfg, intrinsicGas: 30_000 });
  assert.equal(p.mode, 'normal');
  assert.equal(p.maxFeePerGas, Math.ceil(gwei(0.05) * 1.05));
  assert.equal(p.maxPriorityFeePerGas, gwei(0.002));
});

test('feePlan near-miss: profitable only slightly below the base fee → priced at base, waits for it to fall', () => {
  const vaults = [{ gauge: 'a', feeCrv: 14 }, { gauge: 'b', feeCrv: 12 }];
  const be = breakEvenGasPrice(vaults, crvEth, ethUsd, cfg, 30_000);
  const base = be / 0.9; // break-even is 10% under the base fee (within the 20% window)
  const p = feePlan({ vaults, baseFeeWei: base, tipWei: 0, crvEth, ethUsd, cfg, intrinsicGas: 30_000 });
  assert.equal(p.mode, 'near-miss');
  // priced at the current base fee (accepted by MEV Blocker); profitable only once the base fee falls to break-even
  assert.equal(p.maxFeePerGas, Math.ceil(base));
  assert.ok(p.effectiveGasPrice < base && p.effectiveGasPrice >= base * 0.8);
});

test('feePlan none: break-even more than 20% under the base fee', () => {
  const vaults = [{ gauge: 'a', feeCrv: 14 }, { gauge: 'b', feeCrv: 12 }];
  const be = breakEvenGasPrice(vaults, crvEth, ethUsd, cfg, 30_000);
  const p = feePlan({ vaults, baseFeeWei: be / 0.7, tipWei: 0, crvEth, ethUsd, cfg, intrinsicGas: 30_000 });
  assert.equal(p.mode, 'none');
});

test('candidates projects fees forward with the accrual rate and keeps near break-even ones', () => {
  const priority = {
    ts: 1000, crvEth, ethUsd,
    hot: [
      { gauge: 'fast', feeCrv: 0.1, rateCrvPerSec: 0.01 }, // +3 CRV after 300 s
      { gauge: 'slow', feeCrv: 0.1, rateCrvPerSec: 0 }, // breaks even at ~0.02 gwei: below the floor
    ],
  };
  const c = candidates(priority, 1300, gwei(0.05), cfg);
  assert.deepEqual(c.map((v) => v.gauge), ['fast']);
  assert.ok(Math.abs(c[0].feeEst - 3.1) < 1e-9);
});

test('intrinsicGasOf counts zero and non-zero calldata bytes', () => {
  assert.equal(intrinsicGasOf('0x'), 21_000);
  assert.equal(intrinsicGasOf('0x00ff'), 21_000 + 4 + 16);
});

