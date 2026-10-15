import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {gzipSync} from 'node:zlib';
import {capturePhase0ForkStateV1,verifyPhase0ForkStateV1} from '../src/phase0-fork-state-reuse-v1.mjs';

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
