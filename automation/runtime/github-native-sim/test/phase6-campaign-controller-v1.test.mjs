import test from 'node:test';
import assert from 'node:assert/strict';
import { createPhase6CampaignPlanV1, recordPhase6CampaignV1, evaluatePhase6CampaignPlanV1 } from '../src/phase6-campaign-controller-v1.mjs';

const source='a'.repeat(64), harness='b'.repeat(64), cfg='c'.repeat(64);
function campaign(id, klass, ordinal=1, extra={}) { return { campaignId:id, campaignClass:klass, engine:'medusa', harnessBundleDigest:harness, sourceSnapshotDigest:source, rpcBlock:123, rpcBlockHash:'0x'+'1'.repeat(64), runOrdinal:ordinal, refinementOf:null, configurationDigest:cfg, terminalStatus:'COMPLETED', propertyCount:2, falsifiedPropertyCount:0, corpus:{}, coverage:{}, statistics:{}, rawArtifactRef:`github-actions://${id}`, ...extra }; }

test('required applicable class cannot be omitted and Medusa precedes Foundry',()=>{
  let state=createPhase6CampaignPlanV1({ sourceSnapshotDigest:source, harnessBundleDigest:harness, requiredCampaignClasses:['discovery','property'], refinementRequired:false, deepEscalationRequired:false });
  state=recordPhase6CampaignV1(state,campaign('P6-MEDUSA-001','discovery'));
  let result=evaluatePhase6CampaignPlanV1(state);
  assert.equal(result.status,'INCOMPLETE');
  assert.deepEqual(result.missingCampaignClasses,['property']);
  assert.throws(()=>recordPhase6CampaignV1(state,{...campaign('P6-FOUNDRY-001','property'),engine:'foundry'}),/Medusa.*terminal|ordering/i);
});

test('required refinement needs linked rerun with changed configuration or harness',()=>{
  let state=createPhase6CampaignPlanV1({ sourceSnapshotDigest:source, harnessBundleDigest:harness, requiredCampaignClasses:['discovery'], refinementRequired:true, deepEscalationRequired:false });
  state=recordPhase6CampaignV1(state,campaign('P6-MEDUSA-001','discovery'));
  assert.equal(evaluatePhase6CampaignPlanV1(state).status,'REFINEMENT_REQUIRED');
  assert.throws(()=>recordPhase6CampaignV1(state,campaign('P6-MEDUSA-002','discovery',2,{ refinementOf:'P6-MEDUSA-001' })),/changed configuration|harness/i);
  state=recordPhase6CampaignV1(state,campaign('P6-MEDUSA-002','discovery',2,{ refinementOf:'P6-MEDUSA-001', configurationDigest:'d'.repeat(64) }));
  assert.equal(evaluatePhase6CampaignPlanV1(state).status,'PASS');
});

test('deep escalation is machine-gated and absent metrics are explicit',()=>{
  let state=createPhase6CampaignPlanV1({ sourceSnapshotDigest:source, harnessBundleDigest:harness, requiredCampaignClasses:['deep-escalation'], refinementRequired:false, deepEscalationRequired:true });
  const missingMetrics=campaign('P6-MEDUSA-009','deep-escalation',1,{ corpus:{status:'UNAVAILABLE_FROM_OUTPUT_MODE'}, coverage:{status:'UNAVAILABLE_FROM_OUTPUT_MODE'}, statistics:{status:'UNAVAILABLE_FROM_OUTPUT_MODE'} });
  state=recordPhase6CampaignV1(state,missingMetrics);
  assert.equal(evaluatePhase6CampaignPlanV1(state).status,'PASS');
  assert.equal(state.campaigns[0].coverage.status,'UNAVAILABLE_FROM_OUTPUT_MODE');
});
