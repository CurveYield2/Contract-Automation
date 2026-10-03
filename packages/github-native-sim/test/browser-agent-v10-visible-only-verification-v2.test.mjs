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


test('recover action reopens the already-posted chat through visible UI without resending', () => {
  assert.match(source, /async function recoverCreatedChatByVisibleSearch/);
  assert.match(source, /Filter chats and work/);
  assert.match(source, /humanPointerClick\(page, filter/);
  assert.match(source, /humanTypeInto\(page, searchInput, marker/);
  assert.match(source, /humanPointerClick\(page, candidate/);
  assert.match(source, /await waitForDurableChatRoute\(page, 300000\)/);
  assert.match(source, /await visibleWakePresent\(page, message, 30000\)/);
  assert.match(source, /recovered-created-chat/);

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
  const start = source.indexOf('async function recoverCreatedChatByVisibleSearch');
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
  const create = block.indexOf('await humanPointerClick(page, controls.create)');
  assert.ok(sidebar >= 0 && hover > sidebar && plus > hover && editor > plus && type > editor && create > type);
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
  assert.match(block, /humanPointerClick\(page, controls\.create\)/);
  assert.doesNotMatch(block, /\[role="dialog"\] input/);
  assert.doesNotMatch(block, /\.fill\s*\(|\.evaluate\s*\(|force:\s*true/);
});

test('v10 project wake uses the exact visible Project-specific new-chat cue instead of the homepage composer', () => {
  assert.match(source, /async function findProjectLandingComposer/);
  assert.match(source, /const cue = 'New chat in ' \+ name/);
  assert.match(source, /page\.getByPlaceholder\(cuePattern\)/);
  assert.match(source, /page\.getByText\(cuePattern, \{ exact: true \}\)/);
  assert.match(source, /region\.getByRole\('textbox'\)/);
  assert.match(source, /async function findSendControlNearComposer/);
  assert.match(source, /postWithVisibleVerification\(page, wakeMessage, project\?\.composer \|\| null\)/);

  const createStart = source.indexOf('async function createProjectExactHumanFlow');
  const createEnd = source.indexOf('\nasync function fillComposer', createStart);
  const createBlock = source.slice(createStart, createEnd);
  assert.match(createBlock, /visible "New chat in ' \+ name \+ '" Project-specific composer/);
  assert.doesNotMatch(createBlock, /const main = page\.locator/);
  assert.doesNotMatch(createBlock, /ensureComposer\(/);
});

test('v10 project retry recovers an existing exact-name Project before creating a duplicate', () => {
  assert.match(source, /async function findVisibleExactProjectEntry/);
  assert.match(source, /async function recoverExistingProjectExactHumanFlow/);
  assert.match(source, /const matches = page\.getByText\(name, \{ exact: true \}\)/);
  assert.match(source, /const inLeftSidebar = box\.x <= 460/);
  assert.match(source, /await humanPointerClick\(page, existing\)/);
  assert.match(source, /project-recovered-visible/);

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
