import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve('.');
const read=(p)=>fs.readFileSync(path.join(root,p),'utf8');

test('fresh Lite audit keeps a single ZIP URL input surface',()=>{
  const workflow=read('.github/workflows/audit-source-initialization-v1.yml');
  const run=read('automation/scripts/audit-source-initialization/run-v1.sh');
  assert.match(workflow,/source_url:/);
  assert.doesNotMatch(workflow,/campaign_id:\n\s+description:/);
  assert.match(run,/lite-phase0-bootstrap-v1\.yml/);
  assert.doesNotMatch(run,/lite-audit-browser-orchestrator-v1\.yml/);
});

test('automated Phase 0 owns qualification intelligence finalization and only then launches browser orchestration',()=>{
  const coordinator=read('.github/workflows/lite-phase0-bootstrap-v1.yml');
  const q=coordinator.indexOf('qualification:');
  const i=coordinator.indexOf('intelligence:');
  const f=coordinator.indexOf('finalize-and-launch-reviewer1:');
  const o=coordinator.indexOf('gh workflow run lite-audit-browser-orchestrator-v1.yml');
  assert.ok(q>=0&&i>q&&f>i&&o>f);
  assert.match(coordinator,/uses: \.\/\.github\/workflows\/v7-execution-infrastructure-qualification\.yml/);
  assert.match(coordinator,/uses: \.\/\.github\/workflows\/lite-phase0-intelligence-v1\.yml/);
  assert.doesNotMatch(coordinator,/browser-agent-wake\.yml/);
});

test('Phase 0 finalizer creates no interphase mechanical packet and prepares assignment-v2 Phase 1',()=>{
  const finalizer=read('automation/scripts/lite-phase0-finalize-v1.mjs');
  assert.match(finalizer,/P0_TO_P1/);
  assert.match(finalizer,/WAITING_FOR_SUCCESSOR_AGENT/);
  assert.match(finalizer,/curveyield-audit-campaign-directory-entry-v2/);
  assert.match(finalizer,/preparePhaseWork/);
  assert.doesNotMatch(finalizer,/MECHANICAL_WORK_PACKET_v2|PHASE_01_RECEIPT_v1/);
  assert.match(finalizer,/reviewer-1/);
});

test('source initialization creates a Phase-0 automation receipt instead of campaign state sidecars',()=>{
  const writer=read('automation/scripts/audit-source-initialization/write-phase0-receipt-v1.py');
  assert.match(writer,/PHASE_00_RECEIPT_v1\.json/);
  assert.match(writer,/phase0-automation/);
  assert.match(writer,/CAMPAIGN_DIRECTORY_PATH/);
  const run=read('automation/scripts/audit-source-initialization/run-v1.sh');
  assert.match(run,/Audit Campaign Directory\/campaigns/);
  assert.doesNotMatch(writer,/web-bootstrap-agent|CHATGPT_WEB_CHAT_GITHUB_CONNECTOR|CAMPAIGN_STATE|ACTIVE_PHASE_POINTER|SOLO_AUDIT_STATE/);
});

test('browser orchestrator launches assignment-v2 reviewers and retains legacy receipt fallback',()=>{
  const orchestrator=read('.github/workflows/lite-audit-browser-orchestrator-v1.yml');
  assert.doesNotMatch(orchestrator,/web-bootstrap-agent|CAMPAIGN_STATE|ACTIVE_PHASE_POINTER|SOLO_AUDIT_STATE/);
  assert.match(orchestrator,/Audit Campaign Directory\/campaigns/);
  assert.match(orchestrator,/prepare-lite-assignment-successor-v2\.mjs/);
  assert.match(orchestrator,/prepare-lite-receipt-successor-v1\.mjs/);
  assert.match(orchestrator,/browser-agent-wake\.yml/);
});


test('reusable Phase-0 intelligence materializes its request from inputs even when caller event is workflow_dispatch',()=>{
  const workflow=read('.github/workflows/lite-phase0-intelligence-v1.yml');
  assert.match(workflow,/Materialize workflow-call Phase-0 request\n\s+if: inputs\.campaign_id != ''/);
  assert.match(workflow,/if \[ -s \.phase0-request\.json \]; then/);
  assert.doesNotMatch(workflow,/if \[ "\$GITHUB_EVENT_NAME" = "workflow_call" \]; then/);
});
