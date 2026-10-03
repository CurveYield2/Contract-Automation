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
  assert.doesNotMatch(source, /evaluate\s*\(\s*el\s*=>\s*el\.click/);
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
  const postStart = source.indexOf('async function post(page, message)');
  const postEnd = source.indexOf('\nfunction visibleBrowserStateText', postStart);
  const block = source.slice(postStart, postEnd);

  assert.match(block, /fillComposer\(page, message\)/);
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
