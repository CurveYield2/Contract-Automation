import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');
const workflowPath = path.join(repoRoot, '.github/workflows/audit-controller-execution.yml');

test('canonical V7 execution workflow scopes private controller auth and archive RPC to the steps that require them', () => {
  assert.equal(fs.existsSync(workflowPath), true, 'canonical V7 execution workflow must exist');
  const workflow = fs.readFileSync(workflowPath, 'utf8');
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /name:\s*Checkout private Audit Controller for manual dispatch/);
  assert.match(workflow, /name:\s*Select working Audit-Controller credential for manual dispatch/);
  assert.match(workflow, /AUDIT_CONTROLLER_PRIMARY_TOKEN:\s*\$\{\{ secrets\.AUDIT_CONTROLLER_GITHUB_TOKEN \}\}/);
  assert.match(workflow, /PREFLIGHTSIM_FALLBACK_TOKEN:\s*\$\{\{ secrets\.PREFLIGHTSIM_GITHUB_TOKEN \}\}/);
  assert.match(workflow, /GH_TOKEN:\s*\$\{\{ env\.AUDIT_CONTROLLER_GITHUB_TOKEN \}\}/);
  assert.match(workflow, /gh api repos\/CurveYield2\/Audit-Controller --silent/);
  assert.match(workflow, /gh repo clone CurveYield2\/Audit-Controller \.controller-request/);

  assert.match(workflow, /name:\s*Checkout exact private controller for controller operation/);
  assert.match(workflow, /if:\s*env\.V7_REQUEST_KIND == 'controller-operation'/);
  assert.match(workflow, /gh repo clone CurveYield2\/Audit-Controller \.controller-operation/);
  assert.match(workflow, /git fetch --depth=1 origin "\$AUDIT_CONTROLLER_REF"/);
  assert.match(workflow, /test "\$\(git rev-parse HEAD\)" = "\$AUDIT_CONTROLLER_REF"/);
  assert.match(workflow, /name:\s*Write controller-operation result back to exact private branch/);
  assert.match(workflow, /gh auth setup-git/);
  assert.match(workflow, /name:\s*Execute V7 request/);
  assert.match(workflow, /AUDIT_CONTROLLER_GITHUB_TOKEN:\s*\$\{\{ env\.AUDIT_CONTROLLER_GITHUB_TOKEN \}\}/);
  assert.doesNotMatch(workflow, /AUDIT_CONTROLLER_GITHUB_TOKEN\s*\|\|\s*secrets\.PREFLIGHTSIM_GITHUB_TOKEN/);
  assert.match(workflow, /SIM_ARCHIVE_PRIMARY_ETHEREUM_01:\s*\$\{\{ secrets\.SIM_ARCHIVE_PRIMARY_ETHEREUM_01 \}\}/);
  assert.match(workflow, /npm run v7:execute -- --request \.v7-request\/request\.json/);
  assert.match(workflow, /actions\/upload-artifact@v4/);
  assert.match(workflow, /path:\s*\.audit-evidence\/v7-execution/);
  assert.doesNotMatch(workflow, /RPC_ETHEREUM:\s*\$\{\{/);
});

test('generic PreflightSim bridge remains a separate workflow', () => {
  const genericPath = path.join(repoRoot, '.github/workflows/github-bridge.yml');
  const generic = fs.readFileSync(genericPath, 'utf8');
  assert.match(generic, /PreflightSim|preflight/i);
  assert.doesNotMatch(generic, /AUDIT_CONTROLLER_GITHUB_TOKEN/);
  assert.doesNotMatch(generic, /SIM_ARCHIVE_PRIMARY_ETHEREUM_01/);
});
