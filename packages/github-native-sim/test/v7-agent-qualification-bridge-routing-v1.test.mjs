import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflow=fs.readFileSync('.github/workflows/v7-agent-qualification-bridge.yml','utf8');

test('qualification bridge defaults exact controller refs to CONTROLLER_ONLY',()=>{
  assert.match(workflow,/controller_ref=/);
  assert.match(workflow,/requested_lane=/);
  assert.match(workflow,/if \[ -n "\$controller_ref" \]; then requested_lane='CONTROLLER_ONLY'; else requested_lane='FULL'; fi/);
  assert.match(workflow,/-f controller_ref="\$controller_ref" -f qualification_lane="\$requested_lane"/);
});

test('qualification bridge keeps explicit FULL override and rejects unsafe controller-only dispatches',()=>{
  assert.match(workflow,/FULL\|CONTROLLER_ONLY/);
  assert.match(workflow,/controller_ref must be exact 40-hex commit/);
  assert.match(workflow,/qualification_lane=CONTROLLER_ONLY requires controller_ref/);
  assert.match(workflow,/qualification_lane must be FULL or CONTROLLER_ONLY/);
});


test('qualification bridge drains durable open issues so GitHub pending-run replacement cannot lose work',()=> {
  assert.match(workflow,/workflow_dispatch:/);
  assert.match(workflow,/group:\s*v7-agent-qualification-bridge/);
  assert.match(workflow,/cancel-in-progress:\s*false/);
  assert.match(workflow,/name:\s*Resolve oldest queued qualification issue/);
  assert.match(workflow,/sort_by\(\.number\)/);
  assert.match(workflow,/\.title=="\[agent\] run-v7-qualification"/);
  assert.match(workflow,/\.author\.login=="CurveYield-Developer-DK"/);
  assert.match(workflow,/\.author\.login=="JamesNexus"/);
  assert.match(workflow,/issue_body_b64/);
  assert.match(workflow,/steps\.queue\.outputs\.issue_number/);
  assert.match(workflow,/gh workflow run v7-agent-qualification-bridge\.yml/);
});

test('manual queue-drain runs are admitted without requiring synthetic issue event fields',()=> {
  assert.match(workflow,/github\.event_name == 'workflow_dispatch'/);
  assert.match(workflow,/steps\.queue\.outputs\.has_issue == 'true'/);
});
