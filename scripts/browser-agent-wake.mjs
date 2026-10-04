#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { validateStorageState } from './browser-session-state-v1.mjs';
import { loadBrowserRoutine, runBrowserRoutineStage } from './browser-routine-engine-v1.mjs';
import { executeBrowserOperation } from './browser-operations-v1.mjs';

const env = process.env;
const action = env.WAKE_ACTION || 'wake';
const mode = env.WAKE_MODE || 'resume_existing';
const wakeId = env.WAKE_ID || crypto.randomUUID();
const wakeMessage = env.WAKE_MESSAGE || '';
const messagePurpose = env.WAKE_MESSAGE_PURPOSE || 'standard';
const requestedUrl = env.CHAT_URL || '';
let browserRoutineId = env.BROWSER_ROUTINE_ID || '';
let projectName = env.CHATGPT_PROJECT_NAME || '';
let projectUrl = env.CHATGPT_PROJECT_URL || '';
let requestedChatName = env.CHATGPT_CHAT_NAME || '';
const thinkingEffort = (env.CHATGPT_THINKING_EFFORT || '').trim();
const statePath = env.WAKE_RESULT_PATH || '/tmp/browser-agent-wake-result.json';
function sha(text='') {
  return crypto.createHash('sha256').update(text).digest('hex');
}
function bool(v) { return String(v || '').toLowerCase() === 'true'; }

function durableChatUrl(value) {
  try {
    const url = new URL(String(value));
    if (url.origin !== 'https://chatgpt.com') return false;

    const root = url.pathname.match(/^\/c\/([^/]+)\/?$/);
    const project = url.pathname.match(/^\/g\/g-p-[^/]+\/c\/([^/]+)\/?$/);
    const id = root?.[1] || project?.[1] || '';
    return Boolean(id) && !/^local[-_:]/i.test(id);
  } catch { return false; }
}

class BrowserAgentError extends Error {
  constructor(code, message, retryable = false) {
    super(message);
    this.name = 'BrowserAgentError';
    this.code = code;
    this.retryable = retryable;
  }
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

async function loadModules() {
  const playwrightMod = await importBrowserRuntimeModule('playwright-core');
  const playwright = unwrapRuntimeModule(playwrightMod);
  const chromium = playwright.chromium;
  if (!chromium || typeof chromium.launch !== 'function') {
    throw new Error('playwright-core chromium launcher unavailable');
  }
  return { chromium };
}

async function hydrateBrowserContextFromRegistration() {
  if (mode !== 'create_fresh') return false;
  const projectUrlRequired = /project-open-v1$/.test(browserRoutineId);
  if (browserRoutineId && projectName && requestedChatName && (!projectUrlRequired || projectUrl)) return false;
  const campaignId = String(env.CAMPAIGN_ID || '').trim();
  if (!campaignId) return false;
  const safeCampaign = campaignId.replace(/[^A-Za-z0-9._-]/g, '_');
  const registrationPath = path.resolve('process/browser-agent-wake/registrations', safeCampaign + '.json');
  try {
    const registration = JSON.parse(await fs.readFile(registrationPath, 'utf8'));
    if (registration.campaignId !== campaignId) {
      throw new Error('registration campaignId mismatch');
    }
    if (!browserRoutineId) browserRoutineId = String(registration.browserRoutine || '');
    if (!projectName) projectName = String(registration.chatgptProject?.name || '');
    if (!projectUrl) projectUrl = String(registration.chatgptProject?.url || '');
    if (!requestedChatName) {
      requestedChatName = String(
        registration.activeChat?.name ||
        (projectName && registration.activeAssignment?.reviewer
          ? projectName + ' ' + registration.activeAssignment.reviewer
          : '')
      );
    }
    console.log('[github-playwright] browser-context-source=campaign-registration ' + JSON.stringify({
      routineId: browserRoutineId || null,
      projectName: projectName || null,
      projectUrl: projectUrl || null,
      chatName: requestedChatName || null
    }));
    return Boolean(browserRoutineId || projectName || requestedChatName);
  } catch (error) {
    console.log('[github-playwright] browser-context-registration-unavailable=' + JSON.stringify({
      campaignId,
      error: error.message
    }));
    return false;
  }
}

async function firstVisible(page, selectors) {
  for (const s of selectors) {
    const loc = page.locator(s).first();
    try { if (await loc.isVisible({ timeout: 800 })) return loc; } catch {}
  }
  return null;
}

async function snapshot(page) {
  const stop = await firstVisible(page, [
    'button[data-testid="stop-button"]',
    'button[aria-label*="Stop"]',
    'button:has-text("Stop generating")'
  ]);
  const composer = await firstVisible(page, [
    '#prompt-textarea',
    'textarea[placeholder*="Message"]',
    '[contenteditable="true"][data-lexical-editor="true"]',
    '[contenteditable="true"]'
  ]);
  const assistant = page.locator('[data-message-author-role="assistant"]');
  const user = page.locator('[data-message-author-role="user"]');
  const aCount = await assistant.count().catch(() => 0);
  const uCount = await user.count().catch(() => 0);
  let last = '';
  if (aCount) last = await assistant.nth(aCount - 1).innerText().catch(() => '');
  const currentUrl = page.url();
  const bodyText = await page.locator('body').innerText().catch(() => '');
  const title = await page.title().catch(() => '');
  const conversationUnavailable =
    /Unable to load conversation|Conversation not found|Chat not found|This conversation is unavailable/i.test(bodyText);
  const loginPrompt = /\bLog in\b|\bSign up\b|Continue with Google|Welcome back/i.test(bodyText);
  const humanChallenge =
    /Verify you are human|Checking your browser|Just a moment|Cloudflare|security challenge/i.test(bodyText) ||
    /Just a moment|Cloudflare/i.test(title);
  const chatViewable =
    durableChatUrl(currentUrl) &&
    !!composer &&
    !conversationUnavailable &&
    !loginPrompt &&
    !humanChallenge;
  const mainDiagnostics = await page.locator('main, [role="main"]').first().evaluate(el => ({
    tag: el.tagName,
    controls: [...el.querySelectorAll('button,[role="button"],[role="status"],h1,h2')].slice(0,25).map(node => ({
      tag: node.tagName, role: node.getAttribute('role'), label: node.getAttribute('aria-label'),
      testId: node.getAttribute('data-testid'), text: node.getAttribute('role') === 'status' ? node.textContent.trim().slice(0,120) : null,
    })),
  })).catch(() => null);
  return {
    pageTitle: title,
    mainDiagnostics,
    loadingText: /loading|opening chat|reconnecting|synchroniz/i.test(bodyText),
    generating: !!stop,
    composerVisible: !!composer,
    conversationUnavailable,
    loginPrompt,
    humanChallenge,
    chatViewable,
    assistantCount: aCount,
    userCount: uCount,
    lastAssistantHash: sha(last),
    lastAssistantLength: last.length,
    url: currentUrl,
  };
}

async function ensureComposer(page) {
  const selectors = [
    '#prompt-textarea',
    'textarea[placeholder*="Message"]',
    '[contenteditable="true"][data-lexical-editor="true"]',
    '[contenteditable="true"]'
  ];

  const deadline = Date.now() + 30000;
  let composer = await firstVisible(page, selectors);
  while (!composer && Date.now() < deadline) {
    await page.waitForTimeout(1000);
    composer = await firstVisible(page, selectors);
  }
  if (composer) return composer;

  const currentUrl = page.url();
  const title = await page.title().catch(() => '');
  const bodyText = await page.locator('body').innerText().catch(() => '');
  const loginPrompt = /\bLog in\b|\bSign up\b|Continue with Google|Welcome back/i.test(bodyText);
  const humanChallenge =
    /Verify you are human|Checking your browser|Just a moment|Cloudflare|security challenge/i.test(bodyText) ||
    /Just a moment|Cloudflare/i.test(title);
  const conversationUnavailable = /Unable to load conversation|Conversation not found|Chat not found|This conversation is unavailable/i.test(bodyText);
  const textareaCount = await page.locator('textarea').count().catch(() => 0);
  const editableCount = await page.locator('[contenteditable="true"]').count().catch(() => 0);

  const diagnostic =
    'ChatGPT composer not found after 30s' +
    ' (url=' + currentUrl +
    ', title=' + JSON.stringify(title) +
    ', loginPrompt=' + loginPrompt +
    ', humanChallenge=' + humanChallenge +
    ', conversationUnavailable=' + conversationUnavailable +
    ', textareaCount=' + textareaCount +
    ', editableCount=' + editableCount + ')';

  if (humanChallenge) {
    throw new BrowserAgentError('BROWSER_CHALLENGE', diagnostic, false);
  }
  if (loginPrompt) {
    throw new BrowserAgentError('AUTH_REQUIRED', diagnostic, false);
  }
  if (conversationUnavailable) {
    throw new BrowserAgentError('CHAT_UNAVAILABLE', diagnostic, false);
  }
  throw new BrowserAgentError('CHATGPT_UI_UNAVAILABLE', diagnostic, true);
}

async function waitForAssistantResponse(page, before, timeoutMs) {
  const started = Date.now();
  let current = await snapshot(page);
  const changed = () =>
    current.generating ||
    current.assistantCount > before.assistantCount ||
    (current.lastAssistantHash && current.lastAssistantHash !== before.lastAssistantHash);
  if (changed()) return { responded: true, waitedMs: Date.now() - started, snapshot: current };
  while (Date.now() - started < timeoutMs) {
    const remaining = timeoutMs - (Date.now() - started);
    await page.waitForTimeout(Math.min(5000, Math.max(250, remaining)));
    current = await snapshot(page);
    if (changed()) return { responded: true, waitedMs: Date.now() - started, snapshot: current };
  }
  return { responded: false, waitedMs: Date.now() - started, snapshot: current };
}

async function waitForChatIdle(page, timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const stop = await firstVisible(page, [
      'button[data-testid="stop-button"]',
      'button[aria-label="Stop"]',
      'button[aria-label*="Stop"]',
      'button:has-text("Stop generating")'
    ]);
    if (!stop) {
      await page.waitForTimeout(750);
      const confirm = await firstVisible(page, [
        'button[data-testid="stop-button"]',
        'button[aria-label="Stop"]',
        'button[aria-label*="Stop"]',
        'button:has-text("Stop generating")'
      ]);
      if (!confirm) return { idle: true, waitedMs: Date.now() - started };
    }
    await page.waitForTimeout(3000);
  }
  throw new BrowserAgentError('CHAT_BUSY_TIMEOUT', 'Chat remained busy/generating beyond idle wait timeout', false);
}

function randomDelayMs(minMs, maxMs) {
  const min = Math.ceil(minMs);
  const max = Math.floor(maxMs);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function humanActionPause(page) {
  await page.waitForTimeout(randomDelayMs(300, 1500));
}

async function humanTypingPause(page, char = '') {
  // Skilled visible typist pacing: roughly 80-120 WPM in normal prose,
  // with faster spaces and natural punctuation pauses.
  let min = 90;
  let max = 130;
  if (/\s/.test(char)) {
    min = 55;
    max = 95;
  }
  if (/[.!?,;:]/.test(char)) {
    min = 145;
    max = 230;
  }
  await page.waitForTimeout(randomDelayMs(min, max));
}

async function x11Key(args, label = 'x11-key') {
  await new Promise((resolve, reject) => {
    const child = spawn('xdotool', args, {
      env: { ...process.env, DISPLAY: process.env.DISPLAY || ':99' },
      stdio: ['ignore', 'ignore', 'pipe']
    });
    let stderr = '';
    child.stderr?.on('data', chunk => { stderr += chunk.toString(); });
    child.on('error', reject);
    child.on('close', code => code === 0
      ? resolve()
      : reject(new Error(label + ' failed: ' + stderr.trim())));
  });
}

async function humanPointerClick(page, locator) {
  await locator.scrollIntoViewIfNeeded().catch(() => {});
  await humanActionPause(page);
  await locator.hover().catch(() => {});
  await humanActionPause(page);
  const box = await locator.boundingBox();
  if (!box) throw new BrowserAgentError('VISIBLE_CONTROL_NOT_CLICKABLE', 'Visible control has no clickable bounding box', true);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 12 });
  await humanActionPause(page);
  await page.mouse.down();
  await page.waitForTimeout(randomDelayMs(300, 700));
  await page.mouse.up();
  await humanActionPause(page);
}

async function humanShortPointerClick(page, locator) {
  await locator.scrollIntoViewIfNeeded().catch(() => {});
  await humanActionPause(page);
  const box = await locator.boundingBox();
  if (!box) throw new BrowserAgentError('VISIBLE_CONTROL_NOT_CLICKABLE', 'Visible short-click target has no clickable bounding box', true);
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y, { steps: 18 });
  await page.waitForTimeout(randomDelayMs(120, 280));
  await page.mouse.down();
  await page.waitForTimeout(randomDelayMs(70, 160));
  await page.mouse.up();
  await humanActionPause(page);
}

async function composerDiagnostics(page) {
  return page.evaluate(() => {
    const buttons = [...document.querySelectorAll('button')].slice(-50).map((b, i) => ({
      i,
      text: (b.innerText || '').trim().slice(0, 80),
      aria: b.getAttribute('aria-label'),
      testid: b.getAttribute('data-testid'),
      disabled: !!b.disabled,
      type: b.getAttribute('type')
    }));
    const editables = [...document.querySelectorAll('textarea,[contenteditable="true"]')].slice(-20).map((e, i) => ({
      i,
      tag: e.tagName,
      id: e.id,
      role: e.getAttribute('role'),
      aria: e.getAttribute('aria-label'),
      placeholder: e.getAttribute('placeholder'),
      testid: e.getAttribute('data-testid'),
      textLength: String(e.innerText || e.value || '').length
    }));
    return { buttons, editables, url: location.href, title: document.title };
  });
}

function normalizeVisibleText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function visibleMessageMarker(message, maxLength = 160) {
  return normalizeVisibleText(message).slice(0, maxLength);
}

async function wakeMarkerVisible(page, marker) {
  const normalizedMarker = normalizeVisibleText(marker);
  const users = page.locator('[data-message-author-role="user"]');
  const userCount = await users.count().catch(() => 0);
  for (let i = Math.max(0, userCount - 8); i < userCount; i += 1) {
    const user = users.nth(i);
    if (!await user.isVisible().catch(() => false)) continue;
    const text = normalizeVisibleText(await user.innerText().catch(() => ''));
    if (normalizedMarker && text.includes(normalizedMarker)) {
      return { visible: true, userCount, method: 'user-role' };
    }
  }

  return {
    visible: false,
    userCount,
    method: 'not-visible'
  };
}

async function readComposerText(composer) {
  return await composer.inputValue().catch(async () => {
    return await composer.innerText().catch(() => '');
  });
}

async function clearComposer(page, composer) {
  const currentText = await readComposerText(composer);
  if (!currentText) return;
  await x11Key(['key', '--clearmodifiers', 'ctrl+a'], 'x11-select-all');
  await page.waitForTimeout(randomDelayMs(90, 160));
  await x11Key(['key', '--clearmodifiers', 'BackSpace'], 'x11-backspace');
  await page.waitForTimeout(randomDelayMs(120, 220));
}

async function verifyComposerMessage(composer, message, label) {
  const filledText = await readComposerText(composer);
  const normalizedFilled = normalizeVisibleText(filledText);
  const normalizedMessage = normalizeVisibleText(message);
  const marker = visibleMessageMarker(message);
  const minimumExpectedLength = Math.min(marker.length, Math.floor(normalizedMessage.length * 0.9));
  const prefixMatches = marker.length > 0 && normalizedFilled.includes(marker);
  const lengthLooksPlausible = normalizedFilled.length >= minimumExpectedLength;
  console.log(`[github-playwright] ${label}=` + JSON.stringify({
    normalizedFilledLength: normalizedFilled.length,
    normalizedMessageLength: normalizedMessage.length,
    markerLength: marker.length,
    prefixMatches,
    lengthLooksPlausible
  }));
  return { prefixMatches, lengthLooksPlausible };
}

async function fillComposer(page, message) {
  const composer = await ensureComposer(page);
  await humanPointerClick(page, composer);
  await clearComposer(page, composer);

  const text = String(message);
  console.log('[github-playwright] composer-fill-strategy=human-x11-skilled-typist-per-character length=' + text.length);

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    await x11Key(['type', '--clearmodifiers', '--delay', '0', char], 'x11-type-character');
    await humanTypingPause(page, char);

    if ((i + 1) % 250 === 0 || i === text.length - 1) {
      const visible = await readComposerText(composer);
      const visibleLength = normalizeVisibleText(visible).length;
      if (!visible || visibleLength === 0) {
        throw new BrowserAgentError(
          'COMPOSER_HUMAN_TYPE_LOST',
          'Visible composer lost X11 human-typed text during per-character entry',
          true
        );
      }
      console.log('[github-playwright] human-x11-keyboard-progress=' + JSON.stringify({
        typedCharacters: i + 1,
        totalCharacters: text.length,
        visibleLength
      }));
    }
  }

  await humanActionPause(page);

  const verification = await verifyComposerMessage(composer, message, 'composer-human-x11-skilled-typist-verification');
  if (!verification.prefixMatches || !verification.lengthLooksPlausible) {
    throw new BrowserAgentError(
      'COMPOSER_FILL_MISMATCH',
      'Composer did not retain the normalized wake marker after visible X11 human typing',
      true
    );
  }
  return composer;
}

async function post(page, message) {
  if (!message) throw new Error('Wake message is empty');
  const marker = visibleMessageMarker(message);
  if (messagePurpose === 'initial_wake') {
    console.log('[github-playwright] chat-idle-wait=skipped-for-initial-wake');
  } else {
    const requestedIdleWait = Number.parseInt(env.IDLE_WAIT_MS || '600000', 10);
    const idleWaitMs = Number.isFinite(requestedIdleWait) ? Math.max(30000, requestedIdleWait) : 600000;
    await waitForChatIdle(page, idleWaitMs);
  }

  let composer = await fillComposer(page, message);
  console.log('[github-playwright] composer-diagnostics=' + JSON.stringify(await composerDiagnostics(page)));

  const send = await firstVisible(page, [
    'button[data-testid="send-button"]',
    'button[data-testid="composer-submit-button"]',
    'button[aria-label="Send prompt"]',
    'button[aria-label="Send"]',
    'button[aria-label*="Send"]'
  ]);

  if (send) {
    console.log('[github-playwright] send-strategy=human-short-pointer-click');
    await humanShortPointerClick(page, send);
    await page.waitForTimeout(randomDelayMs(1400, 2200));

    const quickVisible = await wakeMarkerVisible(page, marker);
    if (!quickVisible.visible) {
      composer = await ensureComposer(page);
      const composerAfterFirstClick = await composer.inputValue().catch(async () => {
        return await composer.innerText().catch(() => '');
      });
      const normalizedAfterFirstClick = normalizeVisibleText(composerAfterFirstClick);
      if (normalizedAfterFirstClick.includes(marker)) {
        const retrySend = await firstVisible(page, [
          'button[data-testid="send-button"]',
          'button[data-testid="composer-submit-button"]',
          'button[aria-label="Send prompt"]',
          'button[aria-label="Send"]',
          'button[aria-label*="Send"]'
        ]);
        if (!retrySend) {
          throw new BrowserAgentError('SEND_CONTROL_MISSING_ON_RETRY', 'Wake remained in composer after first Send click and no visible Send control was available for retry', true);
        }
        console.log('[github-playwright] send-retry=human-short-pointer-click reason=message-still-in-composer');
        await humanShortPointerClick(page, retrySend);
        await page.waitForTimeout(randomDelayMs(900, 1500));
      }
    }
  } else {
    composer = await ensureComposer(page);
    console.log('[github-playwright] send-strategy=human-x11-keyboard-enter');
    await x11Key(['key', '--clearmodifiers', 'Return'], 'x11-send-enter');
    await page.waitForTimeout(randomDelayMs(280, 420));
  }

  const deadline = Date.now() + 90000;
  let dom = { visible: false, userCount: 0, method: 'not-visible' };
  while (Date.now() < deadline) {
    dom = await wakeMarkerVisible(page, marker);
    if (dom.visible) {
      console.log('[github-playwright] send-visible-marker=' + JSON.stringify(dom));
      return {
        domMarkerObserved: true,
        userCount: dom.userCount,
        verificationMethod: dom.method
      };
    }
    await page.waitForTimeout(750);
  }

  throw new BrowserAgentError(
    'SEND_NOT_VISIBLE',
    'Wake message was submitted through the visible composer but did not become visibly rendered within 90 seconds',
    false
  );
}

async function persistedWakeVisible(page, message, timeoutMs = 90000) {
  const marker = visibleMessageMarker(message);
  const deadline = Date.now() + timeoutMs;
  let state = { visible: false, userCount: 0, method: 'not-visible' };
  while (Date.now() < deadline) {
    state = await wakeMarkerVisible(page, marker);
    if (state.visible) return { persisted: true, ...state };
    await page.waitForTimeout(750);
  }
  return { persisted: false, ...state };
}

async function waitForDurableChatUrl(page, timeoutMs = 300000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const state = await snapshot(page).catch(() => null);
    if (state?.humanChallenge) {
      throw new BrowserAgentError(
        'BROWSER_CHALLENGE',
        'Visible ChatGPT/Cloudflare verification detected while waiting for durable chat URL; aborting workflow immediately',
        false
      );
    }
    if (durableChatUrl(page.url())) {
      console.log('[github-playwright] durable-chat-route=' + JSON.stringify({ url: page.url() }));
      return page.url();
    }
    await page.waitForTimeout(500);
  }
  throw new BrowserAgentError(
    'CHAT_URL_NOT_DURABLE',
    'Fresh chat did not transition from its optimistic/local route to a durable chat URL within 5 minutes',
    false
  );
}

async function humanReload(page) {
  console.log('[github-playwright] verification-reload=human-x11-control-r');
  await x11Key(['key', '--clearmodifiers', 'ctrl+r'], 'x11-reload');
  await page.waitForLoadState('domcontentloaded', { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(1500);
}

async function postWithVisibleVerification(page, message) {
  const submittedRequest = await post(page, message);

  const beforeReload = await persistedWakeVisible(page, message, 90000);
  console.log('[github-playwright] visible-wake-before-reload=' + JSON.stringify({
    ...beforeReload,
    chatUrl: page.url()
  }));
  if (!beforeReload.persisted) {
    throw new BrowserAgentError(
      'DURABILITY_NOT_VISIBLE',
      'Wake message was not visibly rendered before persistence reload',
      false
    );
  }

  if (mode === 'create_fresh' && !durableChatUrl(page.url())) {
    await waitForDurableChatUrl(page, 300000);
  }

  if (mode === 'resume_existing' && messagePurpose === 'initial_wake') {
    const passiveState = await snapshot(page).catch(() => null);
    if (passiveState?.humanChallenge) {
      throw new BrowserAgentError(
        'POST_SEND_CHALLENGE',
        'A visible human challenge appeared after wake submission; delivery is not accepted',
        true
      );
    }
    if (beforeReload.method !== 'user-role' || beforeReload.userCount < 1) {
      throw new BrowserAgentError(
        'USER_MESSAGE_NOT_RENDERED',
        'Wake marker was not verified inside an actual rendered user message',
        true
      );
    }
    const delivery = {
      writeRequestObserved: false,
      writeAccepted: true,
      responseBodyMarkerObserved: false,
      domPersisted: true,
      verification: 'visible-user-message',
      verificationMethod: beforeReload.method,
      postSendChallenge: false,
      postSendHealth: null,
      response: null,
      responseCandidates: [],
      submittedRequest,
      persisted: true,
      userCount: beforeReload.userCount
    };
    console.log('[github-playwright] delivery-state=existing-chat-user-message-verified ' + JSON.stringify(delivery));
    return delivery;
  }

  await humanReload(page);
  await waitForVisibleBrowserReady(page, 'post-send persistence reload');

  const afterReload = await persistedWakeVisible(page, message, 90000);
  console.log('[github-playwright] visible-wake-after-reload=' + JSON.stringify({
    ...afterReload,
    chatUrl: page.url()
  }));
  if (!afterReload.persisted) {
    throw new BrowserAgentError(
      'DURABILITY_NOT_VISIBLE_AFTER_RELOAD',
      'Wake message was not visibly rendered after human-style reload',
      false
    );
  }

  const passiveState = await snapshot(page).catch(() => null);
  const delivery = {
    writeRequestObserved: false,
    writeAccepted: true,
    responseBodyMarkerObserved: false,
    domPersisted: true,
    verification: 'visible-browser-only',
    verificationMethod: afterReload.method,
    postSendChallenge: passiveState?.humanChallenge === true,
    postSendHealth: null,
    response: null,
    responseCandidates: [],
    submittedRequest,
    persisted: true,
    userCount: afterReload.userCount
  };
  console.log('[github-playwright] delivery-state=' + JSON.stringify(delivery));
  return delivery;
}


async function waitForVisibleBrowserReady(page, reason = 'visible browser readiness') {
  const requested = Number.parseInt(env.MANUAL_CHALLENGE_WAIT_MS || '0', 10);
  const waitMs = Number.isFinite(requested) ? Math.max(0, requested) : 0;
  const deadline = Date.now() + waitMs;

  while (true) {
    const state = await snapshot(page).catch(() => null);
    const ready = Boolean(
      state?.composerVisible &&
      !state?.loginPrompt &&
      !state?.humanChallenge &&
      !state?.conversationUnavailable
    );

    console.log('[github-playwright] visible-browser-ready=' + JSON.stringify({
      reason,
      ready,
      url: state?.url || page.url(),
      composerVisible: state?.composerVisible ?? false,
      loginPrompt: state?.loginPrompt ?? false,
      humanChallenge: state?.humanChallenge ?? false,
      conversationUnavailable: state?.conversationUnavailable ?? false
    }));

    if (state?.humanChallenge) {
      throw new BrowserAgentError(
        'BROWSER_CHALLENGE',
        'Visible ChatGPT/Cloudflare verification detected; aborting workflow immediately',
        false
      );
    }
    if (ready) return state;
    if (Date.now() >= deadline) {
      if (state?.loginPrompt) {
        throw new BrowserAgentError('AUTH_REQUIRED', 'Visible ChatGPT browser requires login', false);
      }
      throw new BrowserAgentError('VISIBLE_BROWSER_NOT_READY', 'Visible ChatGPT browser did not become ready within the configured 5-minute wait', true);
    }

    if (bool(env.INTERACTIVE_VIEW_ENABLED)) {
      const vnc = env.TAILSCALE_RUNNER_IP ? env.TAILSCALE_RUNNER_IP + ':5900' : 'the private runner VNC endpoint';
      console.log('[github-playwright] Visible browser is not ready at ' + vnc + '; waiting only for ordinary UI/login readiness. Cloudflare challenge aborts immediately.');
    }
    await page.waitForTimeout(5000);
  }
}

async function runWithPage(providerName, connect) {
  const { browser, context, page, close } = await connect();
  try {
    if (mode === 'resume_existing') {
      if (!durableChatUrl(requestedUrl)) {
        throw new Error('resume_existing requires a durable root or Project-scoped ChatGPT conversation URL');
      }
      await page.goto(requestedUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    } else if (mode === 'create_fresh') {
      await page.goto('https://chatgpt.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    } else {
      throw new Error('Unsupported WAKE_MODE');
    }

    await page.waitForTimeout(1500);
    if (bool(env.REFRESH_BEFORE_WAKE)) {
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(1500);
    }

    await waitForVisibleBrowserReady(page, 'initial browser session');
    await ensureComposer(page);

    let routine = null;
    let routineBefore = [];
    if (mode === 'create_fresh' && browserRoutineId) {
      await ensureComposer(page);
      routine = await loadBrowserRoutine(browserRoutineId);
      const routineVars = {
        projectName,
        projectUrl,
        chatName: requestedChatName,
        campaignId: env.CAMPAIGN_ID || '',
        phaseId: env.PHASE_ID || ''
      };
      routineBefore = await runBrowserRoutineStage({
        page,
        routine,
        stage: 'before_message',
        vars: routineVars,
      });
      const capturedShare = routineBefore.find((entry) => entry.operation === 'chatgpt.capture_project_share_link')?.result;
      const openedProject = routineBefore.find((entry) => entry.operation === 'chatgpt.open_project_url')?.result;
      const namedProject = routineBefore.find((entry) => entry.operation === 'chatgpt.open_project_by_name')?.result;
      const projectResult = capturedShare || openedProject || namedProject ||
        [...routineBefore].reverse().find((entry) => entry?.result?.projectUrl)?.result;
      projectUrl = projectResult?.projectUrl || projectUrl || '';

      if (routineBefore.some((entry) => entry.operation === 'chatgpt.capture_project_share_link')) {
        try {
          const parsed = new URL(projectUrl);
          if (parsed.origin !== 'https://chatgpt.com' || parsed.pathname === '/' || /\/c\//.test(parsed.pathname)) {
            throw new Error('invalid project URL');
          }
        } catch {
          throw new BrowserAgentError(
            'PROJECT_SHARE_URL_REQUIRED',
            'Project creation did not return a valid private ChatGPT Project share URL; the managed wake cannot be sent.',
            true,
          );
        }
      }
    }

    const before = await snapshot(page);

    if (action === 'observe') {
      // A browser/security challenge or login wall is provider/session
      // infrastructure, not an observation of the reviewer. Surface it to
      // the watchdog without misclassifying reviewer state.
      if (before.humanChallenge) {
        throw new BrowserAgentError(
          'BROWSER_CHALLENGE',
          'Observation provider is blocked by a browser/security challenge at ' + before.url,
          true,
        );
      }
      if (before.loginPrompt) {
        throw new BrowserAgentError(
          'AUTH_REQUIRED',
          'Observation provider is not authenticated at ' + before.url,
          false,
        );
      }
      const sessionStatePersisted = false;
      const result = { ok: true, provider: providerName, action, wakeId, sessionStatePersisted, ...before };
      await fs.writeFile(statePath, JSON.stringify(result, null, 2) + '\n');
      return result;
    }
    if (before.generating && !bool(env.FORCE_WAKE)) {
      const sessionStatePersisted = false;
      const result = { ok: true, provider: providerName, action, wakeId, skipped: 'PRODUCTIVE_GENERATING', sessionStatePersisted, ...before };
      await fs.writeFile(statePath, JSON.stringify(result, null, 2) + '\n');
      return result;
    }

    if (action === 'wake_and_wait' && mode === 'resume_existing' && !before.chatViewable) {
      const result = {
        ok: true, provider: providerName, action, wakeId,
        posted: false, responded: false, deadReason: 'CHAT_UNVIEWABLE',
        before, after: before, chatUrl: before.url
      };
      await fs.writeFile(statePath, JSON.stringify(result, null, 2) + '\n');
      return result;
    }

    let thinkingEffortResult = null;
    if (thinkingEffort && mode !== 'resume_existing') {
      await ensureComposer(page);
      thinkingEffortResult = await executeBrowserOperation({
        page,
        name: 'chatgpt.ensure_thinking_effort',
        args: { level: thinkingEffort },
      });
    } else if (thinkingEffort && mode === 'resume_existing') {
      thinkingEffortResult = {
        level: thinkingEffort,
        changed: false,
        verified: false,
        preservedExistingChatConfiguration: true
      };
      console.log('[github-playwright] thinking-effort=preserve-existing-chat-configuration');
    }

    const delivery = await postWithVisibleVerification(page, wakeMessage);

    // Once submission is verified, never fail over to another browser provider for
    // post-delivery UI bookkeeping. Doing so can create a second reviewer chat.
    let response = null;
    let after = before;
    let routineAfter = [];
    const postDeliveryWarnings = [];
    try {
      if (action === 'wake_and_wait') {
        const requestedWait = Number.parseInt(env.RESPONSE_WAIT_MS || '120000', 10);
        const responseWaitMs = Number.isFinite(requestedWait) ? Math.max(120000, requestedWait) : 120000;
        response = await waitForAssistantResponse(page, before, responseWaitMs);
        after = response.snapshot;
      } else {
        await page.waitForTimeout(1500);
        after = await snapshot(page);
      }

      if (mode === 'create_fresh' && !durableChatUrl(after.url)) {
        // A local-chatgpt temporary route is not a reopenable reviewer chat.
        await page.waitForURL(url => durableChatUrl(url.toString()), { timeout: 60000 }).catch(() => {});
        after = await snapshot(page);
      }

      if (routine) {
        routineAfter = await runBrowserRoutineStage({
          page,
          routine,
          stage: 'after_message',
          vars: { projectName, projectUrl, chatName: requestedChatName, campaignId: env.CAMPAIGN_ID || '', phaseId: env.PHASE_ID || '' },
        });
        after = await snapshot(page);
      }
    } catch (error) {
      postDeliveryWarnings.push({
        code: 'POST_DELIVERY_BOOKKEEPING_FAILED',
        error: error?.message || String(error),
      });
      after = await snapshot(page).catch(() => ({ ...before, url: page.url() }));
    }

    const renameResult = [...routineAfter].reverse().find((entry) => entry.operation === 'chatgpt.rename_current_chat')?.result || null;
    const sessionStatePersisted = false;
    const chatUrlVerified = durableChatUrl(after.url);
    const result = {
      // A posted message with no durable conversation cannot activate a reviewer.
      // Return normally so the provider loop never posts it again elsewhere.
      ok: chatUrlVerified, provider: providerName, action, wakeId, posted: true, before, after, sessionStatePersisted,
      chatUrlVerified,
      ...(!chatUrlVerified ? { failures: [{ provider: providerName, code: 'CHAT_URL_NOT_DURABLE', retryable: false,
        error: 'Message submission was observed but no durable reviewer chat URL appeared within 60 seconds; do not repeat the initial message blindly.' }] } : {}),
      chatUrl: after.url,
      browserRoutineId: browserRoutineId || null,
      projectName: projectName || null,
      projectUrl: projectUrl || null,
      requestedChatName: requestedChatName || null,
      chatRenamed: renameResult?.renamed ?? null,
      thinkingEffort: thinkingEffortResult,
      delivery,
      postDeliveryWarnings,
      ...(response ? { responded: response.responded, waitedMs: response.waitedMs } : {})
    };
    await fs.writeFile(statePath, JSON.stringify(result, null, 2) + '\n');
    return result;
  } finally {
    await close().catch(()=>{});
  }
}

async function localProvider(chromium) {
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
  console.log('[github-playwright] Using immutable bootstrap-secret session state; run state will be discarded.');
  const browser = await chromium.launch({
    headless: false,
    channel: 'chrome'
  });
  const context = await browser.newContext({
    storageState: storage
  });
  const page = await context.newPage();
  return { browser, context, page, close: () => browser.close() };
}

await hydrateBrowserContextFromRegistration();

const { chromium } = await loadModules();
const providers = [
  ['github-playwright', () => localProvider(chromium)],
];

const failures = [];
for (const [name, connect] of providers) {
  try {
    const result = await runWithPage(name, connect);
    console.log(JSON.stringify(result));
    process.exit(0);
  } catch (error) {
    failures.push({
      provider: name,
      code: error?.code || 'PROVIDER_ERROR',
      retryable: error?.retryable === true,
      error: error.message,
    });
    console.error('[' + name + '] ' + error.message);
  }
}
if (action === 'observe') {
  const challengeFailure = failures.find((entry) => entry.code === 'BROWSER_CHALLENGE');
  const authFailure = failures.find((entry) => entry.code === 'AUTH_REQUIRED');
  if (challengeFailure || authFailure) {
    const result = {
      ok: true,
      provider: null,
      action,
      wakeId,
      sessionStatePersisted: false,
      generating: false,
      composerVisible: false,
      conversationUnavailable: false,
      loginPrompt: !!authFailure && !challengeFailure,
      humanChallenge: !!challengeFailure,
      chatViewable: false,
      assistantCount: 0,
      userCount: 0,
      lastAssistantHash: '',
      lastAssistantLength: 0,
      url: requestedUrl,
      providerFailures: failures,
    };
    await fs.writeFile(statePath, JSON.stringify(result, null, 2) + '\n');
    console.warn(JSON.stringify(result));
    process.exit(0);
  }
}

const failedResult = {
  ok: false,
  wakeId,
  failures,
  browserRoutineId: browserRoutineId || null,
  projectName: projectName || null,
  projectUrl: projectUrl || null,
};
await fs.writeFile(statePath, JSON.stringify(failedResult, null, 2) + '\n');
console.error(JSON.stringify(failedResult));
process.exit(1);
