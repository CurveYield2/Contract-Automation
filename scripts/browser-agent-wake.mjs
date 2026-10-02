#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { deriveSessionStateKeyB64, loadEncryptedSessionState, saveEncryptedSessionState, validateStorageState } from './browser-session-state-v1.mjs';
import { loadBrowserRoutine, runBrowserRoutineStage } from './browser-routine-engine-v1.mjs';
import { executeBrowserOperation } from './browser-operations-v1.mjs';

const env = process.env;
const action = env.WAKE_ACTION || 'wake';
const mode = env.WAKE_MODE || 'resume_existing';
const wakeId = env.WAKE_ID || crypto.randomUUID();
const wakeMessage = env.WAKE_MESSAGE || '';
const requestedUrl = env.CHAT_URL || '';
let browserRoutineId = env.BROWSER_ROUTINE_ID || '';
let projectName = env.CHATGPT_PROJECT_NAME || '';
let requestedChatName = env.CHATGPT_CHAT_NAME || '';
let projectCreationPolicy = env.PROJECT_CREATION_POLICY || '';
const thinkingEffort = (env.CHATGPT_THINKING_EFFORT || '').trim();
const statePath = env.WAKE_RESULT_PATH || '/tmp/browser-agent-wake-result.json';
const encryptedSessionPath = env.CHATGPT_SESSION_STATE_PATH || '/tmp/curveyield-browser-agent/session-state-v1.enc.json';
const sessionUpdatedMarker = env.CHATGPT_SESSION_STATE_UPDATED_MARKER || '/tmp/curveyield-browser-agent/session-state-updated';
const sessionStateKeyB64 = deriveSessionStateKeyB64({
  keyB64: env.CHATGPT_SESSION_STATE_KEY_B64,
  bootstrapStateB64: env.CHATGPT_STORAGE_STATE_B64,
});

function sha(text='') {
  return crypto.createHash('sha256').update(text).digest('hex');
}
function bool(v) { return String(v || '').toLowerCase() === 'true'; }

function durableChatUrl(value) {
  try {
    const url = new URL(String(value));
    return url.origin === 'https://chatgpt.com'
      && /^\/c\/[A-Za-z0-9_-]+$/.test(url.pathname)
      && !/^\/c\/local[-_:]/i.test(url.pathname);
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

async function persistHealthySession(providerName, context, state) {
  if (providerName !== 'github-playwright') return false;
  if (!state?.composerVisible || !/^https:\/\/chatgpt\.com\//.test(state.url || '')) return false;
  try {
    const storage = await context.storageState({ indexedDB: true, opfs: true });
    const persisted = await saveEncryptedSessionState({
      encryptedSessionPath,
      keyB64: sessionStateKeyB64,
      storage,
    });
    if (persisted) {
      await fs.mkdir(path.dirname(sessionUpdatedMarker), { recursive: true });
      await fs.writeFile(sessionUpdatedMarker, new Date().toISOString() + '\n', { mode: 0o600 });
    }
    return persisted;
  } catch (error) {
    console.warn('[github-playwright] Refreshed session state could not be persisted: ' + error.message);
    return false;
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
  if (browserRoutineId && projectName && requestedChatName) return false;
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
    if (!requestedChatName) {
      requestedChatName = String(
        registration.activeChat?.name ||
        (projectName && registration.activeAssignment?.reviewer
          ? projectName + ' ' + registration.activeAssignment.reviewer
          : '')
      );
    }
    if (!projectCreationPolicy) {
      projectCreationPolicy = String(registration.projectCreationPolicy || '');
    }
    console.log('[github-playwright] browser-context-source=campaign-registration ' + JSON.stringify({
      routineId: browserRoutineId || null,
      projectName: projectName || null,
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
    /^https:\/\/chatgpt\.com\/c\/[A-Za-z0-9_-]+/.test(currentUrl) &&
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
    throw new BrowserAgentError('BROWSER_CHALLENGE', diagnostic, true);
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

async function backendPreflight(page) {
  return page.evaluate(async () => {
    const targets = [
      '/backend-api/models',
      '/backend-api/conversations?offset=0&limit=1&order=updated'
    ];
    const checks = [];
    for (const target of targets) {
      try {
        const response = await fetch(target, { credentials: 'include', cache: 'no-store' });
        checks.push({
          target,
          status: response.status,
          ok: response.ok,
          cfMitigated: response.headers.get('cf-mitigated'),
          server: response.headers.get('server')
        });
      } catch (error) {
        checks.push({ target, status: 0, ok: false, error: String(error) });
      }
    }
    return checks;
  });
}

async function waitForBackendHealth(page) {
  const requested = Number.parseInt(env.MANUAL_CHALLENGE_WAIT_MS || '0', 10);
  const waitMs = Number.isFinite(requested) ? Math.max(0, requested) : 0;
  const deadline = Date.now() + waitMs;
  let last = null;
  while (true) {
    last = await backendPreflight(page).catch(error => [{ ok: false, status: 0, error: error.message }]);
    const challenged = last.some(item => item?.cfMitigated === 'challenge');
    const healthy = last.length > 0 && last.every(item => item?.ok === true && item?.cfMitigated !== 'challenge');
    console.log('[github-playwright] backend-preflight=' + JSON.stringify({ healthy, challenged, checks: last }));
    if (healthy) return last;
    if (Date.now() >= deadline) {
      throw new BrowserAgentError('BROWSER_CHALLENGE', 'ChatGPT backend preflight is not healthy: ' + JSON.stringify(last), true);
    }
    if (bool(env.INTERACTIVE_VIEW_ENABLED)) {
      console.log('[github-playwright] Browser remains visible through private tailnet VNC for normal human verification.');
    }
    await page.waitForTimeout(5000);
  }
}

async function humanPointerClick(page, locator, { hoverMs = 220, downMs = 70, settleMs = 280 } = {}) {
  await locator.scrollIntoViewIfNeeded().catch(() => {});
  await locator.hover().catch(() => {});
  const box = await locator.boundingBox();
  if (!box) throw new BrowserAgentError('VISIBLE_CONTROL_NOT_CLICKABLE', 'Visible control has no clickable bounding box', true);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 12 });
  await page.waitForTimeout(hoverMs);
  await page.mouse.down();
  await page.waitForTimeout(downMs);
  await page.mouse.up();
  await page.waitForTimeout(settleMs);
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

async function wakeMarkerVisible(page, marker) {
  const users = page.locator('[data-message-author-role="user"]');
  const count = await users.count().catch(() => 0);
  for (let i = Math.max(0, count - 8); i < count; i += 1) {
    const text = await users.nth(i).innerText().catch(() => '');
    if (text.includes(marker)) return { visible: true, userCount: count };
  }
  return { visible: false, userCount: count };
}

function likelyConversationWrite(url) {
  try {
    const u = new URL(url);
    return /\/backend-api\/(?:f\/)?conversation(?:[/?]|$)/.test(u.pathname + u.search) ||
      /\/backend-api\/.*messages?(?:[/?]|$)/.test(u.pathname + u.search);
  } catch {
    return false;
  }
}

async function fillComposer(page, message) {
  const composer = await ensureComposer(page);
  await humanPointerClick(page, composer, { hoverMs: 120, downMs: 55, settleMs: 180 });

  const currentText = await composer.evaluate(el => (el.innerText || el.textContent || el.value || '')).catch(() => '');
  if (currentText) {
    await composer.press('Control+A').catch(async () => composer.press('Meta+A').catch(() => {}));
    await page.waitForTimeout(120);
    await composer.press('Backspace');
    await page.waitForTimeout(150);
  }

  await composer.pressSequentially(message, { delay: 35 });
  await page.waitForTimeout(300);

  const filledText = await composer.evaluate(el => (el.innerText || el.textContent || el.value || '')).catch(() => '');
  const marker = message.slice(0, Math.min(120, message.length));
  if (!filledText.includes(marker)) {
    throw new BrowserAgentError('COMPOSER_FILL_MISMATCH', 'Composer did not retain the exact wake marker after keyboard typing', true);
  }
  return composer;
}

async function post(page, message) {
  if (!message) throw new Error('Wake message is empty');
  const marker = message.slice(0, Math.min(120, message.length));
  const requestedIdleWait = Number.parseInt(env.IDLE_WAIT_MS || '600000', 10);
  const idleWaitMs = Number.isFinite(requestedIdleWait) ? Math.max(30000, requestedIdleWait) : 600000;
  await waitForChatIdle(page, idleWaitMs);

  let observed = null;
  const candidateRequests = [];
  const onRequest = request => {
    const method = request.method();
    if (!['POST','PUT','PATCH'].includes(method)) return;
    const data = request.postData() || '';
    if (likelyConversationWrite(request.url())) {
      candidateRequests.push({ url: request.url(), method, postDataLength: data.length });
    }
    if (data.includes(marker)) {
      observed = { url: request.url(), method, bodyContainsMarker: true, postDataLength: data.length };
    }
  };
  page.on('request', onRequest);

  try {
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
      await humanPointerClick(page, send, { hoverMs: 180, downMs: 65, settleMs: 260 });
    } else {
      composer = await ensureComposer(page);
      await composer.press('Enter');
    }

    const deadline = Date.now() + 10000;
    let dom = { visible: false, userCount: 0 };
    while (Date.now() < deadline) {
      if (observed) break;
      dom = await wakeMarkerVisible(page, marker);
      if (dom.visible) break;
      await page.waitForTimeout(250);
    }

    if (observed) {
      console.log('[github-playwright] send-request-observed=' + JSON.stringify(observed));
      return { ...observed, domMarkerObserved: dom.visible };
    }

    dom = await wakeMarkerVisible(page, marker);
    if (dom.visible) {
      const fallback = {
        url: candidateRequests.at(-1)?.url || null,
        method: candidateRequests.at(-1)?.method || null,
        bodyContainsMarker: false,
        domMarkerObserved: true,
        candidateRequests: [...candidateRequests],
        userCount: dom.userCount
      };
      console.log('[github-playwright] send-dom-persisted-without-body-marker=' + JSON.stringify(fallback));
      return fallback;
    }

    throw new BrowserAgentError(
      'SEND_NOT_OBSERVED',
      'No ChatGPT conversation write or durable user-message marker was observed after ordinary pointer/keyboard submission',
      true
    );
  } finally {
    page.off('request', onRequest);
  }
}

async function persistedWakeVisible(page, message) {
  const marker = message.slice(0, Math.min(120, message.length));
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    const state = await wakeMarkerVisible(page, marker);
    if (state.visible) return { persisted: true, userCount: state.userCount };
    await page.waitForTimeout(1000);
  }
  const state = await wakeMarkerVisible(page, marker);
  return { persisted: false, userCount: state.userCount };
}

async function postWithBackendVerification(page, message) {
  const marker = message.slice(0, Math.min(120, message.length));
  let acceptedExact = null;
  const acceptedCandidates = [];

  const onResponse = async response => {
    const request = response.request();
    const method = request.method();
    if (!['POST','PUT','PATCH'].includes(method)) return;
    const postData = request.postData() || '';
    const info = {
      url: response.url(),
      status: response.status(),
      method,
      bodyContainsMarker: postData.includes(marker),
      cfMitigated: await response.headerValue('cf-mitigated').catch(() => null),
      server: await response.headerValue('server').catch(() => null)
    };
    if (info.bodyContainsMarker) acceptedExact = info;
    if (likelyConversationWrite(response.url())) acceptedCandidates.push(info);
  };

  page.on('response', onResponse);
  try {
    const submittedRequest = await post(page, message);
    const deadline = Date.now() + 20000;
    while (Date.now() < deadline && !acceptedExact) {
      const candidateAccepted = submittedRequest.domMarkerObserved &&
        acceptedCandidates.find(item => item.status >= 200 && item.status < 300 && item.cfMitigated !== 'challenge');
      if (candidateAccepted) break;
      await page.waitForTimeout(250);
    }

    const accepted = acceptedExact ||
      (submittedRequest.domMarkerObserved
        ? acceptedCandidates.find(item => item.status >= 200 && item.status < 300 && item.cfMitigated !== 'challenge')
        : null);

    if (!accepted) {
      throw new BrowserAgentError(
        'WRITE_RESPONSE_MISSING',
        'Wake submission was observed but no successful ChatGPT conversation write response was captured; candidates=' + JSON.stringify(acceptedCandidates),
        false
      );
    }
    if (accepted.status < 200 || accepted.status >= 300 || accepted.cfMitigated === 'challenge') {
      throw new BrowserAgentError('WRITE_REJECTED', 'ChatGPT wake write was rejected: ' + JSON.stringify(accepted), false);
    }

    const persisted = await persistedWakeVisible(page, message);
    if (!persisted.persisted) {
      throw new BrowserAgentError('DURABILITY_NOT_OBSERVED', 'Wake write returned success but the user message was not observed in the current DOM', false);
    }

    // VERIFY4 established the success boundary: once the exact write is
    // accepted and the wake is DOM-persisted, post-send health is telemetry only.
    // A later Cloudflare challenge must never retroactively invalidate delivery.
    const passiveState = await snapshot(page).catch(() => null);
    const postSendHealth = null;
    const postSendChallenge = passiveState?.humanChallenge === true;

    const delivery = {
      writeRequestObserved: true,
      writeAccepted: true,
      responseBodyMarkerObserved: accepted.bodyContainsMarker,
      domPersisted: true,
      postSendChallenge,
      postSendHealth,
      response: accepted,
      responseCandidates: acceptedCandidates,
      submittedRequest,
      ...persisted
    };
    console.log('[github-playwright] delivery-state=' + JSON.stringify(delivery));
    return delivery;
  } finally {
    page.off('response', onResponse);
  }
}


async function runWithPage(providerName, connect) {
  const { browser, context, page, close } = await connect();
  try {
    if (mode === 'resume_existing') {
      if (!/^https:\/\/chatgpt\.com\/c\/[A-Za-z0-9_-]+/.test(requestedUrl)) throw new Error('resume_existing requires a chatgpt.com/c/... URL');
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

    await ensureComposer(page);

    let routine = null;
    let routineBefore = [];
    let projectUrl = '';
    if (mode === 'create_fresh' && browserRoutineId) {
      // Project/sidebar operations are only meaningful after the normal
      // ChatGPT UI has cleared any browser challenge and exposed a composer.
      await ensureComposer(page);
      routine = await loadBrowserRoutine(browserRoutineId);
      const skipProjectCreation =
        browserRoutineId === 'audit-lite-reviewer-v1' &&
        projectCreationPolicy === 'skip';

      if (skipProjectCreation) {
        console.warn('[github-playwright] project-create-policy-skip=' + JSON.stringify({
          projectName,
          fallback: 'normal-chat',
        }));
        projectUrl = '';
        routineBefore = [{
          operation: 'chatgpt.ensure_project',
          result: {
            projectName,
            projectUrl: '',
            created: false,
            challenged: true,
            fallback: 'normal-chat',
            policy: 'skip',
          },
        }];
        await ensureComposer(page);
      } else try {
        routineBefore = await runBrowserRoutineStage({
          page,
          routine,
          stage: 'before_message',
          vars: { projectName, chatName: requestedChatName, campaignId: env.CAMPAIGN_ID || '', phaseId: env.PHASE_ID || '' },
        });
        const projectResult = [...routineBefore].reverse().find((entry) => entry?.result?.projectUrl)?.result;
        projectUrl = projectResult?.projectUrl || '';
      } catch (error) {
        const projectChallengeContinuity =
          browserRoutineId === 'audit-lite-reviewer-v1' &&
          error?.code === 'BROWSER_CHALLENGE';

        if (!projectChallengeContinuity) throw error;

        // Cloudflare documents that automated browsers cannot solve production
        // challenges. Do not evade or loop on the challenge. Project placement
        // is orchestration metadata, not an audit-phase evidence requirement, so
        // preserve audit continuity by starting the reviewer in a normal Chat.
        console.warn('[github-playwright] project-create-challenged-fallback=' + JSON.stringify({
          code: error.code,
          projectName,
          fallback: 'normal-chat',
        }));
        projectUrl = '';
        routineBefore = [{
          operation: 'chatgpt.ensure_project',
          result: {
            projectName,
            projectUrl: '',
            created: false,
            challenged: true,
            fallback: 'normal-chat',
          },
        }];
        await page.goto('https://chatgpt.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForTimeout(1200);
        await ensureComposer(page);
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
      const sessionStatePersisted = await persistHealthySession(providerName, context, before);
      const result = { ok: true, provider: providerName, action, wakeId, sessionStatePersisted, ...before };
      await fs.writeFile(statePath, JSON.stringify(result, null, 2) + '\n');
      return result;
    }
    if (before.generating && !bool(env.FORCE_WAKE)) {
      const sessionStatePersisted = await persistHealthySession(providerName, context, before);
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
    if (thinkingEffort) {
      await ensureComposer(page);
      thinkingEffortResult = await executeBrowserOperation({
        page,
        name: 'chatgpt.ensure_thinking_effort',
        args: { level: thinkingEffort },
      });
    }

    const delivery = await postWithBackendVerification(page, wakeMessage);

    // Once submission is verified, never fail over to another browser provider for
    // post-delivery UI bookkeeping. Doing so can create a second reviewer chat.
    let response = null;
    let after = before;
    let routineAfter = [];
    const postDeliveryWarnings = [];
    const projectChallengeFallback = routineBefore.some(entry => entry?.result?.challenged === true);
    if (projectChallengeFallback) {
      postDeliveryWarnings.push({
        code: 'PROJECT_CREATE_CHALLENGED_FALLBACK',
        error: 'ChatGPT Project creation was Cloudflare-challenged; reviewer started in a normal durable chat instead.',
      });
    }
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
          vars: { projectName, chatName: requestedChatName, campaignId: env.CAMPAIGN_ID || '', phaseId: env.PHASE_ID || '' },
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
    const sessionStatePersisted = await persistHealthySession(providerName, context, after);
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
      projectChallengeFallback,
      projectCreationPolicy: projectCreationPolicy || null,
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
  // Explicit bootstrap mode honors the operator's saved login snapshot and
  // does not silently prefer a rolling cache from another browser session.
  let storage = env.CHATGPT_SESSION_STATE_SOURCE === 'bootstrap-secret' ? null : await loadEncryptedSessionState({
    encryptedSessionPath,
    keyB64: sessionStateKeyB64,
  });
  let source = storage ? 'encrypted-cache' : '';
  if (!storage && env.CHATGPT_STORAGE_STATE_B64) {
    try {
      const bootstrap = JSON.parse(Buffer.from(env.CHATGPT_STORAGE_STATE_B64, 'base64').toString('utf8'));
      if (!validateStorageState(bootstrap)) throw new Error('invalid storage state');
      storage = bootstrap;
      source = 'bootstrap-secret';
    } catch {
      throw new Error('CHATGPT_STORAGE_STATE_B64 is invalid');
    }
  }
  if (!storage) throw new Error('No usable ChatGPT storage state is available');
  console.log('[github-playwright] Using ' + source + ' session state');
  const browser = await chromium.launch({ headless: env.BROWSER_HEADLESS !== 'false', channel: 'chrome', args: ['--disable-quic'] });
  const context = await browser.newContext({ storageState: storage });
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

await fs.writeFile(statePath, JSON.stringify({ ok:false, wakeId, failures }, null, 2) + '\n');
console.error(JSON.stringify({ ok:false, wakeId, failures }));
process.exit(1);
