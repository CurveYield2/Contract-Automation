#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';
import { validateStorageState } from './browser-session-state-v1.mjs';

const env = process.env;
const action = env.WAKE_ACTION || 'wake';
const mode = env.WAKE_MODE || 'resume_existing';
const wakeId = env.WAKE_ID || crypto.randomUUID();
const wakeMessage = env.WAKE_MESSAGE || '';
const requestedUrl = env.CHAT_URL || '';
const projectName = env.PROJECT_NAME || '';
const requestedProjectUrl = env.PROJECT_URL || '';
const recoveryChatTitle = env.RECOVERY_CHAT_TITLE || '';
const statePath = env.WAKE_RESULT_PATH || '/tmp/browser-agent-wake-result.json';
const chatStatePath = env.CHAT_STATE_PATH || '/tmp/browser-agent-home-exit-v10-chat-state-v1.json';
const execFile = promisify(execFileCallback);
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
  const humanChallenge = visibleHumanChallenge(bodyText, title);
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

async function visibleTitlePoint(locator, horizontalFraction) {
  await locator.scrollIntoViewIfNeeded().catch(() => {});
  const box = await locator.boundingBox();
  if (!box) throw new Error('Visible Project title has no clickable bounding box');

  const fraction = Math.max(0.18, Math.min(horizontalFraction, 0.82));
  return {
    x: box.x + Math.max(8, Math.min(box.width - 8, box.width * fraction)),
    y: box.y + box.height / 2,
    fraction
  };
}

async function humanShortTitleClick(page, locator, horizontalFraction = 0.32) {
  const point = await visibleTitlePoint(locator, horizontalFraction);
  await page.mouse.move(point.x, point.y, { steps: 14 });
  await page.mouse.down();
  await page.waitForTimeout(randomDelayMs(70, 140));
  await page.mouse.up();
  console.log('[github-playwright-v10] project-title-gesture=' + JSON.stringify({
    gesture: 'short-click',
    x: Math.round(point.x),
    y: Math.round(point.y),
    fraction: Number(point.fraction.toFixed(2))
  }));
}

async function humanDoubleTitleClick(page, locator, horizontalFraction = 0.5) {
  const point = await visibleTitlePoint(locator, horizontalFraction);
  await page.mouse.move(point.x, point.y, { steps: 12 });

  // Chromium only emits genuine double-click semantics when the second physical
  // click carries clickCount=2. Keep the two presses human-paced while preserving
  // that browser event detail.
  await page.mouse.down({ clickCount: 1 });
  await page.waitForTimeout(randomDelayMs(70, 130));
  await page.mouse.up({ clickCount: 1 });
  await page.waitForTimeout(randomDelayMs(100, 220));
  await page.mouse.down({ clickCount: 2 });
  await page.waitForTimeout(randomDelayMs(70, 130));
  await page.mouse.up({ clickCount: 2 });

  console.log('[github-playwright-v10] project-title-gesture=' + JSON.stringify({
    gesture: 'double-click',
    clickCountSequence: [1, 2],
    x: Math.round(point.x),
    y: Math.round(point.y),
    fraction: Number(point.fraction.toFixed(2))
  }));
}

async function humanLongTitleClick(page, locator, horizontalFraction = 0.68) {
  const point = await visibleTitlePoint(locator, horizontalFraction);
  await page.mouse.move(point.x, point.y, { steps: 14 });
  await page.mouse.down();
  await page.waitForTimeout(randomDelayMs(550, 900));
  await page.mouse.up();
  console.log('[github-playwright-v10] project-title-gesture=' + JSON.stringify({
    gesture: 'long-click',
    x: Math.round(point.x),
    y: Math.round(point.y),
    fraction: Number(point.fraction.toFixed(2))
  }));
}

async function runProjectTitleClickSequence(page, locator, beforeUrl) {
  await humanShortTitleClick(page, locator, 0.32);
  await page.waitForTimeout(randomDelayMs(100, 300));
  let projectUrl = page.url();
  if (projectUrl !== beforeUrl) return projectUrl;

  await humanDoubleTitleClick(page, locator, 0.5);
  await page.waitForTimeout(randomDelayMs(100, 300));
  projectUrl = page.url();
  if (projectUrl !== beforeUrl) return projectUrl;

  await humanLongTitleClick(page, locator, 0.68);
  await page.waitForTimeout(randomDelayMs(100, 300));
  projectUrl = page.url();
  if (projectUrl !== beforeUrl) return projectUrl;

  // Allow the final long click a short navigation-settle window before failing.
  await page.waitForTimeout(randomDelayMs(2500, 4500));
  return page.url();
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

async function visibleChromeWindowId() {
  const { stdout } = await execFile('xdotool', ['search', '--onlyvisible', '--class', 'google-chrome']);
  const ids = String(stdout || '').trim().split(/\s+/).filter(Boolean);
  if (!ids.length) {
    throw new Error('Visible headed Chrome window was not found for human address navigation');
  }
  return ids[ids.length - 1];
}

async function humanOsKey(page, windowId, key) {
  await humanActionPause(page);
  await execFile('xdotool', ['windowfocus', '--sync', windowId]);
  await humanActionPause(page);
  await execFile('xdotool', ['key', '--window', windowId, '--clearmodifiers', key]);
  await humanActionPause(page);
}

async function humanAddressNavigate(page, targetUrl) {
  const parsed = new URL(targetUrl);
  if (parsed.origin !== 'https://chatgpt.com') {
    throw new Error('Human address navigation only accepts chatgpt.com URLs');
  }

  // Playwright page.keyboard targets the webpage renderer and cannot reliably
  // focus Chrome's omnibox. Use real X11 keyboard events against the visible
  // headed Chrome window: focus window -> Ctrl+L -> type URL -> Enter.
  const windowId = await visibleChromeWindowId();
  await humanOsKey(page, windowId, 'ctrl+l');

  const perCharacterDelayMs = randomDelayMs(200, 400);
  await execFile('xdotool', [
    'type',
    '--window', windowId,
    '--clearmodifiers',
    '--delay', String(perCharacterDelayMs),
    String(targetUrl)
  ]);
  await humanActionPause(page);
  await execFile('xdotool', ['key', '--window', windowId, '--clearmodifiers', 'Return']);

  await page.waitForLoadState('domcontentloaded', { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(randomDelayMs(3000, 5000));
  console.log('[github-playwright-v10] human-address-navigation=' + JSON.stringify({
    targetUrl,
    method: 'visible-x11-keyboard',
    perCharacterDelayMs
  }));
}

async function findVisibleSidebarSurface(page) {
  const candidates = page.locator('nav, aside, [data-testid*="sidebar" i], [class*="sidebar" i]');
  const count = Math.min(await candidates.count().catch(() => 0), 40);
  for (let i = 0; i < count; i += 1) {
    const candidate = candidates.nth(i);
    if (!await candidate.isVisible().catch(() => false)) continue;
    const box = await candidate.boundingBox().catch(() => null);
    if (!box) continue;
    if (box.x <= 420 && box.width <= 520 && box.height >= 280) return candidate;
  }
  return null;
}

async function humanScrollSidebarForProjects(page) {
  const projects = page.getByText('Projects', { exact: true }).first();
  if (await projects.isVisible().catch(() => false)) return projects;

  const sidebar = await findVisibleSidebarSurface(page);
  if (!sidebar) return null;

  await sidebar.hover().catch(() => {});
  await humanActionPause(page);

  // A person can arrive with the sidebar scrolled anywhere. First move toward
  // the top, then scan downward until the Projects title appears.
  for (let i = 0; i < 4; i += 1) {
    await page.mouse.wheel(0, -randomDelayMs(500, 900));
    await humanActionPause(page);
    if (await projects.isVisible().catch(() => false)) return projects;
  }
  for (let i = 0; i < 14; i += 1) {
    await page.mouse.wheel(0, randomDelayMs(350, 700));
    await humanActionPause(page);
    if (await projects.isVisible().catch(() => false)) return projects;
  }
  return null;
}

async function ensureSidebarOpenForProject(page) {
  const projects = page.getByText('Projects', { exact: true }).first();
  if (await projects.isVisible().catch(() => false)) return projects;

  const open = await firstVisible(page, [
    'button[data-testid="open-sidebar-button"]',
    'button[data-testid="sidebar-toggle-button"]',
    'button[aria-label="Open sidebar"]',
    'button[aria-label="Toggle sidebar"]',
    'button[aria-label*="Open sidebar" i]',
    'button[aria-label*="Show sidebar" i]',
    'button[aria-label*="sidebar" i]',
    '[role="button"][aria-label*="sidebar" i]',
    '[data-testid*="sidebar"][role="button"]',
    'button[title*="sidebar" i]'
  ]);

  // If the explicit open control is absent, do not assume failure: the sidebar
  // may already be open with Projects simply below the fold.
  if (open) {
    await humanPointerClick(page, open);
    await humanActionPause(page);
  }

  const found = await humanScrollSidebarForProjects(page);
  if (!found) {
    throw new Error('Projects section could not be found after opening/scrolling the visible sidebar');
  }
  return found;
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
        await candidate.getAttribute('data-testid').catch(() => '')
      ].filter(Boolean).join(' ');
      const looksOverflow = /more|overflow|menu|options|ellipsis|\.\.\.|⋯/i.test(attrs);
      const looksPlus = /add|plus|create|new|M12 5v14|M5 12h14|<line[^>]+x1=["']12["'][^>]+y1=["']5/i.test(attrs);
      if (!looksOverflow && looksPlus) return candidate;
    }
  }
  return null;
}

async function findVisibleProjectCreateButton(page) {
  const buttons = page.getByRole('button', { name: /^Create project$/i });
  const count = Math.min(await buttons.count().catch(() => 0), 8);
  for (let i = 0; i < count; i += 1) {
    const button = buttons.nth(i);
    if (await button.isVisible().catch(() => false)) return button;
  }

  // Visible-text fallback for UI variants whose Create project control is not
  // exposed with button semantics. Clicking the visible label is still a normal
  // human pointer action on the rendered control.
  const labels = page.getByText(/^Create project$/i, { exact: true });
  const labelCount = Math.min(await labels.count().catch(() => 0), 8);
  for (let i = 0; i < labelCount; i += 1) {
    const label = labels.nth(i);
    if (await label.isVisible().catch(() => false)) return label;
  }
  return null;
}

async function findEnabledProjectCreateButton(page, timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const buttons = page.getByRole('button', { name: /^Create project$/i });
    const count = Math.min(await buttons.count().catch(() => 0), 8);
    for (let i = 0; i < count; i += 1) {
      const button = buttons.nth(i);
      const visible = await button.isVisible().catch(() => false);
      const enabled = visible ? await button.isEnabled().catch(() => false) : false;
      if (visible && enabled) return button;
    }

    const labels = page.getByText(/^Create project$/i, { exact: true });
    const labelCount = Math.min(await labels.count().catch(() => 0), 8);
    for (let i = 0; i < labelCount; i += 1) {
      const label = labels.nth(i);
      if (!await label.isVisible().catch(() => false)) continue;
      const button = label.locator('xpath=ancestor-or-self::button[1]');
      const visible = await button.isVisible().catch(() => false);
      const enabled = visible ? await button.isEnabled().catch(() => false) : false;
      if (visible && enabled) return button;
    }

    await page.waitForTimeout(500);
  }
  return null;
}

async function findProjectNameEditorFromVisibleCreateSurface(page) {
  const create = await findVisibleProjectCreateButton(page);
  if (!create) return { create: null, editor: null };

  const labelled = page.getByLabel(/^Project name$/i).first();
  if (await labelled.isVisible().catch(() => false)) {
    return { create, editor: labelled };
  }

  // Anchor the editor to the visible Create-project surface itself. This avoids
  // accidentally selecting the dimmed homepage composer behind the modal and
  // does not assume the editor is an <input> or that the surface has role=dialog.
  let region = create;
  for (let depth = 0; depth < 6; depth += 1) {
    region = region.locator('xpath=..');

    const textboxes = region.getByRole('textbox');
    const textboxCount = Math.min(await textboxes.count().catch(() => 0), 8);
    for (let i = 0; i < textboxCount; i += 1) {
      const candidate = textboxes.nth(i);
      if (await candidate.isVisible().catch(() => false)) {
        return { create, editor: candidate };
      }
    }

    const editable = region.locator('input, textarea, [contenteditable="true"]');
    const editableCount = Math.min(await editable.count().catch(() => 0), 8);
    for (let i = 0; i < editableCount; i += 1) {
      const candidate = editable.nth(i);
      if (await candidate.isVisible().catch(() => false)) {
        return { create, editor: candidate };
      }
    }
  }

  return { create, editor: null };
}

function escapeRegExp(text) {
  const specials = '\\^$.*+?()[]{}|';
  let escaped = '';
  for (const char of String(text)) {
    escaped += specials.includes(char) ? '\\' + char : char;
  }
  return escaped;
}

async function findProjectLandingComposer(page, name) {
  const cue = 'New chat in ' + name;
  const cuePattern = new RegExp('^' + escapeRegExp(cue) + '$', 'i');

  // Use the exact human-visible Project-specific new-chat cue shown on the
  // Project landing page. Never infer Project context from the homepage composer.
  const placeholderComposer = page.getByPlaceholder(cuePattern).first();
  if (await placeholderComposer.isVisible().catch(() => false)) return placeholderComposer;

  const visibleCue = page.getByText(cuePattern, { exact: true }).first();
  if (!await visibleCue.isVisible().catch(() => false)) return null;

  let region = visibleCue;
  for (let depth = 0; depth < 6; depth += 1) {
    region = region.locator('xpath=..');

    const textboxes = region.getByRole('textbox');
    const textboxCount = Math.min(await textboxes.count().catch(() => 0), 8);
    for (let i = 0; i < textboxCount; i += 1) {
      const candidate = textboxes.nth(i);
      if (await candidate.isVisible().catch(() => false)) return candidate;
    }

    const editables = region.locator('textarea, [contenteditable="true"]');
    const editableCount = Math.min(await editables.count().catch(() => 0), 8);
    for (let i = 0; i < editableCount; i += 1) {
      const candidate = editables.nth(i);
      if (await candidate.isVisible().catch(() => false)) return candidate;
    }
  }

  return null;
}

function savedProjectIdentity(value) {
  try {
    const url = new URL(value);
    if (url.origin !== 'https://chatgpt.com') return '';
    const match = url.pathname.match(/^\/g\/(g-p-[A-Za-z0-9]+)(?:-[^/]+)?(?:\/project)?\/?$/);
    return match?.[1] || '';
  } catch {
    return '';
  }
}

function validSavedProjectUrl(value) {
  return Boolean(savedProjectIdentity(value));
}

async function openSavedProjectUrl(page, name, projectUrl) {
  if (!projectUrl) return null;
  const expectedProjectIdentity = savedProjectIdentity(projectUrl);
  if (!expectedProjectIdentity) {
    throw new Error('Persisted Project URL is not a valid ChatGPT Project URL');
  }

  // Direct recovery stays on the exact saved Project URL, but navigation itself
  // must look like normal human browser use. A prior merged run showed that
  // repeated programmatic jumps can provoke a visible Cloudflare challenge.
  const maxAttempts = 3;
  const observations = [];

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    await humanAddressNavigate(page, projectUrl);

    const settleDeadline = Date.now() + 20000;
    while (Date.now() < settleDeadline) {
      const currentProjectUrl = page.url();
      const currentProjectIdentity = savedProjectIdentity(currentProjectUrl);
      const title = await page.title().catch(() => '');
      const bodyText = await page.locator('body').innerText().catch(() => '');
      const visible = visibleBrowserStateText(bodyText, title);

      if (visible.humanChallenge) {
        console.log('[github-playwright-v10] project-navigation-challenge=' + JSON.stringify({
          url: currentProjectUrl,
          title,
          evidence: visibleHumanChallengeEvidence(bodyText, title)
        }));
        const error = new Error('BROWSER_CHALLENGE: visible ChatGPT/Cloudflare verification detected while opening saved Project URL; aborting immediately');
        error.code = 'BROWSER_CHALLENGE';
        throw error;
      }

      if (currentProjectIdentity === expectedProjectIdentity) {
        const composer = await findProjectLandingComposer(page, name);
        if (composer) {
          console.log('[github-playwright-v10] project-reused-saved-url=' + JSON.stringify({
            projectName: name,
            url: currentProjectUrl,
            projectIdentity: currentProjectIdentity,
            attempt
          }));
          return { projectName: name, url: currentProjectUrl, composer, recoveredExisting: true, reusedSavedUrl: true };
        }
      }

      await page.waitForTimeout(1000);
    }

    const observedUrl = page.url();
    observations.push({ attempt, observedUrl });
    console.log('[github-playwright-v10] project-saved-url-retry=' + JSON.stringify({
      attempt,
      maxAttempts,
      expectedProjectIdentity,
      observedUrl
    }));

    if (attempt < maxAttempts) {
      // Let the visible signed-in homepage fully settle before a person tries
      // the same address again. Challenge detection remains fail-closed.
      await waitForVisibleBrowserReady(page);
      await page.waitForTimeout(randomDelayMs(12000, 20000));
    }
  }

  throw new Error(
    'Persisted Project URL did not open the expected ChatGPT Project page after human direct retries' +
    ' (observations=' + JSON.stringify(observations) + ')'
  );
}

async function findVisibleExactProjectEntry(page, projectsTitle, name) {
  const projectsBox = await projectsTitle.boundingBox().catch(() => null);
  if (!projectsBox) return null;

  const namePattern = new RegExp('^' + escapeRegExp(name) + '$', 'i');
  const matches = page.getByText(namePattern, { exact: true });
  const count = Math.min(await matches.count().catch(() => 0), 20);

  for (let i = 0; i < count; i += 1) {
    const candidate = matches.nth(i);
    if (!await candidate.isVisible().catch(() => false)) continue;
    const box = await candidate.boundingBox().catch(() => null);
    if (!box) continue;

    const inProjectBand =
      box.x <= 460 &&
      box.y >= projectsBox.y &&
      box.y <= projectsBox.y + 420;

    if (inProjectBand) {
      console.log('[github-playwright-v10] project-title-target=' + JSON.stringify({
        strategy: 'exact-visible-title-text',
        box: {
          x: Math.round(box.x),
          y: Math.round(box.y),
          width: Math.round(box.width),
          height: Math.round(box.height)
        }
      }));
      return candidate;
    }
  }

  return null;
}

async function recoverExistingProjectExactHumanFlow(page, name) {
  const projects = await ensureSidebarOpenForProject(page);
  const existing = await findVisibleExactProjectEntry(page, projects, name);
  if (!existing) return null;

  const beforeUrl = page.url();

  // User-directed human gesture sequence on the exact visible Project title:
  // short click -> 0.1-0.3s -> double-click -> 0.1-0.3s -> longer click.
  // Stop immediately if any gesture causes Project URL navigation.
  const projectUrl = await runProjectTitleClickSequence(page, existing, beforeUrl);
  if (projectUrl === beforeUrl) {
    throw new Error('Existing exact-name Project title did not navigate after short-click, double-click, and long-click sequence');
  }

  const composer = await ensureComposer(page);
  console.log('[github-playwright-v10] project-recovered-visible=' + JSON.stringify({ projectName: name, url: projectUrl }));
  return { projectName: name, url: projectUrl, composer, recoveredExisting: true };
}

async function findSendControlNearComposer(page, composer) {
  if (composer) {
    let region = composer;
    for (let depth = 0; depth < 5; depth += 1) {
      region = region.locator('xpath=..');
      const send = await firstVisible(region, [
        'button[data-testid="send-button"]',
        'button[data-testid="composer-submit-button"]',
        'button[aria-label="Send prompt"]',
        'button[aria-label="Send"]',
        'button[aria-label*="Send"]'
      ]);
      if (send) return send;
    }
  }

  return firstVisible(page, [
    'button[data-testid="send-button"]',
    'button[data-testid="composer-submit-button"]',
    'button[aria-label="Send prompt"]',
    'button[aria-label="Send"]',
    'button[aria-label*="Send"]'
  ]);
}

async function createProjectExactHumanFlow(page, name) {
  if (!name) throw new Error('PROJECT_NAME is required for project_wake');

  const saved = await openSavedProjectUrl(page, name, requestedProjectUrl);
  if (saved) return saved;

  const recovered = await recoverExistingProjectExactHumanFlow(page, name);
  if (recovered) return recovered;

  const projects = await ensureSidebarOpenForProject(page);
  await humanActionPause(page);
  if (!await projects.isVisible().catch(() => false)) {
    throw new Error('Visible Projects section title was not found');
  }

  await projects.hover();
  await humanActionPause(page);

  const plus = await findProjectsPlusAfterHover(page, projects);
  if (!plus) throw new Error('Plus control did not appear to the right of Projects after hover');
  await humanPointerClick(page, plus);

  // The Create project modal takes a moment to render in the normal UI.
  await page.waitForTimeout(randomDelayMs(2500, 4500));
  let controls = await findProjectNameEditorFromVisibleCreateSurface(page);
  if (!controls.create || !controls.editor) {
    const pendingCreate = page.getByRole('button', { name: /^Create project$/i }).first();
    await pendingCreate.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
    controls = await findProjectNameEditorFromVisibleCreateSurface(page);
  }
  if (!controls.create) throw new Error('Create Project button was not found on the visible Create-project surface');
  if (!controls.editor) throw new Error('Project-name editor was not found on the visible Create-project surface');

  await humanTypeInto(page, controls.editor, name);

  // The visible Create project button is initially disabled. Give the UI a
  // short human-scale moment to enable it after typing, then click only the
  // enabled rendered control.
  await page.waitForTimeout(randomDelayMs(1200, 2500));
  const enabledCreate = await findEnabledProjectCreateButton(page, 8000);
  if (!enabledCreate) {
    throw new Error('Create project control did not become visibly enabled after typing the Project name');
  }

  const beforeCreateUrl = page.url();
  await humanPointerClick(page, enabledCreate);

  // Successful Project creation automatically navigates the browser to the new
  // Project URL. A short human-scale wait is sufficient; capture that URL directly.
  await page.waitForTimeout(randomDelayMs(3000, 5000));
  let projectUrl = page.url();
  if (projectUrl === beforeCreateUrl) {
    await page.waitForTimeout(randomDelayMs(2000, 3500));
    projectUrl = page.url();
  }
  if (projectUrl === beforeCreateUrl) {
    throw new Error('Create project did not navigate to a new Project URL after a short visible wait');
  }

  const composer = await ensureComposer(page);
  console.log('[github-playwright-v10] project-created-visible=' + JSON.stringify({ projectName: name, url: projectUrl }));
  return { projectName: name, url: projectUrl, composer };
}

async function fillComposer(page, message, composerOverride = null) {
  const composer = composerOverride || await ensureComposer(page);
  if (!await composer.isVisible().catch(() => false)) {
    throw new Error('Visible composer target is not available for human typing');
  }
  await humanTypeInto(page, composer, message);
  return composer;
}

async function post(page, message, composerOverride = null) {
  if (!message) throw new Error('Wake message is empty');

  const marker = message.slice(0, Math.min(120, message.length));
  const requestedIdleWait = Number.parseInt(env.IDLE_WAIT_MS || '600000', 10);
  const idleWaitMs = Number.isFinite(requestedIdleWait) ? Math.max(30000, requestedIdleWait) : 600000;

  // Human-only interaction: wait until the visible chat is idle, type through keyboard
  // events, and click the visible Send control with pointer movement.
  await waitForChatIdle(page, idleWaitMs);
  const composer = await fillComposer(page, message, composerOverride);

  const send = await findSendControlNearComposer(page, composer);
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

function visibleHumanChallengeEvidence(bodyText = '', title = '') {
  const evidence = [];
  if (/Verify you are human|Verifying you are human/i.test(bodyText)) evidence.push('verify-human-body');
  if (/Checking your browser/i.test(bodyText)) evidence.push('checking-browser-body');
  if (/Performing security verification|security verification/i.test(bodyText)) evidence.push('security-verification-body');
  if (/Enable JavaScript and cookies to continue/i.test(bodyText)) evidence.push('enable-js-cookies-body');
  if (/Ray ID/i.test(bodyText)) evidence.push('ray-id-body');
  if (/Just a moment/i.test(title)) evidence.push('just-a-moment-title');
  if (/Attention Required/i.test(title)) evidence.push('attention-required-title');
  if (/Verify you are human/i.test(title)) evidence.push('verify-human-title');
  if (/Cloudflare.*(?:verification|challenge)/i.test(title)) evidence.push('cloudflare-challenge-title');
  return evidence;
}

function visibleHumanChallenge(bodyText = '', title = '') {
  return visibleHumanChallengeEvidence(bodyText, title).length > 0;
}

function visibleBrowserStateText(bodyText = '', title = '') {
  return {
    loginPrompt: /\bLog in\b|\bSign up\b|Continue with Google|Welcome back/i.test(bodyText),
    humanChallenge: visibleHumanChallenge(bodyText, title),
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
    if (url.origin !== 'https://chatgpt.com') {
      return { isChat: false, isLocal: false, id: '', projectScoped: false, projectId: '' };
    }

    const rootMatch = url.pathname.match(/^\/c\/([^/]+)\/?$/);
    const projectMatch = url.pathname.match(/^\/g\/(g-p-[^/]+)\/c\/([^/]+)\/?$/);
    const id = rootMatch
      ? decodeURIComponent(rootMatch[1])
      : projectMatch
        ? decodeURIComponent(projectMatch[2])
        : '';
    const projectId = projectMatch ? decodeURIComponent(projectMatch[1]) : '';

    return {
      isChat: Boolean(id),
      isLocal: id.startsWith('local-chatgpt:'),
      id,
      projectScoped: Boolean(projectMatch),
      projectId
    };
  } catch {
    return { isChat: false, isLocal: false, id: '', projectScoped: false, projectId: '' };
  }
}

async function persistDurableChatState(chatUrl, projectUrl = '') {
  const route = chatRouteInfo(chatUrl);
  if (!route.isChat || route.isLocal) return false;

  const state = {
    version: 1,
    capturedAt: new Date().toISOString(),
    wakeId,
    action,
    projectName,
    projectUrl: projectUrl || requestedProjectUrl || '',
    chatUrl,
    chatTitle: recoveryChatTitle || ''
  };
  await fs.writeFile(chatStatePath, JSON.stringify(state, null, 2) + '\n');
  console.log('[github-playwright-v10] durable-chat-state-captured=' + JSON.stringify({
    chatUrl,
    projectUrl: state.projectUrl,
    projectName: state.projectName
  }));
  return true;
}

async function recoverCreatedChatDirect(page, message) {
  const route = chatRouteInfo(page.url());
  if (!route.isChat || route.isLocal) {
    throw new Error('Direct recovery is not on a durable ChatGPT conversation route');
  }

  const wake = await visibleWakePresent(page, message, 30000);
  if (!wake.visible) {
    throw new Error('Directly recovered chat did not visibly contain the exact original wake message');
  }

  await persistDurableChatState(route.url || page.url(), requestedProjectUrl);
  return {
    recovered: true,
    projectUrl: requestedProjectUrl || '',
    chatUrl: page.url(),
    chatTitle: recoveryChatTitle || '',
    verificationMethod: wake.method,
    userCount: wake.userCount
  };
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
  throw new Error('Fresh chat did not visibly navigate to a durable ChatGPT conversation route');
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

async function findVisibleCenterProjectChatTitle(page, title) {
  const viewport = page.viewportSize();
  if (!viewport) throw new Error('Viewport unavailable while locating Project chat title');

  const titlePattern = new RegExp('^' + escapeRegExp(title) + '$', 'i');
  const matches = page.getByText(titlePattern, { exact: true });
  const count = Math.min(await matches.count().catch(() => 0), 20);
  const candidates = [];

  for (let i = 0; i < count; i += 1) {
    const candidate = matches.nth(i);
    if (!await candidate.isVisible().catch(() => false)) continue;
    const box = await candidate.boundingBox().catch(() => null);
    if (!box) continue;

    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;
    const physicallyOnscreen =
      centerX >= 0 &&
      centerY >= 0 &&
      centerX <= viewport.width &&
      centerY <= viewport.height;
    const inProjectCenter =
      centerX >= viewport.width * 0.22 &&
      centerX <= viewport.width * 0.92 &&
      centerY <= viewport.height * 0.68;

    if (physicallyOnscreen && inProjectCenter) {
      candidates.push({ candidate, box, centerY });
    }
  }

  candidates.sort((a, b) => a.centerY - b.centerY);
  const chosen = candidates[0];
  if (!chosen) return null;

  console.log('[github-playwright-v10] project-chat-title-target=' + JSON.stringify({
    strategy: 'visible-center-page-title',
    box: {
      x: Math.round(chosen.box.x),
      y: Math.round(chosen.box.y),
      width: Math.round(chosen.box.width),
      height: Math.round(chosen.box.height)
    }
  }));
  return chosen.candidate;
}

async function clickVisibleCenterProjectChatTitle(page, locator, beforeUrl) {
  const box = await locator.boundingBox().catch(() => null);
  if (!box) throw new Error('Visible Project chat title has no clickable bounding box');

  const point = (fraction) => ({
    x: box.x + Math.max(8, Math.min(box.width - 8, box.width * fraction)),
    y: box.y + box.height / 2
  });

  let p = point(0.35);
  await page.mouse.move(p.x, p.y, { steps: 12 });
  await page.mouse.down();
  await page.waitForTimeout(randomDelayMs(70, 140));
  await page.mouse.up();
  await page.waitForTimeout(randomDelayMs(100, 300));
  if (page.url() !== beforeUrl) return page.url();

  p = point(0.5);
  await page.mouse.move(p.x, p.y, { steps: 10 });
  await page.mouse.down({ clickCount: 1 });
  await page.waitForTimeout(randomDelayMs(70, 130));
  await page.mouse.up({ clickCount: 1 });
  await page.waitForTimeout(randomDelayMs(100, 220));
  await page.mouse.down({ clickCount: 2 });
  await page.waitForTimeout(randomDelayMs(70, 130));
  await page.mouse.up({ clickCount: 2 });
  await page.waitForTimeout(randomDelayMs(100, 300));
  if (page.url() !== beforeUrl) return page.url();

  p = point(0.68);
  await page.mouse.move(p.x, p.y, { steps: 12 });
  await page.mouse.down();
  await page.waitForTimeout(randomDelayMs(550, 900));
  await page.mouse.up();
  await page.waitForTimeout(randomDelayMs(1200, 2200));
  return page.url();
}

async function recoverCreatedChatFromProjectPage(page, message) {
  if (!message) throw new Error('recover action requires the original wake message');
  if (!recoveryChatTitle) throw new Error('recover action requires the visible Project chat title');
  if (!requestedProjectUrl) {
    throw new Error('Project-page recovery requires a saved Project URL; sidebar rediscovery is disabled');
  }

  const project = await openSavedProjectUrl(page, projectName, requestedProjectUrl);
  if (!project) throw new Error('Saved Project URL could not be opened for recovery');

  await page.waitForTimeout(randomDelayMs(1200, 2200));

  // Project chats are visible in the top-center Project page. Do not use the
  // sidebar and do not scroll: target only an exact title that is already
  // physically on-screen in the center content region.
  const visibleTitle = await findVisibleCenterProjectChatTitle(page, recoveryChatTitle);
  if (!visibleTitle) {
    throw new Error('Visible center-page Project chat title was not found');
  }

  const beforeChatUrl = page.url();
  const afterTitleClickUrl = await clickVisibleCenterProjectChatTitle(page, visibleTitle, beforeChatUrl);
  if (afterTitleClickUrl === beforeChatUrl) {
    throw new Error('Visible center-page Project chat title did not open after human click sequence');
  }

  const route = await waitForDurableChatRoute(page, 300000);
  if (!route.projectScoped) {
    throw new Error('Recovered Project chat did not open a Project-scoped durable conversation route');
  }
  await persistDurableChatState(route.url, project.url);

  const wake = await visibleWakePresent(page, message, 30000);
  if (!wake.visible) {
    throw new Error('Recovered Project chat did not visibly contain the exact original wake message');
  }

  console.log('[github-playwright-v10] recovered-project-chat=' + JSON.stringify({
    projectUrl: project.url,
    chatUrl: route.url,
    chatTitle: recoveryChatTitle,
    verificationMethod: wake.method
  }));
  return {
    recovered: true,
    projectUrl: project.url,
    chatUrl: route.url,
    chatTitle: recoveryChatTitle,
    verificationMethod: wake.method,
    userCount: wake.userCount
  };
}

async function postWithVisibleVerification(page, message, composerOverride = null) {
  const submitted = await post(page, message, composerOverride);

  let initialRoute = { url: page.url(), ...chatRouteInfo(page.url()) };
  if (mode === 'create_fresh') {
    initialRoute = await waitForFreshChatRoute(page, 90000);
  } else if (!initialRoute.isChat) {
    throw new Error('Existing-chat send is not on a visible durable ChatGPT conversation route');
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
  // to transition to a durable server-backed root or Project-scoped chat route first.
  if (initialRoute.isLocal) {
    initialRoute = await waitForDurableChatRoute(page, 300000);
  }
  await persistDurableChatState(initialRoute.url, requestedProjectUrl);

  await humanReload(page);
  await waitForVisibleBrowserReady(page);

  const reloadedRoute = { url: page.url(), ...chatRouteInfo(page.url()) };
  if (!reloadedRoute.isChat || reloadedRoute.isLocal) {
    throw new Error('Human-style reload did not return to a durable ChatGPT conversation');
  }

  await persistDurableChatState(reloadedRoute.url, requestedProjectUrl);
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


const visualScreenPath = '/tmp/browser-agent-v10-visual-screen.png';
let lastVisualDiagnostics = {};

function visualSleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function publishOperatorStatus(status, extra = {}) {
  const token = env.GITHUB_TOKEN || '';
  const repository = env.GITHUB_REPOSITORY || '';
  const statusPath = env.OPERATOR_STATUS_PATH || '';
  if (!token || !repository || !statusPath) return;

  const api = 'https://api.github.com/repos/' + repository + '/contents/' + statusPath;
  const headers = {
    'Authorization': 'Bearer ' + token,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json'
  };

  let fileSha = '';
  try {
    const getResponse = await fetch(api + '?ref=main', { headers });
    if (getResponse.ok) {
      const existing = await getResponse.json();
      fileSha = existing.sha || '';
    }
  } catch {}

  const payload = {
    version: 10,
    run_id: String(env.GITHUB_RUN_ID || ''),
    run_url: env.GITHUB_SERVER_URL && repository && env.GITHUB_RUN_ID
      ? env.GITHUB_SERVER_URL + '/' + repository + '/actions/runs/' + env.GITHUB_RUN_ID
      : '',
    browser_view_url: env.BROWSER_VIEW_URL || '',
    status,
    updated_at: new Date().toISOString(),
    ...extra
  };

  const body = {
    message: 'chore(browser): update v10 operator status',
    content: Buffer.from(JSON.stringify(payload, null, 2) + '\n', 'utf8').toString('base64'),
    branch: 'main'
  };
  if (fileSha) body.sha = fileSha;

  try {
    await fetch(api, {
      method: 'PUT',
      headers,
      body: JSON.stringify(body)
    });
  } catch {}
}

async function visualChromeWindowId() {
  const { stdout } = await execFile('xdotool', ['search', '--onlyvisible', '--class', 'google-chrome']);
  const ids = String(stdout || '').trim().split(/\s+/).filter(Boolean);
  if (!ids.length) throw new Error('Visible Chrome window not found');
  return ids[ids.length - 1];
}

async function visualFocus(windowId) {
  await execFile('xdotool', ['windowfocus', '--sync', windowId]);
  await visualSleep(randomDelayMs(300, 1500));
}

async function visualKey(windowId, keyName) {
  await visualFocus(windowId);
  await execFile('xdotool', ['key', '--window', windowId, '--clearmodifiers', keyName]);
  await visualSleep(randomDelayMs(300, 1500));
}

async function visualType(windowId, text) {
  await visualFocus(windowId);
  for (const char of String(text)) {
    await execFile('xdotool', ['type', '--window', windowId, '--clearmodifiers', char]);
    await visualSleep(randomDelayMs(200, 400));
  }
  await visualSleep(randomDelayMs(300, 1500));
}

async function visualMove(windowId, x, y) {
  await visualFocus(windowId);
  await execFile('xdotool', [
    'mousemove',
    '--window', windowId,
    String(Math.round(x)),
    String(Math.round(y))
  ]);
  await visualSleep(randomDelayMs(300, 1500));
}

async function visualClick(windowId, x, y) {
  await visualMove(windowId, x, y);
  await execFile('xdotool', ['mousedown', '--window', windowId, '1']);
  await visualSleep(randomDelayMs(180, 420));
  await execFile('xdotool', ['mouseup', '--window', windowId, '1']);
  await visualSleep(randomDelayMs(300, 1500));
}

async function visualNavigate(windowId, url) {
  await visualKey(windowId, 'ctrl+l');
  await visualType(windowId, url);
  await visualKey(windowId, 'Return');
  await visualSleep(randomDelayMs(4500, 6500));
}

async function visualAddressBarUrl(windowId) {
  await visualKey(windowId, 'ctrl+l');
  await visualKey(windowId, 'ctrl+c');
  const { stdout } = await execFile('xclip', ['-selection', 'clipboard', '-o']);
  await visualKey(windowId, 'Escape');
  return String(stdout || '').trim();
}

async function visualWords() {
  await execFile('scrot', ['-o', visualScreenPath]);
  const { stdout } = await execFile('tesseract', [visualScreenPath, 'stdout', '--psm', '11', 'tsv']);

  const words = [];
  for (const line of String(stdout || '').split('\n').slice(1)) {
    const parts = line.split('\t');
    if (parts.length < 12) continue;
    const text = String(parts[11] || '').trim();
    const confidence = Number(parts[10]);
    if (!text || !Number.isFinite(confidence) || confidence < 15) continue;
    words.push({
      text,
      lower: text.toLowerCase(),
      left: Number(parts[6]),
      top: Number(parts[7]),
      width: Number(parts[8]),
      height: Number(parts[9]),
      block: String(parts[2]),
      paragraph: String(parts[3]),
      line: String(parts[4])
    });
  }
  return words;
}

function visualJoinedText(words) {
  return words.map((word) => word.text).join(' ').toLowerCase();
}

function visualWordBox(words, pattern) {
  for (const word of words) {
    pattern.lastIndex = 0;
    if (pattern.test(word.text)) {
      return {
        ...word,
        cx: word.left + word.width / 2,
        cy: word.top + word.height / 2
      };
    }
  }
  return null;
}

function visualPhraseBox(words, phrase) {
  const wanted = String(phrase).toLowerCase().split(/\s+/).filter(Boolean);
  const groups = new Map();

  for (const word of words) {
    const key = [word.block, word.paragraph, word.line].join(':');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(word);
  }

  for (const group of groups.values()) {
    group.sort((a, b) => a.left - b.left);
    const normalized = group.map((word) => word.lower.replace(/[^a-z0-9_+-]/g, ''));

    for (let i = 0; i <= normalized.length - wanted.length; i += 1) {
      let matches = true;
      for (let j = 0; j < wanted.length; j += 1) {
        const token = wanted[j].replace(/[^a-z0-9_+-]/g, '');
        if (!normalized[i + j].includes(token)) {
          matches = false;
          break;
        }
      }
      if (!matches) continue;

      const segment = group.slice(i, i + wanted.length);
      const left = Math.min(...segment.map((word) => word.left));
      const top = Math.min(...segment.map((word) => word.top));
      const right = Math.max(...segment.map((word) => word.left + word.width));
      const bottom = Math.max(...segment.map((word) => word.top + word.height));
      return {
        left,
        top,
        width: right - left,
        height: bottom - top,
        cx: (left + right) / 2,
        cy: (top + bottom) / 2
      };
    }
  }
  return null;
}

function visualChallengeVisible(text) {
  return /just a moment|verify you are human|verifying you are human|checking your browser|security verification|enable javascript and cookies|ray id/.test(text);
}

function visualNormalChatVisible(text) {
  return /projects|new chat|chatgpt|ask anything|message chatgpt/.test(text);
}

async function waitForVisualChat(stage) {
  const minutes = Number.parseInt(env.MANUAL_CHALLENGE_WAIT_MINUTES || '5', 10);
  const timeoutMs = Math.max(1, Number.isFinite(minutes) ? minutes : 5) * 60000;
  const deadline = Date.now() + timeoutMs;
  let interventionPublished = false;

  while (Date.now() < deadline) {
    const words = await visualWords();
    const text = visualJoinedText(words);

    if (visualChallengeVisible(text)) {
      if (!interventionPublished) {
        interventionPublished = true;
        await publishOperatorStatus('INTERVENTION_REQUIRED', {
          stage,
          message: 'Human verification is visible. Open browser_view_url and complete the verification manually.'
        });
        console.log('[github-playwright-v10] INTERVENTION_REQUIRED=' + JSON.stringify({
          stage,
          browserViewUrl: env.BROWSER_VIEW_URL || ''
        }));
      }
      await visualSleep(5000);
      continue;
    }

    if (visualNormalChatVisible(text)) {
      if (interventionPublished) {
        await publishOperatorStatus('AUTOMATION_RESUMED', { stage });
      }
      return words;
    }

    await visualSleep(3000);
  }

  throw new Error('Rendered ChatGPT UI did not become available within the manual-verification window');
}

function visualProjectsBox(words) {
  for (const word of words) {
    if (word.left > 440 || word.top < 75) continue;
    const normalized = String(word.text || '').toLowerCase().replace(/[^a-z]/g, '');
    if (normalized === 'projects' || normalized === 'project' || normalized.startsWith('projec') || normalized.startsWith('proje')) {
      return {
        ...word,
        cx: word.left + word.width / 2,
        cy: word.top + word.height / 2
      };
    }
  }
  return null;
}

async function visualWheel(windowId, x, y, direction) {
  await visualMove(windowId, x, y);
  const button = direction < 0 ? '4' : '5';
  await execFile('xdotool', ['click', '--window', windowId, button]);
  await visualSleep(randomDelayMs(500, 1100));
}

async function visualFindProjects(windowId) {
  let words = await visualWords();
  let projects = visualProjectsBox(words);
  if (projects) return projects;

  // Browser chrome occupies the top strip of the screenshot. The ChatGPT
  // sidebar toggle sits below it at the far-left edge of the rendered page.
  await visualClick(windowId, 28, 108);
  await visualSleep(2500);

  words = await visualWords();
  projects = visualProjectsBox(words);
  if (projects) return projects;

  // Keep the pointer inside the rendered sidebar and scan it visually with
  // ordinary wheel steps. This reads only successive screenshots.
  for (let i = 0; i < 5; i += 1) {
    await visualWheel(windowId, 170, 430, -1);
    words = await visualWords();
    projects = visualProjectsBox(words);
    if (projects) return projects;
  }

  for (let i = 0; i < 12; i += 1) {
    await visualWheel(windowId, 170, 430, 1);
    words = await visualWords();
    projects = visualProjectsBox(words);
    if (projects) return projects;
  }

  const leftColumnText = words
    .filter((word) => word.left < 440 && word.top >= 75)
    .map((word) => word.text)
    .slice(0, 120)
    .join(' ');

  lastVisualDiagnostics = {
    stage: 'find_projects',
    visibleLeftColumnText: leftColumnText
  };
  await publishOperatorStatus('FAILED_VISUAL_NAVIGATION', lastVisualDiagnostics);
  console.log('[github-playwright-v10] visual-left-column=' + JSON.stringify(leftColumnText));
  throw new Error('Rendered Projects label was not found');
}

async function visualCreateFreshProject(windowId) {
  const projects = await visualFindProjects(windowId);
  await visualMove(windowId, projects.cx, projects.cy);
  await visualSleep(randomDelayMs(700, 1300));

  const plusX = Math.max(240, Math.min(305, projects.left + projects.width + 170));
  await visualClick(windowId, plusX, projects.cy);
  await visualSleep(randomDelayMs(2200, 3500));

  let words = await visualWords();
  let createButton = visualPhraseBox(words, 'Create project');
  if (!createButton) {
    throw new Error('Rendered Create project dialog was not found');
  }

  const nameLabel = visualPhraseBox(words, 'Project name') || visualWordBox(words, /^Name$/i);
  const nameFieldY = nameLabel ? nameLabel.cy + 42 : Math.max(360, createButton.cy - 120);
  await visualClick(windowId, 960, Math.max(330, Math.min(620, nameFieldY)));
  await visualType(windowId, projectName);

  await visualSleep(randomDelayMs(1200, 2300));
  words = await visualWords();
  createButton = visualPhraseBox(words, 'Create project');
  if (!createButton) {
    throw new Error('Rendered Create project button was not found after typing the name');
  }

  await visualClick(windowId, createButton.cx, createButton.cy);
  await visualSleep(randomDelayMs(5000, 7500));
  await waitForVisualChat('after_project_create');

  const projectUrl = await visualAddressBarUrl(windowId);
  if (!/^https:\/\/chatgpt\.com\/g\/g-p-[^/]+/.test(projectUrl)) {
    throw new Error('Fresh Project did not expose a Project URL in Chrome address bar');
  }

  await publishOperatorStatus('PROJECT_CREATED', { projectUrl });
  return projectUrl;
}

async function visualSendFreshProjectWake(windowId, projectUrl) {
  const words = await visualWords();
  const composerCue = visualPhraseBox(words, 'New chat in') || visualPhraseBox(words, 'New chat');

  if (composerCue) {
    await visualClick(windowId, composerCue.cx, composerCue.cy);
  } else {
    await visualClick(windowId, 960, 235);
  }

  await visualType(windowId, wakeMessage);
  await visualKey(windowId, 'Return');
  await visualSleep(randomDelayMs(8500, 12000));
  await waitForVisualChat('after_wake_send');

  let chatUrl = '';
  for (let attempt = 0; attempt < 6; attempt += 1) {
    chatUrl = await visualAddressBarUrl(windowId);
    if (/^https:\/\/chatgpt\.com\/(?:c\/|g\/g-p-[^/]+\/c\/)/.test(chatUrl)) break;
    await visualSleep(4000);
  }

  if (!/^https:\/\/chatgpt\.com\/(?:c\/|g\/g-p-[^/]+\/c\/)/.test(chatUrl)) {
    throw new Error('Fresh Project chat did not expose a durable chat URL in Chrome address bar');
  }

  await publishOperatorStatus('WAKE_SENT', { projectUrl, chatUrl });
  return chatUrl;
}

async function runVisualOnlyProjectWake(providerName) {
  await publishOperatorStatus('AUTOMATION_RUNNING', {
    message: 'Visual-only Project wake automation is active.'
  });

  const windowId = await visualChromeWindowId();
  await visualNavigate(windowId, 'https://chatgpt.com/');
  await waitForVisualChat('initial_load');

  const projectUrl = await visualCreateFreshProject(windowId);
  const chatUrl = await visualSendFreshProjectWake(windowId, projectUrl);

  const result = {
    ok: true,
    provider: providerName,
    action,
    wakeId,
    posted: true,
    projectName,
    projectUrl,
    chatUrl,
    verification: 'rendered-screen-ocr-only',
    inputMethod: 'os-mouse-keyboard-only',
    cloudflareHandling: 'manual-verification-only'
  };

  await fs.writeFile(statePath, JSON.stringify(result, null, 2) + '\n');
  await publishOperatorStatus('COMPLETE', { projectUrl, chatUrl });
  return result;
}

async function runWithPage(providerName, connect) {
  const { browser, context, page, close } = await connect();
  try {
    if (action === 'project_wake' && mode === 'create_fresh' && bool(env.VISUAL_ONLY_PROJECT_WAKE)) {
      return await runVisualOnlyProjectWake(providerName);
    }

    const recoveryRoute = action === 'recover' ? chatRouteInfo(requestedUrl) : { isChat: false, isLocal: false };
    let deferredHumanUrl = '';
    if (action === 'recover' && recoveryRoute.isChat && !recoveryRoute.isLocal) {
      deferredHumanUrl = requestedUrl;
    } else if (mode === 'resume_existing') {
      const requestedRoute = chatRouteInfo(requestedUrl);
      if (!requestedRoute.isChat || requestedRoute.isLocal) {
        throw new Error('resume_existing requires a durable root or Project-scoped ChatGPT conversation URL');
      }
      deferredHumanUrl = requestedUrl;
    } else if (mode !== 'create_fresh') {
      throw new Error('Unsupported WAKE_MODE');
    }

    // Bootstrap only the ordinary signed-in ChatGPT home shell programmatically.
    // Saved Project/chat routes are entered later through the visible address bar.
    await page.goto('https://chatgpt.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(1500);
    if (bool(env.REFRESH_BEFORE_WAKE)) {
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(1500);
    }

    await waitForVisibleBrowserReady(page);

    if (deferredHumanUrl) {
      await humanAddressNavigate(page, deferredHumanUrl);
      await waitForVisibleBrowserReady(page);
    }

    let project = null;
    if (action === 'project_wake') {
      if (mode !== 'create_fresh') throw new Error('project_wake requires create_fresh mode');
      project = await createProjectExactHumanFlow(page, projectName);
    }

    const before = await snapshot(page);

    if (action === 'observe') {
      const sessionStatePersisted = false;
      const result = { ok: true, provider: providerName, action, wakeId, sessionStatePersisted, ...before };
      await fs.writeFile(statePath, JSON.stringify(result, null, 2) + '\n');
      return result;
    }

    if (action === 'recover') {
      const directRoute = chatRouteInfo(requestedUrl);
      const recovered = directRoute.isChat && !directRoute.isLocal
        ? await recoverCreatedChatDirect(page, wakeMessage)
        : await recoverCreatedChatFromProjectPage(page, wakeMessage);
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
        projectUrl: recovered.projectUrl,
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

    const verifiedSend = await postWithVisibleVerification(page, wakeMessage, project?.composer || null);

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
    if (bool(env.VISUAL_ONLY_PROJECT_WAKE) && action === 'project_wake') {
      await publishOperatorStatus('FAILED', {
        error: error.message,
        ...lastVisualDiagnostics
      }).catch(() => {});
    }
    failures.push({ provider: name, error: error.message });
    console.error('[' + name + '] ' + error.message);
  }
}
await fs.writeFile(statePath, JSON.stringify({ ok:false, wakeId, failures }, null, 2) + '\n');
console.error(JSON.stringify({ ok:false, wakeId, failures }));
process.exit(1);
