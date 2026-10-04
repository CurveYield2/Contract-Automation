#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {setTimeout as sleep} from 'node:timers/promises';
import solc from 'solc';
import * as ethers from 'ethers';
import {
  targetObjects,
  augmentDelegateProxyContextsV2,
  prepareQualifiedRuntimeV2,
  runMedusa,
  runTelemetry
} from '../src/phase0-randomized-simulation-v1.mjs';

const root=path.resolve('.');
const fixturePath=path.join(root,'packages/github-native-sim/test/fixtures/phase0-v2-heldout/ZetaPacket.sol');
const outRoot=path.resolve(process.argv[2]??'.audit-evidence/phase0-v2-heldout');
const sourceName='ZetaPacket.sol';
const implNames=['ActionBundle','IndigoAsset','AmberContainer','ContextLogic','ContextShell','CobaltLender','SlateBorrower','MimicLedger'];
const assertThat=(v,m)=>{if(!v)throw new Error('PHASE0_V2_HELDOUT: '+m);};

async function rpc(url,method,params=[]){
  const r=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});
  const j=await r.json();if(j.error)throw new Error(j.error.message??JSON.stringify(j.error));return j.result;
}
async function startAnvil(){
  const port=9645,url=`http://127.0.0.1:${port}`,exe=path.resolve('node_modules/@foundry-rs/anvil/bin.mjs');
  const child=spawn(process.execPath,[exe,'--host','127.0.0.1','--port',String(port),'--chain-id','1','--hardfork','cancun','--accounts','20','--silent'],{stdio:['ignore','ignore','pipe']});
  let err='';child.stderr.on('data',x=>err=(err+String(x)).slice(-8000));
  const start=Date.now();
  while(Date.now()-start<30000){if(child.exitCode!==null)throw new Error('Anvil exited: '+err);try{if(await rpc(url,'eth_chainId'))break;}catch{}await sleep(100);}
  assertThat(Date.now()-start<30000,'Anvil readiness timeout');
  return{url,child,async close(){if(child.exitCode===null){child.kill('SIGTERM');await Promise.race([new Promise(r=>child.once('exit',r)),sleep(1200)]);if(child.exitCode===null)child.kill('SIGKILL');}}};
}
function compile(source){
  const input={language:'Solidity',sources:{[sourceName]:{content:source}},settings:{optimizer:{enabled:true,runs:200},evmVersion:'cancun',outputSelection:{'*':{'*':['abi','evm.bytecode.object','evm.deployedBytecode.object','evm.methodIdentifiers','storageLayout']}}}};
  const output=JSON.parse(solc.compile(JSON.stringify(input)));
  const errors=(output.errors??[]).filter(x=>x.severity==='error');
  if(errors.length)throw new Error(errors.map(x=>x.formattedMessage).join('\n'));
  return Object.entries(output.contracts[sourceName]??{}).map(([contractName,c])=>({
    sourceName,contractName,abi:c.abi,bytecode:'0x'+(c.evm?.bytecode?.object??''),deployedBytecode:'0x'+(c.evm?.deployedBytecode?.object??''),
    methodIdentifiers:c.evm?.methodIdentifiers??{},storageLayout:c.storageLayout??null
  }));
}
async function deploy(artifacts,provider,name,args=[]){
  const a=artifacts.find(x=>x.contractName===name);assertThat(a,name+' artifact missing');
  const signer=await provider.getSigner(0),factory=new ethers.ContractFactory(a.abi,a.bytecode,signer),c=await factory.deploy(...args);
  await c.waitForDeployment();return{address:await c.getAddress(),qualifiedName:`${sourceName}:${name}`,contractName:name,sourceName,artifact:a};
}
function sourceIntelligence(){
  const names=['ERC20','IndigoAsset','ERC4626','AmberContainer','ContextLogic','ContextShell','IERC3156FlashLender','IERC3156FlashBorrower','CobaltLender','SlateBorrower','ActionBundle','MimicLedger'];
  const contracts=names.map((name,i)=>({contractId:`H${i+1}`,qualifiedName:`${sourceName}:${name}`}));
  const id=name=>contracts.find(x=>x.qualifiedName.endsWith(':'+name)).contractId;
  return{contracts,inheritanceGraph:[
    {derivedContractId:id('IndigoAsset'),baseContractId:id('ERC20')},
    {derivedContractId:id('AmberContainer'),baseContractId:id('ERC4626')},
    {derivedContractId:id('CobaltLender'),baseContractId:id('IERC3156FlashLender')}
  ]};
}
async function rowsFor(out,summaries){
  const rows=[];
  for(const s of summaries){
    const text=await fs.readFile(path.join(out,...s.rawTranscriptRef.split('/')),'utf8');
    for(const line of text.trim().split(/\r?\n/).filter(Boolean))rows.push(JSON.parse(line));
  }
  return rows;
}

await fs.rm(outRoot,{recursive:true,force:true});await fs.mkdir(outRoot,{recursive:true});
const engineSource=await fs.readFile(path.join(root,'packages/github-native-sim/src/phase0-randomized-simulation-v1.mjs'),'utf8');
for(const name of implNames)assertThat(!engineSource.includes(name),'production engine contains held-out implementation name '+name);
const artifacts=compile(await fs.readFile(fixturePath,'utf8'));
const anvil=await startAnvil(),provider=new ethers.JsonRpcProvider(anvil.url,1,{staticNetwork:true,cacheTimeout:-1});
try{
  const actors=await provider.send('eth_accounts',[]);
  const asset=await deploy(artifacts,provider,'IndigoAsset',[actors[0]]);
  const vault=await deploy(artifacts,provider,'AmberContainer',[actors[0]]);
  const lender=await deploy(artifacts,provider,'CobaltLender');
  const borrower=await deploy(artifacts,provider,'SlateBorrower',[lender.address]);
  const logic=await deploy(artifacts,provider,'ContextLogic');
  const shell=await deploy(artifacts,provider,'ContextShell',[logic.address]);
  const bundle=await deploy(artifacts,provider,'ActionBundle');
  const mimic=await deploy(artifacts,provider,'MimicLedger');
  const deployed=[bundle,mimic,shell,logic,borrower,lender,vault,asset].map(({artifact,...x})=>x);
  const si=sourceIntelligence();
  let targets=targetObjects(ethers,artifacts,deployed,si);
  const contexts=await augmentDelegateProxyContextsV2({provider,ethers,targets,artifacts,deployed,sourceIntelligence:si});
  targets=(await prepareQualifiedRuntimeV2({provider,ethers,targets:contexts.targets,actors})).targets;
  const by=name=>targets.filter(t=>(t.logicalQualifiedName??t.qualifiedName)===`${sourceName}:${name}`);

  assertThat(by('IndigoAsset').some(t=>t.recipe?.recipeId==='erc20-standard-v1'),'renamed ERC20 recipe failed');
  assertThat(by('AmberContainer').some(t=>t.recipe?.recipeId==='erc4626-standard-v1'),'renamed ERC4626 recipe failed');
  assertThat(by('CobaltLender').some(t=>t.recipe?.recipeId==='erc3156-flash-lender-v1'),'renamed ERC3156 recipe failed');
  assertThat(by('MimicLedger').every(t=>t.recipe?.status==='ORACLE_GAP'),'lookalike incorrectly qualified');
  assertThat(by('ContextLogic').some(t=>t.contextType==='DIRECT')&&by('ContextLogic').some(t=>t.contextType==='DELEGATE_PROXY'),'delegate contexts missing');

  const baseline=await provider.send('evm_snapshot',[]);
  const medusa=await runMedusa({projectRoot:root,anvilUrl:anvil.url,blockNumber:Number(await provider.getBlockNumber()),ethers,targets,outRoot,callLimit:12000,minimumRequiredCalls:2000,runId:'heldout-medusa-v1'});
  assertThat(medusa.observedCalls>=2000,'held-out Medusa volume incomplete');
  assertThat(medusa.mode==='CHECKED_DISCOVERY'&&medusa.checkStatus==='CHECKED','held-out target properties not checked');
  assertThat((medusa.propertyRegistry??[]).filter(x=>x.category==='TARGET_BEHAVIOR').length>=3,'held-out target properties missing');

  const reverted=await provider.send('evm_revert',[baseline]);assertThat(reverted===true,'held-out baseline reset failed');
  const telemetryBaseline=await provider.send('evm_snapshot',[]);
  const telemetry=await runTelemetry({provider,ethers,targets,actors,outRoot,baselineSnapshot:telemetryBaseline,telemetryRuns:2,callsPerRun:400,seedSalt:'heldout-v1',runPrefix:'heldout-telemetry'});
  assertThat(telemetry.every(x=>x.status==='PASS'&&x.reconciliation?.status==='PASS'),'held-out telemetry did not reconcile');
  assertThat(telemetry.some(x=>x.positiveEconomicTransitions>0),'held-out economic transition missing');
  const rows=await rowsFor(outRoot,telemetry);
  assertThat(rows.some(r=>r.target?.logicalQualifiedName?.endsWith(':ContextLogic')&&r.target?.contextType==='DIRECT'&&r.functionSignature==='setObserved(uint256)'&&r.executionOutcome==='SIMULATED_REJECTION'),'held-out direct delegate rejection missing');
  assertThat(rows.some(r=>r.target?.logicalQualifiedName?.endsWith(':ContextLogic')&&r.target?.contextType==='DELEGATE_PROXY'&&r.functionSignature==='setObserved(uint256)'&&r.executionOutcome==='MINED_SUCCESS'),'held-out delegate proxy success missing');
  assertThat(rows.some(r=>r.target?.logicalQualifiedName?.endsWith(':CobaltLender')&&r.functionSignature==='flashLoan(address,address,uint256,bytes)'&&r.executionOutcome==='MINED_SUCCESS'),'held-out callback lifecycle missing');
  assertThat(rows.some(r=>r.target?.logicalQualifiedName?.endsWith(':SlateBorrower')&&r.functionSignature==='onFlashLoan(address,address,uint256,uint256,bytes)'&&r.executionOutcome==='SIMULATED_REJECTION'),'held-out direct callback rejection missing');
  assertThat(rows.some(r=>r.target?.logicalQualifiedName?.endsWith(':ActionBundle')&&r.functionSignature.startsWith('execute(')&&r.executionOutcome==='MINED_SUCCESS'&&Array.isArray(r.decodedInputs?.[0])),'held-out tuple-array call missing');
  assertThat(!rows.some(r=>r.target?.logicalQualifiedName?.endsWith(':MimicLedger')&&r.semanticFamily==='ECONOMIC'),'held-out lookalike invented economics');

  const result={schemaVersion:'curveyield-phase0-v2-heldout-qualification-v1',status:'PASS',fixture:'packages/github-native-sim/test/fixtures/phase0-v2-heldout/ZetaPacket.sol',runtimeAddresses:deployed,medusa:{status:medusa.status,observedCalls:medusa.observedCalls,checkStatus:medusa.checkStatus,properties:medusa.propertyRegistry},telemetry:telemetry.map(x=>({runId:x.runId,calls:x.calls,positiveTransitions:x.positiveTransitions,positiveEconomicTransitions:x.positiveEconomicTransitions,reconciliation:x.reconciliation,resetEvidence:x.resetEvidence})),generalization:{productionNameSpecialCases:false,renamedStandardRecipes:true,lookalikeGap:true,delegateContexts:true,callbackContext:true,recursiveTupleArray:true}};
  await fs.writeFile(path.join(outRoot,'PHASE0_V2_HELDOUT_QUALIFICATION_v1.json'),JSON.stringify(result,null,2)+'\n');
  process.stdout.write(JSON.stringify({status:'PASS',medusaCalls:medusa.observedCalls,telemetryAttempts:telemetry.reduce((n,x)=>n+x.calls,0),positiveEconomicTransitions:telemetry.reduce((n,x)=>n+x.positiveEconomicTransitions,0)},null,2)+'\n');
}finally{try{provider.destroy();}catch{}await anvil.close().catch(()=>{});}
