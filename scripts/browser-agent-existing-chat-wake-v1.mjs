#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import {
  deriveSessionStateKeyB64,
  loadEncryptedSessionState,
  validateStorageState,
} from './browser-session-state-v1.mjs';

const env = process.env;
const chatUrl = (env.CHAT_URL || '').trim();
const wakeMessage = env.WAKE_MESSAGE || 'GET BACK TO WORK';
const resultPath = env.WAKE_RESULT_PATH || '/tmp/existing-chat-wake-result.json';
const encryptedSessionPath =
  env.CHATGPT_SESSION_STATE_PATH || '/tmp/curveyield-browser-agent/session-state-v1.enc.json';
const sessionStateKeyB64 = deriveSessionStateKeyB64({
  keyB64: env.CHATGPT_SESSION_STATE_KEY_B64,
  bootstrapStateB64: env.CHATGPT_STORAGE_STATE_B64,
});

if (!/^https:\/\/chatgpt\.com\/c\/[A-Za-z0-9_-]+\/?$/.test(chatUrl)) {
  throw new Error('CHAT_URL must be an existing https://chatgpt.com/c/... conversation URL');
}

async function importBrowserRuntimeModule(specifier) {
  const runtimeRoot = env.BROWSER_AGENT_RUNTIME_ROOT || '';
  if (!runtimeRoot) return import(specifier);
  const runtimeRequire = createRequire(path.join(runtimeRoot, 'package.json'));
  return import(pathToFileURL(runtimeRequire.resolve(specifier)).href);
}

function unwrapRuntimeModule(mod) {
  if (!mod) return {};
  const first = mod.default && typeof mod.default === 'object' ? mod.default : mod;
  const second = first.default && typeof first.default === 'object' ? first.default : first;
  return { ...mod, ...first, ...second };
}

async function firstVisible(page, selectors) {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    try {
      if (await locator.isVisible({ timeout: 700 })) return locator;
    } catch {}
  }
  return null;
}

async function getComposer(page) {
  return firstVisible(page, [
    '#prompt-textarea',
    'textarea[placeholder*="Message"]',
    '[contenteditable="true"][data-lexical-editor="true"]',
    '[contenteditable="true"]',
  ]);
}

async function composerText(composer) {
  const tag = await composer.evaluate((el) => el.tagName.toLowerCase());
  if (tag === 'textarea' || tag === 'input') {
    return (await composer.inputValue().catch(() => '')).trim();
  }
  return (await composer.innerText().catch(() => '')).trim();
}

async function snapshot(page) {
  const stop = await firstVisible(page, [
    'button[data-testid="stop-button"]',
    'button[aria-label*="Stop"]',
    'button:has-text("Stop generating")',
  ]);
  const composer = await getComposer(page);
  const bodyText = await page.locator('body').innerText().catch(() => '');
  const title = await page.title().catch(() => '');
  return {
    generating: !!stop,
    composerVisible: !!composer,
    conversationUnavailable:
      /Unable to load conversation|Conversation not found|Chat not found|This conversation is unavailable/i.test(bodyText),
    loginPrompt: /\bLog in\b|\bSign up\b|Continue with Google|Welcome back/i.test(bodyText),
    humanChallenge:
      /Verify you are human|Checking your browser|Just a moment|Cloudflare|security challenge/i.test(bodyText) ||
      /Just a moment|Cloudflare/i.test(title),
    url: page.url(),
  };
}

async function waitForUsableChat(page, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  let state = await snapshot(page);
  while (Date.now() < deadline) {
    if (state.composerVisible && !state.humanChallenge && !state.loginPrompt && !state.conversationUnavailable) {
      return state;
    }
    if (state.loginPrompt || state.conversationUnavailable) return state;
    await page.waitForTimeout(1000);
    state = await snapshot(page);
  }
  return state;
}

function countOccurrences(text, needle) {
  if (!needle) return 0;
  let count = 0;
  let offset = 0;
  while (true) {
    const index = text.indexOf(needle, offset);
    if (index < 0) return count;
    count += 1;
    offset = index + needle.length;
  }
}

async function persistedWakeCount(page) {
  const mainText = await page.locator('main').innerText().catch(async () =>
    page.locator('body').innerText().catch(() => '')
  );
  const composer = await getComposer(page);
  const composerValue = composer ? await composerText(composer) : '';
  return countOccurrences(mainText, wakeMessage) - (composerValue.includes(wakeMessage) ? 1 : 0);
}

async function typeWake(page, composer) {
  await composer.click();
  const tag = await composer.evaluate((el) => el.tagName.toLowerCase());
  if (tag === 'textarea' || tag === 'input') {
    await composer.fill(wakeMessage);
  } else {
    await composer.press('Control+A').catch(() => {});
    await composer.press('Meta+A').catch(() => {});
    await composer.press('Backspace').catch(() => {});
    await page.keyboard.type(wakeMessage, { delay: 10 });
  }
  if ((await composerText(composer)) !== wakeMessage) {
    throw new Error('Wake text was not entered into the composer');
  }
}

async function verifyPersistedDelivery(page, beforeCount) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    await page.waitForTimeout(500);
    const composer = await getComposer(page);
    if (composer && (await composerText(composer)) !== '') continue;

    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
    const state = await waitForUsableChat(page, 60000);
    if (!state.composerVisible || state.humanChallenge || state.loginPrompt || state.conversationUnavailable) {
      throw new Error('Chat became unavailable while verifying the sent wake message');
    }
    const afterCount = await persistedWakeCount(page);
    return afterCount > beforeCount;
  }
  return false;
}

async function sendWake(page) {
  const beforeCount = await persistedWakeCount(page);
  let composer = await getComposer(page);
  if (!composer) throw new Error('Composer is not visible');
  await typeWake(page, composer);

  const sendButton = await firstVisible(page, [
    'button[data-testid="send-button"]',
    'button[aria-label="Send prompt"]',
    'button[aria-label*="Send"]',
  ]);

  if (sendButton && await sendButton.isEnabled().catch(() => true)) {
    await sendButton.click();
    if (await verifyPersistedDelivery(page, beforeCount)) return true;
  }

  composer = await getComposer(page);
  if (!composer) throw new Error('Composer disappeared before Enter fallback');
  if ((await composerText(composer)) !== wakeMessage) await typeWake(page, composer);
  await composer.press('Enter');
  if (await verifyPersistedDelivery(page, beforeCount)) return true;

  throw new Error('GET BACK TO WORK did not persist in the existing conversation');
}

const playwrightMod = unwrapRuntimeModule(await importBrowserRuntimeModule('playwright-core'));
const chromium = playwrightMod.chromium;
if (!chromium || typeof chromium.launch !== 'function') {
  throw new Error('playwright-core chromium launcher unavailable');
}

let storage = await loadEncryptedSessionState({
  encryptedSessionPath,
  keyB64: sessionStateKeyB64,
});
let storageSource = storage ? 'encrypted-cache' : '';

if (!storage && env.CHATGPT_STORAGE_STATE_B64) {
  const bootstrap = JSON.parse(Buffer.from(env.CHATGPT_STORAGE_STATE_B64, 'base64').toString('utf8'));
  if (!validateStorageState(bootstrap)) throw new Error('CHATGPT_STORAGE_STATE_B64 is invalid');
  storage = bootstrap;
  storageSource = 'bootstrap-secret';
}
if (!storage) throw new Error('No usable ChatGPT session state is available');

console.log('[existing-chat-wake-v1] Using ' + storageSource + ' session state');

const browser = await chromium.launch({
  headless: env.BROWSER_HEADLESS !== 'false',
  channel: 'chrome',
});
const context = await browser.newContext({ storageState: storage });
const page = await context.newPage();

let result;
try {
  await page.goto(chatUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  const before = await waitForUsableChat(page, 60000);

  if (before.humanChallenge) throw new Error('Browser challenge blocked the existing chat');
  if (before.loginPrompt) throw new Error('ChatGPT authentication is required');
  if (before.conversationUnavailable || !before.composerVisible) {
    throw new Error('Existing chat is not usable');
  }

  if (before.generating) {
    result = {
      ok: true,
      posted: false,
      skipped: 'PRODUCTIVE_GENERATING',
      before,
      chatUrl: page.url(),
    };
  } else {
    const posted = await sendWake(page);
    result = {
      ok: true,
      posted,
      before,
      after: await snapshot(page),
      chatUrl: page.url(),
    };
  }

  await fs.writeFile(resultPath, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
} finally {
  await browser.close().catch(() => {});
}
