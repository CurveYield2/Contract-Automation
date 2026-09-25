import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflow = fs.readFileSync('.github/workflows/v7-execution-infrastructure-qualification.yml', 'utf8');

test('qualification workflow supports fail-closed controller-only verification without rerunning the runner toolchain', () => {
  assert.match(workflow, /controller_ref:/);
  assert.match(workflow, /qualification_lane:/);
  assert.match(workflow, /CONTROLLER_ONLY/);
  assert.match(workflow, /Validate controller-only runner baseline/);
  assert.match(workflow, /V7_BASELINE_QUALIFIED_COMMIT/);
  assert.match(workflow, /classify-v7-qualification-change\.mjs/);
  assert.match(workflow, /CONTROLLER_ONLY refused/);
  assert.match(workflow, /secrets\.AUDIT_CONTROLLER_GITHUB_TOKEN/);
  assert.match(workflow, /gh repo clone CurveYield2\/Audit-Controller \.controller-under-test/);
  assert.match(workflow, /git fetch --depth=1 origin "\$CONTROLLER_REF"/);
  assert.match(workflow, /test "\$\(git rev-parse HEAD\)" = "\$CONTROLLER_REF"/);
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


test('controller-only lane preserves runner qualification identity and publishes only controller proof', () => {
  assert.match(workflow, /Publish controller-only qualification into canonical status/);
  assert.match(workflow, /status\.qualifiedCommit!==process\.env\.V7_BASELINE_QUALIFIED_COMMIT/);
  assert.match(workflow, /status\.workflowRunId/);
  assert.match(workflow, /status\.controllerQualification=controller/);
  assert.match(workflow, /runnerQualifiedCommit/);
  assert.match(workflow, /runnerQualificationRunId/);
});

test('FULL-only expensive steps remain gated away from controller-only lane', () => {
  for (const name of [
    'Cache npm download cache',
    'Install exact Node dependencies',
    'Install and verify canonical V7 toolchain',
    'Verify canonical runner manifest',
    'Anvil-only runner qualification',
    'Full repository Node test suite',
    'Repository static checks',
    'Repository build checks',
    'Live trusted-main Phase 6 and Phase 7 mutable-Anvil qualification',
  ]) {
    const start=workflow.indexOf(`- name: ${name}`);
    assert.ok(start>=0,name);
    const next=workflow.indexOf('\n      - name:',start+1);
    const block=workflow.slice(start,next===-1?undefined:next);
    assert.match(block,/V7_QUALIFICATION_LANE == 'FULL'/,name);
  }
});


test('controller-only publication re-reads current remote qualification status before CAS update', () => {
  assert.match(workflow, /status_api="repos\/\$GITHUB_REPOSITORY\/contents\/process\/V7_QUALIFICATION_STATUS\.json\?ref=main"/);
  assert.match(workflow, /gh api "\$status_api" --jq '\.content' \| base64 -d > \/tmp\/current-v7-status\.json/);
  assert.match(workflow, /fs\.readFileSync\('\/tmp\/current-v7-status\.json','utf8'\)/);
  assert.match(workflow, /canonical runner qualified commit changed during controller-only qualification/);
  assert.match(workflow, /canonical runner qualification run changed during controller-only qualification/);
  assert.match(workflow, /-f sha="\$existing_sha"/);
});
