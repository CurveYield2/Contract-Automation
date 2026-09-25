import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const workflowPath = path.join(root, '.github/workflows/development-agent-task-manager.yml');
const wakePath = path.join(root, 'scripts/browser-agent-wake.mjs');
const workflow = fs.readFileSync(workflowPath, 'utf8');
const wake = fs.readFileSync(wakePath, 'utf8');

test('development task manager is a scheduled watchdog-derived supervisor in Contract-Automation', () => {
  assert.match(workflow, /name: Development Agent Task Manager/);
  assert.match(workflow, /schedule:\s*\n\s*- cron: '4-59\/5 \* \* \* \*'/);
  assert.match(workflow, /Discover active development agents/);
  assert.match(workflow, /process\/development-agent-task-manager\/active/);
  assert.match(workflow, /max-parallel:\s*4/);
  assert.match(workflow, /\.github\/actions\/setup-browser-agent-runtime/);
  assert.match(workflow, /node scripts\/browser-agent-wake\.mjs/);
});

test('task manager binds exact specification, skill, repository, branch and checkpoint identities', () => {
  for (const token of [
    'specification_sha256=', 'skill_sha256=', 'target_repository=', 'target_branch=',
    'exact_resume_head=', 'lastCheckpointSha', 'specificationSha256', 'skillSha256'
  ]) assert.equal(workflow.includes(token), true, token);
  assert.match(workflow, /sha256sum \/tmp\/task-manager-spec\.md/);
  assert.match(workflow, /sha256sum \/tmp\/task-manager-skill\.md/);
  assert.match(workflow, /gh api "repos\/\$target_repo\/commits\/\$target_branch"/);
});

test('dead-agent decision uses exactly three immediate prompt attempts with at least 120 seconds each', () => {
  assert.match(workflow, /for attempt in 1 2 3; do/);
  assert.match(workflow, /WAKE_ACTION='wake_and_wait'/);
  assert.match(workflow, /RESPONSE_WAIT_MS='120000'/);
  assert.match(workflow, /if \[ "\$attempt" -gt 1 \]; then export REFRESH_BEFORE_WAKE='true'; fi/);
  assert.match(workflow, /THREE_CONSECUTIVE_UNANSWERED_PROMPTS/);
  assert.match(workflow, /minimumWaitMsPerAttempt:120000/);
  assert.match(workflow, /refreshBetweenAttempts:true/);
  assert.doesNotMatch(workflow, /sleep 120/);
  assert.doesNotMatch(workflow, /sleep 300/);
});

test('unviewable chat can trigger immediate replacement while provider failures fail safe', () => {
  assert.match(workflow, /chat_viewable=.*chatViewable/);
  assert.match(workflow, /failure_reason='CHAT_UNVIEWABLE'/);
  assert.match(workflow, /OBSERVATION_PROVIDER_FAILURE/);
  assert.match(workflow, /preserving the current worker for the next sweep rather than guessing that the agent died/);
});

test('state disappearance after discovery fails closed without running supervision', () => {
  assert.match(workflow, /id: manager_state/);
  assert.match(workflow, /echo 'valid=false' >> "\$GITHUB_OUTPUT"/);
  assert.match(workflow, /if: steps\.manager_state\.outputs\.valid == 'true' && steps\.completion\.outputs\.complete != 'true'/);
});

test('replacement agent resumes from durable branch head instead of predecessor chat memory', () => {
  assert.match(workflow, /checkpoint_sha=.*repos\/\$target_repo\/commits\/\$target_branch/);
  assert.match(workflow, /\[DEVELOPMENT_AGENT_RECOVERY_V1\]/);
  assert.match(workflow, /Repository state is authoritative/);
  assert.match(workflow, /predecessor_chat=\$predecessor/);
  assert.match(workflow, /replacement_generation=\$next_generation/);
  assert.match(workflow, /REPLACED_DEAD_AGENT/);
});

test('completion is machine gated and bound to exact authority digests', () => {
  assert.match(workflow, /curveyield-development-task-completion-v1/);
  assert.match(workflow, /\.managerId==\$manager and \.status=="COMPLETE"/);
  assert.match(workflow, /\.specificationSha256==\$spec and \.skillSha256==\$skill/);
  assert.match(workflow, /all\(\.tests\[\]; \.status=="PASS"\)/);
  assert.match(workflow, /compare\/\$implementation_head\.\.\.\$current_head/);
});

test('browser driver supports bounded prompt-and-wait with explicit refresh', () => {
  assert.match(wake, /async function waitForAssistantResponse/);
  assert.match(wake, /action === 'wake_and_wait'/);
  assert.match(wake, /Math\.max\(120000, requestedWait\)/);
  assert.match(wake, /REFRESH_BEFORE_WAKE/);
  assert.match(wake, /page\.reload\(/);
  assert.match(wake, /composerVisible/);
  assert.match(wake, /responded: response\.responded/);
});

test('task-manager instructions preserve existing-process-first and repository-boundary rules', () => {
  assert.match(workflow, /Reuse and integrate existing workflows, scripts, schemas, queues, bridges, and tests/);
  assert.match(workflow, /Create a new workflow only when no existing workflow can correctly own the responsibility/);
  assert.match(workflow, /Audit-Controller must contain no GitHub Actions workflows/);
  assert.doesNotMatch(workflow, /repos\/CurveYield2\/Audit-Controller\/contents\/.github\/workflows/);
});
