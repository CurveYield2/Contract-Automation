import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {setTimeout as sleep} from 'node:timers/promises';
import {capturePhase0ForkStateV1,stageVerifiedPhase0ForkStateV1} from '../src/phase0-fork-state-reuse-v1.mjs';
import {startAnvilEngine} from '../../runner/src/anvil-engine.mjs';

const target='0x000000000000000000000000000000000000cafe';
const code='0x6000600055';
async function reservePort(){
 const server=net.createServer();await new Promise((resolve,reject)=>{
  server.once('error',reject);server.listen(0,'127.0.0.1',resolve);
 });
 const port=server.address().port;
 await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));
 return port;
}
async function rpc(url,method,params=[]){
 const response=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},
  body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});
 const data=await response.json();
 if(data.error)throw Error(data.error.message??JSON.stringify(data.error));
 return data.result;
}
test('real GitHub-installed Anvil preserves deployed code and pinned state without any upstream fork',async t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'phase0-actual-anvil-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const port=await reservePort(),url='http://127.0.0.1:'+port;
 const executable=path.join(process.cwd(),'node_modules/@foundry-rs/anvil/bin.mjs');
 assert.ok(fs.existsSync(executable),'GitHub CI must install pinned @foundry-rs/anvil, never use host Anvil');
 const child=spawn(process.execPath,[executable,'--host','127.0.0.1','--port',String(port),
   '--chain-id','1','--hardfork','cancun','--silent'],{
   cwd:process.cwd(),env:process.env,stdio:['ignore','ignore','pipe'],detached:true
 });
 let stderr='';child.stderr.on('data',data=>{stderr=(stderr+String(data)).slice(-3000);});
 t.after(()=>{
   // The npm wrapper spawns the native Anvil binary. Kill its *process group*
   // so a detached grandchild cannot retain the node:test stderr pipe forever.
   try{if(child.pid)process.kill(-child.pid,'SIGKILL');}catch{}
   try{child.stderr?.destroy();}catch{}
 });
 let ready=false;
 for(let i=0;i<120;i++){
   try{if(await rpc(url,'eth_chainId')==='0x1'){ready=true;break;}}catch{}
   if(child.exitCode!==null)break;
   await sleep(100);
 }
 assert.ok(ready,'Anvil not ready: '+stderr);
 await rpc(url,'anvil_setCode',[target,code]); // success replies may be null; bytecode check is authoritative
 await rpc(url,'evm_mine');
 const block=Number(BigInt(await rpc(url,'eth_blockNumber')));
 assert.equal(await rpc(url,'eth_getCode',[target,'latest']),code);
 const campaignPath='campaigns/demo r1';
 const stateRoot=path.join(root,campaignPath,'evidence','phase0');
 const manifest=await capturePhase0ForkStateV1({
  rpc:(method,params)=>rpc(url,method,params),outputDir:stateRoot,
  campaignId:'demo-r1',sourceSha256:'c'.repeat(64),
  chainId:1,hardfork:'cancun',finalBlock:block
 });
 assert.equal(manifest.status,'CAPTURED','bounded state must fit CI fixture');
 const staged=await stageVerifiedPhase0ForkStateV1({
  controllerRoot:root,
  manifestRef:campaignPath+'/evidence/phase0/PHASE0_FORK_STATE_MANIFEST_v1.json',
  expected:{campaignId:'demo-r1',sourceSha256:'c'.repeat(64),
   sha256:manifest.sha256,hardfork:'cancun',chainId:1,finalBlock:block},
  workspaceRoot:path.join(root,'workspace')
 });
 const engine=await startAnvilEngine({
  artifacts:{get(){throw Error('No deployments required in saved state fixture');}},
  workflow:{steps:[]},chainId:1,forkUrl:null,block,
  evmVersion:'cancun',loadStatePath:staged.loadStatePath
 });
 try{
  assert.equal(await engine.provider.getCode(target),code,
   'source-deployed runtime bytecode must survive exact saved-state restore');
  assert.equal(Number(BigInt(await engine.provider.send('eth_blockNumber',[]))),block);
  assert.equal(engine.engine,'anvil');
 }finally{await engine.close();}
});
