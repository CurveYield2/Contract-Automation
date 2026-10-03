import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const source = fs.readFileSync(path.join(root, 'scripts/browser-agent-wake.mjs'), 'utf8');

test('shared ChatGPT runtime contains no externally detectable machine verification reads', () => {
  assert.doesNotMatch(source, /\/backend-api\//);
  assert.doesNotMatch(source, /\bfetch\s*\(/);
  assert.doesNotMatch(source, /page\.on\(['"]request['"]/);
  assert.doesNotMatch(source, /page\.on\(['"]response['"]/);
});

test('shared ChatGPT runtime contains no synthetic write fallbacks', () => {
  assert.doesNotMatch(source, /navigator\.clipboard/);
  assert.doesNotMatch(source, /clipboard-(?:read|write)/);
  assert.doesNotMatch(source, /force:\s*true/);
  assert.doesNotMatch(source, /evaluate\s*\([^)]*=>[^)]*\.click/);
  assert.doesNotMatch(source, /requestSubmit/);
  assert.doesNotMatch(source, /form\.submit/);
  assert.doesNotMatch(source, /\.fill\s*\(/);
});

test('shared ChatGPT runtime verifies through visible human browser behavior', () => {
  assert.match(source, /async function waitForVisibleBrowserReady/);
  assert.match(source, /async function postWithVisibleVerification/);
  assert.match(source, /for \(const char of String\(message\)\)/);
  assert.match(source, /humanTypingPause\(page\)/);
  assert.match(source, /randomDelayMs\(300, 1500\)/);
  assert.match(source, /randomDelayMs\(200, 400\)/);
  assert.match(source, /send-strategy=human-pointer-click/);
  assert.match(source, /send-strategy=human-keyboard-enter/);
  assert.match(source, /verification-reload=human-keyboard-control-r/);
  assert.match(source, /visible-wake-before-reload/);
  assert.match(source, /visible-wake-after-reload/);
  assert.match(source, /verification: 'visible-browser-only'/);
});


test('shared ChatGPT runtime always starts from immutable bootstrap secret and never persists run state', () => {
  assert.match(source, /CHATGPT_STORAGE_STATE_B64 is required/);
  assert.match(source, /Using immutable bootstrap-secret session state; run state will be discarded/);
  assert.doesNotMatch(source, /loadEncryptedSessionState|saveEncryptedSessionState|persistHealthySession/);
  assert.doesNotMatch(source, /CHATGPT_SESSION_STATE_/);
});

test('shared ChatGPT runtime accepts durable root and Project-scoped chat URLs', () => {
  assert.match(source, /const root = url\.pathname\.match\(\/\^\\\/c\\\/\(\[\^\/\]\+\)/);
  assert.match(source, /const project = url\.pathname\.match\(\/\^\\\/g\\\/g-p-\[\^\/\]\+\\\/c\\\/\(\[\^\/\]\+\)/);
  assert.match(source, /if \(!durableChatUrl\(requestedUrl\)\)/);
  assert.match(source, /root or Project-scoped ChatGPT conversation URL/);
  assert.match(source, /\/\\\/c\\\/\.test\(parsed\.pathname\)/);
});
