import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const source = fs.readFileSync(
  path.join(root, 'packages/browser-agent-original-phase0-v10/browser-agent-wake-v10.mjs'),
  'utf8',
);
const workflow = fs.readFileSync(
  path.join(root, '.github/workflows/browser-agent-home-exit-v10.yml'),
  'utf8',
);
const request = JSON.parse(fs.readFileSync(
  path.join(root, 'process/browser-agent-home-exit-v10/current-request-v10.json'),
  'utf8',
));

test('v10 ChatGPT verification is visible-browser-only', () => {
  assert.doesNotMatch(source, /\/backend-api\/models/);
  assert.doesNotMatch(source, /\/backend-api\/conversations/);
  assert.doesNotMatch(source, /page\.on\(['"]request['"]/);
  assert.doesNotMatch(source, /page\.on\(['"]response['"]/);
  assert.doesNotMatch(source, /fetch\s*\(/);
  assert.doesNotMatch(source, /force:\s*true/);
  assert.doesNotMatch(source, /\.evaluate\s*\(/);
  assert.doesNotMatch(source, /requestSubmit/);
  assert.doesNotMatch(source, /form\.submit/);

  assert.match(source, /async function humanPointerClick/);
  assert.match(source, /async function humanTypeInto/);
  assert.match(source, /send-strategy=human-pointer-click/);
  assert.match(source, /async function humanReload/);
  assert.match(source, /Control\+R/);
  assert.match(source, /visible-wake-before-reload/);
  assert.match(source, /visible-wake-after-reload/);
  assert.match(source, /verification: 'visible-browser-only'/);
});

test('create_fresh waits for a durable server route before persistence reload', () => {
  assert.match(source, /function chatRouteInfo/);
  assert.match(source, /id\.startsWith\('local-chatgpt:'\)/);
  assert.match(source, /async function waitForFreshChatRoute/);
  assert.match(source, /async function waitForDurableChatRoute/);
  assert.match(source, /timeoutMs = 300000/);
  assert.match(source, /BROWSER_CHALLENGE: visible ChatGPT\/Cloudflare verification detected while waiting for durable chat URL; aborting immediately/);

  const verifyStart = source.indexOf('async function postWithVisibleVerification');
  const verifyEnd = source.indexOf('\nasync function runWithPage', verifyStart);
  const block = source.slice(verifyStart, verifyEnd);

  const waitRoute = block.indexOf('initialRoute = await waitForFreshChatRoute');
  const beforeReload = block.indexOf('visible-wake-before-reload');
  const waitDurable = block.indexOf('initialRoute = await waitForDurableChatRoute');
  const reload = block.indexOf('await humanReload(page)');
  const afterReload = block.indexOf('visible-wake-after-reload');

  assert.ok(waitRoute >= 0);
  assert.ok(beforeReload > waitRoute);
  assert.ok(waitDurable > beforeReload);
  assert.ok(reload > waitDurable);
  assert.ok(afterReload > reload);
  assert.match(block, /!reloadedRoute\.isChat \|\| reloadedRoute\.isLocal/);
});

test('v10 Cloudflare challenge aborts immediately instead of waiting', () => {
  const start = source.indexOf('async function waitForVisibleBrowserReady');
  const end = source.indexOf('\nfunction chatRouteInfo', start);
  const block = source.slice(start, end);
  assert.match(block, /if \(visible\.humanChallenge\)/);
  assert.match(block, /BROWSER_CHALLENGE: visible ChatGPT\/Cloudflare verification detected; aborting immediately/);
  assert.ok(block.indexOf('if (visible.humanChallenge)') < block.indexOf('Date.now() >= deadline'));
});

test('visible wake detection does not depend only on legacy user-role attributes', () => {
  const start = source.indexOf('async function visibleWakePresent');
  const end = source.indexOf('\nasync function waitForFreshChatRoute', start);
  const block = source.slice(start, end);

  assert.match(block, /data-message-author-role="user"/);
  assert.match(block, /page\.locator\('body'\)\.innerText/);
  assert.match(block, /composerHasMessage/);
  assert.match(block, /bodyHasMessage && !composerHasMessage/);
  assert.match(block, /rendered-page-text/);
});

test('send path uses visible pointer and keyboard primitives only', () => {
  const postStart = source.indexOf('async function post(page, message, composerOverride = null)');
  const postEnd = source.indexOf('\nfunction visibleBrowserStateText', postStart);
  const block = source.slice(postStart, postEnd);

  assert.ok(postStart >= 0 && postEnd > postStart);
  assert.match(block, /fillComposer\(page, message, composerOverride\)/);
  assert.match(block, /findSendControlNearComposer\(page, composer\)/);
  assert.match(block, /humanPointerClick\(page, send/);
  assert.doesNotMatch(block, /\.click\s*\(/);
  assert.doesNotMatch(block, /\.fill\s*\(/);
  assert.doesNotMatch(block, /page\.on\(/);
  assert.doesNotMatch(block, /evaluate\s*\(/);
});


test('recover action reopens the already-posted Project chat through visible UI without resending', () => {
  assert.match(source, /async function recoverCreatedChatFromProjectPage/);
  assert.match(source, /requestedProjectUrl\s*\?\s*await openSavedProjectUrl\(page, projectName, requestedProjectUrl\)/);
  assert.match(source, /:\s*await recoverExistingProjectExactHumanFlow\(page, projectName\)/);
  assert.match(source, /projectMain\.getByText\(titlePattern, \{ exact: true \}\)/);
  assert.match(source, /humanPointerClick\(page, chatControl\)/);
  assert.match(source, /await waitForDurableChatRoute\(page, 300000\)/);
  assert.match(source, /await visibleWakePresent\(page, message, 30000\)/);
  assert.match(source, /recovered-project-chat/);

  const runStart = source.indexOf('async function runWithPage');
  const runBlock = source.slice(runStart);
  const recoverBranch = runBlock.indexOf("if (action === 'recover')");
  const sendCall = runBlock.indexOf('const verifiedSend = await postWithVisibleVerification');
  assert.ok(recoverBranch >= 0);
  assert.ok(sendCall > recoverBranch);
  const between = runBlock.slice(recoverBranch, sendCall);
  assert.match(between, /return result/);
  assert.doesNotMatch(between, /postWithVisibleVerification|await post\(/);
});

test('recover action remains visible-browser-only', () => {
  const start = source.indexOf('async function recoverCreatedChatFromProjectPage');
  const end = source.indexOf('\nasync function postWithVisibleVerification', start);
  const block = source.slice(start, end);
  assert.doesNotMatch(block, /fetch\s*\(/);
  assert.doesNotMatch(block, /page\.on\(/);
  assert.doesNotMatch(block, /\.fill\s*\(/);
  assert.doesNotMatch(block, /force:\s*true/);
  assert.doesNotMatch(block, /requestSubmit|form\.submit/);
});


test('v10 always starts from immutable bootstrap secret and discards run state', () => {
  assert.match(source, /CHATGPT_STORAGE_STATE_B64 is required/);
  assert.match(source, /Using immutable bootstrap-secret session state; run state will be discarded/);
  assert.doesNotMatch(source, /loadEncryptedSessionState|saveEncryptedSessionState|persistHealthySession/);
  assert.doesNotMatch(source, /CHATGPT_SESSION_STATE_/);
});

test('v10 project_wake opens or scrolls the sidebar to Projects before hover-plus creation', () => {
  assert.match(source, /async function humanScrollSidebarForProjects/);
  assert.match(source, /page\.mouse\.wheel\(0, -randomDelayMs\(500, 900\)\)/);
  assert.match(source, /page\.mouse\.wheel\(0, randomDelayMs\(350, 700\)\)/);
  assert.match(source, /async function createProjectExactHumanFlow/);
  const start = source.indexOf('async function createProjectExactHumanFlow');
  const end = source.indexOf('\nasync function fillComposer', start);
  const block = source.slice(start, end);
  const sidebar = block.indexOf('await ensureSidebarOpenForProject');
  const hover = block.indexOf('await projects.hover()');
  const plus = block.indexOf('findProjectsPlusAfterHover');
  const editor = block.indexOf('findProjectNameEditorFromVisibleCreateSurface');
  const type = block.indexOf('await humanTypeInto(page, controls.editor, name)');
  const enabled = block.indexOf('findEnabledProjectCreateButton(page, 8000)');
  const create = block.indexOf('await humanPointerClick(page, enabledCreate)');
  assert.ok(sidebar >= 0 && hover > sidebar && plus > hover && editor > plus && type > editor && enabled > type && create > enabled);
  assert.doesNotMatch(block, /fetch\s*\(|page\.on\(|waitForResponse|\/backend-api\//);
});

test('v10 project creation anchors the name editor to the visible Create-project surface', () => {
  assert.match(source, /async function findVisibleProjectCreateButton/);
  assert.match(source, /getByRole\('button', \{ name: \/\^Create project\$\/i \}\)/);
  assert.match(source, /async function findProjectNameEditorFromVisibleCreateSurface/);
  assert.match(source, /region\.getByRole\('textbox'\)/);
  assert.match(source, /region\.locator\('input, textarea, \[contenteditable="true"\]'\)/);

  const start = source.indexOf('async function createProjectExactHumanFlow');
  const end = source.indexOf('\nasync function fillComposer', start);
  const block = source.slice(start, end);
  assert.match(block, /findProjectNameEditorFromVisibleCreateSurface/);
  assert.match(block, /humanTypeInto\(page, controls\.editor, name\)/);
  assert.match(block, /findEnabledProjectCreateButton\(page, 8000\)/);
  assert.match(block, /humanPointerClick\(page, enabledCreate\)/);
  assert.doesNotMatch(block, /\[role="dialog"\] input/);
  assert.doesNotMatch(block, /\.fill\s*\(|\.evaluate\s*\(|force:\s*true/);
});

test('v10 project creation waits briefly for automatic Project URL navigation and saves that URL', () => {
  const createStart = source.indexOf('async function createProjectExactHumanFlow');
  const createEnd = source.indexOf('\nasync function fillComposer', createStart);
  const createBlock = source.slice(createStart, createEnd);

  assert.match(createBlock, /const beforeCreateUrl = page\.url\(\)/);
  assert.match(createBlock, /humanPointerClick\(page, enabledCreate\)/);
  assert.match(createBlock, /randomDelayMs\(3000, 5000\)/);
  assert.match(createBlock, /projectUrl = page\.url\(\)/);
  assert.match(createBlock, /Create project did not navigate to a new Project URL after a short visible wait/);
  assert.match(createBlock, /const composer = await ensureComposer\(page\)/);
  assert.match(createBlock, /return \{ projectName: name, url: projectUrl, composer \}/);
  assert.doesNotMatch(createBlock, /Date\.now\(\) \+ 60000/);
});

test('v10 project retry recovers an existing exact-name Project and captures its navigated URL', () => {
  assert.match(source, /async function findVisibleExactProjectEntry/);
  assert.match(source, /async function recoverExistingProjectExactHumanFlow/);
  assert.match(source, /const namePattern = new RegExp/);
  assert.match(source, /page\.getByText\(namePattern, \{ exact: true \}\)/);
  assert.match(source, /box\.x <= 460/);
  assert.match(source, /project-title-target=/);
  assert.match(source, /const beforeUrl = page\.url\(\)/);
  assert.match(source, /await humanTapVisibleTitle\(page, existing, 0\.32\)/);
  assert.match(source, /await humanTapVisibleTitle\(page, existing, 0\.68\)/);
  assert.match(source, /projectUrl = page\.url\(\)/);
  assert.match(source, /return \{ projectName: name, url: projectUrl, composer, recoveredExisting: true \}/);

  const start = source.indexOf('async function createProjectExactHumanFlow');
  const end = source.indexOf('\nasync function fillComposer', start);
  const block = source.slice(start, end);
  const recover = block.indexOf('recoverExistingProjectExactHumanFlow');
  const plus = block.indexOf('findProjectsPlusAfterHover');
  assert.ok(recover >= 0 && plus > recover);
  assert.match(block, /if \(recovered\) return recovered/);
});

test('v10 randomized pacing uses 0.3-1.5s between actions and 0.2-0.4s per character', () => {
  assert.match(source, /randomDelayMs\(300, 1500\)/);
  assert.match(source, /randomDelayMs\(200, 400\)/);
  assert.match(source, /for \(const char of String\(text\)\)/);
  assert.match(source, /await locator\.pressSequentially\(char\)/);
});

test('v10 Create-project modal has visible-label fallbacks and a short render wait', () => {
  assert.match(source, /page\.getByText\(\/\^Create project\$\/i, \{ exact: true \}\)/);
  assert.match(source, /page\.getByLabel\(\/\^Project name\$\/i\)\.first\(\)/);
  const start = source.indexOf('async function createProjectExactHumanFlow');
  const end = source.indexOf('\nasync function fillComposer', start);
  const block = source.slice(start, end);
  assert.match(block, /randomDelayMs\(2500, 4500\)/);
});

test('v10 waits for the visible Create project button to become enabled after typing', () => {
  assert.match(source, /async function findEnabledProjectCreateButton/);
  assert.match(source, /button\.isEnabled\(\)/);
  assert.match(source, /ancestor-or-self::button\[1\]/);

  const start = source.indexOf('async function createProjectExactHumanFlow');
  const end = source.indexOf('\nasync function fillComposer', start);
  const block = source.slice(start, end);
  const type = block.indexOf('await humanTypeInto(page, controls.editor, name)');
  const enabled = block.indexOf('findEnabledProjectCreateButton(page, 8000)');
  const click = block.indexOf('humanPointerClick(page, enabledCreate)');
  assert.ok(type >= 0 && enabled > type && click > enabled);
  assert.match(block, /randomDelayMs\(1200, 2500\)/);
  assert.match(block, /Create project control did not become visibly enabled after typing the Project name/);
});

test('v10 recognizes both root and Project-scoped durable ChatGPT conversation routes', () => {
  const start = source.indexOf('function chatRouteInfo');
  const end = source.indexOf('\nasync function visibleWakePresent', start);
  const block = source.slice(start, end);
  assert.match(block, /\^\\\/c\\\/\(\[\^\/\]\+\)/);
  assert.match(block, /\^\\\/g\\\/\(g-p-\[\^\/\]\+\)\\\/c\\\/\(\[\^\/\]\+\)/);
  assert.match(block, /projectScoped: Boolean\(projectMatch\)/);
  assert.match(block, /projectId/);
});

test('v10 visible recovery requires the opened chat to resolve to a Project-scoped conversation route', () => {
  const start = source.indexOf('async function recoverCreatedChatFromProjectPage');
  const end = source.indexOf('\nasync function postWithVisibleVerification', start);
  const block = source.slice(start, end);
  assert.match(block, /if \(!route\.projectScoped\)/);
  assert.match(block, /Recovered Project chat did not open a Project-scoped durable conversation route/);
});

test('v10 resume_existing accepts durable Project-scoped conversations through route parsing', () => {
  const start = source.indexOf('async function runWithPage');
  const block = source.slice(start);
  assert.match(block, /const requestedRoute = chatRouteInfo\(requestedUrl\)/);
  assert.match(block, /!requestedRoute\.isChat \|\| requestedRoute\.isLocal/);
  assert.match(block, /root or Project-scoped ChatGPT conversation URL/);
  assert.doesNotMatch(block, /resume_existing requires a chatgpt\.com\/c\/\.\.\. URL/);
});

test('v10 reuses a persisted Project URL before sidebar recovery or duplicate creation', () => {
  assert.match(source, /const requestedProjectUrl = env\.PROJECT_URL \|\| ''/);
  assert.match(source, /function validSavedProjectUrl/);
  assert.match(source, /async function openSavedProjectUrl/);
  assert.match(source, /project-reused-saved-url/);
  assert.match(source, /reusedSavedUrl: true/);

  const start = source.indexOf('async function createProjectExactHumanFlow');
  const end = source.indexOf('\nasync function fillComposer', start);
  const block = source.slice(start, end);
  const saved = block.indexOf('openSavedProjectUrl(page, name, requestedProjectUrl)');
  const recover = block.indexOf('recoverExistingProjectExactHumanFlow(page, name)');
  const create = block.indexOf('findProjectsPlusAfterHover');
  assert.ok(saved >= 0 && recover > saved && create > recover);
  assert.match(block, /if \(saved\) return saved/);

  assert.match(workflow, /project_url:/);
  assert.doesNotMatch(workflow, /project_id:/);
  assert.match(workflow, /INPUT_PROJECT_URL: \$\{\{ inputs\.project_url \}\}/);
  assert.match(workflow, /PROJECT_URL: \$\{\{ steps\.request\.outputs\.project_url \}\}/);

  assert.equal(request.project_url, '');
  assert.equal(request.project_id, undefined);
  assert.equal(request.recovery_chat_title, 'VERIFY PROJECT WAKE SIGNAL');
});

test('v10 saved Project reuse accepts canonical Project root while rejecting chat routes by shape', () => {
  assert.match(source, /function savedProjectIdentity/);
  assert.ok(source.includes('url.pathname.match(/^\\/g\\/(g-p-[A-Za-z0-9]+)(?:-[^/]+)?(?:\\/project)?\\/?$/)'));
  assert.match(source, /const expectedProjectIdentity = savedProjectIdentity\(projectUrl\)/);
  assert.match(source, /const currentProjectIdentity = savedProjectIdentity\(currentProjectUrl\)/);
  assert.match(source, /currentProjectIdentity !== expectedProjectIdentity/);
  assert.match(source, /observedUrl=/);
});

test('recover opens the Project first, then uses only the visible Project chat list', () => {
  const start = source.indexOf('async function recoverCreatedChatFromProjectPage');
  const end = source.indexOf('\nasync function postWithVisibleVerification', start);
  const block = source.slice(start, end);

  const openSaved = block.indexOf('openSavedProjectUrl(page, projectName, requestedProjectUrl)');
  const openByName = block.indexOf('recoverExistingProjectExactHumanFlow(page, projectName)');
  const projectMain = block.indexOf("page.locator('main, [role=\"main\"]').first()");
  const title = block.indexOf('projectMain.getByText(titlePattern, { exact: true })');
  const click = block.indexOf('humanPointerClick(page, chatControl)');
  assert.ok(openSaved >= 0 && openByName > openSaved && projectMain > openByName && title > projectMain && click > title);
  assert.match(block, /recoveryChatTitle/);
  assert.match(block, /ancestor-or-self::a\[1\]/);
  assert.match(block, /ancestor-or-self::button\[1\]/);
  assert.doesNotMatch(block, /Search chats|Control\+K|humanTypeInto\(page, searchInput/);
});

test('visible Project-name recovery clicks the exact rendered Project title text directly', () => {
  const start = source.indexOf('async function findVisibleExactProjectEntry');
  const end = source.indexOf('\nasync function recoverExistingProjectExactHumanFlow', start);
  const block = source.slice(start, end);
  const text = block.indexOf('page.getByText(namePattern, { exact: true })');
  const target = block.indexOf("strategy: 'exact-visible-title-text'");
  assert.ok(text >= 0 && target > text);
  assert.doesNotMatch(block, /page\.getByRole\('link'|page\.getByRole\('button'/);
  assert.doesNotMatch(block, /locator\('xpath=\.\.'\)/);
  assert.match(block, /box\.x <= 460/);
  assert.match(block, /box\.y >= projectsBox\.y/);
  assert.match(block, /box\.y <= projectsBox\.y \+ 420/);
  assert.match(block, /return candidate/);
});

test('existing Project recovery uses short direct human taps on the visible title and retries once', () => {
  assert.match(source, /async function humanTapVisibleTitle/);
  assert.match(source, /randomDelayMs\(70, 150\)/);
  assert.match(source, /project-title-tap=/);

  const start = source.indexOf('async function recoverExistingProjectExactHumanFlow');
  const end = source.indexOf('\nasync function findSendControlNearComposer', start);
  const block = source.slice(start, end);
  const first = block.indexOf('humanTapVisibleTitle(page, existing, 0.32)');
  const second = block.indexOf('humanTapVisibleTitle(page, existing, 0.68)');
  assert.ok(first >= 0 && second > first);
  assert.match(block, /Existing exact-name Project title did not navigate after two direct human title taps/);
  assert.doesNotMatch(block, /humanPointerClick\(page, existing\)/);
});
