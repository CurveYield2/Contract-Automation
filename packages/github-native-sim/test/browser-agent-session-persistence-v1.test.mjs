import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  deriveSessionStateKeyB64,
  loadEncryptedSessionState,
  saveEncryptedSessionState,
} from '../../../scripts/browser-session-state-v1.mjs';
import { classifyV7QualificationChanges } from '../../../scripts/classify-v7-qualification-change.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');

async function withTempFile(fn) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'browser-session-state-'));
  try {
    await fn(path.join(dir, 'session-state-v1.enc.json'));
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

test('encrypted ChatGPT session state round-trips without plaintext browser state', async () => {
  await withTempFile(async (encryptedSessionPath) => {
    const keyB64 = crypto.randomBytes(32).toString('base64');
    const storage = {
      cookies: [{ name: 'session-cookie', value: 'sensitive-cookie-value', domain: '.chatgpt.com', path: '/' }],
      origins: [{ origin: 'https://chatgpt.com', localStorage: [{ name: 'session', value: 'sensitive-local-state' }] }],
    };

    assert.equal(await saveEncryptedSessionState({ encryptedSessionPath, keyB64, storage }), true);
    const ciphertext = await fs.readFile(encryptedSessionPath, 'utf8');
    assert.doesNotMatch(ciphertext, /sensitive-cookie-value/);
    assert.doesNotMatch(ciphertext, /sensitive-local-state/);

    const restored = await loadEncryptedSessionState({ encryptedSessionPath, keyB64 });
    assert.deepEqual(restored, storage);
  });
});

test('session cache can derive a stable 32-byte encryption key from the existing bootstrap state', () => {
  const bootstrapStateB64 = Buffer.from(JSON.stringify({ cookies: [{ value: 'high-entropy-session-token' }], origins: [] })).toString('base64');
  const derivedA = deriveSessionStateKeyB64({ bootstrapStateB64 });
  const derivedB = deriveSessionStateKeyB64({ bootstrapStateB64 });
  assert.equal(derivedA, derivedB);
  assert.equal(Buffer.from(derivedA, 'base64').length, 32);
  assert.notEqual(derivedA, bootstrapStateB64);
});

test('an explicit session-cache key overrides bootstrap-derived keying', () => {
  const explicit = crypto.randomBytes(32).toString('base64');
  assert.equal(
    deriveSessionStateKeyB64({ keyB64: explicit, bootstrapStateB64: 'bootstrap-value' }),
    explicit
  );
});

test('tampered encrypted ChatGPT session state fails authenticated decryption and is ignored', async () => {
  await withTempFile(async (encryptedSessionPath) => {
    const keyB64 = crypto.randomBytes(32).toString('base64');
    const storage = { cookies: [], origins: [] };
    await saveEncryptedSessionState({ encryptedSessionPath, keyB64, storage });

    const envelope = JSON.parse(await fs.readFile(encryptedSessionPath, 'utf8'));
    const bytes = Buffer.from(envelope.ciphertext, 'base64');
    bytes[0] ^= 0x01;
    envelope.ciphertext = bytes.toString('base64');
    await fs.writeFile(encryptedSessionPath, JSON.stringify(envelope));

    const warnings = [];
    const restored = await loadEncryptedSessionState({
      encryptedSessionPath,
      keyB64,
      logger: { warn: (message) => warnings.push(message) },
    });
    assert.equal(restored, null);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /authenticated decryption/);
  });
});

test('session-state encryption requires an exact 32-byte key', async () => {
  await withTempFile(async (encryptedSessionPath) => {
    await assert.rejects(
      saveEncryptedSessionState({
        encryptedSessionPath,
        keyB64: Buffer.alloc(16).toString('base64'),
        storage: { cookies: [], origins: [] },
      }),
      /exactly 32 bytes/
    );
  });
});


test('invalid rolling-cache key cannot suppress the bootstrap fallback path', async () => {
  await withTempFile(async (encryptedSessionPath) => {
    const warnings = [];
    const restored = await loadEncryptedSessionState({
      encryptedSessionPath,
      keyB64: Buffer.alloc(16).toString('base64'),
      logger: { warn: (message) => warnings.push(message) },
    });
    assert.equal(restored, null);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /falling back to bootstrap state/);
  });
});

test('wake and watchdog restore rolling encrypted state and save only refreshed generations', async () => {
  for (const relative of [
    '.github/workflows/browser-agent-wake.yml',
    '.github/workflows/browser-agent-watchdog.yml',
  ]) {
    const workflow = await fs.readFile(path.join(root, relative), 'utf8');
    assert.match(workflow, /CHATGPT_SESSION_STATE_KEY_B64/);
    assert.match(workflow, /actions\/cache\/restore@v4/);
    assert.match(workflow, /actions\/cache\/save@v4/);
    assert.match(workflow, /chatgpt-session-state-v1-/);
    assert.match(workflow, /restore-keys:[\s\S]*chatgpt-session-state-v1-/);
    assert.match(workflow, /path: \/tmp\/curveyield-browser-agent\/session-state-v1\.enc\.json/);
    assert.match(workflow, /session-state-updated/);
    assert.match(workflow, /outputs\.updated == 'true'/);
    assert.doesNotMatch(workflow, /CHATGPT_SESSION_STATE_(?:PATH|UPDATED_MARKER):\s*\$\{\{\s*runner\./);
  }
});

test('GitHub Playwright prefers encrypted rolling state, keeps bootstrap fallback, and persists only healthy authenticated state', async () => {
  const source = await fs.readFile(path.join(root, 'scripts/browser-agent-wake.mjs'), 'utf8');
  const localStart = source.indexOf('async function localProvider');
  const localEnd = source.indexOf('const { chromium } = await loadModules();');
  assert.ok(localStart >= 0 && localEnd > localStart);
  const localSource = source.slice(localStart, localEnd);
  const cacheLoad = localSource.indexOf('loadEncryptedSessionState({');
  const bootstrapLoad = localSource.indexOf('CHATGPT_STORAGE_STATE_B64');
  assert.ok(cacheLoad >= 0);
  assert.ok(bootstrapLoad > cacheLoad);
  assert.match(source, /providerName !== 'github-playwright'/);
  assert.match(source, /state\?\.composerVisible/);
  assert.match(source, /chatgpt\\\.com/);
  assert.match(source, /saveEncryptedSessionState\(/);
  assert.match(source, /deriveSessionStateKeyB64\(\{/);
  assert.match(source, /const sessionStateKeyB64 = deriveSessionStateKeyB64\(\{\s*keyB64:\s*env\.CHATGPT_SESSION_STATE_KEY_B64,\s*bootstrapStateB64:\s*env\.CHATGPT_STORAGE_STATE_B64,\s*\}\);/);
  assert.match(source, /context\.storageState\(\{ indexedDB: true, opfs: true \}\)/);
  assert.match(source, /CHATGPT_SESSION_STATE_UPDATED_MARKER/);
});


test('browser session persistence changes remain in the control-light qualification lane', () => {
  const result = classifyV7QualificationChanges([
    '.github/workflows/browser-agent-wake.yml',
    '.github/workflows/browser-agent-watchdog.yml',
    'scripts/browser-agent-wake.mjs',
    'scripts/browser-session-state-v1.mjs',
    'packages/github-native-sim/test/browser-agent-session-persistence-v1.test.mjs',
    'process/browser-agent-wake/README.md',
  ]);
  assert.equal(result.lane, 'CONTROL_LIGHT');
});

test('operator-selected saved login state bypasses rolling cache in wake and watchdog', async () => {
  const runtime = await fs.readFile(path.join(root, 'scripts/browser-agent-wake.mjs'), 'utf8');
  assert.match(runtime, /env\.CHATGPT_SESSION_STATE_SOURCE === 'bootstrap-secret' \? null : await loadEncryptedSessionState/);
  for (const relative of ['.github/workflows/browser-agent-wake.yml', '.github/workflows/browser-agent-watchdog.yml']) {
    const workflow = await fs.readFile(path.join(root, relative), 'utf8');
    assert.match(workflow, /CHATGPT_SESSION_STATE_SOURCE: bootstrap-secret/);
    assert.match(workflow, /CHATGPT_STORAGE_STATE_B64: \$\{\{ secrets\.CHATGPT_STORAGE_STATE_B64 \}\}/);
  }
});
