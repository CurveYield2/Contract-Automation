import fs from 'node:fs';
import { JsonRpcProvider, Contract, FetchRequest } from 'ethers';
const root = new URL('.', import.meta.url).pathname;
const data = JSON.parse(fs.readFileSync(root + 'evidence/verified_explorer_sources_v1.json'));
const hubAddress = '0xFbEF8941Da53EA724385B44E91ae9672061D0263';
const stringify = x => JSON.stringify(x, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2);
const output = {};
const toPlain = (v, p) => {
  if (p.baseType === 'array') return Array.from(v, x => toPlain(x, p.arrayChildren));
  if (p.baseType === 'tuple') return Object.fromEntries(p.components.map((c, i) => [c.name || String(i), toPlain(v[i], c)]));
  return typeof v === 'bigint' ? v.toString() : v;
};
for (const [chain, chainId, urls] of [
  ['ethereum', 1, [process.env.ETHEREUM_RPC, 'https://eth.drpc.org', 'https://ethereum-rpc.publicnode.com'].filter(Boolean)],
  ['fraxtal', 252, ['https://rpc.frax.com', 'https://fraxtal-rpc.publicnode.com']]
]) {
  let provider;
  for (const url of urls) {
    try {
      const request = new FetchRequest(url); request.timeout = 10000;
      const p = new JsonRpcProvider(request, chainId, { staticNetwork: true, batchMaxCount: 1 });
      const reported = Number(await p.send('eth_chainId', []));
      if (reported !== chainId) throw new Error('wrong chain');
      await p.getBlockNumber(); provider = p; break;
    } catch { console.log(chain, 'RPC candidate unavailable'); }
  }
  if (!provider) throw new Error(chain + ': all read-only RPC candidates failed');
  const block = await provider.getBlock('latest');
  const blockTag = block.number;
  const code = await provider.getCode(hubAddress, blockTag);
  const abi = data[chain]?.abi || data.ethereum?.abi;
  output[chain] = { chainId, address: hubAddress, blockNumber: block.number, blockHash: block.hash,
    code, universalProxyCode: await provider.getCode('0x4e59b44847b379578588920ca78fbf26c0b4956c', blockTag), reads: {}, pools: [], readErrors: {} };
  if (code === '0x' || !abi) { console.log(chain, 'no Hub bytecode or ABI'); continue; }
  const hub = new Contract(hubAddress, abi, provider);
  async function read(f, args, target = output[chain].reads) {
    try {
      const r = await hub.getFunction(f.format()).staticCallResult(...args, { blockTag });
      target[f.name] = f.outputs.length === 1 ? toPlain(r[0], f.outputs[0]) : Object.fromEntries(f.outputs.map((p,i)=>[p.name || String(i), toPlain(r[i],p)]));
    } catch (e) { output[chain].readErrors[f.name + '(' + args.join(',') + ')'] = e.code || e.name; }
  }
  for (const f of hub.interface.fragments.filter(f=>f.type==='function' && ['view','pure'].includes(f.stateMutability) && f.inputs.length===0)) await read(f, []);
  let count = Number(output[chain].reads.poolLength ?? output[chain].reads.poolCount ?? output[chain].reads.systemInfo?.poolCount ?? 0);
  if (!count) {
    const pf = hub.interface.fragments.find(f=>f.type==='function'&&f.name==='poolInfo');
    if (pf) for (let pid=0;pid<64;pid++) {
      const v = {}; await read(pf,[pid],v); if (v.poolInfo===undefined) break; count++;
    }
  }
  for (let pid=0;pid<count;pid++) {
    const pool = {pid};
    for (const f of hub.interface.fragments.filter(f=>f.type==='function' && ['view','pure'].includes(f.stateMutability) && f.inputs.length===1 && f.inputs[0].type==='uint256' && /pool|reward/i.test(f.name))) await read(f,[pid],pool);
    const depositor = pool.poolDepositor || pool.poolInfo?.depositor;
    if (depositor && depositor !== '0x0000000000000000000000000000000000000000') {
      const s = new Contract(depositor, [
        'function admin() view returns(address)', 'function keeper() view returns(address)', 'function fee_receiver() view returns(address)',
        'function lp_token() view returns(address)', 'function boost_hub() view returns(address)', 'function pid() view returns(uint256)',
        'function reward_smoothing_units() view returns(uint256)', 'function reward_count() view returns(uint256)',
        'function reward_tokens(uint256) view returns(address)', 'function reward_from_boosthub(address) view returns(bool)',
        'function reward_disabled(address) view returns(bool)', 'function governance_reward_token() view returns(address)'
      ], provider);
      const staking = { address: depositor, reads: {}, rewardTokens: [] };
      for (const f of s.interface.fragments.filter(f=>f.inputs.length===0)) {
        try { const r=await s.getFunction(f.format()).staticCall({blockTag});staking.reads[f.name]=typeof r==='bigint'?r.toString():r; } catch {}
      }
      for(let i=0;i<Number(staking.reads.reward_count||0);i++) {
        const token=await s.reward_tokens(i,{blockTag});const r={token};
        for(const key of ['reward_from_boosthub','reward_disabled'])try{r[key]=await s[key](token,{blockTag});}catch{}
        staking.rewardTokens.push(r);
      }
      pool.staking=staking;
    }
    output[chain].pools.push(pool);
  }
  console.log(chain, 'block', blockTag, 'poolCount',count,'readNames',Object.keys(output[chain].reads));
  provider.destroy();
}
fs.writeFileSync(root+'evidence/live_stack_snapshot_v1.json',stringify(output));
