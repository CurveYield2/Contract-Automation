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
  assert.match(source, /sidebar-toggle-button/);
  assert.match(source, /aria-label="Open sidebar"/);
  assert.match(source, /aria-label="Toggle sidebar"/);
  assert.match(source, /async function findNewProjectControl\(page\)/);
  assert.match(source, /await projects\.hover\(\)/);
  assert.match(source, /projects-plus-control/);
  assert.match(source, /looksOverflow/);
  assert.match(source, /looksPlus/);
  assert.doesNotMatch(source, /count > 0 && count <= 3/);
  assert.match(source, /async function exposeProjectsInSidebar\(page\)/);
  assert.match(source, /Organize sidebar/);
  assert.match(source, /menuitemcheckbox.*Projects/);
  assert.match(source, /sidebar-projects-recovery/);
  assert.match(source, /async function findSemanticProjectAction\(page\)/);
  assert.match(source, /new\|add\|create/);
  assert.match(source, /getByText\('New project', \{ exact: true \}\)/);
  assert.match(source, /getByText\('Projects', \{ exact: true \}\)/);
  assert.match(source, /async function visibleNavigationDiagnostics\(page\)/);
  assert.match(source, /sidebarToggleVisible=/);
  assert.match(source, /projectsVisible=/);
  assert.match(source, /newProjectTextVisible=/);
  assert.match(source, /visibleControls=/);
});

test('project creation records the exact backend response and only retries confirmed security challenges', () => {
  const source = read('scripts/browser-operations-v1.mjs');
  assert.match(source, /\/backend-api\/projects/);
  assert.match(source, /project-create-response/);
  assert.match(source, /cf-mitigated/);
  assert.match(source, /PROJECT_CREATE_REJECTED/);
  assert.match(source, /error\.code = 'BROWSER_CHALLENGE'/);
  assert.match(source, /error\.retryable = true/);
  assert.match(source, /safeBody/);
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
  assert.match(operations, /menuitemradio/);
  assert.match(operations, /Thinking time/);
  assert.match(operations, /button:has-text\("GPT-5\.6"\)/);
  assert.match(operations, /THINKING_EFFORT_UI_CHANGED/);
  assert.match(operations, /visibleControls=/);
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

test('assignment-v2 campaigns resolve active phase from Audit Campaign Directory rather than an active receipt', () => {
  const watchdog = read('.github/workflows/browser-agent-watchdog.yml');
  const repair = read('.github/workflows/browser-agent-reviewer-repair-v1.yml');
  assert.match(watchdog, /curveyield-audit-campaign-directory-entry-v2/);
  assert.match(watchdog, /currentAssignment\.phaseId/);
  assert.match(watchdog, /currentAssignment\.packetPath/);
  assert.match(repair, /directory_path="\$\(jq -r '\.watchdog\.gate\.statePath'/);
  assert.match(repair, /currentAssignment\.workSchemaPath/);
  assert.match(repair, /currentAssignment\.workFormPath/);
  assert.match(repair, /currentAssignment\.packetPath/);
  assert.doesNotMatch(repair, /nextMilestone\.phaseRange/);
});

test('long wake submission is duplicate-safe when ChatGPT transport no longer exposes the message body', () => {
  const source = read('scripts/browser-agent-wake.mjs');
  const postStart = source.indexOf('async function post(page, message)');
  const postEnd = source.indexOf('async function runWithPage', postStart);
  const postBlock = source.slice(postStart, postEnd);
  assert.match(postBlock, /send-request-observed/);
  assert.match(postBlock, /send-dom-persisted-without-body-marker/);
  assert.match(postBlock, /wakeMarkerVisible/);
  assert.match(postBlock, /likelyConversationWrite/);
  assert.match(postBlock, /composer-diagnostics/);
  assert.match(postBlock, /SEND_NOT_OBSERVED/);
  assert.match(postBlock, /postWithBackendVerification/);
  assert.match(postBlock, /WRITE_RESPONSE_MISSING/);
  assert.match(postBlock, /WRITE_REJECTED/);
  assert.match(postBlock, /DURABILITY_NOT_OBSERVED/);
  assert.match(postBlock, /persistedWakeVisible/);
  assert.match(postBlock, /responseCandidates/);
  assert.match(postBlock, /postSendChallenge/);
  assert.match(postBlock, /post-send health/);
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

test('watchdog observation classifies home-exit challenge and auth walls as infrastructure noise', () => {
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

test('campaign registration can preselect normal-chat continuity after repeated Project challenges', () => {
  const source = read('scripts/browser-agent-wake.mjs');
  assert.match(source, /projectCreationPolicy/);
  assert.match(source, /registration\.projectCreationPolicy/);
  assert.match(source, /projectCreationPolicy === 'skip'/);
  assert.match(source, /project-create-policy-skip/);
  const registration = JSON.parse(read('process/browser-agent-wake/registrations/curveyield-dex-v16-source-r2.json'));
  assert.equal(registration.projectCreationPolicy, 'skip');
});

test('Lite reviewer wake falls back to a normal durable chat when only Project creation is Cloudflare-challenged', () => {
  const source = read('scripts/browser-agent-wake.mjs');
  assert.match(source, /project-create-challenged-fallback/);
  assert.match(source, /browserRoutineId === 'audit-lite-reviewer-v1'/);
  assert.match(source, /error\?\.code === 'BROWSER_CHALLENGE'/);
  assert.match(source, /fallback: 'normal-chat'/);
  assert.match(source, /PROJECT_CREATE_CHALLENGED_FALLBACK/);
  assert.match(source, /projectChallengeFallback/);
  assert.match(source, /await page\.goto\('https:\/\/chatgpt\.com\/'/);
  assert.match(source, /recoveryHealth = await backendPreflight\(page\)/);
  assert.match(source, /Project challenge contaminated the current browser session/);
  assert.match(source, /await ensureComposer\(page\)/);
});

test('fresh reviewer wake can recover routine/project/chat context from the durable campaign registration', () => {
  const source = read('scripts/browser-agent-wake.mjs');
  assert.match(source, /hydrateBrowserContextFromRegistration/);
  assert.match(source, /process\/browser-agent-wake\/registrations/);
  assert.match(source, /registration\.browserRoutine/);
  assert.match(source, /registration\.chatgptProject\?\.name/);
  assert.match(source, /registration\.activeAssignment\?\.reviewer/);
  assert.match(source, /browser-context-source=campaign-registration/);
  assert.match(source, /await hydrateBrowserContextFromRegistration\(\)/);
});

test('wake runtime executes browser routines around the first message and returns project/chat metadata', () => {
  const source = read('scripts/browser-agent-wake.mjs');
  assert.match(source, /BROWSER_ROUTINE_ID/);
  assert.match(source, /CHATGPT_PROJECT_NAME/);
  assert.match(source, /CHATGPT_CHAT_NAME/);
  assert.match(source, /stage:\s*'before_message'/);
  assert.match(source, /await postWithBackendVerification\(page, wakeMessage\)/);
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

test('Lite browser orchestration launches assignment-v2 reviewers with the shared project routine context', () => {
  const workflow = read('.github/workflows/lite-audit-browser-orchestrator-v1.yml');
  assert.match(workflow, /Resolve campaign directory entry/);
  assert.match(workflow, /Audit Campaign Directory\/campaigns/);
  assert.match(workflow, /prepare-lite-assignment-successor-v2\.mjs/);
  assert.match(workflow, /curveyield-audit-campaign-directory-entry-v2/);
  assert.match(workflow, /Publish legacy successor receipt preparation when applicable/);
  assert.match(workflow, /gh workflow run browser-agent-wake\.yml/);
  assert.match(workflow, /audit-lite-reviewer-v1/);
  assert.match(workflow, /routineId:\$routine,projectName:\$project,chatName:\$chat/);
  assert.match(workflow, /-f browser_context_b64="\$browser_context_b64"/);
  assert.doesNotMatch(workflow, /CAMPAIGN_STATE_v1|ACTIVE_PHASE_POINTER|SOLO_AUDIT_STATE|web-bootstrap-agent/);
  assert.doesNotMatch(workflow, /SUCCESSOR_HANDOFF\.json|WAKE_UP_MESSAGE\.md|START_HERE_SUCCESSOR\.md/);
});

test('Audit Source Initialization creates only the Phase-0 receipt plus the separate campaign-directory entry', () => {
  const workflow = read('.github/workflows/audit-source-initialization-v1.yml');
  const run = read('scripts/audit-source-initialization/run-v1.sh');
  const receiptWriter = read('scripts/audit-source-initialization/write-phase0-receipt-v1.py');
  assert.match(receiptWriter, /PHASE_00_RECEIPT_v1\.json/);
  assert.match(receiptWriter, /CAMPAIGN_DIRECTORY_PATH/);
  assert.match(run, /Audit Campaign Directory\/campaigns/);
  assert.match(receiptWriter, /phase0-automation/);
  assert.match(run, /gh workflow run lite-phase0-bootstrap-v1\.yml/);
  assert.doesNotMatch(run, /write-state-v1\.py|CAMPAIGN_STATE_v1|ACTIVE_PHASE_POINTER_v1|SOLO_AUDIT_STATE_v1|\.deep-assurance/);
  assert.doesNotMatch(workflow, /browser-agent-wake\.yml/);
});

test('current assignment reviewer repair has no special Phase-0 browser reviewer path', () => {
  const workflow = read('.github/workflows/browser-agent-reviewer-repair-v1.yml');
  assert.match(workflow, /Resolve current or legacy repair mode/);
  assert.match(workflow, /Audit Campaign Directory\/campaigns/);
  assert.match(workflow, /curveyield-audit-campaign-directory-entry-v2/);
  assert.match(workflow, /mode=receipt/);
  assert.match(workflow, /mode=legacy/);
  assert.match(workflow, /browser-agent-reviewer-repair-legacy-v1\.yml/);
  assert.doesNotMatch(workflow, /web-bootstrap-agent|P0_BOOTSTRAP has no predecessor handoff baseline|CURVEYIELD_LITE_PHASE0_REPLACEMENT_V2/);
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

test('fresh reviewer launch is idempotent per campaign milestone and post-delivery bookkeeping cannot duplicate a reviewer', () => {
  const wake = read('.github/workflows/browser-agent-wake.yml');
  const runtime = read('scripts/browser-agent-wake.mjs');
  assert.match(wake, /Resolve idempotent reviewer launch/);
  assert.match(wake, /Fresh launch deduplicated/);
  assert.match(wake, /browser-agent-wake-\$\{\{ inputs\.campaign_id \}\}-\$\{\{ inputs\.worker_role \}\}-/);
  assert.match(runtime, /POST_DELIVERY_BOOKKEEPING_FAILED/);
  assert.match(runtime, /never fail over to another browser provider for/);
});

test('repair targets the current assignment reviewer and schema-governed durable work', () => {
  const repair = read('.github/workflows/browser-agent-reviewer-repair-v1.yml');
  assert.match(repair, /reviewer="\$\(jq -r '\.currentAssignment\.reviewer/);
  assert.match(repair, /phase_id="\$\(jq -r '\.currentAssignment\.phaseId/);
  assert.match(repair, /schema_path="\$\(jq -r '\.currentAssignment\.workSchemaPath/);
  assert.match(repair, /form_path="\$\(jq -r '\.currentAssignment\.workFormPath/);
  assert.match(repair, /packet_path="\$\(jq -r '\.currentAssignment\.packetPath/);
  assert.match(repair, /controllerValidation\.deficiencies/);
  assert.match(repair, /Resume from the latest durable schema-governed work form/);
  assert.doesNotMatch(repair, /WAKE_UP_MESSAGE\.md|nextMilestone\.reviewer/);
});

test('assignment reviewer repair resumes current work while legacy reset behavior stays isolated', () => {
  const workflow = read('.github/workflows/browser-agent-reviewer-repair-v1.yml');
  assert.match(workflow, /options: \[auto, resume_preferred, reset_to_handoff\]/);
  assert.match(workflow, /Current Lite campaigns have no reset-to-handoff control state/);
  assert.match(workflow, /Repair resumes from the current assignment\/work form and Git history/);
  assert.match(workflow, /Redispatch legacy repair for pre-receipt campaign/);
  assert.match(workflow, /browser-agent-reviewer-repair-legacy-v1\.yml/);
  assert.match(workflow, /Launch replacement reviewer/);
  assert.match(workflow, /-f browser_context_b64="\$\{\{ steps\.current\.outputs\.browser_context_b64 \}\}"/);
  assert.doesNotMatch(workflow, /REVIEWER_REPAIR_RESET_v1\.json|authoritativeHandoffIdentity\.contentCommit|WAKE_UP_MESSAGE\.md/);
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


test('project creation hovers Projects and distinguishes the plus control from the overflow menu', () => {
  const source = read('scripts/browser-operations-v1.mjs');
  assert.match(source, /findProjectsSectionAddControl/);
  assert.match(source, /getByText\('Projects', \{ exact: true \}\)/);
  assert.match(source, /await projects\.hover\(\)/);
  assert.match(source, /looksOverflow/);
  assert.match(source, /looksPlus/);
  assert.match(source, /projects-plus-control/);
  assert.doesNotMatch(source, /count > 0 && count <= 3/);
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

test('High effort uses the observed Power slider and verifies the spoken label', async () => {
  const { executeBrowserOperation } = await import('../../../scripts/browser-operations-v1.mjs');
  function fixture({ max = 2, highLabel = 'High, 3 of 3.' } = {}) {
    let value = 1;
    const keys = [];
    const empty = {
      first() { return this; }, nth() { return this; }, locator() { return this; },
      async isVisible() { return false; }, async count() { return 0; },
      async getAttribute() { return null; }, async innerText() { return ''; },
      async evaluateAll() { return []; },
    };
    const slider = {
      first() { return this; },
      async getAttribute(name) {
        return ({ 'aria-valuemin': '0', 'aria-valuemax': String(max), 'aria-valuenow': String(value) })[name] ?? null;
      },
    };
    const row = {
      first() { return this; }, locator() { return slider; },
      async isVisible() { return true; },
      async getAttribute(name) { return name === 'aria-describedby' ? 'effort-status effort-help' : null; },
      async press(key) { keys.push(key); if (key === 'ArrowRight') value += 1; },
    };
    const page = {
      locator(selector) {
        if (selector.startsWith('[data-reasoning-slider=')) return row;
        if (selector === '[id="effort-status"]') return { async innerText() { return value === 2 ? highLabel : 'Medium, 2 of 3.'; } };
        return empty;
      },
      getByText() { return empty; },
      async waitForTimeout() {},
    };
    return { page, keys, value: () => value };
  }

  const valid = fixture();
  assert.deepEqual(await executeBrowserOperation({
    page: valid.page, name: 'chatgpt.ensure_thinking_effort', args: { level: 'high' },
  }), { level: 'high', changed: true, verified: true });
  assert.equal(valid.value(), 2);
  assert.deepEqual(valid.keys, ['ArrowRight', 'Escape']);

  // Numeric maximum alone cannot claim High on a differently labelled widget.
  const wrongLabel = fixture({ highLabel: 'Maximum, 3 of 3.' });
  await assert.rejects(executeBrowserOperation({
    page: wrongLabel.page, name: 'chatgpt.ensure_thinking_effort', args: { level: 'high' },
  }), error => error.code === 'THINKING_EFFORT_UI_CHANGED');

  // Unknown slider ranges fail closed without changing a UI setting.
  const unknownRange = fixture({ max: 4 });
  await assert.rejects(executeBrowserOperation({
    page: unknownRange.page, name: 'chatgpt.ensure_thinking_effort', args: { level: 'high' },
  }), error => error.code === 'THINKING_EFFORT_UI_CHANGED');
  assert.deepEqual(unknownRange.keys, []);
});

test('only durable server chat URLs can activate a reviewer', async () => {
  const vm = await import('node:vm');
  const source = read('scripts/browser-agent-wake.mjs');
  const start = source.indexOf('function durableChatUrl(value)');
  const end = source.indexOf('class BrowserAgentError', start);
  assert.ok(start >= 0 && end > start);
  const valid = vm.runInNewContext(source.slice(start, end) + '; durableChatUrl', { URL });
  assert.equal(valid('https://chatgpt.com/c/ef676bc7-8c95-4fad-9262-bf4765c664dd'), true);
  assert.equal(valid('https://chatgpt.com/c/local-chatgpt%3Aef676bc7-8c95-4fad-9262-bf4765c664dd'), false);
  assert.equal(valid('https://chatgpt.com/c/local-chatgpt'), false);
  assert.equal(valid('https://chatgpt.com/'), false);
  assert.equal(valid('https://example.com/c/ef676bc7'), false);
  assert.equal(valid('not a URL'), false);
  assert.match(source, /ok: chatUrlVerified/);
  assert.match(source, /CHAT_URL_NOT_DURABLE/);
  assert.match(source, /waitForURL\(url => durableChatUrl\(url\.toString\(\)\), \{ timeout: 60000 \}\)/);
});
