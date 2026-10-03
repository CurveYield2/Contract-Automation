// Pure planning functions (no I/O) — SPEC.md §5. Units: CRV and ETH as JS numbers in whole tokens, gas prices in wei.

export const DEFAULT_CONFIG = {
  minTotalProfitUsd: 0.03, // per-tx minimum profit (2026-10-02: $0.03; live value set via /config)
  minVaultProfitUsd: 0.01,
  maxBaseFeeGwei: 0.12,
  gasStreakOverride: 50,
  maxFeeOverBasePct: 5,
  nearMissPct: 20,
  speedUpAfterSec: 90,
  speedUpPct: 25,
  monitorSec: 300,
  minTipGwei: 0.001,
  maxTipGwei: 0.005, // absolute-minimum landing tip: fee-history tip capped here
  swapSlippageBps: 250,
  swapLossPct: 1.0, // expected tricrv discount vs Chainlink when valuing the total
  firstVaultGas: 720_000, // first harvest of a tx touches cold Accountant/strategy/minter slots (measured 714k)
  nextVaultGas: 380_000, // measured 330k–405k per extra vault (34-vault fork run, 2026-10-01)
  baseGas: 190_000, // swap + payout + loop overhead (intrinsic gas added separately)
  gasLimitMarginPct: 20, // gas LIMIT only (unused gas is not charged)
  maxVaultsPerTx: 40, // harvest every profitable vault at once (40 × ~320k gas ≈ 13M, within a block)
  priorityMaxAgeSec: 1_800, // ignore a hot list older than this
  // v1.1 (only used when the Worker var HARVESTER_V11 = "1" and the contract has harvestBatch — SPEC.md v1.1)
  batchFirstVaultGas: 620_000, // harvestBatch, measured 2026-10-02: 1 vault 826k with swap, 664k without
  batchNextVaultGas: 290_000, // measured 249k–348k per extra vault, avg 290k (5-vault fork run)
  noSwapBaseGas: 30_000, // harvestBatch without the swap: CRV transfer + checks
  swapMode: 0, // 0 = always swap (ETH profit floor); 1 = swap only while the bot holds < swapBelowEth
  swapBelowEth: 0.0005,
  batchRetryPerVaultSec: 900, // after a batch is not included, use the per-vault harvest for this long
  // vault tracking by prediction (SPEC "Vault tracking inside the Worker")
  readyGasGwei: 0.03, // a vault is 'ready' once its fee could pay its own gas at this price (+ the per-vault minimum)
  harvestedDropPct: 50, // exact read this far below the prediction -> someone harvested it
  recalcDevPct: 5, // otherwise an error above this -> recompute that vault's rate
  calibrateHeavyChunk: 60, // claimable_tokens/getPendingRewards per eth_call (they checkpoint: heavy)
  sidecarRateBlocks: 300, // sidecar accrual measured over this many blocks (about 1 h)
  rateRefreshSec: 21_600, // light TVL refresh (working balance/supply only) every 6 h
  paused: 0, // circuit breaker: set to 1 by the bot itself on a mined revert; resume with /config {"paused":0}
};

const gwei = (n) => n * 1e9;

/// Estimated harvester fee (CRV) of each hot vault right now, from the monitor's snapshot + accrual rate.
export function projectFees(priority, nowSec) {
  const dt = Math.max(0, nowSec - priority.ts);
  return priority.hot.map((v) => ({ ...v, feeEst: v.feeCrv + v.rateCrvPerSec * dt }));
}

/// Vaults worth reading on-chain this minute: projected break-even >= base fee × (1 − nearMiss).
export function candidates(priority, nowSec, baseFeeWei, cfg) {
  const crvEth = priority.crvEth;
  const minVaultCrv = cfg.minVaultProfitUsd / (crvEth * priority.ethUsd);
  const floor = baseFeeWei * (1 - cfg.nearMissPct / 100);
  return projectFees(priority, nowSec)
    .filter((v) => ((v.feeEst - minVaultCrv) * crvEth * 1e18) / cfg.nextVaultGas >= floor)
    .sort((a, b) => b.feeEst - a.feeEst);
}

/// Gas the contract will measure for the i-th harvested vault.
const vaultGas = (i, cfg) => (i === 0 ? cfg.firstVaultGas : cfg.nextVaultGas);

/// Profit (ETH) of harvesting `vaults` (exact on-chain fees, highest first) at `gasPriceWei`.
export function evaluate(vaults, gasPriceWei, crvEth, cfg, intrinsicGas) {
  const loss = 1 - cfg.swapLossPct / 100;
  let gas = cfg.baseGas + intrinsicGas;
  let ethOut = 0;
  vaults.forEach((v, i) => {
    gas += vaultGas(i, cfg);
    ethOut += v.feeCrv * crvEth * loss;
  });
  return { ethOut, gas, profitEth: ethOut - (gas * gasPriceWei) / 1e18 };
}

/// Chooses the harvest set at `gasPriceWei`: every vault must clear the per-vault minimum with the gas the contract
/// will measure for it (in order, highest fee first), and the set must clear the total minimum.
export function selectSet(vaults, gasPriceWei, crvEth, ethUsd, cfg, intrinsicGas) {
  const minVaultEth = cfg.minVaultProfitUsd / ethUsd;
  const minTotalEth = cfg.minTotalProfitUsd / ethUsd;
  const chosen = [];
  for (const v of [...vaults].sort((a, b) => b.feeCrv - a.feeCrv)) {
    if (chosen.length >= cfg.maxVaultsPerTx) break;
    const g = vaultGas(chosen.length, cfg);
    if (v.feeCrv * crvEth - (g * gasPriceWei) / 1e18 >= minVaultEth) chosen.push(v);
  }
  const ev = evaluate(chosen, gasPriceWei, crvEth, cfg, intrinsicGas);
  return { chosen, ...ev, minTotalEth, minVaultEth, ok: chosen.length > 0 && ev.profitEth >= minTotalEth };
}

/// Highest gas price (wei) at which `vaults` (in order) still meets both minimums — the set's break-even.
export function breakEvenGasPrice(vaults, crvEth, ethUsd, cfg, intrinsicGas) {
  if (!vaults.length) return 0;
  const minVaultEth = cfg.minVaultProfitUsd / ethUsd;
  const minTotalEth = cfg.minTotalProfitUsd / ethUsd;
  let limit = Infinity;
  vaults.forEach((v, i) => {
    limit = Math.min(limit, ((v.feeCrv * crvEth - minVaultEth) * 1e18) / vaultGas(i, cfg));
  });
  const ev = evaluate(vaults, 0, crvEth, cfg, intrinsicGas);
  limit = Math.min(limit, ((ev.ethOut - minTotalEth) * 1e18) / ev.gas);
  return Math.max(0, Math.floor(limit));
}

/// The fees to broadcast with. Normal: maxFee = base × (1 + cap), tip = minimal landing tip; profit judged at
/// base + tip. Near-miss: the set is profitable only below the current base fee but within nearMissPct → maxFee =
/// the set's break-even, minimal tip, and it waits in the mempool for the base fee to fall.
export function feePlan({ vaults, baseFeeWei, tipWei, crvEth, ethUsd, cfg, intrinsicGas }) {
  const tip = Math.min(Math.max(tipWei, gwei(cfg.minTipGwei)), gwei(cfg.maxTipGwei));
  const effective = baseFeeWei + tip;
  const now = selectSet(vaults, effective, crvEth, ethUsd, cfg, intrinsicGas);
  if (now.ok) {
    const maxFee = Math.max(Math.ceil(baseFeeWei * (1 + cfg.maxFeeOverBasePct / 100)), effective);
    return { mode: 'normal', set: now, maxFeePerGas: maxFee, maxPriorityFeePerGas: tip, effectiveGasPrice: effective };
  }
  // near-miss: largest profitable set at a lower price
  const minTip = gwei(cfg.minTipGwei);
  const floor = baseFeeWei * (1 - cfg.nearMissPct / 100);
  const lower = selectSet(vaults, Math.max(floor, minTip), crvEth, ethUsd, cfg, intrinsicGas);
  if (!lower.ok) return { mode: 'none', set: now };
  const be = breakEvenGasPrice(lower.chosen, crvEth, ethUsd, cfg, intrinsicGas);
  if (be < floor || be >= effective) return { mode: 'none', set: now };
  // Priced at the current base fee so MEV Blocker accepts it; the contract reverts it while the price is above the
  // set's break-even (revert protection → not included, no cost) and it lands profitably if the base fee falls.
  return {
    mode: 'near-miss', set: selectSet(lower.chosen, be, crvEth, ethUsd, cfg, intrinsicGas),
    maxFeePerGas: Math.max(Math.ceil(baseFeeWei), be), maxPriorityFeePerGas: Math.min(minTip, be), effectiveGasPrice: be,
  };
}

/// Calldata gas: 16 per non-zero byte, 4 per zero byte, + 21,000.
export function intrinsicGasOf(hexData) {
  let gas = 21_000;
  for (let i = 2; i < hexData.length; i += 2) gas += hexData.slice(i, i + 2) === '00' ? 4 : 16;
  return gas;
}

/// v1.1: swap this transaction? Always in swapMode 0; in swapMode 1 only while the bot's ETH is below swapBelowEth.
export function useSwap(botBalanceWei, cfg) {
  return !cfg.swapMode || Number(botBalanceWei) / 1e18 < cfg.swapBelowEth;
}

/// The planning config for a transaction: per-vault (v1) or batched (v1.1), with or without the swap. Without the
/// swap the contract values CRV at Chainlink minus slippageBps, so the model uses the same haircut.
export function planCfg(cfg, batch, swap) {
  if (!batch) return cfg;
  return {
    ...cfg,
    firstVaultGas: cfg.batchFirstVaultGas,
    nextVaultGas: cfg.batchNextVaultGas,
    baseGas: swap ? cfg.baseGas : cfg.noSwapBaseGas,
    swapLossPct: swap ? cfg.swapLossPct : cfg.swapSlippageBps / 100,
  };
}
