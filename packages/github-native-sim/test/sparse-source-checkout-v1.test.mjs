import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { checkoutExactSource } from '../src/execution.mjs';

const COMMIT='a'.repeat(40);
function recorder(){
  const calls=[];
  return{calls,runCommand:async({command,args})=>{calls.push([command,...args]);return{exitCode:0,stdout:args[0]==='rev-parse'?COMMIT+'\n':'',stderr:''};}};
}

test('sparse checkout fetches blobs lazily and materializes only the listed paths',async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'sparse-co-'));
  const {calls,runCommand}=recorder();
  const patterns=['/campaigns/cyavKATv25b r3/','/Audit Skill - Current Authority/*/'];
  const result=await checkoutExactSource({repository:'CurveYield2/Audit-Controller',commit:COMMIT,destination:path.join(dir,'repo'),sparsePatterns:patterns},{runCommand,environment:{}});
  assert.deepEqual(calls.find(c=>c[1]==='fetch'),['git','fetch','--depth','1','--filter=blob:none','origin',COMMIT]);
  assert.ok(calls.some(c=>c.join(' ')==='git config core.sparseCheckout true'));
  const fetchIndex=calls.findIndex(c=>c[1]==='fetch'),checkoutIndex=calls.findIndex(c=>c[1]==='checkout');
  assert.ok(calls.findIndex(c=>c[1]==='config')>fetchIndex&&calls.findIndex(c=>c[1]==='config')<checkoutIndex);
  assert.equal(await fs.readFile(path.join(dir,'repo','.git','info','sparse-checkout'),'utf8'),patterns.join('\n')+'\n');
  assert.deepEqual(result.sparsePatterns,patterns);
});

test('default checkout is unchanged and unsafe sparse patterns are rejected',async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'sparse-co-'));
  const {calls,runCommand}=recorder();
  await checkoutExactSource({repository:'CurveYield2/Audit-Controller',commit:COMMIT,destination:path.join(dir,'repo')},{runCommand,environment:{}});
  assert.deepEqual(calls.find(c=>c[1]==='fetch'),['git','fetch','--depth','1','origin',COMMIT]);
  assert.ok(!calls.some(c=>c[1]==='config'));
  for(const bad of [['campaigns/x/'],['/campaigns/../x/'],['/a\nb']]){
    await assert.rejects(checkoutExactSource({repository:'CurveYield2/Audit-Controller',commit:COMMIT,destination:path.join(dir,'r2'),sparsePatterns:bad},{runCommand,environment:{}}),/sparse patterns/);
  }
});

test('Phase-0 Audit-Controller checkouts are campaign-scoped',async()=>{
  const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'../../..');
  const intelligence=await fs.readFile(path.join(root,'packages/github-native-sim/src/lite-phase0-intelligence-v1.mjs'),'utf8');
  assert.match(intelligence,/sparsePatterns\}/);
  for(const wf of ['lite-phase0-bootstrap-v1.yml','lite-phase0-randomized-simulation-v1.yml','lite-phase0-simulation-testing-v1.yml','phase0-deploy-only-regression-v1.yml']){
    const text=await fs.readFile(path.join(root,'.github/workflows',wf),'utf8');
    assert.match(text,/checkout-audit-controller-once-v1\.sh \.audit-controller \S+ branch \S/,wf);
  }
  const sync=await fs.readFile(path.join(root,'.github/workflows/sync-lite-authority-zip-v2.yml'),'utf8');
  assert.doesNotMatch(sync,/^\s+(push|schedule):/m);
  assert.match(sync,/workflow_dispatch:/);
});
