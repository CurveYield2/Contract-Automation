#!/usr/bin/env node
import crypto from 'node:crypto';
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
const encryptedSessionPath = env.CHATGPT_SESSION_STATE_PATH || '/tmp/curveyield-browser-agent/session-state-v1.enc.json';
const sessionUpdatedMarker = env.CHATGPT_SESSION_STATE_UPDATED_MARKER || '/tmp/curveyield-browser-agent/session-state-updated';
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
  const resolved = runtimeRequire.resolve(specifier);
  return import(pathToFileURL(resolved).href);
}

function unwrapRuntimeModule(mod) {
  if (!mod) return {};
  const first = mod.default && typeof mod.default === 'object' ? mod.default : mod;
  const second = first.default && typeof first.default === 'object' ? first.default : first;
  return { ...mod, ...first, ...second };
}

function sha(text = '') {
  return crypto.createHash('sha256').update(text).digest('hex');
}

async function conversationFingerprint(page) {
  const selectors = [
    '[data-testid^="conversation-turn-"]',
    '[data-message-author-role]',
    'main article',
  ];
  for (const selector of selectors) {
    const loc = page.locator(selector);
    const count = await loc.count().catch(() => 0);
    if (count > 0) {
      const texts = [];
      for (let i = 0; i < count; i += 1) {
        texts.push((await loc.nth(i).innerText().catch(() => '')).trim());
      }
      return {
        selector,
        count,
        hash: sha(texts.join('\n---TURN---\n')),
      };
    }
  }
  return { selector: '', count: 0, hash: sha('') };
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

  const fingerprint = await conversationFingerprint(page);
  const bodyText = await page.locator('body').innerText().catch(() => '');
  const title = await page.title().catch(() => '');
  const currentUrl = page.url();
  const conversationUnavailable =
    /Unable to load conversation|Conversation not found|Chat not found|This conversation is unavailable/i.test(bodyText);
  const loginPrompt = /\bLog in\b|\bSign up\b|Continue with Google|Welcome back/i.test(bodyText);
  const humanChallenge =
    /Verify you are human|Checking your browser|Just a moment|Cloudflare|security challenge/i.test(bodyText) ||
    /Just a moment|Cloudflare/i.test(title);
  const chatViewable =
    /^https:\/\/chatgpt\.com\/c\/[A-Za-z0-9_-]+/.test(currentUrl) &&
    !!composer &&
    !conversationUnavailable &&
    !loginPrompt &&
    !humanChallenge;

  return {
    generating: !!stop,
    composerVisible: !!composer,
    conversationUnavailable,
    loginPrompt,
    humanChallenge,
    chatViewable,
    turnSelector: fingerprint.selector,
    turnCount: fingerprint.count,
    transcriptHash: fingerprint.hash,
    url: currentUrl,
  };
}

async function persistSession(context) {
  if (!sessionStateKeyB64) return false;
  const storage = await context.storageState({ indexedDB: true, opfs: true });
  const saved = await saveEncryptedSessionState({
    encryptedSessionPath,
    keyB64: sessionStateKeyB64,
    storage,
  });
  if (saved) {
    await fs.mkdir(path.dirname(sessionUpdatedMarker), { recursive: true });
    await fs.writeFile(sessionUpdatedMarker, new Date().toISOString() + '\n', { mode: 0o600 });
  }
  return saved;
}

async function waitForHealthyChat(page, maxWaitMs = 90000) {
  const started = Date.now();
  let state = await snapshot(page);
  while (Date.now() - started < maxWaitMs) {
    if (state.chatViewable) return state;
    if (state.loginPrompt || state.conversationUnavailable) return state;
    if (!state.humanChallenge) return state;
    await page.waitForTimeout(5000);
    state = await snapshot(page);
  }
  return state;
}

async function post(page, message) {
  const before = await snapshot(page);
  if (!before.chatViewable) throw new Error('Chat is not viewable before wake delivery');
  if (before.generating) return { posted: false, skipped: 'GENERATING', after: before };

  const composer = await firstVisible(page, [
    '#prompt-textarea',
    'textarea[placeholder*="Message"]',
    '[contenteditable="true"][data-lexical-editor="true"]',
    '[contenteditable="true"]',
  ]);
  if (!composer) throw new Error('Composer is not visible');

  await composer.click();
  const tag = await composer.evaluate((el) => el.tagName.toLowerCase());
  if (tag === 'textarea' || tag === 'input') {
    await composer.fill(message);
  } else {
    await composer.fill(message).catch(async () => {
      await composer.press('Control+A').catch(() => {});
      await composer.press('Meta+A').catch(() => {});
      await composer.press('Backspace').catch(() => {});
      await composer.type(message, { delay: 1 });
    });
  }

  const send = await firstVisible(page, [
    'button[data-testid="send-button"]',
    'button[aria-label*="Send"]',
  ]);
  if (send) await send.click();
  else await composer.press('Enter');

  await page.waitForTimeout(2000);
  let after = await snapshot(page);
  if (!after.generating) {
    const needle = message.slice(0, Math.min(80, message.length));
    const visible = await page.getByText(needle, { exact: false }).count().catch(() => 0);
    if (!visible) {
      await page.waitForTimeout(3000);
      after = await snapshot(page);
      const visibleRetry = await page.getByText(needle, { exact: false }).count().catch(() => 0);
      if (!after.generating && !visibleRetry) {
        throw new Error('Wake message submission could not be verified');
      }
    }
  }
  return { posted: true, after };
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
if (!storage) throw new Error('No usable ChatGPT storage state is available');

console.log('[chat-watchdog-v2] Using ' + storageSource + ' session state');

const browser = await chromium.launch({
  headless: env.BROWSER_HEADLESS !== 'false',
  channel: 'chrome',
});
const context = await browser.newContext({ storageState: storage });
const page = await context.newPage();

const startedEpoch = Math.floor(Date.now() / 1000);
const overallDeadlineEpoch =
  Number.isInteger(requestedOverallDeadline) && requestedOverallDeadline > 0
    ? requestedOverallDeadline
    : startedEpoch + 43200;
const segmentDeadlineEpoch = Math.min(startedEpoch + segmentSeconds, overallDeadlineEpoch);
const intervalMs = intervalSeconds * 1000;

let pokeCount = 0;
let lastActiveAt = Date.now();
let previousTurnCount = 0;
let previousTranscriptHash = '';
let cycle = 0;

try {
  await page.goto(chatUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(1800);

  let state = await waitForHealthyChat(page);
  if (!state.chatViewable) {
    if (state.humanChallenge) throw new Error('Initial ChatGPT load is blocked by a browser/security challenge');
    if (state.loginPrompt) throw new Error('ChatGPT authentication is required');
    if (state.conversationUnavailable) throw new Error('ChatGPT conversation is unavailable');
    throw new Error('ChatGPT conversation is not viewable');
  }

  await persistSession(context).catch((error) => {
    console.warn('[chat-watchdog-v2] Session persistence warning: ' + error.message);
  });

  previousTurnCount = state.turnCount;
  previousTranscriptHash = state.transcriptHash;
  console.log('[chat-watchdog-v2] fingerprint selector=' + (state.turnSelector || 'none') + ' turns=' + state.turnCount);

  if (state.generating) {
    lastActiveAt = Date.now();
    console.log('Cycle 0: agent is actively generating; persistent supervision started.');
  } else {
    lastActiveAt = Date.now();
    console.log('Cycle 0: chat is idle; baseline recorded before the first idle interval.');
  }

  while (Math.floor(Date.now() / 1000) < segmentDeadlineEpoch) {
    const remainingMs = Math.max(0, segmentDeadlineEpoch * 1000 - Date.now());
    if (remainingMs <= 0) break;
    await page.waitForTimeout(Math.min(intervalMs, remainingMs));
    if (Math.floor(Date.now() / 1000) >= segmentDeadlineEpoch) break;

    cycle += 1;
    state = await waitForHealthyChat(page);

    if (state.humanChallenge) {
      console.warn('Cycle ' + cycle + ': browser challenge persisted on the existing page; no navigation or poke performed.');
      continue;
    }
    if (state.loginPrompt) {
      console.warn('Cycle ' + cycle + ': ChatGPT authentication became unavailable; no poke performed.');
      continue;
    }
    if (state.conversationUnavailable || !state.chatViewable) {
      console.warn('Cycle ' + cycle + ': chat is not viewable; no poke performed.');
      continue;
    }

    const advanced =
      state.turnCount > previousTurnCount ||
      (state.transcriptHash && state.transcriptHash !== previousTranscriptHash);

    if (state.generating || advanced) {
      lastActiveAt = Date.now();
      previousTurnCount = state.turnCount;
      previousTranscriptHash = state.transcriptHash;
      console.log(
        'Cycle ' + cycle + ': agent is active (' +
        (state.generating ? 'GENERATING' : 'CONVERSATION_ADVANCED') +
        '); no interruption.',
      );
      continue;
    }

    const idleMs = Date.now() - lastActiveAt;
    if (idleMs < intervalMs) {
      console.log('Cycle ' + cycle + ': agent is not generating, but the full idle interval has not elapsed.');
      continue;
    }

    console.log('Cycle ' + cycle + ': full idle interval elapsed; sending GET BACK TO WORK.');
    try {
      const result = await post(page, wakeMessage);
      if (result.posted) {
        pokeCount += 1;
        lastActiveAt = Date.now();
        previousTurnCount = result.after.turnCount;
        previousTranscriptHash = result.after.transcriptHash;
        await persistSession(context).catch((error) => {
          console.warn('[chat-watchdog-v2] Session persistence warning after poke: ' + error.message);
        });
        console.log('Cycle ' + cycle + ': wake message delivery verified.');
        if (exitAfterFirstPoke) {
          console.log('Test mode: first verified wake delivered; exiting successfully.');
          break;
        }
      } else if (result.skipped === 'GENERATING') {
        lastActiveAt = Date.now();
        console.log('Cycle ' + cycle + ': generation resumed before delivery; no wake sent.');
      }
    } catch (error) {
      console.warn('Cycle ' + cycle + ': wake delivery failed: ' + error.message);
    }
  }
} finally {
  await persistSession(context).catch(() => {});
  await browser.close().catch(() => {});
}

const endedEpoch = Math.floor(Date.now() / 1000);
console.log('Persistent watchdog segment complete. pokeCount=' + pokeCount);

if (env.GITHUB_OUTPUT) {
  const lines = [
    'deadline_epoch=' + overallDeadlineEpoch,
    'poke_count=' + pokeCount,
    'ended_epoch=' + endedEpoch,
    'turn_count=' + previousTurnCount,
    'turn_hash=' + previousTranscriptHash,
  ].join('\n') + '\n';
  await fs.appendFile(env.GITHUB_OUTPUT, lines);
}
