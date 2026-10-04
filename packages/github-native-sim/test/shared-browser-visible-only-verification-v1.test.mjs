import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import { spawnSync } from 'node:child_process';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const source = fs.readFileSync(path.join(root, 'scripts/browser-agent-wake.mjs'), 'utf8');

const fixedStart = source.indexOf('async function runNormalChromeExistingSession');
const fixedEnd = source.indexOf('\nasync function humanPointerClick', fixedStart);
assert.ok(fixedStart >= 0 && fixedEnd > fixedStart);
const fixedAuditWake = source.slice(fixedStart, fixedEnd);
const fixedWakeStart = fixedAuditWake.indexOf("if (action !== 'wake')");
const executedFixedWake = fixedAuditWake.slice(fixedWakeStart);
const cdpStart = source.indexOf('async function waitForCdp');
const cdpEnd = source.indexOf('\nasync function runNormalChromeExistingSession', cdpStart);
const cdpBootstrap = source.slice(cdpStart, cdpEnd);

test('executed audit wake path forbids ChatGPT API and DOM verification reads', () => {
  assert.doesNotMatch(source, /\/backend-api\//);
  assert.match(cdpBootstrap, /fetch\('http:\/\/127\.0\.0\.1:' \+ port \+ '\/json\/version'\)/);
  assert.equal([...cdpBootstrap.matchAll(/\bfetch\s*\(/g)].length, 1);
  assert.doesNotMatch(cdpBootstrap, /chatgpt\.com|backend-api/);
  assert.doesNotMatch(executedFixedWake, /page\.evaluate|page\.locator|innerText|inputValue|page\.on\(['"](?:request|response)['"]/);
  assert.match(source, /mode === 'resume_existing' && action === 'wake'[\s\S]*runNormalChromeExistingSession\(chromium\)/);
  assert.match(source, /CHATGPT_PAGE_READS_DISABLED/);
});

test('executed audit wake path has no synthetic ChatGPT write fallback', () => {
  assert.doesNotMatch(fixedAuditWake, /navigator\.clipboard|clipboard-(?:read|write)|evaluate\s*\([^)]*=>[^)]*\.click|requestSubmit|form\.submit|\.fill\s*\(/);
  assert.match(fixedAuditWake, /fs\.rm\(profileDir, \{ recursive: true, force: true \}\)/);
  assert.equal([...fixedAuditWake.matchAll(/force:\s*true/g)].length, 1);
  assert.match(fixedAuditWake, /x11Key\(\['click', '1'\]/);
  assert.match(fixedAuditWake, /x11Key\(\['key', '--clearmodifiers', 'Return'\]/);
});

test('executed audit wake verifies only the fixed X11 input sequence', () => {
  assert.match(source, /async function humanX11TypeText/);
  assert.match(source, /for \(const char of value\)/);
  assert.match(fixedAuditWake, /humanX11TypeText\(page, wakeMessage\)/);
  assert.match(fixedAuditWake, /wake-entry=OS-X11-skilled-typist/);
  assert.match(fixedAuditWake, /verification: 'phase1-fixed-x11-submit-no-chatgpt-page-read'/);
  assert.match(fixedAuditWake, /verificationMethod: 'x11-human-input-only'/);
  assert.doesNotMatch(fixedAuditWake, /postWithVisibleVerification|wakeMarkerVisible|composerDiagnostics/);
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
  assert.ok(source.includes('/\\/c\\//.test(parsed.pathname)'));
});

test('unverified Maximum master and Sol repair transports fail closed before browser access', () => {
  const cases = [
    { name: 'Maximum master', effort: 'maximum', model: 'MASTER', mode: 'resume_existing', code: 'MAXIMUM_UI_VERIFICATION_UNAVAILABLE' },
    { name: 'Sol repair child', effort: 'high', model: 'SOL', mode: 'create_fresh', code: 'SOL_UI_VERIFICATION_UNAVAILABLE' },
  ];
  for (const item of cases) {
    const work = fs.mkdtempSync(path.join(os.tmpdir(), 'browser-policy-'));
    const resultPath = path.join(work, 'result.json');
    const run = spawnSync(process.execPath, [path.join(root, 'scripts/browser-agent-wake.mjs')], {
      cwd: root, encoding: 'utf8',
      env: { ...process.env, CHATGPT_THINKING_EFFORT: item.effort, CHATGPT_REQUESTED_MODEL: item.model, WAKE_MODE: item.mode, WAKE_ID: 'policy-test', WAKE_RESULT_PATH: resultPath },
    });
    assert.notEqual(run.status, 0, item.name);
    const result = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
    assert.equal(result.ok, false, item.name);
    assert.equal(result.failures?.[0]?.code, item.code, item.name);
    assert.equal(result.failures?.[0]?.retryable, false, item.name);
    fs.rmSync(work, { recursive: true, force: true });
  }
});
