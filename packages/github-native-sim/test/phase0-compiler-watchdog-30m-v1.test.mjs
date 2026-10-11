import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PHASE0_COMPILE_WATCHDOG_V1 as cfg,phase0CompileStallReasonV1 as detect} from '../../../scripts/phase0-compile-watchdog-v1.mjs';

const start=1_000_000;
test('an active compiler can use the full 30 minutes without being mistaken for a stall',()=>{
  assert.equal(detect({now:start+25*60_000,compileStartedAt:start,lastCpuProgressAt:start+24*60_000,compileActive:true}),null);
  assert.equal(detect({now:start+29*60_000+59_000,compileStartedAt:start,lastCpuProgressAt:start+29*60_000,compileActive:true}),null);
  assert.equal(detect({now:start+30*60_000,compileStartedAt:start,lastCpuProgressAt:start+29*60_000,compileActive:true}),'COMPILATION_30_MINUTE_LIMIT');
});
test('genuine eight-minute zero-CPU compiler stall fails early',()=>{
  assert.equal(detect({now:start+cfg.compileIdleMs-1,compileStartedAt:start,lastCpuProgressAt:start,compileActive:true}),null);
  assert.equal(detect({now:start+cfg.compileIdleMs,compileStartedAt:start,lastCpuProgressAt:start,compileActive:true}),'COMPILATION_CPU_STALLED');
});
test('cache hit and post-compile artifact publishing never trip compiler watchdog',()=>{
  assert.equal(detect({now:start+60*60_000,compileStartedAt:start,lastCpuProgressAt:start,compileActive:false}),null);
});
test('watchdog is a real independent process using Linux CPU process-tree counters and kills the entire group',()=>{
  const src=fs.readFileSync('scripts/phase0-compile-watchdog-v1.mjs','utf8');
  assert.match(src,/fs\.readFileSync\('\/proc\/'\+p\+'\/stat'/);
  assert.match(src,/cpuTicksAdvanced/);
  assert.match(src,/lastCpuProgressAt=now/);
  assert.match(src,/COMPILATION_CPU_STALLED/);
  assert.match(src,/process\.kill\(-child\.pid,'SIGTERM'\)/);
  assert.match(src,/process\.kill\(-child\.pid,'SIGKILL'\)/);
  assert.match(src,/HEALTH stage=/);
  assert.match(src,/rss_mib=/);
});
for(const [flavor,workflow,engine] of [
 ['primary','.github/workflows/lite-phase0-intelligence-v1.yml','packages/github-native-sim/src/lite-phase0-intelligence-v1.mjs'],
 ['no-telemetry','.github/workflows/lite-phase0-intelligence-no-telemetry-v1.yml','packages/github-native-sim/src/lite-phase0-intelligence-no-telemetry-v1.mjs']
]){
 test(flavor+' gives compile 30min while allowing downstream intelligence and fail-closed publication',()=>{
   const wf=fs.readFileSync(workflow,'utf8');
   assert.match(wf,/timeout-minutes: 60/);
   assert.match(wf,/timeout -s TERM -k 30s 3000s node scripts\/phase0-compile-watchdog-v1\.mjs/);
   assert.match(wf,/PHASE0_PRIVATE_BUILD_CACHE_ENABLED/);
   assert.match(wf,/Write only useful outputs to Audit-Controller campaign/);
   const src=fs.readFileSync(engine,'utf8');
   assert.match(src,/compileWithPrivateCacheV1/);
   assert.match(src,/compile-exact-build/);
   if(flavor==='no-telemetry')assert.match(src,/withStage\('compile-exact-build',2100000,/);
 });
}
