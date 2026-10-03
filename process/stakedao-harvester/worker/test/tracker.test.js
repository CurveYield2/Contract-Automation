import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG as cfg } from '../src/plan.js';
import {
  EPOCH_SEC, epochStart, lockerCrvPerSec, feeNeededCrv, readyAtOf, predictedFee, readyPriority, applyExactRead,
  markHarvested, calibrationDue,
} from '../src/tracker.js';

test('epochs start Thursday 00:00 UTC', () => {
  const t = Date.UTC(2026, 9, 3, 15, 0, 0) / 1000; // Saturday 2026-10-03
  assert.equal(new Date(epochStart(t) * 1000).toISOString(), '2026-10-01T00:00:00.000Z'); // Thursday
  assert.equal(epochStart(t + EPOCH_SEC) - epochStart(t), EPOCH_SEC);
});

test('locker rate = CRV rate x weight x working balance / working supply; 0 when killed', () => {
  assert.equal(lockerCrvPerSec({ crvRate: 2, relativeWeight: 0.01, workingBalance: 50, workingSupply: 100, killed: false }), 0.01);
  assert.equal(lockerCrvPerSec({ crvRate: 2, relativeWeight: 0.01, workingBalance: 50, workingSupply: 100, killed: true }), 0);
  assert.equal(lockerCrvPerSec({ crvRate: 2, relativeWeight: 0.01, workingBalance: 0, workingSupply: 0, killed: false }), 0);
});

test('ready time: computed once from fee, rate and the fee needed', () => {
  const need = 1;
  assert.equal(readyAtOf({ fee: 0.25, rate: 0.001, at: 1000 }, need, 1000), 1000 + 750); // 0.75 CRV / 0.001 per s
  assert.equal(readyAtOf({ fee: 2, rate: 0.001, at: 1000 }, need, 5000), 1000); // already ready
  const now = Date.UTC(2026, 9, 3) / 1000;
  assert.equal(readyAtOf({ fee: 0, rate: 0, at: now }, need, now), epochStart(now) + EPOCH_SEC + 600); // no accrual
  const n = feeNeededCrv({ ...cfg, readyGasGwei: 0.03, nextVaultGas: 290_000, minVaultProfitUsd: 0.01 }, 0.000136, 2663);
  assert.ok(n > 0.08 && n < 0.12, `fee needed ${n}`); // ~0.064 CRV of gas + ~0.028 CRV minimum
});

test('only ready vaults reach the planner; predicted fee grows linearly', () => {
  const ledger = { crvEth: 0.000136, ethUsd: 2663, vaults: {
    a: { gauge: 'A', vault: 'va', name: 'a', sidecars: [], fee: 1, rate: 0.001, at: 1000, readyAt: 900 },
    b: { gauge: 'B', vault: 'vb', name: 'b', sidecars: [], fee: 0, rate: 0.001, at: 1000, readyAt: 99_999 },
  } };
  const pr = readyPriority(ledger, 2000);
  assert.deepEqual(pr.hot.map((h) => h.gauge), ['A']);
  assert.equal(pr.hot[0].feeCrv, 1 + 0.001 * 1000);
  assert.equal(pr.ts, 2000);
  assert.equal(predictedFee(ledger.vaults.b, 3000), 2);
});

test('exact reads: harvested (fee far below prediction), recalc (off > 5%), ok', () => {
  const c = { ...cfg, harvestedDropPct: 50, recalcDevPct: 5 };
  const mk = () => ({ fee: 1, rate: 0.001, at: 0 }); // predicted 2 at t=1000
  let v = mk();
  assert.equal(applyExactRead(v, 0.1, 1000, c, 1), 'harvested');
  assert.equal(v.fee, 0.1);
  assert.equal(v.at, 1000);
  assert.equal(v.rate, 0.001, 'rate kept');
  assert.equal(v.recalc, undefined);
  v = mk();
  assert.equal(applyExactRead(v, 2.3, 1000, c, 1), 'recalc');
  assert.equal(v.recalc, true);
  v = mk();
  assert.equal(applyExactRead(v, 2.04, 1000, c, 1), 'ok');
});

test('our own harvest resets those vaults to zero and pushes their ready time out', () => {
  const ledger = { vaults: { '0xab': { gauge: '0xAB', fee: 5, rate: 0.001, at: 0, readyAt: 0 } } };
  markHarvested(ledger, ['0xAB'], 1000, 1);
  assert.equal(ledger.vaults['0xab'].fee, 0);
  assert.equal(ledger.vaults['0xab'].readyAt, 1000 + 1000);
});

test('calibration is due with no ledger, or 10 min after a new epoch starts', () => {
  const e = Date.UTC(2026, 9, 1) / 1000; // Thursday
  assert.equal(calibrationDue(null, e), true);
  const ledger = { vaults: {}, epoch: e - EPOCH_SEC };
  assert.equal(calibrationDue(ledger, e + 300), false);
  assert.equal(calibrationDue(ledger, e + 600), true);
  assert.equal(calibrationDue({ vaults: {}, epoch: e }, e + 3 * 86_400), false);
});
