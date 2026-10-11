import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');

test('Phase 0 finalization ignores removed randomized simulation and telemetry contracts',()=>{
 for(const name of ['scripts/lite-phase0-finalize-v1.mjs','scripts/lite-phase0-finalize-no-telemetry-v1.mjs']){
  const f=read(name);
  assert.match(f,/curveyield-lite-phase0-deploy-config-execution-v3/);
  assert.match(f,/ANVIL_FORK_PACKAGE_DEPLOY_CONFIG_ONLY/);
  assert.match(f,/PHASE0_FORK_DEPLOY_CONFIG/);
  assert.doesNotMatch(f,/const medusa=|validateTelemetryCountersV2|if\(.*telemetry\.length/);
  assert.doesNotMatch(f,/required\(path\.join\(campaignRoot,'derived\/phase-0\/PHASE[56]_SIMULATION_BASELINE_INPUT/);
 }
});

test('Phase 0 writer retains only deployment witness and Phase 6 deployment/target matrices',()=>{
 const writer=read('scripts/write-phase0-fork-deploy-outputs-v1.mjs');
 assert.match(writer,/PHASE0_DEPLOY_CONFIG_EXECUTION_v1\.json/);
 assert.match(writer,/renderDeployConfigMatrixV1/);
 assert.match(writer,/renderTargetedTestMatrixV1/);
 assert.doesNotMatch(writer,/summary\.medusa|summary\.telemetry|baselineMatrixRows/);
});

test('Phase 6 controller computes targets from Phase 5 without Phase 0 Medusa or ABI telemetry',()=>{
 const controller=read('scripts/lite-phase-packet-controller-v1.mjs');
 assert.match(controller,/const baselineRows=\[\];/);
 assert.doesNotMatch(controller,/derived\/phase-0\/PHASE6_SIMULATION_BASELINE_INPUT_v1\.json/);
 assert.match(controller,/executePhase5TargetsV1/);
});
