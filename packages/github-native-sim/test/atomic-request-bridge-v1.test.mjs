import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');
const workflowPath = path.join(repoRoot, '.github/workflows/audit-controller-execution-v4.yml');

test('V7 v4 bridge executes one atomic request file from github-native-sim request branches', () => {
  assert.equal(fs.existsSync(workflowPath), true, 'V7 execution workflow v4 must exist');
  const workflow = fs.readFileSync(workflowPath, 'utf8');
  assert.match(workflow, /github-native-sim\/\*\*/);
  assert.match(workflow, /github-native-sim\/requests\/\*\*\/request\.json/);
  assert.match(workflow, /find github-native-sim\/requests/);
  assert.match(workflow, /test "\$\{#requests\[@\]\}" -eq 1/);
  assert.match(workflow, /runGitHubNativeJob/);
  assert.match(workflow, /AUDIT_CONTROLLER_GITHUB_TOKEN:\s*\$\{\{\s*secrets\.AUDIT_CONTROLLER_GITHUB_TOKEN\s*\}\}/);
  assert.match(workflow, /SIM_ARCHIVE_PRIMARY_ETHEREUM_01:\s*\$\{\{\s*secrets\.SIM_ARCHIVE_PRIMARY_ETHEREUM_01\s*\}\}/);
});

test('V7 v4 bridge permits same-repository PR trace execution without admitting fork PR secrets', () => {
  const workflow = fs.readFileSync(workflowPath, 'utf8');
  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /types:\s*\[opened, synchronize, reopened\]/);
  assert.match(workflow, /github\.event\.pull_request\.head\.repo\.full_name == github\.repository/);
  assert.match(workflow, /startsWith\(github\.event\.pull_request\.head\.ref, 'github-native-sim\/'\)/);
  assert.match(workflow, /github\.event\.pull_request\.head\.sha \|\| github\.sha/);
});

test('V7 v4 atomic request branches do not modify the generic PreflightSim issue bridge', () => {
  const genericPath = path.join(repoRoot, '.github/workflows/github-bridge.yml');
  const generic = fs.readFileSync(genericPath, 'utf8');
  assert.match(generic, /PreflightSim GitHub Issue Bridge/);
  assert.doesNotMatch(generic, /github-native-sim\/requests/);
});
