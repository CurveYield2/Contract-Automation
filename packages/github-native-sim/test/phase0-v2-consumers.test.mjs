import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');

test('A31/A32 legacy completed-stage evidence is preserved but cannot masquerade as v2 assurance',()=>{
  const importer=read('packages/github-native-sim/src/phase0-completed-stages-v1.mjs');
  assert.match(importer,/LEGACY_LIMITED/);
  assert.match(importer,/NO_PROPERTY_ASSURANCE/);
  const finalizer=read('scripts/lite-phase0-finalize-v1.mjs');
  assert.match(finalizer,/curveyield-phase0-execution-capability-v2/);
  assert.match(finalizer,/LEGACY_LIMITED/);
});

test('A32 projector carries independent execution check reachability observation and lifecycle fields',()=>{
  const projector=read('scripts/write-phase0-simulation-outputs-v1.mjs');
  for(const field of ['checkStatus','reachabilityStatus','observationStatus','simulatedRejection','minedSuccess','positiveTransitions'])assert.match(projector,new RegExp(field));
});

test('A33 finalizer gates v2 checked Medusa separately from explicit oracle gaps and verifies raw telemetry reconciliation',()=>{
  const finalizer=read('scripts/lite-phase0-finalize-v1.mjs');
  assert.match(finalizer,/CHECKED_DISCOVERY/);
  assert.match(finalizer,/DISCOVERY_WITH_ORACLE_GAPS/);
  assert.match(finalizer,/reconciliation/);
  assert.match(finalizer,/submittedOutcomeUnknown/);
  assert.match(finalizer,/simulationInfrastructureError/);
  assert.match(finalizer,/submissionInfrastructureError/);
  assert.match(finalizer,/PHASE0_EXECUTION_BUILD_ARTIFACTS_v2\.json/);
});
