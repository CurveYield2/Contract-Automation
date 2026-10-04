import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=(p)=>fs.readFileSync(p,'utf8');

test('A01 Phase-0 intelligence exports the exact accepted build artifacts for downstream reuse',()=>{
  const src=read('packages/github-native-sim/src/lite-phase0-intelligence-v1.mjs');
  assert.match(src,/buildExecutionArtifactBundleV2/);
  assert.match(src,/PHASE0_EXECUTION_BUILD_ARTIFACTS_v2\.json/);
  assert.match(src,/buildExecutionArtifactBundleV2\(\{request:pseudo,build\}\)/);
});

test('A01 Phase-0 intelligence workflow persists the reusable execution artifact bundle beside build identity',()=>{
  const workflow=read('.github/workflows/lite-phase0-intelligence-v1.yml');
  assert.match(workflow,/PHASE0_EXECUTION_BUILD_ARTIFACTS_v2\.json/);
  assert.match(workflow,/evidence\/build\/PHASE0_EXECUTION_BUILD_ARTIFACTS_v2\.json/);
});

test('A01 randomized simulation consumes joined upstream artifacts instead of running a second default build',()=>{
  const src=read('packages/github-native-sim/src/phase0-randomized-simulation-v1.mjs');
  assert.match(src,/validateExecutionInputJoinV2/);
  assert.match(src,/PHASE0_EXECUTION_BUILD_ARTIFACTS_v2\.json/);
  assert.doesNotMatch(src,/await buildProject\(/);
});
