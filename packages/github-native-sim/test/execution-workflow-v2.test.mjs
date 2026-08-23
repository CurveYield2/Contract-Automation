import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');
const workflowPath = path.join(repoRoot, '.github/workflows/audit-controller-execution.yml');

test('V7 execution workflow exposes private controller auth and archive RPC only to execution steps', () => {
  assert.equal(fs.existsSync(workflowPath), true, 'canonical V7 execution workflow must exist');
  const workflow = fs.readFileSync(workflowPath, 'utf8');
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /AUDIT_CONTROLLER_GITHUB_TOKEN:\s*\$\{\{\s*secrets\.AUDIT_CONTROLLER_GITHUB_TOKEN\s*\}\}/);
  assert.match(workflow, /SIM_ARCHIVE_PRIMARY_ETHEREUM_01:\s*\$\{\{\s*secrets\.SIM_ARCHIVE_PRIMARY_ETHEREUM_01\s*\}\}/);
  assert.match(workflow, /npm run v7:execute/);
  assert.match(workflow, /actions\/upload-artifact@v4/);
  assert.doesNotMatch(workflow, /RPC_ETHEREUM:\s*\$\{\{/);
});

test('generic PreflightSim bridge remains a separate workflow', () => {
  const genericPath = path.join(repoRoot, '.github/workflows/github-bridge.yml');
  const generic = fs.readFileSync(genericPath, 'utf8');
  assert.match(generic, /PreflightSim|preflight/i);
  assert.doesNotMatch(generic, /AUDIT_CONTROLLER_GITHUB_TOKEN/);
  assert.doesNotMatch(generic, /SIM_ARCHIVE_PRIMARY_ETHEREUM_01/);
});
