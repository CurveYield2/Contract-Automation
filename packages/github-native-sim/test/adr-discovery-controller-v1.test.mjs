import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {detectionPolicyForAuthorityV1} from '../src/adr-policy-v1.mjs';
const root=fileURLToPath(new URL('../../../',import.meta.url));
function file(rel){return fs.readFileSync(new URL('../../../'+rel,import.meta.url),'utf8');}
test('legacy policy remains disabled and v12 opts in explicitly',()=>{
 const choose=(manifest)=>detectionPolicyForAuthorityV1({repoRoot:root,authorityRoot:'v12',
  readJsonIfExists:()=>manifest});
 assert.equal(choose({detectionPolicy:'audit-detection-rebuild-v1'}),'audit-detection-rebuild-v1');
 assert.equal(choose({release:'Audit_Litemode_v11'}),null);
});
test('Phase 3 discovery controller uses bound policy and no additional reviewer chat',()=>{
 const controller=file('scripts/lite-phase-packet-controller-v1.mjs');
 assert.match(controller,/sequence===3&&!masterAmendmentRefreshSha&&activeDetectionPolicyV1\(predecessor\)/);
 assert.match(controller,/status='WAITING_FOR_DISCOVERY'/);
 assert.match(controller,/discoveryStarted/);
 assert.match(controller,/sameReviewerAdvanced:!discoveryStarted/);
 assert.match(controller,/reviewKind==='discovery'/);
 assert.match(controller,/reviewer:'reviewer-2'/);
});
test('discovery workflow preserves global concurrency, validates unit IDs and retries publish',()=>{
 const workflow=file('.github/workflows/lite-phase-work-packet-controller-v1.yml');
 assert.match(workflow,/options: \[phase, discovery, master/);
 assert.match(workflow,/unit_id:/);
 assert.match(workflow,/ROUND_LIMIT_REACHED|DISCOVERY_REWORK/);
 assert.match(workflow,/stale discovery request/);
 assert.match(workflow,/for attempt in 1 2 3; do/);
 assert.match(workflow,/Wake discovery chat/);
 assert.match(workflow,/mode=resume_existing/);
 assert.match(workflow,/group: lite-phase-boundary-controller-v1/);
 assert.match(workflow,/watchdog_enabled=false/);
});
test('Phase 4 discovery prefill does not replace the old sourceReviewScaffold without v12 field',()=>{
 const pref=file('scripts/lib/lite-phase-prefill-v1.mjs');
 assert.match(pref,/Object\.hasOwn\(form.actions\['step-1'\].outputs,'discoveryReconciliationRecords'\)/);
 assert.match(pref,/phase4DiscoveryCoverageV1/);
 assert.match(pref,/expectedDiscoveryRecordKeys/);
 assert.match(pref,/COVERAGE_GAP_ACCEPTED/);
});
