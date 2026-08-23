import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');
const workflowPath = path.join(repoRoot, '.github/workflows/audit-controller-execution.yml');

test('canonical V7 execution workflow uses shared toolchain setup, canonical request resolution, and durable evidence upload', () => {
  assert.equal(fs.existsSync(workflowPath), true, 'canonical V7 execution workflow must exist');
  const workflow = fs.readFileSync(workflowPath, 'utf8');
  assert.match(workflow, /uses:\s*\.\/\.github\/actions\/setup-v7-toolchain/);
  assert.match(workflow, /npm run v7:manifest -- --check/);
  assert.match(workflow, /npm run v7 -- resolve --mode pr --source \.request-source --output \.v7-request\/request\.json/);
  assert.match(workflow, /npm run v7 -- resolve --mode dispatch --source \.controller-request --request-path/);
  assert.match(workflow, /npm run v7:execute -- --request \.v7-request\/request\.json/);
  assert.match(workflow, /name:\s*\$\{\{ env\.V7_ARTIFACT_NAME \|\| 'v7-execution-unresolved' \}\}/);
  assert.match(workflow, /path:\s*\.audit-evidence\/v7-execution/);
  assert.match(workflow, /if-no-files-found:\s*warn/);
});

test('generic PreflightSim bridge remains separate from V7 private credentials', () => {
  const genericPath = path.join(repoRoot, '.github/workflows/github-bridge.yml');
  const generic = fs.readFileSync(genericPath, 'utf8');
  assert.match(generic, /PreflightSim|preflight/i);
  assert.doesNotMatch(generic, /AUDIT_CONTROLLER_GITHUB_TOKEN/);
  assert.doesNotMatch(generic, /SIM_ARCHIVE_PRIMARY_ETHEREUM_01/);
});
