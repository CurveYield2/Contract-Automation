#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { validateStorageState } from '../browser-agent-original-phase0-v10/browser-session-state-v1.mjs';

const env = process.env;
const statePath = env.MANUAL_RESULT_PATH || '/tmp/browser-agent-home-exit-v11-result.json';
const wakeId = env.WAKE_ID || 'manual-browser-v11';
const sessionMinutesRaw = Number.parseInt(env.MANUAL_SESSION_MINUTES || '25', 10);
const sessionMinutes = Number.isFinite(sessionMinutesRaw)
  ? Math.max(1, Math.min(30, sessionMinutesRaw))
  : 25;

function loadRuntimeModule(specifier) {
  const runtimeRoot = env.BROWSER_AGENT_RUNTIME_ROOT || '';
  const runtimeRequire = createRequire(path.join(runtimeRoot, 'package.json'));
  const resolved = runtimeRequire.resolve(specifier);
  return import(pathToFileURL(resolved).href);
}

function unwrapRuntimeModule(mod) {
  if (!mod) return {};
  const first = mod.default && typeof mod.default === 'object' ? mod.default : mod;
  const second = first.default && typeof first.default === 'object' ? first.default : first;
  return { ...mod, ...first, ...second };
}

if (!env.CHATGPT_STORAGE_STATE_B64) {
  throw new Error('CHATGPT_STORAGE_STATE_B64 is required');
}

let storage;
try {
  storage = JSON.parse(Buffer.from(env.CHATGPT_STORAGE_STATE_B64, 'base64').toString('utf8'));
  if (!validateStorageState(storage)) throw new Error('invalid storage state');
} catch {
  throw new Error('CHATGPT_STORAGE_STATE_B64 is invalid');
}

const playwrightMod = await loadRuntimeModule('playwright-core');
const playwright = unwrapRuntimeModule(playwrightMod);
const chromium = playwright.chromium;
if (!chromium || typeof chromium.launch !== 'function') {
  throw new Error('playwright-core chromium launcher unavailable');
}

console.log('[browser-manual-v11] Launching authenticated headed Chrome in manual-only mode.');
console.log('[browser-manual-v11] NO ChatGPT DOM reads, locators, title/url reads, automated clicks, automated typing, or automated ChatGPT navigation are performed.');
console.log('[browser-manual-v11] Use only the private VNC window for all ChatGPT interaction, including navigation and any human-verification page.');

const browser = await chromium.launch({
  headless: false,
  channel: 'chrome',
  args: ['--disable-quic']
});

try {
  const context = await browser.newContext({ storageState: storage });
  await context.newPage();

  const started = {
    ok: true,
    version: 11,
    mode: 'manual-only',
    wakeId,
    manualSessionMinutes: sessionMinutes,
    chatgptAutomation: 'disabled',
    instructions: 'Use the private VNC window for all ChatGPT navigation and interaction.'
  };
  await fs.writeFile(statePath, JSON.stringify(started, null, 2) + '\n');

  console.log('[browser-manual-v11] Manual VNC control window is active for ' + sessionMinutes + ' minute(s).');
  console.log('[browser-manual-v11] The browser will remain untouched by automation for the entire manual session.');
  await new Promise(resolve => setTimeout(resolve, sessionMinutes * 60_000));
} finally {
  await browser.close().catch(() => {});
}
