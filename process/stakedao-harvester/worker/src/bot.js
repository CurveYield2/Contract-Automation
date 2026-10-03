// BotState Durable Object: the per-minute harvest logic (SPEC.md §5) and all bot state.
// Storage: 3 keys (cfg, priority, s) on the SQLite backend → ≤ 2 rows written per minute.
// Subrequests per tick: ≤ 4 (fee history, multicall, nonce, send). No pre-send simulation: the contract reverts.
import { DurableObject } from 'cloudflare:workers';
import { createPublicClient, http, parseAbi, encodeFunctionData, keccak256, toHex, getAddress } from 'viem';
import { mainnet } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { DEFAULT_CONFIG, candidates, feePlan, selectSet, intrinsicGasOf, useSwap, planCfg } from './plan.js';
import { lockerCrvPerSec, feeNeededCrv, readyAtOf, readyPriority, applyExactRead, markHarvested, calibrationDue, epochStart, predictedFee } from './tracker.js';

const ACCOUNTANT = '0x93b4B9bd266fFA8AF68e39EDFa8cFe2A62011Ce0';
const LOCKER = '0x52f541764E6e90eeBc5c21Ff570De0e2D63766B6';
const CRV_ETH_FEED = '0x8a12Be339B0cD1829b91Adc01977caa5E9ac121e';
const ETH_USD_FEED = '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419';
const MULTICALL3 = '0xcA11bde05977b3631167028862bE2a173976CA11';
const ALLOCATOR = '0xA56B653CE86D1B84b0Ac67bD41F007898cfC14e4';
const CRV = '0xD533a949740bb3306d119CC777fa900bA034cd52';
const GAUGE_CONTROLLER = '0x2F50D538606Fa9EDD2B11E2446BEb18C9D5846bB';
const VAULT_LIST_URL = 'https://raw.githubusercontent.com/stake-dao/api/main/api/strategies/v2/curve/1.json';
// Harvested(address indexed gauge, uint256 crv, uint256 gasUsed, uint256 profitWei)
const HARVESTED_SIG = keccak256(toHex('Harvested(address,uint256,uint256,uint256)'));

const READ_ABI = parseAbi([
  'function claimable_tokens(address) view returns (uint256)',
  'function getPendingRewards() view returns (uint256)',
  'function vaults(address) view returns (uint256,uint128,uint128,uint128,uint128,uint128,uint128)',
  'function getHarvestFeePercent() view returns (uint128)',
  'function latestRoundData() view returns (uint80,int256,uint256,uint256,uint80)',
  'function getEthBalance(address) view returns (uint256)',
  'function rate() view returns (uint256)',
  'function gauge_relative_weight(address) view returns (uint256)',
  'function working_balances(address) view returns (uint256)',
  'function working_supply() view returns (uint256)',
  'function is_killed() view returns (bool)',
  'function getAllocationTargets(address) view returns (address[])',
]);
const HARVESTER_ABI = parseAbi([
  'function harvest(address[] gauges, uint256 minVaultProfitWei, uint256 minTotalProfitWei, uint256 intrinsicGas, uint256 slippageBps) returns (uint256 harvested, int256 profitWei)',
  'function harvestBatch(address[] gauges, uint256 minTotalProfitWei, uint256 intrinsicGas, uint256 slippageBps, bool swap) returns (int256 profitWei)',
]);

const nowSec = () => Math.floor(Date.now() / 1000);
const big = (n) => BigInt(Math.floor(n));

export class BotState extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.client = createPublicClient({ chain: mainnet, transport: http(env.ETH_RPC_URL, { retryCount: 1, timeout: 20_000 }) });
    this.account = env.BOT_PRIVATE_KEY ? privateKeyToAccount(env.BOT_PRIVATE_KEY) : null;
  }

  async fetch(request) {
    const route = new URL(request.url).pathname.slice(1);
    if (route === 'tick') return Response.json(await this.tick());
    const body = await request.text();
    if (route === 'priority') {
      const p = JSON.parse(body);
      if (!p || !Array.isArray(p.hot) || !p.ts) return new Response('bad list', { status: 400 });
      await this.ctx.storage.put('priority', p);
      return Response.json({ ok: true, hot: p.hot.length });
    }
    if (route === 'config') {
      const patch = JSON.parse(body || '{}');
      const cfg = { ...(await this.ctx.storage.get('cfg')) };
      for (const [k, v] of Object.entries(patch)) {
        if (!(k in DEFAULT_CONFIG) || typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
          return new Response(`bad setting ${k}`, { status: 400 });
        }
        cfg[k] = v;
      }
      await this.ctx.storage.put('cfg', cfg);
      return Response.json({ ...DEFAULT_CONFIG, ...cfg });
    }
    if (route === 'stats') {
      const s = (await this.ctx.storage.get('s')) || {};
      return Response.json({ cfg: { ...DEFAULT_CONFIG, ...(await this.ctx.storage.get('cfg')) }, state: s, bot: this.account?.address });
    }
    return new Response('not found', { status: 404 });
  }

  // ---------------------------------------------------------------- tick

  async tick() {
    const stored = await this.ctx.storage.get(['cfg', 'priority', 's', 'ledger']);
    const cfg = { ...DEFAULT_CONFIG, ...(stored.get('cfg') || {}) };
    const priority = stored.get('priority');
    const s = stored.get('s') || { gasHighStreak: 0, stats: {} };
    const st = s.stats;
    st.runs = (st.runs || 0) + 1;
    let result;
    try {
      this.ledger = stored.get('ledger') || null;
      this.ledgerDirty = false;
      if (s.pending) {
        result = await this.handlePending(s, cfg);
      } else {
        const maint = await this.maintainLedger(cfg); // weekly calibration / new vaults / flagged recalcs; usually nothing
        if (maint) s.lastCalibration = { at: nowSec(), ...maint };
        const pr = this.ledger ? readyPriority(this.ledger, nowSec()) : priority; // GitHub list only as a fallback
        result = await this.tryHarvest(s, cfg, pr);
      }
      if (this.ledgerDirty) await this.ctx.storage.put('ledger', this.ledger);
    } catch (e) {
      st.errors = (st.errors || 0) + 1;
      s.lastError = { at: nowSec(), msg: String(e?.shortMessage || e?.message || e).slice(0, 300) };
      result = { error: s.lastError.msg };
    }
    s.last = { at: nowSec(), ...result };
    await this.ctx.storage.put('s', s);
    return s.last;
  }

  async tryHarvest(s, cfg, priority) {
    const st = s.stats;
    if (!this.account || /^0x0+$/.test(this.env.HARVESTER)) return { skip: 'not configured' };
    if (cfg.paused) return { skip: 'paused (circuit breaker or manual)', halted: s.halted || null };

    // 1. gas gate
    const fh = await this.client.getFeeHistory({ blockCount: 4, rewardPercentiles: [10] });
    const baseFee = Number(fh.baseFeePerGas[fh.baseFeePerGas.length - 1]); // next block
    if (baseFee > cfg.maxBaseFeeGwei * 1e9) {
      s.gasHighStreak = (s.gasHighStreak || 0) + 1;
      st.gasTooHigh = (st.gasTooHigh || 0) + 1;
      if (s.gasHighStreak <= cfg.gasStreakOverride) return { skip: 'gas too high', baseFeeGwei: baseFee / 1e9, streak: s.gasHighStreak };
    }
    s.gasHighStreak = 0;

    // 2. hot list → vaults worth reading now
    if (!priority || nowSec() - priority.ts > cfg.priorityMaxAgeSec) return { skip: 'no fresh hot list' };
    const cands = candidates(priority, nowSec(), baseFee, cfg).slice(0, 40);
    if (!cands.length) return { skip: 'nothing near break-even', baseFeeGwei: baseFee / 1e9 };

    // 3. one multicall: globals + exact fee inputs
    const calls = [
      { address: ACCOUNTANT, abi: READ_ABI, functionName: 'getHarvestFeePercent' },
      { address: CRV_ETH_FEED, abi: READ_ABI, functionName: 'latestRoundData' },
      { address: ETH_USD_FEED, abi: READ_ABI, functionName: 'latestRoundData' },
      { address: MULTICALL3, abi: READ_ABI, functionName: 'getEthBalance', args: [this.account.address] },
    ];
    const at = [];
    for (const v of cands) {
      at.push(calls.length);
      calls.push({ address: v.gauge, abi: READ_ABI, functionName: 'claimable_tokens', args: [LOCKER] });
      calls.push({ address: ACCOUNTANT, abi: READ_ABI, functionName: 'vaults', args: [v.vault] });
      for (const sc of v.sidecars || []) calls.push({ address: sc, abi: READ_ABI, functionName: 'getPendingRewards' });
    }
    const res = await this.client.multicall({ contracts: calls, allowFailure: true, batchSize: 0 }); // one eth_call
    if (res.slice(0, 4).some((r) => r.status !== 'success')) return { skip: 'global reads failed' };
    const botBalance = res[3].result;
    const feePct = Number(res[0].result) / 1e18;
    const crvEth = Number(res[1].result[1]) / 1e18;
    const ethUsd = Number(res[2].result[1]) / 1e8;
    const exact = [];
    cands.forEach((v, k) => {
      let i = at[k];
      const claim = res[i++];
      const vault = res[i++];
      if (claim.status !== 'success' || vault.status !== 'success') return;
      let pending = Number(claim.result) / 1e18;
      for (let j = 0; j < (v.sidecars || []).length; j++) {
        const r = res[i++];
        if (r.status === 'success') pending += Number(r.result) / 1e18;
      }
      // the Accountant's reservedHarvestFee is already inside the gauge's claimable CRV — do not add it again
      exact.push({ gauge: v.gauge, name: v.name, feeCrv: pending * feePct });
      const lv = this.ledger?.vaults[v.gauge.toLowerCase()];
      if (lv) {
        applyExactRead(lv, pending * feePct, nowSec(), cfg, feeNeededCrv(cfg, crvEth, ethUsd));
        this.ledgerDirty = true;
      }
    });

    // 4. plan
    const tips = fh.reward.map((r) => Number(r[0])).sort((a, b) => a - b);
    const tip = tips[Math.floor(tips.length / 2)] || 0;
    // v1.1 (Worker var HARVESTER_V11 = "1"): one batched Accountant call, swap optional; per-vault for a while after a
    // batch was not included (one of its vaults must be failing)
    const batch = this.env.HARVESTER_V11 === '1' && !(nowSec() < (s.perVaultUntil || 0));
    const swap = !batch || useSwap(botBalance, cfg);
    const pcfg = planCfg(cfg, batch, swap);
    let plan = feePlan({ vaults: exact, baseFeeWei: baseFee, tipWei: tip, crvEth, ethUsd, cfg: pcfg, intrinsicGas: 30_000 });
    if (plan.mode === 'none') return { skip: 'not profitable', baseFeeGwei: baseFee / 1e9, best: exact.slice(0, 3) };
    // the bot must hold gasLimit × maxFee upfront: drop the lowest-fee vaults until it can afford the tx
    const margin = 1 + cfg.gasLimitMarginPct / 100;
    while (plan.mode !== 'none' && plan.set.chosen.length > 1 && BigInt(Math.ceil(plan.set.gas * margin * plan.maxFeePerGas)) > botBalance) {
      plan = feePlan({ vaults: plan.set.chosen.slice(0, -1), baseFeeWei: baseFee, tipWei: tip, crvEth, ethUsd, cfg: pcfg, intrinsicGas: 30_000 });
    }
    if (plan.mode === 'none' || BigInt(Math.ceil(plan.set.gas * margin * plan.maxFeePerGas)) > botBalance) {
      return { skip: 'bot balance too low for the tx', botEth: Number(botBalance) / 1e18 };
    }
    const minVaultWei = big((cfg.minVaultProfitUsd / ethUsd) * 1e18);
    const minTotalWei = big((cfg.minTotalProfitUsd / ethUsd) * 1e18);
    const gauges = plan.set.chosen.map((v) => v.gauge);
    const encode = (intrinsic) => batch
      ? encodeFunctionData({ abi: HARVESTER_ABI, functionName: 'harvestBatch', args: [gauges, minTotalWei, BigInt(intrinsic), BigInt(cfg.swapSlippageBps), swap] })
      : encodeFunctionData({ abi: HARVESTER_ABI, functionName: 'harvest', args: [gauges, minVaultWei, minTotalWei, BigInt(intrinsic), BigInt(cfg.swapSlippageBps)] });
    const intrinsic = intrinsicGasOf(encode(30_000)) + 64; // + slack: the value itself changes a few calldata bytes
    const data = encode(intrinsic);

    // 5. no pre-send simulation (speed): the contract itself rolls back unprofitable vaults and reverts the whole tx
    //    unless the ETH received covers all gas + the minimum. Gas limit from the measured model + gasLimitMarginPct.
    const gasLimit = BigInt(Math.ceil((plan.set.gas + intrinsic - 30_000) * (1 + cfg.gasLimitMarginPct / 100)));

    // 6. broadcast
    const nonce = await this.client.getTransactionCount({ address: this.account.address, blockTag: 'latest' }); // private txs are not in the public pending pool
    const tx = {
      chainId: 1, type: 'eip1559', to: this.env.HARVESTER, data, nonce, gas: gasLimit, value: 0n,
      maxFeePerGas: BigInt(plan.maxFeePerGas), maxPriorityFeePerGas: BigInt(plan.maxPriorityFeePerGas),
    };
    let hash;
    try {
      hash = await this.send(tx);
    } catch (e) {
      throw new Error(`${e.message} [mode ${plan.mode} maxFee ${plan.maxFeePerGas / 1e9} tip ${plan.maxPriorityFeePerGas / 1e9} base ${baseFee / 1e9} gwei, gas ${gasLimit}, nonce ${nonce}, vaults ${gauges.length}, bot ${Number(botBalance) / 1e18} ETH]`);
    }
    const orphans = s.orphan && s.orphan.nonce === nonce ? s.orphan.hashes : [];
    s.orphan = null;
    s.pending = {
      mode: plan.mode, hashes: [...orphans, hash], nonce, data, gas: gasLimit.toString(), sentAt: nowSec(), lastBumpAt: nowSec(),
      maxFeePerGas: plan.maxFeePerGas, maxPriorityFeePerGas: plan.maxPriorityFeePerGas, gauges, batch, swap,
      expectedProfitUsd: plan.set.profitEth * ethUsd,
      // kept for the speed-up decision (model-based, no simulation)
      model: { vaults: plan.set.chosen.map((v) => ({ feeCrv: v.feeCrv })), crvEth, ethUsd, intrinsic },
    };
    st.broadcasts = (st.broadcasts || 0) + 1;
    if (plan.mode === 'near-miss') st.nearMiss = (st.nearMiss || 0) + 1;
    return { sent: hash, mode: plan.mode, vaults: gauges.length, expectedProfitUsd: s.pending.expectedProfitUsd };
  }

  // ---------------------------------------------------------------- pending tx

  async handlePending(s, cfg) {
    const p = s.pending;
    const st = s.stats;
    const latestNonce = await this.client.getTransactionCount({ address: this.account.address, blockTag: 'latest' });
    if (latestNonce > p.nonce) {
      for (const h of [...p.hashes].reverse()) {
        const r = await this.client.getTransactionReceipt({ hash: h }).catch(() => null);
        if (!r) continue;
        const ok = r.status === 'success';
        if (ok && this.ledger) {
          // our harvest landed: those vaults restart from zero (v1 logs which ones; a v1.1 batch is all of them)
          const harvester = this.env.HARVESTER.toLowerCase();
          const got = r.logs.filter((l) => l.address.toLowerCase() === harvester && l.topics[0] === HARVESTED_SIG && l.topics[1]).map((l) => '0x' + l.topics[1].slice(26));
          const gauges = got.length ? got : p.batch ? p.gauges : [];
          markHarvested(this.ledger, gauges, nowSec(), feeNeededCrv(cfg, this.ledger.crvEth, this.ledger.ethUsd));
          this.ledgerDirty = true;
        }
        st[ok ? 'mined' : 'reverted'] = (st[ok ? 'mined' : 'reverted'] || 0) + 1;
        st.gasSpentWei = (BigInt(st.gasSpentWei || 0) + r.gasUsed * r.effectiveGasPrice).toString();
        s.pending = null;
        if (!ok) {
          // circuit breaker: a reverted tx was mined (revert protection failed) → stop sending until resumed by hand
          const stored = (await this.ctx.storage.get('cfg')) || {};
          await this.ctx.storage.put('cfg', { ...stored, paused: 1 });
          s.halted = { at: nowSec(), hash: h, gasWei: (r.gasUsed * r.effectiveGasPrice).toString(), why: 'mined revert' };
          return { mined: h, status: r.status, halted: true };
        }
        return { mined: h, status: r.status };
      }
      s.pending = null; // replaced by another tx with the same nonce
      return { mined: 'unknown hash (nonce used)' };
    }

    const age = nowSec() - p.sentAt;
    const block = await this.client.getBlock();
    const baseFee = Number(block.baseFeePerGas);
    const bump = (x) => Math.ceil(x * (1 + cfg.speedUpPct / 100));

    // give up after monitorSec: no cancel tx (private + revert-protected flow) — the next harvest reuses this nonce;
    // whichever version lands first wins, the other becomes invalid and is dropped by MEV Blocker.
    if (age >= cfg.monitorSec) {
      // remember the abandoned versions: the next tx reuses this nonce, and whichever lands is checked for a revert
      s.orphan = { nonce: p.nonce, hashes: p.hashes };
      if (p.batch) s.perVaultUntil = nowSec() + cfg.batchRetryPerVaultSec; // the batch never landed: try per-vault
      s.pending = null;
      st.abandoned = (st.abandoned || 0) + 1;
      return { abandoned: p.hashes.at(-1), age };
    }

    // speed up a normal tx every speedUpAfterSec, only if still profitable at the higher price
    if (p.mode === 'normal' && nowSec() - p.lastBumpAt >= cfg.speedUpAfterSec) {
      const tip = bump(p.maxPriorityFeePerGas);
      const maxFee = Math.max(bump(p.maxFeePerGas), baseFee + tip);
      const price = Math.min(maxFee, baseFee + tip);
      const m = p.model;
      if (!selectSet(m.vaults, price, m.crvEth, m.ethUsd, planCfg(cfg, p.batch, p.swap !== false), m.intrinsic).ok) {
        return { waiting: p.hashes.at(-1), age, note: 'speed-up would not be profitable' };
      }
      const hash = await this.send({
        chainId: 1, type: 'eip1559', to: this.env.HARVESTER, data: p.data, nonce: p.nonce, gas: BigInt(p.gas), value: 0n,
        maxFeePerGas: BigInt(maxFee), maxPriorityFeePerGas: BigInt(tip),
      });
      Object.assign(p, { hashes: [...p.hashes, hash], maxFeePerGas: maxFee, maxPriorityFeePerGas: tip, lastBumpAt: nowSec() });
      st.speedUps = (st.speedUps || 0) + 1;
      return { speedUp: hash, tipGwei: tip / 1e9 };
    }
    return { waiting: p.hashes.at(-1), age, mode: p.mode };
  }

  // ---------------------------------------------------------------- vault tracking (SPEC "Vault tracking")

  /// Weekly full calibration after the Thursday weight update (or when there is no ledger yet), a daily vault-list
  /// refresh that calibrates only new vaults, and single-vault recalcs flagged by a prediction that was off.
  async maintainLedger(cfg) {
    const now = nowSec();
    if (calibrationDue(this.ledger, now)) return this.calibrate(cfg, null);
    if (now - (this.ledger.listAt || 0) >= 86_400) {
      const list = await this.vaultList();
      this.ledger.listAt = now;
      this.ledgerDirty = true;
      const fresh = list.filter((v) => !this.ledger.vaults[v.gauge.toLowerCase()]);
      if (fresh.length) return this.calibrate(cfg, fresh);
    }
    if (now - (this.ledger.ratesAt || 0) >= cfg.rateRefreshSec) return this.refreshRates(cfg);
    const flagged = Object.values(this.ledger.vaults).filter((v) => v.recalc);
    if (flagged.length) return this.calibrate(cfg, flagged.slice(0, 20));
    return null;
  }

  async vaultList() {
    const res = await fetch(VAULT_LIST_URL);
    if (!res.ok) throw new Error(`vault list ${res.status}`);
    const base = (await res.json()).filter((v) => v.vault && v.gaugeAddress)
      .map((v) => ({ name: v.name, vault: getAddress(v.vault), gauge: getAddress(v.gaugeAddress) }));
    const targets = await this.mc(base.map((v) => ({ address: ALLOCATOR, abi: READ_ABI, functionName: 'getAllocationTargets', args: [v.gauge] })), 300);
    return base.map((v, i) => ({
      ...v,
      sidecars: targets[i].status === 'success' ? targets[i].result.filter((t) => t.toLowerCase() !== LOCKER.toLowerCase()) : [],
    }));
  }

  async mc(contracts, chunk, blockNumber) {
    const out = [];
    for (let i = 0; i < contracts.length; i += chunk) {
      out.push(...(await this.client.multicall({ contracts: contracts.slice(i, i + chunk), allowFailure: true, batchSize: 0, blockNumber })));
    }
    return out;
  }

  /// Reads each vault once: baseline fee (locker claimable + sidecars) and its rate — the locker part calculated from
  /// the gauge's parameters, the sidecar part from its growth over the last ~hour (one historical read).
  /// TVL moves the locker's share of a gauge mid-epoch: re-read only working balance / supply / killed for every
  /// vault (cheap view calls), re-baseline each vault at its predicted fee and recompute rate + ready time.
  async refreshRates(cfg) {
    const now = nowSec();
    const vs = Object.values(this.ledger.vaults);
    const calls = [];
    for (const v of vs) {
      calls.push({ address: v.gauge, abi: READ_ABI, functionName: 'working_balances', args: [LOCKER] });
      calls.push({ address: v.gauge, abi: READ_ABI, functionName: 'working_supply' });
      calls.push({ address: v.gauge, abi: READ_ABI, functionName: 'is_killed' });
    }
    const r = await this.mc(calls, 400);
    const need = feeNeededCrv(cfg, this.ledger.crvEth, this.ledger.ethUsd);
    let changed = 0;
    vs.forEach((v, i) => {
      const [wb, ws, killed] = [r[3 * i], r[3 * i + 1], r[3 * i + 2]];
      if (wb.status !== 'success' || ws.status !== 'success' || v.weight === undefined) return;
      const lockerRate = lockerCrvPerSec({
        crvRate: this.ledger.crvRate, relativeWeight: v.weight, workingBalance: Number(wb.result), workingSupply: Number(ws.result),
        killed: killed.status === 'success' && killed.result,
      });
      const rate = (lockerRate + (v.sideRate || 0)) * this.ledger.feePct;
      if (Math.abs(rate - v.rate) > v.rate * 0.01) changed++;
      v.fee = predictedFee(v, now);
      v.at = now;
      v.rate = rate;
      v.readyAt = readyAtOf(v, need, now);
    });
    this.ledger.ratesAt = now;
    this.ledgerDirty = true;
    return { rateRefresh: vs.length, changed };
  }

  async calibrate(cfg, subset) {
    const now = nowSec();
    const full = !subset;
    const list = full ? await this.vaultList() : subset;
    const head = await this.client.getBlockNumber();
    const g = await this.client.multicall({
      allowFailure: false,
      blockNumber: head,
      contracts: [
        { address: ACCOUNTANT, abi: READ_ABI, functionName: 'getHarvestFeePercent' },
        { address: CRV_ETH_FEED, abi: READ_ABI, functionName: 'latestRoundData' },
        { address: ETH_USD_FEED, abi: READ_ABI, functionName: 'latestRoundData' },
        { address: CRV, abi: READ_ABI, functionName: 'rate' },
      ],
    });
    const feePct = Number(g[0]) / 1e18;
    const crvEth = Number(g[1][1]) / 1e18;
    const ethUsd = Number(g[2][1]) / 1e8;
    const crvRate = Number(g[3]) / 1e18;
    const heavy = [];
    const light = [];
    const sideOld = [];
    for (const v of list) {
      heavy.push({ address: v.gauge, abi: READ_ABI, functionName: 'claimable_tokens', args: [LOCKER] });
      for (const sc of v.sidecars) {
        heavy.push({ address: sc, abi: READ_ABI, functionName: 'getPendingRewards' });
        sideOld.push({ address: sc, abi: READ_ABI, functionName: 'getPendingRewards' });
      }
      light.push({ address: GAUGE_CONTROLLER, abi: READ_ABI, functionName: 'gauge_relative_weight', args: [v.gauge] });
      light.push({ address: v.gauge, abi: READ_ABI, functionName: 'working_balances', args: [LOCKER] });
      light.push({ address: v.gauge, abi: READ_ABI, functionName: 'working_supply' });
      light.push({ address: v.gauge, abi: READ_ABI, functionName: 'is_killed' });
    }
    const oldBlock = head - BigInt(cfg.sidecarRateBlocks);
    const [hv, lt, old] = await Promise.all([
      this.mc(heavy, cfg.calibrateHeavyChunk, head),
      this.mc(light, 400, head),
      sideOld.length ? this.mc(sideOld, cfg.calibrateHeavyChunk, oldBlock) : [],
    ]);
    let dt = 0;
    if (sideOld.length) {
      const [bNow, bOld] = await Promise.all([this.client.getBlock({ blockNumber: head }), this.client.getBlock({ blockNumber: oldBlock })]);
      dt = Number(bNow.timestamp - bOld.timestamp);
    }
    const ledger = full || !this.ledger ? { vaults: {} } : this.ledger;
    Object.assign(ledger, { crvEth, ethUsd, feePct, crvRate });
    if (full) Object.assign(ledger, { epoch: epochStart(now), listAt: now, ratesAt: now });
    const need = feeNeededCrv(cfg, crvEth, ethUsd);
    let h = 0;
    let l = 0;
    let o = 0;
    let done = 0;
    for (const v of list) {
      const claim = hv[h++];
      let pending = claim.status === 'success' ? Number(claim.result) / 1e18 : null;
      let sideRate = 0;
      for (let k = 0; k < v.sidecars.length; k++) {
        const r = hv[h++];
        const r0 = old[o++];
        if (r.status === 'success') {
          if (pending !== null) pending += Number(r.result) / 1e18;
          // a drop means the sidecar was harvested inside the window: no rate from it this time
          if (r0?.status === 'success' && dt > 0) sideRate += Math.max(0, (Number(r.result) - Number(r0.result)) / 1e18 / dt);
        }
      }
      const w = lt[l++];
      const wb = lt[l++];
      const ws = lt[l++];
      const killed = lt[l++];
      if (pending === null || w.status !== 'success' || wb.status !== 'success' || ws.status !== 'success') continue;
      const lockerRate = lockerCrvPerSec({
        crvRate, relativeWeight: Number(w.result) / 1e18, workingBalance: Number(wb.result), workingSupply: Number(ws.result),
        killed: killed.status === 'success' && killed.result,
      });
      const entry = {
        gauge: v.gauge, vault: v.vault, name: v.name, sidecars: v.sidecars,
        fee: pending * feePct, rate: (lockerRate + sideRate) * feePct, at: now,
        weight: Number(w.result) / 1e18, sideRate, // kept for the light TVL refresh
      };
      entry.readyAt = readyAtOf(entry, need, now);
      ledger.vaults[v.gauge.toLowerCase()] = entry;
      done++;
    }
    this.ledger = ledger;
    this.ledgerDirty = true;
    return { calibrated: done, of: list.length, full };
  }

  async send(tx) {
    const raw = await this.account.signTransaction(tx);
    // MEV Blocker /noreverts: revert protection (a tx that would revert is never included) + no front-running /
    // sandwiching (searchers may only backrun). /fullprivacy has NO revert protection (docs.mevblocker.io, 2026-10-02).
    const res = await fetch(this.env.SEND_RPC_URL || 'https://rpc.mevblocker.io/noreverts', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_sendRawTransaction', params: [raw] }),
    });
    const j = await res.json();
    if (j.error) throw new Error('send via ' + new URL(this.env.SEND_RPC_URL || 'https://rpc.mevblocker.io').host + ': ' + (j.error.message || JSON.stringify(j.error)));
    return j.result;
  }
}
