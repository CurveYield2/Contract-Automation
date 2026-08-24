import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflow = fs.readFileSync('.github/workflows/v7-execution-infrastructure-qualification.yml', 'utf8');

test('qualification workflow can verify an explicit private Audit-Controller ref without publishing feature qualification as main status', () => {
  assert.match(workflow, /controller_ref:/);
  assert.match(workflow, /repository:\s*CurveYield2\/Audit-Controller/);
  assert.match(workflow, /secrets\.AUDIT_CONTROLLER_GITHUB_TOKEN/);
  assert.match(workflow, /working-directory:\s*\.controller-under-test/);
  assert.match(workflow, /npm test/);
  assert.match(workflow, /npm run check/);
  assert.match(workflow, /v26-controller-qualification-v1/);
  assert.match(workflow, /github\.ref\s*==\s*'refs\/heads\/main'/);
});

test('qualification result derives advertised v26 capabilities from the checked runner manifest', () => {
  assert.match(workflow, /qualifiedCapabilities/);
  assert.match(workflow, /capabilities/);
  assert.match(workflow, /process\/RUNNER_MANIFEST\.json/);
});
