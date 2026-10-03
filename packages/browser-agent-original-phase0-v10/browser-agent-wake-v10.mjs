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
const requestedProjectUrl = env.PROJECT_URL || '';
const recoveryChatTitle = env.RECOVERY_CHAT_TITLE || '';
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

  await page.mouse.down();
  await page.waitForTimeout(randomDelayMs(70, 130));
  await page.mouse.up();
  await page.waitForTimeout(randomDelayMs(100, 220));
  await page.mouse.down();
  await page.waitForTimeout(randomDelayMs(70, 130));
  await page.mouse.up();

  console.log('[github-playwright-v10] project-title-gesture=' + JSON.stringify({
    gesture: 'double-click',
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

  // This is navigation to a previously persisted Project identity, not a
  // ChatGPT data read/write shortcut. All Project interaction after load stays
  // on the visible human UI.
  await page.goto(projectUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(randomDelayMs(3000, 5000));

  const currentProjectUrl = page.url();
  const currentProjectIdentity = savedProjectIdentity(currentProjectUrl);
  if (!currentProjectIdentity || currentProjectIdentity !== expectedProjectIdentity) {
    throw new Error(
      'Persisted Project URL did not open the expected ChatGPT Project page' +
      ' (observedUrl=' + currentProjectUrl + ')'
    );
  }

  const composer = await ensureComposer(page);
  console.log('[github-playwright-v10] project-reused-saved-url=' + JSON.stringify({
    projectName: name,
    url: currentProjectUrl,
    projectIdentity: currentProjectIdentity
  }));
  return { projectName: name, url: currentProjectUrl, composer, recoveredExisting: true, reusedSavedUrl: true };
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

async function recoverCreatedChatFromProjectPage(page, message) {
  if (!message) throw new Error('recover action requires the original wake message');
  if (!recoveryChatTitle) throw new Error('recover action requires the visible Project chat title');

  // Prefer an already-persisted Project URL when supplied. If this one-time
  // recovery request does not have one, open the exact visible Project entry
  // by name with the normal human pointer flow and capture the navigated URL.
  // Once inside the Project, recovery never uses global Search.
  const project = requestedProjectUrl
    ? await openSavedProjectUrl(page, projectName, requestedProjectUrl)
    : await recoverExistingProjectExactHumanFlow(page, projectName);
  if (!project) throw new Error('Existing Project could not be opened for recovery');

  await page.waitForTimeout(randomDelayMs(1200, 2200));

  const projectMain = page.locator('main, [role="main"]').first();
  if (!await projectMain.isVisible().catch(() => false)) {
    throw new Error('Visible Project main surface was not found after opening the persisted Project URL');
  }

  const titlePattern = new RegExp('^' + escapeRegExp(recoveryChatTitle) + '$', 'i');
  const visibleTitle = projectMain.getByText(titlePattern, { exact: true }).first();
  if (!await visibleTitle.isVisible().catch(() => false)) {
    throw new Error('Visible Project chat title was not found in the Project chat list');
  }

  let chatControl = visibleTitle;
  const link = visibleTitle.locator('xpath=ancestor-or-self::a[1]');
  if (await link.isVisible().catch(() => false)) {
    chatControl = link;
  } else {
    const button = visibleTitle.locator('xpath=ancestor-or-self::button[1]');
    if (await button.isVisible().catch(() => false)) chatControl = button;
  }

  await humanPointerClick(page, chatControl);

  const route = await waitForDurableChatRoute(page, 300000);
  if (!route.projectScoped) {
    throw new Error('Recovered Project chat did not open a Project-scoped durable conversation route');
  }

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

  await humanReload(page);
  await waitForVisibleBrowserReady(page);

  const reloadedRoute = { url: page.url(), ...chatRouteInfo(page.url()) };
  if (!reloadedRoute.isChat || reloadedRoute.isLocal) {
    throw new Error('Human-style reload did not return to a durable ChatGPT conversation');
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
      const requestedRoute = chatRouteInfo(requestedUrl);
      if (!requestedRoute.isChat || requestedRoute.isLocal) {
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

    await waitForVisibleBrowserReady(page);

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
      const recovered = await recoverCreatedChatFromProjectPage(page, wakeMessage);
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
    failures.push({ provider: name, error: error.message });
    console.error('[' + name + '] ' + error.message);
  }
}
await fs.writeFile(statePath, JSON.stringify({ ok:false, wakeId, failures }, null, 2) + '\n');
console.error(JSON.stringify({ ok:false, wakeId, failures }));
process.exit(1);
