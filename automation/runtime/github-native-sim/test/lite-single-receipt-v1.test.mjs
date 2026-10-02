import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');

test('fresh Lite campaign keeps one ZIP URL as the only external initialization input',()=>{
  const workflow=read('.github/workflows/audit-source-initialization-v1.yml');
  const run=read('automation/scripts/audit-source-initialization/run-v1.sh');
  assert.match(workflow,/source_url:/);
  assert.match(run,/write-phase0-receipt-v1\.py/);
  assert.match(run,/Audit Campaign Directory\/campaigns/);
  assert.doesNotMatch(run,/write-state-v1\.py|\.deep-assurance/);
});

test('Phase 0 remains automation-receipt based and creates Phase1 assignment-v2 only after seal',()=>{
  const f=read('automation/scripts/lite-phase0-finalize-v1.mjs');
  assert.match(f,/PHASE_00_RECEIPT_v1\.json/);
  assert.match(f,/PHASE0_AUDIT_SURFACE_v1\.json/);
  assert.match(f,/EVIDENCE_INVALIDATION_MATRIX_v1\.json/);
  assert.match(f,/preparePhaseWork/);
  assert.match(f,/curveyield-audit-campaign-directory-entry-v2/);
  assert.match(f,/sequence:1/);
  assert.doesNotMatch(f,/PHASE_01_RECEIPT_v1\.json/);
});

test('assignment-v2 normal phases use packet controller while old receipt controller remains legacy-compatible',()=>{
  const packet=read('automation/scripts/lite-phase-packet-controller-v1.mjs');
  const legacy=read('automation/scripts/lite-phase-receipt-controller-v1.mjs');
  assert.match(packet,/validateWorkForm/);
  assert.match(packet,/validateFinalReport/);
  assert.match(packet,/CONTROLLER_PHASE_PASS/);
  assert.match(packet,/createLitePhaseReceiptV1/);
  assert.match(legacy,/EVIDENCE_READY/);
});

test('fresh successor orchestration prefers assignment-v2 and retains legacy receipt fallback',()=>{
  const assignment=read('automation/scripts/prepare-lite-assignment-successor-v2.mjs');
  const legacy=read('automation/scripts/prepare-lite-receipt-successor-v1.mjs');
  const w=read('.github/workflows/lite-audit-browser-orchestrator-v1.yml');
  assert.match(assignment,/Phase schema:/);
  assert.match(assignment,/Phase work form:/);
  assert.match(assignment,/Controller-owned phase packet path:/);
  assert.match(legacy,/buildWakeMessageFromReceiptsV1/);
  assert.match(w,/curveyield-audit-campaign-directory-entry-v2/);
  assert.match(w,/prepare-lite-assignment-successor-v2\.mjs/);
  assert.match(w,/prepare-lite-receipt-successor-v1\.mjs/);
});

test('browser wake activates assignment-v2 without active phase receipt mutation',()=>{
  const w=read('.github/workflows/browser-agent-wake.yml');
  assert.match(w,/curveyield-audit-campaign-directory-entry-v2/);
  assert.match(w,/currentAssignment\.status="ACTIVE"/);
  assert.match(w,/without creating or modifying a phase receipt/);
  assert.match(w,/Audit Campaign Directory\/campaigns/);
});

test('watchdog monitors assignment-v2 without circular packet dispatch and retains only the legacy receipt gate',()=>{
  const w=read('.github/workflows/browser-agent-watchdog.yml');
  const boundary=read('.github/workflows/lite-phase-work-packet-controller-v1.yml');
  assert.match(w,/curveyield-audit-campaign-directory-entry-v2/);
  assert.match(w,/currentAssignment\.packetPath/);
  assert.doesNotMatch(w,/packet_status.*SUBMITTED[\s\S]{0,500}lite-phase-work-packet-controller-v1\.yml/);
  assert.match(w,/lite-phase-receipt-controller-v1\.yml/);
  assert.match(boundary,/process\/agent-upload\/lite-phase-boundary\/\*\.json/);
  assert.match(boundary,/curveyield-lite-phase-boundary-request-v1/);
});

test('Phase 0 intelligence generates substantive audit surface rather than receipt substitutes',()=>{
  const intel=read('automation/runtime/github-native-sim/src/lite-phase0-intelligence-v1.mjs');
  const outputs=read('automation/runtime/github-native-sim/src/lite-phase0-skill-outputs-v1.mjs');
  assert.match(intel,/claimedStandards/);
  assert.match(intel,/explicitExclusions/);
  assert.match(intel,/declaredFacts/);
  assert.match(outputs,/PHASE0_AUDIT_SURFACE_v1\.json/);
  assert.match(outputs,/EVIDENCE_INVALIDATION_MATRIX_v1\.json/);
  assert.match(outputs,/PHASE_00_RECEIPT_v1\.json/);
});

test('assignment-v2 Phase6 PASS creates and seals automatic Phase7 marker then assigns reviewer4 to Phase8',()=>{
  const f=read('automation/scripts/lite-phase-packet-controller-v1.mjs');
  assert.match(f,/if\(sequence===6\)/);
  assert.match(f,/sequence:7,executorType:'GITHUB_ACTIONS',executorLineage:'phase7-automation'/);
  assert.match(f,/markerDisposition:'SEALED_AUTOMATIC_MARKER'/);
  assert.match(f,/boundary:'P67_TO_P8'/);
  assert.match(f,/sequence:nextSequence,reviewer:nextReviewer/);
  assert.match(f,/nextSequence=8/);
});
