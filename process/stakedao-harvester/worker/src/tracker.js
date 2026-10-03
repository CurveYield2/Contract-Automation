// Vault tracking by prediction, not polling (SPEC.md "Vault tracking inside the Worker"). Pure functions (no I/O).
// A gauge's CRV accrues at a fixed rate within a Curve epoch (weights update weekly, Thursday 00:00 UTC), so each
// vault's harvester fee is predicted from one read + its rate, and a vault is only looked at once it is "ready":
// its fee could pay for its own gas at the lowest gas price the bot would ever act at.

export const EPOCH_SEC = 7 * 86_400; // Curve epochs start Thursday 00:00 UTC (unix time 0 was a Thursday)
export const epochStart = (t) => Math.floor(t / EPOCH_SEC) * EPOCH_SEC;

/// Locker CRV per second from the gauge's own parameters (exact within an epoch; 0 if killed or empty).
export function lockerCrvPerSec({ crvRate, relativeWeight, workingBalance, workingSupply, killed }) {
  if (killed || !workingSupply) return 0;
  return (crvRate * relativeWeight * workingBalance) / workingSupply;
}

/// The fee (CRV) a vault must reach before it can be worth harvesting at all: its own gas at readyGasGwei (counted
/// as an extra vault in a batch — the cheapest it ever gets) plus the per-vault minimum profit.
export function feeNeededCrv(cfg, crvEth, ethUsd) {
  const gasEth = (cfg.readyGasGwei * 1e9 * cfg.nextVaultGas) / 1e18;
  return (gasEth + cfg.minVaultProfitUsd / ethUsd) / crvEth;
}

/// When the vault becomes ready (unix s). A vault with no accrual is re-checked at the next epoch.
export function readyAtOf(v, needCrv, now) {
  if (v.fee >= needCrv) return v.at;
  if (!(v.rate > 0)) return epochStart(now) + EPOCH_SEC + 600;
  return Math.ceil(v.at + (needCrv - v.fee) / v.rate);
}

/// Predicted fee now (only ever evaluated for ready vaults).
export const predictedFee = (v, now) => v.fee + v.rate * Math.max(0, now - v.at);

/// The hot list for the planner: ready vaults only, with their predicted fee as of `now`.
export function readyPriority(ledger, now) {
  const hot = [];
  for (const v of Object.values(ledger.vaults)) {
    if (v.readyAt > now) continue;
    hot.push({ gauge: v.gauge, vault: v.vault, name: v.name, sidecars: v.sidecars, feeCrv: predictedFee(v, now), rateCrvPerSec: v.rate });
  }
  hot.sort((a, b) => b.feeCrv - a.feeCrv);
  return { ts: now, crvEth: ledger.crvEth, ethUsd: ledger.ethUsd, hot, source: 'tracker' };
}

/// After an exact read before planning: re-baseline the vault. Returns 'harvested' (someone else harvested: fee far
/// below the prediction, rate kept), 'recalc' (prediction off by more than recalcDevPct: rate must be recomputed),
/// or 'ok'.
export function applyExactRead(v, exactFee, now, cfg, needCrv) {
  const predicted = predictedFee(v, now);
  let verdict = 'ok';
  if (exactFee < predicted * (1 - cfg.harvestedDropPct / 100)) verdict = 'harvested';
  else if (predicted > 0 && Math.abs(exactFee / predicted - 1) > cfg.recalcDevPct / 100) verdict = 'recalc';
  v.fee = exactFee;
  v.at = now;
  v.readyAt = readyAtOf(v, needCrv, now);
  if (verdict === 'recalc') v.recalc = true;
  return verdict;
}

/// After our own harvest landed: those vaults start from zero.
export function markHarvested(ledger, gauges, now, needCrv) {
  for (const g of gauges) {
    const v = ledger.vaults[g.toLowerCase()];
    if (!v) continue;
    v.fee = 0;
    v.at = now;
    v.readyAt = readyAtOf(v, needCrv, now);
  }
}

/// Is a full calibration due? No ledger yet, or a new epoch started ≥ 10 min ago (weights updated).
export function calibrationDue(ledger, now) {
  if (!ledger || !ledger.vaults) return true;
  const e = epochStart(now);
  return ledger.epoch < e && now - e >= 600;
}
