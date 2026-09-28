import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=(p)=>fs.readFileSync(p,'utf8');

test('fresh Lite campaign keeps one ZIP URL as the only external initialization input',()=>{
  const workflow=read('.github/workflows/audit-source-initialization-v1.yml');
  const run=read('scripts/audit-source-initialization/run-v1.sh');
  assert.match(workflow,/source_url:/);
  assert.match(run,/write-phase0-receipt-v1\.py/);
  assert.match(run,/Audit Campaign Directory\/campaigns/);
  assert.doesNotMatch(run,/write-state-v1\.py/);
  assert.doesNotMatch(run,/\.deep-assurance/);
});

test('Phase 0 finalizer updates the single receipt and creates no proof-of-proof files',()=>{
  const f=read('scripts/lite-phase0-finalize-v1.mjs');
  assert.match(f,/PHASE_00_RECEIPT_v1\.json/);
  assert.match(f,/PHASE0_AUDIT_SURFACE_v1\.json/);
  assert.match(f,/EVIDENCE_INVALIDATION_MATRIX_v1\.json/);
  assert.doesNotMatch(f,/PHASE0_AUTOMATION_COMPLETION_REPORT|PHASE0_AUTOMATION_VALIDATION|SUCCESSOR_HANDOFF\.json|WAKE_UP_MESSAGE\.md|START_HERE_SUCCESSOR\.md|CAMPAIGN_STATE|ACTIVE_PHASE_POINTER|SOLO_AUDIT_STATE|MECHANICAL_WORK_PACKET/);
});

test('receipt controller is the only normal Lite phase transition bookkeeping layer',()=>{
  const f=read('scripts/lite-phase-receipt-controller-v1.mjs');
  assert.match(f,/EVIDENCE_READY/);
  assert.match(f,/SUCCESSOR_PENDING/);
  assert.match(f,/sameReviewerAdvanced/);
  assert.match(f,/phaseReceiptPath\(campaignPath,t\.next,1\)/);
  assert.match(f,/sequence===10/);
  assert.doesNotMatch(f,/SUCCESSOR_HANDOFF|MECHANICAL_WORK_PACKET|retirement/i);
});

test('fresh successor is generated dynamically from receipts',()=>{
  const f=read('scripts/prepare-lite-receipt-successor-v1.mjs');
  const w=read('.github/workflows/lite-audit-browser-orchestrator-v1.yml');
  assert.match(f,/buildWakeMessageFromReceiptsV1/);
  assert.match(w,/Audit Campaign Directory\/campaigns/);
  assert.match(w,/prepare-lite-receipt-successor-v1\.mjs/);
  assert.doesNotMatch(w,/SUCCESSOR_HANDOFF\.json|WAKE_UP_MESSAGE\.md|START_HERE_SUCCESSOR\.md|MECHANICAL_WORK_PACKET/);
});

test('browser wake activates incoming receipt and moves only the campaign-directory pointer',()=>{
  const w=read('.github/workflows/browser-agent-wake.yml');
  assert.match(w,/Activate prepared Lite receipt successor/);
  assert.match(w,/SUCCESSOR_ACTIVATED/);
  assert.match(w,/currentReceiptPath/);
  assert.match(w,/Audit Campaign Directory\/campaigns/);
});

test('watchdog follows current receipt and dispatches deterministic receipt controller',()=>{
  const w=read('.github/workflows/browser-agent-watchdog.yml');
  assert.match(w,/Audit Campaign Directory\/campaigns/);
  assert.match(w,/currentReceiptPath/);
  assert.match(w,/lite-phase-receipt-controller-v1\.yml/);
  assert.match(w,/EVIDENCE_READY/);
  assert.match(w,/SUCCESSOR_PENDING/);
});

test('Phase 0 intelligence generates substantive audit surface rather than receipt substitutes',()=>{
  const intel=read('packages/github-native-sim/src/lite-phase0-intelligence-v1.mjs');
  const outputs=read('packages/github-native-sim/src/lite-phase0-skill-outputs-v1.mjs');
  assert.match(intel,/claimedStandards/);
  assert.match(intel,/explicitExclusions/);
  assert.match(intel,/declaredFacts/);
  assert.match(outputs,/PHASE0_AUDIT_SURFACE_v1\.json/);
  assert.match(outputs,/EVIDENCE_INVALIDATION_MATRIX_v1\.json/);
  assert.match(outputs,/PHASE_00_RECEIPT_v1\.json/);
});


test('receipt controller enforces current Phase Contract required outputs before sealing',()=>{
  const f=read('scripts/lite-phase-receipt-controller-v1.mjs');
  assert.match(f,/authority\.homepagePath/);
  assert.match(f,/PHASE_CONTRACT\.json/);
  assert.match(f,/phaseContract\.requiredOutputs/);
  assert.match(f,/missing required Phase Contract outputs/);
  assert.match(f,/recorded\.add\(receiptLocalPath\)/);
});

test('replacement wake resumes blocked receipt state without pretending it is a successor transition',()=>{
  const w=read('.github/workflows/browser-agent-wake.yml');
  assert.match(w,/directory_status" = "BLOCKED"/);
  assert.match(w,/\.phase\.status="ACTIVE"/);
  assert.match(w,/\.status="ACTIVE"/);
  assert.match(w,/resume blocked reviewer/);
  assert.match(w,/no successor transition is required/);
});
