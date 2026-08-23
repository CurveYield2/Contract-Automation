import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');
const workflowPath = path.join(repoRoot, '.github/workflows/audit-controller-execution.yml');
const resolverPath = path.join(repoRoot, 'packages/github-native-sim/src/request-resolution-v1.mjs');

test('canonical V7 bridge resolves exactly one atomic request file from request PRs', () => {
  assert.equal(fs.existsSync(workflowPath), true, 'canonical V7 execution workflow must exist');
  const workflow = fs.readFileSync(workflowPath, 'utf8');
  const resolver = fs.readFileSync(resolverPath, 'utf8');

  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /github-native-sim\/requests\/\*\*\/request\.json/);
  assert.match(workflow, /name:\s*Checkout atomic request source for PR/);
  assert.match(workflow, /path:\s*\.request-source/);
  assert.match(workflow, /npm run v7 -- resolve --mode pr --source \.request-source --output \.v7-request\/request\.json/);
  assert.match(resolver, /const candidates = await findPrRequests/);
  assert.match(resolver, /candidates\.length !== 1/);
  assert.match(resolver, /PR request source must contain exactly one atomic request/);
  assert.match(workflow, /SIM_ARCHIVE_PRIMARY_ETHEREUM_01:\s*\$\{\{\s*secrets\.SIM_ARCHIVE_PRIMARY_ETHEREUM_01\s*\}\}/);
  assert.doesNotMatch(workflow, /push:\s*[\s\S]*github-native-sim\/requests/);
});

test('canonical V7 bridge executes trusted main runner code and treats the PR checkout as request data only', () => {
  const workflow = fs.readFileSync(workflowPath, 'utf8');
  assert.match(workflow, /name:\s*Checkout trusted Contract-Automation runner/);
  assert.match(workflow, /ref:\s*main/);
  assert.match(workflow, /name:\s*Checkout atomic request source for PR/);
  assert.match(workflow, /repository:\s*\$\{\{ github\.repository \}\}/);
  assert.match(workflow, /ref:\s*\$\{\{ github\.event\.pull_request\.head\.sha \}\}/);
  assert.match(workflow, /path:\s*\.request-source/);
  assert.match(workflow, /npm run v7 -- resolve --mode pr/);
  assert.match(workflow, /npm run v7:execute -- --request \.v7-request\/request\.json/);
  assert.doesNotMatch(workflow, /Checkout exact Contract Automation request branch/);
});

test('canonical V7 bridge scopes private credentials to private checkout and execution rather than PR source checkout', () => {
  const workflow = fs.readFileSync(workflowPath, 'utf8');
  const prCheckoutStart = workflow.indexOf('- name: Checkout atomic request source for PR');
  const dispatchCheckoutStart = workflow.indexOf('- name: Checkout private Solo Audit Controller for manual dispatch');
  const executionStart = workflow.indexOf('- name: Execute V7 request');
  assert.ok(prCheckoutStart >= 0 && dispatchCheckoutStart > prCheckoutStart && executionStart > dispatchCheckoutStart);

  const prCheckout = workflow.slice(prCheckoutStart, dispatchCheckoutStart);
  assert.doesNotMatch(prCheckout, /AUDIT_CONTROLLER_GITHUB_TOKEN/);
  assert.doesNotMatch(prCheckout, /SIM_ARCHIVE_PRIMARY_ETHEREUM_01/);

  const dispatchAndExecution = workflow.slice(dispatchCheckoutStart);
  assert.match(dispatchAndExecution, /token:\s*\$\{\{ secrets\.AUDIT_CONTROLLER_GITHUB_TOKEN \}\}/);
  assert.match(dispatchAndExecution, /AUDIT_CONTROLLER_GITHUB_TOKEN:\s*\$\{\{ secrets\.AUDIT_CONTROLLER_GITHUB_TOKEN \}\}/);
  assert.match(dispatchAndExecution, /SIM_ARCHIVE_PRIMARY_ETHEREUM_01:\s*\$\{\{ secrets\.SIM_ARCHIVE_PRIMARY_ETHEREUM_01 \}\}/);
});

test('canonical V7 atomic request bridge does not modify the generic PreflightSim issue bridge', () => {
  const genericPath = path.join(repoRoot, '.github/workflows/github-bridge.yml');
  const generic = fs.readFileSync(genericPath, 'utf8');
  assert.match(generic, /PreflightSim GitHub Issue Bridge/);
  assert.doesNotMatch(generic, /github-native-sim\/requests/);
});
