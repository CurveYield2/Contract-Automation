import fs from 'node:fs/promises';
import fss from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {setTimeout as sleep} from 'node:timers/promises';
import {createHash} from 'node:crypto';
import {buildProject} from '../../runner/src/build-dispatch.mjs';
import {stageExactArchiveSource,runProcess} from './execution.mjs';

export const PHASE0_MEDUSA_CALL_LIMIT_V1=125000;
export const PHASE0_MEDUSA_MIN_CALLS_V1=100001;
export const PHASE0_TELEMETRY_RUNS_V1=4;
export const PHASE0_TELEMETRY_CALLS_PER_RUN_V1=1200;
export const PHASE0_ACCOUNTING_ACTION_WEIGHT_V1=0.80;

const ACCOUNTING_MUTATION_RE=/^(?:deposit|mint|stake|supply|lend|borrow|repay|withdraw|redeem|unstake|unsupply|transfer|transferFrom|burn|swap|addLiquidity|removeLiquidity|join|exit|claim|harvest|collect|distribute|accrue|settle|liquidate|donate|sync|skim)/i;
const ACCOUNTING_VIEW_RE=/(?:balance|assets?|shares?|supply|debt|reserve|liquidity|idle|locked|credit|borrow|price|rate|nav|value|fees?|earned|claimable|accrued|exchange|total|allowance)/i;
const DEPLOY_SCRIPT_RE=/(?:deploy|deployment|bootstrap|setup|initialize|initialise|configure)/i;
const SAFE_ABI_TYPE_RE=/^(?:u?int(?:8|16|24|32|40|48|56|64|72|80|88|96|104|112|120|128|136|144|152|160|168|176|184|192|200|208|216|224|232|240|248|256)?|address|bool|string|bytes(?:[1-9]|[12][0-9]|3[0-2])?)(?:\[[0-9]*\])*$/;

function sha256(v){return createHash('sha256').update(v).digest('hex');}
function normalize(v){
  if(typeof v==='bigint')return v.toString();
  if(Array.isArray(v))return v.map(normalize);
  if(v&&typeof v==='object'){
    if(typeof v.toJSON==='function'){try{return normalize(v.toJSON());}catch{}}
    return Object.fromEntries(Object.entries(v).filter(([k])=>!/^[0-9]+$/.test(k)).map(([k,x])=>[k,normalize(x)]));
  }
  return v;
}
function safePart(v){return String(v??'run').replace(/[^A-Za-z0-9._-]+/g,'_').slice(0,120)||'run';}
function artifactAccessor(artifacts=[]){
  const byQualified=new Map(),byName=new Map();
  for(const a of artifacts){
    if(!a?.sourceName||!a?.contractName)continue;
    byQualified.set(`${a.sourceName}:${a.contractName}`,a);
    const list=byName.get(a.contractName)??[];list.push(a);byName.set(a.contractName,list);
  }
  return{
    all:[...byQualified.values()],
    get(contractName,sourceName){
      if(sourceName){const a=byQualified.get(`${sourceName}:${contractName}`);if(!a)throw new Error(`artifact not found ${sourceName}:${contractName}`);return a;}
      const list=byName.get(contractName)??[];if(list.length!==1)throw new Error(`artifact name is missing or ambiguous: ${contractName}`);return list[0];
    }
  };
}
async function walk(root){
  const out=[];
  async function rec(dir){
    let ents=[];try{ents=await fs.readdir(dir,{withFileTypes:true});}catch{return;}
    for(const e of ents){
      if(['node_modules','.git','artifacts','cache','out','dist','build','broadcast'].includes(e.name))continue;
      const abs=path.join(dir,e.name),rel=path.relative(root,abs).split(path.sep).join('/');
      if(e.isDirectory())await rec(abs);else if(e.isFile())out.push(rel);
    }
  }
  await rec(root);return out.sort();
}
function scrubbedEnv(extra={}){
  const out={};
  for(const k of ['PATH','HOME','USER','SHELL','TMPDIR','LANG','LC_ALL','NODE_OPTIONS','npm_config_cache'])if(process.env[k]!==undefined)out[k]=process.env[k];
  return{...out,CI:'true',NODE_ENV:'test',...extra};
}
async function rpc(url,method,params=[]){
  const res=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});
  const body=await res.json();
  if(body.error)throw new Error(`RPC ${method}: ${body.error.message??JSON.stringify(body.error)}`);
  return body.result;
}
async function startAnvil({forkUrl,projectRoot,evmVersion='cancun'}){
  const chainIdHex=await rpc(forkUrl,'eth_chainId',[]);
  const upstreamChainId=Number(BigInt(chainIdHex));
  if(upstreamChainId!==1){
    const e=new Error(`Phase-0 authoritative Anvil/Medusa baseline currently requires Ethereum chainId=1; upstream returned ${upstreamChainId}`);
    e.code='PHASE0_NON_ETHEREUM_FORK_UNSUPPORTED';throw e;
  }
  const port=8545,url='http://127.0.0.1:8545';
  const executable=path.resolve(process.cwd(),'node_modules/@foundry-rs/anvil/bin.mjs');
  const args=[executable,'--host','127.0.0.1','--port',String(port),'--chain-id','1','--hardfork',String(evmVersion||'cancun').toLowerCase(),'--fork-url',forkUrl,'--accounts','20','--auto-impersonate','--silent'];
  const child=spawn(process.execPath,args,{cwd:projectRoot,env:process.env,stdio:['ignore','ignore','pipe']});
  let stderr='';child.stderr?.on('data',x=>{stderr=(stderr+String(x)).slice(-8000);});
  const started=Date.now();
  while(Date.now()-started<30000){
    if(child.exitCode!==null)throw new Error(`Anvil exited before readiness: ${stderr}`);
    try{if(await rpc(url,'eth_chainId',[]))break;}catch{}
    await sleep(100);
  }
  if(Date.now()-started>=30000){child.kill('SIGKILL');throw new Error('Anvil RPC readiness timeout');}
  return{url,upstreamChainId,child,async close(){if(child.exitCode===null){child.kill('SIGTERM');await Promise.race([new Promise(r=>child.once('exit',r)),sleep(2000)]);if(child.exitCode===null)child.kill('SIGKILL');}}};
}
function detectFoundryScripts(files,texts){
  const out=[];
  for(const rel of files.filter(f=>/(^|\/)scripts?\/.*\.s\.sol$/i.test(f)&&DEPLOY_SCRIPT_RE.test(f))){
    const text=texts.get(rel)??'';
    for(const m of text.matchAll(/contract\s+([A-Za-z_][A-Za-z0-9_]*)\s+is\s+[^\{]*\bScript\b/g)){
      if(/function\s+run\s*\(/.test(text))out.push({framework:'FOUNDRY',path:rel,entry:`${rel}:${m[1]}`});
    }
  }
  return out.slice(0,4);
}
function detectHardhatScripts(files,configText){
  const scripts=files.filter(f=>/(^|\/)scripts?\/.*\.(?:js|cjs|mjs|ts)$/i.test(f)&&DEPLOY_SCRIPT_RE.test(f)).slice(0,4);
  const hasLocalhostNetwork=/localhost\s*:\s*\{[\s\S]{0,800}?(?:127\.0\.0\.1|localhost|ETH_RPC_URL|RPC_URL|LOCALHOST_RPC_URL)/i.test(configText);
  return {
    safe:hasLocalhostNetwork?scripts.map(rel=>({framework:'HARDHAT',path:rel,entry:rel})):[],
    unsafe:hasLocalhostNetwork?[]:scripts.map(rel=>({framework:'HARDHAT',path:rel,entry:rel,reason:'Hardhat localhost network is not mechanically proven to bind to a local RPC URL.'}))
  };
}
async function detectDeploymentScripts(projectRoot){
  const files=await walk(projectRoot),texts=new Map();
  for(const rel of files.filter(f=>f.endsWith('.sol'))){try{texts.set(rel,await fs.readFile(path.join(projectRoot,...rel.split('/')),'utf8'));}catch{}}
  const foundry=(await fs.stat(path.join(projectRoot,'foundry.toml')).catch(()=>null))?detectFoundryScripts(files,texts):[];
  const hardhatConfig=files.find(f=>/^hardhat\.config\.(?:js|cjs|mjs|ts)$/i.test(f));
  const hardhatDetected=hardhatConfig?detectHardhatScripts(files,await fs.readFile(path.join(projectRoot,...hardhatConfig.split('/')),'utf8').catch(()=>'')):{safe:[],unsafe:[]};
  const hardhat=hardhatDetected.safe;
  const unsafeHardhat=hardhatDetected.unsafe;
  const genericPackageScripts=[];
  try{
    const pkg=JSON.parse(await fs.readFile(path.join(projectRoot,'package.json'),'utf8'));
    for(const [name,cmd] of Object.entries(pkg.scripts??{}))if(DEPLOY_SCRIPT_RE.test(name)&&!String(cmd).includes('hardhat'))genericPackageScripts.push({name,command:String(cmd)});
  }catch{}
  return{foundry,hardhat,unsafeHardhat,genericPackageScripts};
}
async function executeDeploymentScripts({projectRoot,anvilUrl,account0,detected}){
  const attempts=[],limitations=[];
  let help='';
  if(detected.foundry.length){const h=await runProcess({command:'forge',args:['script','--help'],cwd:projectRoot,env:scrubbedEnv()});help=`${h.stdout}\n${h.stderr}`;}
  for(const item of detected.foundry){
    const args=['script',item.entry,'--rpc-url',anvilUrl,'--broadcast'];
    if(/--unlocked/.test(help))args.push('--unlocked');
    if(/--sender/.test(help))args.push('--sender',account0);
    if(!/--unlocked/.test(help)){
      limitations.push({type:'DEPLOYMENT_SCRIPT_NOT_SAFELY_REDIRECTABLE',framework:'FOUNDRY',path:item.path,reason:'Installed forge script adapter does not expose --unlocked; Phase-0 will not inject or invent a private key.'});continue;
    }
    const before=Number(BigInt(await rpc(anvilUrl,'eth_blockNumber',[])));
    const r=await runProcess({command:'timeout',args:['240s','forge',...args],cwd:projectRoot,env:scrubbedEnv({ETH_RPC_URL:anvilUrl})});
    const after=Number(BigInt(await rpc(anvilUrl,'eth_blockNumber',[])));
    attempts.push({framework:'FOUNDRY',path:item.path,entry:item.entry,command:['forge',...args].join(' '),exitCode:r.exitCode,status:r.exitCode===0?'PASS':'FAILED',blockRange:[before+1,after],stdout:String(r.stdout??'').slice(-12000),stderr:String(r.stderr??'').slice(-12000)});
  }
  for(const item of detected.unsafeHardhat??[]) limitations.push({type:'DEPLOYMENT_SCRIPT_NOT_SAFELY_REDIRECTABLE',framework:'HARDHAT',path:item.path,reason:item.reason});
  for(const item of detected.hardhat){
    const before=Number(BigInt(await rpc(anvilUrl,'eth_blockNumber',[])));
    const r=await runProcess({command:'timeout',args:['240s','npx','hardhat','run',item.path,'--network','localhost'],cwd:projectRoot,env:scrubbedEnv({ETH_RPC_URL:anvilUrl,RPC_URL:anvilUrl,LOCALHOST_RPC_URL:anvilUrl,HARDHAT_NETWORK:'localhost'})});
    const after=Number(BigInt(await rpc(anvilUrl,'eth_blockNumber',[])));
    attempts.push({framework:'HARDHAT',path:item.path,entry:item.entry,command:`npx hardhat run ${item.path} --network localhost`,exitCode:r.exitCode,status:r.exitCode===0?'PASS':'FAILED',blockRange:[before+1,after],stdout:String(r.stdout??'').slice(-12000),stderr:String(r.stderr??'').slice(-12000)});
  }
  for(const item of detected.genericPackageScripts)limitations.push({type:'DEPLOYMENT_SCRIPT_NOT_SAFELY_REDIRECTABLE',framework:'GENERIC_NPM',script:item.name,command:item.command,reason:'Generic package deployment command has no mechanically proven Anvil RPC override; it was not executed.'});
  return{attempts,limitations,status:attempts.some(x=>x.status==='PASS')?'PASS':(attempts.length?'COMPLETE_WITH_FAILURES':'NO_SAFE_SCRIPT_ADAPTER')};
}
function deployedBytecodePrefix(a){return String(a?.bytecode??'').replace(/^0x/,'').toLowerCase();}
async function discoverDeployments({provider,artifacts,startBlock,endBlock}){
  const rows=[];
  for(let n=startBlock;n<=endBlock;n++){
    const block=await provider.getBlock(n,true);if(!block)continue;
    for(const tx0 of block.prefetchedTransactions??[]){
      if(tx0.to)continue;
      const receipt=await provider.getTransactionReceipt(tx0.hash);if(!receipt?.contractAddress)continue;
      const input=String(tx0.data??'').replace(/^0x/,'').toLowerCase();
      const matches=artifacts.filter(a=>{const p=deployedBytecodePrefix(a);return p&&p.length>20&&!p.includes('__$')&&input.startsWith(p);});
      const a=matches.length===1?matches[0]:null;
      rows.push({address:receipt.contractAddress,transactionHash:tx0.hash,blockNumber:n,qualifiedName:a?`${a.sourceName}:${a.contractName}`:null,contractName:a?.contractName??null,sourceName:a?.sourceName??null,mappingStatus:a?'MATCHED_CREATION_BYTECODE':'UNMAPPED_CREATION'});
    }
  }
  return rows;
}
function constructorInputs(abi){return (abi??[]).find(x=>x.type==='constructor')?.inputs??[];}
function mutableFunctions(ethers,a){
  const iface=new ethers.Interface(a.abi??[]);
  return iface.fragments.filter(x=>x.type==='function'&&!['view','pure'].includes(x.stateMutability)&&x.name).map(f=>({fragment:f,signature:f.format('sighash'),accounting:ACCOUNTING_MUTATION_RE.test(f.name)}));
}
function deployableZeroArg(a){return a?.bytecode&&a.bytecode!=='0x'&&!String(a.bytecode).includes('__$')&&constructorInputs(a.abi).length===0;}
async function fallbackDeploy({provider,ethers,artifacts,existing,max=8}){
  const existingQualified=new Set(existing.filter(x=>x.qualifiedName).map(x=>x.qualifiedName));
  const signer=await provider.getSigner(0),rows=[],limitations=[];
  const ranked=artifacts.filter(deployableZeroArg).filter(a=>!existingQualified.has(`${a.sourceName}:${a.contractName}`)).map(a=>({a,score:mutableFunctions(ethers,a).length+(ACCOUNTING_MUTATION_RE.test(a.contractName)?20:0)})).filter(x=>x.score>0).sort((x,y)=>y.score-x.score).slice(0,max);
  for(const {a} of ranked){
    try{
      const f=new ethers.ContractFactory(a.abi,a.bytecode,signer),c=await f.deploy();await c.waitForDeployment();const receipt=await c.deploymentTransaction().wait();
      rows.push({address:await c.getAddress(),transactionHash:receipt.hash,blockNumber:receipt.blockNumber,qualifiedName:`${a.sourceName}:${a.contractName}`,contractName:a.contractName,sourceName:a.sourceName,mappingStatus:'AUTOMATION_FALLBACK_DEPLOYMENT'});
    }catch(error){limitations.push({type:'FALLBACK_DEPLOYMENT_FAILED',qualifiedName:`${a.sourceName}:${a.contractName}`,message:String(error?.shortMessage??error?.message??error).slice(0,1600)});}
  }
  return{rows,limitations};
}
function seeded(seed){let x=BigInt('0x'+sha256(seed).slice(0,16))||1n;return()=>{x^=x<<13n;x^=x>>7n;x^=x<<17n;x&=(1n<<64n)-1n;return Number(x&0xffffffffn)/4294967296;};}
function ri(rng,n){return Math.floor(rng()*Math.max(1,n));}
function randHex(rng,n){let s='0x';for(let i=0;i<n;i++)s+=ri(rng,256).toString(16).padStart(2,'0');return s;}
function intValue(param,rng){
  const signed=String(param.type).startsWith('int'),bits=Number(String(param.type).match(/\d+/)?.[0]??256),bounds=[0n,1n,2n,10n,100n,1000n,10n**6n,10n**18n];
  let v=rng()<0.65?bounds[ri(rng,bounds.length)]:BigInt(Math.floor(rng()*Number.MAX_SAFE_INTEGER));
  const max=signed?(1n<<BigInt(bits-1))-1n:(1n<<BigInt(bits))-1n;if(v>max)v=max;if(signed&&rng()<0.15)v=-v;return v;
}
function randomValue(param,rng,ctx){
  const type=String(param.type);
  if(param.baseType==='array'){const len=param.arrayLength>=0?Math.min(param.arrayLength,4):ri(rng,4);return Array.from({length:len},()=>randomValue(param.arrayChildren,rng,ctx));}
  if(param.baseType==='tuple')return (param.components??[]).map(p=>randomValue(p,rng,ctx));
  if(/^u?int\d*$/.test(type))return intValue(param,rng);
  if(type==='address'){const xs=[...ctx.actors,...ctx.targets];return rng()<0.03?'0x0000000000000000000000000000000000000000':xs[ri(rng,xs.length)];}
  if(type==='bool')return rng()<0.5;
  if(type==='string')return['','a','phase0','vault','randomized'][ri(rng,5)];
  if(type==='bytes')return randHex(rng,ri(rng,33));
  const m=type.match(/^bytes(\d+)$/);if(m)return randHex(rng,Number(m[1]));
  throw new Error(`unsupported ABI input type ${type}`);
}
function simpleView(f){return (f.outputs??[]).length>0&&(f.outputs??[]).every(x=>/^(?:u?int\d*|address|bool|bytes\d*|string)$/.test(x.type));}
function probePlan(ethers,abi){
  const iface=new ethers.Interface(abi),zero=[],address=[];
  for(const f of iface.fragments.filter(x=>x.type==='function'&&['view','pure'].includes(x.stateMutability)&&simpleView(x)&&ACCOUNTING_VIEW_RE.test(x.name))){
    if(f.inputs.length===0&&zero.length<14)zero.push(f);else if(f.inputs.length===1&&f.inputs[0].type==='address'&&address.length<8)address.push(f);
  }
  return{zero,address};
}
async function safeStatic(contract,f,args){try{return{ok:true,value:normalize(await contract.getFunction(f.format('sighash')).staticCall(...args))};}catch(e){return{ok:false,error:String(e?.shortMessage??e?.message??e).slice(0,800)};}}
async function snapshot({provider,ethers,target,sender,plan,systemTargets}){
  const out={native:{sender:(await provider.getBalance(sender)).toString(),target:(await provider.getBalance(target.address)).toString()},views:{},systemNative:{}};
  for(const t of systemTargets)out.systemNative[t.address]=(await provider.getBalance(t.address)).toString();
  const c=new ethers.Contract(target.address,target.artifact.abi,provider);
  for(const f of plan.zero)out.views[f.format('sighash')]=await safeStatic(c,f,[]);
  for(const f of plan.address){const s=f.format('sighash');out.views[`${s}::sender`]=await safeStatic(c,f,[sender]);out.views[`${s}::target`]=await safeStatic(c,f,[target.address]);}
  return out;
}
function flattenNumbers(v,p='',o={}){
  if(typeof v==='string'&&/^-?\d+$/.test(v)){o[p]=BigInt(v);return o;}
  if(Array.isArray(v)){v.forEach((x,i)=>flattenNumbers(x,`${p}[${i}]`,o));return o;}
  if(v&&typeof v==='object')for(const [k,x] of Object.entries(v))flattenNumbers(x,p?`${p}.${k}`:k,o);
  return o;
}
function deltas(a,b){const x=flattenNumbers(a),y=flattenNumbers(b),o={};for(const k of new Set([...Object.keys(x),...Object.keys(y)]))if(x[k]!==undefined&&y[k]!==undefined&&x[k]!==y[k])o[k]=(y[k]-x[k]).toString();return o;}
function errorInfo(e,iface){
  const data=e?.data??e?.info?.error?.data??null;let decoded=null;
  if(typeof data==='string'){try{const p=iface.parseError(data);decoded=p?{name:p.name,signature:p.signature,args:normalize(p.args)}:null;}catch{}}
  return{name:e?.name??'Error',code:e?.code??null,shortMessage:e?.shortMessage??null,reason:e?.reason??null,message:String(e?.message??e).slice(0,1800),data:typeof data==='string'?data.slice(0,4096):null,decodedCustomError:decoded};
}
function targetObjects(ethers,artifacts,deployed){
  const byQ=new Map(artifacts.map(a=>[`${a.sourceName}:${a.contractName}`,a]));
  return deployed.filter(d=>d.qualifiedName&&byQ.has(d.qualifiedName)).map(d=>{const artifact=byQ.get(d.qualifiedName);return{...d,artifact,functions:mutableFunctions(ethers,artifact),plan:probePlan(ethers,artifact)};}).filter(t=>t.functions.length);
}
function pickFn(target,rng,actionClass){
  const accounting=target.functions.filter(x=>x.accounting),other=target.functions.filter(x=>!x.accounting);
  const pool=actionClass==='ACCOUNTING_STATE_CHANGE'?accounting:other;
  const fallback=pool.length?pool:(accounting.length?accounting:other);return fallback[ri(rng,fallback.length)];
}
function buildBurstSchedule(targets,calls,rng){
  const out=[];
  const accountingTargets=targets.map((t,i)=>({t,i})).filter(x=>x.t.functions.some(f=>f.accounting));
  const otherTargets=targets.map((t,i)=>({t,i})).filter(x=>x.t.functions.some(f=>!f.accounting));
  let accountingRemaining=accountingTargets.length?Math.round(calls*PHASE0_ACCOUNTING_ACTION_WEIGHT_V1):0;
  let otherRemaining=otherTargets.length?(calls-accountingRemaining):0;
  if(accountingTargets.length&&!otherTargets.length){accountingRemaining=calls;otherRemaining=0;}
  if(!accountingTargets.length&&otherTargets.length){accountingRemaining=0;otherRemaining=calls;}
  let previous=-1;
  while(accountingRemaining+otherRemaining>0){
    let actionClass;
    if(accountingRemaining===0) actionClass='OTHER_STATE_CHANGE';
    else if(otherRemaining===0) actionClass='ACCOUNTING_STATE_CHANGE';
    else actionClass=rng()<(accountingRemaining/(accountingRemaining+otherRemaining))?'ACCOUNTING_STATE_CHANGE':'OTHER_STATE_CHANGE';
    let pool=actionClass==='ACCOUNTING_STATE_CHANGE'?accountingTargets:otherTargets;
    if(!pool.length){actionClass=actionClass==='ACCOUNTING_STATE_CHANGE'?'OTHER_STATE_CHANGE':'ACCOUNTING_STATE_CHANGE';pool=actionClass==='ACCOUNTING_STATE_CHANGE'?accountingTargets:otherTargets;}
    if(!pool.length) break;
    let choices=pool.filter(x=>x.i!==previous);if(!choices.length) choices=pool;
    const chosen=choices[ri(rng,choices.length)],budget=actionClass==='ACCOUNTING_STATE_CHANGE'?accountingRemaining:otherRemaining,count=Math.min(budget,20+ri(rng,101));
    out.push({targetIndex:chosen.i,count,actionClass});
    if(actionClass==='ACCOUNTING_STATE_CHANGE')accountingRemaining-=count;else otherRemaining-=count;
    previous=chosen.i;
  }
  return out;
}
async function runTelemetry({provider,ethers,targets,actors,outRoot,baselineSnapshot}){
  const summaries=[];
  let snapshotId=baselineSnapshot;
  for(let run=1;run<=PHASE0_TELEMETRY_RUNS_V1;run++){
    if(run>1){await provider.send('evm_revert',[snapshotId]);snapshotId=await provider.send('evm_snapshot',[]);}
    const runId=`abi-telemetry-${String(run).padStart(3,'0')}`,dir=path.join(outRoot,'runs',runId);await fs.mkdir(dir,{recursive:true});
    const file=path.join(dir,'RAW_SIMULATION_TRANSCRIPT_v1.jsonl'),h=await fs.open(file,'w'),rng=seeded(`${runId}-phase0-v1`);
    const schedule=buildBurstSchedule(targets,PHASE0_TELEMETRY_CALLS_PER_RUN_V1,rng);
    const accountingFunctionCount=targets.reduce((n,t)=>n+t.functions.filter(x=>x.accounting).length,0);
    const otherFunctionCount=targets.reduce((n,t)=>n+t.functions.filter(x=>!x.accounting).length,0);
    const stats={calls:0,accountingActions:0,otherActions:0,accountingFunctionCount,otherFunctionCount,weightingLimitation:accountingFunctionCount===0?'NO_ACCOUNTING_STATE_CHANGE_FUNCTIONS_DETECTED':null,successes:0,reverts:0,errors:0,byContract:{},byFunction:{},burstSchedule:schedule.map(x=>({contract:targets[x.targetIndex].qualifiedName,calls:x.count,actionClass:x.actionClass}))};
    try{
      for(const burst of schedule){
        const target=targets[burst.targetIndex];
        for(let k=0;k<burst.count;k++){
          const selected=pickFn(target,rng,burst.actionClass),f=selected.fragment,sender=actors[ri(rng,actors.length)],iface=new ethers.Interface(target.artifact.abi);
          let args=[],argError=null;try{args=f.inputs.map(p=>randomValue(p,rng,{actors,targets:targets.map(x=>x.address)}));}catch(e){argError=e;}
          const before=await snapshot({provider,ethers,target,sender,plan:target.plan,systemTargets:targets});
          const rec={schemaVersion:'curveyield-phase0-raw-simulation-call-v1',runId,callIndex:stats.calls+1,target:{qualifiedName:target.qualifiedName,address:target.address},sender,functionSignature:selected.signature,actionClass:selected.accounting?'ACCOUNTING_STATE_CHANGE':'OTHER_STATE_CHANGE',decodedInputs:argError?null:normalize(args),abiGenerated:true,rawRandomBytes:false,beforeAccounting:before,transaction:null,error:null,afterAccounting:null,accountingDeltas:{}};
          stats.calls++;if(selected.accounting)stats.accountingActions++;else stats.otherActions++;
          stats.byContract[target.qualifiedName]=(stats.byContract[target.qualifiedName]??0)+1;const fk=`${target.qualifiedName}::${selected.signature}`;stats.byFunction[fk]=(stats.byFunction[fk]??0)+1;
          if(argError){rec.error={name:'ABI_ARGUMENT_GENERATION_LIMITATION',message:String(argError.message??argError)};stats.errors++;}
          else{
            try{
              const signer=await provider.getSigner(sender),c=new ethers.Contract(target.address,target.artifact.abi,signer),fn=c.getFunction(selected.signature),overrides=f.stateMutability==='payable'?{value:BigInt(ri(rng,1000000))}:{};
              const tx=await fn.send(...args,overrides),receipt=await tx.wait();
              rec.transaction={hash:receipt.hash,blockNumber:receipt.blockNumber,status:receipt.status,gasUsed:receipt.gasUsed?.toString()??null,value:overrides.value?.toString()??'0',logs:(receipt.logs??[]).map(l=>({address:l.address,topics:[...l.topics],data:l.data,index:l.index}))};stats.successes++;
            }catch(e){rec.error=errorInfo(e,iface);if(e?.code==='CALL_EXCEPTION'||/revert/i.test(String(e?.shortMessage??e?.message??'')))stats.reverts++;else stats.errors++;}
          }
          const after=await snapshot({provider,ethers,target,sender,plan:target.plan,systemTargets:targets});rec.afterAccounting=after;rec.accountingDeltas=deltas(before,after);
          await h.write(JSON.stringify(rec)+'\n');
        }
      }
    }finally{await h.close();}
    const bytes=await fs.readFile(file),summary={schemaVersion:'curveyield-phase0-abi-telemetry-run-v1',runId,purpose:'INVESTIGATIVE_TELEMETRY_FOR_LATER_REVIEWERS_NOT_MANUAL_REVERIFICATION',...stats,accountingActionShare:stats.calls?stats.accountingActions/stats.calls:0,requiredAccountingActionWeight:PHASE0_ACCOUNTING_ACTION_WEIGHT_V1,interleavedCrossContractBursts:true,rawTranscriptRef:`runs/${runId}/RAW_SIMULATION_TRANSCRIPT_v1.jsonl`,rawTranscriptSha256:sha256(bytes),rawTranscriptBytes:bytes.length,status:stats.calls===PHASE0_TELEMETRY_CALLS_PER_RUN_V1?'PASS':'INCOMPLETE'};
    await fs.writeFile(path.join(dir,'RUN_SUMMARY_v1.json'),JSON.stringify(summary,null,2)+'\n');summaries.push(summary);
  }
  return summaries;
}
function solidityType(param){
  const type=String(param.type??'');
  if(!SAFE_ABI_TYPE_RE.test(type)||param.baseType==='tuple')return null;
  const dynamic=type==='string'||type==='bytes'||type.includes('[');
  return dynamic?`${type} calldata`:type;
}
function medusaWrappers(ethers,targets){
  const accounting=[],other=[],omitted=[];
  for(const t of targets){
    for(const x of t.functions){
      const types=x.fragment.inputs.map(solidityType);if(types.some(v=>!v)){omitted.push({qualifiedName:t.qualifiedName,signature:x.signature,reason:'UNSUPPORTED_ROUTER_PARAMETER_TYPE'});continue;}
      const row={target:t,selected:x,types};(x.accounting?accounting:other).push(row);
    }
  }
  const rows=[];let id=0;
  const accCopies=accounting.length?4:0;
  for(const x of accounting)for(let n=0;n<accCopies;n++)rows.push({...x,wrapperName:`p0_acc_${id++}_${n}`});
  let selectedOther=other;
  if(accounting.length&&other.length>accounting.length){
    const step=other.length/accounting.length;
    selectedOther=Array.from({length:accounting.length},(_,i)=>other[Math.floor(i*step)]);
    for(const x of other)if(!selectedOther.includes(x))omitted.push({qualifiedName:x.target.qualifiedName,signature:x.selected.signature,reason:'NON_ACCOUNTING_WRAPPER_DOWNSAMPLED_FOR_80_PERCENT_WEIGHT'});
  }
  for(const x of selectedOther)rows.push({...x,wrapperName:`p0_other_${id++}`});
  if(!accounting.length) omitted.push({qualifiedName:'ALL_TARGETS',signature:'N/A',reason:'NO_ACCOUNTING_STATE_CHANGE_FUNCTIONS_DETECTED_FOR_MEDUSA_WEIGHTING'});
  return{rows,omitted,accCopies,accountingWrapperShare:rows.length?rows.filter(x=>x.selected.accounting).length/rows.length:0};
}
function renderMedusaRouter(ethers,targets){
  const plan=medusaWrappers(ethers,targets),body=[];
  for(const x of plan.rows){
    const names=x.types.map((t,i)=>`${t} a${i}`),args=x.types.map((_,i)=>`a${i}`),selector=ethers.id(x.selected.signature).slice(0,10),payable=x.selected.fragment.stateMutability==='payable'?' payable':'';
    const value=x.selected.fragment.stateMutability==='payable'?'msg.value':'0';
    const encodedArgs=args.length?`,`+args.join(','):'';
    body.push(`  function ${x.wrapperName}(${names.join(', ')}) external${payable} { (bool ok, bytes memory data)=address(${x.target.address}).call{value:${value}}(abi.encodeWithSelector(bytes4(${selector})${encodedArgs})); emit Phase0Call(address(${x.target.address}),bytes4(${selector}),ok,data); }`);
  }
  return{...plan,source:`// SPDX-License-Identifier: UNLICENSED\npragma solidity ^0.8.20;\ncontract Phase0MedusaRouterV1 {\n  event Phase0Call(address indexed target, bytes4 indexed selector, bool success, bytes data);\n${body.join('\n')}\n}\n`};
}
function maxMedusaCalls(text){let max=0;for(const m of String(text).matchAll(/calls:\s*([0-9][0-9,]*)/gi))max=Math.max(max,Number(m[1].replaceAll(',','')));return max;}
async function runMedusa({projectRoot,anvilUrl,blockNumber,ethers,targets,outRoot}){
  const dir=path.join(outRoot,'runs','medusa-anvil-fork-001');await fs.mkdir(dir,{recursive:true});
  const router=renderMedusaRouter(ethers,targets);
  if(!router.rows.length){const s={schemaVersion:'curveyield-phase0-medusa-run-v1',runId:'medusa-anvil-fork-001',status:'BLOCKED_NO_ROUTABLE_ABI_FUNCTIONS',configuredCallLimit:PHASE0_MEDUSA_CALL_LIMIT_V1,observedCalls:0,limitations:router.omitted};await fs.writeFile(path.join(dir,'RUN_SUMMARY_v1.json'),JSON.stringify(s,null,2)+'\n');return s;}
  const sourceRoot=(targets.map(t=>t.artifact.sourceName.split('/')[0]).find(x=>['contracts','src'].includes(x)))??'contracts';
  const harnessRel=`${sourceRoot}/Phase0MedusaRouterV1.sol`,harnessAbs=path.join(projectRoot,...harnessRel.split('/'));await fs.mkdir(path.dirname(harnessAbs),{recursive:true});await fs.writeFile(harnessAbs,router.source);
  const corpusRel='.curveyield-phase0-medusa-corpus-v1';
  const cfg={fuzzing:{workers:10,workerResetLimit:50,timeout:0,testLimit:PHASE0_MEDUSA_CALL_LIMIT_V1,shrinkLimit:5000,callSequenceLength:100,coverageEnabled:true,corpusDirectory:corpusRel,coverageFormats:['lcov'],revertReporterEnabled:true,targetContracts:['Phase0MedusaRouterV1'],predeployedContracts:{},targetContractsBalances:[],constructorArgs:{},senderAddresses:['0x0000000000000000000000000000000000010000','0x0000000000000000000000000000000000020000','0x0000000000000000000000000000000000030000','0x0000000000000000000000000000000000040000'],testing:{stopOnFailedTest:false,stopOnNoTests:false,testAllContracts:false,testViewMethods:false,assertionTesting:{enabled:false},propertyTesting:{enabled:false,testPrefixes:['property_']},optimizationTesting:{enabled:false,testPrefixes:['optimize_']},targetFunctionSignatures:router.rows.map(x=>`Phase0MedusaRouterV1.${x.wrapperName}(${x.selected.fragment.inputs.map(p=>p.type).join(',')})`),excludeFunctionSignatures:[]},chainConfig:{cheatCodes:{cheatCodesEnabled:true,enableFFI:false},forkConfig:{forkModeEnabled:true,rpcUrl:anvilUrl,rpcBlock:blockNumber,poolSize:24}}},compilation:{platform:'crytic-compile',platformConfig:{target:'.',args:[]}},slither:{useSlither:false},logging:{level:'info',logDirectory:'',noColor:true}};
  const cfgPath=path.join(projectRoot,'.curveyield-phase0-medusa-v1.json');await fs.writeFile(cfgPath,JSON.stringify(cfg,null,2)+'\n');
  await fs.writeFile(path.join(dir,'MEDUSA_CONFIG_v1.json'),JSON.stringify(cfg,null,2)+'\n');
  await fs.writeFile(path.join(dir,'MEDUSA_ROUTER_v1.sol'),router.source);
  const r=await runProcess({command:'timeout',args:['1800s','medusa','fuzz','--config',cfgPath],cwd:projectRoot,env:scrubbedEnv()});
  const raw=`${r.stdout??''}\n${r.stderr??''}`;await fs.writeFile(path.join(dir,'MEDUSA_RAW_OUTPUT_v1.log'),raw);
  const corpusSource=path.join(projectRoot,corpusRel),corpusDest=path.join(dir,'corpus');
  const corpusIndex=[];
  if(fss.existsSync(corpusSource)){
    await fs.rm(corpusDest,{recursive:true,force:true});
    await fs.cp(corpusSource,corpusDest,{recursive:true});
    for(const rel of await walk(corpusDest)){
      const abs=path.join(corpusDest,...rel.split('/')),bytes=await fs.readFile(abs);
      corpusIndex.push({path:'corpus/'+rel,sha256:sha256(bytes),bytes:bytes.length});
    }
  }
  await fs.writeFile(path.join(dir,'MEDUSA_CORPUS_INDEX_v1.json'),JSON.stringify({schemaVersion:'curveyield-phase0-medusa-corpus-index-v1',files:corpusIndex},null,2)+'\n');
  const observedCalls=maxMedusaCalls(raw),summary={schemaVersion:'curveyield-phase0-medusa-run-v1',runId:'medusa-anvil-fork-001',purpose:'BROAD_PHASE0_STATEFUL_RANDOMIZED_DISCOVERY_FROM_ANVIL_STATE',fork:{engine:'anvil',rpcUrlExposed:false,rpcBlock:blockNumber,chain:'ethereum',chainId:1},configuredCallLimit:PHASE0_MEDUSA_CALL_LIMIT_V1,minimumRequiredCalls:PHASE0_MEDUSA_MIN_CALLS_V1,observedCalls,callSequenceLength:100,workers:10,abiRouterGenerated:true,rawRandomBytes:false,targetContracts:targets.map(t=>({qualifiedName:t.qualifiedName,address:t.address})),routerWrapperCount:router.rows.length,accountingWrapperShare:router.accountingWrapperShare,omittedFunctions:router.omitted,exitCode:r.exitCode,rawOutputRef:'runs/medusa-anvil-fork-001/MEDUSA_RAW_OUTPUT_v1.log',corpusIndexRef:'runs/medusa-anvil-fork-001/MEDUSA_CORPUS_INDEX_v1.json',retainedCorpusFileCount:corpusIndex.length,configRef:'runs/medusa-anvil-fork-001/MEDUSA_CONFIG_v1.json',routerRef:'runs/medusa-anvil-fork-001/MEDUSA_ROUTER_v1.sol',status:r.exitCode===0&&observedCalls>=PHASE0_MEDUSA_MIN_CALLS_V1?'PASS':(r.exitCode===0?'INCOMPLETE_CALL_REQUIREMENT':'FAILED')};
  await fs.writeFile(path.join(dir,'RUN_SUMMARY_v1.json'),JSON.stringify(summary,null,2)+'\n');
  await fs.rm(harnessAbs,{force:true});await fs.rm(cfgPath,{force:true});return summary;
}
function baselineTargetRows({medusa,telemetry}){
  const refs=[medusa?.rawOutputRef,...telemetry.map(x=>x.rawTranscriptRef)].filter(Boolean);
  return[
    {candidateKey:'PHASE0-BASELINE-MEDUSA',executionEvidenceRefs:[medusa?.rawOutputRef??'NO_MEDUSA_OUTPUT'],oracleOutcome:medusa?.status==='PASS'?'BASELINE_RANDOMIZED_EXECUTION_COMPLETED':'BASELINE_RANDOMIZED_EXECUTION_LIMITED',reproductionStatus:medusa?.status??'UNKNOWN',requestBindingStatus:'PHASE0_CONTROLLER_GENERATED',requestBindingEvidenceRef:medusa?.configRef??'NO_CONFIG'},
    {candidateKey:'PHASE0-BASELINE-ABI-TELEMETRY',executionEvidenceRefs:refs,oracleOutcome:'INVESTIGATIVE_BASELINE_TELEMETRY_GENERATED',reproductionStatus:telemetry.every(x=>x.status==='PASS')?'PASS':'INCOMPLETE',requestBindingStatus:'PHASE0_CONTROLLER_GENERATED',requestBindingEvidenceRef:'evidence/phase0/simulations/PHASE0_SIMULATION_RUN_INDEX_v1.json'}
  ];
}
export async function runPhase0RandomizedSimulationV1({controllerRoot,campaignPath,outputRoot,forkUrl}){
  const campaignRoot=path.join(controllerRoot,...campaignPath.split('/')),buildIdentity=JSON.parse(await fs.readFile(path.join(campaignRoot,'evidence/build/BUILD_AND_SOURCE_IDENTITY_v1.json'),'utf8'));
  const receipt=JSON.parse(await fs.readFile(path.join(campaignRoot,'receipts/PHASE_00_RECEIPT_v1.json'),'utf8'));
  const archivePath=receipt.source.archivePath,archiveSha256=receipt.source.sha256,workspace=path.join(path.dirname(outputRoot),'.phase0-simulation-work');
  const staged=await stageExactArchiveSource({checkoutRoot:controllerRoot,workspaceRoot:workspace,archivePath,archiveSha256,projectPath:buildIdentity.discovery.projectPath});
  const cfg=buildIdentity.configurationDetection,pseudo={requestId:`phase0-sim-${receipt.campaign.campaignId}`,requestDigest:sha256(JSON.stringify(buildIdentity)),campaignId:receipt.campaign.campaignId,assignmentId:'phase0-simulation',phaseId:'phase-0',profileId:'github-native-compile-v2',source:{repository:'CurveYield2/Audit-Controller',commit:receipt.source.archiveCommit,projectPath:buildIdentity.discovery.projectPath,archivePath,archiveSha256},configuration:{compilers:[{language:'solidity',version:cfg.compilerVersion}],optimizer:cfg.optimizer,evmVersion:cfg.evmVersion,viaIR:cfg.viaIR}};
  const build=await buildProject({projectRoot:staged.projectRoot,request:pseudo}),artifacts=build.artifacts??[],ethers=await import('ethers');
  await fs.rm(outputRoot,{recursive:true,force:true});await fs.mkdir(path.join(outputRoot,'runs'),{recursive:true});
  let anvil;
  try{
    anvil=await startAnvil({forkUrl,projectRoot:staged.projectRoot,evmVersion:cfg.evmVersion});
    const provider=new ethers.JsonRpcProvider(anvil.url,1,{staticNetwork:true}),actors=await provider.send('eth_accounts',[]),initialBlock=Number(await provider.getBlockNumber());
    const detected=await detectDeploymentScripts(staged.projectRoot),deployment=await executeDeploymentScripts({projectRoot:staged.projectRoot,anvilUrl:anvil.url,account0:actors[0],detected});
    const scriptEnd=Number(await provider.getBlockNumber()),scriptDeployments=scriptEnd>=initialBlock+1?await discoverDeployments({provider,artifacts,startBlock:initialBlock+1,endBlock:scriptEnd}):[];
    const fallback=await fallbackDeploy({provider,ethers,artifacts,existing:scriptDeployments,max:8}),deployed=[...scriptDeployments,...fallback.rows],targets=targetObjects(ethers,artifacts,deployed);
    const baselineBlock=Number(await provider.getBlockNumber()),baselineHash=(await provider.getBlock(baselineBlock))?.hash??null,baselineSnapshot=await provider.send('evm_snapshot',[]);
    const medusa=targets.length?await runMedusa({projectRoot:staged.projectRoot,anvilUrl:anvil.url,blockNumber:baselineBlock,ethers,targets,outRoot:outputRoot}):{schemaVersion:'curveyield-phase0-medusa-run-v1',runId:'medusa-anvil-fork-001',status:'BLOCKED_NO_EXECUTABLE_TARGETS',configuredCallLimit:PHASE0_MEDUSA_CALL_LIMIT_V1,minimumRequiredCalls:PHASE0_MEDUSA_MIN_CALLS_V1,observedCalls:0};
    const telemetry=targets.length?await runTelemetry({provider,ethers,targets,actors,outRoot:outputRoot,baselineSnapshot}):[];
    const runIndex={schemaVersion:'curveyield-phase0-simulation-run-index-v1',purpose:'LATER_REVIEWER_INVESTIGATION_AND_TARGET_DESIGN',sourceIdentity:{campaignId:receipt.campaign.campaignId,sourceSha256:receipt.source.sha256},fork:{engine:'anvil',chain:'ethereum',chainId:1,baselineBlock,baselineBlockHash:baselineHash,upstreamRpcExposed:false},deployment:{detectedScripts:detected,attempts:deployment.attempts,limitations:[...deployment.limitations,...fallback.limitations],deployedContracts:deployed},policy:{realAbiCallsOnly:true,rawRandomBytes:false,accountingActionWeight:PHASE0_ACCOUNTING_ACTION_WEIGHT_V1,crossContractBursts:true,medusaMinimumCalls:PHASE0_MEDUSA_MIN_CALLS_V1},runs:[{runId:medusa.runId,type:'MEDUSA_ANVIL_FORK',status:medusa.status,summaryRef:'runs/medusa-anvil-fork-001/RUN_SUMMARY_v1.json'},...telemetry.map(x=>({runId:x.runId,type:'ABI_ACCOUNTING_TELEMETRY',status:x.status,summaryRef:`runs/${x.runId}/RUN_SUMMARY_v1.json`,rawTranscriptRef:x.rawTranscriptRef}))]};
    const simulationLimitations=[...deployment.limitations,...fallback.limitations,...(telemetry.filter(x=>x.weightingLimitation).map(x=>({type:x.weightingLimitation,runId:x.runId})))];if(medusa.status!=='PASS'&&medusa.status!=='BLOCKED_NO_EXECUTABLE_TARGETS')simulationLimitations.push({type:'MEDUSA_BASELINE_'+String(medusa.status),runId:medusa.runId});const summary={schemaVersion:'curveyield-phase0-randomized-simulation-summary-v1',campaignId:receipt.campaign.campaignId,status:medusa.status==='PASS'&&telemetry.length===PHASE0_TELEMETRY_RUNS_V1&&telemetry.every(x=>x.status==='PASS')?'PASS':'COMPLETE_WITH_TYPED_LIMITATIONS',medusa,telemetry:telemetry.map(x=>({runId:x.runId,calls:x.calls,accountingActions:x.accountingActions,accountingActionShare:x.accountingActionShare,accountingFunctionCount:x.accountingFunctionCount,otherFunctionCount:x.otherFunctionCount,weightingLimitation:x.weightingLimitation,successes:x.successes,reverts:x.reverts,errors:x.errors,rawTranscriptRef:x.rawTranscriptRef,burstSchedule:x.burstSchedule})),deployment,baselineTargetDispositions:baselineTargetRows({medusa,telemetry}),limitations:simulationLimitations};
    await fs.writeFile(path.join(outputRoot,'PHASE0_SIMULATION_RUN_INDEX_v1.json'),JSON.stringify(runIndex,null,2)+'\n');await fs.writeFile(path.join(outputRoot,'PHASE0_RANDOMIZED_SIMULATION_SUMMARY_v1.json'),JSON.stringify(summary,null,2)+'\n');
    const deployEvidence={schemaVersion:'curveyield-lite-phase0-deploy-config-execution-v2',policy:'ANVIL_ONLY_FRAMEWORK_NATIVE_SCRIPT_ADAPTERS_NO_SOURCE_MUTATION_NO_PRODUCTION_SECRETS',fork:{engine:'anvil',chain:'ethereum',chainId:1,baselineBlock,baselineBlockHash:baselineHash},attempts:deployment.attempts,deployedContracts:deployed,gaps:[...deployment.limitations,...fallback.limitations],status:deployment.status};
    await fs.writeFile(path.join(outputRoot,'PHASE0_DEPLOY_CONFIG_EXECUTION_v1.json'),JSON.stringify(deployEvidence,null,2)+'\n');await provider.destroy();
    return{summary,runIndex,deployEvidence};
  }catch(error){
    const nonEthereum=error?.code==='PHASE0_NON_ETHEREUM_FORK_UNSUPPORTED';
    const typed={type:nonEthereum?'NON_ETHEREUM_FORK_NOT_ADMITTED':'PHASE0_SIMULATION_FAILURE',code:error?.code??'PHASE0_SIMULATION_FAILURE',message:String(error?.message??error),securityEffect:'REQUIRES_PHASE6_INTERPRETATION'};
    const limitation={
      schemaVersion:'curveyield-phase0-randomized-simulation-summary-v1',
      status:nonEthereum?'COMPLETE_WITH_TYPED_LIMITATIONS':'BLOCKED',
      code:typed.code,
      message:typed.message,
      chainLimitation:nonEthereum?'The Anvil-state to Medusa fork path is currently admitted only for the default Ethereum fork profile.':null,
      limitations:[typed],
      medusa:{status:nonEthereum?'NOT_APPLICABLE_NON_ETHEREUM':'BLOCKED',configuredCallLimit:PHASE0_MEDUSA_CALL_LIMIT_V1,minimumRequiredCalls:PHASE0_MEDUSA_MIN_CALLS_V1,observedCalls:0},
      telemetry:[],
      baselineTargetDispositions:[{
        candidateKey:'PHASE0-BASELINE-RANDOMIZED-SIMULATION',
        executionEvidenceRefs:['evidence/phase0/PHASE0_RANDOMIZED_SIMULATION_SUMMARY_v1.json'],
        oracleOutcome:nonEthereum?'NOT_EXECUTED_CHAIN_FIDELITY_LIMITATION':'BLOCKED',
        reproductionStatus:nonEthereum?'NOT_APPLICABLE_NON_ETHEREUM':'BLOCKED',
        requestBindingStatus:'PHASE0_CONTROLLER_GENERATED',
        requestBindingEvidenceRef:'evidence/phase0/PHASE0_RANDOMIZED_SIMULATION_SUMMARY_v1.json'
      }]
    };
    const runIndex={
      schemaVersion:'curveyield-phase0-simulation-run-index-v1',
      status:limitation.status,
      purpose:'LATER_REVIEWER_INVESTIGATION_AND_TARGET_DESIGN',
      policy:{realAbiCallsOnly:true,rawRandomBytes:false,accountingActionWeight:PHASE0_ACCOUNTING_ACTION_WEIGHT_V1,crossContractBursts:true,medusaMinimumCalls:PHASE0_MEDUSA_MIN_CALLS_V1},
      runs:[],
      limitation:typed
    };
    await fs.mkdir(outputRoot,{recursive:true});
    await fs.writeFile(path.join(outputRoot,'PHASE0_RANDOMIZED_SIMULATION_SUMMARY_v1.json'),JSON.stringify(limitation,null,2)+'\n');
    await fs.writeFile(path.join(outputRoot,'PHASE0_SIMULATION_RUN_INDEX_v1.json'),JSON.stringify(runIndex,null,2)+'\n');
    return{summary:limitation,runIndex,deployEvidence:null};
  }finally{if(anvil)await anvil.close().catch(()=>{});}
}
