#!/usr/bin/env node
import fs from 'node:fs/promises';
import fss from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {setTimeout as sleep} from 'node:timers/promises';
import solc from 'solc';
import * as ethers from 'ethers';
import {
  targetObjects,
  augmentDelegateProxyContextsV2,
  prepareQualifiedRuntimeV2,
  runMedusa,
  runTelemetry,
  detectDeploymentScripts,
  executeDeploymentScripts,
  PHASE0_MEDUSA_MIN_CALLS_V1,
  PHASE0_TELEMETRY_CALLS_PER_RUN_V1,
  PHASE0_TELEMETRY_RUNS_V1
} from '../src/phase0-randomized-simulation-v1.mjs';

const root=path.resolve('.');
const fixturePath=path.join(root,'packages/github-native-sim/test/fixtures/phase0-v2/Phase0Qualification.sol');
const outRoot=path.resolve(process.argv[2]??'.audit-evidence/phase0-v2-acceptance');
const sourceName='Phase0Qualification.sol';

function assertThat(v,m){if(!v)throw new Error('PHASE0_V2_ACCEPTANCE: '+m);}
function now(){return new Date().toISOString();}
async function rpc(url,method,params=[]){
  const r=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});
  const j=await r.json();if(j.error)throw new Error(j.error.message??JSON.stringify(j.error));return j.result;
}
async function startAnvil(){
  const port=9545,url=`http://127.0.0.1:${port}`;
  const executable=path.resolve('node_modules/@foundry-rs/anvil/bin.mjs');
  const child=spawn(process.execPath,[executable,'--host','127.0.0.1','--port',String(port),'--chain-id','1','--hardfork','cancun','--accounts','20','--silent'],{stdio:['ignore','ignore','pipe']});
  let stderr='';child.stderr.on('data',x=>stderr=(stderr+String(x)).slice(-12000));
  const started=Date.now();
  while(Date.now()-started<30000){
    if(child.exitCode!==null)throw new Error('Anvil exited: '+stderr);
    try{if(await rpc(url,'eth_chainId'))break;}catch{}
    await sleep(100);
  }
  assertThat(Date.now()-started<30000,'Anvil readiness timeout');
  return{url,child,async close(){if(child.exitCode===null){child.kill('SIGTERM');await Promise.race([new Promise(r=>child.once('exit',r)),sleep(1500)]);if(child.exitCode===null)child.kill('SIGKILL');}}};
}
async function startCountingProxy(upstream){
  const counts=new Map();let total=0;
  const server=http.createServer(async(req,res)=>{
    try{
      const chunks=[];for await(const c of req)chunks.push(c);
      const body=Buffer.concat(chunks).toString('utf8');
      let parsed;try{parsed=JSON.parse(body);}catch{parsed=null;}
      const calls=Array.isArray(parsed)?parsed:[parsed];
      for(const call of calls){if(call?.method){total++;counts.set(call.method,(counts.get(call.method)??0)+1);}}
      const upstreamResponse=await fetch(upstream,{method:'POST',headers:{'content-type':'application/json'},body});
      res.writeHead(upstreamResponse.status,{'content-type':'application/json'});
      res.end(Buffer.from(await upstreamResponse.arrayBuffer()));
    }catch(error){res.writeHead(502,{'content-type':'application/json'});res.end(JSON.stringify({error:String(error?.message??error)}));}
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const address=server.address(),url=`http://127.0.0.1:${address.port}`;
  return{
    url,
    snapshot(){return{total,byMethod:Object.fromEntries([...counts.entries()].sort())};},
    reset(){total=0;counts.clear();},
    close(){return new Promise(r=>server.close(r));}
  };
}
function compile(source){
  const input={language:'Solidity',sources:{[sourceName]:{content:source}},settings:{optimizer:{enabled:true,runs:200},evmVersion:'cancun',outputSelection:{'*':{'*':['abi','evm.bytecode.object','evm.deployedBytecode.object','evm.methodIdentifiers','storageLayout'],'':['ast']}}}};
  const output=JSON.parse(solc.compile(JSON.stringify(input)));
  const errors=(output.errors??[]).filter(x=>x.severity==='error');
  if(errors.length)throw new Error('solc fixture compilation failed:\n'+errors.map(x=>x.formattedMessage).join('\n'));
  const artifacts=[];
  for(const [contractName,c] of Object.entries(output.contracts[sourceName]??{})){
    artifacts.push({sourceName,contractName,abi:c.abi,bytecode:'0x'+(c.evm?.bytecode?.object??''),deployedBytecode:'0x'+(c.evm?.deployedBytecode?.object??''),methodIdentifiers:c.evm?.methodIdentifiers??{},storageLayout:c.storageLayout??null});
  }
  return{artifacts,ast:output.sources[sourceName]?.ast};
}
async function deploy(artifacts,provider,contractName,args=[]){
  const a=artifacts.find(x=>x.contractName===contractName);assertThat(a,contractName+' artifact missing');
  const signer=await provider.getSigner(0),factory=new ethers.ContractFactory(a.abi,a.bytecode,signer),c=await factory.deploy(...args);
  await c.waitForDeployment();
  return{contract:c,address:await c.getAddress(),artifact:a};
}
function siFixture(){
  const names=['ERC20','QualifiedToken','ERC4626','QualifiedVault','IERC3156FlashLender','FlashLender','FlashBorrower','DelegateImplementation','DelegateProxy','TupleArrayRouter','LookalikeToken','PropertyControls'];
  const contracts=names.map((name,i)=>({contractId:`C${i+1}`,qualifiedName:`${sourceName}:${name}`}));
  const id=n=>contracts.find(x=>x.qualifiedName.endsWith(':'+n)).contractId;
  const inheritanceGraph=[
    {derivedContractId:id('QualifiedToken'),baseContractId:id('ERC20')},
    {derivedContractId:id('QualifiedVault'),baseContractId:id('ERC4626')},
    {derivedContractId:id('FlashLender'),baseContractId:id('IERC3156FlashLender')}
  ];
  return{contracts,inheritanceGraph};
}
async function readRows(out,summary){
  const rows=[];
  for(const t of summary){
    const file=path.join(out,...t.rawTranscriptRef.split('/'));
    const text=await fs.readFile(file,'utf8');
    for(const line of text.trim().split(/\r?\n/).filter(Boolean))rows.push(JSON.parse(line));
  }
  return rows;
}
function perfSnapshot(label,start,proxy,beforeCpu,beforeMem,extra={}){
  const cpu=process.resourceUsage(),mem=process.memoryUsage();
  return{
    label,wallMs:Date.now()-start,rpc:proxy.snapshot(),
    cpuUserMicros:cpu.userCPUTime-beforeCpu.userCPUTime,cpuSystemMicros:cpu.systemCPUTime-beforeCpu.systemCPUTime,
    rssDeltaBytes:mem.rss-beforeMem.rss,heapUsedDeltaBytes:mem.heapUsed-beforeMem.heapUsed,...extra
  };
}

await fs.rm(outRoot,{recursive:true,force:true});await fs.mkdir(outRoot,{recursive:true});
const source=await fs.readFile(fixturePath,'utf8');
const {artifacts}=compile(source);
await fs.writeFile(path.join(outRoot,'COMPILED_FIXTURE_INVENTORY_v1.json'),JSON.stringify({schemaVersion:'phase0-v2-qualification-fixture-v1',source:sourceName,sourcePath:path.relative(root,fixturePath).replaceAll('\\','/'),compiler:solc.version(),artifacts:artifacts.map(a=>({qualifiedName:`${a.sourceName}:${a.contractName}`,abiEntries:a.abi.length,creationBytes:(a.bytecode.length-2)/2,deployedBytes:(a.deployedBytecode.length-2)/2}))},null,2)+'\n');

const anvil=await startAnvil();
const proxy=await startCountingProxy(anvil.url);
const provider=new ethers.JsonRpcProvider(proxy.url,1,{staticNetwork:true,cacheTimeout:-1});
try{
  const actors=await provider.send('eth_accounts',[]);

  // A06-A08: one successful mechanically adapted Node deployment script, one
  // filesystem-escape attempt, and one unsupported sibling. A sibling success
  // must never erase another script's typed gap.
  const deploymentFixtureRoot=path.join(outRoot,'deployment-script-qualification');
  await fs.mkdir(deploymentFixtureRoot,{recursive:true});
  await fs.writeFile(path.join(deploymentFixtureRoot,'package.json'),JSON.stringify({
    type:'module',
    scripts:{
      'deploy:success':'node success.mjs',
      'deploy:sandbox':'node sandbox.mjs',
      'deploy:unsupported':'python unsupported.py'
    }
  },null,2)+'\n');
  await fs.writeFile(path.join(deploymentFixtureRoot,'success.mjs'),`
const NETWORK_NAME='fixture';
const resolveNetwork=()=>({chainId:999});
const network=resolveNetwork(NETWORK_NAME);
if(!process.env.RPC_URL) throw new Error('MISSING_RPC');
console.log(JSON.stringify({chainId:network.chainId,rpc:Boolean(process.env.RPC_URL),github:process.env.GITHUB_TOKEN||'NO_GITHUB'}));
`);
  await fs.writeFile(path.join(deploymentFixtureRoot,'sandbox.mjs'),`
import fs from 'node:fs';
if(!process.env.RPC_URL) throw new Error('MISSING_RPC');
console.log(fs.readFileSync('/etc/passwd','utf8'));
`);
  await fs.writeFile(path.join(deploymentFixtureRoot,'unsupported.py'),'print("unsupported")\n');
  const priorGithubToken=process.env.GITHUB_TOKEN;
  process.env.GITHUB_TOKEN='PHASE0_A08_SECRET_SENTINEL_SHOULD_NEVER_REACH_CHILD';
  const deploymentFixtureDetected=await detectDeploymentScripts(deploymentFixtureRoot);
  const deploymentFixtureResult=await executeDeploymentScripts({
    projectRoot:deploymentFixtureRoot,
    anvilUrl:proxy.url,
    account0:actors[0],
    localSigner:{address:actors[0],privateKey:'0x'+'11'.repeat(32)},
    detected:deploymentFixtureDetected
  });
  if(priorGithubToken===undefined)delete process.env.GITHUB_TOKEN;else process.env.GITHUB_TOKEN=priorGithubToken;
  const successfulAdapted=deploymentFixtureResult.attempts.find(x=>x.script==='deploy:success');
  const sandboxAttempt=deploymentFixtureResult.attempts.find(x=>x.script==='deploy:sandbox');
  const unsupportedDisposition=deploymentFixtureResult.scriptDispositions.find(x=>x.script==='deploy:unsupported');
  assertThat(successfulAdapted?.status==='PASS','A06/A07 adapted deployment script did not execute successfully');
  assertThat(successfulAdapted.originalSha256&&successfulAdapted.adaptedSha256&&successfulAdapted.originalSha256!==successfulAdapted.adaptedSha256,'A07 original/adapted deployment digests are not distinct');
  assertThat(successfulAdapted.adaptation==='LOCAL_CHAIN_ID_OVERRIDE','A07 local chain substitution is not explicit');
  assertThat(successfulAdapted.sandbox?.productionHandoffEligible===false,'A07 adapted local script incorrectly appears production-handoff eligible');
  assertThat(!String(successfulAdapted.stdout).includes('PHASE0_A08_SECRET_SENTINEL'),'A08 parent GitHub secret reached retained child output');
  assertThat(sandboxAttempt?.status==='FAILED','A08 filesystem escape fixture was not blocked');
  assertThat(/ACCESS_DENIED|permission|FileSystemRead/i.test(String(sandboxAttempt.stderr)),'A08 filesystem escape failure is not attributable to the permission boundary');
  assertThat(!String(sandboxAttempt.stdout).includes('root:x:'),'A08 outside filesystem contents leaked to retained output');
  assertThat(unsupportedDisposition?.disposition==='UNSUPPORTED_WITH_TYPED_GAP','A06 unsupported sibling script lost its explicit disposition');
  assertThat(deploymentFixtureResult.scriptDispositions.some(x=>x.script==='deploy:success'&&x.disposition==='EXECUTED_PASS'),'A06 successful sibling disposition missing');
  const token=await deploy(artifacts,provider,'QualifiedToken',[actors[0]]);
  const vault=await deploy(artifacts,provider,'QualifiedVault');
  const lender=await deploy(artifacts,provider,'FlashLender');
  const borrower=await deploy(artifacts,provider,'FlashBorrower',[lender.address]);
  const impl=await deploy(artifacts,provider,'DelegateImplementation');
  const facade=await deploy(artifacts,provider,'DelegateProxy',[impl.address]);
  const router=await deploy(artifacts,provider,'TupleArrayRouter');
  const lookalike=await deploy(artifacts,provider,'LookalikeToken');
  const controls=await deploy(artifacts,provider,'PropertyControls');
  const deployed=[token,vault,lender,borrower,impl,facade,router,lookalike,controls].map(x=>({address:x.address,qualifiedName:`${sourceName}:${x.artifact.contractName}`,contractName:x.artifact.contractName,sourceName}));

  let targets=targetObjects(ethers,artifacts,deployed,siFixture());
  const contexts=await augmentDelegateProxyContextsV2({provider,ethers,targets,artifacts,deployed,sourceIntelligence:siFixture()});
  targets=contexts.targets;
  const prep=await prepareQualifiedRuntimeV2({provider,ethers,targets,actors});
  targets=prep.targets;
  const byLogical=(name)=>targets.filter(t=>(t.logicalQualifiedName??t.qualifiedName)===`${sourceName}:${name}`);

  assertThat(byLogical('QualifiedToken').some(t=>t.recipe?.recipeId==='erc20-standard-v1'),'A12/A18 token recipe not qualified');
  assertThat(byLogical('QualifiedVault').some(t=>t.recipe?.recipeId==='erc4626-standard-v1'),'A18 vault recipe not qualified');
  assertThat(byLogical('FlashLender').some(t=>t.recipe?.recipeId==='erc3156-flash-lender-v1'),'A10 callback lender recipe not qualified');
  assertThat(byLogical('LookalikeToken').every(t=>t.recipe?.status==='ORACLE_GAP'),'A12 lookalike token incorrectly qualified');
  assertThat(byLogical('DelegateImplementation').some(t=>t.contextType==='DIRECT'),'A09 direct delegate implementation context missing');
  assertThat(byLogical('DelegateImplementation').some(t=>t.contextType==='DELEGATE_PROXY'),'A09/A10 delegate proxy context missing');

  const controlTarget=byLogical('PropertyControls')[0];
  controlTarget.propertyCategory='HARNESS_SELF_CHECK';
  proxy.reset();
  let start=Date.now(),cpu=process.resourceUsage(),mem=process.memoryUsage();
  const control=await runMedusa({projectRoot:root,anvilUrl:proxy.url,blockNumber:Number(await provider.getBlockNumber()),ethers,targets:[controlTarget],outRoot,callLimit:2500,minimumRequiredCalls:1000,runId:'medusa-controls-v2'});
  const controlPerf=perfSnapshot('medusa-controls',start,proxy,cpu,mem,{observedCalls:control.observedCalls});
  const controlStatuses=(control.engineProperties??[]).map(x=>x.status);
  assertThat(controlStatuses.includes('passed')&&controlStatuses.includes('failed'),'A15 Medusa control pair did not produce native pass and fail outcomes');
  assertThat((control.propertyRegistry??[]).every(x=>x.category==='HARNESS_SELF_CHECK'),'A15 control properties leaked into target assurance');

  const mainTargets=targets.filter(t=>(t.logicalQualifiedName??t.qualifiedName)!==`${sourceName}:PropertyControls`);
  const performance=[];
  let baseline=await provider.send('evm_snapshot',[]);
  for(const seed of ['perf-seed-a','perf-seed-b','perf-seed-c']){
    proxy.reset();start=Date.now();cpu=process.resourceUsage();mem=process.memoryUsage();
    const short=await runTelemetry({provider,ethers,targets:mainTargets,actors,outRoot,baselineSnapshot:baseline,telemetryRuns:1,callsPerRun:180,seedSalt:seed,runPrefix:`perf-${seed}`});
    performance.push(perfSnapshot(seed,start,proxy,cpu,mem,{attempts:short[0].calls,positiveTransitions:short[0].positiveTransitions,positiveEconomicTransitions:short[0].positiveEconomicTransitions,artifactBytes:short[0].rawTranscriptBytes}));
    await provider.send('evm_revert',[baseline]);baseline=await provider.send('evm_snapshot',[]);
  }

  proxy.reset();start=Date.now();cpu=process.resourceUsage();mem=process.memoryUsage();
  const medusa=await runMedusa({projectRoot:root,anvilUrl:proxy.url,blockNumber:Number(await provider.getBlockNumber()),ethers,targets:mainTargets,outRoot});
  const medusaPerf=perfSnapshot('medusa-full',start,proxy,cpu,mem,{observedCalls:medusa.observedCalls,retainedCorpusFileCount:medusa.retainedCorpusFileCount});
  assertThat(medusa.observedCalls>=PHASE0_MEDUSA_MIN_CALLS_V1,'A13 Medusa did not exceed 100K observed calls');
  assertThat(medusa.mode==='CHECKED_DISCOVERY','A13 Medusa did not enter checked mode');
  assertThat(medusa.checkStatus==='CHECKED','A14/A16/A17 target checks were not all non-vacuously checked: '+medusa.checkStatus);
  assertThat((medusa.propertyRegistry??[]).filter(x=>x.category==='TARGET_BEHAVIOR').length>=3,'A13 target property registry unexpectedly small');
  for(const p of medusa.propertyRegistry.filter(x=>x.category==='TARGET_BEHAVIOR')){
    assertThat(p.discoveredByEngine===true,'A13 property not discovered '+p.propertyId);
    assertThat((p.preconditionWitnessRefs??[]).length>0,'A16/A17 property witness missing '+p.propertyId);
    assertThat((p.executionEvidenceRefs??[]).length>0,'A17 property engine evidence missing '+p.propertyId);
  }

  await provider.send('evm_revert',[baseline]);baseline=await provider.send('evm_snapshot',[]);
  proxy.reset();start=Date.now();cpu=process.resourceUsage();mem=process.memoryUsage();
  const telemetry=await runTelemetry({provider,ethers,targets:mainTargets,actors,outRoot,baselineSnapshot:baseline});
  const telemetryPerf=perfSnapshot('telemetry-full',start,proxy,cpu,mem,{attempts:telemetry.reduce((n,x)=>n+x.calls,0),positiveTransitions:telemetry.reduce((n,x)=>n+x.positiveTransitions,0),positiveEconomicTransitions:telemetry.reduce((n,x)=>n+x.positiveEconomicTransitions,0),artifactBytes:telemetry.reduce((n,x)=>n+x.rawTranscriptBytes,0)});
  assertThat(telemetry.length===PHASE0_TELEMETRY_RUNS_V1,'A25 telemetry shard count');
  for(const t of telemetry){
    assertThat(t.calls===PHASE0_TELEMETRY_CALLS_PER_RUN_V1&&t.terminalActions===PHASE0_TELEMETRY_CALLS_PER_RUN_V1,'A25 telemetry attempt count '+t.runId);
    assertThat(t.reconciliation?.status==='PASS','A30 reconciliation '+t.runId);
    assertThat(t.simulationInfrastructureError===0&&t.submissionInfrastructureError===0&&t.submittedOutcomeUnknown===0,'A26 unresolved infrastructure outcome '+t.runId);
    assertThat(t.positiveEconomicTransitions>0,'A29 no positive economic transition '+t.runId);
  }
  const rows=await readRows(outRoot,telemetry);
  const directDelegate=rows.find(r=>r.target?.logicalQualifiedName?.endsWith(':DelegateImplementation')&&r.target?.contextType==='DIRECT'&&r.functionSignature==='setDelegateValue(uint256)'&&r.executionOutcome==='SIMULATED_REJECTION');
  const proxyDelegate=rows.find(r=>r.target?.logicalQualifiedName?.endsWith(':DelegateImplementation')&&r.target?.contextType==='DELEGATE_PROXY'&&r.functionSignature==='setDelegateValue(uint256)'&&r.executionOutcome==='MINED_SUCCESS'&&r.positiveTransition===true);
  assertThat(directDelegate,'A10 direct delegate-only rejection missing');
  assertThat(proxyDelegate,'A10 delegate facade positive transition missing');
  const callback=rows.find(r=>r.target?.logicalQualifiedName?.endsWith(':FlashLender')&&r.functionSignature==='flashLoan(address,address,uint256,bytes)'&&r.executionOutcome==='MINED_SUCCESS'&&r.positiveTransition===true);
  assertThat(callback,'A10 ERC3156 callback flow positive witness missing');
  const callbackDirect=rows.find(r=>r.target?.logicalQualifiedName?.endsWith(':FlashBorrower')&&r.functionSignature==='onFlashLoan(address,address,uint256,uint256,bytes)'&&r.executionOutcome==='SIMULATED_REJECTION');
  assertThat(callbackDirect,'A10 callback-only direct rejection missing');
  const tuple=rows.find(r=>r.target?.logicalQualifiedName?.endsWith(':TupleArrayRouter')&&r.functionSignature.startsWith('batch(')&&r.executionOutcome==='MINED_SUCCESS'&&Array.isArray(r.decodedInputs?.[0]));
  assertThat(tuple,'A05/A19 tuple-array action did not reach a mined call');
  assertThat(!rows.some(r=>r.target?.logicalQualifiedName?.endsWith(':LookalikeToken')&&r.semanticFamily==='ECONOMIC'),'A12 lookalike ABI invented economic semantics');
  assertThat(rows.some(r=>r.stages?.PREFLIGHT?.status==='FAILED'&&r.executionOutcome==='SIMULATED_REJECTION'),'A26 simulated rejection missing');
  assertThat(rows.some(r=>r.executionOutcome==='MINED_SUCCESS'&&r.stages?.RECEIPT?.status==='MINED'),'A26 mined success missing');
  assertThat(rows.every(r=>r.stages?.ARG_GEN&&r.executionOutcome),'A26 raw lifecycle fields missing');
  assertThat(rows.some(r=>(r.observations?.deltas??[]).some(d=>d.feeAdjusted===true&&d.transactionFeeWei!=null)),'A27 fee-adjusted native observation missing');
  assertThat(rows.some(r=>(r.observations?.before??[]).some(o=>String(o.quantityId??'').startsWith('related:')&&['TOKEN_BALANCE','ALLOWANCE','TOTAL_SUPPLY'].includes(o.family))),'A27 related token/share observations missing');
  assertThat(telemetry.every(t=>t.resetEvidence?.revertAccepted===true&&t.resetEvidence?.sentinelMatch===true),'A11/A24 reset evidence incomplete');
  assertThat(telemetry.some(t=>t.feedbackStatus==='ACTIVE'&&t.feedbackUpdates>0&&t.feedbackSelections>0),'A20 transition feedback did not affect later action selection');
  assertThat(telemetry.some(t=>(t.contextAdaptations??[]).some(a=>a.kind==='BOUNDED_WRONG_CONTEXT_GAP'||a.kind==='REROUTE_TO_QUALIFIED_CONTEXT')),'A23 bounded context adaptation not observed');

  const replayBaseline=await provider.send('evm_snapshot',[]);
  const replay=await runTelemetry({
    provider,ethers,targets:mainTargets,actors,outRoot,baselineSnapshot:replayBaseline,
    telemetryRuns:2,callsPerRun:96,seedSalt:'a11-deterministic-replay-v2',runPrefix:'a11-replay',repeatSameSeedAcrossRuns:true
  });
  assertThat(replay.length===2,'A11 replay did not produce two reconstructed runs');
  assertThat(replay[1].resetEvidence?.revertAccepted===true&&replay[1].resetEvidence?.sentinelMatch===true,'A11 reconstructed replay baseline was not verified');
  assertThat(replay[0].actionSequenceDigestSha256===replay[1].actionSequenceDigestSha256,'A11 replay action sequence digest mismatch');
  assertThat(replay[0].outcomeSequenceDigestSha256===replay[1].outcomeSequenceDigestSha256,'A11 replay declared outcome digest mismatch');

  performance.push(controlPerf,medusaPerf,telemetryPerf);
  for(const p of performance){
    if(p.wallMs>0&&p.positiveTransitions!==undefined)p.usefulTransitionsPerMinute=p.positiveTransitions/(p.wallMs/60000);
  }
  const result={
    schemaVersion:'curveyield-phase0-v2-live-qualification-v1',
    generatedAt:now(),status:'PASS',
    fixture:{sourcePath:path.relative(root,fixturePath).replaceAll('\\','/'),compiler:solc.version(),contractCount:artifacts.length,deployedContracts:deployed},
    recipes:targets.map(t=>({qualifiedName:t.qualifiedName,logicalQualifiedName:t.logicalQualifiedName??t.qualifiedName,address:t.address,contextType:t.contextType,recipeId:t.recipe?.recipeId??null,recipeStatus:t.recipe?.status??null})),
    runtimePreparation:prep,
    deploymentScriptQualification:{
      status:'PASS',
      scriptDispositions:deploymentFixtureResult.scriptDispositions,
      attempts:deploymentFixtureResult.attempts.map(x=>({
        framework:x.framework,script:x.script,path:x.path,adaptedPath:x.adaptedPath,
        originalSha256:x.originalSha256,adaptedSha256:x.adaptedSha256,adaptedContentChanged:x.adaptedContentChanged,
        adaptation:x.adaptation,executionOverrides:x.executionOverrides,sandbox:x.sandbox,status:x.status,
        exitCode:x.exitCode,stdout:x.stdout,stderr:x.stderr
      })),
      limitations:deploymentFixtureResult.limitations
    },
    delegateContexts:contexts.contextEvidence,
    medusa,
    controls:{status:control.status,engineProperties:control.engineProperties,propertyRegistry:control.propertyRegistry},
    telemetry,
    acceptanceWitnesses:{directDelegate,proxyDelegate,callback,callbackDirect,tuple},
    replayControl:{status:'PASS',runs:replay.map(x=>({runId:x.runId,resetEvidence:x.resetEvidence,actionSequenceDigestSha256:x.actionSequenceDigestSha256,outcomeSequenceDigestSha256:x.outcomeSequenceDigestSha256}))},
    performance,
    retainedOutputRoot:path.relative(root,outRoot).replaceAll('\\','/')
  };
  await fs.writeFile(path.join(outRoot,'PHASE0_V2_LIVE_QUALIFICATION_v1.json'),JSON.stringify(result,null,2)+'\n');
  process.stdout.write(JSON.stringify({status:'PASS',outRoot,resultRef:path.join(outRoot,'PHASE0_V2_LIVE_QUALIFICATION_v1.json'),medusaCalls:medusa.observedCalls,telemetryAttempts:telemetry.reduce((n,x)=>n+x.calls,0),positiveTransitions:telemetry.reduce((n,x)=>n+x.positiveTransitions,0),positiveEconomicTransitions:telemetry.reduce((n,x)=>n+x.positiveEconomicTransitions,0)},null,2)+'\n');
} finally {
  try { provider.destroy(); } catch {}
  await proxy.close().catch(()=>{});
  await anvil.close().catch(()=>{});
}
