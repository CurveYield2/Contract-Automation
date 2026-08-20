import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');
const workflowPath = path.join(repoRoot, '.github/workflows/audit-controller-execution-v3.yml');

test('V7 execution workflow v3 exposes private auth, archive RPC, durable smoke receipt, and execution evidence', () => {
  assert.equal(fs.existsSync(workflowPath), true, 'V7 execution workflow v3 must exist');
  const workflow = fs.readFileSync(workflowPath, 'utf8');
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /AUDIT_CONTROLLER_GITHUB_TOKEN:\s*\$\{\{\s*secrets\.AUDIT_CONTROLLER_GITHUB_TOKEN\s*\}\}/);
  assert.match(workflow, /SIM_ARCHIVE_PRIMARY_ETHEREUM_01:\s*\$\{\{\s*secrets\.SIM_ARCHIVE_PRIMARY_ETHEREUM_01\s*\}\}/);
  assert.match(workflow, /V7_BRIDGE_SMOKE_RECEIPT_v1\.json/);
  assert.match(workflow, /auditControllerGithubTokenConfigured:\s*true/);
  assert.match(workflow, /archiveRpcConfigured:/);
  assert.match(workflow, /packages\/github-native-sim\/src\/run-job-file\.mjs/);
  assert.match(workflow, /actions\/upload-artifact@v4/);
  assert.doesNotMatch(workflow, /RPC_ETHEREUM:\s*\$\{\{/);
});

test('generic PreflightSim bridge remains separate from V7 private credentials', () => {
  const genericPath = path.join(repoRoot, '.github/workflows/github-bridge.yml');
  const generic = fs.readFileSync(genericPath, 'utf8');
  assert.match(generic, /PreflightSim|preflight/i);
  assert.doesNotMatch(generic, /AUDIT_CONTROLLER_GITHUB_TOKEN/);
  assert.doesNotMatch(generic, /SIM_ARCHIVE_PRIMARY_ETHEREUM_01/);
});
