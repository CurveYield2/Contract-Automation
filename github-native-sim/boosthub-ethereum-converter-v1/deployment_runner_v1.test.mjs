import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {spawn} from 'node:child_process';
import {Contract,JsonRpcProvider,Wallet} from 'ethers';
const runner='release_v1/deployment/deploy_converter_v1.cjs';
test('bundled runner exposes its PowerShell command without installing dependencies',()=>{
 const r=spawnSync(process.execPath,[runner,'--help'],{encoding:'utf8'});assert.equal(r.status,0);assert.match(r.stdout,/Deploy-Converter_v1.ps1/);
});
test('runner rejects missing RPC and invalid slippage before deployment',()=>{
 const a=spawnSync(process.execPath,[runner],{encoding:'utf8'});assert.equal(a.status,1);assert.match(a.stderr,/Provide an Ethereum RPC/);
 const b=spawnSync(process.execPath,[runner,'--rpc','http://127.0.0.1:1','--slippage-bps','401'],{encoding:'utf8'});assert.equal(b.status,1);assert.match(b.stderr,/0 to 400/);
});
test('PowerShell runner simulates, deploys, verifies, and resumes without a duplicate fork deployment',async()=>{
 const root='runner_test_state_v1';fs.mkdirSync(root,{recursive:true});const log=fs.openSync(root+'/anvil_v1.log','w');
 const child=spawn('anvil',['--host','127.0.0.1','--port','8547','--chain-id','1','--fork-url','https://eth.drpc.org','--fork-block-number','26167322'],{stdio:['ignore',log,log]});
 const rpc='http://127.0.0.1:8547';const p=new JsonRpcProvider(rpc,1,{staticNetwork:true,batchMaxCount:1,cacheTimeout:-1});p.pollingInterval=50;
 try{
  let ready=false;for(let i=0;i<40;i++){try{if(/anvil/i.test(await p.send('web3_clientVersion',[]))){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,250));}assert.equal(ready,true);
  const wallet=Wallet.createRandom().connect(p);await p.send('anvil_setBalance',[wallet.address,'0x56BC75E2D63100000']);
  const state=path.resolve(root,'state_v1.json'),report=path.resolve(root,'plan_v1.json');
  const base=[runner,'--rpc',rpc,'--state-file',state,'--report',report];
  const dry=spawnSync(process.execPath,base,{encoding:'utf8'});assert.equal(dry.status,0,dry.stderr);assert.equal(fs.existsSync(state),false);assert.equal(JSON.parse(fs.readFileSync(report)).status,'SIMULATED_ONLY');
  const broadcast=spawnSync(process.execPath,[...base,'--broadcast'],{encoding:'utf8',env:{...process.env,PRIVATE_KEY:wallet.privateKey}});assert.equal(broadcast.status,0,broadcast.stderr);const saved=JSON.parse(fs.readFileSync(state));const nonce=await p.getTransactionCount(wallet.address);
  const repeat=spawnSync(process.execPath,[...base,'--broadcast'],{encoding:'utf8',env:{...process.env,PRIVATE_KEY:wallet.privateKey}});assert.equal(repeat.status,0,repeat.stderr);assert.equal(await p.getTransactionCount(wallet.address),nonce);assert.equal(JSON.parse(fs.readFileSync(state)).address,saved.address);
  const a=JSON.parse(fs.readFileSync('release_v1/artifacts_v1/BoostHubEthereumRewardConverter_v1.json'));const c=new Contract(saved.address,a.abi,p);assert.equal(await c.routeCount(),4n);const plan=JSON.parse(fs.readFileSync(report));assert.equal(plan.configuration.length,7);assert.ok(plan.configuration.every(x=>x.data&&x.data.startsWith('0x')));
  fs.writeFileSync('test_evidence_v1/deployment_runner_acceptance_v1.json',JSON.stringify({simulation:true,deployment:true,resumeWithoutDuplicate:true,configurationCalldata:plan.configuration.length,chainId:1,forkBlock:26167322},null,2));
 }finally{p.destroy();child.kill('SIGTERM');}
});
