import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const workflowPath = path.join(root, '.github/workflows/v7-execution-infrastructure-qualification.yml');
const lockPath = path.join(root, 'package-lock.json');

test('repository carries the canonical root dependency lock', () => {
  assert.equal(fs.existsSync(lockPath), true);
  const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
  assert.equal(lock.lockfileVersion, 3);
  assert.equal(lock.name, 'curveyield-contract-automation');
});

test('FULL qualification requires the committed lock and never manufactures one', () => {
  const workflow = fs.readFileSync(workflowPath, 'utf8');
  assert.match(workflow, /test -s package-lock\.json/);
  assert.match(workflow, /npm ci --force/);
  assert.match(workflow, /V7_DEPENDENCY_LOCKED=true/);
  assert.match(workflow, /dependencyLockPresent:process\.env\.V7_DEPENDENCY_LOCKED==='true' && fs\.existsSync\('package-lock\.json'\)/);
  assert.doesNotMatch(workflow, /npm install --package-lock-only/);
  assert.doesNotMatch(workflow, /Bootstrap package-lock into trusted main/);
  assert.doesNotMatch(workflow, /contents\/package-lock\.json/);
  assert.doesNotMatch(workflow, /package_lock_published/);
});

test('V7 execution requires the same committed root lock before toolchain setup', () => {
  const workflow = fs.readFileSync(
    path.join(root, '.github/workflows/audit-controller-execution.yml'), 'utf8');
  const install = workflow.split('      - name: Install trusted runner dependencies')[1]
    .split('      - name: Install and verify canonical V7 toolchain')[0];
  assert.match(install, /if: env\.V7_REQUEST_KIND == 'v7-execution'/);
  assert.match(install, /test -s package-lock\.json/);
  assert.match(install, /npm ci --force/);
  assert.match(install, /V7_DEPENDENCY_LOCKED=true/);
  assert.doesNotMatch(install, /npm install|V7_DEPENDENCY_LOCKED=false/);
});
