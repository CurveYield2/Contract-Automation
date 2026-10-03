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
  assert.match(source, /pressSequentially\(String\(message\), \{ delay: 12 \}\)/);
  assert.match(source, /send-strategy=human-pointer-click/);
  assert.match(source, /send-strategy=human-keyboard-enter/);
  assert.match(source, /verification-reload=human-keyboard-control-r/);
  assert.match(source, /visible-wake-before-reload/);
  assert.match(source, /visible-wake-after-reload/);
  assert.match(source, /verification: 'visible-browser-only'/);
});
