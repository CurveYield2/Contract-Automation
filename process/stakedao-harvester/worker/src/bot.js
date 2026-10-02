// BotState Durable Object: the per-minute harvest logic (SPEC.md §5) and all bot state.
// Storage: 3 keys (cfg, priority, s) on the SQLite backend → ≤ 2 rows written per minute.
// Subrequests per tick: ≤ 4 (fee history, multicall, nonce, send). No pre-send simulation: the contract reverts.
import { DurableObject } from 'cloudflare:workers';
import { createPublicClient, http, parseAbi, encodeFunctionData } from 'viem';
import { mainnet } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { DEFAULT_CONFIG, candidates, feePlan, selectSet, intrinsicGasOf } from './plan.js';

const ACCOUNTANT = '0x93b4B9bd266fFA8AF68e39EDFa8cFe2A62011Ce0';
const LOCKER = '0x52f541764E6e90eeBc5c21Ff570De0e2D63766B6';
const CRV_ETH_FEED = '0x8a12Be339B0cD1829b91Adc01977caa5E9ac121e';
const ETH_USD_FEED = '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419';
const MULTICALL3 = '0xcA11bde05977b3631167028862bE2a173976CA11';

const READ_ABI = parseAbi([
  'function claimable_tokens(address) view returns (uint256)',
  'function getPendingRewards() view returns (uint256)',
  'function vaults(address) view returns (uint256,uint128,uint128,uint128,uint128,uint128,uint128)',
  'function getHarvestFeePercent() view returns (uint128)',
  'function latestRoundData() view returns (uint80,int256,uint256,uint256,uint80)',
  'function getEthBalance(address) view returns (uint256)',
]);
const HARVESTER_ABI = parseAbi([
  'function harvest(address[] gauges, uint256 minVaultProfitWei, uint256 minTotalProfitWei, uint256 intrinsicGas, uint256 slippageBps) returns (uint256 harvested, int256 profitWei)',
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
    const stored = await this.ctx.storage.get(['cfg', 'priority', 's']);
    const cfg = { ...DEFAULT_CONFIG, ...(stored.get('cfg') || {}) };
    const priority = stored.get('priority');
    const s = stored.get('s') || { gasHighStreak: 0, stats: {} };
    const st = s.stats;
    st.runs = (st.runs || 0) + 1;
    let result;
    try {
      result = s.pending ? await this.handlePending(s, cfg) : await this.tryHarvest(s, cfg, priority);
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
    });

    // 4. plan
    const tips = fh.reward.map((r) => Number(r[0])).sort((a, b) => a - b);
    const tip = tips[Math.floor(tips.length / 2)] || 0;
    let plan = feePlan({ vaults: exact, baseFeeWei: baseFee, tipWei: tip, crvEth, ethUsd, cfg, intrinsicGas: 30_000 });
    if (plan.mode === 'none') return { skip: 'not profitable', baseFeeGwei: baseFee / 1e9, best: exact.slice(0, 3) };
    // the bot must hold gasLimit × maxFee upfront: drop the lowest-fee vaults until it can afford the tx
    const margin = 1 + cfg.gasLimitMarginPct / 100;
    while (plan.mode !== 'none' && plan.set.chosen.length > 1 && BigInt(Math.ceil(plan.set.gas * margin * plan.maxFeePerGas)) > botBalance) {
      plan = feePlan({ vaults: plan.set.chosen.slice(0, -1), baseFeeWei: baseFee, tipWei: tip, crvEth, ethUsd, cfg, intrinsicGas: 30_000 });
    }
    if (plan.mode === 'none' || BigInt(Math.ceil(plan.set.gas * margin * plan.maxFeePerGas)) > botBalance) {
      return { skip: 'bot balance too low for the tx', botEth: Number(botBalance) / 1e18 };
    }
    const minVaultWei = big((cfg.minVaultProfitUsd / ethUsd) * 1e18);
    const minTotalWei = big((cfg.minTotalProfitUsd / ethUsd) * 1e18);
    const gauges = plan.set.chosen.map((v) => v.gauge);
    const encode = (intrinsic) => encodeFunctionData({
      abi: HARVESTER_ABI, functionName: 'harvest',
      args: [gauges, minVaultWei, minTotalWei, BigInt(intrinsic), BigInt(cfg.swapSlippageBps)],
    });
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
      maxFeePerGas: plan.maxFeePerGas, maxPriorityFeePerGas: plan.maxPriorityFeePerGas, gauges,
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
      if (!selectSet(m.vaults, price, m.crvEth, m.ethUsd, cfg, m.intrinsic).ok) {
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
