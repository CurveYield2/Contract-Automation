import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflow = fs.readFileSync(
  new URL('../../../.github/workflows/simulate.yml', import.meta.url),
  'utf8'
);

test('PreflightSim concurrency is scoped to exact job identity', () => {
  assert.match(
    workflow,
    /group:\s*preflightsim-lite-runner-\$\{\{\s*inputs\.job_id\s*\}\}/
  );
  assert.doesNotMatch(
    workflow,
    /group:\s*preflightsim-lite-runner\s*(?:\r?\n|$)/
  );
});

test('duplicate same-job dispatches serialize without cancelling active execution', () => {
  assert.match(workflow, /cancel-in-progress:\s*false/);
});

test('workflow execution consumes the same exact job id used by concurrency', () => {
  assert.match(workflow, /PREFLIGHTSIM_JOB_ID:\s*\$\{\{\s*inputs\.job_id\s*\}\}/);
  assert.match(workflow, /--job-id\s+"\$PREFLIGHTSIM_JOB_ID"/);
});
