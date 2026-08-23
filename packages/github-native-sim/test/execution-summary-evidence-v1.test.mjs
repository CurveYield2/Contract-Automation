import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');
const workflowPath = path.join(repoRoot, '.github/workflows/audit-controller-execution-v4.yml');

test('V7 execution workflow prints a sanitized durable result summary after execution', () => {
  const workflow = fs.readFileSync(workflowPath, 'utf8');
  assert.match(workflow, /Record sanitized V7 execution summary/);
  assert.match(workflow, /deploymentGasEvidence/);
  assert.match(workflow, /simulationEvidence/);
  assert.match(workflow, /artifactDigest/);
  assert.match(workflow, /failedStepCount/);
});
