// Stake DAO harvest monitor (GitHub Actions, every 5 min) — SPEC.md §4.
// Scans every v2 Curve vault on Ethereum, keeps a ledger of each vault's harvester-fee accrual, and pushes the
// Worker the "hot" list: every vault profitable at <= hotGasGwei within the horizon, highest yield first.
//   env: ETH_RPC_URL (required), WORKER_URL + HMAC_SECRET (push; skipped with --dry), STATE_DIR (default ./state)
import { createPublicClient, http, parseAbi, getAddress } from 'viem';
import { mainnet } from 'viem/chains';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHmac } from 'node:crypto';
import path from 'node:path';

const CFG = JSON.parse(await readFile(new URL('../config.json', import.meta.url), 'utf8'));
const DRY = process.argv.includes('--dry');
const STATE_DIR = process.env.STATE_DIR || './state';
const LEDGER = path.join(STATE_DIR, 'ledger.json');
const VAULTS = path.join(STATE_DIR, 'vaults.json');

const ACCOUNTANT = '0x93b4B9bd266fFA8AF68e39EDFa8cFe2A62011Ce0';
const ALLOCATOR = '0xA56B653CE86D1B84b0Ac67bD41F007898cfC14e4';
const LOCKER = '0x52f541764E6e90eeBc5c21Ff570De0e2D63766B6';
const CRV_ETH_FEED = '0x8a12Be339B0cD1829b91Adc01977caa5E9ac121e';
const ETH_USD_FEED = '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419';
const VAULT_LIST_URL = 'https://raw.githubusercontent.com/stake-dao/api/main/api/strategies/v2/curve/1.json';

// claimable_tokens / getPendingRewards are non-view checkpoints on-chain; declared view so they can be eth_call'ed.
const ABI = parseAbi([
  'function claimable_tokens(address) view returns (uint256)',
  'function getPendingRewards() view returns (uint256)',
  'function vaults(address) view returns (uint256,uint128,uint128,uint128,uint128,uint128,uint128)',
  'function getHarvestFeePercent() view returns (uint128)',
  'function getAllocationTargets(address) view returns (address[])',
  'function latestRoundData() view returns (uint80,int256,uint256,uint256,uint80)',
]);

if (!process.env.ETH_RPC_URL) throw new Error('ETH_RPC_URL missing');
const client = createPublicClient({ chain: mainnet, transport: http(process.env.ETH_RPC_URL, { timeout: 60_000 }) });
const now = Math.floor(Date.now() / 1000);

const readJson = async (f, fallback) => { try { return JSON.parse(await readFile(f, 'utf8')); } catch { return fallback; } };

async function multicall(contracts) {
  const out = [];
  for (let i = 0; i < contracts.length; i += CFG.multicallChunk) {
    const res = await client.multicall({ contracts: contracts.slice(i, i + CFG.multicallChunk), allowFailure: true });
    out.push(...res);
  }
  return out;
}

/// Vault list (gauge, vault, sidecars), refreshed from the Stake DAO API once a day.
async function loadVaults() {
  const cached = await readJson(VAULTS, null);
  if (cached && now - cached.fetchedAt < CFG.vaultListMaxAgeSec) return cached.vaults;
  const res = await fetch(VAULT_LIST_URL);
  if (!res.ok) { if (cached) return cached.vaults; throw new Error(`vault list ${res.status}`); }
  const api = await res.json();
  const base = api.filter((v) => v.vault && v.gaugeAddress)
    .map((v) => ({ name: v.name, vault: getAddress(v.vault), gauge: getAddress(v.gaugeAddress) }));
  const targets = await multicall(base.map((v) => ({ address: ALLOCATOR, abi: ABI, functionName: 'getAllocationTargets', args: [v.gauge] })));
  const vaults = base.map((v, i) => ({
    ...v,
    sidecars: targets[i].status === 'success' ? targets[i].result.filter((t) => t.toLowerCase() !== LOCKER.toLowerCase()) : [],
  }));
  await writeFile(VAULTS, JSON.stringify({ fetchedAt: now, vaults }));
  return vaults;
}

async function main() {
  await mkdir(STATE_DIR, { recursive: true });
  const vaults = await loadVaults();
  const ledger = await readJson(LEDGER, { vaults: {} });

  // one pass: globals + per-vault reads
  const globals = await client.multicall({
    allowFailure: false,
    contracts: [
      { address: ACCOUNTANT, abi: ABI, functionName: 'getHarvestFeePercent' },
      { address: CRV_ETH_FEED, abi: ABI, functionName: 'latestRoundData' },
      { address: ETH_USD_FEED, abi: ABI, functionName: 'latestRoundData' },
    ],
  });
  const feePct = Number(globals[0]) / 1e18;
  const crvEth = Number(globals[1][1]) / 1e18;
  const ethUsd = Number(globals[2][1]) / 1e8;
  const block = await client.getBlock();
  const baseFeeGwei = Number(block.baseFeePerGas) / 1e9;

  const calls = [];
  const index = [];
  for (const v of vaults) {
    index.push(calls.length);
    calls.push({ address: v.gauge, abi: ABI, functionName: 'claimable_tokens', args: [LOCKER] });
    calls.push({ address: ACCOUNTANT, abi: ABI, functionName: 'vaults', args: [v.vault] });
    for (const s of v.sidecars) calls.push({ address: s, abi: ABI, functionName: 'getPendingRewards' });
  }
  const res = await multicall(calls);

  const minProfitCrv = CFG.minVaultProfitUsd / (crvEth * ethUsd);
  const horizon = 2 * CFG.intervalSec + CFG.extraHorizonSec;
  const hotWeiPerGas = CFG.hotGasGwei * 1e9;
  const hot = [];
  let read = 0;

  vaults.forEach((v, k) => {
    let i = index[k];
    const claim = res[i++];
    const vault = res[i++];
    let pending = claim.status === 'success' ? Number(claim.result) / 1e18 : null;
    for (let s = 0; s < v.sidecars.length; s++) {
      const r = res[i++];
      if (pending !== null && r.status === 'success') pending += Number(r.result) / 1e18;
    }
    if (pending === null || vault.status !== 'success') return;
    read++;
    const fee = pending * feePct; // harvester fee in CRV (reservedHarvestFee is already inside the claimable CRV)

    // ledger: accrual rate (EWMA of fee CRV / s); a drop means someone harvested
    const prev = ledger.vaults[v.vault];
    const entry = prev ? { ...prev } : { rate: 0, harvestsSeen: 0 };
    if (prev && now > prev.ts) {
      if (fee + 1e-12 < prev.fee) {
        entry.harvestsSeen = (prev.harvestsSeen || 0) + 1;
        entry.lastHarvestTs = now;
      } else {
        const r = (fee - prev.fee) / (now - prev.ts);
        entry.rate = prev.rate ? CFG.rateEwmaAlpha * r + (1 - CFG.rateEwmaAlpha) * prev.rate : r;
      }
    }
    entry.fee = fee;
    entry.ts = now;
    ledger.vaults[v.vault] = entry;

    // break-even gas at the end of the horizon: (fee + rate·h − minProfit) · CRV/ETH / gas
    const feeAtHorizon = fee + entry.rate * horizon;
    const breakEvenWeiPerGas = ((feeAtHorizon - minProfitCrv) * crvEth * 1e18) / CFG.gasPerVault;
    if (breakEvenWeiPerGas >= hotWeiPerGas) {
      hot.push({
        gauge: v.gauge, vault: v.vault, name: v.name, sidecars: v.sidecars,
        feeCrv: fee, rateCrvPerSec: entry.rate, gas: CFG.gasPerVault,
        breakEvenGwei: breakEvenWeiPerGas / 1e9,
      });
    }
  });

  hot.sort((a, b) => b.feeCrv + b.rateCrvPerSec * horizon - (a.feeCrv + a.rateCrvPerSec * horizon));
  const list = hot.slice(0, CFG.maxList);
  ledger.updatedAt = now;
  await writeFile(LEDGER, JSON.stringify(ledger));

  const payload = {
    ts: now, block: Number(block.number), baseFeeGwei, feePct, crvEth, ethUsd, minProfitCrv,
    hotGasGwei: CFG.hotGasGwei, vaultsRead: read, vaultsTotal: vaults.length, hot: list,
  };
  console.log(`block ${payload.block} base ${baseFeeGwei.toFixed(3)} gwei | fee ${(feePct * 100).toFixed(4)}% | CRV $${(crvEth * ethUsd).toFixed(4)} | read ${read}/${vaults.length} | hot ${list.length} (of ${hot.length})`);
  for (const h of list.slice(0, 10)) {
    console.log(`  ${h.name.padEnd(30)} fee ${h.feeCrv.toFixed(3)} CRV  +${(h.rateCrvPerSec * 3600).toFixed(3)}/h  break-even ${h.breakEvenGwei.toFixed(3)} gwei`);
  }

  if (DRY) return;
  const body = JSON.stringify(payload);
  const signedAt = Math.floor(Date.now() / 1000); // sign at push time: a slow scan must not look like a replay
  const sig = createHmac('sha256', process.env.HMAC_SECRET).update(`${signedAt}.${body}`).digest('hex');
  const r = await fetch(`${process.env.WORKER_URL}/priority`, {
    method: 'POST', body, headers: { 'content-type': 'application/json', 'x-ts': String(signedAt), 'x-sig': sig },
  });
  if (!r.ok) throw new Error(`push failed ${r.status} ${await r.text()}`);
  console.log('pushed to worker');
}

await main();
