#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { validateStorageState } from './browser-session-state-v1.mjs';

const env = process.env;
const action = env.WAKE_ACTION || 'wake';
const mode = env.WAKE_MODE || 'resume_existing';
const wakeId = env.WAKE_ID || crypto.randomUUID();
const wakeMessage = env.WAKE_MESSAGE || '';
const requestedUrl = env.CHAT_URL || '';
const projectName = env.PROJECT_NAME || '';
const statePath = env.WAKE_RESULT_PATH || '/tmp/browser-agent-wake-result.json';
function sha(text='') {
  return crypto.createHash('sha256').update(text).digest('hex');
}
function bool(v) { return String(v || '').toLowerCase() === 'true'; }

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
  const conversationUnavailable =
    /Unable to load conversation|Conversation not found|Chat not found|This conversation is unavailable/i.test(bodyText);
  const chatViewable =
    /^https:\/\/chatgpt\.com\/c\/[A-Za-z0-9_-]+/.test(currentUrl) &&
    !!composer &&
    !conversationUnavailable;
  return {
    generating: !!stop,
    composerVisible: !!composer,
    conversationUnavailable,
    chatViewable,
    assistantCount: aCount,
    userCount: uCount,
    lastAssistantHash: sha(last),
    lastAssistantLength: last.length,
    url: currentUrl,
  };
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
      if (!confirm) {
        console.log('[github-playwright-v10] chat-idle=' + JSON.stringify({ idle: true, waitedMs: Date.now() - started }));
        return true;
      }
    }
    console.log('[github-playwright-v10] chat-busy-wait=' + JSON.stringify({ waitedMs: Date.now() - started }));
    await page.waitForTimeout(3000);
  }
  throw new Error('Chat remained busy/generating beyond idle wait timeout');
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

  throw new Error(
    'ChatGPT composer not found after 30s' +
    ' (url=' + currentUrl +
    ', title=' + JSON.stringify(title) +
    ', loginPrompt=' + loginPrompt +
    ', humanChallenge=' + humanChallenge +
    ', conversationUnavailable=' + conversationUnavailable +
    ', textareaCount=' + textareaCount +
    ', editableCount=' + editableCount + ')'
  );
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

async function composerDiagnostics(page) {
  return page.evaluate(() => {
    const buttons = [...document.querySelectorAll('button')].slice(-40).map((b, i) => ({
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
      text: (e.innerText || e.value || '').slice(0, 120)
    }));
    return { buttons, editables, url: location.href, title: document.title };
  });
}

function randomDelayMs(minMs, maxMs) {
  const min = Math.ceil(minMs);
  const max = Math.floor(maxMs);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function humanActionPause(page) {
  await page.waitForTimeout(randomDelayMs(300, 1500));
}

async function humanTypingPause(page) {
  await page.waitForTimeout(randomDelayMs(200, 400));
}

async function humanPointerClick(page, locator) {
  await locator.scrollIntoViewIfNeeded().catch(() => {});
  await humanActionPause(page);
  await locator.hover().catch(() => {});
  await humanActionPause(page);
  const box = await locator.boundingBox();
  if (!box) throw new Error('Visible control has no clickable bounding box');
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y, { steps: 12 });
  await humanActionPause(page);
  await page.mouse.down();
  await page.waitForTimeout(randomDelayMs(300, 700));
  await page.mouse.up();
  await humanActionPause(page);
}

async function humanTypeInto(page, locator, text) {
  await humanPointerClick(page, locator);
  const current = await locator.inputValue().catch(async () => {
    return await locator.innerText().catch(() => '');
  });
  if (current) {
    await locator.press('Control+A').catch(async () => locator.press('Meta+A').catch(() => {}));
    await humanActionPause(page);
    await locator.press('Backspace');
    await humanActionPause(page);
  }
  for (const char of String(text)) {
    await locator.pressSequentially(char);
    await humanTypingPause(page);
  }
  await humanActionPause(page);
}

async function ensureSidebarOpenForProject(page) {
  const projects = page.getByText('Projects', { exact: true }).first();
  if (await projects.isVisible().catch(() => false)) return;

  const open = await firstVisible(page, [
    'button[data-testid="open-sidebar-button"]',
    'button[aria-label="Open sidebar"]',
    'button[aria-label*="Open sidebar" i]',
    'button[aria-label*="Show sidebar" i]',
    'button[aria-label*="Toggle sidebar" i]'
  ]);
  if (!open) throw new Error('Visible sidebar-open control was not found');
  await humanPointerClick(page, open);
  await humanActionPause(page);

  if (!await projects.isVisible().catch(() => false)) {
    throw new Error('Projects section is not visible after opening the sidebar');
  }
}

async function findProjectsPlusAfterHover(page, projects) {
  let region = projects;
  for (let depth = 0; depth < 4; depth += 1) {
    region = region.locator('xpath=..');
    const candidates = region.locator('button, [role="button"]');
    const count = Math.min(await candidates.count().catch(() => 0), 12);
    for (let i = 0; i < count; i += 1) {
      const candidate = candidates.nth(i);
      if (!await candidate.isVisible().catch(() => false)) continue;
      const attrs = [
        await candidate.innerText().catch(() => ''),
        await candidate.getAttribute('aria-label').catch(() => ''),
        await candidate.getAttribute('title').catch(() => ''),
        await candidate.getAttribute('data-testid').catch(() => ''),
        await candidate.evaluate(el => el.outerHTML.slice(0, 900)).catch(() => '')
      ].filter(Boolean).join(' ');
      const looksOverflow = /more|overflow|menu|options|ellipsis|\.\.\.|⋯/i.test(attrs);
      const looksPlus = /add|plus|create|new|M12 5v14|M5 12h14|<line[^>]+x1=["']12["'][^>]+y1=["']5/i.test(attrs);
      if (!looksOverflow && looksPlus) return candidate;
    }
  }
  return null;
}

async function createProjectExactHumanFlow(page, name) {
  if (!name) throw new Error('PROJECT_NAME is required for project_wake');

  await ensureSidebarOpenForProject(page);
  await humanActionPause(page);

  const projects = page.getByText('Projects', { exact: true }).first();
  if (!await projects.isVisible().catch(() => false)) {
    throw new Error('Visible Projects section title was not found');
  }

  await projects.hover();
  await humanActionPause(page);

  const plus = await findProjectsPlusAfterHover(page, projects);
  if (!plus) throw new Error('Plus control did not appear to the right of Projects after hover');
  await humanPointerClick(page, plus);

  const input = await firstVisible(page, [
    '[role="dialog"] input[placeholder*="Project name" i]',
    '[role="dialog"] input[aria-label*="Project name" i]',
    '[role="dialog"] input[name="name"]',
    '[role="dialog"] input'
  ]);
  if (!input) throw new Error('Project-name input was not found in the visible Project dialog');
  await humanTypeInto(page, input, name);

  const create = await firstVisible(page, [
    '[role="dialog"] button:has-text("Create project")',
    '[role="dialog"] button:has-text("Create Project")'
  ]);
  if (!create) throw new Error('Create Project button was not found in the visible dialog');
  await humanPointerClick(page, create);

  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    const title = await page.title().catch(() => '');
    const bodyText = await page.locator('body').innerText().catch(() => '');
    const visible = visibleBrowserStateText(bodyText, title);
    if (visible.humanChallenge) {
      const error = new Error('BROWSER_CHALLENGE: visible ChatGPT/Cloudflare verification detected after Project creation; aborting immediately');
      error.code = 'BROWSER_CHALLENGE';
      throw error;
    }

    const projectNameVisible = await page.getByText(name, { exact: true }).first().isVisible().catch(() => false);
    const composer = await firstVisible(page, [
      '#prompt-textarea',
      'textarea[placeholder*="Message"]',
      '[contenteditable="true"][data-lexical-editor="true"]',
      '[contenteditable="true"]'
    ]);
    if (projectNameVisible && composer) {
      console.log('[github-playwright-v10] project-created-visible=' + JSON.stringify({ projectName: name, url: page.url() }));
      return { projectName: name, url: page.url() };
    }
    await page.waitForTimeout(750);
  }
  throw new Error('Created Project did not become visibly ready with a composer within 60 seconds');
}

async function fillComposer(page, message) {
  const composer = await ensureComposer(page);
  await humanTypeInto(page, composer, message);
  return composer;
}

async function post(page, message) {
  if (!message) throw new Error('Wake message is empty');

  const marker = message.slice(0, Math.min(120, message.length));
  const requestedIdleWait = Number.parseInt(env.IDLE_WAIT_MS || '600000', 10);
  const idleWaitMs = Number.isFinite(requestedIdleWait) ? Math.max(30000, requestedIdleWait) : 600000;

  // Human-only interaction: wait until the visible chat is idle, type through keyboard
  // events, and click the visible Send control with pointer movement.
  await waitForChatIdle(page, idleWaitMs);
  const composer = await fillComposer(page, message);
  const diagnostics = await composerDiagnostics(page);
  console.log('[github-playwright-v10] composer-diagnostics=' + JSON.stringify(diagnostics));

  const send = await firstVisible(page, [
    'button[data-testid="send-button"]',
    'button[data-testid="composer-submit-button"]',
    'button[aria-label="Send prompt"]',
    'button[aria-label="Send"]',
    'button[aria-label*="Send"]'
  ]);
  if (!send) throw new Error('No visible Send button for normal human-style click');

  const composerText = await composer.inputValue().catch(async () => {
    return await composer.innerText().catch(() => '');
  });
  if (!composerText.includes(marker)) {
    throw new Error('Wake marker is not visibly present in the composer before Send');
  }

  console.log('[github-playwright-v10] send-strategy=human-pointer-click');
  await humanPointerClick(page, send, { hoverMs: 220, downMs: 75, settleMs: 500 });
  return { strategy: 'human-pointer-click' };
}

function visibleBrowserStateText(bodyText = '', title = '') {
  return {
    loginPrompt: /\bLog in\b|\bSign up\b|Continue with Google|Welcome back/i.test(bodyText),
    humanChallenge:
      /Verify you are human|Checking your browser|Just a moment|Cloudflare|security challenge/i.test(bodyText) ||
      /Just a moment|Cloudflare/i.test(title),
    conversationUnavailable:
      /Unable to load conversation|Conversation not found|Chat not found|This conversation is unavailable/i.test(bodyText)
  };
}

async function waitForVisibleBrowserReady(page) {
  const requested = Number.parseInt(env.MANUAL_CHALLENGE_WAIT_MS || '0', 10);
  const waitMs = Number.isFinite(requested) ? Math.max(0, requested) : 0;
  const deadline = Date.now() + waitMs;

  while (true) {
    const title = await page.title().catch(() => '');
    const bodyText = await page.locator('body').innerText().catch(() => '');
    const visible = visibleBrowserStateText(bodyText, title);
    const composer = await firstVisible(page, [
      '#prompt-textarea',
      'textarea[placeholder*="Message"]',
      '[contenteditable="true"][data-lexical-editor="true"]',
      '[contenteditable="true"]'
    ]);

    console.log('[github-playwright-v10] visible-browser-ready=' + JSON.stringify({
      ready: Boolean(composer) && !visible.loginPrompt && !visible.humanChallenge && !visible.conversationUnavailable,
      ...visible,
      composerVisible: Boolean(composer),
      url: page.url()
    }));

    if (visible.humanChallenge) {
      const error = new Error('BROWSER_CHALLENGE: visible ChatGPT/Cloudflare verification detected; aborting immediately');
      error.code = 'BROWSER_CHALLENGE';
      throw error;
    }
    if (composer && !visible.loginPrompt && !visible.conversationUnavailable) return true;
    if (Date.now() >= deadline) {
      throw new Error('ChatGPT visible browser state did not become ready within the configured 5-minute wait');
    }

    if (bool(env.INTERACTIVE_VIEW_ENABLED)) {
      console.log('[github-playwright-v10] Visible browser is not ready; waiting only for ordinary UI/login readiness. Cloudflare challenge would abort immediately.');
    }
    await page.waitForTimeout(5000);
  }
}

function chatRouteInfo(value) {
  try {
    const url = new URL(value);
    if (url.origin !== 'https://chatgpt.com') return { isChat: false, isLocal: false, id: '' };
    const match = url.pathname.match(/^\/c\/([^/]+)\/?$/);
    if (!match) return { isChat: false, isLocal: false, id: '' };
    const id = decodeURIComponent(match[1]);
    return {
      isChat: Boolean(id),
      isLocal: id.startsWith('local-chatgpt:'),
      id
    };
  } catch {
    return { isChat: false, isLocal: false, id: '' };
  }
}

async function visibleWakePresent(page, message, timeoutMs = 90000) {
  const deadline = Date.now() + timeoutMs;
  let last = null;

  while (Date.now() < deadline) {
    const users = page.locator('[data-message-author-role="user"]');
    const userCount = await users.count().catch(() => 0);
    for (let i = Math.max(0, userCount - 8); i < userCount; i += 1) {
      const text = await users.nth(i).innerText().catch(() => '');
      if (text.includes(message)) {
        return { visible: true, userCount, method: 'user-role' };
      }
    }

    const composer = await firstVisible(page, [
      '#prompt-textarea',
      'textarea[placeholder*="Message"]',
      '[contenteditable="true"][data-lexical-editor="true"]',
      '[contenteditable="true"]'
    ]);
    const composerText = composer
      ? await composer.inputValue().catch(async () => await composer.innerText().catch(() => ''))
      : '';
    const bodyText = await page.locator('body').innerText().catch(() => '');
    const bodyHasMessage = bodyText.includes(message);
    const composerHasMessage = composerText.includes(message);

    last = {
      visible: bodyHasMessage && !composerHasMessage,
      userCount,
      method: bodyHasMessage && !composerHasMessage ? 'rendered-page-text' : 'not-visible',
      bodyHasMessage,
      composerHasMessage,
      url: page.url()
    };
    if (last.visible) return last;

    await page.waitForTimeout(750);
  }

  return last || {
    visible: false,
    userCount: 0,
    method: 'not-visible',
    bodyHasMessage: false,
    composerHasMessage: false,
    url: page.url()
  };
}

async function waitForFreshChatRoute(page, timeoutMs = 90000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const current = page.url();
    const info = chatRouteInfo(current);
    if (info.isChat) return { url: current, ...info };
    await page.waitForTimeout(500);
  }
  throw new Error('Fresh chat did not visibly navigate to a chatgpt.com/c/... route');
}

async function waitForDurableChatRoute(page, timeoutMs = 300000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const title = await page.title().catch(() => '');
    const bodyText = await page.locator('body').innerText().catch(() => '');
    const visible = visibleBrowserStateText(bodyText, title);
    if (visible.humanChallenge) {
      const error = new Error('BROWSER_CHALLENGE: visible ChatGPT/Cloudflare verification detected while waiting for durable chat URL; aborting immediately');
      error.code = 'BROWSER_CHALLENGE';
      throw error;
    }

    const current = page.url();
    const info = chatRouteInfo(current);
    if (info.isChat && !info.isLocal) {
      console.log('[github-playwright-v10] durable-chat-route=' + JSON.stringify({ url: current }));
      return { url: current, ...info };
    }
    await page.waitForTimeout(500);
  }
  throw new Error('Fresh chat remained on an optimistic/local route beyond the 5-minute durable-route timeout');
}

async function humanReload(page) {
  console.log('[github-playwright-v10] verification-reload=human-keyboard-control-r');
  await page.keyboard.press('Control+R');
  await page.waitForLoadState('domcontentloaded', { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(1500);
}

function recoverySearchMarker(message) {
  const text = String(message || '').trim();
  const bracket = text.match(/^\[[^\]]{6,180}\]/);
  return bracket ? bracket[0] : text.slice(0, 120);
}

async function recoverCreatedChatByVisibleSearch(page, message) {
  if (!message) throw new Error('recover action requires the original wake message');
  const marker = recoverySearchMarker(message);
  if (!marker) throw new Error('recover action could not derive a visible search marker');

  const filter = await firstVisible(page, [
    'button[aria-label="Filter chats and work"]',
    '[role="button"][aria-label="Filter chats and work"]',
    'button[aria-label*="Filter chats" i]',
    'button[aria-label*="Search chats" i]',
    'button[aria-label*="Search" i]'
  ]);
  if (!filter) throw new Error('Visible ChatGPT chat-search control was not found');
  await humanPointerClick(page, filter, { hoverMs: 180, downMs: 65, settleMs: 420 });

  const searchInput = await firstVisible(page, [
    '[role="dialog"] input[placeholder*="Search" i]',
    '[role="dialog"] input[aria-label*="Search" i]',
    'input[placeholder*="Search" i]',
    'input[aria-label*="Search" i]',
    '[role="searchbox"]'
  ]);
  if (!searchInput) throw new Error('Visible ChatGPT chat-search input was not found');
  await humanTypeInto(page, searchInput, marker, { delay: 45 });

  const normalizedMarker = marker.replace(/\s+/g, ' ').trim();
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    const title = await page.title().catch(() => '');
    const bodyText = await page.locator('body').innerText().catch(() => '');
    const visible = visibleBrowserStateText(bodyText, title);
    if (visible.humanChallenge) {
      const error = new Error('BROWSER_CHALLENGE: visible ChatGPT/Cloudflare verification detected during read-only chat recovery; aborting immediately');
      error.code = 'BROWSER_CHALLENGE';
      throw error;
    }

    const candidates = page.locator(
      '[role="dialog"] a, [role="dialog"] button, [role="option"], a[href^="/c/"], a[href*="chatgpt.com/c/"]'
    );
    const count = Math.min(await candidates.count().catch(() => 0), 120);
    for (let i = 0; i < count; i += 1) {
      const candidate = candidates.nth(i);
      if (!await candidate.isVisible().catch(() => false)) continue;
      const text = [
        await candidate.innerText().catch(() => ''),
        await candidate.getAttribute('aria-label').catch(() => ''),
        await candidate.getAttribute('title').catch(() => '')
      ].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
      if (!text.includes(normalizedMarker)) continue;

      await humanPointerClick(page, candidate, { hoverMs: 180, downMs: 65, settleMs: 650 });
      const route = await waitForDurableChatRoute(page, 300000);
      const wake = await visibleWakePresent(page, message, 30000);
      if (!wake.visible) {
        throw new Error('Recovered chat URL did not visibly contain the exact original wake message');
      }

      console.log('[github-playwright-v10] recovered-created-chat=' + JSON.stringify({
        chatUrl: route.url,
        verificationMethod: wake.method
      }));
      return { recovered: true, chatUrl: route.url, verificationMethod: wake.method, userCount: wake.userCount };
    }

    await page.waitForTimeout(750);
  }

  throw new Error('No visible ChatGPT search result matched the unique wake marker within 30 seconds');
}

async function postWithVisibleVerification(page, message) {
  const submitted = await post(page, message);

  let initialRoute = { url: page.url(), ...chatRouteInfo(page.url()) };
  if (mode === 'create_fresh') {
    initialRoute = await waitForFreshChatRoute(page, 90000);
  } else if (!initialRoute.isChat) {
    throw new Error('Existing-chat send is not on a visible chatgpt.com/c/... route');
  }

  const beforeReload = await visibleWakePresent(page, message, 90000);
  console.log('[github-playwright-v10] visible-wake-before-reload=' + JSON.stringify({
    ...beforeReload,
    chatUrl: initialRoute.url,
    localRoute: initialRoute.isLocal
  }));
  if (!beforeReload.visible) {
    throw new Error('Sent wake is not visibly present in the rendered conversation before reload');
  }

  // Never reload an optimistic local-chatgpt route. Wait for the normal UI
  // to transition to a durable server-backed /c/<id> route first.
  if (initialRoute.isLocal) {
    initialRoute = await waitForDurableChatRoute(page, 300000);
  }

  await humanReload(page);
  await waitForVisibleBrowserReady(page);

  const reloadedRoute = { url: page.url(), ...chatRouteInfo(page.url()) };
  if (!reloadedRoute.isChat || reloadedRoute.isLocal) {
    throw new Error('Human-style reload did not return to a durable chatgpt.com/c/... conversation');
  }

  const afterReload = await visibleWakePresent(page, message, 90000);
  console.log('[github-playwright-v10] visible-wake-after-reload=' + JSON.stringify({
    ...afterReload,
    chatUrl: reloadedRoute.url,
    localRoute: reloadedRoute.isLocal
  }));
  if (!afterReload.visible) {
    throw new Error('Wake is not visibly present after human-style reload of the conversation');
  }

  return {
    ...submitted,
    persisted: true,
    userCount: afterReload.userCount,
    verificationMethod: afterReload.method,
    chatUrl: reloadedRoute.url,
    localRoute: reloadedRoute.isLocal
  };
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

    await waitForVisibleBrowserReady(page);

    let project = null;
    if (action === 'project_wake') {
      if (mode !== 'create_fresh') throw new Error('project_wake requires create_fresh mode');
      project = await createProjectExactHumanFlow(page, projectName);
      await waitForVisibleBrowserReady(page);
    }

    const before = await snapshot(page);

    if (action === 'observe') {
      const sessionStatePersisted = false;
      const result = { ok: true, provider: providerName, action, wakeId, sessionStatePersisted, ...before };
      await fs.writeFile(statePath, JSON.stringify(result, null, 2) + '\n');
      return result;
    }

    if (action === 'recover') {
      const recovered = await recoverCreatedChatByVisibleSearch(page, wakeMessage);
      const after = await snapshot(page);
      const sessionStatePersisted = false;
      const result = {
        ok: true,
        provider: providerName,
        action,
        wakeId,
        posted: false,
        recovered: true,
        sessionStatePersisted,
        before,
        after,
        chatUrl: recovered.chatUrl,
        verification: 'visible-browser-only',
        verificationMethod: recovered.verificationMethod
      };
      await fs.writeFile(statePath, JSON.stringify(result, null, 2) + '\n');
      return result;
    }
    if (before.generating && !bool(env.FORCE_WAKE)) {
      const requestedIdleWait = Number.parseInt(env.IDLE_WAIT_MS || '600000', 10);
      const idleWaitMs = Number.isFinite(requestedIdleWait) ? Math.max(30000, requestedIdleWait) : 600000;
      console.log('[github-playwright-v10] Chat is currently generating; waiting for idle before wake send.');
      await waitForChatIdle(page, idleWaitMs);
      await waitForVisibleBrowserReady(page);
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

    const verifiedSend = await postWithVisibleVerification(page, wakeMessage);

    let response = null;
    let after;
    if (action === 'wake_and_wait') {
      const requestedWait = Number.parseInt(env.RESPONSE_WAIT_MS || '120000', 10);
      const responseWaitMs = Number.isFinite(requestedWait) ? Math.max(120000, requestedWait) : 120000;
      response = await waitForAssistantResponse(page, before, responseWaitMs);
      after = response.snapshot;
    } else {
      await page.waitForTimeout(1500);
      after = await snapshot(page);
    }

    if (mode === 'create_fresh') {
      after.url = verifiedSend.chatUrl;
    }

    const sessionStatePersisted = false;
    const result = {
      ok: true, provider: providerName, action, wakeId, posted: true, before, after, sessionStatePersisted,
      chatUrl: verifiedSend.chatUrl || after.url,
      verification: 'visible-browser-only',
      ...(project ? { projectName: project.projectName, projectUrl: project.url } : {}),
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
  console.log('[github-playwright-v10] Using immutable bootstrap-secret session state; run state will be discarded.');
  const launchOptions = {
    headless: env.BROWSER_HEADLESS !== 'false',
    channel: 'chrome',
    args: ['--disable-quic']
  };
  console.log('[github-playwright-v10] Chrome uses runner system routing; QUIC disabled so ChatGPT web traffic stays on TCP.');
  const browser = await chromium.launch(launchOptions);
  const context = await browser.newContext({ storageState: storage });
  const page = await context.newPage();
  return { browser, context, page, close: () => browser.close() };
}

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
    failures.push({ provider: name, error: error.message });
    console.error('[' + name + '] ' + error.message);
  }
}
await fs.writeFile(statePath, JSON.stringify({ ok:false, wakeId, failures }, null, 2) + '\n');
console.error(JSON.stringify({ ok:false, wakeId, failures }));
process.exit(1);
