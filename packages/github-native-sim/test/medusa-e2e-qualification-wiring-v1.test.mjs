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
  assert.match(workflow, /github\.event_name == 'workflow_call' && github\.run_id/);
  assert.match(workflow, /cancel-in-progress: true/);
});
