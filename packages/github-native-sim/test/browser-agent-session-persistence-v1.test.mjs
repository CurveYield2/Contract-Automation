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

test('wake and watchdog always use immutable bootstrap login state with no rolling cache', async () => {
  for (const relative of [
    '.github/workflows/browser-agent-wake.yml',
    '.github/workflows/browser-agent-watchdog.yml',
  ]) {
    const workflow = await fs.readFile(path.join(root, relative), 'utf8');
    assert.match(workflow, /CHATGPT_STORAGE_STATE_B64/);
    assert.doesNotMatch(workflow, /CHATGPT_SESSION_STATE_/);
    assert.doesNotMatch(workflow, /actions\/cache\/(?:restore|save)@v4/);
    assert.doesNotMatch(workflow, /chatgpt-session-state-v1-|session-state-updated|session-state-v1\.enc\.json/);
  }
});

test('GitHub Playwright loads only the bootstrap secret and never persists automated run state', async () => {
  const source = await fs.readFile(path.join(root, 'scripts/browser-agent-wake.mjs'), 'utf8');
  const localStart = source.indexOf('async function localProvider');
  const localEnd = source.indexOf('await hydrateBrowserContextFromRegistration();');
  assert.ok(localStart >= 0 && localEnd > localStart);
  const localSource = source.slice(localStart, localEnd);
  assert.match(localSource, /CHATGPT_STORAGE_STATE_B64 is required/);
  assert.match(localSource, /Buffer\.from\(env\.CHATGPT_STORAGE_STATE_B64, 'base64'\)/);
  assert.match(localSource, /validateStorageState\(storage\)/);
  assert.match(localSource, /Using immutable bootstrap-secret session state; run state will be discarded/);
  assert.doesNotMatch(source, /loadEncryptedSessionState|saveEncryptedSessionState|deriveSessionStateKeyB64|persistHealthySession/);
  assert.doesNotMatch(source, /CHATGPT_SESSION_STATE_/);
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

test('bootstrap secret is the single browser session source across wake and watchdog', async () => {
  const runtime = await fs.readFile(path.join(root, 'scripts/browser-agent-wake.mjs'), 'utf8');
  assert.match(runtime, /CHATGPT_STORAGE_STATE_B64 is required/);
  assert.doesNotMatch(runtime, /CHATGPT_SESSION_STATE_SOURCE|loadEncryptedSessionState|saveEncryptedSessionState/);
  for (const relative of ['.github/workflows/browser-agent-wake.yml', '.github/workflows/browser-agent-watchdog.yml']) {
    const workflow = await fs.readFile(path.join(root, relative), 'utf8');
    assert.match(workflow, /CHATGPT_STORAGE_STATE_B64: \$\{\{ secrets\.CHATGPT_STORAGE_STATE_B64 \}\}/);
    assert.doesNotMatch(workflow, /CHATGPT_SESSION_STATE_|actions\/cache\/(?:restore|save)@v4/);
  }
});
