import fs from 'node:fs';
import { Contract, FetchRequest, JsonRpcProvider, Interface, id, getAddress, ZeroAddress, keccak256 } from 'ethers';
const dir='trace_evidence_v1'; fs.mkdirSync(dir,{recursive:true});
const save=(p,x)=>fs.writeFileSync(dir+'/'+p,JSON.stringify(x,(_,v)=>typeof v==='bigint'?v.toString():v,2));
const hubAddress='0xFbEF8941Da53EA724385B44E91ae9672061D0263';
let provider;
for(const url of [process.env.ETHEREUM_RPC,'https://eth.drpc.org','https://ethereum-rpc.publicnode.com'].filter(Boolean)){
 try{const req=new FetchRequest(url);req.timeout=15000;const p=new JsonRpcProvider(req,1,{staticNetwork:true,batchMaxCount:1});if(Number(await p.send('eth_chainId',[]))!==1)throw Error('chain');await p.getBlockNumber();provider=p;break;}catch{console.log('RPC candidate unavailable');}
}
if(!provider)throw Error('No Ethereum read RPC');
const block=await provider.getBlock('latest');const blockTag=block.number;
const trace={chainId:1,blockNumber:block.number,blockHash:block.hash,timestamp:block.timestamp,hub:hubAddress,pools:[],contracts:{},errors:[]};
const decode=h=>h.replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
const toPlain=(v,p)=>p.baseType==='array'?Array.from(v,x=>toPlain(x,p.arrayChildren)):p.baseType==='tuple'?Object.fromEntries(p.components.map((c,i)=>[c.name||String(i),toPlain(v[i],c)])):typeof v==='bigint'?v.toString():v;
async function source(address){
 const a=address.toLowerCase();if(trace.contracts[a])return trace.contracts[a];
 const code=await provider.getCode(address,blockTag); const rec={address,runtimeCode:code,runtimeHash:keccak256(code),reads:{},sources:{},abi:null};trace.contracts[a]=rec;
 try{const res=await fetch('https://etherscan.io/address/'+address+'?output=1',{signal:AbortSignal.timeout(12000),headers:{'User-Agent':'Mozilla/5.0'}});if(!res.ok)throw Error('HTTP'+res.status);const h=await res.text();fs.writeFileSync(dir+'/'+a+'.html',h);rec.explorerStatus=res.status;
  const abi=h.match(/<pre[^>]*id=['"]js-copytextarea2['"][^>]*>([\s\S]*?)<\/pre>/);if(abi)rec.abi=JSON.parse(decode(abi[1]));
  for(const m of h.matchAll(/data-cname=['"]([^'"]+)['"]\s+data-csource=['"]([\s\S]*?)['"]/g))rec.sources[decode(m[1])]={content:decode(m[2])};
  const editors=Array.from(h.matchAll(/<pre[^>]*id=['"](editor[^'"]*)['"][^>]*>([\s\S]*?)<\/pre>/g));const names=Array.from(h.matchAll(/File\s+\d+\s+of\s+\d+\s*:\s*([^<]+)/g),m=>decode(m[1]).trim());editors.forEach((m,i)=>rec.sources[names[i]||m[1]+'.sol']={content:decode(m[2])});
  rec.addressCandidates=Array.from(new Set(Array.from(h.matchAll(/(?:href=['"]\/address\/|data-highlight-target=['"])(0x[a-fA-F0-9]{40})/g),m=>getAddress(m[1]))));
 }catch(e){rec.explorerError=e.message;}
 if(!rec.abi)for(const match of ['full_match','partial_match'])try{
  const url='https://repo.sourcify.dev/contracts/'+match+'/1/'+address+'/metadata.json';const res=await fetch(url,{signal:AbortSignal.timeout(6000)});if(!res.ok)continue;const metadata=await res.json();rec.metadata=metadata;rec.abi=metadata.output.abi;rec.sourceOrigin=url;
  await Promise.allSettled(Object.keys(metadata.sources).map(async p=>{const res=await fetch('https://repo.sourcify.dev/contracts/'+match+'/1/'+address+'/sources/'+p,{signal:AbortSignal.timeout(6000)});if(res.ok)rec.sources[p]={content:await res.text()};}));break;
 }catch{}
 return rec;
}
async function views(address,fallback=[]){const rec=await source(address);if(rec.runtimeCode==='0x')return rec;const c=new Contract(address,rec.abi||fallback,provider);
 await Promise.allSettled(c.interface.fragments.filter(f=>f.type==='function'&&['view','pure'].includes(f.stateMutability)&&!f.inputs.length).map(async f=>{try{const r=await c.getFunction(f.format()).staticCallResult({blockTag});rec.reads[f.name]=f.outputs.length===1?toPlain(r[0],f.outputs[0]):Object.fromEntries(f.outputs.map((p,i)=>[p.name||String(i),toPlain(r[i],p)]));}catch{}}));return rec;}
const hub=new Contract(hubAddress,['function poolLength() view returns(uint256)','function poolDepositor(uint256) view returns(address)','function poolInfo(uint256) view returns(address asset,address gauge,bool active,uint256 totalStaked,address[] rewardTokens)'],provider);
await views(hubAddress,hub.interface.fragments);
const n=Number(await hub.poolLength({blockTag}));
const stakingFallback=['function lp_token() view returns(address)','function boost_hub() view returns(address)','function pid() view returns(uint256)','function reward_count() view returns(uint256)','function vault() view returns(address)','function strategy() view returns(address)','function fee_conversion_converter() view returns(address)','function governance_reward_token() view returns(address)','function reward_tokens(uint256) view returns(address)'];
const strategyFallback=['function staking() view returns(address)','function vault() view returns(address)','function want() view returns(address)','function swapper() view returns(address)','function maxSlippageBps() view returns(uint256)','function rewards(uint256) view returns(address)','function rewardConverter(address) view returns(address)'];
for(let pid=0;pid<n;pid++){
 const info=await hub.poolInfo(pid,{blockTag}),staking=await hub.poolDepositor(pid,{blockTag});const p={pid,asset:info.asset,gauge:info.gauge,active:info.active,rewardTokens:Array.from(info.rewardTokens),staking,strategies:[],converterLinks:[]};trace.pools.push(p);const s=await views(staking,stakingFallback);
 const sc=new Contract(staking,s.abi||stakingFallback,provider);p.stakingRewards=[];
 for(let i=0;i<12;i++)try{const t=await sc.reward_tokens(i,{blockTag});if(t===ZeroAddress)break;p.stakingRewards.push(t);}catch{break;}
 for(const [k,v] of Object.entries(s.reads))if(/convert|swap/i.test(k)&&typeof v==='string'&&/^0x[\da-f]{40}$/i.test(v)&&v!==ZeroAddress)p.converterLinks.push({consumer:staking,method:k,converter:v});
 const tokens=[...new Set([...p.rewardTokens,...p.stakingRewards])];
 for(const f of sc.interface.fragments.filter(f=>f.type==='function'&&['view','pure'].includes(f.stateMutability)&&f.inputs.length===1&&f.inputs[0].type==='address'&&/convert|swap/i.test(f.name)))for(const t of tokens)try{const r=await sc.getFunction(f.format()).staticCall(t,{blockTag});if(typeof r==='string'&&r!==ZeroAddress)p.converterLinks.push({consumer:staking,method:f.name,token:t,converter:r});}catch{}
 // Deposit log participants and direct getters provide candidates, validated by reciprocal staking/vault getters.
 let candidates=[...s.addressCandidates||[],...Object.values(s.reads).filter(v=>typeof v==='string'&&/^0x[\da-f]{40}$/i.test(v)), '0x93DFEfeFd5D3736381086eFa5A8810F278138ADf','0xc202f5137DE30b8170874e1DE55d1DbB2FA4CD45'];
 let logs=[];try{logs=await provider.getLogs({address:staking,fromBlock:25000000,toBlock:blockTag});}catch{const starts=[];for(let b=Math.max(25000000,blockTag-250000);b<=blockTag;b+=9999)starts.push(b);for(let i=0;i<starts.length;i+=5){const r=await Promise.allSettled(starts.slice(i,i+5).map(b=>provider.getLogs({address:staking,fromBlock:b,toBlock:Math.min(b+9998,blockTag)})));for(const x of r)if(x.status==='fulfilled')logs.push(...x.value);}}
 p.logRange={fromBlock:25000000,toBlock:blockTag,records:logs.length};save('staking_pid'+pid+'_logs_v1.json',logs);
 for(const l of logs){for(const topic of l.topics.slice(1))if(/^0x0{24}[\da-f]{40}$/i.test(topic))candidates.push(getAddress('0x'+topic.slice(-40)));for(const m of l.data.matchAll(/(?:^0x|)([\da-f]{64})/gi))if(/^0{24}[\da-f]{40}$/i.test(m[1]))candidates.push(getAddress('0x'+m[1].slice(-40)));}
 candidates=[...new Set(candidates.filter(v=>v!==ZeroAddress))];
 for(let i=0;i<candidates.length;i+=8)await Promise.allSettled(candidates.slice(i,i+8).map(async address=>{try{if(await provider.getCode(address,blockTag)==='0x')return;const c=new Contract(address,strategyFallback,provider);if((await c.staking({blockTag})).toLowerCase()!==staking.toLowerCase())return;const rec=await views(address,strategyFallback);const vault=rec.reads.vault;const v=vault?await views(vault,['function strategy() view returns(address)','function want() view returns(address)','function token() view returns(address)']):null;p.strategies.push({address,vault,reciprocalVaultStrategy:v?.reads.strategy===address,want:rec.reads.want,rewards:[]});const st=p.strategies.at(-1);
 for(let r=0;r<12;r++)try{const t=await c.rewards(r,{blockTag});if(t===ZeroAddress)break;st.rewards.push(t);}catch{break;}
 for(const t of [...new Set([...tokens,...st.rewards])])try{const cv=await c.rewardConverter(t,{blockTag});if(cv!==ZeroAddress)p.converterLinks.push({consumer:address,method:'rewardConverter',token:t,converter:cv});}catch{}
 if(rec.reads.swapper&&rec.reads.swapper!==ZeroAddress)p.converterLinks.push({consumer:address,method:'swapper',converter:rec.reads.swapper});
 }catch{}}));
 await Promise.allSettled([...new Set(p.converterLinks.map(x=>x.converter))].map(address=>views(address,['function route() view returns(address[9])','function swapParams() view returns(uint256[3][4])','function pools() view returns(address[])','function tokenIn() view returns(address)','function tokenOut() view returns(address)','function router() view returns(address)','function MAX_SLIPPAGE_BPS() view returns(uint256)'])));
 save('live_ethereum_flow_v1.json',trace);console.log('PID',pid,'staking',staking,'strategies',p.strategies.length,'converter links',p.converterLinks.length);
}
save('live_ethereum_flow_v1.json',trace);console.log('Pinned block',blockTag,block.hash,'contracts',Object.keys(trace.contracts).length);provider.destroy();
