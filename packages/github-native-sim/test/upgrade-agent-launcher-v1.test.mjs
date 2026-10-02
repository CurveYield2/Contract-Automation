import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildLaunchPaths,
  completedResult,
  defaultTargetBranch,
  managerIdentity,
  renderManagerRequest,
  renderTaskSpecification,
  safeSlug,
  validateLaunchInput,
} from '../../../process/development-agent-task-manager/launcher/shared/launcher-admission-v1.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');

const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

test('launcher slug and manager identities are deterministic and schema-safe', () => {
  assert.equal(safeSlug('  Repair Manager Status!!!  '), 'repair-manager-status');
  assert.deepEqual(managerIdentity('Repair Manager Status', 3), {
    slug: 'repair-manager-status',
    revision: 3,
    managerId: 'upgrade-repair-manager-status-r3',
  });
  assert.equal(defaultTargetBranch('Repair Manager Status', 3), 'upgrade/repair-manager-status-r3');
});

test('launcher validation defaults to managed Project continuity and rejects non-allowlisted targets', () => {
  const parsed = validateLaunchInput({
    taskName: 'Example',
    instruction: 'Do exactly this.',
    targetRepository: 'CurveYield2/Contract-Automation',
  });
  assert.equal(parsed.continuityMode, 'managed_project');
  assert.equal(parsed.baseRef, 'main');

  assert.throws(() => validateLaunchInput({
    taskName: 'Example',
    instruction: 'Do exactly this.',
    targetRepository: 'someone/else',
  }), /allowlisted/);
});

test('generated specification preserves the exact human instruction and requires merge to main', () => {
  const instruction = 'Preserve THIS exact wording.\nDo not broaden the task.';
  const spec = renderTaskSpecification({
    taskName: 'Exact task',
    instruction,
    targetRepository: 'CurveYield2/Contract-Automation',
    managerId: 'upgrade-exact-task-r1',
    resolvedTargetBranch: 'upgrade/exact-task-r1',
    acceptanceCriteria: ['Tests pass'],
  });
  assert.match(spec, /## Human Requested End-State/);
  assert.ok(spec.includes(instruction));
  assert.match(spec, /successful task concludes only after the verified implementation is merged into target repository `main`/);
});

test('generated request feeds only the existing development manager contract', () => {
  const managerId = 'upgrade-example-r1';
  const paths = buildLaunchPaths({ managerId });
  const request = renderManagerRequest({
    taskName: 'Example',
    instruction: 'Implement the requested change.',
    targetRepository: 'CurveYield2/Contract-Automation',
    managerId,
    resolvedTargetBranch: 'upgrade/example-r1',
    specificationPath: paths.specificationPath,
  });
  assert.deepEqual(request, {
    schemaVersion: 'curveyield-development-agent-task-request-v1',
    status: 'READY',
    managerId,
    specificationPath: paths.specificationPath,
    skillPath: 'process/development-agent-task-manager/UPGRADE_AGENT_EXECUTION_AUTHORITY_v1.md',
    authorityRef: 'main',
    targetRepository: 'CurveYield2/Contract-Automation',
    targetBranch: 'upgrade/example-r1',
    baseRef: 'main',
    continuityMode: 'managed_project',
  });
});

test('completed launcher result exists only after verified merge metadata is terminal', () => {
  assert.equal(completedResult({ status: 'COMPLETE' }), null);
  assert.equal(completedResult({
    status: 'COMPLETE',
    merge: { status: 'PENDING' },
    output: { url: 'https://github.com/CurveYield2/Contract-Automation/pull/1' },
  }), null);

  assert.deepEqual(completedResult({
    status: 'COMPLETE',
    merge: { status: 'MERGED' },
    output: { url: 'https://github.com/CurveYield2/Contract-Automation/pull/1' },
    continuity: {
      mode: 'managed_project',
      project: { url: 'https://chatgpt.com/g/g-p-example' },
    },
  }), {
    status: 'COMPLETE',
    outputUrl: 'https://github.com/CurveYield2/Contract-Automation/pull/1',
    projectUrl: 'https://chatgpt.com/g/g-p-example',
    artifactUrl: null,
  });
});

test('Cloudflare launcher is minimal intake plus submitted-task result lookup', () => {
  const worker = read('process/development-agent-task-manager/launcher/cloudflare/src/worker_v1.js');
  const html = read('process/development-agent-task-manager/launcher/cloudflare/public/index_v1.html');
  const app = read('process/development-agent-task-manager/launcher/cloudflare/public/app_v1.js');

  assert.match(worker, /POST/);
  assert.match(worker, /\/api\/tasks/);
  assert.match(worker, /atomicAdmissionCommit/);
  assert.match(worker, /verifyCloudflareAccess/);
  assert.match(worker, /githubAppJwt/);
  assert.doesNotMatch(worker, /browser-agent-wake|CHATGPT_STORAGE_STATE|wake_and_wait|WAKE_ACTION/);

  assert.match(html, /Task name/);
  assert.match(html, /What should the agent accomplish/);
  assert.match(html, /Target repository/);
  assert.match(html, /Open output/);
  assert.match(html, /Open ChatGPT Project/);
  assert.doesNotMatch(html, /dashboard|Sweep now|Replace agent/i);

  assert.match(app, /The verified implementation has been merged into the target repository main branch/);
  assert.match(app, /state\.outputUrl/);
  assert.match(app, /state\.projectUrl/);
});

test('Cloudflare configuration contains no credentials and defaults to Access protection', () => {
  const config = read('process/development-agent-task-manager/launcher/cloudflare/wrangler_v1.jsonc');
  assert.match(config, /"CF_ACCESS_REQUIRED": "true"/);
  assert.match(config, /UPGRADE_AGENT_EXECUTION_AUTHORITY_v1\.md/);
  assert.doesNotMatch(config, /GITHUB_APP_PRIVATE_KEY|CHATGPT_STORAGE_STATE_B64|AUDIT_CONTROLLER_GITHUB_TOKEN/);
});

test('GitHub fallback is intake-only and uses the shared admission renderer', () => {
  const workflow = read('.github/workflows/upgrade-agent-launcher-v1.yml');
  assert.match(workflow, /workflow_dispatch/);
  assert.match(workflow, /launcher-admission-v1\.js/);
  assert.match(workflow, /renderTaskSpecification/);
  assert.match(workflow, /renderManagerRequest/);
  assert.match(workflow, /exactly one manager request/i);
  assert.doesNotMatch(workflow, /browser-agent-wake|WAKE_ACTION|wake_and_wait/);
  assert.doesNotMatch(workflow, /gh workflow run[^\n]*Audit-Controller/);
});

test('development manager requires merge-to-main before terminal retirement', () => {
  const workflow = read('.github/workflows/development-agent-task-manager.yml');
  assert.match(workflow, /Finalize verified implementation into target main/);
  assert.match(workflow, /repos\/\$target_repo\/pulls/);
  assert.match(workflow, /merge_method=squash/);
  assert.match(workflow, /MERGED_TO_TARGET_MAIN/);
  assert.match(workflow, /Retire merged manager/);
  assert.match(workflow, /steps\.finalization\.outputs\.merged == 'true'/);
  assert.match(workflow, /\.merge\.status=="MERGED"/);
  assert.match(workflow, /\.output\.url\|test\("\^https:\/\/github\.com\/"\)/);
  assert.match(workflow, /DEVELOPMENT_AGENT_MERGE_REPAIR_V1/);
});

test('manager preserves Project continuity into terminal completed state', () => {
  const workflow = read('.github/workflows/development-agent-task-manager.yml');
  assert.match(workflow, /continuity:\{mode:\$continuityMode,project:\{name:\$projectName,url:\$projectUrl\}\}/);
  assert.doesNotMatch(workflow, /delete\(.continuity\)/);
});

test('launcher development policy remains isolated from audit execution workflows', () => {
  const workflowDir = path.join(root, '.github/workflows');
  const auditNames = fs.readdirSync(workflowDir).filter((name) =>
    /audit|phase0|phase9|reviewer|v7-execution/i.test(name) &&
    !['development-agent-task-manager.yml', 'upgrade-agent-launcher-v1.yml'].includes(name)
  );
  for (const name of auditNames) {
    const body = fs.readFileSync(path.join(workflowDir, name), 'utf8');
    assert.doesNotMatch(body, /UPGRADE_AGENT_EXECUTION_AUTHORITY_v1|upgrade-agent-launcher|DEVELOPMENT_AGENT_MERGE_REPAIR_V1/, name);
  }
});
