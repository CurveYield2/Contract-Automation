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
    'chatgpt.ensure_thinking_effort',
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

test('audit wakes enforce verified High reasoning effort and expose authoritative current phase', () => {
  const operations = read('scripts/browser-operations-v1.mjs');
  const runtime = read('scripts/browser-agent-wake.mjs');
  const wake = read('.github/workflows/browser-agent-wake.yml');
  assert.match(operations, /ensureThinkingEffort/);
  assert.match(operations, /getByText\('High', \{ exact: true \}\)/);
  assert.match(operations, /High thinking-effort control could not be selected and verified/);
  assert.match(runtime, /CHATGPT_THINKING_EFFORT/);
  assert.match(runtime, /chatgpt\.ensure_thinking_effort/);
  assert.match(wake, /default: high/);
  assert.match(wake, /current_phase=%s/);
  assert.match(wake, /reasoning_effort=%s/);
  assert.match(wake, /activeAssignment=\{phaseId:\$phaseId,milestoneId:\$milestoneId,workerRole:\$workerRole,thinkingEffort:\$thinkingEffort\}/);
  assert.match(wake, /expectedPhaseId:\$phaseId,expectedMilestoneId:\$milestoneId/);
});

test('technical execution wakes preserve semantic phase and do not reuse stale bootstrap watchdog text', () => {
  const workflow = read('.github/workflows/audit-controller-execution.yml');
  assert.match(workflow, /request_phase_id=/);
  assert.match(workflow, /registered_phase=/);
  assert.match(workflow, /semantic_phase_id=/);
  assert.match(workflow, /technical_phase=\$request_phase_id/);
  assert.match(workflow, /\[AUDIT_AGENT_WATCHDOG_V2\]/);
  assert.match(workflow, /current_phase=\$semantic_phase_id/);
  assert.match(workflow, /gate_expected_phase="\$semantic_phase_id"/);
  assert.doesNotMatch(workflow, /watchdog_message="\$\(jq -r '\.watchdog\.idleMessage/);
});

test('successor and reviewer-repair wakes state the semantic phase explicitly', () => {
  const watchdog = read('.github/workflows/browser-agent-watchdog.yml');
  const repair = read('.github/workflows/browser-agent-reviewer-repair-v1.yml');
  assert.match(watchdog, /printf 'phase=%s\\n' "\$next_phase"/);
  assert.match(watchdog, /reasoning_effort=high/);
  assert.match(repair, /phase_start="\$\(jq -r '\.nextMilestone\.phaseRange\[0\] \/\/ empty'/);
  assert.match(repair, /if \[ -z "\$phase_start" \] && \[\[ "\$gate_expected_phase" =~ \^phase-/);
  assert.match(repair, /printf 'phase=phase-%s\\n' "\$PHASE_START"/);
  assert.match(repair, /reasoning_effort=high/);
});

test('long Phase-0 wake submission accepts independent UI proof instead of one exact rendered text node', () => {
  const source = read('scripts/browser-agent-wake.mjs');
  const postStart = source.indexOf('async function post(page, message)');
  const postEnd = source.indexOf('async function runWithPage', postStart);
  const postBlock = source.slice(postStart, postEnd);
  assert.match(postBlock, /beforeUserCount/);
  assert.match(postBlock, /afterUserCount/);
  assert.match(postBlock, /generating/);
  assert.match(postBlock, /!visible && afterUserCount <= beforeUserCount && !generating/);
});

test('failed non-infrastructure idle pokes consume the escalation budget and can repair Phase-0', () => {
  const workflow = read('.github/workflows/browser-agent-watchdog.yml');
  assert.match(workflow, /IDLE_POKE_FAILED_COUNTED/);
  assert.match(workflow, /failed_idle_pokes=\$\(\(prior_idle_pokes \+ 1\)\)/);
  assert.match(workflow, /IDLE_AFTER_\$\{failed_idle_pokes\}_WATCHDOG_ATTEMPTS_LAST_POKE_FAILED/);
  assert.match(workflow, /IDLE_POKE_INFRA_RETRY_LATER/);
});

test('source-fanout rich Phase-0 envelope remains inside the YAML run block', () => {
  const workflow = read('.github/workflows/agent-zip-import-v1.yml');
  assert.doesNotMatch(workflow, /^\[ULTRALITE_AUDIT_PHASE0_BOOTSTRAP_V1\]/m);
  assert.match(workflow, /printf '%s\\n' '\[ULTRALITE_AUDIT_PHASE0_BOOTSTRAP_V1\]'/);
});

test('source fanout launches Phase-0 with the canonical rich Ultralite bootstrap envelope', () => {
  const workflow = read('.github/workflows/agent-zip-import-v1.yml');
  assert.match(workflow, /\[ULTRALITE_AUDIT_PHASE0_BOOTSTRAP_V1\]/);
  assert.match(workflow, /connector_requirement=Use the GitHub connector app for all repository reads\/writes\./);
  assert.match(workflow, /audit-process\/v7\/LITE_PRIMARY_SKILL_AUTHORITY_v1\.json/);
  assert.match(workflow, /create\/seal the P0_TO_P1 successor packet\/handoff/);
  assert.match(workflow, /watchdog_message="\$wake_message"/);
});

test('watchdog observation fails over provider-specific challenge and auth walls before classifying infrastructure noise', () => {
  const source = read('scripts/browser-agent-wake.mjs');
  const observeStart = source.indexOf("if (action === 'observe')");
  const providerStart = source.indexOf('const providers = [');
  const observeBlock = source.slice(observeStart, providerStart);
  assert.match(observeBlock, /before\.humanChallenge/);
  assert.match(observeBlock, /BROWSER_CHALLENGE/);
  assert.match(observeBlock, /before\.loginPrompt/);
  assert.match(observeBlock, /AUTH_REQUIRED/);
  assert.match(source, /providerFailures:\s*failures/);
  assert.match(source, /failures\.find\(\(entry\) => entry\.code === 'BROWSER_CHALLENGE'\)/);
  assert.match(source, /failures\.find\(\(entry\) => entry\.code === 'AUTH_REQUIRED'\)/);
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

test('source-fanout Phase-0 wake carries Ultralite repair policy while remaining outside the campaign Project', () => {
  const workflow = read('.github/workflows/agent-zip-import-v1.yml');
  assert.match(workflow, /browserRoutine.*audit-ultralite-reviewer-v1/);
  assert.match(workflow, /repair_enabled=.*audit-ultralite-reviewer-v1/);
  assert.match(workflow, /repair:\{enabled:\$repairEnabled,idlePokeThreshold:\$idlePokeThreshold,unviewableThreshold:\$unviewableThreshold\}/);
  assert.match(workflow, /-f browser_context_b64="\$browser_context_b64"/);
  assert.doesNotMatch(workflow, /Phase-0 Ultralite bootstrap[^\n]*campaign Project[^\n]*audit-ultralite-reviewer-v1/);
});

test('Phase-0 reviewer repair resumes from durable bootstrap state without requiring a predecessor handoff', () => {
  const workflow = read('.github/workflows/browser-agent-reviewer-repair-v1.yml');
  assert.match(workflow, /phase0_bootstrap=false/);
  assert.match(workflow, /gate_expected_phase.*phase-0/);
  assert.match(workflow, /gate_expected_milestone.*P0_BOOTSTRAP/);
  assert.match(workflow, /reviewer=.*web-bootstrap-agent/);
  assert.match(workflow, /P0_BOOTSTRAP has no predecessor handoff baseline/);
  assert.match(workflow, /AUDIT_PHASE0_BOOTSTRAP_REPLACEMENT_V1/);
  assert.match(workflow, /NORMAL_CHATGPT_WEB_CHAT_OUTSIDE_CAMPAIGN_PROJECT/);
  assert.match(workflow, /Do not repeat completed source fan-out/);
  assert.match(workflow, /routineId:"",projectName:""/);
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

test('watchdog permits resume-first reviewer repair at the P0_BOOTSTRAP gate', () => {
  const workflow = read('.github/workflows/browser-agent-watchdog.yml');
  const repairBlock = workflow.slice(
    workflow.indexOf('dispatch_reviewer_repair() {'),
    workflow.indexOf('check_reviewer_repair_request() {')
  );
  assert.match(repairBlock, /browser-agent-reviewer-repair-v1\.yml/);
  assert.doesNotMatch(repairBlock, /gate_expected_milestone.*!=.*P0_BOOTSTRAP/);
  assert.match(repairBlock, /P0_BOOTSTRAP is repairable/);
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
  assert.ok(workflow.includes('audit-process/v7/LITE_PRIMARY_SKILL_AUTHORITY_v1.json'));
  assert.match(workflow, /skill_authority_source="CAMPAIGN_BOUND"/);
  assert.match(workflow, /skill_authority_source="LITE_PRIMARY_DEFAULT"/);
  assert.match(workflow, /skill_authority_source="LEGACY_NEWEST_ZIP_FALLBACK"/);
  assert.match(workflow, /observed_blob_sha/);
  assert.match(workflow, /audit_skill_url=%s/);
  assert.match(workflow, /audit_skill_authority_source=%s/);
  assert.doesNotMatch(workflow, /latest_audit_skill_url=/);
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
