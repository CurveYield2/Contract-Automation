import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyV7QualificationChanges } from '../../../scripts/classify-v7-qualification-change.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');



test('project creation opens the sidebar and resolves semantic New project controls', () => {
  const source = read('scripts/browser-operations-v1.mjs');
  assert.match(source, /async function ensureSidebarOpen\(page\)/);
  assert.match(source, /open-sidebar-button/);
  assert.match(source, /aria-label="Open sidebar"/);
  assert.match(source, /async function findNewProjectControl\(page\)/);
  assert.match(source, /getByText\('New project', \{ exact: true \}\)/);
  assert.match(source, /getByText\('Projects', \{ exact: true \}\)/);
  assert.match(source, /sidebarToggleVisible=/);
  assert.match(source, /projectsVisible=/);
  assert.match(source, /newProjectTextVisible=/);
});

test('browser operation registry exposes reusable normal-ChatGPT project operations', () => {
  const source = read('scripts/browser-operations-v1.mjs');
  for (const operation of [
    'chatgpt.ensure_chat_mode',
    'chatgpt.ensure_project',
    'chatgpt.start_project_chat',
    'chatgpt.rename_current_chat',
  ]) {
    assert.match(source, new RegExp(operation.replaceAll('.', '\\.')));
  }
  assert.match(source, /Work/);
  assert.match(source, /Chat mode control/);
  assert.match(source, /New project/);
  assert.match(source, /New chat/);
  assert.match(source, /Rename/);
});

test('browser routine engine is data-driven and the first routine is the ultralite reviewer project flow', () => {
  const engine = read('scripts/browser-routine-engine-v1.mjs');
  const routine = JSON.parse(read('process/browser-routines/audit-ultralite-reviewer-v1.json'));
  assert.match(engine, /executeBrowserOperation/);
  assert.match(engine, /process.*browser-routines/);
  assert.match(engine, /runBrowserRoutineStage/);
  assert.equal(routine.schemaVersion, 'curveyield-browser-routine-v1');
  assert.equal(routine.id, 'audit-ultralite-reviewer-v1');
  assert.deepEqual(routine.stages.before_message.map((step) => step.operation), [
    'chatgpt.ensure_chat_mode',
    'chatgpt.ensure_project',
    'chatgpt.start_project_chat',
  ]);
  assert.deepEqual(routine.stages.after_message.map((step) => step.operation), [
    'chatgpt.rename_current_chat',
  ]);
});

test('wake runtime executes browser routines around the first message and returns project/chat metadata', () => {
  const source = read('scripts/browser-agent-wake.mjs');
  assert.match(source, /BROWSER_ROUTINE_ID/);
  assert.match(source, /CHATGPT_PROJECT_NAME/);
  assert.match(source, /CHATGPT_CHAT_NAME/);
  assert.match(source, /stage:\s*'before_message'/);
  assert.match(source, /await post\(page, wakeMessage\)/);
  assert.match(source, /stage:\s*'after_message'/);
  assert.match(source, /projectUrl:/);
  assert.match(source, /chatRenamed:/);
});

test('wake workflow carries packed routine/project/chat and repair policy through fresh-runner redispatch', () => {
  const workflow = read('.github/workflows/browser-agent-wake.yml');
  assert.match(workflow, /browser_context_b64:/);
  assert.doesNotMatch(workflow, /\n      browser_routine_id:/);
  assert.doesNotMatch(workflow, /\n      project_name:/);
  assert.doesNotMatch(workflow, /\n      chat_name:/);
  assert.match(workflow, /BROWSER_CONTEXT_B64:\s*\$\{\{ inputs\.browser_context_b64 \}\}/);
  assert.match(workflow, /base64 -d > \/tmp\/browser-context\.json/);
  assert.match(workflow, /BROWSER_ROUTINE_ID=\$\(jq -r '\.routineId \/\/ empty'/);
  assert.match(workflow, /CHATGPT_PROJECT_NAME=\$\(jq -r '\.projectName \/\/ empty'/);
  assert.match(workflow, /CHATGPT_CHAT_NAME=\$\(jq -r '\.chatName \/\/ empty'/);
  assert.match(workflow, /REPAIR_ENABLED=\$\(jq -r '\.repair\.enabled \/\/ false'/);
  assert.match(workflow, /RETRY_INPUTS_JSON:\s*\$\{\{ toJSON\(inputs\) \}\}/);
  assert.match(workflow, /chatgptProject=.*projectName/);
  assert.match(workflow, /activeChat=.*chatName/);
});

test('ultralite entry workflow starts Phase 0 in normal web chat and defers project creation to the first successor', () => {
  const workflow = read('.github/workflows/ultralite-audit-browser-orchestrator-v1.yml');
  assert.match(workflow, /ULTRALITE_AUDIT_PHASE0_BOOTSTRAP_V1/);
  assert.match(workflow, /NORMAL_CHATGPT_WEB_CHAT; do not use Work/);
  assert.match(workflow, /Use the GitHub connector app/);
  assert.match(workflow, /Execute Phase 0 to completion/);
  assert.match(workflow, /create\/reuse the campaign ChatGPT Project and launch the next reviewer automatically/);
  assert.match(workflow, /-f browser_context_b64="\$browser_context_b64"/);
  assert.match(workflow, /-f gate_expected_milestone_id=P0_BOOTSTRAP/);
});

test('successor routing is reviewer-count agnostic and injects live campaign/skill authority into normal project chats', () => {
  const workflow = read('.github/workflows/browser-agent-watchdog.yml');
  assert.match(workflow, /next_reviewer="\$\(jq -r '\.nextMilestone\.reviewer/);
  assert.match(workflow, /campaign_title="\$\(jq -r '\.title/);
  assert.match(workflow, /commits.*-f path="\$candidate"/);
  assert.match(workflow, /audit_skill_url=%s/);
  assert.match(workflow, /audit_skill_authority_source=%s/);
  assert.match(workflow, /connector_requirement=Use the GitHub connector app/);
  assert.match(workflow, /authority_rule=The audit skill URL above was resolved by authority precedence/);
  assert.match(workflow, /browser_context_b64="\$\(jq -nc/);
  assert.match(workflow, /routineId:\$routine/);
  assert.match(workflow, /projectName:\$project/);
  assert.match(workflow, /chatName:\$chat/);
  assert.match(workflow, /-f browser_context_b64="\$browser_context_b64"/);
  assert.doesNotMatch(workflow, /gate_expected_milestone" = "P8_10"/);
});

test('watchdog distinguishes browser infrastructure failures from reviewer breakdown and escalates persistent idle reviewers', () => {
  const workflow = read('.github/workflows/browser-agent-watchdog.yml');
  assert.match(workflow, /BROWSER_CHALLENGE_RETRY_LATER/);
  assert.match(workflow, /AUTH_REQUIRED/);
  assert.match(workflow, /CONVERSATION_UNAVAILABLE/);
  assert.match(workflow, /consecutiveUnviewable/);
  assert.match(workflow, /consecutiveIdlePokes/);
  assert.match(workflow, /IDLE_AFTER_\$\{prior_idle_pokes\}_WATCHDOG_POKES/);
  assert.match(workflow, /browser-agent-reviewer-repair-v1\.yml/);
  assert.match(workflow, /check_reviewer_repair_request/);
});

test('reviewer repair workflow resumes first and only resets to an exact handoff baseline under admitted conditions', () => {
  const workflow = read('.github/workflows/browser-agent-reviewer-repair-v1.yml');
  assert.match(workflow, /options: \[auto, resume_preferred, reset_to_handoff\]/);
  assert.match(workflow, /repair_request_valid=false/);
  assert.match(workflow, /curveyield-reviewer-repair-request-v1/);
  assert.match(workflow, /authoritativeHandoffIdentity\.contentCommit/);
  assert.match(workflow, /git rm -r --ignore-unmatch -- "\$CAMPAIGN_ROOT"/);
  assert.match(workflow, /git checkout "\$BASELINE_COMMIT" -- "\$CAMPAIGN_ROOT"/);
  assert.match(workflow, /for rel in source authority/);
  assert.match(workflow, /SKILL_AUTHORITY/);
  assert.match(workflow, /REVIEWER_REPAIR_RESET_v1\.json/);
  assert.match(workflow, /do not delete or reset them yourself/);
  assert.match(workflow, /browser_context_b64="\$\(jq -nc/);
  assert.match(workflow, /-f browser_context_b64="\$browser_context_b64"/);
});

test('reviewer repair request schema is exact and reset-only', () => {
  const schema = JSON.parse(read('protocol/schemas/curveyield-reviewer-repair-request-v1.schema.json'));
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.properties.schemaVersion.const, 'curveyield-reviewer-repair-request-v1');
  assert.equal(schema.properties.action.const, 'RESET_TO_HANDOFF');
  for (const required of ['campaignId','reviewer','milestoneId','handoffPath','baselineCommit','reason','requestedAt']) {
    assert.ok(schema.required.includes(required));
  }
});

test('browser routine/orchestration/repair changes stay in CONTROL_LIGHT qualification', () => {
  const paths = [
    '.github/workflows/browser-agent-wake.yml',
    '.github/workflows/browser-agent-watchdog.yml',
    '.github/workflows/browser-agent-reviewer-repair-v1.yml',
    '.github/workflows/ultralite-audit-browser-orchestrator-v1.yml',
    'scripts/browser-agent-wake.mjs',
    'scripts/browser-operations-v1.mjs',
    'scripts/browser-routine-engine-v1.mjs',
    'process/browser-routines/audit-ultralite-reviewer-v1.json',
    'process/browser-agent-wake/REGISTRATION_TEMPLATE_v1.json',
    'protocol/schemas/curveyield-reviewer-repair-request-v1.schema.json',
    'packages/github-native-sim/test/browser-agent-routines-v1.test.mjs',
  ];
  assert.equal(classifyV7QualificationChanges(paths).lane, 'CONTROL_LIGHT');
});


test('project creation can use the icon-only add control beside the Projects heading', () => {
  const source = read('scripts/browser-operations-v1.mjs');
  assert.match(source, /findProjectsSectionAddControl/);
  assert.match(source, /getByText\('Projects', \{ exact: true \}\)/);
  assert.match(source, /text === '' && box && box\.width <= 56 && box\.height <= 56/);
  assert.match(source, /count > 0 && count <= 3/);
});


test('fresh project routines wait for the normal ChatGPT composer before sidebar operations', () => {
  const source = read('scripts/browser-agent-wake.mjs');
  const block = source.slice(
    source.indexOf("if (mode === 'create_fresh' && browserRoutineId)"),
    source.indexOf('const before = await snapshot(page)')
  );
  assert.match(block, /await ensureComposer\(page\)/);
  assert.match(block, /loadBrowserRoutine\(browserRoutineId\)/);
  assert.ok(block.indexOf('await ensureComposer(page)') < block.indexOf('loadBrowserRoutine(browserRoutineId)'));
});
