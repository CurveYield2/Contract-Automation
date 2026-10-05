import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const workflowUrl = new URL('../../../.github/workflows/v7-execution-infrastructure-qualification.yml', import.meta.url);

test('trusted-main qualification runs the real Medusa pass/fail/no-tests smoke gate inside the shared Phase-6 RPC session', async () => {
  const workflow = await fs.readFile(workflowUrl, 'utf8');

  assert.match(workflow, /runMedusaEndToEndSmokeV1/);
  assert.match(workflow, /phase6MedusaSmoke/);
  assert.match(workflow, /medusaSmokePass/);
  assert.match(workflow, /medusaSmokeFalsification/);
  assert.match(workflow, /medusaSmokeNoTests/);
  assert.match(workflow, /rawEvidencePreserved/);
});


test('workflow-call qualification cannot be cancelled by an unrelated main push qualification', async () => {
  const workflow = await fs.readFile(workflowUrl, 'utf8');
  // Inside a reusable call github.event_name is the caller's event, so the call
  // must be detected by workflow name and given its own run-scoped group.
  assert.match(workflow, /^name: V7 Execution Infrastructure Qualification$/m);
  assert.match(workflow, /group: v7-qualification-\$\{\{ github\.workflow != 'V7 Execution Infrastructure Qualification' && format\('call-\{0\}', github\.run_id\)/);
  assert.doesNotMatch(workflow, /github\.event_name == 'workflow_call' && github\.run_id/);
  assert.match(workflow, /cancel-in-progress: true/);
});
