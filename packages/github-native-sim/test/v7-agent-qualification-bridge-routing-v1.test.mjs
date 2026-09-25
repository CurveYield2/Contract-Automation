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
