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
  assert.match(source, /async function waitForFreshChatUrl/);
  assert.match(source, /async function humanReload/);
  assert.match(source, /Control\+R/);
  assert.match(source, /visible-wake-before-reload/);
  assert.match(source, /visible-wake-after-reload/);
  assert.match(source, /verification: 'visible-browser-only'/);
});

test('create_fresh captures durable chat URL before persistence reload', () => {
  const verifyStart = source.indexOf('async function postWithVisibleVerification');
  const verifyEnd = source.indexOf('\nasync function runWithPage', verifyStart);
  const block = source.slice(verifyStart, verifyEnd);

  const waitUrl = block.indexOf('chatUrl = await waitForFreshChatUrl');
  const beforeReload = block.indexOf('visible-wake-before-reload');
  const reload = block.indexOf('await humanReload(page)');
  const afterReload = block.indexOf('visible-wake-after-reload');

  assert.ok(waitUrl >= 0);
  assert.ok(beforeReload > waitUrl);
  assert.ok(reload > beforeReload);
  assert.ok(afterReload > reload);
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
