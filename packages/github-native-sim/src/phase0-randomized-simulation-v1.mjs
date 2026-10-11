import fs from 'node:fs/promises';
import fss from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import zlib from 'node:zlib';
import {spawn} from 'node:child_process';
import {setTimeout as sleep} from 'node:timers/promises';
import {createHash} from 'node:crypto';
import {startRpcIdentityProxy} from '../../runner/src/rpc-identity-proxy-v1.mjs';
import {stageExactArchiveSource,runProcess} from './execution.mjs';
import {deploySourceKnownPlanV1} from './source-known-deployment-plan-v1.mjs';
import {validateExecutionInputJoinV2} from './phase0-execution-input-v2.mjs';
import {generateTypedValueV2,qualifyRecipeV2,classifySemanticFamilyV2,classifyExecutionOutcomeV2,observationDeltaV2,validateTelemetryCountersV2,assessMedusaV2,CAPABILITY_CONTRACT_VERSION_V2} from './phase0-execution-contract-v2.mjs';
import {parseMedusaOutput} from './analysis.mjs';
import {topDecodedTelemetryRevertsV1,discoverValuePoolV1,fundActorsV1,PHASE0_MEDUSA_SENDERS_V1,weightedFixtureAddressSeedV1,chooseFixtureAddressV1,chooseFixtureAmountV1,recordChosenAddressesV1,serializeValuePoolV1,executeCreatorSynthesisV1,approveFixtureSpendersV1,refreshCreatedAssociationsV1,executeActivationSynthesisV1} from './phase0-fixture-synthesis-v1.mjs';

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
export function phase0DiscoveredTargetChainIdsV1(readiness={}){
  const rows=readiness?.deploymentAndConfiguration?.discoveredChainIds??[];
  return [...new Set(rows.map(x=>Number(x?.chainId)).filter(x=>Number.isInteger(x)&&x>0))].sort((a,b)=>a-b);
}
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
export function executionSecretValuesV2(env={},extra=[]){
  return[...extra,...Object.entries(env).filter(([k])=>/PRIVATE_KEY|SECRET|TOKEN|MNEMONIC|PASSWORD|API_KEY/i.test(k)).map(([,v])=>v)];
}
export function redactExecutionSecretsV2(value,secrets=[]){
  let text=String(value??'');
  for(const secret of secrets.filter(x=>typeof x==='string'&&x.length>=8))text=text.split(secret).join('[REDACTED_PHASE0_SECRET]');
  text=text.replace(/gh[pousr]_[A-Za-z0-9_]{20,}/g,'[REDACTED_GITHUB_TOKEN]');
  return text;
}
function deploymentScriptKeyV2(item){
  const framework=item.framework??'GENERIC_NODE';
  const identity=framework==='GENERIC_NODE'
    ? (item.script??item.name??item.path??item.entry??'UNKNOWN')
    : (item.path??item.entry??item.script??item.name??'UNKNOWN');
  return [framework,identity].join(':');
}
async function rpc(url,method,params=[]){
  const res=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});
  const body=await res.json();
  if(body.error)throw new Error(`RPC ${method}: ${body.error.message??JSON.stringify(body.error)}`);
  return body.result;
}
async function startAnvil({forkUrl,projectRoot,evmVersion='cancun'}){
  let identityProxy;
  try{
    const ethers=await import('ethers');
    const ephemeralWallet=ethers.Wallet.createRandom();
    const ephemeralMnemonic=ephemeralWallet.mnemonic?.phrase;
    if(!ephemeralMnemonic)throw new Error('Unable to generate ephemeral Anvil mnemonic');
    identityProxy=await startRpcIdentityProxy({upstreamUrl:forkUrl,chainId:1});
    const normalizedChainId=Number(BigInt(await rpc(identityProxy.url,'eth_chainId',[])));
    if(normalizedChainId!==1){
      const e=new Error(`Phase-0 Ethereum RPC identity normalization failed; observed chainId=${normalizedChainId}`);
      e.code='PHASE0_ETHEREUM_IDENTITY_NORMALIZATION_FAILURE';throw e;
    }
    const observation=identityProxy.getUpstreamIdentityObservation?.();
    let upstreamChainId=null;
    try{if(observation?.chainId)upstreamChainId=Number(BigInt(observation.chainId));}catch{}
    const port=8545,url='http://127.0.0.1:8545';
    const executable=path.resolve(process.cwd(),'node_modules/@foundry-rs/anvil/bin.mjs');
    const args=[executable,'--host','127.0.0.1','--port',String(port),'--chain-id','1','--hardfork',String(evmVersion||'cancun').toLowerCase(),'--fork-url',identityProxy.url,'--accounts','20','--mnemonic',ephemeralMnemonic,'--auto-impersonate','--no-rate-limit','--silent'];
    const child=spawn(process.execPath,args,{cwd:projectRoot,env:process.env,stdio:['ignore','ignore','pipe']});
    let stderr='';child.stderr?.on('data',x=>{stderr=(stderr+String(x)).slice(-8000);});
    const started=Date.now();
    while(Date.now()-started<30000){
      if(child.exitCode!==null)throw new Error(`Anvil exited before readiness: ${stderr}`);
      try{if(await rpc(url,'eth_chainId',[]))break;}catch{}
      await sleep(100);
    }
    if(Date.now()-started>=30000){child.kill('SIGKILL');throw new Error('Anvil RPC readiness timeout');}
    const accounts=await rpc(url,'eth_accounts',[]);
    const account0=String(accounts?.[0]??'').toLowerCase();
    if(account0!==ephemeralWallet.address.toLowerCase()){
      child.kill('SIGKILL');
      const e=new Error(`Ephemeral Anvil signer mismatch: rpc=${account0} derived=${ephemeralWallet.address.toLowerCase()}`);
      e.code='ANVIL_EPHEMERAL_SIGNER_MISMATCH';throw e;
    }
    return{
      url,upstreamChainId,identityNormalized:true,child,
      localSigner:{address:account0,privateKey:ephemeralWallet.privateKey},
      async close(){
        if(child.exitCode===null){
          child.kill('SIGTERM');
          await Promise.race([new Promise(r=>child.once('exit',r)),sleep(2000)]);
          if(child.exitCode===null)child.kill('SIGKILL');
        }
        await identityProxy.close().catch(()=>{});
      }
    };
  }catch(error){
    if(identityProxy)await identityProxy.close().catch(()=>{});
    throw error;
  }
}
// Medusa fuzzes a network-free copy of the post-deployment fork: the full Anvil state (deployed contracts plus every
// mainnet account/slot already fetched during deployment) is loaded into a plain local node, so deep coverage-seeking
// calls never wait on the upstream archive RPC. Unfetched mainnet state reads as empty on this copy.
export async function startStateSnapshotAnvilV1({sourceUrl,projectRoot,evmVersion='cancun',port=8546}){
  // anvil_dumpState returns gzip-compressed state JSON as hex; real fork states are too large for anvil_loadState
  // over RPC, so the decoded JSON is handed to the new node's --load-state at startup.
  const state=await rpc(sourceUrl,'anvil_dumpState',[]);
  const head=await rpc(sourceUrl,'eth_getBlockByNumber',['latest',false]);
  const raw=Buffer.from(String(state).replace(/^0x/,''),'hex');
  let stateJson;try{stateJson=zlib.gunzipSync(raw);}catch{stateJson=raw;}
  const statePath=path.join(os.tmpdir(),`phase0-medusa-state-${process.pid}-${port}.json`);
  await fs.writeFile(statePath,stateJson);
  const url=`http://127.0.0.1:${port}`;
  const executable=path.resolve(process.cwd(),'node_modules/@foundry-rs/anvil/bin.mjs');
  const args=[executable,'--host','127.0.0.1','--port',String(port),'--chain-id','1','--hardfork',String(evmVersion||'cancun').toLowerCase(),'--load-state',statePath,'--auto-impersonate','--silent'];
  // Own process group: the npm anvil entry point is a node wrapper around the native binary, so signal the group.
  const child=spawn(process.execPath,args,{cwd:projectRoot,env:process.env,stdio:['ignore','ignore','pipe'],detached:true});
  let stderr='';child.stderr?.on('data',x=>{stderr=(stderr+String(x)).slice(-8000);});
  const signalGroup=sig=>{try{process.kill(-child.pid,sig);}catch{}};
  const close=async()=>{signalGroup('SIGTERM');if(child.exitCode===null)await Promise.race([new Promise(r=>child.once('exit',r)),sleep(2000)]);signalGroup('SIGKILL');};
  try{
    const started=Date.now();
    while(true){
      if(child.exitCode!==null)throw new Error(`Snapshot Anvil exited before readiness: ${stderr}`);
      try{if(await rpc(url,'eth_chainId',[]))break;}catch{}
      if(Date.now()-started>30000)throw new Error('Snapshot Anvil RPC readiness timeout');
      await sleep(100);
    }
    const blockNumber=Number(BigInt(await rpc(url,'eth_blockNumber',[])));
    if(blockNumber!==Number(BigInt(head.number)))throw new Error(`Snapshot Anvil block ${blockNumber} does not match source block ${Number(BigInt(head.number))}`);
    return{url,blockNumber,stateBytes:stateJson.length,sourceBlock:Number(BigInt(head.number)),close};
  }catch(error){await close();throw error;}
  finally{await fs.rm(statePath,{force:true}).catch(()=>{});}
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
async function installPackageRuntimeDependenciesV1(projectRoot){
  const pkgPath=path.join(projectRoot,'package.json');
  const lockPath=path.join(projectRoot,'package-lock.json');
  const pkgStat=await fs.stat(pkgPath).catch(()=>null);
  if(!pkgStat)return{status:'NOT_APPLICABLE',manager:null,reason:'NO_PACKAGE_JSON'};
  const lockStat=await fs.stat(lockPath).catch(()=>null);
  if(!lockStat)return{status:'BLOCKED',manager:'npm',reason:'PACKAGE_LOCK_REQUIRED_FOR_SIMULATION_TESTING'};
  const r=await runProcess({
    command:'timeout',
    args:['240s','npm','ci','--ignore-scripts','--audit=false','--fund=false'],
    cwd:projectRoot,
    env:scrubbedEnv()
  });
  if(r.exitCode!==0){
    const e=new Error(`Locked package dependency install failed: ${String(r.stderr||r.stdout||'').slice(-3000)}`);
    e.code='SIMULATION_TESTING_PACKAGE_DEPENDENCY_INSTALL_FAILED';
    e.install={manager:'npm',exitCode:r.exitCode,stdout:String(r.stdout??'').slice(-12000),stderr:String(r.stderr??'').slice(-12000)};
    throw e;
  }
  return{status:'PASS',manager:'npm',lockfile:'package-lock.json',ignoreScripts:true,exitCode:r.exitCode};
}
export async function detectDeploymentScripts(projectRoot){
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
    for(const [name,cmd0] of Object.entries(pkg.scripts??{})){
      const cmd=String(cmd0);
      if(!DEPLOY_SCRIPT_RE.test(name)||cmd.includes('hardhat'))continue;
      if(/dry[-_ ]?run/i.test(name)||/(?:^|\s)--dry-run(?:\s|$)/i.test(cmd)){
        genericPackageScripts.push({name,command:cmd,safe:false,reason:'Dry-run package script is not an executable deployment path.'});
        continue;
      }
      const nodeMatch=cmd.match(/^\s*node\s+([^\s]+)([\s\S]*)$/);
      if(!nodeMatch){genericPackageScripts.push({name,command:cmd,safe:false,reason:'Package deployment command is not a directly resolvable local Node entrypoint.'});continue;}
      const entry=nodeMatch[1].replace(/^["']|["']$/g,'');
      const normalized=path.posix.normalize(entry.replaceAll('\\\\','/'));
      if(normalized==='..'||normalized.startsWith('../')||path.isAbsolute(entry)){
        genericPackageScripts.push({name,command:cmd,safe:false,reason:'Package deployment entrypoint escapes the staged project root.'});continue;
      }
      const absolute=path.join(projectRoot,...normalized.split('/'));
      let source='';
      try{source=await fs.readFile(absolute,'utf8');}catch{
        genericPackageScripts.push({name,command:cmd,entry:normalized,safe:false,reason:'Package deployment entrypoint could not be read.'});continue;
      }
      const rpcEnv=/process\.env\.(?:RPC_URL|ETH_RPC_URL|LOCALHOST_RPC_URL)\b/.test(source);
      const keyEnv=/process\.env\.(?:DEPLOYER_PRIVATE_KEY|PRIVATE_KEY|BASE_DEPLOYER_PRIVATE_KEY)\b/.test(source);
      genericPackageScripts.push({
        name,command:cmd,entry:normalized,argsText:String(nodeMatch[2]??'').trim(),safe:rpcEnv,
        consumesRpcOverride:rpcEnv,consumesPrivateKey:keyEnv,
        reason:rpcEnv?null:'Package deployment entrypoint does not mechanically consume a local RPC override.'
      });
    }
  }catch{}
  return{foundry,hardhat,unsafeHardhat,genericPackageScripts};
}
export function canonicalEthereumExecutionOverrides(source){
  const text=String(source??''),env={};
  const adaptations=[];
  const MAINNET_WETH='0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
  const PERMIT2='0x000000000022D473030F116dDEE9F6B43aC78BA3';
  const networkEnvRe=/networkAddress\s*\(\s*network\s*,\s*["']([^"']+)["']\s*,\s*["']([^"']+)["']\s*\)/g;
  for(const match of text.matchAll(networkEnvRe)){
    const key=match[1],envName=match[2];
    if(key==='weth'){env[envName]=MAINNET_WETH;adaptations.push({type:'CANONICAL_ETHEREUM_WETH',env:envName,value:MAINNET_WETH});}
    else if(key==='permit2'){env[envName]=PERMIT2;adaptations.push({type:'CANONICAL_ETHEREUM_PERMIT2',env:envName,value:PERMIT2});}
    else if(key==='defaultPayoutToken'){
      env[envName]=MAINNET_WETH;
      adaptations.push({type:'CANONICAL_ETHEREUM_ERC20_PAYOUT_SUBSTITUTE',env:envName,value:MAINNET_WETH,basis:'LOCAL_SIMULATION_REQUIRES_ERC20_CODE_ON_ETHEREUM_FORK'});
    }
  }
  // Match the environment key consumed by the package, rather than its local variable name.
  for(const [names,value,type] of [
    [['MAX_FEE_PER_GAS_WEI','MAX_FEE_PER_GAS'],'1000000000000','LOCAL_SIMULATION_GAS_CAP'],
    [['MAX_PRIORITY_FEE_PER_GAS_WEI','MAX_PRIORITY_FEE_PER_GAS'],'1000000000','LOCAL_SIMULATION_PRIORITY_FEE']
  ]){
    for(const name of names){
      const consumedKeys=[...text.matchAll(/(?:envBigInt|envInt|envNumber)\s*\(\s*["']([^"']+)["']|process\.env\.([A-Z_]+)\b/g)].map(match=>match[1]??match[2]);
      if(consumedKeys.includes(name)){env[name]=value;adaptations.push({type,env:name,value});}
    }
  }
  return{env,adaptations};
}
async function runDeploymentScriptV1(options){
  const startedAt=Date.now();
  console.log('[phase0-deployment] native script started; timeout=900s; heartbeat every 300s');
  const heartbeat=setInterval(()=>console.log(`[phase0-deployment] native script still running; elapsed=${Math.floor((Date.now()-startedAt)/1000)}s`),300000);
  heartbeat.unref?.();
  try{
    const result=await runProcess(options);
    console.log(`[phase0-deployment] native script exited; elapsed=${Math.floor((Date.now()-startedAt)/1000)}s; exitCode=${result.exitCode}`);
    return result;
  }finally{clearInterval(heartbeat);}
}
export async function executeDeploymentScripts({projectRoot,anvilUrl,account0,localSigner,detected}){
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
    const r=await runDeploymentScriptV1({command:'timeout',args:['900s','forge',...args],cwd:projectRoot,env:scrubbedEnv({ETH_RPC_URL:anvilUrl})});
    const after=Number(BigInt(await rpc(anvilUrl,'eth_blockNumber',[])));
    attempts.push({framework:'FOUNDRY',path:item.path,entry:item.entry,command:['forge',...args].join(' '),exitCode:r.exitCode,status:r.exitCode===0?'PASS':'FAILED',blockRange:[before+1,after],stdout:String(r.stdout??'').slice(-12000),stderr:String(r.stderr??'').slice(-12000)});
  }
  for(const item of detected.unsafeHardhat??[]) limitations.push({type:'DEPLOYMENT_SCRIPT_NOT_SAFELY_REDIRECTABLE',framework:'HARDHAT',path:item.path,reason:item.reason});
  for(const item of detected.hardhat){
    const before=Number(BigInt(await rpc(anvilUrl,'eth_blockNumber',[])));
    const r=await runDeploymentScriptV1({command:'timeout',args:['900s','npx','hardhat','run',item.path,'--network','localhost'],cwd:projectRoot,env:scrubbedEnv({ETH_RPC_URL:anvilUrl,RPC_URL:anvilUrl,LOCALHOST_RPC_URL:anvilUrl,HARDHAT_NETWORK:'localhost'})});
    const after=Number(BigInt(await rpc(anvilUrl,'eth_blockNumber',[])));
    attempts.push({framework:'HARDHAT',path:item.path,entry:item.entry,command:`npx hardhat run ${item.path} --network localhost`,exitCode:r.exitCode,status:r.exitCode===0?'PASS':'FAILED',blockRange:[before+1,after],stdout:String(r.stdout??'').slice(-12000),stderr:String(r.stderr??'').slice(-12000)});
  }
  for(const item of detected.genericPackageScripts){
    if(!item.safe){
      limitations.push({type:'DEPLOYMENT_SCRIPT_NOT_SAFELY_REDIRECTABLE',framework:'GENERIC_NODE',script:item.name,command:item.command,reason:item.reason});
      continue;
    }
    if(!localSigner?.privateKey||String(account0).toLowerCase()!==String(localSigner.address??'').toLowerCase()){
      limitations.push({type:'ANVIL_LOCAL_SIGNER_IDENTITY_MISMATCH',framework:'GENERIC_NODE',script:item.name,observedAccount0:account0,expectedAccount0:localSigner?.address??null});
      continue;
    }
    const sourcePath=path.join(projectRoot,...item.entry.split('/'));
    const originalBytes=await fs.readFile(sourcePath);
    const originalSha256=sha256(originalBytes);
    let source=originalBytes.toString('utf8');
    const adaptedRel=path.posix.join(path.posix.dirname(item.entry),'.phase0-anvil-'+path.posix.basename(item.entry));
    const adaptedPath=path.join(projectRoot,...adaptedRel.split('/'));
    let adaptation='NONE';
    if(/\bconst\s+network\s*=\s*resolveNetwork\(NETWORK_NAME\)\s*;/.test(source)){
      source=source.replace(
        /\bconst\s+network\s*=\s*resolveNetwork\(NETWORK_NAME\)\s*;/,
        'const network = { ...resolveNetwork(NETWORK_NAME), chainId: Number(process.env.PHASE0_LOCAL_CHAIN_ID || 1) };'
      );
      adaptation='LOCAL_CHAIN_ID_OVERRIDE';
    }else if(/\blet\s+network\s*=\s*resolveNetwork\(NETWORK_NAME\)\s*;/.test(source)){
      source=source.replace(
        /\blet\s+network\s*=\s*resolveNetwork\(NETWORK_NAME\)\s*;/,
        'let network = { ...resolveNetwork(NETWORK_NAME), chainId: Number(process.env.PHASE0_LOCAL_CHAIN_ID || 1) };'
      );
      adaptation='LOCAL_CHAIN_ID_OVERRIDE';
    }else if(/\bnetwork\.chainId\b/.test(source)){
      limitations.push({type:'DEPLOYMENT_SCRIPT_CHAIN_ID_ADAPTER_UNSUPPORTED',framework:'GENERIC_NODE',script:item.name,path:item.entry,reason:'Entrypoint consumes network.chainId but the resolved-network assignment is not in an admitted mechanical form.'});
      continue;
    }
    await fs.writeFile(adaptedPath,source);
    const adaptedBytes=Buffer.from(source),adaptedSha256=sha256(adaptedBytes);
    const before=Number(BigInt(await rpc(anvilUrl,'eth_blockNumber',[])));
    const executionOverrides=canonicalEthereumExecutionOverrides(source);
    const env=scrubbedEnv({
      RPC_URL:anvilUrl,ETH_RPC_URL:anvilUrl,LOCALHOST_RPC_URL:anvilUrl,
      PHASE0_LOCAL_CHAIN_ID:'1',
      DEPLOYER_PRIVATE_KEY:localSigner.privateKey,
      PRIVATE_KEY:localSigner.privateKey,
      BASE_DEPLOYER_PRIVATE_KEY:localSigner.privateKey,
      ...executionOverrides.env
    });
    const nodePermissionArgs=['--permission',`--allow-fs-read=${projectRoot}`,`--allow-fs-write=${projectRoot}`];
    const args=['900s',process.execPath,...nodePermissionArgs,adaptedRel];
    if(item.argsText)args.push(...item.argsText.split(/\s+/).filter(Boolean));
    const r=await runDeploymentScriptV1({command:'timeout',args,cwd:projectRoot,env});
    const after=Number(BigInt(await rpc(anvilUrl,'eth_blockNumber',[])));
    const retainedStdout=redactExecutionSecretsV2(String(r.stdout??''),executionSecretValuesV2(env,[localSigner.privateKey]));
    const retainedStderr=redactExecutionSecretsV2(String(r.stderr??''),executionSecretValuesV2(env,[localSigner.privateKey]));
    attempts.push({
      framework:'GENERIC_NODE',script:item.name,path:item.entry,adaptedPath:adaptedRel,
      originalSha256,adaptedSha256,adaptedContentChanged:originalSha256!==adaptedSha256,
      adaptation,executionOverrides:executionOverrides.adaptations,localChainId:1,localSigner:localSigner.address,
      sandbox:{filesystem:'NODE_PERMISSION_PROJECT_ROOT_READ_WRITE_ONLY',childProcess:'DENIED_BY_DEFAULT',worker:'DENIED_BY_DEFAULT',network:'ENVIRONMENT_SECRET_ISOLATION_ONLY',productionHandoffEligible:false},
      command:[process.execPath,...nodePermissionArgs,adaptedRel,...args.slice(6)].join(' '),
      exitCode:r.exitCode,status:r.exitCode===0?'PASS':'FAILED',blockRange:[before+1,after],
      stdout:retainedStdout.slice(-24000),stderr:retainedStderr.slice(-24000)
    });
  }
  const detectedRows=[
    ...(detected.foundry??[]),
    ...(detected.hardhat??[]),
    ...(detected.unsafeHardhat??[]),
    ...(detected.genericPackageScripts??[]).map(x=>({...x,framework:'GENERIC_NODE',script:x.name}))
  ];
  const scriptDispositions=detectedRows.map(item=>{
    const key=deploymentScriptKeyV2(item);
    const attempt=attempts.find(x=>deploymentScriptKeyV2(x)===key);
    const gap=limitations.find(x=>deploymentScriptKeyV2(x)===key);
    return{
      scriptKey:key,framework:item.framework,path:item.path??item.entry??null,script:item.script??item.name??null,
      disposition:attempt?(attempt.status==='PASS'?'EXECUTED_PASS':'EXECUTED_FAILED'):(gap?'UNSUPPORTED_WITH_TYPED_GAP':'UNRESOLVED_DISPOSITION'),
      attemptStatus:attempt?.status??null,gapType:gap?.type??null,gapReason:gap?.reason??null
    };
  });
  if(scriptDispositions.some(x=>x.disposition==='UNRESOLVED_DISPOSITION')){
    limitations.push({type:'DEPLOYMENT_SCRIPT_DISPOSITION_INCOMPLETE',scripts:scriptDispositions.filter(x=>x.disposition==='UNRESOLVED_DISPOSITION').map(x=>x.scriptKey)});
  }
  return{attempts,limitations,scriptDispositions,status:attempts.some(x=>x.status==='PASS')?'PASS':(attempts.length?'COMPLETE_WITH_FAILURES':'NO_SAFE_SCRIPT_ADAPTER')};
}
async function reportedPackageDeployments({projectRoot,attempts,artifacts}){
  const rows=[],limitations=[],seen=new Set();
  const artifactByName=new Map();
  for(const artifact of artifacts??[]){
    const list=artifactByName.get(artifact.contractName)??[];
    list.push(artifact);artifactByName.set(artifact.contractName,list);
  }
  for(const attempt of attempts??[]){
    if(attempt.framework!=='GENERIC_NODE'||attempt.status!=='PASS')continue;
    const text=`${attempt.stdout??''}\n${attempt.stderr??''}`;
    const candidates=[];
    for(const match of text.matchAll(/(?:^|\n)\s*(?:Report|Deployment report|Report written)\s*:\s*(.+?\.json)\s*(?:\n|$)/gi))candidates.push(match[1].trim());
    for(const raw of candidates){
      const absolute=path.isAbsolute(raw)?path.normalize(raw):path.resolve(projectRoot,raw);
      const relative=path.relative(projectRoot,absolute);
      if(relative.startsWith('..')||path.isAbsolute(relative)){
        limitations.push({type:'PACKAGE_DEPLOYMENT_REPORT_OUTSIDE_PROJECT',script:attempt.script,reportedPath:raw});
        continue;
      }
      let report;
      try{report=JSON.parse(await fs.readFile(absolute,'utf8'));}catch(error){
        limitations.push({type:'PACKAGE_DEPLOYMENT_REPORT_UNREADABLE',script:attempt.script,reportedPath:relative,message:String(error?.message??error).slice(0,800)});
        continue;
      }
      const deployments=report?.deployments;
      if(!deployments||typeof deployments!=='object'||Array.isArray(deployments)){
        limitations.push({type:'PACKAGE_DEPLOYMENT_REPORT_UNSUPPORTED_SHAPE',script:attempt.script,reportedPath:relative});
        continue;
      }
      for(const [contractName,entry] of Object.entries(deployments)){
        const address=entry?.address;
        if(typeof address!=='string'||!/^0x[a-fA-F0-9]{40}$/.test(address))continue;
        const sourceName=typeof entry?.sourceName==='string'?entry.sourceName:null;
        const matches=(artifactByName.get(contractName)??[]).filter(a=>!sourceName||a.sourceName===sourceName);
        const artifact=matches.length===1?matches[0]:null;
        const key=address.toLowerCase();if(seen.has(key))continue;seen.add(key);
        rows.push({
          address,
          transactionHash:entry?.transactionHash??null,
          blockNumber:null,
          qualifiedName:artifact?`${artifact.sourceName}:${artifact.contractName}`:null,
          contractName:artifact?.contractName??contractName,
          sourceName:artifact?.sourceName??sourceName,
          mappingStatus:artifact?'PACKAGE_DEPLOYMENT_REPORT':'PACKAGE_DEPLOYMENT_REPORT_UNMAPPED_ARTIFACT',
          deploymentReportRef:relative
        });
      }
    }
  }
  return{rows,limitations};
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
function canonicalAbiParam(param={}){
  const next={...param},originalType=String(param.type??''),internalType=String(param.internalType??'');
  const arraySuffix=originalType.match(/(?:\[[0-9]*\])+$/)?.[0]??'';
  const baseType=arraySuffix?originalType.slice(0,-arraySuffix.length):originalType;
  const internalBase=internalType.replace(/(?:\[[0-9]*\])+$/,'');
  if(internalBase.startsWith('enum ')&&!/^u?int(?:[0-9]+)?$/.test(baseType)) next.type=`uint8${arraySuffix}`;
  else if((internalBase.startsWith('contract ')||internalBase.startsWith('interface '))&&baseType!=='address') next.type=`address${arraySuffix}`;
  else if(internalBase.startsWith('struct ')&&baseType!=='tuple') next.type=`tuple${arraySuffix}`;
  if(Array.isArray(param.components))next.components=param.components.map(canonicalAbiParam);
  return next;
}
function canonicalAbiFragment(fragment){
  if(!fragment||typeof fragment!=='object')return fragment;
  const next={...fragment};
  if(Array.isArray(fragment.inputs))next.inputs=fragment.inputs.map(canonicalAbiParam);
  if(Array.isArray(fragment.outputs))next.outputs=fragment.outputs.map(canonicalAbiParam);
  return next;
}
function normalizedAbi(abi){
  let rows=[];
  if(Array.isArray(abi)) rows=abi;
  else if(Array.isArray(abi?.abi)) rows=abi.abi;
  else if(abi&&typeof abi==='object'){
    const values=Object.values(abi);
    if(values.length&&values.every(x=>x&&typeof x==='object'&&typeof x.type==='string')) rows=values;
  }
  return rows.map(canonicalAbiFragment);
}
function constructorInputs(abi){return normalizedAbi(abi).find(x=>x.type==='constructor')?.inputs??[];}
function mutableFunctions(ethers,a){
  const iface=new ethers.Interface(normalizedAbi(a.abi));
  return iface.fragments.filter(x=>x.type==='function'&&!['view','pure'].includes(x.stateMutability)&&x.name).map(f=>({fragment:f,signature:f.format('sighash'),accounting:ACCOUNTING_MUTATION_RE.test(f.name)}));
}
function deployableZeroArg(a){return a?.bytecode&&a.bytecode!=='0x'&&!String(a.bytecode).includes('__$')&&constructorInputs(a.abi).length===0;}
async function fallbackDeploy({provider,ethers,artifacts,existing}){
  const existingQualified=new Set(existing.filter(x=>x.qualifiedName).map(x=>x.qualifiedName));
  const signer=await provider.getSigner(0),rows=[],limitations=[];
  const ranked=artifacts.filter(deployableZeroArg).filter(a=>!existingQualified.has(`${a.sourceName}:${a.contractName}`)).map(a=>({a,score:mutableFunctions(ethers,a).length+(ACCOUNTING_MUTATION_RE.test(a.contractName)?20:0)})).filter(x=>x.score>0).sort((x,y)=>y.score-x.score||(`${x.a.sourceName}:${x.a.contractName}`).localeCompare(`${y.a.sourceName}:${y.a.contractName}`));
  for(const {a} of ranked){
    try{
      const f=new ethers.ContractFactory(normalizedAbi(a.abi),a.bytecode,signer),c=await f.deploy();await c.waitForDeployment();const receipt=await c.deploymentTransaction().wait();
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
  const chosenAddresses=ctx.chosenAddresses??(ctx.chosenAddresses=[]);
  if(String(param?.type??'')==='address'&&ctx.valuePool){
    const address=chooseFixtureAddressV1({rng,valuePool:ctx.valuePool,actors:ctx.actors,targets:ctx.targets,chosenAddresses});
    if(address){recordChosenAddressesV1(address,chosenAddresses);return address;}
  }
  if(ctx.valuePool&&/^uint(?:\d+)?$/.test(String(param?.type??''))&&rng()<0.75){
    const amount=chooseFixtureAmountV1({rng,param,valuePool:ctx.valuePool,chosenAddresses});
    if(amount!==null)return amount;
  }
  const generated=generateTypedValueV2(param,rng,{
    addresses:ctx.valuePool
      ? weightedFixtureAddressSeedV1({valuePool:ctx.valuePool,actors:ctx.actors,targets:ctx.targets,chosenAddresses})
      : [...(ctx.actors??[]),...(ctx.targets??[])],
    limits:{maxDynamicArrayLength:3,maxDepth:8,maxTotalElements:96,maxDynamicBytes:32,maxStringBytes:64}
  });
  if(generated.limitation){
    const error=new Error(generated.limitation.detail??generated.limitation.code??'ABI argument generation limitation');
    error.code=generated.limitation.code??'ABI_ARGUMENT_GENERATION_LIMITATION';
    error.limitation=generated.limitation;
    throw error;
  }
  recordChosenAddressesV1(generated.value,chosenAddresses);
  return generated.value;
}
function simpleView(f){return (f.outputs??[]).length>0&&(f.outputs??[]).every(x=>/^(?:u?int\d*|address|bool|bytes\d*|string)$/.test(x.type));}
function probePlan(ethers,abi){
  const iface=new ethers.Interface(normalizedAbi(abi)),zero=[],address=[],addressPair=[];
  for(const f of iface.fragments.filter(x=>x.type==='function'&&['view','pure'].includes(x.stateMutability)&&simpleView(x))){
    const signature=f.format('sighash');
    const admitted=ACCOUNTING_VIEW_RE.test(f.name)||['totalSupply()','totalAssets()','asset()','balanceOf(address)','allowance(address,address)'].includes(signature);
    if(!admitted)continue;
    if(f.inputs.length===0&&zero.length<18)zero.push(f);
    else if(f.inputs.length===1&&f.inputs[0].type==='address'&&address.length<10)address.push(f);
    else if(f.inputs.length===2&&f.inputs.every(x=>x.type==='address')&&addressPair.length<6)addressPair.push(f);
  }
  return{zero,address,addressPair};
}
async function safeStatic(contract,f,args){try{return{ok:true,value:normalize(await contract.getFunction(f.format('sighash')).staticCall(...args))};}catch(e){return{ok:false,error:String(e?.shortMessage??e?.message??e).slice(0,800)};}}
export async function snapshot({provider,ethers,target,sender,plan,systemTargets}){
  const out={native:{},views:{},systemNative:{},related:{}};
  const c=new ethers.Contract(target.address,normalizedAbi(target.artifact.abi),provider);
  const relatedAddresses=[...new Set([target.recipeRuntime?.assetAddress,target.recipeRuntime?.tokenAddress].filter(x=>/^0x[0-9a-fA-F]{40}$/.test(String(x))))];
  const erc20ViewAbi=[
    'function balanceOf(address) view returns (uint256)',
    'function allowance(address,address) view returns (uint256)',
    'function totalSupply() view returns (uint256)'
  ];
  // These reads share one stable pre/post state; batching preserves all observations without serial RPC latency.
  await Promise.all([
    (async()=>{out.native.sender=(await provider.getBalance(sender)).toString();})(),
    (async()=>{out.native.target=(await provider.getBalance(target.address)).toString();})(),
    ...systemTargets.map(async t=>{out.systemNative[t.address]=(await provider.getBalance(t.address)).toString();}),
    ...plan.zero.map(async f=>{out.views[f.format('sighash')]=await safeStatic(c,f,[]);}),
    ...plan.address.flatMap(f=>{const sig=f.format('sighash');return[
      (async()=>{out.views[`${sig}::sender`]=await safeStatic(c,f,[sender]);})(),
      (async()=>{out.views[`${sig}::target`]=await safeStatic(c,f,[target.address]);})()
    ];}),
    ...(plan.addressPair??[]).map(async f=>{const sig=f.format('sighash');out.views[`${sig}::sender::target`]=await safeStatic(c,f,[sender,target.address]);}),
    ...relatedAddresses.map(async address=>{
      const token=new ethers.Contract(address,erc20ViewAbi,provider),key=address.toLowerCase();
      const read=async(fn,args=[])=>{try{return{ok:true,value:normalize(await token.getFunction(fn).staticCall(...args))};}catch(error){return{ok:false,error:String(error?.shortMessage??error?.message??error).slice(0,800)};}};
      out.related[key]={
        address,
        balanceSender:await read('balanceOf(address)',[sender]),
        balanceTarget:await read('balanceOf(address)',[target.address]),
        allowanceSenderTarget:await read('allowance(address,address)',[sender,target.address]),
        totalSupply:await read('totalSupply()',[])
      };
    })
  ]);
  return out;
}
export function verifyBaselineResetV2({reverted,expectedDigestSha256,observedDigestSha256}){
  if(reverted!==true){const error=new Error('Phase-0 telemetry baseline snapshot revert failed or expired');error.code='PHASE0_BASELINE_REVERT_FAILED';throw error;}
  if(!expectedDigestSha256||observedDigestSha256!==expectedDigestSha256){const error=new Error('Phase-0 telemetry baseline sentinel changed after evm_revert');error.code='PHASE0_BASELINE_SENTINEL_MISMATCH';error.expected=expectedDigestSha256??null;error.observed=observedDigestSha256??null;throw error;}
  return{status:'PASS',revertAccepted:true,sentinelMatch:true,expectedDigestSha256,observedDigestSha256};
}
export async function baselineSentinelV2({provider,ethers,targets,actors}){
  const blockNumber=Number(await provider.getBlockNumber());
  const block=await provider.getBlock(blockNumber);
  const actor=actors[0];
  const states=[];
  for(const target of targets){
    states.push({
      logicalQualifiedName:target.logicalQualifiedName??target.qualifiedName,
      address:target.address,
      contextType:target.contextType??'DIRECT',
      codeSha256:sha256(Buffer.from(String(await provider.getCode(target.address)).replace(/^0x/,''),'hex')),
      observations:await snapshot({provider,ethers,target,sender:actor,plan:target.plan,systemTargets:targets})
    });
  }
  const body={blockNumber,blockHash:block?.hash??null,states:normalize(states)};
  return{...body,digestSha256:sha256(Buffer.from(JSON.stringify(body)))};
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
function sourceDeclaredStandardsV2(sourceIntelligence,qualifiedName){
  const contracts=sourceIntelligence?.contracts??[],edges=sourceIntelligence?.inheritanceGraph??[];
  const byId=new Map(contracts.map(c=>[c.contractId,c]));
  const root=contracts.find(c=>c.qualifiedName===qualifiedName);
  if(!root)return[];
  const seen=new Set([root.contractId]),queue=[root.contractId],names=[];
  while(queue.length){
    const id=queue.shift(),c=byId.get(id);
    if(c?.qualifiedName)names.push(String(c.qualifiedName).split(':').at(-1));
    for(const edge of edges.filter(e=>e.derivedContractId===id)){
      if(!seen.has(edge.baseContractId)){seen.add(edge.baseContractId);queue.push(edge.baseContractId);}
    }
  }
  const normalized=new Set(names.map(x=>x.toUpperCase().replace(/[^A-Z0-9]/g,'')));
  const out=[];
  if(normalized.has('IERC20')||normalized.has('ERC20'))out.push('ERC20');
  if(normalized.has('IERC4626')||normalized.has('ERC4626'))out.push('ERC4626');
  if(normalized.has('IERC3156FLASHLENDER')||normalized.has('ERC3156FLASHLENDER'))out.push('ERC3156FLASHLENDER');
  return out;
}
export function targetObjects(ethers,artifacts,deployed,sourceIntelligence={}){
  const byQ=new Map(artifacts.map(a=>[`${a.sourceName}:${a.contractName}`,a]));
  return deployed.filter(d=>d.qualifiedName&&byQ.has(d.qualifiedName)).map(d=>{
    const artifact=byQ.get(d.qualifiedName);
    const declaredStandards=sourceDeclaredStandardsV2(sourceIntelligence,d.qualifiedName);
    const recipe=qualifyRecipeV2({qualifiedName:d.qualifiedName,abi:artifact.abi,declaredStandards});
    const functions=mutableFunctions(ethers,artifact).map(x=>{
      const semantic=classifySemanticFamilyV2({signature:x.signature,stateMutability:x.fragment.stateMutability,recipe:recipe.status==='QUALIFIED'?recipe:null});
      return{...x,accounting:semantic.semanticFamily==='ECONOMIC',semanticFamily:semantic.semanticFamily,semanticBasis:semantic.basis};
    });
    return{...d,artifact,functions,plan:probePlan(ethers,artifact),declaredStandards,recipe};
  }).filter(t=>t.functions.length);
}
const EIP1967_IMPLEMENTATION_SLOT_V2='0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';

function associationValuesV2(value){
  if(value instanceof Set)return [...value];
  if(Array.isArray(value))return value;
  return[];
}
function associationHoldsV2(associations,holder,callee){
  const h=String(holder??'').toLowerCase(),c=String(callee??'').toLowerCase();
  for(const [key,value] of Object.entries(associations??{})){
    if(String(key).toLowerCase()!==h)continue;
    return associationValuesV2(value).some(row=>String(row).toLowerCase()===c);
  }
  return false;
}
function zeroAbiValueV2(ethers,param){
  if(param?.baseType==='array'){
    if(Number.isInteger(param.arrayLength)&&param.arrayLength>=0)return Array.from({length:param.arrayLength},()=>zeroAbiValueV2(ethers,param.arrayChildren));
    return[];
  }
  if(param?.baseType==='tuple')return (param.components??[]).map(child=>zeroAbiValueV2(ethers,child));
  const type=String(param?.type??'');
  if(type==='address')return ethers.ZeroAddress;
  if(type==='bool')return false;
  if(type==='string')return '';
  if(type==='bytes')return '0x';
  if(/^bytes\d+$/.test(type))return ethers.zeroPadValue('0x',Number(type.slice(5)));
  if(/^u?int(?:\d+)?$/.test(type))return 0n;
  return 0;
}
function mutableFunctionsForArtifactV2({ethers,artifact,qualifiedName,sourceIntelligence={}}){
  const declaredStandards=sourceDeclaredStandardsV2(sourceIntelligence,qualifiedName);
  const recipe=qualifyRecipeV2({qualifiedName,abi:artifact.abi,declaredStandards});
  const functions=mutableFunctions(ethers,artifact).map(x=>{
    const semantic=classifySemanticFamilyV2({signature:x.signature,stateMutability:x.fragment.stateMutability,recipe:recipe.status==='QUALIFIED'?recipe:null});
    return{...x,accounting:semantic.semanticFamily==='ECONOMIC',semanticFamily:semantic.semanticFamily,semanticBasis:semantic.basis};
  });
  return{declaredStandards,recipe,functions};
}
function decodedErrorMatchesInterfaceV2(iface,error){
  const data=error?.data??error?.info?.error?.data??null;
  if(typeof data!=='string'||data==='0x')return false;
  try{return Boolean(iface.parseError(data));}catch{return false;}
}
async function facadeAnswersSelectorV2({provider,ethers,facadeAddress,implArtifact,selected,from}){
  let iface;
  try{iface=new ethers.Interface(normalizedAbi(implArtifact.abi));}catch{return false;}
  let data;
  try{data=iface.encodeFunctionData(selected.signature,(selected.fragment.inputs??[]).map(param=>zeroAbiValueV2(ethers,param)));}catch{return false;}
  try{
    await provider.call({from,to:facadeAddress,data,value:0n});
    return true;
  }catch(error){
    return decodedErrorMatchesInterfaceV2(iface,error);
  }
}
async function eip1967ImplementationAddressV2({provider,ethers,address}){
  try{
    const word=await provider.send('eth_getStorageAt',[address,EIP1967_IMPLEMENTATION_SLOT_V2,'latest']);
    if(!/^0x[0-9a-fA-F]{64}$/.test(String(word??'')))return null;
    const candidate=ethers.getAddress('0x'+String(word).slice(-40));
    if(candidate===ethers.ZeroAddress)return null;
    const code=await provider.getCode(candidate);
    return code&&code!=='0x'?candidate:null;
  }catch{return null;}
}
export async function augmentDelegateProxyContextsV2({provider,ethers,targets,artifacts,deployed,sourceIntelligence={},associations={},probeSelectors=true}){
  const byQ=new Map(artifacts.map(a=>[`${a.sourceName}:${a.contractName}`,a]));
  const deployedByAddress=new Map(deployed.filter(x=>x?.address).map(x=>[String(x.address).toLowerCase(),x]));
  const targetByAddress=new Map(targets.filter(x=>x?.address).map(x=>[String(x.address).toLowerCase(),x]));
  const out=[...targets],contextEvidence=[];
  const variantKeys=new Set(out.map(target=>`${String(target.address).toLowerCase()}|${target.logicalQualifiedName??target.qualifiedName}|${target.contextType??'DIRECT'}`));
  const asDeployment=address=>deployedByAddress.get(String(address).toLowerCase())??targetByAddress.get(String(address).toLowerCase())??null;
  const addVariant=({facadeDeployment,implDeployment,implArtifact,contextType,basis,evidence={}})=>{
    if(!facadeDeployment?.address||!implDeployment?.qualifiedName||!implArtifact)return false;
    const built=mutableFunctionsForArtifactV2({ethers,artifact:implArtifact,qualifiedName:implDeployment.qualifiedName,sourceIntelligence});
    if(!built.functions.length)return false;
    const key=`${String(facadeDeployment.address).toLowerCase()}|${implDeployment.qualifiedName}|${contextType}`;
    if(variantKeys.has(key))return false;
    variantKeys.add(key);
    out.push({
      ...facadeDeployment,
      qualifiedName:facadeDeployment.qualifiedName??`FACADE:${facadeDeployment.address}`,
      logicalQualifiedName:implDeployment.qualifiedName,
      artifact:implArtifact,
      functions:built.functions,
      plan:probePlan(ethers,implArtifact),
      declaredStandards:built.declaredStandards,recipe:built.recipe,
      contextType,contextDisposition:'READY',
      contextEvidence:{facadeAddress:facadeDeployment.address,implementationAddress:implDeployment.address??null,discoveryBasis:basis,...evidence}
    });
    contextEvidence.push({
      contextType,facadeQualifiedName:facadeDeployment.qualifiedName??null,logicalQualifiedName:implDeployment.qualifiedName,
      status:'READY',facadeAddress:facadeDeployment.address,implementationAddress:implDeployment.address??null,
      discoveryBasis:basis,...evidence
    });
    return true;
  };

  for(const facadeDeployment of deployed){
    const facadeArtifact=facadeDeployment?.qualifiedName?byQ.get(facadeDeployment.qualifiedName):null;
    if(!facadeArtifact)continue;
    let iface;
    try{iface=new ethers.Interface(normalizedAbi(facadeArtifact.abi));}catch{continue;}
    let getter=null;
    for(const candidate of ['implementation()','getImplementation()']){
      try{if(iface.getFunction(candidate)){getter=candidate;break;}}catch{}
    }
    if(!getter)continue;
    let implementationAddress;
    try{
      const c=new ethers.Contract(facadeDeployment.address,normalizedAbi(facadeArtifact.abi),provider);
      implementationAddress=await c.getFunction(getter).staticCall();
    }catch(error){
      contextEvidence.push({contextType:'DELEGATE_PROXY',facadeQualifiedName:facadeDeployment.qualifiedName,status:'CONTEXT_REQUIRED',reason:'IMPLEMENTATION_READ_FAILED',message:String(error?.shortMessage??error?.message??error).slice(0,1200)});
      continue;
    }
    const implDeployment=asDeployment(implementationAddress);
    const implArtifact=implDeployment?.qualifiedName?byQ.get(implDeployment.qualifiedName):null;
    if(!implDeployment||!implArtifact){
      contextEvidence.push({contextType:'DELEGATE_PROXY',facadeQualifiedName:facadeDeployment.qualifiedName,status:'FIXTURE_GAP',implementationAddress:String(implementationAddress),reason:'IMPLEMENTATION_NOT_IN_DEPLOYED_ADMITTED_INVENTORY'});
      continue;
    }
    addVariant({facadeDeployment,implDeployment,implArtifact,contextType:'DELEGATE_PROXY',basis:'IMPLEMENTATION_GETTER',evidence:{implementationGetter:getter}});
  }

  for(const facadeDeployment of deployed){
    if(!facadeDeployment?.address)continue;
    const implementationAddress=await eip1967ImplementationAddressV2({provider,ethers,address:facadeDeployment.address});
    if(!implementationAddress)continue;
    const implDeployment=asDeployment(implementationAddress),implArtifact=implDeployment?.qualifiedName?byQ.get(implDeployment.qualifiedName):null;
    if(!implDeployment||!implArtifact)continue;
    addVariant({facadeDeployment,implDeployment,implArtifact,contextType:'FACADE',basis:'EIP1967_IMPLEMENTATION_SLOT'});
  }

  for(const [holderRaw,value] of Object.entries(associations??{})){
    const facadeDeployment=asDeployment(holderRaw);
    if(!facadeDeployment?.address)continue;
    for(const calleeRaw of associationValuesV2(value)){
      const implDeployment=asDeployment(calleeRaw),implArtifact=implDeployment?.qualifiedName?byQ.get(implDeployment.qualifiedName):null;
      if(!implDeployment||!implArtifact||String(implDeployment.address).toLowerCase()===String(facadeDeployment.address).toLowerCase())continue;
      addVariant({facadeDeployment,implDeployment,implArtifact,contextType:'FACADE',basis:'ASSOCIATION_POINTS_TO_EXTENSION'});
    }
  }

  if(probeSelectors){
    const accounts=await provider.send('eth_accounts',[]).catch(()=>[]);
    const from=accounts[0]??ethers.ZeroAddress;
    let probes=0;
    const directExtensions=targets.filter(target=>(target.contextType??'DIRECT')==='DIRECT');
    for(const extension of directExtensions){
      if(probes>=96)break;
      const implArtifact=extension.artifact,implDeployment=asDeployment(extension.address)??extension;
      if(!implArtifact||!implDeployment?.qualifiedName)continue;
      for(const facade of targets.filter(candidate=>String(candidate.address).toLowerCase()!==String(extension.address).toLowerCase())){
        if(probes>=96)break;
        let facadeIface;
        try{facadeIface=new ethers.Interface(normalizedAbi(facade.artifact?.abi??[]));}catch{continue;}
        const probeFunction=(extension.functions??[]).find(selected=>{
          try{facadeIface.getFunction(selected.signature);return false;}catch{return true;}
        });
        if(!probeFunction)continue;
        probes++;
        const answered=await facadeAnswersSelectorV2({provider,ethers,facadeAddress:facade.address,implArtifact,selected:probeFunction,from});
        if(!answered)continue;
        const added=addVariant({facadeDeployment:facade,implDeployment,implArtifact,contextType:'FACADE',basis:'SELECTOR_ANSWERED_BY_FACADE',evidence:{selectorProbe:probeFunction.signature}});
        if(added)break;
      }
    }
    contextEvidence.push({contextType:'FACADE_DISCOVERY',status:'COMPLETE',discoveryBasis:'SELECTOR_PROBE_BOUNDED',probeCount:probes,probeLimit:96});
  }
  for(const target of out)if(!target.contextType){target.contextType='DIRECT';target.contextDisposition='READY';}
  return{targets:out,contextEvidence};
}
export async function prepareQualifiedRuntimeV2({provider,ethers,targets,actors}){
  const setupReceipts=[];
  const erc20Abi=['function balanceOf(address) view returns (uint256)','function allowance(address,address) view returns (uint256)','function approve(address,uint256) returns (bool)'];
  const callbackSig='onFlashLoan(address,address,uint256,uint256,bytes)';
  const callbackTargets=targets.filter(t=>normalizedAbi(t.artifact.abi).some(x=>x?.type==='function'&&`${x.name}(${(x.inputs??[]).map(i=>i.type).join(',')})`===callbackSig));
  for(const target of targets){
    const recipeId=target.recipe?.recipeId;
    const c=new ethers.Contract(target.address,normalizedAbi(target.artifact.abi),provider);
    if(recipeId==='erc20-standard-v1'){
      const balances=[];
      for(const actor of actors){try{balances.push({actor,balance:BigInt(await c.balanceOf(actor))});}catch{}}
      balances.sort((a,b)=>a.balance===b.balance?0:(a.balance>b.balance?-1:1));
      const primary=balances.find(x=>x.balance>0n)?.actor??actors[0];
      const spender=actors.find(x=>x.toLowerCase()!==primary.toLowerCase())??actors[0];
      target.recipeRuntime={primaryActor:primary,spenderActor:spender,balances:balances.map(x=>({actor:x.actor,balance:x.balance.toString()})),setupReceipts:[]};
      try{
        const signer=await provider.getSigner(primary),token=c.connect(signer),tx=await token.approve(spender,ethers.MaxUint256),receipt=await tx.wait();
        target.recipeRuntime.setupReceipts.push({kind:'ERC20_ALLOWANCE',hash:receipt.hash,status:receipt.status});
        setupReceipts.push({target:target.qualifiedName,...target.recipeRuntime.setupReceipts.at(-1)});
      }catch(error){target.recipeRuntime.setupGap={type:'ERC20_ALLOWANCE_SETUP_GAP',message:String(error?.shortMessage??error?.message??error).slice(0,1200)};}
    }else if(recipeId==='erc4626-standard-v1'){
      try{
        const assetAddress=await c.asset(),asset=new ethers.Contract(assetAddress,erc20Abi,provider),balances=[];
        for(const actor of actors){try{balances.push({actor,balance:BigInt(await asset.balanceOf(actor))});}catch{}}
        balances.sort((a,b)=>a.balance===b.balance?0:(a.balance>b.balance?-1:1));
        const primary=balances.find(x=>x.balance>1n)?.actor??actors[0];
        target.recipeRuntime={assetAddress,primaryActor:primary,balances:balances.map(x=>({actor:x.actor,balance:x.balance.toString()})),setupReceipts:[]};
        const signer=await provider.getSigner(primary),assetSigner=asset.connect(signer);
        const allowance=BigInt(await asset.allowance(primary,target.address));
        if(allowance<1000n){
          const tx=await assetSigner.approve(target.address,ethers.MaxUint256),receipt=await tx.wait();
          target.recipeRuntime.setupReceipts.push({kind:'ERC4626_ASSET_ALLOWANCE',hash:receipt.hash,status:receipt.status});
          setupReceipts.push({target:target.qualifiedName,...target.recipeRuntime.setupReceipts.at(-1)});
        }
        try{
          const shares=BigInt(await c.balanceOf(primary));
          const assetBal=BigInt(await asset.balanceOf(primary));
          if(shares===0n&&assetBal>10n){
            const vault=c.connect(signer),tx=await vault.deposit(10n,primary),receipt=await tx.wait();
            target.recipeRuntime.setupReceipts.push({kind:'ERC4626_SEED_DEPOSIT',hash:receipt.hash,status:receipt.status});
            setupReceipts.push({target:target.qualifiedName,...target.recipeRuntime.setupReceipts.at(-1)});
          }
        }catch(error){target.recipeRuntime.seedGap={type:'ERC4626_SEED_GAP',message:String(error?.shortMessage??error?.message??error).slice(0,1200)};}
      }catch(error){target.recipeRuntime={setupGap:{type:'ERC4626_RUNTIME_BINDING_GAP',message:String(error?.shortMessage??error?.message??error).slice(0,1200)}};}
    }else if(recipeId==='erc3156-flash-lender-v1'){
      let tokenAddress=null;
      for(const getter of ['token','asset']){
        try{tokenAddress=await c.getFunction(`${getter}()`).staticCall();if(tokenAddress)break;}catch{}
      }
      const borrower=callbackTargets.find(x=>x.address.toLowerCase()!==target.address.toLowerCase())?.address??null;
      const primaryActor=actors[0];
      target.recipeRuntime={tokenAddress,borrowerAddress:borrower,primaryActor,setupReceipts:[],lifecycleWitnesses:[]};
      if(!tokenAddress||!borrower){
        target.recipeRuntime.setupGap={type:'ERC3156_RUNTIME_BINDING_GAP',missing:[!tokenAddress?'TOKEN':null,!borrower?'BORROWER':null].filter(Boolean)};
      }else{
        try{
          const before=await snapshot({provider,ethers,target,sender:primaryActor,plan:target.plan,systemTargets:targets});
          const signer=await provider.getSigner(primaryActor);
          const lender=c.connect(signer);
          const tx=await lender.getFunction('flashLoan(address,address,uint256,bytes)').send(borrower,tokenAddress,1n,'0x');
          const receipt=await tx.wait();
          const after=await snapshot({provider,ethers,target,sender:primaryActor,plan:target.plan,systemTargets:targets});
          const beforeRows=observationRowsV2(before,target.recipe,'BEFORE');
          const afterRows=observationRowsV2(after,target.recipe,'AFTER');
          const transitionDeltas=observationDeltasV2(beforeRows,afterRows,{receipt,sender:primaryActor})
            .filter(x=>x.status==='KNOWN'&&x.value!=='0'&&x.quantityId!=='native:sender');
          const witness={
            kind:'ERC3156_SEED_FLASH_LOAN',actionSignature:'flashLoan(address,address,uint256,bytes)',actor:primaryActor,
            receipt:{hash:receipt.hash,status:receipt.status,gasUsed:receipt.gasUsed?.toString()??null},
            observedTransitionDeltas:transitionDeltas
          };
          target.recipeRuntime.setupReceipts.push(witness.receipt);
          target.recipeRuntime.lifecycleWitnesses.push(witness);
          setupReceipts.push({target:target.qualifiedName,kind:witness.kind,...witness.receipt});
        }catch(error){
          target.recipeRuntime.setupGap={type:'ERC3156_SEED_FLOW_GAP',message:String(error?.shortMessage??error?.message??error).slice(0,1200)};
        }
      }
    }
  }
  return{targets,setupReceipts};
}
function qualifiedActionV2({target,selected,actors,rng}){
  const recipeId=target.recipe?.recipeId,runtime=target.recipeRuntime??{},sig=selected.signature;
  if(recipeId==='erc20-standard-v1'&&runtime.primaryActor){
    const primary=runtime.primaryActor,spender=runtime.spenderActor??actors[1]??actors[0],receiver=actors.find(x=>x.toLowerCase()!==primary.toLowerCase()&&x.toLowerCase()!==spender.toLowerCase())??spender;
    if(sig==='transfer(address,uint256)')return{sender:primary,args:[receiver,1n],value:0n,basis:'ERC20_FUNDED_ACTOR_RECIPE'};
    if(sig==='approve(address,uint256)')return{sender:primary,args:[spender,2n],value:0n,basis:'ERC20_ALLOWANCE_RECIPE'};
    if(sig==='transferFrom(address,address,uint256)')return{sender:spender,args:[primary,receiver,1n],value:0n,basis:'ERC20_ALLOWANCE_RECIPE'};
  }
  if(recipeId==='erc4626-standard-v1'&&runtime.primaryActor){
    const a=runtime.primaryActor;
    if(sig==='deposit(uint256,address)')return{sender:a,args:[1n,a],value:0n,basis:'ERC4626_ASSET_ALLOWANCE_RECIPE'};
    if(sig==='mint(uint256,address)')return{sender:a,args:[1n,a],value:0n,basis:'ERC4626_ASSET_ALLOWANCE_RECIPE'};
    if(sig==='withdraw(uint256,address,address)')return{sender:a,args:[1n,a,a],value:0n,basis:'ERC4626_SEEDED_POSITION_RECIPE'};
    if(sig==='redeem(uint256,address,address)')return{sender:a,args:[1n,a,a],value:0n,basis:'ERC4626_SEEDED_POSITION_RECIPE'};
  }
  if(recipeId==='erc3156-flash-lender-v1'&&runtime.tokenAddress&&runtime.borrowerAddress&&sig==='flashLoan(address,address,uint256,bytes)'){
    return{sender:runtime.primaryActor??actors[0],args:[runtime.borrowerAddress,runtime.tokenAddress,1n,'0x'],value:0n,basis:'ERC3156_CALLBACK_FLOW_RECIPE'};
  }
  return null;
}
export function pickFn(target,rng,actionClass,feedback=new Map(),blocked=new Set(),weightMultipliers=new Map()){
  const keyFor=x=>`${target.address.toLowerCase()}|${target.logicalQualifiedName??target.qualifiedName}|${x.signature}`;
  const available=list=>list.filter(x=>!blocked.has(keyFor(x)));
  const accounting=available(target.functions.filter(x=>x.accounting)),other=available(target.functions.filter(x=>!x.accounting));
  const requested=actionClass==='ACCOUNTING_STATE_CHANGE'?accounting:other;
  const alternate=actionClass==='ACCOUNTING_STATE_CHANGE'?other:accounting;
  const effective=requested.length?requested:alternate;
  if(!effective.length)return null;
  const weights=effective.map(x=>{
    const key=keyFor(x),base=1+Math.min(8,Number(feedback.get(key)??0));
    const multiplier=Math.max(0.01,Number(weightMultipliers.get(key)??1));
    return base*multiplier;
  });
  const total=weights.reduce((a,b)=>a+b,0);let cursor=rng()*total;
  for(let i=0;i<effective.length;i++){cursor-=weights[i];if(cursor<=0)return{selected:effective[i],feedbackWeight:weights[i],selectionKey:keyFor(effective[i]),selectionWeightMultiplier:Number(weightMultipliers.get(keyFor(effective[i]))??1)};}
  return{selected:effective.at(-1),feedbackWeight:weights.at(-1),selectionKey:keyFor(effective.at(-1)),selectionWeightMultiplier:Number(weightMultipliers.get(keyFor(effective.at(-1)))??1)};
}
export function buildBurstSchedule(targets,calls,rng){
  const out=[];
  const accountingTargets=targets.map((t,i)=>({t,i})).filter(x=>x.t.functions.some(f=>f.accounting));
  const otherTargets=targets.map((t,i)=>({t,i})).filter(x=>x.t.functions.some(f=>!f.accounting));
  let accountingRemaining=accountingTargets.length?Math.round(calls*PHASE0_ACCOUNTING_ACTION_WEIGHT_V1):0;
  let otherRemaining=otherTargets.length?(calls-accountingRemaining):0;
  if(accountingTargets.length&&!otherTargets.length){accountingRemaining=calls;otherRemaining=0;}
  if(!accountingTargets.length&&otherTargets.length){accountingRemaining=0;otherRemaining=calls;}
  // Reserve one deterministic calibration attempt for every admitted target/context class
  // before weighted bursts. This prevents a ready callback/facade/context from receiving zero
  // telemetry attempts due only to stochastic target selection.
  const calibration=[];
  for(const x of accountingTargets){
    if(accountingRemaining<=0)break;
    calibration.push({targetIndex:x.i,count:1,actionClass:'ACCOUNTING_STATE_CHANGE',calibration:true});
    accountingRemaining--;
  }
  for(const x of otherTargets){
    if(otherRemaining<=0)break;
    calibration.push({targetIndex:x.i,count:1,actionClass:'OTHER_STATE_CHANGE',calibration:true});
    otherRemaining--;
  }
  out.push(...calibration);
  let previous=calibration.length?calibration.at(-1).targetIndex:-1;
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
function observationRowsV2(snapshotValue,recipe,phase){
  const rows=[];
  const recipeId=recipe?.status==='QUALIFIED'?recipe.recipeId:null;
  const push=(quantityId,family,value,status='OK',error=null)=>rows.push({phase,quantityId,family,unit:'integer',status,value:status==='OK'?String(value):null,error});
  for(const [who,value] of Object.entries(snapshotValue?.native??{}))push(`native:${who}`,'NATIVE_BALANCE',value);
  for(const [address,value] of Object.entries(snapshotValue?.systemNative??{}))push(`system-native:${address.toLowerCase()}`,'NATIVE_BALANCE',value);
  for(const [address,related] of Object.entries(snapshotValue?.related??{})){
    for(const [name,result] of Object.entries(related??{})){
      if(name==='address')continue;
      const family=name.startsWith('balance')?'TOKEN_BALANCE':name.startsWith('allowance')?'ALLOWANCE':name==='totalSupply'?'TOTAL_SUPPLY':'RELATED_TOKEN_VIEW';
      const quantityId=`related:${address}:${name}`;
      if(result?.ok!==true)rows.push({phase,quantityId,family,unit:'integer',status:'FAILED',value:null,error:result?.error??'OBSERVATION_FAILED'});
      else if(typeof result.value==='string'&&/^-?\d+$/.test(result.value))push(quantityId,family,result.value);
      else rows.push({phase,quantityId,family,unit:'opaque',status:'OK',value:normalize(result.value),error:null});
    }
  }
  for(const [key,result] of Object.entries(snapshotValue?.views??{})){
    let family='ABI_VIEW';
    if(recipeId&&key.startsWith('balanceOf(address)'))family=recipeId==='erc4626-standard-v1'?'SHARE_BALANCE':'TOKEN_BALANCE';
    else if(recipeId&&key.startsWith('allowance(address,address)'))family='ALLOWANCE';
    else if(recipeId&&key.startsWith('totalSupply()'))family='TOTAL_SUPPLY';
    else if(recipeId==='erc4626-standard-v1'&&key.startsWith('totalAssets()'))family='TOTAL_ASSETS';
    if(result?.ok!==true){rows.push({phase,quantityId:`view:${key}`,family,unit:'integer',status:'FAILED',value:null,error:result?.error??'OBSERVATION_FAILED'});continue;}
    const value=result.value;
    if(typeof value==='string'&&/^-?\d+$/.test(value))push(`view:${key}`,family,value);
    else rows.push({phase,quantityId:`view:${key}`,family,unit:'opaque',status:'OK',value:normalize(value),error:null});
  }
  return rows;
}
function observationDeltasV2(beforeRows,afterRows,{receipt,sender}={}){
  const afterById=new Map(afterRows.map(x=>[x.quantityId,x])),rows=[];
  const gasUsed=receipt?.gasUsed!=null?BigInt(receipt.gasUsed):null;
  const gasPrice=receipt?.gasPrice!=null?BigInt(receipt.gasPrice):(receipt?.effectiveGasPrice!=null?BigInt(receipt.effectiveGasPrice):null);
  const gasFee=gasUsed!=null&&gasPrice!=null?gasUsed*gasPrice:null;
  for(const before of beforeRows){
    const after=afterById.get(before.quantityId);
    if(!after){rows.push({quantityId:before.quantityId,family:before.family,status:'UNKNOWN',reason:'POST_OBSERVATION_MISSING'});continue;}
    if(before.unit!=='integer'||after.unit!=='integer'){rows.push({quantityId:before.quantityId,family:before.family,status:'UNKNOWN',reason:'NON_INTEGER_OR_INCOMPARABLE_QUANTITY'});continue;}
    const delta=observationDeltaV2(before,after);
    const row={quantityId:before.quantityId,family:before.family,...delta};
    if(delta.status==='KNOWN'&&before.quantityId==='native:sender'&&gasFee!=null){
      row.rawValue=delta.value;
      row.transactionFeeWei=gasFee.toString();
      row.value=(BigInt(delta.value)+gasFee).toString();
      row.feeAdjusted=true;
    }
    rows.push(row);
  }
  return rows;
}
function lifecycleReachabilityV2(targets,rows){
  const families=[];
  for(const target of targets){
    for(const fn of target.functions??[]){
      const logical=target.logicalQualifiedName??target.qualifiedName;
      const contextType=target.contextType??'DIRECT';
      const hasAlternate=targets.some(other=>
        (other.logicalQualifiedName??other.qualifiedName)===logical&&
        (other.contextType??'DIRECT')!==contextType&&
        (other.functions??[]).some(x=>x.signature===fn.signature)
      );
      const requiresPositive=fn.semanticFamily==='ECONOMIC'||contextType==='DELEGATE_PROXY';
      const expectsRejection=contextType==='DIRECT'&&hasAlternate;
      if(!requiresPositive&&!expectsRejection)continue;
      const id=`${logical}|${contextType}|${target.recipe?.recipeId??'NO_RECIPE'}|${fn.signature}`;
      const attempts=rows.filter(row=>
        (row.target?.logicalQualifiedName??row.target?.qualifiedName)===logical&&
        (row.target?.contextType??'DIRECT')===contextType&&
        row.functionSignature===fn.signature
      );
      const positive=attempts.find(row=>row.executionOutcome==='MINED_SUCCESS'&&row.positiveTransition===true);
      const negative=attempts.find(row=>row.executionOutcome==='SIMULATED_REJECTION'||row.executionOutcome==='MINED_REVERT');
      let status='INFORMATIONAL';
      if(requiresPositive)status=positive?'POSITIVE_WITNESS':'REACHABILITY_GAP';
      else if(expectsRejection)status=negative?'EXPECTED_REJECTION_WITNESS':'EXPECTED_REJECTION_GAP';
      families.push({
        lifecycleFamilyId:id,logicalQualifiedName:logical,contextType,recipeId:target.recipe?.recipeId??null,
        functionSignature:fn.signature,semanticFamily:fn.semanticFamily,requiresPositive,expectsRejection,
        attemptCount:attempts.length,status,
        positiveWitness:positive?{runId:positive.runId,callIndex:positive.callIndex,transactionHash:positive.transaction?.hash??null}:null,
        negativeWitness:negative?{runId:negative.runId,callIndex:negative.callIndex,outcome:negative.executionOutcome,error:negative.error??null}:null,
        gapReason:status.endsWith('GAP')?(attempts.length?'NO_REQUIRED_WITNESS_OBSERVED':'NO_ATTEMPT_REACHED_FAMILY'):null
      });
    }
  }
  return families;
}
function preflightKindV2(error){
  const text=String(error?.shortMessage??error?.message??error??'');
  return error?.code==='CALL_EXCEPTION'||/revert|execution reverted|panic/i.test(text)?'PROTOCOL_REJECTION':'INFRASTRUCTURE';
}
const CONTEXT_REQUIRED_RE_V2=/(?:SenderIsNot|NotVault|OnlyVault|CallerIsNot|NotDelegateCall|onlyVault|only[A-Z]\w+)/;
const AUTH_LOOKING_RE_V2=/(?:NotOwner|Unauthorized|owner|auth|admin|allowed|permission|role|onlyOwner|onlyAdmin)/i;

function collectAddressStringsV2(value,out=[]){
  if(typeof value==='string'&&/^0x[0-9a-fA-F]{40}$/.test(value)){out.push(value);return out;}
  if(Array.isArray(value)){for(const child of value)collectAddressStringsV2(child,out);return out;}
  if(value&&typeof value==='object')for(const child of Object.values(value))collectAddressStringsV2(child,out);
  return out;
}
function contextErrorTextV2(info={}){
  return [
    info?.decodedCustomError?.name,
    info?.decodedCustomError?.signature,
    info?.reason,info?.shortMessage,info?.message
  ].filter(Boolean).join(' | ');
}
function associationCallerCandidatesV2({ethers,valuePool,targetAddress,targets=[]}){
  const out=[];
  for(const target of targets){
    if(!target?.address)continue;
    if(associationHoldsV2(valuePool?.associations??{},target.address,targetAddress))out.push(target.address);
  }
  return [...new Set(out.map(address=>ethers.getAddress(address)))];
}
function alternateFacadeTargetsV2({target,selected,targets=[]}){
  const logical=target.logicalQualifiedName??target.qualifiedName;
  return targets.filter(candidate=>
    String(candidate.address).toLowerCase()!==String(target.address).toLowerCase()&&
    ['FACADE','DELEGATE_PROXY'].includes(candidate.contextType??'DIRECT')&&
    (candidate.logicalQualifiedName??candidate.qualifiedName)===logical&&
    (candidate.functions??[]).some(fn=>fn.signature===selected.signature)
  );
}
async function ensureImpersonatedSenderV2({provider,ethers,address}){
  const sender=ethers.getAddress(address);
  try{await provider.send('anvil_impersonateAccount',[sender]);}catch{}
  try{
    const balance=BigInt(await provider.send('eth_getBalance',[sender,'latest']));
    if(balance<ethers.parseEther('1'))await provider.send('anvil_setBalance',[sender,ethers.toQuantity(ethers.parseEther('100'))]);
  }catch{}
  return sender;
}
async function telemetryPreflightAttemptV2({provider,iface,signature,args,sender,to,value}){
  const data=iface.encodeFunctionData(signature,args);
  let callProbe;
  try{
    const rawReturn=await provider.call({from:sender,to,data,value});
    let decodedReturn=null;
    try{decodedReturn=normalize(iface.decodeFunctionResult(signature,rawReturn));}catch{}
    callProbe={status:'RETURNED',rawReturn,decodedReturn};
  }catch(error){
    callProbe={status:'REVERTED',error:errorInfo(error,iface)};
  }
  try{
    const estimate=await provider.estimateGas({from:sender,to,data,value});
    return{success:true,estimate,callProbe,error:null,errorDetails:null,to,sender,data};
  }catch(error){
    return{success:false,estimate:null,callProbe,error,errorDetails:errorInfo(error,iface),to,sender,data};
  }
}
function callerResolutionForTargetV2(target){
  return ['FACADE','DELEGATE_PROXY'].includes(target.contextType??'DIRECT')?`FACADE:${target.address}`:'DEFAULT';
}
function selectionCallerStateKeyV2(target,selected){
  return `${target.address.toLowerCase()}|${target.logicalQualifiedName??target.qualifiedName}|${selected.signature}`;
}
export async function resolveTelemetryCallerContextV2({
  provider,ethers,target,selected,iface,args,value,defaultSender,targets=[],valuePool=null,callerState=new Map(),weightMultipliers=new Map()
}){
  const key=selectionCallerStateKeyV2(target,selected),saved=callerState.get(key);
  const adaptations=[];
  if(saved&&saved.resolution!=='UNRESOLVED'){
    const sender=saved.sender?await ensureImpersonatedSenderV2({provider,ethers,address:saved.sender}):defaultSender;
    const to=saved.executionAddress??target.address;
    const attempt=await telemetryPreflightAttemptV2({provider,iface,signature:selected.signature,args,sender,to,value});
    if(attempt.success)return{...attempt,resolution:saved.resolution,executionAddress:to,sender,adaptations,reused:true};
  }

  const initial=await telemetryPreflightAttemptV2({provider,iface,signature:selected.signature,args,sender:defaultSender,to:target.address,value});
  if(initial.success){
    const resolution=callerResolutionForTargetV2(target);
    if(resolution!=='DEFAULT')callerState.set(key,{resolution,executionAddress:target.address,sender:null});
    weightMultipliers.set(key,1);
    return{...initial,resolution,executionAddress:target.address,sender:defaultSender,adaptations,reused:false};
  }

  const info=initial.errorDetails??{},text=contextErrorTextV2(info);
  const delegateRequired=/DelegateCall/i.test(text);
  const contextRequired=delegateRequired||CONTEXT_REQUIRED_RE_V2.test(text);
  const authRequired=AUTH_LOOKING_RE_V2.test(text);
  const namedAddresses=[...new Set(collectAddressStringsV2(info?.decodedCustomError?.args??[]).map(address=>ethers.getAddress(address)))];

  if(delegateRequired){
    for(const facade of alternateFacadeTargetsV2({target,selected,targets})){
      const attempt=await telemetryPreflightAttemptV2({provider,iface,signature:selected.signature,args,sender:defaultSender,to:facade.address,value});
      adaptations.push({kind:'FACADE_RETRY',fromAddress:target.address,toAddress:facade.address,logicalQualifiedName:target.logicalQualifiedName??target.qualifiedName,signature:selected.signature,status:attempt.success?'PASS':'REVERTED'});
      if(attempt.success){
        const resolution=`FACADE:${facade.address}`;
        callerState.set(key,{resolution,executionAddress:facade.address,sender:null});
        weightMultipliers.set(key,1);
        return{...attempt,resolution,executionAddress:facade.address,sender:defaultSender,adaptations,reused:false};
      }
    }
  }

  if(contextRequired&&!delegateRequired){
    const candidates=namedAddresses.length
      ? namedAddresses.slice(0,1)
      : associationCallerCandidatesV2({ethers,valuePool,targetAddress:target.address,targets});
    for(const candidate of candidates){
      if(String(candidate).toLowerCase()===String(defaultSender).toLowerCase())continue;
      const sender=await ensureImpersonatedSenderV2({provider,ethers,address:candidate});
      const attempt=await telemetryPreflightAttemptV2({provider,iface,signature:selected.signature,args,sender,to:target.address,value});
      adaptations.push({kind:'IMPERSONATED_CALLER_RETRY',fromSender:defaultSender,toSender:sender,targetAddress:target.address,signature:selected.signature,status:attempt.success?'PASS':'REVERTED'});
      if(attempt.success){
        const resolution=`IMPERSONATED_CALLER:${sender}`;
        callerState.set(key,{resolution,executionAddress:target.address,sender});
        weightMultipliers.set(key,1);
        return{...attempt,resolution,executionAddress:target.address,sender,adaptations,reused:false};
      }
    }
  }

  if(authRequired){
    for(const raw of valuePool?.privileged??[]){
      let privileged;
      try{privileged=ethers.getAddress(raw);}catch{continue;}
      if(privileged.toLowerCase()===String(defaultSender).toLowerCase())continue;
      const sender=await ensureImpersonatedSenderV2({provider,ethers,address:privileged});
      const attempt=await telemetryPreflightAttemptV2({provider,iface,signature:selected.signature,args,sender,to:target.address,value});
      adaptations.push({kind:'PRIVILEGED_CALLER_RETRY',fromSender:defaultSender,toSender:sender,targetAddress:target.address,signature:selected.signature,status:attempt.success?'PASS':'REVERTED'});
      if(attempt.success){
        const resolution=`PRIVILEGED:${sender}`;
        callerState.set(key,{resolution,executionAddress:target.address,sender});
        weightMultipliers.set(key,1);
        return{...attempt,resolution,executionAddress:target.address,sender,adaptations,reused:false};
      }
    }
  }

  if(contextRequired||authRequired){
    callerState.set(key,{resolution:'UNRESOLVED',executionAddress:target.address,sender:null});
    weightMultipliers.set(key,0.1);
    adaptations.push({kind:'CALLER_CONTEXT_UNRESOLVED',targetAddress:target.address,logicalQualifiedName:target.logicalQualifiedName??target.qualifiedName,signature:selected.signature,reason:text.slice(0,1000),selectionWeightMultiplier:0.1});
    return{...initial,resolution:'UNRESOLVED',executionAddress:target.address,sender:defaultSender,adaptations,reused:false,contextRequired:true};
  }

  return{...initial,resolution:callerResolutionForTargetV2(target),executionAddress:target.address,sender:defaultSender,adaptations,reused:false};
}
export async function runTelemetry({provider,ethers,targets,actors,outRoot,baselineSnapshot,artifacts=[],valuePool=null,telemetryRuns=PHASE0_TELEMETRY_RUNS_V1,callsPerRun=PHASE0_TELEMETRY_CALLS_PER_RUN_V1,seedSalt='phase0-v2',runPrefix='abi-telemetry',repeatSameSeedAcrossRuns=false}){
  const summaries=[];
  let snapshotId=baselineSnapshot;
  const canonicalBaseline=await baselineSentinelV2({provider,ethers,targets,actors});
  for(let run=1;run<=telemetryRuns;run++){
    let resetEvidence={required:run>1,revertAccepted:run===1,sentinelMatch:run===1,expectedDigestSha256:canonicalBaseline.digestSha256,observedDigestSha256:canonicalBaseline.digestSha256};
    if(run>1){
      const reverted=await provider.send('evm_revert',[snapshotId]);
      if(reverted!==true){const error=new Error('Phase-0 telemetry baseline snapshot revert failed or expired');error.code='PHASE0_BASELINE_REVERT_FAILED';throw error;}
      const observedBaseline=await baselineSentinelV2({provider,ethers,targets,actors});
      resetEvidence={required:true,...verifyBaselineResetV2({reverted,expectedDigestSha256:canonicalBaseline.digestSha256,observedDigestSha256:observedBaseline.digestSha256})};
      snapshotId=await provider.send('evm_snapshot',[]);
    }
    const runId=`${runPrefix}-${String(run).padStart(3,'0')}`,dir=path.join(outRoot,'runs',runId);await fs.mkdir(dir,{recursive:true});
    const file=path.join(dir,'RAW_SIMULATION_TRANSCRIPT_v1.jsonl'),h=await fs.open(file,'w'),rng=seeded(repeatSameSeedAcrossRuns?seedSalt:`${runId}-${seedSalt}`);
    const schedule=buildBurstSchedule(targets,callsPerRun,rng);
    const accountingFunctionCount=targets.reduce((n,t)=>n+t.functions.filter(x=>x.semanticFamily==='ECONOMIC').length,0);
    const otherFunctionCount=targets.reduce((n,t)=>n+t.functions.filter(x=>x.semanticFamily!=='ECONOMIC').length,0);
    const stats={
      calls:0,plannedActions:callsPerRun,terminalActions:0,submittedActions:0,
      accountingActions:0,otherActions:0,accountingFunctionCount,otherFunctionCount,
      weightingLimitation:accountingFunctionCount===0?'NO_QUALIFIED_ECONOMIC_STATE_CHANGE_FUNCTIONS':null,
      successes:0,reverts:0,errors:0,minedSuccess:0,minedRevert:0,simulatedRejection:0,
      simulationInfrastructureError:0,submissionInfrastructureError:0,submittedOutcomeUnknown:0,
      notExecutedEncodingOrPlanning:0,positiveTransitions:0,positiveEconomicTransitions:0,
      observationFailures:0,observationReads:0,byContract:{},byFunction:{},
      feedbackUpdates:0,feedbackSelections:0,contextAdaptations:[],
      burstSchedule:schedule.map(x=>({contract:targets[x.targetIndex].qualifiedName,calls:x.count,actionClass:x.actionClass}))
    };
    const terminalRows=[],feedback=new Map(),blockedContextFunctions=new Set(),contextFailureCounts=new Map();
    const telemetryStartedAt=Date.now();
    console.log(`[phase0-telemetry] ${runId} started; targetCalls=${callsPerRun}; lifecycle=v2; heartbeat every 300s`);
    const telemetryHeartbeat=setInterval(()=>console.log(`[phase0-telemetry] heartbeat: run=${runId}; calls=${stats.calls}/${callsPerRun}; minedSuccess=${stats.minedSuccess}; simulatedRejection=${stats.simulatedRejection}; errors=${stats.errors}`),300000);
    telemetryHeartbeat.unref?.();
    try{
      for(const burst of schedule){
        let target=targets[burst.targetIndex];
        for(let k=0;k<burst.count;k++){
          let picked=pickFn(target,rng,burst.actionClass,feedback,blockedContextFunctions);
          if(!picked){
            const alternate=targets.find(candidate=>
              (candidate.logicalQualifiedName??candidate.qualifiedName)===(target.logicalQualifiedName??target.qualifiedName)&&
              (candidate.contextType??'DIRECT')!==(target.contextType??'DIRECT')&&
              pickFn(candidate,()=>0.5,burst.actionClass,feedback,blockedContextFunctions)
            );
            if(alternate){
              stats.contextAdaptations.push({kind:'REROUTE_TO_QUALIFIED_CONTEXT',fromContext:target.contextType??'DIRECT',toContext:alternate.contextType??'DIRECT',logicalQualifiedName:target.logicalQualifiedName??target.qualifiedName,atCallIndex:stats.calls+1});
              target=alternate;
              picked=pickFn(target,rng,burst.actionClass,feedback,blockedContextFunctions);
            }
          }
          if(!picked)throw new Error('Phase-0 telemetry selection exhausted all admitted functions for scheduled target');
          const selected=picked.selected,f=selected.fragment,iface=new ethers.Interface(normalizedAbi(target.artifact.abi));
          const qualifiedAction=qualifiedActionV2({target,selected,actors,rng});
          let sender=qualifiedAction?.sender??actors[ri(rng,actors.length)];
          const rec={
            schemaVersion:'curveyield-phase0-raw-simulation-call-v2',capabilityContractVersion:CAPABILITY_CONTRACT_VERSION_V2,
            runId,callIndex:stats.calls+1,target:{qualifiedName:target.qualifiedName,logicalQualifiedName:target.logicalQualifiedName??target.qualifiedName,address:target.address,recipeId:target.recipe?.recipeId??null,contextType:target.contextType??'DIRECT',contextDisposition:target.contextDisposition??'READY'},
            sender,functionSignature:selected.signature,declaredMutability:f.stateMutability,
            semanticFamily:selected.semanticFamily??'UNKNOWN',semanticBasis:selected.semanticBasis??'NO_QUALIFIED_SEMANTIC_RECIPE',
            actionClass:selected.semanticFamily==='ECONOMIC'?'ECONOMIC_STATE_CHANGE':'OTHER_STATE_CHANGE',
            stages:{ARG_GEN:null,PREFLIGHT:null,SUBMISSION:null,RECEIPT:null,OBSERVATION:null},
            decodedInputs:null,abiGenerated:true,rawRandomBytes:false,executionOutcome:null,
            observations:{before:[],after:[],deltas:[]},effectClassification:'NOT_EXECUTED',positiveTransition:false,
            transaction:null,error:null,
            selectionFeedback:{selectionKey:picked.selectionKey,weight:picked.feedbackWeight,adaptedContext:stats.contextAdaptations.at(-1)?.atCallIndex===stats.calls+1}
          };
          if(picked.feedbackWeight>1)stats.feedbackSelections++;
          stats.calls++; if(selected.semanticFamily==='ECONOMIC')stats.accountingActions++;else stats.otherActions++;
          stats.byContract[target.qualifiedName]=(stats.byContract[target.qualifiedName]??0)+1;
          const fk=`${target.qualifiedName}::${selected.signature}`;stats.byFunction[fk]=(stats.byFunction[fk]??0)+1;

          let args=null,argError=null;
          try{
            const argumentContext={actors,targets:targets.map(x=>x.address),valuePool,chosenAddresses:[]};
            args=qualifiedAction?.args??f.inputs.map(p=>randomValue(p,rng,argumentContext));
            rec.decodedInputs=normalize(args);
            rec.stages.ARG_GEN={status:'PASS',basis:qualifiedAction?.basis??'BOUNDED_RECURSIVE_ABI_GENERATION'};
            if(qualifiedAction)rec.recipeAction={basis:qualifiedAction.basis};
          }
          catch(error){argError=error;rec.stages.ARG_GEN={status:'FAILED',error:{code:error?.code??'ABI_ARGUMENT_GENERATION_LIMITATION',message:String(error?.message??error),limitation:error?.limitation??null}};}
          if(argError){
            rec.executionOutcome=classifyExecutionOutcomeV2({argumentGeneration:{success:false}});
            rec.error=rec.stages.ARG_GEN.error;
          }else{
            const before=await snapshot({provider,ethers,target,sender,plan:target.plan,systemTargets:targets});
            rec.observations.before=observationRowsV2(before,target.recipe,'BEFORE');
            const data=iface.encodeFunctionData(selected.signature,args);
            const value=qualifiedAction?.value??(f.stateMutability==='payable'?BigInt(ri(rng,1000000)):0n);
            let estimate=null,preflightError=null;
            let callProbe;
            try{
              const rawReturn=await provider.call({from:sender,to:target.address,data,value});
              let decodedReturn=null;
              try{decodedReturn=normalize(iface.decodeFunctionResult(selected.signature,rawReturn));}catch{}
              callProbe={status:'RETURNED',rawReturn,decodedReturn};
            }catch(error){
              callProbe={status:'REVERTED',error:errorInfo(error,iface)};
            }
            try{
              estimate=await provider.estimateGas({from:sender,to:target.address,data,value});
              rec.stages.PREFLIGHT={status:'PASS',estimateGas:estimate.toString(),callProbe};
            }catch(error){
              preflightError=error;
              const kind=preflightKindV2(error);
              rec.stages.PREFLIGHT={status:'FAILED',kind,error:errorInfo(error,iface),callProbe};
            }
            let tx=null,receipt=null,submissionError=null;
            if(!preflightError){
              try{
                const signer=await provider.getSigner(sender);
                const gasLimit=estimate+(estimate/2n)+100000n;
                tx=await signer.sendTransaction({to:target.address,data,value,gasLimit});
                rec.stages.SUBMISSION={status:'SUBMITTED',transactionHash:tx.hash,gasLimit:gasLimit.toString()};
                try{
                  receipt=await tx.wait();
                  rec.stages.RECEIPT={status:'MINED',transactionHash:tx.hash,blockNumber:receipt?.blockNumber??null,receiptStatus:receipt?.status??null,gasUsed:receipt?.gasUsed?.toString()??null,gasPrice:(receipt?.gasPrice??receipt?.effectiveGasPrice)?.toString?.()??null};
                }catch(error){
                  receipt=error?.receipt??null;
                  if(receipt)rec.stages.RECEIPT={status:'MINED',transactionHash:tx.hash,blockNumber:receipt.blockNumber??null,receiptStatus:receipt.status??0,gasUsed:receipt.gasUsed?.toString()??null,gasPrice:(receipt?.gasPrice??receipt?.effectiveGasPrice)?.toString?.()??null,error:errorInfo(error,iface)};
                  else rec.stages.RECEIPT={status:'OUTCOME_UNKNOWN',transactionHash:tx.hash,error:errorInfo(error,iface)};
                }
              }catch(error){
                submissionError=error;
                rec.stages.SUBMISSION={status:'FAILED',error:errorInfo(error,iface)};
              }
            }
            rec.executionOutcome=classifyExecutionOutcomeV2({
              argumentGeneration:{success:true},
              preflight:preflightError?{success:false,kind:preflightKindV2(preflightError)}:{success:true},
              submission:preflightError?null:(submissionError?{success:false}:{success:!!tx}),
              receipt
            });
            const after=await snapshot({provider,ethers,target,sender,plan:target.plan,systemTargets:targets});
            rec.observations.after=observationRowsV2(after,target.recipe,'AFTER');
            rec.observations.deltas=observationDeltasV2(rec.observations.before,rec.observations.after,{receipt,sender});
            rec.stages.OBSERVATION={
              status:rec.observations.after.some(x=>x.status!=='OK')?'PARTIAL':'COMPLETE',
              reads:rec.observations.after.length,
              failedReads:rec.observations.after.filter(x=>x.status!=='OK').length
            };
            const knownNonzero=rec.observations.deltas.filter(x=>x.status==='KNOWN'&&x.value!=='0'&&x.quantityId!=='native:sender');
            rec.positiveTransition=rec.executionOutcome==='MINED_SUCCESS'&&knownNonzero.length>0;
            rec.effectClassification=rec.positiveTransition?'OBSERVED_STATE_TRANSITION':(rec.executionOutcome==='MINED_SUCCESS'?'MINED_NO_OBSERVED_STATE_TRANSITION':'NO_MINED_SUCCESS');
            rec.transaction=tx?{hash:tx.hash,blockNumber:receipt?.blockNumber??null,status:receipt?.status??null,gasUsed:receipt?.gasUsed?.toString()??null,value:value.toString(),logs:(receipt?.logs??[]).map(l=>({address:l.address,topics:[...l.topics],data:l.data,index:l.index}))}:null;
            if(preflightError)rec.error=errorInfo(preflightError,iface);else if(submissionError)rec.error=errorInfo(submissionError,iface);
          }

          stats.terminalActions++;
          if(['MINED_SUCCESS','MINED_REVERT','SUBMITTED_OUTCOME_UNKNOWN'].includes(rec.executionOutcome))stats.submittedActions++;
          if(rec.executionOutcome==='MINED_SUCCESS'){stats.minedSuccess++;stats.successes++;}
          else if(rec.executionOutcome==='MINED_REVERT'){stats.minedRevert++;stats.reverts++;}
          else if(rec.executionOutcome==='SIMULATED_REJECTION')stats.simulatedRejection++;
          else if(rec.executionOutcome==='SIMULATION_INFRASTRUCTURE_ERROR')stats.simulationInfrastructureError++;
          else if(rec.executionOutcome==='SUBMISSION_INFRASTRUCTURE_ERROR')stats.submissionInfrastructureError++;
          else if(rec.executionOutcome==='SUBMITTED_OUTCOME_UNKNOWN')stats.submittedOutcomeUnknown++;
          else if(rec.executionOutcome==='NOT_EXECUTED_ENCODING_OR_PLANNING')stats.notExecutedEncodingOrPlanning++;
          if(rec.positiveTransition){
            stats.positiveTransitions++;
            if(rec.semanticFamily==='ECONOMIC')stats.positiveEconomicTransitions++;
            feedback.set(picked.selectionKey,Number(feedback.get(picked.selectionKey)??0)+1);
            stats.feedbackUpdates++;
          }
          if(rec.executionOutcome==='SIMULATED_REJECTION'){
            const hasAlternateContext=targets.some(candidate=>
              (candidate.logicalQualifiedName??candidate.qualifiedName)===(target.logicalQualifiedName??target.qualifiedName)&&
              (candidate.contextType??'DIRECT')!==(target.contextType??'DIRECT')&&
              candidate.functions.some(fn=>fn.signature===selected.signature)
            );
            if(hasAlternateContext){
              const failures=Number(contextFailureCounts.get(picked.selectionKey)??0)+1;
              contextFailureCounts.set(picked.selectionKey,failures);
              if(failures>=3&&!blockedContextFunctions.has(picked.selectionKey)){
                blockedContextFunctions.add(picked.selectionKey);
                const adaptation={kind:'BOUNDED_WRONG_CONTEXT_GAP',selectionKey:picked.selectionKey,logicalQualifiedName:target.logicalQualifiedName??target.qualifiedName,signature:selected.signature,contextType:target.contextType??'DIRECT',failureCount:failures,atCallIndex:stats.calls};
                stats.contextAdaptations.push(adaptation);rec.contextAdaptation=adaptation;
              }
            }
          }else contextFailureCounts.delete(picked.selectionKey);
          const observations=[...rec.observations.before,...rec.observations.after];stats.observationReads+=observations.length;stats.observationFailures+=observations.filter(x=>x.status!=='OK').length;
          if(['SIMULATION_INFRASTRUCTURE_ERROR','SUBMISSION_INFRASTRUCTURE_ERROR','SUBMITTED_OUTCOME_UNKNOWN','NOT_EXECUTED_ENCODING_OR_PLANNING'].includes(rec.executionOutcome))stats.errors++;
          terminalRows.push(rec);
          await h.write(JSON.stringify(rec)+'\n');
        }
      }
    }finally{clearInterval(telemetryHeartbeat);await h.close();}
    const reconciliation=validateTelemetryCountersV2(stats,terminalRows);
    const lifecycleFamilies=lifecycleReachabilityV2(targets,terminalRows);
    const positiveRequired=lifecycleFamilies.filter(x=>x.requiresPositive);
    const observationStatus=stats.observationReads===0?'UNAVAILABLE':(stats.observationFailures===0?'COMPLETE':'PARTIAL');
    const reachabilityStatus=positiveRequired.length===0?'NO_QUALIFIED_LIFECYCLES':(positiveRequired.every(x=>x.status==='POSITIVE_WITNESS')?'REACHABLE':positiveRequired.some(x=>x.status==='POSITIVE_WITNESS')?'PARTIAL':'REACHABILITY_GAP');
    console.log(`[phase0-telemetry] ${runId} completed; calls=${stats.calls}; minedSuccess=${stats.minedSuccess}; simulatedRejection=${stats.simulatedRejection}; positiveTransitions=${stats.positiveTransitions}`);
    const actionSequenceDigestSha256=sha256(Buffer.from(JSON.stringify(terminalRows.map(row=>({target:row.target,sender:row.sender,functionSignature:row.functionSignature,decodedInputs:row.decodedInputs,actionClass:row.actionClass})))));
    const outcomeSequenceDigestSha256=sha256(Buffer.from(JSON.stringify(terminalRows.map(row=>({callIndex:row.callIndex,executionOutcome:row.executionOutcome,positiveTransition:row.positiveTransition,effectClassification:row.effectClassification})))));
    const decodedRevertReasons=topDecodedTelemetryRevertsV1({ethers,artifacts,rows:terminalRows,limit:15});
    const bytes=await fs.readFile(file),summary={
      schemaVersion:'curveyield-phase0-abi-telemetry-run-v2',capabilityContractVersion:CAPABILITY_CONTRACT_VERSION_V2,
      runId,purpose:'AUTOMATED_LIFECYCLE_TELEMETRY_WITH_TYPED_OUTCOMES_AND_ACCOUNTING_OBSERVATIONS',...stats,
      accountingActionShare:stats.calls?stats.accountingActions/stats.calls:0,requiredAccountingActionWeight:PHASE0_ACCOUNTING_ACTION_WEIGHT_V1,
      interleavedCrossContractBursts:true,executionStatus:'COMPLETED',coverageStatus:stats.calls===callsPerRun?'COMPLETE':'INCOMPLETE',
      checkStatus:'NOT_APPLICABLE',reachabilityStatus,observationStatus,reconciliation,lifecycleFamilies,resetEvidence,
      feedbackStatus:stats.feedbackUpdates>0&&stats.feedbackSelections>0?'ACTIVE':'NO_FEEDBACK_WITNESS',decodedRevertReasons,
      actionSequenceDigestSha256,outcomeSequenceDigestSha256,
      rawTranscriptRef:`runs/${runId}/RAW_SIMULATION_TRANSCRIPT_v1.jsonl`,rawTranscriptSha256:sha256(bytes),rawTranscriptBytes:bytes.length,
      legacyCompatibility:{legacyRevertCounterWasPreflightDominated:true,currentRevertsAreMinedRevertsOnly:true},
      status:stats.calls===callsPerRun&&stats.terminalActions===stats.plannedActions&&reconciliation.status==='PASS'?'PASS':'INCOMPLETE'
    };
    await fs.writeFile(path.join(dir,'RUN_SUMMARY_v1.json'),JSON.stringify(summary,null,2)+'\n');summaries.push(summary);
  }
  return summaries;
}
function medusaParamSupportedV2(param,depth=0){
  if(depth>8)return false;
  if(param?.baseType==='array'){
    if(Number.isInteger(param.arrayLength)&&param.arrayLength>96)return false;
    return medusaParamSupportedV2(param.arrayChildren,depth+1);
  }
  if(param?.baseType==='tuple')return (param.components??[]).every(x=>medusaParamSupportedV2(x,depth+1));
  return /^(?:u?int(?:8|16|24|32|40|48|56|64|72|80|88|96|104|112|120|128|136|144|152|160|168|176|184|192|200|208|216|224|232|240|248|256)?|address|bool|string|bytes(?:[1-9]|[12][0-9]|3[0-2])?)$/.test(String(param?.type??''));
}
function medusaSolidityBaseTypeV2(param,state){
  if(param?.baseType==='array'){
    const child=medusaSolidityBaseTypeV2(param.arrayChildren,state);
    const suffix=Number.isInteger(param.arrayLength)&&param.arrayLength>=0?`[${param.arrayLength}]`:'[]';
    return child+suffix;
  }
  if(param?.baseType==='tuple'){
    const name=`Phase0TupleV2_${state.nextStruct++}`;
    const fields=(param.components??[]).map((child,i)=>`    ${medusaSolidityBaseTypeV2(child,state)} f${i};`);
    state.structs.push(`  struct ${name} {\n${fields.join('\n')}\n  }`);
    return name;
  }
  return String(param?.type??'');
}
function medusaCanonicalInputTypeV2(param){
  try{return param.format('sighash');}catch{return String(param?.type??'');}
}
export function medusaWrappers(ethers,targets){
  const accounting=[],other=[],omitted=[];
  for(const t of targets){
    for(const x of t.functions){
      if(!(x.fragment.inputs??[]).every(p=>medusaParamSupportedV2(p))){
        omitted.push({qualifiedName:t.qualifiedName,signature:x.signature,reason:'ABI_RESOURCE_LIMIT_OR_UNSUPPORTED_ROUTER_PARAMETER_TYPE'});
        continue;
      }
      const row={target:t,selected:x,canonicalInputTypes:x.fragment.inputs.map(medusaCanonicalInputTypeV2)};
      (x.semanticFamily==='ECONOMIC'||x.accounting?accounting:other).push(row);
    }
  }
  const rows=[];let id=0;
  // Wrapper population is only a selection mechanism; achieved share is still measured from retained corpus calls.
  // Target 85% here to leave stochastic headroom above the 80% acceptance floor.
  const desiredEconomicShare=0.85;
  const odds=desiredEconomicShare/(1-desiredEconomicShare);
  const accCopies=accounting.length?Math.max(6,Math.ceil((odds*other.length)/accounting.length)):0;
  for(const x of accounting)for(let n=0;n<accCopies;n++)rows.push({...x,wrapperName:`p0_acc_${id++}_${n}`});
  for(const x of other)rows.push({...x,wrapperName:`p0_other_${id++}`});
  if(!accounting.length)omitted.push({qualifiedName:'ALL_TARGETS',signature:'N/A',reason:'NO_QUALIFIED_ECONOMIC_STATE_CHANGE_FUNCTIONS_FOR_MEDUSA_WEIGHTING'});
  return{
    rows,omitted,accCopies,
    accountingWrapperShare:rows.length?rows.filter(x=>x.selected.semanticFamily==='ECONOMIC'||x.selected.accounting).length/rows.length:0,
    weightingStrategy:'ROUTER_SURFACE_WEIGHT_PLUS_CORPUS_FEEDBACK_ELIGIBLE',
    allSupportedFunctionsRepresented:other.every(x=>rows.some(r=>r.selected.signature===x.selected.signature&&r.target.qualifiedName===x.target.qualifiedName))
  };
}
function explicitTargetPropertiesV2(ethers,targets){
  const rows=[];
  for(const target of targets){
    const iface=new ethers.Interface(normalizedAbi(target.artifact.abi));
    for(const f of iface.fragments.filter(x=>x.type==='function'&&/^property_/.test(x.name)&&['view','pure'].includes(x.stateMutability)&&x.inputs.length===0&&x.outputs.length===1&&x.outputs[0].type==='bool')){
      const category=target.propertyCategory??'TARGET_BEHAVIOR';
      rows.push({
        propertyId:`${category==='HARNESS_SELF_CHECK'?'harness-control':'target-property'}-${rows.length+1}`,
        category,
        targetQualifiedName:target.qualifiedName,
        targetAddress:target.address,
        targetSignature:f.format('sighash'),
        wrapperName:`property_p0_${category==='HARNESS_SELF_CHECK'?'control':'target'}_${rows.length}`,
        applicabilityBasis:category==='HARNESS_SELF_CHECK'?'OWNED_QUALIFICATION_CONTROL':'PACKET_DECLARED_PROPERTY_FUNCTION',
        preconditionMode:category==='HARNESS_SELF_CHECK'?'ENGINE_CAPABILITY_CONTROL':'REQUIRES_RELEVANT_SUCCESSFUL_STATE_TRANSITION_WITNESS'
      });
    }
  }
  return rows;
}
function medusaParamDynamicV2(param){
  if(param?.baseType==='array')return !(Number.isInteger(param.arrayLength)&&param.arrayLength>=0)||medusaParamDynamicV2(param.arrayChildren);
  if(param?.baseType==='tuple')return (param.components??[]).some(medusaParamDynamicV2);
  return param?.type==='string'||param?.type==='bytes';
}
export function renderMedusaRouterV2(ethers,targets,valuePool=null){
  const plan=medusaWrappers(ethers,targets),state={nextStruct:0,structs:[]},body=[];
  for(const x of plan.rows){
    // Bundle all target arguments into ONE calldata struct: the wrapper then holds a single stack slot regardless of
    // arity (legacy codegen "Stack too deep" otherwise), and the struct's ABI encoding equals the target's argument
    // encoding, so the raw calldata is forwarded verbatim instead of being re-encoded from locals.
    const inputs=x.selected.fragment.inputs??[];
    const selector=ethers.id(x.selected.signature).slice(0,10),payable=x.selected.fragment.stateMutability==='payable'?' payable':'';
    const value=x.selected.fragment.stateMutability==='payable'?'msg.value':'0';
    const targetAddress=ethers.getAddress(x.target.address);
    let params='',forwarded=`bytes.concat(bytes4(${selector}))`;
    if(inputs.length){
      const argsStruct=medusaSolidityBaseTypeV2({baseType:'tuple',components:inputs},state);
      const offset=inputs.some(medusaParamDynamicV2)?36:4; // dynamic struct param = 32-byte head offset, then the tuple
      params=`${argsStruct} calldata`;forwarded=`bytes.concat(bytes4(${selector}),msg.data[${offset}:])`;
      x.canonicalInputTypes=[`(${x.canonicalInputTypes.join(',')})`];
    }
    x.wrapperSignature=`Phase0MedusaRouterV1.${x.wrapperName}(${x.canonicalInputTypes.join(',')})`;
    body.push(`  function ${x.wrapperName}(${params}) external${payable} { CHEATS.prank(msg.sender); (bool ok, bytes memory data)=address(${targetAddress}).call{value:${value}}(${forwarded}); if(ok){successfulTargetCalls++;} emit Phase0Call(address(${targetAddress}),bytes4(${selector}),msg.sender,ok,data); }`);
  }
  const seedAddresses=[...new Set((valuePool?.addresses??[]).map(x=>String(x).toLowerCase()))].filter(x=>/^0x[0-9a-f]{40}$/.test(x));
  if(seedAddresses.length){
    const assignments=seedAddresses.map((address,index)=>`out[${index}]=address(${ethers.getAddress(address)});`).join(' ');
    body.push(`  function p0_seed_addresses() external pure returns (address[${seedAddresses.length}] memory out) { ${assignments} }`);
  }
  const properties=explicitTargetPropertiesV2(ethers,targets);
  for(const property of properties){
    const selector=ethers.id(property.targetSignature).slice(0,10);
    body.push(`  function ${property.wrapperName}() external returns(bool) { CHEATS.prank(msg.sender); (bool ok, bytes memory data)=address(${ethers.getAddress(property.targetAddress)}).call(abi.encodeWithSelector(bytes4(${selector}))); return ok && data.length>=32 && abi.decode(data,(bool)); }`);
  }
  const source=`// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;
interface Phase0MedusaCheatCodesV2 { function prank(address) external; }
contract Phase0MedusaRouterV1 {
  Phase0MedusaCheatCodesV2 internal constant CHEATS=Phase0MedusaCheatCodesV2(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D);
  uint256 public successfulTargetCalls;
  event Phase0Call(address indexed target, bytes4 indexed selector, address indexed fuzzSender, bool success, bytes data);
${state.structs.join('\n')}
${body.join('\n')}
}
`;
  return{...plan,properties,structs:state.structs,source};
}
export const PHASE0_MEDUSA_MAX_REPETITION_RATE_V1=0.5;
export function medusaCoverageTimelineV2(text){
  const samples=[];
  for(const m of String(text).matchAll(/fuzz: elapsed:\s*(?:(\d+)h)?(?:(\d+)m)?(\d+)s, calls:\s*([0-9,]+).*?branches:\s*([0-9,]+), corpus:\s*([0-9,]+)/g)){
    samples.push({elapsedSeconds:Number(m[1]??0)*3600+Number(m[2]??0)*60+Number(m[3]),calls:Number(m[4].replaceAll(',','')),branches:Number(m[5].replaceAll(',','')),corpus:Number(m[6].replaceAll(',',''))});
  }
  return samples;
}
// Repetition rate: share of calls executed after coverage last grew (0 = still discovering, 1 = pure cycling).
export function medusaVarietyV2({timeline=[],dispatch={}}={}){
  const last=timeline.at(-1)??{calls:0,branches:0,corpus:0};
  // Last coverage gain: the last progress sample where branch or corpus coverage grew.
  let firstAtMax=timeline[0]??last,maxB=-1,maxC=-1;
  for(const x of timeline){if(x.branches>maxB||x.corpus>maxC){firstAtMax=x;}maxB=Math.max(maxB,x.branches);maxC=Math.max(maxC,x.corpus);}
  const half=timeline.find(x=>x.calls>=last.calls/2)??last;
  const repetitionRate=last.calls>0?(last.calls-firstAtMax.calls)/last.calls:1;
  const represented=Number(dispatch.representedLogicalFunctionCount??0),pairs=Number(dispatch.uniqueCallChainPairs??0);
  const failures=[];
  if(repetitionRate>PHASE0_MEDUSA_MAX_REPETITION_RATE_V1)failures.push('COVERAGE_PLATEAUED_CALLS_ARE_REPEATING');
  if(pairs<represented)failures.push('TOO_FEW_UNIQUE_CALL_CHAIN_PAIRS');
  return{
    finalBranches:last.branches,finalCorpusSequences:last.corpus,callsAtLastCoverageGain:firstAtMax.calls,
    lastGainBasis:'PROGRESS_SAMPLE_BRANCH_OR_CORPUS_GROWTH',
    repetitionRate,maximumRepetitionRate:PHASE0_MEDUSA_MAX_REPETITION_RATE_V1,
    branchesGainedInSecondHalf:last.branches-half.branches,
    uniqueCallChainPairs:pairs,uniqueCrossContractCallChainPairs:Number(dispatch.uniqueCrossContractCallChainPairs??0),
    uniqueCallChainTriples:Number(dispatch.uniqueCallChainTriples??0),
    observedLogicalFunctionCount:Number(dispatch.observedLogicalFunctionCount??0),
    logicalFunctionsDispatchedMoreThanOnce:Number(dispatch.logicalFunctionsDispatchedMoreThanOnce??0),
    representedLogicalFunctionCount:represented,
    timeline:timeline.filter((_,i)=>i%10===0||i===timeline.length-1),
    status:failures.length?'FAIL':'PASS',failures
  };
}
function maxMedusaCalls(text){let max=0;for(const m of String(text).matchAll(/calls:\s*([0-9][0-9,]*)/gi))max=Math.max(max,Number(m[1].replaceAll(',','')));return max;}
function collectMethodSignaturesV2(value,out=[]){
  if(Array.isArray(value)){for(const x of value)collectMethodSignaturesV2(x,out);return out;}
  if(!value||typeof value!=='object')return out;
  if(typeof value.methodSignature==='string')out.push(value.methodSignature);
  for(const x of Object.values(value))collectMethodSignaturesV2(x,out);
  return out;
}
async function medusaCorpusDispatchMetricsV2({corpusDest,routerRows}){
  const byWrapper=new Map(routerRows.map(row=>[row.wrapperName,{
    economic:row.selected?.semanticFamily==='ECONOMIC'||row.selected?.accounting===true,
    logicalKey:`${row.target?.logicalQualifiedName??row.target?.qualifiedName}::${row.selected?.signature}`
  }]));
  let dispatches=0,economicDispatches=0,parsedFiles=0,parseFailures=0;
  const wrapperCounts={},logicalCounts={},pairs=new Set(),crossContractPairs=new Set(),triples=new Set();
  if(!fss.existsSync(corpusDest))return{status:'UNAVAILABLE_NO_RETAINED_CORPUS',dispatches:0,economicDispatches:0,economicShare:null,parsedFiles:0,parseFailures:0,wrapperCounts,logicalCounts};
  for(const rel of await walk(corpusDest)){
    if(!rel.endsWith('.json'))continue;
    try{
      const parsed=JSON.parse(await fs.readFile(path.join(corpusDest,...rel.split('/')),'utf8'));parsedFiles++;
      const chain=[];
      for(const signature of collectMethodSignaturesV2(parsed)){
        const name=String(signature).split('(')[0],meta=byWrapper.get(name);
        if(!meta)continue;
        dispatches++;if(meta.economic)economicDispatches++;
        wrapperCounts[name]=(wrapperCounts[name]??0)+1;
        logicalCounts[meta.logicalKey]=(logicalCounts[meta.logicalKey]??0)+1;
        chain.push(meta.logicalKey);
      }
      // Ordered call-chain variety inside each retained (coverage-increasing) sequence.
      for(let i=1;i<chain.length;i++){
        pairs.add(chain[i-1]+' -> '+chain[i]);
        if(chain[i-1].split('::')[0]!==chain[i].split('::')[0])crossContractPairs.add(chain[i-1]+' -> '+chain[i]);
        if(i>=2)triples.add(chain[i-2]+' -> '+chain[i-1]+' -> '+chain[i]);
      }
    }catch{parseFailures++;}
  }
  const out={
    status:dispatches>0?'MEASURED_FROM_RETAINED_CORPUS':'UNAVAILABLE_NO_ROUTER_DISPATCHES_IN_RETAINED_CORPUS',
    dispatches,economicDispatches,economicShare:dispatches?economicDispatches/dispatches:null,
    parsedFiles,parseFailures,wrapperCounts,logicalCounts,
    observedLogicalFunctionCount:Object.keys(logicalCounts).length,
    logicalFunctionsDispatchedMoreThanOnce:Object.values(logicalCounts).filter(n=>n>1).length,
    uniqueCallChainPairs:pairs.size,uniqueCrossContractCallChainPairs:crossContractPairs.size,uniqueCallChainTriples:triples.size,
    representedLogicalFunctionCount:new Set([...byWrapper.values()].map(x=>x.logicalKey)).size
  };
  // Raw variety sets for cross-shard union; non-enumerable so they never reach serialized evidence.
  Object.defineProperty(out,'sets',{value:{pairs,crossContractPairs,triples,logicalKeys:new Set(Object.keys(logicalCounts)),representedKeys:new Set([...byWrapper.values()].map(x=>x.logicalKey))},enumerable:false});
  return out;
}
export function buildMedusaConfigV2({anvilUrl,blockNumber,routerRows,checked,callLimit=PHASE0_MEDUSA_CALL_LIMIT_V1}){
  return{
    fuzzing:{
      workers:10,workerResetLimit:50,timeout:0,testLimit:callLimit,shrinkLimit:5000,callSequenceLength:100,
      coverageEnabled:true,corpusDirectory:'.curveyield-phase0-medusa-corpus-v2',coverageFormats:['lcov'],revertReporterEnabled:true,
      targetContracts:['Phase0MedusaRouterV1'],predeployedContracts:{},targetContractsBalances:[],constructorArgs:{},
      senderAddresses:['0x0000000000000000000000000000000000010000','0x0000000000000000000000000000000000020000','0x0000000000000000000000000000000000030000','0x0000000000000000000000000000000000040000'],
      testing:{
        stopOnFailedTest:false,stopOnNoTests:checked===true,testAllContracts:false,testViewMethods:false,
        assertionTesting:{enabled:checked===true},
        propertyTesting:{enabled:checked===true,testPrefixes:['property_']},
        optimizationTesting:{enabled:false,testPrefixes:['optimize_']},
        targetFunctionSignatures:routerRows.map(x=>x.wrapperSignature??`Phase0MedusaRouterV1.${x.wrapperName}(${(x.canonicalInputTypes??[]).join(',')})`),
        excludeFunctionSignatures:[]
      },
      chainConfig:{cheatCodes:{cheatCodesEnabled:true,enableFFI:false},forkConfig:{forkModeEnabled:true,rpcUrl:anvilUrl,rpcBlock:blockNumber,poolSize:24}}
    },
    compilation:{platform:'crytic-compile',platformConfig:{target:'.',args:['--foundry-compile-all']}},
    slither:{useSlither:false},logging:{level:'info',logDirectory:'',noColor:true}
  };
}
async function readTargetPropertyV2({provider,ethers,property,from}){
  try{
    const iface=new ethers.Interface([`function ${property.targetSignature} view returns (bool)`]);
    const data=iface.encodeFunctionData(property.targetSignature,[]);
    const raw=await provider.call({to:property.targetAddress,from,data});
    return{status:'OK',value:Boolean(iface.decodeFunctionResult(property.targetSignature,raw)[0])};
  }catch(error){return{status:'FAILED',value:null,error:String(error?.shortMessage??error?.message??error).slice(0,1200)};}
}
async function collectPropertyWitnessesV2({anvilUrl,ethers,targets,properties,valuePool=null}){
  if(!properties.length)return[];
  const provider=new ethers.JsonRpcProvider(anvilUrl,1,{staticNetwork:true,cacheTimeout:-1});
  const actors=await provider.send('eth_accounts',[]);
  const targetByQ=new Map(targets.map(t=>[t.qualifiedName,t])),out=[];
  try{
    for(const property of properties){
      if(property.category==='HARNESS_SELF_CHECK'){
        out.push({propertyId:property.propertyId,targetSignature:property.targetSignature,status:'CONTROL_NOT_TARGET',reason:'HARNESS_SELF_CHECK_DOES_NOT_REQUIRE_TARGET_PRECONDITION_WITNESS'});
        continue;
      }
      const target=targetByQ.get(property.targetQualifiedName);
      const defaultActor=target?.recipeRuntime?.primaryActor??actors[0];
      const initial=await readTargetPropertyV2({provider,ethers,property,from:defaultActor});
      let witness=null;
      const runtimeWitness=(target?.recipeRuntime?.lifecycleWitnesses??[])
        .find(x=>Array.isArray(x?.observedTransitionDeltas)&&x.observedTransitionDeltas.length>0);
      if(runtimeWitness){
        witness={
          status:'WITNESSED',propertyId:property.propertyId,targetSignature:property.targetSignature,
          actionSignature:runtimeWitness.actionSignature,actor:runtimeWitness.actor??defaultActor,
          receipt:runtimeWitness.receipt??null,initialProperty:initial,
          afterProperty:await readTargetPropertyV2({provider,ethers,property,from:runtimeWitness.actor??defaultActor}),
          observedTransitionDeltas:runtimeWitness.observedTransitionDeltas,
          witnessBasis:'RUNTIME_RECIPE_PRECONDITION'
        };
      }
      for(const selected of witness?[]:(target?.functions??[])){
        const attemptSnapshot=await provider.send('evm_snapshot',[]);
        try{
          const rng=seeded(`property-witness-v2:${property.propertyId}:${selected.signature}`);
          const qualified=qualifiedActionV2({target,selected,actors,rng});
          const actor=qualified?.sender??defaultActor;
          const argumentContext={actors,targets:targets.map(x=>x.address),valuePool,chosenAddresses:[]};
          const args=qualified?.args??selected.fragment.inputs.map(p=>randomValue(p,rng,argumentContext));
          const iface=new ethers.Interface(normalizedAbi(target.artifact.abi));
          const data=iface.encodeFunctionData(selected.signature,args),value=qualified?.value??(selected.fragment.stateMutability==='payable'?1n:0n);
          const before=await snapshot({provider,ethers,target,sender:actor,plan:target.plan,systemTargets:targets});
          const estimate=await provider.estimateGas({from:actor,to:target.address,data,value});
          const signer=await provider.getSigner(actor),tx=await signer.sendTransaction({to:target.address,data,value,gasLimit:estimate+(estimate/2n)+100000n});
          const receipt=await tx.wait();
          const after=await snapshot({provider,ethers,target,sender:actor,plan:target.plan,systemTargets:targets});
          const beforeRows=observationRowsV2(before,target.recipe,'BEFORE'),afterRows=observationRowsV2(after,target.recipe,'AFTER');
          const deltaRows=observationDeltasV2(beforeRows,afterRows,{receipt,sender:actor});
          const nonGasDelta=deltaRows.filter(x=>x.status==='KNOWN'&&x.value!=='0'&&x.quantityId!=='native:sender');
          const requiredFamilies=new Set(target?.recipe?.requiredObservationFamilies??[]);
          const requiredObservationFailures=[...beforeRows,...afterRows].filter(x=>x.status!=='OK'&&requiredFamilies.has(x.family));
          const afterProperty=await readTargetPropertyV2({provider,ethers,property,from:actor});
          if(Number(receipt?.status)===1&&nonGasDelta.length&&requiredObservationFailures.length){
            witness={
              status:'OBSERVATION_GAP',propertyId:property.propertyId,targetSignature:property.targetSignature,
              actionSignature:selected.signature,actor,receipt:{status:receipt.status,gasUsed:receipt.gasUsed?.toString()??null},
              initialProperty:initial,afterProperty,observedTransitionDeltas:nonGasDelta,
              missingRequiredObservations:requiredObservationFailures.map(x=>({quantityId:x.quantityId,family:x.family,error:x.error??null}))
            };
          }else if(Number(receipt?.status)===1&&nonGasDelta.length){
            witness={status:'WITNESSED',propertyId:property.propertyId,targetSignature:property.targetSignature,actionSignature:selected.signature,actor,receipt:{status:receipt.status,gasUsed:receipt.gasUsed?.toString()??null},initialProperty:initial,afterProperty,observedTransitionDeltas:nonGasDelta};
          }
        }catch{}
        await provider.send('evm_revert',[attemptSnapshot]).catch(()=>{});
        if(witness)break;
      }
      out.push(witness??{propertyId:property.propertyId,targetSignature:property.targetSignature,status:'UNEXERCISED',initialProperty:initial,reason:'NO_RELEVANT_SUCCESSFUL_OBSERVED_STATE_TRANSITION_WITNESS'});
    }
  }finally{await provider.destroy();}
  return out;
}
export async function runMedusa({projectRoot,anvilUrl,blockNumber,ethers,targets,outRoot,valuePool=null,callLimit=PHASE0_MEDUSA_CALL_LIMIT_V1,minimumRequiredCalls=PHASE0_MEDUSA_MIN_CALLS_V1,runId='medusa-anvil-fork-001',routerProjectDir=null,stopAtPlateau=false}){
  const dir=path.join(outRoot,'runs',runId);await fs.mkdir(dir,{recursive:true});
  const router=renderMedusaRouterV2(ethers,targets,valuePool);
  if(!router.rows.length){
    const s={schemaVersion:'curveyield-phase0-medusa-run-v2',capabilityContractVersion:CAPABILITY_CONTRACT_VERSION_V2,runId:runId,mode:'DISCOVERY_WITH_ORACLE_GAPS',executionStatus:'NOT_EXECUTED',coverageStatus:'NO_ROUTABLE_FUNCTIONS',checkStatus:'ORACLE_GAP',reachabilityStatus:'UNKNOWN',observationStatus:'UNAVAILABLE',status:'BLOCKED_NO_ROUTABLE_ABI_FUNCTIONS',configuredCallLimit:callLimit,observedCalls:0,limitations:router.omitted};
    await fs.writeFile(path.join(dir,'RUN_SUMMARY_v1.json'),JSON.stringify(s,null,2)+'\n');return s;
  }
  const checked=router.properties.length>0,mode=checked?'CHECKED_DISCOVERY':'DISCOVERY_WITH_ORACLE_GAPS';
  // Shards sharing one target configuration reuse one router project so Forge's build cache skips recompilation.
  const medusaProject=routerProjectDir??path.join(dir,'router-project');await fs.mkdir(path.join(medusaProject,'src'),{recursive:true});
  await fs.rm(path.join(medusaProject,'.curveyield-phase0-medusa-corpus-v2'),{recursive:true,force:true});
  const harnessAbs=path.join(medusaProject,'src','Phase0MedusaRouterV1.sol');
  await fs.writeFile(harnessAbs,router.source);
  await fs.writeFile(path.join(medusaProject,'foundry.toml'),'[profile.default]\nsrc = "src"\nout = "out"\nlibs = []\nsolc_version = "0.8.28"\nevm_version = "cancun"\noptimizer = true\noptimizer_runs = 200\n');
  const cfg=buildMedusaConfigV2({anvilUrl,blockNumber,routerRows:router.rows,checked,callLimit});
  const cfgPath=path.join(medusaProject,'medusa.json');await fs.writeFile(cfgPath,JSON.stringify(cfg,null,2)+'\n');
  await fs.writeFile(path.join(dir,'MEDUSA_CONFIG_v1.json'),JSON.stringify(cfg,null,2)+'\n');
  await fs.writeFile(path.join(dir,'MEDUSA_ROUTER_v1.sol'),router.source);
  const witnessRows=await collectPropertyWitnessesV2({anvilUrl,ethers,targets,properties:router.properties,valuePool});
  await fs.writeFile(path.join(dir,'PROPERTY_WITNESSES_v2.json'),JSON.stringify({schemaVersion:'curveyield-phase0-medusa-property-witnesses-v2',properties:witnessRows},null,2)+'\n');

  const medusaStartedAt=Date.now();
  console.log(`[phase0-medusa] started; mode=${mode}; timeout=1800s; configuredCallLimit=${callLimit}; progress heartbeat every 300s`);
  const heartbeat=setInterval(()=>console.log(`[phase0-medusa] heartbeat: mode=${mode}; elapsed=${Math.floor((Date.now()-medusaStartedAt)/1000)}s; configuredCallLimit=${callLimit}`),300000);
  heartbeat.unref?.();
  let r,stoppedAtPlateau=false;
  const plateau=medusaPlateauMonitorV2();
  const onStdout=(text,child)=>{if(plateau.push(text)&&stopAtPlateau&&!stoppedAtPlateau){stoppedAtPlateau=true;child.kill('SIGINT');}};
  try{r=await runProcess({command:'timeout',args:['-s','INT','-k','120s','1800s','medusa','fuzz','--config',cfgPath],cwd:medusaProject,env:scrubbedEnv(),onStdout});}
  finally{clearInterval(heartbeat);}
  const engineCompleted=r.exitCode===0||(stoppedAtPlateau&&maxMedusaCalls(r.stdout)>0);
  const raw=`${r.stdout??''}\n${r.stderr??''}`;await fs.writeFile(path.join(dir,'MEDUSA_RAW_OUTPUT_v1.log'),raw);
  let parsed;
  try{parsed=parseMedusaOutput(r.stdout??raw);}catch(error){parsed={status:'parse_failure',properties:[],falsifiedProperties:0,parseError:String(error?.message??error)};}

  const corpusSource=path.join(medusaProject,'.curveyield-phase0-medusa-corpus-v2'),corpusDest=path.join(dir,'corpus'),corpusIndex=[];
  if(fss.existsSync(corpusSource)){
    await fs.rm(corpusDest,{recursive:true,force:true});await fs.cp(corpusSource,corpusDest,{recursive:true});
    for(const rel of await walk(corpusDest)){const abs=path.join(corpusDest,...rel.split('/')),bytes=await fs.readFile(abs);corpusIndex.push({path:'corpus/'+rel,sha256:sha256(bytes),bytes:bytes.length});}
  }
  const corpusDispatchMetrics=await medusaCorpusDispatchMetricsV2({corpusDest,routerRows:router.rows});
  await fs.writeFile(path.join(dir,'MEDUSA_CORPUS_INDEX_v1.json'),JSON.stringify({schemaVersion:'curveyield-phase0-medusa-corpus-index-v2',files:corpusIndex,dispatchMetrics:corpusDispatchMetrics},null,2)+'\n');

  const observedCalls=maxMedusaCalls(raw),rawRef=`runs/${runId}/MEDUSA_RAW_OUTPUT_v1.log`;
  const witnessById=new Map(witnessRows.map(x=>[x.propertyId,x]));
  const properties=router.properties.map(property=>{
    const engine=(parsed.properties??[]).find(x=>String(x.name??'').includes(property.wrapperName));
    const witness=witnessById.get(property.propertyId),witnessed=witness&&witness.status==='WITNESSED'&&Array.isArray(witness.observedTransitionDeltas)&&witness.observedTransitionDeltas.length>0;
    let result='ENGINE_FAILURE';
    if(property.category==='HARNESS_SELF_CHECK'){
      if(engine?.status==='failed')result='CONTROL_FALSE_OBSERVED';
      else if(engine?.status==='passed')result='CONTROL_TRUE_OBSERVED';
      else result='ENGINE_FAILURE';
    }else if(engine?.status==='failed')result='DEVIATION_OBSERVED';
    else if(witness?.status==='OBSERVATION_GAP')result='OBSERVATION_GAP';
    else if(!witnessed)result='UNEXERCISED';
    else if(engine?.status==='passed')result='CHECKED_NO_DEVIATION_OBSERVED';
    else if(parsed.status==='no_tests')result='ENGINE_FAILURE';
    return{
      ...property,discoveredByEngine:Boolean(engine),engineName:engine?.name??null,
      preconditionWitnessRefs:witnessed?[`runs/${runId}/PROPERTY_WITNESSES_v2.json#${property.propertyId}`]:[],
      executionEvidenceRefs:engine?[rawRef]:[],result,
      counterexample:engine?.counterexample??null
    };
  });
  const assurance=assessMedusaV2({mode,observedCalls,engineProperties:parsed.properties??[],properties});
  const callVolumeMet=observedCalls>=minimumRequiredCalls;
  let status;
  if(checked)status=engineCompleted&&callVolumeMet&&assurance.checkStatus==='CHECKED'?'PASS':'COMPLETE_WITH_FAILURES';
  else status=engineCompleted&&callVolumeMet?'COMPLETE_WITH_ORACLE_GAPS':'INCOMPLETE_CALL_REQUIREMENT';
  const summary={
    schemaVersion:'curveyield-phase0-medusa-run-v2',capabilityContractVersion:CAPABILITY_CONTRACT_VERSION_V2,runId:runId,
    mode,purpose:'BROAD_PHASE0_STATEFUL_RANDOMIZED_DISCOVERY_WITH_CHECKED_PACKET_PROPERTIES_WHEN_AVAILABLE',
    fork:{engine:'anvil',rpcUrlExposed:false,rpcBlock:blockNumber,chain:'ethereum',chainId:1},
    configuredCallLimit:callLimit,minimumRequiredCalls:minimumRequiredCalls,observedCalls,
    callSequenceLength:100,workers:10,callerSemantics:'FUZZ_SENDER_PRESERVED_WITH_MEDUSA_PRANK_CHEATCODE',
    abiRouterGenerated:true,rawRandomBytes:false,targetContracts:targets.map(t=>({qualifiedName:t.qualifiedName,address:t.address,recipeId:t.recipe?.recipeId??null})),
    routerWrapperCount:router.rows.length,accountingWrapperShare:router.accountingWrapperShare,weightingStrategy:router.weightingStrategy,
    achievedDispatchWeight:corpusDispatchMetrics,
    variety:medusaVarietyV2({timeline:medusaCoverageTimelineV2(raw),dispatch:corpusDispatchMetrics}),
    achievedWeightBasis:corpusDispatchMetrics.status==='MEASURED_FROM_RETAINED_CORPUS'?'ACTUAL_RETAINED_MEDUSA_CORPUS_DISPATCHES':'UNAVAILABLE_WITH_TYPED_REASON',
    omittedFunctions:router.omitted,propertyRegistry:properties,engineProperties:parsed.properties??[],engineParseStatus:parsed.status,
    executionStatus:assurance.executionStatus,coverageStatus:assurance.coverageStatus,checkStatus:assurance.checkStatus,
    reachabilityStatus:assurance.reachabilityStatus,observationStatus:assurance.observationStatus,
    exitCode:r.exitCode,stoppedAtPlateau,rawOutputRef:rawRef,corpusIndexRef:`runs/${runId}/MEDUSA_CORPUS_INDEX_v1.json`,
    retainedCorpusFileCount:corpusIndex.length,configRef:`runs/${runId}/MEDUSA_CONFIG_v1.json`,
    routerRef:`runs/${runId}/MEDUSA_ROUTER_v1.sol`,propertyWitnessRef:`runs/${runId}/PROPERTY_WITNESSES_v2.json`,
    limitations:checked?router.omitted:[...router.omitted,{type:'ORACLE_GAP',reason:'NO_EXPLICIT_PACKET_DECLARED_PROPERTY_FUNCTIONS_WERE_QUALIFIED'}],
    status
  };
  await fs.writeFile(path.join(dir,'RUN_SUMMARY_v1.json'),JSON.stringify(summary,null,2)+'\n');
  await fs.rm(harnessAbs,{force:true});await fs.rm(cfgPath,{force:true});
  Object.defineProperty(summary,'varietySets',{value:corpusDispatchMetrics.sets??null,enumerable:false});
  return summary;
}
// Stops a shard once coverage has plateaued: calls since the last branch or corpus gain reach 40% of the calls it took
// to get there, leaving headroom under the 0.5 repetition limit for Medusa's 3s progress granularity and shutdown.
export const PHASE0_MEDUSA_PLATEAU_RATIO_V1=0.4;
export function medusaPlateauMonitorV2({ratio=PHASE0_MEDUSA_PLATEAU_RATIO_V1}={}){
  let buffer='',maxBranches=-1,maxCorpus=-1,callsAtGain=0,lastCalls=0;
  return{
    push(text){
      buffer+=text;
      const lines=buffer.split('\n');buffer=lines.pop()??'';
      for(const line of lines){
        const m=/fuzz: elapsed:.*?calls:\s*([0-9,]+).*?branches:\s*([0-9,]+), corpus:\s*([0-9,]+)/.exec(line);
        if(!m)continue;
        const calls=Number(m[1].replaceAll(',','')),branches=Number(m[2].replaceAll(',','')),corpus=Number(m[3].replaceAll(',',''));
        lastCalls=calls;
        if(branches>maxBranches||corpus>maxCorpus){maxBranches=Math.max(maxBranches,branches);maxCorpus=Math.max(maxCorpus,corpus);callsAtGain=calls;continue;}
        if(callsAtGain>0&&calls-callsAtGain>=ratio*callsAtGain)return true;
      }
      return false;
    },
    state(){return{maxBranches,maxCorpus,callsAtGain,lastCalls};}
  };
}
// Diverse Medusa shards: one configuration over every target plus one per source-directory cluster, each a fresh
// engine run (independent clock seed) stopped at its coverage plateau, cycled until the total call floor is met.
export const PHASE0_MEDUSA_MIN_CLUSTER_TARGETS_V1=3;
export function medusaShardConfigurationsV2(targets){
  const clusters=new Map();
  for(const t of targets){
    const source=String(t.qualifiedName??'').split(':')[0];
    const key=source.includes('/')?source.slice(0,source.lastIndexOf('/')):'.';
    if(!clusters.has(key))clusters.set(key,[]);
    clusters.get(key).push(t);
  }
  // Clusters under PHASE0_MEDUSA_MIN_CLUSTER_TARGETS_V1 contracts saturate within one progress sample, so they fold
  // into their nearest ancestor directory cluster, or a shared misc cluster.
  for(const key of [...clusters.keys()].sort((a,b)=>b.length-a.length)){
    const group=clusters.get(key);
    if(!group||group.length>=PHASE0_MEDUSA_MIN_CLUSTER_TARGETS_V1)continue;
    let parent=key.includes('/')?key.slice(0,key.lastIndexOf('/')):null;
    while(parent&&!clusters.has(parent))parent=parent.includes('/')?parent.slice(0,parent.lastIndexOf('/')):null;
    if(!parent){
      // No ancestor cluster: join the cluster sharing the longest leading path segments, if any are shared.
      const segs=key.split('/');let best=null,bestShared=0;
      for(const other of clusters.keys()){
        if(other===key)continue;
        const o=other.split('/');let shared=0;while(shared<segs.length&&shared<o.length&&segs[shared]===o[shared])shared++;
        if(shared>bestShared||(shared===bestShared&&shared>0&&clusters.get(other).length>(clusters.get(best)?.length??0))){best=other;bestShared=shared;}
      }
      if(bestShared>0)parent=best;
    }
    const into=parent??'misc';
    if(!clusters.has(into))clusters.set(into,[]);
    clusters.get(into).push(...group);clusters.delete(key);
  }
  const configs=[{configId:'all-targets',cluster:'*',targets}];
  if(clusters.size>1)for(const [key,group] of [...clusters.entries()].sort((a,b)=>a[0].localeCompare(b[0])))configs.push({configId:'cluster-'+key.replace(/[^A-Za-z0-9]+/g,'-').replace(/^-|-$/g,'').toLowerCase(),cluster:key,targets:group});
  return configs;
}
export function aggregateMedusaShardsV2({shards,minimumRequiredCalls,configs}){
  const pairs=new Set(),cross=new Set(),triples=new Set(),logical=new Set(),represented=new Set();
  let calls=0,callsAfterLastGain=0,dispatches=0,economicDispatches=0;
  const rows=shards.map((s,i)=>{
    const sets=s.varietySets,before=pairs.size;
    if(sets){for(const x of sets.pairs)pairs.add(x);for(const x of sets.crossContractPairs)cross.add(x);for(const x of sets.triples)triples.add(x);for(const x of sets.logicalKeys)logical.add(x);for(const x of sets.representedKeys)represented.add(x);}
    const v=s.variety??{};calls+=Number(s.observedCalls??0);callsAfterLastGain+=Math.max(0,Number(s.observedCalls??0)-Number(v.callsAtLastCoverageGain??0));
    dispatches+=Number(s.achievedDispatchWeight?.dispatches??0);economicDispatches+=Number(s.achievedDispatchWeight?.economicDispatches??0);
    return{shard:i+1,runId:s.runId,configId:s.configId,cluster:s.cluster,targetContracts:(s.targetContracts??[]).length,status:s.status,exitCode:s.exitCode,stoppedAtPlateau:s.stoppedAtPlateau===true,observedCalls:s.observedCalls,finalBranches:v.finalBranches??0,repetitionRate:v.repetitionRate??1,uniqueCallChainPairs:v.uniqueCallChainPairs??0,novelUniqueCallChainPairs:pairs.size-before,varietyStatus:v.status??'FAIL',rawOutputRef:s.rawOutputRef,summaryRef:`runs/${s.runId}/RUN_SUMMARY_v1.json`};
  });
  const failures=[];
  // Per-shard repetition is reported for reviewers but not gated: fast small shards saturate within one progress sample.
  const shardsOverRepetition=rows.filter(r=>r.varietyStatus!=='PASS').map(r=>r.runId);
  const repetitionRate=calls?callsAfterLastGain/calls:1;
  if(repetitionRate>PHASE0_MEDUSA_MAX_REPETITION_RATE_V1)failures.push('COVERAGE_PLATEAUED_CALLS_ARE_REPEATING');
  if(pairs.size<represented.size)failures.push('TOO_FEW_UNIQUE_CALL_CHAIN_PAIRS');
  if(configs.some(c=>!rows.some(r=>r.configId===c.configId)))failures.push('SHARD_CONFIGURATION_NOT_EXECUTED');
  return{
    rows,observedCalls:calls,
    dispatch:{status:dispatches>0?'MEASURED_FROM_RETAINED_CORPUS':'UNAVAILABLE_NO_ROUTER_DISPATCHES_IN_RETAINED_CORPUS',dispatches,economicDispatches,economicShare:dispatches?economicDispatches/dispatches:null,basis:'SUM_OF_SHARD_RETAINED_CORPORA'},
    variety:{
      basis:'UNION_ACROSS_INDEPENDENT_MEDUSA_SHARDS',shardCount:rows.length,configurationCount:configs.length,
      repetitionRate,maximumRepetitionRate:PHASE0_MEDUSA_MAX_REPETITION_RATE_V1,
      uniqueCallChainPairs:pairs.size,uniqueCrossContractCallChainPairs:cross.size,uniqueCallChainTriples:triples.size,
      observedLogicalFunctionCount:logical.size,representedLogicalFunctionCount:represented.size,
      minimumRequiredCalls,shardsOverRepetition,status:failures.length?'FAIL':'PASS',failures
    }
  };
}
export async function runMedusaShardsV2({projectRoot,anvilUrl,blockNumber,ethers,targets,outRoot,valuePool=null,minimumRequiredCalls=PHASE0_MEDUSA_MIN_CALLS_V1,shardCallLimit=PHASE0_MEDUSA_CALL_LIMIT_V1,maxShards=40,maxSeconds=1800}){
  const configs=medusaShardConfigurationsV2(targets),shards=[],started=Date.now();
  for(let i=0;i<maxShards;i++){
    const config=configs[i%configs.length];
    const runId=`medusa-anvil-fork-${String(i+1).padStart(3,'0')}`;
    console.log(`[phase0-medusa] shard ${i+1}: ${config.configId} (${config.targets.length} contracts)`);
    const shard=await runMedusa({projectRoot,anvilUrl,blockNumber,ethers,targets:config.targets,outRoot,valuePool,callLimit:shardCallLimit,minimumRequiredCalls:1,runId,routerProjectDir:path.join(outRoot,'runs',`router-${config.configId}`),stopAtPlateau:true});
    const sets=shard.varietySets;
    Object.assign(shard,{configId:config.configId,cluster:config.cluster});
    Object.defineProperty(shard,'varietySets',{value:sets,enumerable:false});
    shards.push(shard);
    const total=shards.reduce((n,x)=>n+Number(x.observedCalls??0),0);
    console.log(`[phase0-medusa] shard ${i+1} done: calls=${shard.observedCalls}; plateauStop=${shard.stoppedAtPlateau}; repetition=${shard.variety?.repetitionRate}; total=${total}`);
    if(shard.status==='BLOCKED_NO_ROUTABLE_ABI_FUNCTIONS'&&config.configId==='all-targets')break;
    if(total>=minimumRequiredCalls&&i+1>=configs.length)break;
    if((Date.now()-started)/1000>=maxSeconds)break;
  }
  const base=shards[0],agg=aggregateMedusaShardsV2({shards,minimumRequiredCalls,configs});
  const engineOk=shards.every(x=>['COMPLETE_WITH_ORACLE_GAPS','PASS'].includes(x.status));
  const checked=base.mode==='CHECKED_DISCOVERY';
  const volume=agg.observedCalls>=minimumRequiredCalls;
  const status=!engineOk||!volume?(checked?'COMPLETE_WITH_FAILURES':'INCOMPLETE_CALL_REQUIREMENT'):(checked&&shards.every(x=>x.status==='PASS')?'PASS':(checked?'COMPLETE_WITH_FAILURES':'COMPLETE_WITH_ORACLE_GAPS'));
  const summary={
    ...base,runId:'medusa-shards',
    configuredCallLimit:shardCallLimit*shards.length,shardCallLimit,minimumRequiredCalls,observedCalls:agg.observedCalls,
    coverageStatus:volume?'DISCOVERY_VOLUME_MET':'DISCOVERY_VOLUME_INCOMPLETE',
    targetContracts:base.targetContracts,
    achievedDispatchWeight:agg.dispatch,variety:agg.variety,shards:agg.rows,
    rawOutputRefs:shards.map(x=>x.rawOutputRef),corpusIndexRefs:shards.map(x=>x.corpusIndexRef),
    retainedCorpusFileCount:shards.reduce((n,x)=>n+Number(x.retainedCorpusFileCount??0),0),
    exitCode:engineOk?0:(shards.find(x=>!['COMPLETE_WITH_ORACLE_GAPS','PASS'].includes(x.status))?.exitCode??1),
    status
  };
  await fs.writeFile(path.join(outRoot,'runs','MEDUSA_SHARDS_SUMMARY_v1.json'),JSON.stringify(summary,null,2)+'\n');
  return summary;
}
function baselineTargetRows({medusa,telemetry}){
  const refs=[medusa?.rawOutputRef,medusa?.corpusIndexRef,...telemetry.map(x=>x.rawTranscriptRef)].filter(Boolean);
  return[
    {candidateKey:'PHASE0-BASELINE-MEDUSA',executionEvidenceRefs:(()=>{const refs=[...(medusa?.rawOutputRefs??[medusa?.rawOutputRef]),...(medusa?.corpusIndexRefs??[medusa?.corpusIndexRef])].filter(Boolean);return refs.length?refs:['NO_MEDUSA_OUTPUT'];})(),oracleOutcome:medusa?.status==='PASS'?'BASELINE_RANDOMIZED_EXECUTION_COMPLETED':'BASELINE_RANDOMIZED_EXECUTION_LIMITED',reproductionStatus:medusa?.status??'UNKNOWN',requestBindingStatus:'PHASE0_CONTROLLER_GENERATED',requestBindingEvidenceRef:medusa?.configRef??'NO_CONFIG'},
    {candidateKey:'PHASE0-BASELINE-ABI-TELEMETRY',executionEvidenceRefs:refs,oracleOutcome:'INVESTIGATIVE_BASELINE_TELEMETRY_GENERATED',reproductionStatus:telemetry.every(x=>x.status==='PASS')?'PASS':'INCOMPLETE',requestBindingStatus:'PHASE0_CONTROLLER_GENERATED',requestBindingEvidenceRef:'evidence/phase0/simulations/PHASE0_SIMULATION_RUN_INDEX_v1.json'}
  ];
}
export async function runPhase0RandomizedSimulationV1({controllerRoot,campaignPath,outputRoot,forkUrl,medusaSmokeCalls=null,telemetrySmokeCalls=null}){
  // Smoke budgets are independent and never produce campaign evidence. Medusa-only preserves the prior smoke behavior.
  const medusaSmoke=Number.isInteger(medusaSmokeCalls)&&medusaSmokeCalls>0;
  const telemetrySmoke=Number.isInteger(telemetrySmokeCalls)&&telemetrySmokeCalls>0;
  const campaignRoot=path.join(controllerRoot,...campaignPath.split('/'));
  const buildIdentity=JSON.parse(await fs.readFile(path.join(campaignRoot,'evidence/build/BUILD_AND_SOURCE_IDENTITY_v1.json'),'utf8'));
  const executionBuildArtifacts=JSON.parse(await fs.readFile(path.join(campaignRoot,'evidence/build/PHASE0_EXECUTION_BUILD_ARTIFACTS_v2.json'),'utf8'));
  const receipt=JSON.parse(await fs.readFile(path.join(campaignRoot,'receipts/PHASE_00_RECEIPT_v1.json'),'utf8'));
  const readiness=JSON.parse(await fs.readFile(path.join(campaignRoot,'evidence/readiness/PROJECT_READINESS_AUTOMATED_v1.json'),'utf8'));
  const sourceIntelligence=JSON.parse(await fs.readFile(path.join(campaignRoot,'evidence/source-intelligence/SOURCE_INTELLIGENCE_AUTOMATED_v1.json'),'utf8'));
  const slither=JSON.parse(await fs.readFile(path.join(campaignRoot,'evidence/static-analysis/SLITHER_v1.json'),'utf8'));
  const sharedExecutionInputs=validateExecutionInputJoinV2({receipt,buildIdentity,artifactBundle:executionBuildArtifacts,sourceIntelligence,slither,readiness});
  const targetChainIds=phase0DiscoveredTargetChainIdsV1(readiness);
  const archivePath=receipt.source.archivePath,archiveSha256=receipt.source.sha256,workspace=path.join(path.dirname(outputRoot),'.phase0-simulation-work');
  const staged=await stageExactArchiveSource({checkoutRoot:controllerRoot,workspaceRoot:workspace,archivePath,archiveSha256,projectPath:buildIdentity.discovery.projectPath});
  const cfg=buildIdentity.configurationDetection,pseudo={requestId:`phase0-sim-${receipt.campaign.campaignId}`,requestDigest:sha256(JSON.stringify(buildIdentity)),campaignId:receipt.campaign.campaignId,campaignGenerationId:receipt.campaign.campaignGenerationId,assignmentId:'phase0-simulation',phaseId:'phase-0',profileId:'github-native-compile-v2',source:{repository:'CurveYield2/Audit-Controller',commit:receipt.source.archiveCommit,projectPath:buildIdentity.discovery.projectPath,archivePath,archiveSha256},configuration:{compilers:[{language:'solidity',version:cfg.compilerVersion}],optimizer:cfg.optimizer,evmVersion:cfg.evmVersion,viaIR:cfg.viaIR}};
  const packageDependencyInstall=await installPackageRuntimeDependenciesV1(staged.projectRoot);
  const build={
    status:'completed',
    system:executionBuildArtifacts.buildIdentity?.system??buildIdentity.build?.system??null,
    compilerVersion:executionBuildArtifacts.buildIdentity?.compilerVersion??buildIdentity.build?.compilerVersion??null,
    compilerVersions:executionBuildArtifacts.buildIdentity?.compilerVersions??buildIdentity.build?.compilerVersions??[],
    compilerProfiles:executionBuildArtifacts.buildIdentity?.compilerProfiles??buildIdentity.build?.compilerProfiles??[],
    deploymentOrder:executionBuildArtifacts.buildIdentity?.deploymentOrder??[],
    compileGroups:executionBuildArtifacts.buildIdentity?.compileGroups??[],
    embeddedBuildContract:executionBuildArtifacts.buildIdentity?.embeddedBuildContract??null,
    artifacts:sharedExecutionInputs.artifacts
  },ethers=await import('ethers');
  await fs.rm(outputRoot,{recursive:true,force:true});await fs.mkdir(path.join(outputRoot,'runs'),{recursive:true});
  let anvil;
  let deploymentEvidence=null;
  try{
    const detected=await detectDeploymentScripts(staged.projectRoot);
    const sourceKnownCompilation={
      status:'PASS',
      planPath:build.embeddedBuildContract?.deploymentSetModule??null,
      groups:build.compileGroups??[],
      artifacts:build.artifacts??[],
      selectedTargets:(build.artifacts??[]).map((artifact,index)=>({groupIndex:null,contractName:artifact.contractName,sourceName:artifact.sourceName,qualifiedName:`${artifact.sourceName}:${artifact.contractName}`,profile:artifact.profile??null,compilationUnitId:artifact.compilationUnitId??null,index})),
      missingTargets:[],
      limitations:[],
      compilerProfiles:build.compilerProfiles??[],
      reuseBasis:'EXACT_ACCEPTED_PHASE0_EXECUTION_BUILD_ARTIFACTS_V2'
    };
    const artifactByQualified=new Map();
    for(const artifact of build.artifacts??[])artifactByQualified.set(`${artifact.sourceName}:${artifact.contractName}`,artifact);
    const artifacts=[...artifactByQualified.values()];
    anvil=await startAnvil({forkUrl,projectRoot:staged.projectRoot,evmVersion:cfg.evmVersion});
    const provider=new ethers.JsonRpcProvider(anvil.url,1,{staticNetwork:true,cacheTimeout:-1}),actors=await provider.send('eth_accounts',[]),initialBlock=Number(await provider.getBlockNumber());
    const deployment=await executeDeploymentScripts({projectRoot:staged.projectRoot,anvilUrl:anvil.url,account0:actors[0],localSigner:anvil.localSigner,detected});
    const scriptEnd=Number(await provider.getBlockNumber());
    const discoveredScriptDeployments=scriptEnd>=initialBlock+1?await discoverDeployments({provider,artifacts,startBlock:initialBlock+1,endBlock:scriptEnd}):[];
    const reported=await reportedPackageDeployments({projectRoot:staged.projectRoot,attempts:deployment.attempts,artifacts});
    const deploymentRowsByAddress=new Map();
    for(const row of [...discoveredScriptDeployments,...reported.rows])deploymentRowsByAddress.set(String(row.address).toLowerCase(),row);
    const scriptDeployments=[...deploymentRowsByAddress.values()];
    const expectedNativeNames=new Set(build.deploymentOrder??[]);
    const observedNativeNames=new Set(scriptDeployments.map(x=>x.contractName).filter(Boolean));
    const nativeScriptComplete=deployment.status==='PASS'&&[...expectedNativeNames].every(name=>observedNativeNames.has(name));
    const sourcePlan=nativeScriptComplete
      ? {status:'SKIPPED_PACKAGE_DEPLOYMENT_SCRIPT_COMPLETE',planPath:null,planned:0,rows:[],attempts:[],limitations:[],unresolvedSteps:0}
      : await deploySourceKnownPlanV1({projectRoot:staged.projectRoot,provider,ethers,artifacts,detected,deploymentOrder:build.deploymentOrder??[]});
    const fallback=await fallbackDeploy({provider,ethers,artifacts,existing:[...scriptDeployments,...sourcePlan.rows]}),deployed=[...scriptDeployments,...sourcePlan.rows,...fallback.rows];
    let targets=targetObjects(ethers,artifacts,deployed,sourceIntelligence);
    const delegateContexts=await augmentDelegateProxyContextsV2({provider,ethers,targets,artifacts,deployed,sourceIntelligence});
    targets=delegateContexts.targets;
    const runtimePreparation=await prepareQualifiedRuntimeV2({provider,ethers,targets,actors});
    runtimePreparation.contextEvidence=delegateContexts.contextEvidence;
    targets=runtimePreparation.targets;
    const deploymentCombined={detectedScripts:detected,scriptDispositions:deployment.scriptDispositions??[],attempts:[...deployment.attempts,...sourcePlan.attempts],runtimePreparation,limitations:[...deployment.limitations,...reported.limitations,...(sourceKnownCompilation.limitations??[]),...sourcePlan.limitations,...fallback.limitations],deployedContracts:deployed,sourceKnownCompilation:{status:sourceKnownCompilation.status,path:sourceKnownCompilation.planPath,declaredGroups:sourceKnownCompilation.groups?.length??0,compiledArtifacts:sourceKnownCompilation.artifacts?.length??0,selectedTargets:sourceKnownCompilation.selectedTargets?.length??0,missingTargets:sourceKnownCompilation.missingTargets?.length??0},sourceKnownPlan:{status:sourcePlan.status,path:sourcePlan.planPath,plannedContracts:sourcePlan.planned,deployedContracts:sourcePlan.rows.length,unresolvedSteps:sourcePlan.unresolvedSteps},coverage:{sourcePlanPlanned:sourcePlan.planned,sourcePlanDeployed:sourcePlan.rows.length,sourcePlanUnresolved:sourcePlan.unresolvedSteps,sourceKnownCompiledTargets:sourceKnownCompilation.selectedTargets?.length??0,sourceKnownMissingTargets:sourceKnownCompilation.missingTargets?.length??0,zeroArgFallbackCandidates:fallback.candidateCount??0,zeroArgFallbackDeployed:fallback.rows.length,mutableTargets:targets.length},status:(deployment.status==='PASS'||sourcePlan.status==='PASS'||deployed.length)?(sourcePlan.unresolvedSteps===0&&(sourceKnownCompilation.missingTargets?.length??0)===0?'PASS':'COMPLETE_WITH_FAILURES'):'NO_EXECUTABLE_DEPLOYMENT'};
    // Persist deployment diagnostics before any expensive randomized stage.
    deploymentEvidence={...deploymentCombined,packageDependencyInstall,policy:'ANVIL_ONLY_FRAMEWORK_NATIVE_SCRIPT_ADAPTERS_NO_SOURCE_MUTATION_NO_PRODUCTION_SECRETS'};
    await fs.writeFile(path.join(outputRoot,'PHASE0_DEPLOY_CONFIG_EXECUTION_v1.json'),JSON.stringify(deploymentEvidence,null,2)+'\n');
    const completeBeforeTesting=(nativeScriptComplete||sourcePlan.unresolvedSteps===0)&&(sourceKnownCompilation.missingTargets?.length??0)===0;
    if(!completeBeforeTesting){
      const error=new Error('Deployment graph is incomplete; randomized stages are blocked. Inspect retained PHASE0_DEPLOY_CONFIG_EXECUTION_v1.json for native script failures.');
      error.code='PHASE0_DEPLOYMENT_INCOMPLETE';
      await provider.destroy();
      throw error;
    }
    // Fixture synthesis is best effort: a failure is recorded as a typed gap and never aborts the simulation.
    let valuePool,fixtureFunding;
    try{valuePool=await discoverValuePoolV1({provider,ethers,targets,actors});}
    catch(error){valuePool={addresses:[],tokens:[],associations:{},privileged:[],created:[],receipts:[],gaps:[{type:'VALUE_POOL_DISCOVERY_FAILED',message:String(error?.message??error).slice(0,1200)}]};}
    try{
      fixtureFunding=await fundActorsV1({
        provider,ethers,tokens:valuePool.tokens,
        holders:[...actors,...PHASE0_MEDUSA_SENDERS_V1],
        spenders:targets.map(x=>x.address)
      });
    }catch(error){fixtureFunding={holders:[],spenders:[],slotResults:[],rpcMutations:[],transactionReceipts:[],receiptCounts:{},permit2:null,gaps:[{type:'ACTOR_FUNDING_FAILED',message:String(error?.message??error).slice(0,1200)}]};}
    const stage2Holders=[...actors,...PHASE0_MEDUSA_SENDERS_V1];
    const stage2Creations=[],stage2CreationGaps=[],stage2Approvals=[],stage2CreatedTokenFunding=[],stage2Rounds=[],stage2CreatedDeployments=[];
    let pendingCreatorTargets=[...targets],stage2Round=0;
    while(pendingCreatorTargets.length&&(valuePool.created?.length??0)<20&&stage2Round<20){
      stage2Round++;
      let creatorRound;
      try{
        creatorRound=await executeCreatorSynthesisV1({
          provider,ethers,targets:pendingCreatorTargets,actors,valuePool,artifacts,
          maxAttemptsPerCandidate:24,maxSuccessesPerCandidate:3,
          maxCreatedContracts:Math.max(0,20-(valuePool.created?.length??0))
        });
      }catch(error){
        stage2CreationGaps.push({type:'CREATOR_SYNTHESIS_EXECUTION_FAILED',round:stage2Round,message:String(error?.message??error).slice(0,1600)});
        break;
      }
      stage2Creations.push(...creatorRound.creations);
      stage2CreationGaps.push(...creatorRound.creationGaps);
      stage2CreatedDeployments.push(...creatorRound.createdDeployments);
      for(const synthetic of creatorRound.syntheticArtifacts){
        const q=`${synthetic.sourceName}:${synthetic.contractName}`;
        if(!artifacts.some(a=>`${a.sourceName}:${a.contractName}`===q))artifacts.push(synthetic);
      }
      const createdAddresses=[...new Set(creatorRound.creations.flatMap(row=>row.createdAddresses??[]).map(x=>String(x).toLowerCase()))];
      const existingTokens=valuePool.tokens.filter(token=>!creatorRound.createdTokens.some(created=>String(created.address).toLowerCase()===String(token?.address??token).toLowerCase()));
      if(createdAddresses.length){
        try{
          const approval=await approveFixtureSpendersV1({provider,ethers,tokens:existingTokens,holders:stage2Holders,spenders:createdAddresses});
          stage2Approvals.push({round:stage2Round,...approval});
        }catch(error){stage2Approvals.push({round:stage2Round,holders:stage2Holders,spenders:createdAddresses,transactionReceipts:[],receiptCounts:{},gaps:[{type:'STAGE2_CREATED_SPENDER_APPROVALS_FAILED',message:String(error?.message??error).slice(0,1200)}]});}
      }
      if(creatorRound.createdTokens.length){
        try{
          const funding=await fundActorsV1({
            provider,ethers,tokens:creatorRound.createdTokens,holders:stage2Holders,
            spenders:[...targets.map(x=>x.address),...createdAddresses]
          });
          stage2CreatedTokenFunding.push({round:stage2Round,...funding});
        }catch(error){stage2CreatedTokenFunding.push({round:stage2Round,holders:stage2Holders,spenders:createdAddresses,slotResults:[],transactionReceipts:[],receiptCounts:{},gaps:[{type:'STAGE2_CREATED_TOKEN_FUNDING_FAILED',message:String(error?.message??error).slice(0,1200)}]});}
      }
      const boundRows=creatorRound.createdDeployments.filter(row=>row?.qualifiedName);
      let newTargets=targetObjects(ethers,artifacts,boundRows,sourceIntelligence);
      if(newTargets.length){
        try{
          const prepared=await prepareQualifiedRuntimeV2({provider,ethers,targets:newTargets,actors});
          newTargets=prepared.targets;
          runtimePreparation.setupReceipts.push(...(prepared.setupReceipts??[]));
        }catch(error){
          stage2CreationGaps.push({type:'CREATED_TARGET_RUNTIME_PREPARATION_FAILED',round:stage2Round,message:String(error?.message??error).slice(0,1200)});
        }
      }
      const existingTargetKeys=new Set(targets.map(target=>`${String(target.address).toLowerCase()}|${target.logicalQualifiedName??target.qualifiedName}`));
      const admitted=[];
      for(const target of newTargets){
        const key=`${String(target.address).toLowerCase()}|${target.logicalQualifiedName??target.qualifiedName}`;
        if(existingTargetKeys.has(key))continue;
        existingTargetKeys.add(key);targets.push(target);admitted.push(target);
      }
      stage2Rounds.push({
        round:stage2Round,candidates:creatorRound.candidates,successfulCreations:creatorRound.creations.length,
        createdContracts:creatorRound.createdContracts,boundTargets:admitted.length,createdAddresses
      });
      pendingCreatorTargets=admitted;
      if(!creatorRound.creations.length&&!admitted.length)break;
    }
    let stage3AssociationHarvest={receipts:[],gaps:[],newTokens:[]},stage3AssociationTokenFunding=null,stage3Activation={activations:[],activationGaps:[],createdContracts:valuePool.created?.length??0};
    if((valuePool.created?.length??0)>0){
      try{
        stage3AssociationHarvest=await refreshCreatedAssociationsV1({
          provider,ethers,createdAddresses:valuePool.created,targets,
          bindings:stage2CreatedDeployments,artifacts,valuePool
        });
      }catch(error){
        stage3AssociationHarvest={receipts:[],gaps:[{type:'CREATED_ASSOCIATION_REFRESH_FAILED',message:String(error?.message??error).slice(0,1600)}],newTokens:[]};
      }
      if(stage3AssociationHarvest.newTokens.length){
        try{
          stage3AssociationTokenFunding=await fundActorsV1({
            provider,ethers,tokens:stage3AssociationHarvest.newTokens,holders:stage2Holders,
            spenders:targets.map(target=>target.address)
          });
        }catch(error){
          stage3AssociationTokenFunding={holders:stage2Holders,spenders:targets.map(target=>target.address),slotResults:[],rpcMutations:[],transactionReceipts:[],receiptCounts:{},permit2:null,gaps:[{type:'STAGE3_ASSOCIATION_TOKEN_FUNDING_FAILED',message:String(error?.message??error).slice(0,1600)}]};
        }
      }
      try{
        stage3Activation=await executeActivationSynthesisV1({
          provider,ethers,targets,actors,valuePool,artifacts,createdAddresses:valuePool.created,maxAttemptsPerCreated:30
        });
      }catch(error){
        stage3Activation={activations:[],activationGaps:[{type:'ACTIVATION_SYNTHESIS_EXECUTION_FAILED',message:String(error?.message??error).slice(0,1600)}],createdContracts:valuePool.created.length};
      }
    }
    const serializedValuePool=serializeValuePoolV1(valuePool);
    const fixtureEvidence={
      schemaVersion:'curveyield-phase0-fixture-synthesis-v1',
      stage:'STAGE_3_INITIALIZATION_AND_ACTIVATION',
      valuePool:serializedValuePool,
      funding:fixtureFunding,
      creations:stage2Creations,
      creationGaps:stage2CreationGaps,
      creatorRounds:stage2Rounds,
      createdSpenderApprovals:stage2Approvals,
      createdTokenFunding:stage2CreatedTokenFunding,
      associationHarvest:{
        receipts:stage3AssociationHarvest.receipts,
        gaps:stage3AssociationHarvest.gaps,
        newTokens:stage3AssociationHarvest.newTokens
      },
      associationTokenFunding:stage3AssociationTokenFunding,
      activations:stage3Activation.activations,
      activationGaps:stage3Activation.activationGaps
    };
    await fs.writeFile(path.join(outputRoot,'runs','PHASE0_FIXTURE_SYNTHESIS_v1.json'),JSON.stringify(fixtureEvidence,null,2)+'\n');
    const fixtureSynthesis={
      schemaVersion:fixtureEvidence.schemaVersion,
      stage:fixtureEvidence.stage,
      evidenceRef:'runs/PHASE0_FIXTURE_SYNTHESIS_v1.json',
      valuePool:serializedValuePool,
      funding:{
        holders:fixtureFunding.holders,
        spenders:fixtureFunding.spenders,
        slotResults:fixtureFunding.slotResults,
        receiptCounts:fixtureFunding.receiptCounts,
        permit2:fixtureFunding.permit2,
        gaps:fixtureFunding.gaps
      },
      creations:stage2Creations,
      creationGaps:stage2CreationGaps,
      creatorRounds:stage2Rounds,
      createdSpenderApprovals:stage2Approvals.map(row=>({round:row.round,spenders:row.spenders,receiptCounts:row.receiptCounts,gaps:row.gaps})),
      createdTokenFunding:stage2CreatedTokenFunding.map(row=>({round:row.round,slotResults:row.slotResults,receiptCounts:row.receiptCounts,gaps:row.gaps})),
      associationHarvest:{
        receiptCount:stage3AssociationHarvest.receipts.length,
        gaps:stage3AssociationHarvest.gaps,
        newTokens:stage3AssociationHarvest.newTokens
      },
      associationTokenFunding:stage3AssociationTokenFunding?{
        slotResults:stage3AssociationTokenFunding.slotResults,
        receiptCounts:stage3AssociationTokenFunding.receiptCounts,
        gaps:stage3AssociationTokenFunding.gaps
      }:null,
      activations:stage3Activation.activations,
      activationGaps:stage3Activation.activationGaps
    };
    const baselineBlock=Number(await provider.getBlockNumber()),baselineHash=(await provider.getBlock(baselineBlock))?.hash??null,baselineSnapshot=await provider.send('evm_snapshot',[]);
    const deploymentComplete=(nativeScriptComplete||sourcePlan.unresolvedSteps===0)&&(sourceKnownCompilation.missingTargets?.length??0)===0;
    let medusa;
    let medusaExecutionFailure=null;
    const shouldRunMedusa=targets.length&&(!telemetrySmoke||medusaSmoke);
    if(shouldRunMedusa){
      try{
        let medusaNode=null,stateSource={mode:'LIVE_FORK_ANVIL'};
        try{
          medusaNode=await startStateSnapshotAnvilV1({sourceUrl:anvil.url,projectRoot:staged.projectRoot,evmVersion:cfg.evmVersion});
          stateSource={mode:'NETWORK_FREE_POST_DEPLOYMENT_STATE_SNAPSHOT',sourceBlock:medusaNode.sourceBlock,snapshotBlock:medusaNode.blockNumber,stateBytes:medusaNode.stateBytes};
        }catch(error){stateSource={mode:'LIVE_FORK_ANVIL',snapshotFailure:String(error?.message??error).slice(0,1200)};}
        console.log(`[phase0-medusa] state source: ${JSON.stringify(stateSource)}`);
        try{
          medusa=await runMedusaShardsV2({projectRoot:staged.projectRoot,anvilUrl:medusaNode?.url??anvil.url,blockNumber:medusaNode?.blockNumber??baselineBlock,ethers,targets,outRoot:outputRoot,valuePool,...(medusaSmoke?{minimumRequiredCalls:medusaSmokeCalls,shardCallLimit:Math.max(medusaSmokeCalls,1000)}:{})});
          medusa.stateSource=stateSource;
        }finally{if(medusaNode)await medusaNode.close();}
      }catch(error){
        medusaExecutionFailure={type:'MEDUSA_EXECUTION_FAILURE',code:error?.code??null,message:String(error?.message??error).slice(0,3000)};
        medusa={schemaVersion:'curveyield-phase0-medusa-run-v2',runId:'medusa-anvil-fork-001',status:'FAILED_EXECUTION',configuredCallLimit:PHASE0_MEDUSA_CALL_LIMIT_V1,minimumRequiredCalls:PHASE0_MEDUSA_MIN_CALLS_V1,observedCalls:0,limitations:[medusaExecutionFailure]};
        console.log(`[phase0-medusa] failed but workflow will continue to remaining executable stages: ${medusaExecutionFailure.message}`);
      }
    }else if(!targets.length){
      medusa={schemaVersion:'curveyield-phase0-medusa-run-v2',runId:'medusa-anvil-fork-001',status:'BLOCKED_NO_EXECUTABLE_TARGETS',configuredCallLimit:PHASE0_MEDUSA_CALL_LIMIT_V1,minimumRequiredCalls:PHASE0_MEDUSA_MIN_CALLS_V1,observedCalls:0};
    }else{
      medusa={schemaVersion:'curveyield-phase0-medusa-run-v2',runId:'medusa-anvil-fork-001',status:'SKIPPED_TELEMETRY_SMOKE',configuredCallLimit:0,minimumRequiredCalls:0,observedCalls:0};
    }
    let telemetry=[];
    let telemetryExecutionFailure=null;
    const shouldRunTelemetry=targets.length&&(!medusaSmoke||telemetrySmoke);
    if(shouldRunTelemetry){
      try{
        telemetry=await runTelemetry({provider,ethers,targets,actors,outRoot:outputRoot,baselineSnapshot,artifacts,valuePool,...(telemetrySmoke?{telemetryRuns:1,callsPerRun:telemetrySmokeCalls}:{})});
      }catch(error){
        telemetryExecutionFailure={type:'ABI_TELEMETRY_EXECUTION_FAILURE',code:error?.code??null,message:String(error?.message??error).slice(0,3000)};
        console.log(`[phase0-telemetry] failed but workflow will continue to evidence finalization: ${telemetryExecutionFailure.message}`);
      }
    }
    const runIndex={schemaVersion:'curveyield-phase0-simulation-run-index-v1',purpose:'LATER_REVIEWER_INVESTIGATION_AND_TARGET_DESIGN',sourceIdentity:{campaignId:receipt.campaign.campaignId,sourceSha256:receipt.source.sha256},targetEvmChainIds:targetChainIds,executionNormalization:{policy:'ALL_EVM_PACKAGES_USE_CANONICAL_ETHEREUM_ANVIL_BASELINE',chain:'ethereum',chainId:1},fork:{engine:'anvil',chain:'ethereum',chainId:1,baselineBlock,baselineBlockHash:baselineHash,upstreamRpcExposed:false,identityNormalized:anvil.identityNormalized===true,observedUpstreamChainId:anvil.upstreamChainId},deployment:deploymentCombined,policy:{realAbiCallsOnly:true,rawRandomBytes:false,accountingActionWeight:PHASE0_ACCOUNTING_ACTION_WEIGHT_V1,crossContractBursts:true,medusaMinimumCalls:PHASE0_MEDUSA_MIN_CALLS_V1},runs:[{runId:medusa.runId,type:'MEDUSA_ANVIL_FORK',status:medusa.status,summaryRef:medusa.shards?'runs/MEDUSA_SHARDS_SUMMARY_v1.json':'runs/medusa-anvil-fork-001/RUN_SUMMARY_v1.json',shards:(medusa.shards??[]).map(x=>({runId:x.runId,configId:x.configId,status:x.status,summaryRef:x.summaryRef}))},...telemetry.map(x=>({runId:x.runId,type:'ABI_ACCOUNTING_TELEMETRY',status:x.status,summaryRef:`runs/${x.runId}/RUN_SUMMARY_v1.json`,rawTranscriptRef:x.rawTranscriptRef}))]};
    const simulationLimitations=[...deploymentCombined.limitations,...(telemetry.filter(x=>x.weightingLimitation).map(x=>({type:x.weightingLimitation,runId:x.runId})))];
    if(medusaExecutionFailure)simulationLimitations.push(medusaExecutionFailure);
    if(telemetryExecutionFailure)simulationLimitations.push(telemetryExecutionFailure);
    if(!['PASS','BLOCKED_NO_EXECUTABLE_TARGETS','SKIPPED_TELEMETRY_SMOKE'].includes(medusa.status))simulationLimitations.push({type:'MEDUSA_BASELINE_'+String(medusa.status),runId:medusa.runId});
    const expectedTelemetryRuns=telemetrySmoke?1:(medusaSmoke?0:PHASE0_TELEMETRY_RUNS_V1);
    const medusaRequired=!telemetrySmoke||medusaSmoke;
    const telemetryComplete=telemetry.length===expectedTelemetryRuns&&telemetry.every(x=>x.status==='PASS');
    const medusaComplete=!medusaRequired||medusa.status==='PASS';
    const executionMode=telemetrySmoke?(medusaSmoke?'MEDUSA_AND_TELEMETRY_SMOKE':'TELEMETRY_SMOKE'):(medusaSmoke?'MEDUSA_SMOKE':'ALL_PHASE0_STAGES');
    const summary={schemaVersion:'curveyield-phase0-randomized-simulation-summary-v2',capabilityContractVersion:CAPABILITY_CONTRACT_VERSION_V2,campaignId:receipt.campaign.campaignId,targetEvmChainIds:targetChainIds,executionNormalization:{policy:'ALL_EVM_PACKAGES_USE_CANONICAL_ETHEREUM_ANVIL_BASELINE',chain:'ethereum',chainId:1},executionMode,status:medusaComplete&&telemetryComplete?'PASS':'COMPLETE_WITH_TYPED_LIMITATIONS',executionStatus:medusaComplete&&telemetryComplete?'COMPLETED':'PARTIAL',checkStatus:medusa.checkStatus??'UNKNOWN',reachabilityStatus:telemetry.some(x=>x.reachabilityStatus==='REACHABLE')?'REACHABLE':'REACHABILITY_GAP',observationStatus:telemetry.length&&telemetry.every(x=>x.observationStatus==='COMPLETE')?'COMPLETE':(telemetry.some(x=>x.observationStatus==='PARTIAL')?'PARTIAL':'UNAVAILABLE'),fixtureSynthesis,medusa,telemetry:telemetry.map(x=>({runId:x.runId,status:x.status,calls:x.calls,plannedActions:x.plannedActions,terminalActions:x.terminalActions,submittedActions:x.submittedActions,accountingActions:x.accountingActions,accountingActionShare:x.accountingActionShare,accountingFunctionCount:x.accountingFunctionCount,otherFunctionCount:x.otherFunctionCount,weightingLimitation:x.weightingLimitation,minedSuccess:x.minedSuccess,minedRevert:x.minedRevert,simulatedRejection:x.simulatedRejection,simulationInfrastructureError:x.simulationInfrastructureError,submissionInfrastructureError:x.submissionInfrastructureError,submittedOutcomeUnknown:x.submittedOutcomeUnknown,notExecutedEncodingOrPlanning:x.notExecutedEncodingOrPlanning,positiveTransitions:x.positiveTransitions,positiveEconomicTransitions:x.positiveEconomicTransitions,lifecycleFamilies:x.lifecycleFamilies,observationReads:x.observationReads,observationFailures:x.observationFailures,decodedRevertReasons:x.decodedRevertReasons,executionStatus:x.executionStatus,coverageStatus:x.coverageStatus,reachabilityStatus:x.reachabilityStatus,observationStatus:x.observationStatus,feedbackStatus:x.feedbackStatus,feedbackUpdates:x.feedbackUpdates,feedbackSelections:x.feedbackSelections,contextAdaptations:x.contextAdaptations,reconciliation:x.reconciliation,byContract:x.byContract,byFunction:x.byFunction,resetEvidence:x.resetEvidence,actionSequenceDigestSha256:x.actionSequenceDigestSha256,outcomeSequenceDigestSha256:x.outcomeSequenceDigestSha256,successes:x.successes,reverts:x.reverts,errors:x.errors,rawTranscriptRef:x.rawTranscriptRef,rawTranscriptSha256:x.rawTranscriptSha256,rawTranscriptBytes:x.rawTranscriptBytes,burstSchedule:x.burstSchedule})),deployment:deploymentCombined,baselineTargetDispositions:baselineTargetRows({medusa,telemetry}),limitations:simulationLimitations};
    await fs.writeFile(path.join(outputRoot,'PHASE0_SIMULATION_RUN_INDEX_v1.json'),JSON.stringify(runIndex,null,2)+'\n');await fs.writeFile(path.join(outputRoot,'PHASE0_RANDOMIZED_SIMULATION_SUMMARY_v1.json'),JSON.stringify(summary,null,2)+'\n');
    const deployEvidence={schemaVersion:'curveyield-lite-phase0-deploy-config-execution-v2',policy:'ANVIL_ONLY_FRAMEWORK_NATIVE_SCRIPT_ADAPTERS_NO_SOURCE_MUTATION_NO_PRODUCTION_SECRETS',packageDependencyInstall,fork:{engine:'anvil',chain:'ethereum',chainId:1,baselineBlock,baselineBlockHash:baselineHash},attempts:deploymentCombined.attempts,scriptDispositions:deploymentCombined.scriptDispositions,deployedContracts:deployed,gaps:deploymentCombined.limitations,sourceKnownCompilation:deploymentCombined.sourceKnownCompilation,sourceKnownPlan:deploymentCombined.sourceKnownPlan,coverage:deploymentCombined.coverage,status:deploymentCombined.status};
    await fs.writeFile(path.join(outputRoot,'PHASE0_DEPLOY_CONFIG_EXECUTION_v1.json'),JSON.stringify(deployEvidence,null,2)+'\n');await provider.destroy();
    return{summary,runIndex,deployEvidence};
  }catch(error){
    const typed={type:'PHASE0_SIMULATION_FAILURE',code:error?.code??'PHASE0_SIMULATION_FAILURE',message:String(error?.message??error),targetChainIds,securityEffect:'REQUIRES_PHASE6_INTERPRETATION'};
    const limitation={
      schemaVersion:'curveyield-phase0-randomized-simulation-summary-v1',
      status:'BLOCKED',
      code:typed.code,
      message:typed.message,
      targetEvmChainIds:targetChainIds,
      executionNormalization:{policy:'ALL_EVM_PACKAGES_USE_CANONICAL_ETHEREUM_ANVIL_BASELINE',chain:'ethereum',chainId:1},
      limitations:[typed],
      medusa:error.medusa??{status:'BLOCKED',configuredCallLimit:PHASE0_MEDUSA_CALL_LIMIT_V1,minimumRequiredCalls:PHASE0_MEDUSA_MIN_CALLS_V1,observedCalls:0},
      telemetry:[],
      deployment:deploymentEvidence,
      baselineTargetDispositions:[{
        candidateKey:'PHASE0-BASELINE-RANDOMIZED-SIMULATION',
        executionEvidenceRefs:['evidence/phase0/PHASE0_RANDOMIZED_SIMULATION_SUMMARY_v1.json'],
        oracleOutcome:'BLOCKED',
        reproductionStatus:'BLOCKED',
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
    return{summary:limitation,runIndex,deployEvidence:deploymentEvidence};
  }finally{if(anvil)await anvil.close().catch(()=>{});}
}
