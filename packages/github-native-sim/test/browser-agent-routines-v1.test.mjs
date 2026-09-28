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

test('browser routine engine is data-driven and the generic reviewer routine is the Lite project flow', () => {
  const engine = read('scripts/browser-routine-engine-v1.mjs');
  const routine = JSON.parse(read('process/browser-routines/audit-lite-reviewer-v1.json'));
  assert.match(engine, /executeBrowserOperation/);
  assert.match(engine, /process.*browser-routines/);
  assert.match(engine, /runBrowserRoutineStage/);
  assert.equal(routine.schemaVersion, 'curveyield-browser-routine-v1');
  assert.equal(routine.id, 'audit-lite-reviewer-v1');
  assert.deepEqual(routine.stages.before_message.map((step) => step.operation), [
    'chatgpt.ensure_chat_mode',
    'chatgpt.ensure_project',
    'chatgpt.start_project_chat',
  ]);
  assert.deepEqual(routine.stages.after_message.map((step) => step.operation), [
    'chatgpt.rename_current_chat',
  ]);
});

test('audit wakes enforce verified High reasoning effort and keep follow-up messages minimal', () => {
  const operations = read('scripts/browser-operations-v1.mjs');
  const runtime = read('scripts/browser-agent-wake.mjs');
  const wake = read('.github/workflows/browser-agent-wake.yml');
  assert.match(operations, /ensureThinkingEffort/);
  assert.match(operations, /getByText\('High', \{ exact: true \}\)/);
  assert.match(operations, /High thinking-effort control could not be selected and verified/);
  assert.match(runtime, /CHATGPT_THINKING_EFFORT/);
  assert.match(runtime, /chatgpt\.ensure_thinking_effort/);
  assert.match(wake, /default: high/);
  assert.match(wake, /if \[ "\$WAKE_MODE" = "create_fresh" \]/);
  assert.match(wake, /printf '%s\\n' 'GET BACK TO WORK' > \/tmp\/wake-message\.txt/);
  assert.match(wake, /printf '%s\\n' 'GET BACK TO WORK' > \/tmp\/watchdog-message\.txt/);
  assert.match(wake, /activeAssignment=\{phaseId:\$phaseId,milestoneId:\$milestoneId,workerRole:\$workerRole,thinkingEffort:\$thinkingEffort\}/);
});

test('technical execution callbacks never create a reviewer and only poke the existing chat', () => {
  const workflow = read('.github/workflows/audit-controller-execution.yml');
  assert.match(workflow, /mode="resume_existing"/);
  assert.match(workflow, /wake_message='GET BACK TO WORK'/);
  assert.match(workflow, /watchdog_enabled=false/);
  assert.match(workflow, /No active reviewer chat URL/);
  assert.doesNotMatch(workflow, /\[AUDIT_AUTOMATION_WAKE_V1\]/);
});

test('successor phase comes from canonical pointer and repair phase comes from current campaign state', () => {
  const watchdog = read('.github/workflows/browser-agent-watchdog.yml');
  const repair = read('.github/workflows/browser-agent-reviewer-repair-v1.yml');
  assert.match(watchdog, /next_phase="\$\(jq -r '\.nextPhaseId \/\/ empty'/);
  assert.match(watchdog, /\[\[ "\$next_phase" =~ \^phase-\[0-9\]\+\$ \]\]/);
  assert.match(repair, /current_phase_id="\$\(jq -r '\.phase\.id \/\/ empty'/);
  assert.match(repair, /phase_start="\$\{BASH_REMATCH\[1\]\}"/);
  assert.doesNotMatch(repair, /nextMilestone\.phaseRange/);
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

test('Audit Source Initialization contains no reviewer wake envelope', () => {
  const workflow = read('.github/workflows/audit-source-initialization-v1.yml');
  assert.doesNotMatch(workflow, /ULTRALITE_AUDIT_PHASE0_BOOTSTRAP_V1/);
  assert.doesNotMatch(workflow, /browser-agent-wake\.yml/);
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

test('Lite browser orchestration resolves the Audit Campaign Directory and prepares a fresh reviewer from receipts', () => {
  const workflow = read('.github/workflows/lite-audit-browser-orchestrator-v1.yml');
  assert.match(workflow, /Resolve campaign directory entry/);
  assert.match(workflow, /Audit Campaign Directory\/campaigns/);
  assert.match(workflow, /prepare-lite-receipt-successor-v1\.mjs/);
  assert.match(workflow, /Publish successor receipt preparation/);
  assert.match(workflow, /gh workflow run browser-agent-wake\.yml/);
  assert.doesNotMatch(workflow, /CAMPAIGN_STATE_v1|ACTIVE_PHASE_POINTER|SOLO_AUDIT_STATE|web-bootstrap-agent/);
  assert.doesNotMatch(workflow, /SUCCESSOR_HANDOFF\.json|WAKE_UP_MESSAGE\.md|START_HERE_SUCCESSOR\.md/);
});

test('Audit Source Initialization creates only the Phase-0 receipt plus the separate campaign-directory entry', () => {
  const workflow = read('.github/workflows/audit-source-initialization-v1.yml');
  const run = read('scripts/audit-source-initialization/run-v1.sh');
  const receiptWriter = read('scripts/audit-source-initialization/write-phase0-receipt-v1.py');
  assert.match(receiptWriter, /PHASE_00_RECEIPT_v1\.json/);
  assert.match(receiptWriter, /Audit Campaign Directory\/campaigns/);
  assert.match(receiptWriter, /phase0-automation/);
  assert.match(run, /gh workflow run lite-phase0-bootstrap-v1\.yml/);
  assert.doesNotMatch(run, /write-state-v1\.py|CAMPAIGN_STATE_v1|ACTIVE_PHASE_POINTER_v1|SOLO_AUDIT_STATE_v1|\.deep-assurance/);
  assert.doesNotMatch(workflow, /browser-agent-wake\.yml/);
});

test('Phase-0 repair remains a special bootstrap replacement without a predecessor handoff', () => {
  const workflow = read('.github/workflows/browser-agent-reviewer-repair-v1.yml');
  assert.match(workflow, /phase0_bootstrap=false/);
  assert.match(workflow, /gate_expected_phase.*phase-0/);
  assert.match(workflow, /gate_expected_milestone.*P0_BOOTSTRAP/);
  assert.match(workflow, /reviewer=.*web-bootstrap-agent/);
  assert.match(workflow, /P0_BOOTSTRAP has no predecessor handoff baseline/);
  assert.match(workflow, /CURVEYIELD_LITE_PHASE0_REPLACEMENT_V2/);
  assert.match(workflow, /routineId:"",projectName:""/);
});

test('successor routing uses canonical nextPhaseId and sealed WAKE_UP_MESSAGE verbatim', () => {
  const workflow = read('.github/workflows/browser-agent-watchdog.yml');
  assert.match(workflow, /next_reviewer="\$\(jq -r '\.nextMilestone\.reviewer/);
  assert.match(workflow, /successorHandoff\.incomingReviewer/);
  assert.match(workflow, /next_phase="\$\(jq -r '\.nextPhaseId \/\/ empty'/);
  assert.match(workflow, /next_phase="\$\(jq -r '\.phase\.id \/\/ empty'/);
  assert.match(workflow, /wake_path="\$handoff_dir\/WAKE_UP_MESSAGE\.md"/);
  assert.match(workflow, /base64 -d > \/tmp\/sealed-successor-wake\.txt/);
  assert.match(workflow, /wake_b64="\$\(base64 -w0 \/tmp\/sealed-successor-wake\.txt\)"/);
  assert.match(workflow, /SUCCESSOR_HANDOFF\.json/);
  assert.match(workflow, /handoff_campaign_type/);
  assert.match(workflow, /handoff_assignment/);
  assert.match(workflow, /handoff_authority/);
  assert.match(workflow, /Campaign type:/);
  assert.match(workflow, /current authority Lite skill/);
  assert.match(workflow, /successor_wake_id="\$\{campaign_id\}-\$\{next_id\}-\$\{next_reviewer\}"/);
  assert.match(workflow, /GET BACK TO WORK/);
  assert.doesNotMatch(workflow, /AUDIT_REVIEWER_ROUTINE_V1/);
  assert.doesNotMatch(workflow, /CURVEYIELD_ULTRALITE_REVIEWER_LAUNCH_V2/);
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

test('Lite monitor persists across internal phase changes and terminates only at campaign terminal status', () => {
  const watchdog = read('.github/workflows/browser-agent-watchdog.yml');
  assert.match(watchdog, /Internal phase advancement .* keeping the same reviewer chat/);
  assert.match(watchdog, /INTERNAL_PHASE_SYNC_/);
  assert.match(watchdog, /LITE_CAMPAIGN_TERMINAL_/);
  assert.doesNotMatch(watchdog, /\[ "\$lite_campaign_status" = "COMPLETE" \] \|\| \[ "\$lite_phase_state" = "CLOSED" \]/);
});

test('fresh reviewer launch is idempotent per campaign milestone and post-delivery errors cannot create provider duplicates', () => {
  const wake = read('.github/workflows/browser-agent-wake.yml');
  const runtime = read('scripts/browser-agent-wake.mjs');
  assert.match(wake, /Resolve idempotent reviewer launch/);
  assert.match(wake, /Fresh launch deduplicated/);
  assert.match(wake, /browser-agent-wake-\$\{\{ inputs\.campaign_id \}\}-\$\{\{ inputs\.worker_role \}\}-/);
  assert.match(runtime, /POST_DELIVERY_BOOKKEEPING_FAILED/);
  assert.match(runtime, /never fail over to another browser provider for/);
});

test('repair targets current reviewer and reuses its sealed wake instead of next reviewer', () => {
  const repair = read('.github/workflows/browser-agent-reviewer-repair-v1.yml');
  assert.match(repair, /Repair the CURRENT reviewer, never the next reviewer/);
  assert.match(repair, /\.phase\.reviewer/);
  assert.match(repair, /WAKE_UP_MESSAGE\.md/);
  assert.match(repair, /base64 -d > \/tmp\/replacement-wake\.txt/);
  assert.match(repair, /Clear confirmed dead reviewer chat binding/);
  assert.match(repair, /Send one-time repair context after sealed wake/);
  assert.match(repair, /messagePurpose:"repair_notice"/);
  assert.doesNotMatch(repair, /reviewer="\$\(jq -r '\.nextMilestone\.reviewer/);
});

test('reviewer repair resets only from an admitted exact handoff baseline and then reuses the sealed wake', () => {
  const workflow = read('.github/workflows/browser-agent-reviewer-repair-v1.yml');
  assert.match(workflow, /options: \[auto, resume_preferred, reset_to_handoff\]/);
  assert.match(workflow, /repair_request_valid=false/);
  assert.match(workflow, /curveyield-reviewer-repair-request-v1/);
  assert.match(workflow, /authoritativeHandoffIdentity\.contentCommit/);
  assert.match(workflow, /git rm -r --ignore-unmatch -- "\$CAMPAIGN_ROOT"/);
  assert.match(workflow, /git checkout "\$BASELINE_COMMIT" -- "\$CAMPAIGN_ROOT"/);
  assert.match(workflow, /for rel in source authority/);
  assert.match(workflow, /REVIEWER_REPAIR_RESET_v1\.json/);
  assert.match(workflow, /WAKE_UP_MESSAGE\.md/);
  assert.match(workflow, /Clear confirmed dead reviewer chat binding/);
  assert.match(workflow, /Send one-time repair context after sealed wake/);
  assert.match(workflow, /messagePurpose:"repair_notice"/);
  assert.match(workflow, /terminated in the middle of this same assigned task/);
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
    '.github/workflows/lite-audit-browser-orchestrator-v1.yml',
    'scripts/browser-agent-wake.mjs',
    'scripts/browser-operations-v1.mjs',
    'scripts/browser-routine-engine-v1.mjs',
    'process/browser-routines/audit-lite-reviewer-v1.json',
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
