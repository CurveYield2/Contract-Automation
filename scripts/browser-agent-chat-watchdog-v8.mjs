#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import {
  deriveSessionStateKeyB64,
  loadEncryptedSessionState,
  saveEncryptedSessionState,
  validateStorageState,
} from './browser-session-state-v1.mjs';

const env = process.env;
const chatUrl = (env.CHAT_URL || '').trim();
const wakeMessage = env.WAKE_MESSAGE || 'GET BACK TO WORK';
const intervalSeconds = Number.parseInt(env.INTERVAL_SECONDS || '300', 10);
const segmentSeconds = Number.parseInt(env.SEGMENT_SECONDS || '14400', 10);
const requestedOverallDeadline = Number.parseInt(env.OVERALL_DEADLINE_EPOCH || '', 10);
const exitAfterFirstPoke = String(env.EXIT_AFTER_FIRST_POKE || '').toLowerCase() === 'true';
const encryptedSessionPath =
  env.CHATGPT_SESSION_STATE_PATH || '/tmp/curveyield-browser-agent/session-state-v1.enc.json';
const sessionUpdatedMarker =
  env.CHATGPT_SESSION_STATE_UPDATED_MARKER || '/tmp/curveyield-browser-agent/session-state-updated';
const sessionStateKeyB64 = deriveSessionStateKeyB64({
  keyB64: env.CHATGPT_SESSION_STATE_KEY_B64,
  bootstrapStateB64: env.CHATGPT_STORAGE_STATE_B64,
});

if (!/^https:\/\/chatgpt\.com\/c\/[A-Za-z0-9_-]+\/?$/.test(chatUrl)) {
  throw new Error('CHAT_URL must be a https://chatgpt.com/c/... conversation URL');
}
if (!Number.isInteger(intervalSeconds) || intervalSeconds < 60 || intervalSeconds > 3600) {
  throw new Error('INTERVAL_SECONDS must be an integer from 60 through 3600');
}
if (!Number.isInteger(segmentSeconds) || segmentSeconds < 60) {
  throw new Error('SEGMENT_SECONDS must be an integer >= 60');
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
      if (await locator.isVisible({ timeout: 500 })) return locator;
    } catch {}
  }
  return null;
}

async function snapshot(page) {
  const stop = await firstVisible(page, [
    'button[data-testid="stop-button"]',
    'button[aria-label*="Stop"]',
    'button:has-text("Stop generating")',
  ]);
  const composer = await firstVisible(page, [
    '#prompt-textarea',
    'textarea[placeholder*="Message"]',
    '[contenteditable="true"][data-lexical-editor="true"]',
    '[contenteditable="true"]',
  ]);
  const bodyText = await page.locator('body').innerText().catch(() => '');
  const title = await page.title().catch(() => '');
  const currentUrl = page.url();

  return {
    generating: !!stop,
    composerVisible: !!composer,
    conversationUnavailable:
      /Unable to load conversation|Conversation not found|Chat not found|This conversation is unavailable/i.test(bodyText),
    loginPrompt: /\bLog in\b|\bSign up\b|Continue with Google|Welcome back/i.test(bodyText),
    humanChallenge:
      /Verify you are human|Checking your browser|Just a moment|Cloudflare|security challenge/i.test(bodyText) ||
      /Just a moment|Cloudflare/i.test(title),
    url: currentUrl,
  };
}

async function persistSession(context) {
  if (!sessionStateKeyB64) return;
  const storage = await context.storageState({ indexedDB: true, opfs: true });
  if (await saveEncryptedSessionState({
    encryptedSessionPath,
    keyB64: sessionStateKeyB64,
    storage,
  })) {
    await fs.mkdir(path.dirname(sessionUpdatedMarker), { recursive: true });
    await fs.writeFile(sessionUpdatedMarker, new Date().toISOString() + '\n', { mode: 0o600 });
  }
}

async function waitForUsableChat(page, maxWaitMs = 180000) {
  const started = Date.now();
  let state = await snapshot(page);
  while (Date.now() - started < maxWaitMs) {
    if (state.composerVisible && !state.humanChallenge && !state.loginPrompt && !state.conversationUnavailable) {
      return state;
    }
    if (state.loginPrompt || state.conversationUnavailable) return state;
    await page.waitForTimeout(5000);
    state = await snapshot(page);
  }
  return state;
}

async function composerText(composer) {
  const tag = await composer.evaluate((el) => el.tagName.toLowerCase());
  if (tag === 'textarea' || tag === 'input') {
    return (await composer.inputValue().catch(() => '')).trim();
  }
  return (await composer.innerText().catch(() => '')).trim();
}

async function countWakeMessagesOutsideComposer(page) {
  const candidates = [
    '[data-message-author-role="user"]',
    '[data-testid^="conversation-turn-"]',
    'main article',
  ];
  let best = 0;
  for (const selector of candidates) {
    const loc = page.locator(selector);
    const count = await loc.count().catch(() => 0);
    let matches = 0;
    for (let i = 0; i < count; i += 1) {
      const text = (await loc.nth(i).innerText().catch(() => '')).trim();
      if (text === wakeMessage || text.includes(wakeMessage)) matches += 1;
    }
    if (matches > best) best = matches;
  }
  return best;
}

async function sendWake(page) {
  const state = await snapshot(page);
  if (state.generating) return false;

  const composer = await firstVisible(page, [
    '#prompt-textarea',
    'textarea[placeholder*="Message"]',
    '[contenteditable="true"][data-lexical-editor="true"]',
    '[contenteditable="true"]',
  ]);
  if (!composer) throw new Error('Composer is not visible');

  const beforeWakeCount = await countWakeMessagesOutsideComposer(page);

  await composer.click();
  const tag = await composer.evaluate((el) => el.tagName.toLowerCase());
  if (tag === 'textarea' || tag === 'input') {
    await composer.fill(wakeMessage);
  } else {
    await composer.fill(wakeMessage).catch(async () => {
      await composer.press('Control+A').catch(() => {});
      await composer.press('Meta+A').catch(() => {});
      await composer.press('Backspace').catch(() => {});
      await composer.type(wakeMessage, { delay: 1 });
    });
  }

  if ((await composerText(composer)) !== wakeMessage) {
    throw new Error('Composer did not contain the wake message after typing');
  }

  const send = await firstVisible(page, [
    'button[data-testid="send-button"]',
    'button[aria-label*="Send"]',
  ]);
  if (send) await send.click();
  else await composer.press('Enter');

  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    await page.waitForTimeout(500);
    const currentComposer = await firstVisible(page, [
      '#prompt-textarea',
      'textarea[placeholder*="Message"]',
      '[contenteditable="true"][data-lexical-editor="true"]',
      '[contenteditable="true"]',
    ]);
    const cleared = currentComposer ? (await composerText(currentComposer)) === '' : true;
    const afterWakeCount = await countWakeMessagesOutsideComposer(page);
    if (cleared && afterWakeCount > beforeWakeCount) {
      await page.waitForTimeout(2000);
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(2000);
      const reloaded = await waitForUsableChat(page, 60000);
      if (!reloaded.composerVisible || reloaded.humanChallenge || reloaded.loginPrompt || reloaded.conversationUnavailable) {
        throw new Error('Wake appeared locally but could not be verified after reload');
      }
      const persistedWakeCount = await countWakeMessagesOutsideComposer(page);
      if (persistedWakeCount <= beforeWakeCount) {
        throw new Error('Wake did not persist in the existing conversation after reload');
      }
      return true;
    }
  }

  throw new Error('Send was not verified: composer did not clear with a new GET BACK TO WORK message in the conversation');
}

const playwrightMod = unwrapRuntimeModule(await importBrowserRuntimeModule('playwright-core'));
const chromium = playwrightMod.chromium;
if (!chromium || typeof chromium.launch !== 'function') {
  throw new Error('playwright-core chromium launcher unavailable');
}

const candidates = [];

if (env.CHATGPT_STORAGE_STATE_B64) {
  const bootstrap = JSON.parse(Buffer.from(env.CHATGPT_STORAGE_STATE_B64, 'base64').toString('utf8'));
  if (!validateStorageState(bootstrap)) throw new Error('CHATGPT_STORAGE_STATE_B64 is invalid');
  candidates.push({ name: 'bootstrap-secret', storage: bootstrap });
}

const cached = await loadEncryptedSessionState({
  encryptedSessionPath,
  keyB64: sessionStateKeyB64,
});
if (cached) candidates.push({ name: 'encrypted-cache', storage: cached });
if (candidates.length === 0) throw new Error('No usable ChatGPT session state is available');

const browser = await chromium.launch({
  headless: env.BROWSER_HEADLESS !== 'false',
  channel: 'chrome',
});

let context = null;
let page = null;

try {
  for (const candidate of candidates) {
    const candidateContext = await browser.newContext({ storageState: candidate.storage });
    const candidatePage = await candidateContext.newPage();
    await candidatePage.goto(chatUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await candidatePage.waitForTimeout(1800);
    const state = await waitForUsableChat(candidatePage);

    if (state.composerVisible && !state.humanChallenge && !state.loginPrompt && !state.conversationUnavailable) {
      context = candidateContext;
      page = candidatePage;
      console.log('[chat-watchdog-v8] Opened existing chat with ' + candidate.name);
      break;
    }
    await candidateContext.close().catch(() => {});
  }

  if (!context || !page) {
    throw new Error('Could not open the supplied existing chat');
  }

  await persistSession(context).catch(() => {});

  const startedEpoch = Math.floor(Date.now() / 1000);
  const overallDeadlineEpoch =
    Number.isInteger(requestedOverallDeadline) && requestedOverallDeadline > 0
      ? requestedOverallDeadline
      : startedEpoch + 43200;
  const segmentDeadlineEpoch = Math.min(startedEpoch + segmentSeconds, overallDeadlineEpoch);
  const intervalMs = intervalSeconds * 1000;
  let lastWorkingAt = Date.now();
  let pokeCount = 0;
  let cycle = 0;

  while (Math.floor(Date.now() / 1000) < segmentDeadlineEpoch) {
    const remainingMs = Math.max(0, segmentDeadlineEpoch * 1000 - Date.now());
    if (remainingMs <= 0) break;

    await page.waitForTimeout(Math.min(intervalMs, remainingMs));
    if (Math.floor(Date.now() / 1000) >= segmentDeadlineEpoch) break;

    cycle += 1;
    const state = await snapshot(page);

    if (state.humanChallenge || state.loginPrompt || state.conversationUnavailable || !state.composerVisible) {
      console.warn('Cycle ' + cycle + ': chat page is temporarily unavailable; retrying on the same page.');
      continue;
    }

    if (state.generating) {
      lastWorkingAt = Date.now();
      console.log('Cycle ' + cycle + ': agent is working; no message sent.');
      continue;
    }

    if (Date.now() - lastWorkingAt < intervalMs) continue;

    console.log('Cycle ' + cycle + ': agent is idle; sending GET BACK TO WORK.');
    try {
      if (await sendWake(page)) {
        pokeCount += 1;
        lastWorkingAt = Date.now();
        await persistSession(context).catch(() => {});
        console.log('Cycle ' + cycle + ': GET BACK TO WORK sent.');
        if (exitAfterFirstPoke) break;
      }
    } catch (error) {
      console.warn('Cycle ' + cycle + ': wake failed: ' + error.message);
    }
  }

  if (env.GITHUB_OUTPUT) {
    await fs.appendFile(
      env.GITHUB_OUTPUT,
      [
        'deadline_epoch=' + overallDeadlineEpoch,
        'poke_count=' + pokeCount,
        '',
      ].join('\n'),
    );
  }
} finally {
  if (context) await persistSession(context).catch(() => {});
  if (context) await context.close().catch(() => {});
  await browser.close().catch(() => {});
}
