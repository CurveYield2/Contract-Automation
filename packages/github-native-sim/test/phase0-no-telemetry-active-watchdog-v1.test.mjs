import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {NO_TELEMETRY_WATCHDOG_V1 as config,noTelemetryStallReasonV1 as decide} from '../../../scripts/phase0-no-telemetry-watchdog-v1.mjs';

const t=1000000;
const baseline={
  now:t,lastProgressAt:t,phase:'simulation',medusaLastAdvanceAt:t,
  medusaActive:false,rpcFailures:0
};

test('independent watcher allows normal slow but active Medusa start-up and ongoing calls',()=>{
  assert.equal(decide({...baseline,phase:'medusa',medusaActive:true,now:t+150000}),null);
  assert.equal(decide({...baseline,phase:'medusa',medusaActive:true,medusaLastAdvanceAt:t+125000,now:t+260000}),null);
});

test('independent watcher terminates genuine Medusa zero-call/no-new-call stalls early',()=>{
  assert.equal(decide({...baseline,phase:'medusa',medusaActive:true,now:t+config.medusaNoNewCallsMs-1}),null);
  assert.equal(decide({...baseline,phase:'medusa',medusaActive:true,now:t+config.medusaNoNewCallsMs}),'MEDUSA_CALLS_STALLED');
});

test('transient upstream RPC errors recover without cancelling the entire audit',()=>{
  assert.equal(decide({...baseline,rpcFailures:1}),null);
  assert.equal(decide({...baseline,rpcFailures:2}),null);
  assert.equal(decide({...baseline,rpcFailures:3}),'RPC_UNHEALTHY');
});

test('native 337s deployment is allowed, but hung subprocesses fail before the 50min limit',()=>{
  assert.equal(decide({...baseline,phase:'native-deployment',now:t+337000}),null);
  assert.equal(decide({...baseline,phase:'native-deployment',now:t+config.nativeScriptNoProgressMs}),'SIMULATION_STAGE_STALLED');
  assert.equal(decide({...baseline,phase:'simulation',now:t+config.generalNoProgressMs}),'SIMULATION_STAGE_STALLED');
});

test('No Telemetry workflow is now bounded native deploy/config only',()=>{
  const wf=fs.readFileSync('.github/workflows/lite-phase0-randomized-simulation-no-telemetry-v1.yml','utf8');
  assert.match(wf,/timeout-minutes: 50/);
  assert.match(wf,/run-phase0-fork-deploy-config-v1\.mjs/);
  assert.match(wf,/Retain deployment\/configuration evidence even on failure/);
  assert.doesNotMatch(wf,/MEDUSA_CALLS|TELEMETRY_CALLS|runMedusaShardsV2/);
});

test('Medusa uses global residual budget rather than stopping at previous 20m limit',()=>{
  const engine=fs.readFileSync('packages/github-native-sim/src/phase0-randomized-simulation-no-telemetry-v1.mjs','utf8');
  assert.match(engine,/const overallStartedAt=Date\.now\(\)/);
  assert.match(engine,/3000000-\(Date\.now\(\)-overallStartedAt\)/);
  assert.match(engine,/Math\.min\(2400,Math\.max\(0,remainingSeconds\)\)/);
  assert.match(engine,/maxSeconds:medusaBudgetSeconds/);
  assert.match(engine,/minimumRequiredCalls=PHASE0_MEDUSA_MIN_CALLS_V1/);
  assert.match(engine,/PHASE0_MEDUSA_MIN_CALLS_V1=100001/);
});

test('upstream RPC probe is bounded, stage-aware, and enforces a three-failure threshold',()=>{
  const source=fs.readFileSync('scripts/phase0-no-telemetry-watchdog-v1.mjs','utf8');
  assert.match(source,/AbortSignal\.timeout/);
  assert.match(source,/method:'eth_blockNumber'/);
  assert.match(source,/consecutiveRpcFailures:3/);
  assert.match(source,/networkFree=/);
  assert.match(source,/if\(networkFree\)return/);
  assert.match(source,/process\.kill\(-child\.pid,'SIGTERM'\)/);
  assert.match(source,/process\.kill\(-child\.pid,'SIGKILL'\)/);
  assert.match(source,/child\.once\('close'/);
  assert.match(source,/child\.once\('error'/);
  assert.doesNotMatch(source,/process\.exit\(0\)/);
});
