import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {gzipSync} from 'node:zlib';
import {capturePhase0ForkStateV1,verifyPhase0ForkStateV1,stageVerifiedPhase0ForkStateV1} from '../src/phase0-fork-state-reuse-v1.mjs';

test('Phase-0 post-deployment Anvil state is compressed, bounded, source-bound, and tamper-evident',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'phase0-state-'));
 try{
  const raw=Buffer.from(JSON.stringify({version:1,accounts:{'0x01':{balance:'123'}}}));
  const packed=gzipSync(raw);
  const args={rpc:async method=>{assert.equal(method,'anvil_dumpState');return '0x'+packed.toString('hex');},
   outputDir:root,campaignId:'demo-r1',sourceSha256:'a'.repeat(64),
   chainId:1,hardfork:'cancun',finalBlock:20201020};
  const manifest=await capturePhase0ForkStateV1(args);
  assert.equal(manifest.status,'CAPTURED');
  assert.equal(manifest.chainId,1);
  assert.deepEqual(await verifyPhase0ForkStateV1({root,manifest}),{
   status:'VERIFIED',sha256:manifest.sha256,bytes:packed.length});
  assert.equal((await capturePhase0ForkStateV1({...args,maxBytes:1})).status,'TOO_LARGE');
  fs.appendFileSync(path.join(root,manifest.stateFile),'corruption');
  await assert.rejects(verifyPhase0ForkStateV1({root,manifest}),/bytes or SHA-256 mismatch/);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('verified Phase-0 state stages only for exact campaign, hash, block, chain and hardfork',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'phase0-verified-stage-'));
 try{
  const campaignPath='campaigns/demo r1',relative=campaignPath+'/evidence/phase0/PHASE0_FORK_STATE_MANIFEST_v1.json';
  const dir=path.join(root,campaignPath,'evidence','phase0');
  const packed=gzipSync(Buffer.from(JSON.stringify({accounts:{},block:42})));
  const manifest=await capturePhase0ForkStateV1({rpc:async()=> '0x'+packed.toString('hex'),
   outputDir:dir,campaignId:'demo-r1',sourceSha256:'b'.repeat(64),
   chainId:1,hardfork:'cancun',finalBlock:42});
  const opts={controllerRoot:root,manifestRef:relative,
   expected:{campaignId:manifest.campaignId,sourceSha256:manifest.sourceSha256,
     sha256:manifest.sha256,chainId:1,hardfork:'cancun',finalBlock:42},
   workspaceRoot:path.join(root,'job')};
  const stage=await stageVerifiedPhase0ForkStateV1(opts);
  assert.equal(stage.finalBlock,42);
  assert.ok(fs.existsSync(stage.loadStatePath));
  const state=JSON.parse(fs.readFileSync(stage.loadStatePath,'utf8'));
  assert.equal(state.block,42);
  await assert.rejects(stageVerifiedPhase0ForkStateV1({
    ...opts,expected:{...opts.expected,hardfork:'london'}}),/identity binding/);
  await assert.rejects(stageVerifiedPhase0ForkStateV1({
    ...opts,expected:{...opts.expected,sha256:'a'.repeat(64)}}),/identity binding/);
  await assert.rejects(stageVerifiedPhase0ForkStateV1({
    ...opts,manifestRef:'campaigns/../private/PHASE0_FORK_STATE_MANIFEST_v1.json'}),/unsafe/);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
