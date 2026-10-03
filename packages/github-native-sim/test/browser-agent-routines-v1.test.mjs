import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyV7QualificationChanges } from '../../../scripts/classify-v7-qualification-change.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');



test('project creation opens the sidebar and resolves visible New project controls', () => {
  const source = read('scripts/browser-operations-v1.mjs');
  assert.match(source, /async function ensureSidebarOpen\(page\)/);
  assert.match(source, /open-sidebar-button/);
  assert.match(source, /sidebar-toggle-button/);
  assert.match(source, /aria-label="Open sidebar"/);
  assert.match(source, /\['New chat', 'Scheduled', 'Plugins', 'Explore'\]/);
  assert.match(source, /alreadyOpen/);
  assert.doesNotMatch(source, /aria-label="Toggle sidebar"/);
  assert.match(source, /async function findNewProjectControl\(page\)/);
  assert.match(source, /await projects\.hover\(\)/);
  assert.match(source, /async function findProjectsSectionAddControl\(page\)/);
  assert.match(source, /aria-label\*="Add"/);
  assert.match(source, /async function exposeProjectsInSidebar\(page\)/);
  assert.match(source, /Organize sidebar/);
  assert.match(source, /menuitemcheckbox/);
  assert.match(source, /sidebar-projects-recovery/);
  assert.match(source, /async function findSemanticProjectAction\(page\)/);
  assert.match(source, /getByRole\('button'/);
  assert.match(source, /getByText\('New project', \{ exact: true \}\)/);
  assert.match(source, /getByText\('Projects', \{ exact: true \}\)/);
  assert.doesNotMatch(source, /evaluateAll\(|innerText\(/);
});

test('Phase1 captures the private Project share URL through visible overflow/share and OS clipboard', () => {
  const source = read('scripts/browser-operations-v1.mjs');
  assert.match(source, /findProjectOverflowControl/);
  assert.match(source, /await entry\.hover\(\)/);
  assert.match(source, /Share project/);
  assert.match(source, /Share link/);
  assert.match(source, /readOsClipboard/);
  assert.match(source, /spawnSync\('xclip'/);
  assert.match(source, /PROJECT_SHARE_URL_MISSING/);
  assert.match(source, /project-share-url-captured/);
  assert.doesNotMatch(source, /navigator\.clipboard|page\.evaluate\(/);
});

test('later and replacement reviewers open the persisted Project URL and never create a second Project', () => {
  const openRoutine = read('process/browser-routines/audit-lite-reviewer-project-open-v1.json');
  const repair = read('.github/workflows/browser-agent-reviewer-repair-v1.yml');
  assert.match(openRoutine, /chatgpt\.open_project_url/);
  assert.match(openRoutine, /chatgpt\.start_current_project_chat/);
  assert.doesNotMatch(openRoutine, /chatgpt\.create_project/);
  assert.match(repair, /audit-lite-reviewer-project-open-v1/);
  assert.match(repair, /project_url=.*chatgptProject\.url/);
  assert.match(repair, /projectUrl:\$projectUrl/);
});

test('project creation verifies success only through visible Project UI', () => {
  const source = read('scripts/browser-operations-v1.mjs');
  assert.match(source, /PROJECT_CREATE_VERIFICATION_MISSING/);
  assert.match(source, /findProjectEntry/);
  assert.match(source, /getByText\(projectName, \{ exact: true \}\)/);
  assert.doesNotMatch(source, /\/backend-api\/projects/);
  assert.doesNotMatch(source, /waitForResponse\(/);
  assert.doesNotMatch(source, /page\.on\(['"]response/);
  assert.doesNotMatch(source, /cf-mitigated/);
});

test('browser operation registry exposes reusable normal-ChatGPT project operations', () => {
  const source = read('scripts/browser-operations-v1.mjs');
  for (const operation of [
    'chatgpt.ensure_chat_mode',
    'chatgpt.ensure_thinking_effort',
    'chatgpt.create_project',
    'chatgpt.capture_project_share_link',
    'chatgpt.open_project_url',
    'chatgpt.open_project_by_name',
    'chatgpt.start_current_project_chat',
    'chatgpt.rename_current_chat',
  ]) {
    assert.match(source, new RegExp(operation.replaceAll('.', '\\.')));
  }
  assert.match(source, /Work/);
  assert.match(source, /Chat mode control/);
  assert.match(source, /chatSelected/);
  assert.match(source, /humanPointerClick\(page, chat/);
  assert.match(source, /Chat mode did not expose a composer/);
  assert.match(source, /New project/);
  assert.match(source, /New chat/);
  assert.match(source, /Rename/);
});

test('browser routine engine has separate deterministic Project-create and Project-open reviewer flows', () => {
  const engine = read('scripts/browser-routine-engine-v1.mjs');
  const create = JSON.parse(read('process/browser-routines/audit-lite-reviewer-project-create-v1.json'));
  const open = JSON.parse(read('process/browser-routines/audit-lite-reviewer-project-open-v1.json'));
  assert.match(engine, /executeBrowserOperation/);
  assert.match(engine, /process.*browser-routines/);
  assert.match(engine, /runBrowserRoutineStage/);
  assert.equal(create.schemaVersion, 'curveyield-browser-routine-v1');
  assert.equal(create.id, 'audit-lite-reviewer-project-create-v1');
  assert.deepEqual(create.stages.before_message.map((step) => step.operation), [
    'chatgpt.ensure_chat_mode',
    'chatgpt.create_project',
    'chatgpt.capture_project_share_link',
    'chatgpt.start_current_project_chat',
  ]);
  assert.equal(open.id, 'audit-lite-reviewer-project-open-v1');
  assert.deepEqual(open.stages.before_message.map((step) => step.operation), [
    'chatgpt.ensure_chat_mode',
    'chatgpt.open_project_url',
    'chatgpt.start_current_project_chat',
  ]);
  assert.doesNotMatch(read('.github/workflows/lite-audit-browser-orchestrator-v1.yml'), /audit-lite-reviewer-v1/);
});

test('audit wakes use visible High reasoning controls and keep follow-up messages minimal', () => {
  const operations = read('scripts/browser-operations-v1.mjs');
  const runtime = read('scripts/browser-agent-wake.mjs');
  const wake = read('.github/workflows/browser-agent-wake.yml');
  assert.match(operations, /ensureThinkingEffort/);
  assert.match(operations, /menuitemradio/);
  assert.match(operations, /button:has-text\("High"\)/);
  assert.match(operations, /THINKING_EFFORT_UI_CHANGED/);
  assert.match(operations, /humanPointerClick/);
  assert.doesNotMatch(operations, /evaluateAll\(|innerText\(|textContent/);
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

test('long wake submission verifies the visible user marker without ChatGPT network inspection', () => {
  const source = read('scripts/browser-agent-wake.mjs');
  const postStart = source.indexOf('async function post(page, message)');
  const postEnd = source.indexOf('async function runWithPage', postStart);
  const postBlock = source.slice(postStart, postEnd);
  assert.match(postBlock, /human-ui-send-observed/);
  assert.match(postBlock, /wakeMarkerVisible/);
  assert.match(postBlock, /composer-diagnostics/);
  assert.match(postBlock, /SEND_NOT_OBSERVED/);
  assert.match(postBlock, /postWithBackendVerification/);
  assert.match(postBlock, /DURABILITY_NOT_OBSERVED/);
  assert.match(postBlock, /persistedWakeVisible/);
  assert.match(postBlock, /postSendChallenge/);
  assert.doesNotMatch(postBlock, /likelyConversationWrite/);
  assert.doesNotMatch(postBlock, /send-request-observed/);
  assert.doesNotMatch(postBlock, /WRITE_RESPONSE_MISSING|WRITE_REJECTED/);
  assert.doesNotMatch(postBlock, /page\.on\(['"](?:request|response)/);
  assert.doesNotMatch(postBlock, /\/backend-api\//);
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

test('V16 Phase1 registration requires the deterministic Project-create/share-link routine', () => {
  const registration = JSON.parse(read('process/browser-agent-wake/registrations/curveyield-dex-v16-source-r2.json'));
  assert.equal(registration.browserInteractionPolicy, 'ordinary-pointer-keyboard-only');
  assert.equal(registration.browserRoutine, 'audit-lite-reviewer-project-create-v1');
  assert.equal(registration.chatgptProject.name, 'CurveYield DEX v16 Source r2');
  assert.equal(registration.chatgptProject.url, '');
  assert.equal(registration.projectCreationPolicy, undefined);
});

test('Project-create wakes fail closed before posting unless Share-link capture returns a valid Project URL', () => {
  const source = read('scripts/browser-agent-wake.mjs');
  assert.match(source, /routineBefore\.some\(\(entry\) => entry\.operation === 'chatgpt\.capture_project_share_link'\)/);
  assert.match(source, /PROJECT_SHARE_URL_REQUIRED/);
  assert.match(source, /capture_project_share_link/);
  assert.doesNotMatch(source, /project-create-challenged-fallback/);
  assert.doesNotMatch(source, /PROJECT_CREATE_CHALLENGED_FALLBACK/);
});

test('Phase1 workflow persists the captured private Project URL even if a later wake step fails', () => {
  const workflow = read('.github/workflows/browser-agent-wake.yml');
  const runtime = read('scripts/browser-agent-wake.mjs');
  assert.match(workflow, /Persist captured Phase-1 Project URL/);
  assert.match(workflow, /PROJECT_SHARE_URL_REQUIRED/);
  assert.match(workflow, /bind Phase1 Project URL/);
  assert.match(workflow, /chatgptProject=.*name:\$name,url:\$url/);
  assert.match(runtime, /projectName: projectName \|\| null/);
  assert.match(runtime, /projectUrl: projectUrl \|\| null/);
});

test('fresh Project chat creation refuses to reuse an already-open conversation composer', () => {
  const source = read('scripts/browser-operations-v1.mjs');
  assert.match(source, /findCurrentProjectNewChatControl/);
  assert.match(source, /alreadyInConversation/);
  assert.match(source, /PROJECT_NEW_CHAT_CONTROL_MISSING/);
  assert.match(source, /PROJECT_CHAT_COMPOSER_MISSING/);
});


test('fresh reviewer wake can recover routine/project/chat context from the durable campaign registration', () => {
  const source = read('scripts/browser-agent-wake.mjs');
  assert.match(source, /hydrateBrowserContextFromRegistration/);
  assert.match(source, /process\/browser-agent-wake\/registrations/);
  assert.match(source, /registration\.browserRoutine/);
  assert.match(source, /registration\.chatgptProject\?\.name/);
  assert.match(source, /registration\.chatgptProject\?\.url/);
  assert.match(source, /registration\.activeAssignment\?\.reviewer/);
  assert.match(source, /browser-context-source=campaign-registration/);
  assert.match(source, /await hydrateBrowserContextFromRegistration\(\)/);
});

test('wake runtime executes browser routines around the first message and returns project/chat metadata', () => {
  const source = read('scripts/browser-agent-wake.mjs');
  assert.match(source, /BROWSER_ROUTINE_ID/);
  assert.match(source, /CHATGPT_PROJECT_NAME/);
  assert.match(source, /CHATGPT_PROJECT_URL/);
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
  assert.match(workflow, /CHATGPT_PROJECT_URL=\$\(jq -r '\.projectUrl \/\/ empty'/);
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
  assert.match(workflow, /audit-lite-reviewer-project-create-v1/);
  assert.match(workflow, /audit-lite-reviewer-project-open-v1/);
  assert.match(workflow, /phase_id.*phase-1/);
  assert.match(workflow, /chatgptProject\.url/);
  assert.match(workflow, /routineId:\$routine,projectName:\$project,projectUrl:\$projectUrl,chatName:\$chat/);
  assert.match(workflow, /-f browser_context_b64="\$browser_context_b64"/);
  assert.match(workflow, /browserInteractionPolicy/);
  assert.doesNotMatch(workflow, /projectCreationPolicy/);
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

test('repair targets the current assignment reviewer with the same linked wake contract as fresh reviewers', () => {
  const repair = read('.github/workflows/browser-agent-reviewer-repair-v1.yml');
  assert.match(repair, /reviewer="\$\(jq -r '\.currentAssignment\.reviewer/);
  assert.match(repair, /phase_id="\$\(jq -r '\.currentAssignment\.phaseId/);
  assert.match(repair, /schema_path="\$\(jq -r '\.currentAssignment\.workSchemaPath/);
  assert.match(repair, /form_path="\$\(jq -r '\.currentAssignment\.workFormPath/);
  assert.match(repair, /packet_path="\$\(jq -r '\.currentAssignment\.packetPath/);
  assert.match(repair, /derivedInputPaths/);
  assert.match(repair, /Current phase: \$phase_id/);
  assert.match(repair, /Campaign: \$campaign_url/);
  assert.match(repair, /Current Audit Skill Authority: \$authority_url/);
  assert.match(repair, /Finalized controller validation: \$validation_url/);
  assert.match(repair, /Phase schema: \$schema_url/);
  assert.match(repair, /Assigned work form: \$form_url/);
  assert.match(repair, /Sealed predecessor receipt: \$receipt_url/);
  assert.match(repair, /Phase input %s:/);
  assert.match(repair, /ultimate authority/i);
  assert.match(repair, /in order, precisely, with no deviation/i);
  assert.match(repair, /CONTROLLER_PHASE_PASS/);
  assert.match(repair, /repair exactly the reported substantive deficiency/i);
  assert.match(repair, /resubmit validation/i);
  assert.match(repair, /controllerValidation\.deficiencies/);
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
    'process/browser-routines/audit-lite-reviewer-project-create-v1.json',
    'process/browser-routines/audit-lite-reviewer-project-open-v1.json',
    'process/browser-agent-wake/REGISTRATION_TEMPLATE_v1.json',
    'protocol/schemas/curveyield-reviewer-repair-request-v1.schema.json',
    'packages/github-native-sim/test/browser-agent-routines-v1.test.mjs',
  ];
  assert.equal(classifyV7QualificationChanges(paths).lane, 'CONTROL_LIGHT');
});


test('Project creation and reviewer wake use only ordinary pointer keyboard and OS clipboard primitives', () => {
  const operations = read('scripts/browser-operations-v1.mjs');
  const wake = read('scripts/browser-agent-wake.mjs');

  const projectStart = operations.indexOf('async function createProject(page, projectName)');
  const projectEnd = operations.indexOf('function validProjectUrl', projectStart);
  const projectBlock = operations.slice(projectStart, projectEnd);
  assert.match(projectBlock, /humanPointerClick\(page, trigger/);
  assert.match(projectBlock, /humanTypeInto\(page, input/);
  assert.match(projectBlock, /humanPointerClick\(page, submit/);
  assert.doesNotMatch(projectBlock, /\.fill\(/);
  assert.doesNotMatch(projectBlock, /force:\s*true/);
  assert.doesNotMatch(projectBlock, /requestSubmit|form\.submit/);
  assert.doesNotMatch(projectBlock, /waitForResponse|backend-api|page\.on\(['"]response/);

  const fillStart = wake.indexOf('async function fillComposer(page, message)');
  const fillEnd = wake.indexOf('async function persistedWakeVisible', fillStart);
  const sendBlock = wake.slice(fillStart, fillEnd);
  assert.match(sendBlock, /writeOsClipboard\(message\)/);
  assert.match(wake, /spawnSync\('xclip'/);
  assert.match(sendBlock, /composer\.press\(process\.platform === 'darwin' \? 'Meta\+V' : 'Control\+V'\)/);
  assert.match(sendBlock, /humanPointerClick\(page, send/);
  assert.match(sendBlock, /wakeMarkerVisible/);
  assert.doesNotMatch(sendBlock, /navigator\.clipboard|grantPermissions|page\.evaluate\(/);
  assert.doesNotMatch(sendBlock, /page\.on\(['"](?:request|response)/);
  assert.doesNotMatch(sendBlock, /\.fill\(/);
  assert.doesNotMatch(sendBlock, /force:\s*true/);
  assert.doesNotMatch(sendBlock, /requestSubmit|form\.submit/);
});

test('project creation hovers Projects and uses the visible accessible add-project control', () => {
  const source = read('scripts/browser-operations-v1.mjs');
  assert.match(source, /findProjectsSectionAddControl/);
  assert.match(source, /getByText\('Projects', \{ exact: true \}\)/);
  assert.match(source, /await projects\.hover\(\)/);
  assert.match(source, /aria-label\*="Add"/);
  assert.match(source, /aria-label\*="New"/);
  assert.match(source, /aria-label\*="Create"/);
  assert.doesNotMatch(source, /outerHTML|evaluateAll\(|innerText\(/);
});

test('fresh project routines let the existing Chat-mode operation establish the composer', () => {
  const runtime = read('scripts/browser-agent-wake.mjs');
  const routine = JSON.parse(read('process/browser-routines/audit-lite-reviewer-project-create-v1.json'));
  const block = runtime.slice(
    runtime.indexOf("if (mode === 'create_fresh' && browserRoutineId)"),
    runtime.indexOf('const before = await snapshot(page)')
  );
  assert.match(block, /loadBrowserRoutine\(browserRoutineId\)/);
  assert.doesNotMatch(block.slice(0, block.indexOf('loadBrowserRoutine(browserRoutineId)')), /await ensureComposer\(page\)/);
  assert.equal(routine.stages.before_message[0].operation, 'chatgpt.ensure_chat_mode');
});

test('High effort uses the visible Power control and ordinary keyboard selection', () => {
  const source = read('scripts/browser-operations-v1.mjs');
  const start = source.indexOf('async function ensureThinkingEffort');
  const end = source.indexOf('async function humanPointerClick', start);
  const block = source.slice(start, end);
  assert.match(block, /data-reasoning-slider/);
  assert.match(block, /await power\.press\('End'\)/);
  assert.match(block, /await power\.press\('Escape'\)/);
  assert.match(block, /button:has-text\("High"\)/);
  assert.match(block, /THINKING_EFFORT_UI_CHANGED/);
  assert.doesNotMatch(block, /getAttribute\('aria-valuenow'\)|innerText\(|evaluateAll\(/);
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


test('Project-create visible UI transition failures are retryable on a fresh runner', () => {
  const source = read('scripts/browser-operations-v1.mjs');
  assert.match(source, /function retryableProjectUiError/);
  for (const code of [
    'PROJECT_CREATE_CONTROL_MISSING',
    'PROJECT_NAME_INPUT_MISSING',
    'PROJECT_CREATE_SUBMIT_MISSING',
    'PROJECT_CREATE_VERIFICATION_MISSING',
  ]) {
    assert.match(source, new RegExp(code));
  }
  assert.match(source, /error\.retryable = true/);
  assert.doesNotMatch(source, /PROJECT_CREATE_REJECTED|cf-mitigated|waitForResponse|backend-api/);
});

test('Project-create retries remain human-interaction-only', () => {
  const source = read('scripts/browser-operations-v1.mjs');
  const start = source.indexOf('async function createProject(page, projectName)');
  const end = source.indexOf('\nfunction validProjectUrl', start);
  const block = source.slice(start, end);
  assert.match(block, /humanPointerClick\(page, trigger/);
  assert.match(block, /humanTypeInto\(page, input/);
  assert.match(block, /humanPointerClick\(page, submit/);
  assert.doesNotMatch(block, /\.click\(/);
  assert.doesNotMatch(block, /\.fill\(/);
  assert.doesNotMatch(block, /dispatchEvent/);
});


test('shared visible browser runtime waits for normal verification before Project routines', () => {
  const source = read('scripts/browser-agent-wake.mjs');
  assert.match(source, /async function backendPreflight\(page\)/);
  assert.match(source, /async function waitForBackendHealth\(page, reason = 'browser preflight'\)/);
  assert.match(source, /MANUAL_CHALLENGE_WAIT_MS/);
  assert.match(source, /INTERACTIVE_VIEW_ENABLED/);
  assert.match(source, /Browser verification is pending/);
  assert.match(source, /await waitForBackendHealth\(page, 'initial browser session'\)/);
  assert.match(source, /error\?\.code !== 'BROWSER_CHALLENGE'/);
  assert.match(source, /pre-message routine verification/);
  assert.match(source, /post-verification reload/);
  assert.match(source, /runBrowserRoutineStage/);
});

test('browser verification wait does not replace human Project interaction primitives', () => {
  const operations = read('scripts/browser-operations-v1.mjs');
  const start = operations.indexOf('async function createProject(page, projectName)');
  const end = operations.indexOf('\nfunction validProjectUrl', start);
  const block = operations.slice(start, end);
  assert.match(block, /humanPointerClick\(page, trigger/);
  assert.match(block, /humanTypeInto\(page, input/);
  assert.match(block, /humanPointerClick\(page, submit/);
  assert.doesNotMatch(block, /dispatchEvent|requestSubmit|form\.submit|force:\s*true/);
});


test('Project sidebar recovery follows visible Chat sidebar options through Organize sidebar and Show', () => {
  const source = read('scripts/browser-operations-v1.mjs');
  const start = source.indexOf('async function exposeProjectsInSidebar(page)');
  const end = source.indexOf('\nasync function ', start + 20);
  const block = source.slice(start, end);

  assert.match(block, /aria-label="Chat sidebar options"/);
  assert.match(block, /has-text\("Organize sidebar"\)/);
  assert.match(block, /has-text\("Show"\)/);
  assert.match(block, /has-text\("Projects"\)/);
  assert.match(block, /humanPointerClick\(page, sidebarOptions\)/);
  assert.match(block, /humanPointerClick\(page, organize\)/);
  assert.match(block, /humanPointerClick\(page, show\)/);
  assert.match(block, /humanPointerClick\(page, projectsOption\)/);
  assert.match(block, /firstVisibleText\(page, \['Explore'\]/);
  assert.match(block, /humanPointerClick\(page, explore\)/);
  assert.match(block, /projectsFromExplore/);
  assert.match(block, /sidebarOptionsFound/);
  assert.match(block, /showFound/);

  assert.doesNotMatch(block, /\.click\(/);
  assert.doesNotMatch(block, /dispatchEvent|evaluateAll\(|innerText\(/);
  assert.doesNotMatch(block, /force:\s*true/);
  assert.doesNotMatch(block, /requestSubmit|form\.submit/);
});

