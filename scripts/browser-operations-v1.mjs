import { spawnSync } from 'node:child_process';

const PROJECT_LINK_PATTERNS = [
  'a',
  'button',
  '[role="button"]'
];

async function firstVisible(page, selectors, timeout = 900) {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    try {
      if (await locator.isVisible({ timeout })) return locator;
    } catch {}
  }
  return null;
}

async function firstVisibleText(page, texts, { exact = true, timeout = 900 } = {}) {
  for (const text of texts) {
    const candidates = [
      page.getByRole('link', { name: text, exact }).first(),
      page.getByRole('button', { name: text, exact }).first(),
      page.getByText(text, { exact }).first(),
    ];
    for (const locator of candidates) {
      try { if (await locator.isVisible({ timeout })) return locator; } catch {}
    }
  }
  return null;
}

async function waitForComposer(page, timeoutMs = 15000) {
  const selectors = [
    '#prompt-textarea',
    'textarea[placeholder*="Message"]',
    '[contenteditable="true"][data-lexical-editor="true"]',
    '[contenteditable="true"]'
  ];
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const composer = await firstVisible(page, selectors, 500);
    if (composer) return composer;
    await page.waitForTimeout(350);
  }
  return null;
}

async function ensureChatMode(page) {
  const workSelected = await firstVisible(page, [
    '[role="tab"][aria-selected="true"]:has-text("Work")',
    'button[aria-pressed="true"]:has-text("Work")'
  ], 400);

  const chatSelected = await firstVisible(page, [
    '[role="tab"][aria-selected="true"]:has-text("Chat")',
    'button[aria-pressed="true"]:has-text("Chat")'
  ], 400);

  if (chatSelected) return { mode: 'chat', changed: false };

  const chat = await firstVisible(page, [
    '[role="tab"]:has-text("Chat")',
    'button:has-text("Chat")'
  ], 1000);

  if (workSelected || chat) {
    if (!chat) throw new Error('ChatGPT Chat mode control not found while Work mode appears active');
    await humanPointerClick(page, chat, { hoverMs: 180, downMs: 65, settleMs: 650 });
    const composer = await waitForComposer(page, 12000);
    if (!composer) throw new Error('ChatGPT Chat mode did not expose a composer after selecting Chat');
    return { mode: 'chat', changed: true };
  }

  // If neither segmented control is present, a composer means Chat mode is
  // already active in the current desktop layout.
  const composer = await waitForComposer(page, 2500);
  if (composer) return { mode: 'chat', changed: false };

  throw new Error('ChatGPT Chat mode could not be established');
}

async function ensureThinkingEffort(page, { level = 'high' } = {}) {
  const normalized = String(level || '').trim().toLowerCase();
  if (normalized !== 'high') {
    throw new Error('chatgpt.ensure_thinking_effort currently requires level=high');
  }

  const selected = await firstVisible(page, [
    '[role="menuitemradio"][aria-checked="true"]:has-text("High")',
    '[role="radio"][aria-checked="true"]:has-text("High")',
    '[role="option"][aria-selected="true"]:has-text("High")',
    '[aria-pressed="true"]:has-text("High")',
    '[data-state="checked"]:has-text("High")',
    'button:has-text("High")'
  ], 400);
  if (selected) return { level: 'high', changed: false, verified: true };

  const opener = await firstVisible(page, [
    'button[aria-label*="thinking" i]',
    'button[aria-label*="reasoning" i]',
    'button[aria-label*="effort" i]',
    'button[data-testid*="thinking" i]',
    'button[data-testid*="model" i]',
    'button[aria-label*="model" i]',
    'button[aria-haspopup="menu"]:has-text("GPT")',
    'button:has-text("Thinking")',
    'button:has-text("Think")',
    'button:has-text("Reasoning")',
    'button:has-text("Instant")',
    'button:has-text("Medium")'
  ], 1000);
  if (opener) {
    await humanPointerClick(page, opener);
    await page.waitForTimeout(500);
  }

  const power = await firstVisible(page, [
    '[data-reasoning-slider="true"][role="menuitem"][aria-label="Power"]'
  ], 350);
  if (power) {
    await humanPointerClick(page, power, { hoverMs: 120, downMs: 55, settleMs: 160 });
    await power.press('End').catch(() => {});
    await page.waitForTimeout(350);
    await power.press('Escape').catch(() => {});
    const visibleHigh = await firstVisible(page, [
      'button:has-text("High")',
      '[role="button"]:has-text("High")',
      '[role="menuitemradio"][aria-checked="true"]:has-text("High")',
      '[role="option"][aria-selected="true"]:has-text("High")'
    ], 500);
    if (visibleHigh) return { level: 'high', changed: true, verified: true };
  }

  const high = await firstVisible(page, [
    '[role="menuitemradio"]:has-text("High")',
    '[role="option"]:has-text("High")',
    '[role="radio"]:has-text("High")',
    '[role="menuitem"]:has-text("High")',
    'button:has-text("High")',
    'label:has-text("High")'
  ], 1200);
  if (high) {
    await humanPointerClick(page, high);
    await page.waitForTimeout(650);
    return { level: 'high', changed: true, verified: true };
  }

  const error = new Error('ChatGPT High thinking-effort visible control could not be selected');
  error.code = 'THINKING_EFFORT_UI_CHANGED';
  error.retryable = true;
  throw error;
}

async function humanPointerClick(page, locator, { hoverMs = 220, downMs = 70, settleMs = 320 } = {}) {
  await locator.scrollIntoViewIfNeeded().catch(() => {});
  await locator.hover().catch(() => {});
  const box = await locator.boundingBox();
  if (!box) throw new Error('Visible control has no clickable bounding box');
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y, { steps: 12 });
  await page.waitForTimeout(hoverMs);
  await page.mouse.down();
  await page.waitForTimeout(downMs);
  await page.mouse.up();
  await page.waitForTimeout(settleMs);
}

async function humanTypeInto(page, locator, text, { delay = 45 } = {}) {
  await humanPointerClick(page, locator, { hoverMs: 120, downMs: 55, settleMs: 180 });
  await locator.press('Control+A').catch(async () => locator.press('Meta+A').catch(() => {}));
  await page.waitForTimeout(120);
  await locator.press('Backspace').catch(() => {});
  await page.waitForTimeout(120);
  await locator.pressSequentially(String(text), { delay });
  await page.waitForTimeout(280);
}

function readOsClipboard() {
  const result = spawnSync('xclip', ['-selection', 'clipboard', '-o'], {
    encoding: 'utf8',
    env: process.env,
    timeout: 5000,
  });
  if (result.error || result.status !== 0) return '';
  return String(result.stdout || '').trim();
}

async function ensureSidebarOpen(page) {
  const open = await firstVisible(page, [
    'button[data-testid="open-sidebar-button"]',
    'button[data-testid="sidebar-toggle-button"]',
    'button[aria-label="Open sidebar"]',
    'button[aria-label="Toggle sidebar"]',
    'button[aria-label*="Open sidebar"]',
    'button[aria-label*="Show sidebar"]',
    'button[aria-label*="sidebar" i]',
    '[role="button"][aria-label*="sidebar" i]',
    '[data-testid*="sidebar"][role="button"]',
    'button[title*="sidebar" i]'
  ], 500);
  if (open) {
    await humanPointerClick(page, open).catch(() => {});
    await page.waitForTimeout(700);
    return { opened: true };
  }
  return { opened: false };
}

async function findSemanticProjectAction(page) {
  const candidates = [
    page.getByRole('button', { name: /(?:new|add|create).*project|project.*(?:new|add|create)/i }).first(),
    page.getByRole('link', { name: /(?:new|add|create).*project|project.*(?:new|add|create)/i }).first(),
  ];
  for (const candidate of candidates) {
    try { if (await candidate.isVisible({ timeout: 500 })) return candidate; } catch {}
  }
  return null;
}

async function visibleNavigationDiagnostics(page) {
  return {
    projectsVisible: !!await firstVisible(page, ['text=Projects'], 200),
    newProjectVisible: !!await firstVisible(page, ['text=New project', 'text=Create project'], 200),
    sidebarControlVisible: !!await firstVisible(page, [
      'button[aria-label*="sidebar" i]',
      '[role="button"][aria-label*="sidebar" i]'
    ], 200),
    url: page.url(),
  };
}

async function exposeProjectsInSidebar(page) {
  const recents = await firstVisible(page, [
    'button[aria-label="Recents"]',
    'button:has-text("Recents")',
    '[role="button"]:has-text("Recents")'
  ], 700);
  if (recents) {
    await humanPointerClick(page, recents).catch(() => {});
    await page.waitForTimeout(650);
  }

  let organize = await firstVisible(page, [
    'button:has-text("Organize sidebar")',
    '[role="menuitem"]:has-text("Organize sidebar")',
    '[role="button"]:has-text("Organize sidebar")',
    'button[aria-label*="Organize sidebar" i]'
  ], 500);

  let sidebarOptions = null;
  if (!organize) {
    sidebarOptions = await firstVisible(page, [
      'button[aria-label="Chat sidebar options"]',
      '[role="button"][aria-label="Chat sidebar options"]',
      'button[aria-label*="sidebar options" i]',
      '[role="button"][aria-label*="sidebar options" i]'
    ], 900);
    if (sidebarOptions) {
      await humanPointerClick(page, sidebarOptions);
      await page.waitForTimeout(550);
      organize = await firstVisible(page, [
        '[role="menuitem"]:has-text("Organize sidebar")',
        'button:has-text("Organize sidebar")',
        '[role="button"]:has-text("Organize sidebar")',
        '[aria-label*="Organize sidebar" i]'
      ], 1000);
    }
  }

  if (organize) {
    await humanPointerClick(page, organize);
    await page.waitForTimeout(550);
  }

  const show = await firstVisible(page, [
    '[role="menuitem"]:has-text("Show")',
    '[role="button"]:has-text("Show")',
    'button:has-text("Show")',
    '[aria-label="Show"]',
    '[aria-label*="Show" i]'
  ], 700);
  if (show) {
    await humanPointerClick(page, show);
    await page.waitForTimeout(450);
  }

  const projectsOff = await firstVisible(page, [
    '[role="menuitemcheckbox"][aria-checked="false"]:has-text("Projects")',
    '[role="checkbox"][aria-checked="false"]:has-text("Projects")'
  ], 500);
  if (projectsOff) {
    await humanPointerClick(page, projectsOff);
    await page.waitForTimeout(900);
  } else {
    await page.keyboard.press('Escape').catch(() => {});
  }

  await ensureSidebarOpen(page);
  const visible = await page.getByText('Projects', { exact: true }).first().isVisible().catch(() => false);
  console.log('[browser-operations] sidebar-projects-recovery=' + JSON.stringify({
    recentsVisible: Boolean(recents),
    sidebarOptionsFound: Boolean(sidebarOptions),
    organizerFound: Boolean(organize),
    showFound: Boolean(show),
    projectsVisible: visible
  }));
  return visible;
}

async function findNewProjectControl(page) {
  const direct = await firstVisible(page, [
    'button[aria-label="Add new project"]',
    'button[aria-label*="New project"]',
    'a[aria-label*="New project"]',
    '[role="button"][aria-label*="New project"]',
    'button[title*="New project"]',
    'a[title*="New project"]',
    'button:has-text("New project")',
    'a:has-text("New project")',
    '[role="button"]:has-text("New project")',
    'button:has-text("Create project")'
  ], 700);
  if (direct) return direct;

  const semantic = await findSemanticProjectAction(page);
  if (semantic) return semantic;

  const text = page.getByText('New project', { exact: true }).first();
  if (await text.isVisible().catch(() => false)) return text;
  return null;
}

async function findProjectEntry(page, projectName) {
  const escaped = String(projectName).replace(/"/g, '\\"');
  const direct = await firstVisible(page, [
    `a[aria-label="${escaped}"]`,
    `button[aria-label="${escaped}"]`,
    `a[title="${escaped}"]`,
    `button[title="${escaped}"]`
  ], 500);
  if (direct) return direct;
  return firstVisibleText(page, [projectName], { exact: true, timeout: 700 });
}

async function findProjectsSectionAddControl(page) {
  const projects = page.getByText('Projects', { exact: true }).first();
  if (!await projects.isVisible().catch(() => false)) return null;
  await projects.hover().catch(() => {});
  await page.waitForTimeout(350);

  let region = projects;
  for (let depth = 0; depth < 4; depth += 1) {
    region = region.locator('xpath=..');
    const explicit = region.locator([
      'button[aria-label*="Add" i][aria-label*="project" i]',
      'button[aria-label*="New" i][aria-label*="project" i]',
      'button[aria-label*="Create" i][aria-label*="project" i]',
      '[role="button"][aria-label*="Add" i][aria-label*="project" i]',
      '[role="button"][aria-label*="New" i][aria-label*="project" i]'
    ].join(',')).first();
    if (await explicit.isVisible().catch(() => false)) return explicit;
  }
  return null;
}

function retryableProjectUiError(code, message) {
  const error = new Error(message);
  error.code = code;
  error.retryable = true;
  return error;
}

async function createProject(page, projectName) {
  await ensureSidebarOpen(page);

  let trigger = null;
  let projects = page.getByText('Projects', { exact: true }).first();
  if (!await projects.isVisible().catch(() => false)) {
    await exposeProjectsInSidebar(page);
    projects = page.getByText('Projects', { exact: true }).first();
  }
  if (await projects.isVisible().catch(() => false)) {
    trigger = await findProjectsSectionAddControl(page);
  }
  if (!trigger) trigger = await findNewProjectControl(page);

  if (!trigger) {
    const controls = await visibleNavigationDiagnostics(page);
    throw retryableProjectUiError(
      'PROJECT_CREATE_CONTROL_MISSING',
      'ChatGPT project creation control not found; visibleState=' + JSON.stringify(controls)
    );
  }

  await humanPointerClick(page, trigger, { hoverMs: 260, downMs: 80, settleMs: 520 });

  let input = await firstVisible(page, [
    'input[placeholder*="Project name"]',
    'input[aria-label*="Project name"]',
    'input[name="name"]',
    '[role="dialog"] input'
  ], 2200);
  if (!input) {
    const pending = page.locator('input[placeholder*="Project name"]:visible, input[aria-label*="Project name"]:visible, input[name="name"]:visible, [role="dialog"] input:visible').first();
    await pending.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
    if (await pending.isVisible().catch(() => false)) input = pending;
  }
  if (!input) {
    throw retryableProjectUiError('PROJECT_NAME_INPUT_MISSING', 'ChatGPT visible project-name input not found');
  }
  await humanTypeInto(page, input, projectName, { delay: 55 });

  const submit = await firstVisible(page, [
    '[role="dialog"] button:has-text("Create project")',
    '[role="dialog"] button:has-text("Create")',
    'button:has-text("Create project")',
    'button[type="submit"]'
  ], 1200);
  if (!submit) {
    throw retryableProjectUiError('PROJECT_CREATE_SUBMIT_MISSING', 'ChatGPT project-create submit control not found');
  }

  const enableDeadline = Date.now() + 10000;
  while (Date.now() < enableDeadline && !await submit.isEnabled().catch(() => false)) {
    await page.waitForTimeout(250);
  }
  if (!await submit.isEnabled().catch(() => false)) {
    throw retryableProjectUiError('PROJECT_CREATE_SUBMIT_DISABLED', 'Visible ChatGPT project-create button never became enabled after human typing');
  }

  await humanPointerClick(page, submit, { hoverMs: 280, downMs: 75, settleMs: 420 });

  const closeDeadline = Date.now() + 10000;
  while (Date.now() < closeDeadline && await input.isVisible().catch(() => false)) {
    await page.waitForTimeout(250);
  }
  if (await input.isVisible().catch(() => false)) {
    throw retryableProjectUiError('PROJECT_CREATE_FORM_STILL_VISIBLE', 'Visible ChatGPT project-create form remained open after the normal Create click');
  }

  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    const entry = await findProjectEntry(page, projectName);
    if (entry) return entry;
    const heading = page.getByText(projectName, { exact: true }).first();
    if (await heading.isVisible().catch(() => false)) return null;
    await page.waitForTimeout(500);
  }
  throw retryableProjectUiError(
    'PROJECT_CREATE_VERIFICATION_MISSING',
    'ChatGPT project creation could not be verified through the visible UI after the create form closed; url=' + page.url()
  );
}

function validProjectUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return url.origin === 'https://chatgpt.com'
      && url.pathname !== '/'
      && !/^\/c\//.test(url.pathname);
  } catch {
    return false;
  }
}

async function openProjectEntry(page, projectName) {
  if (!projectName) throw new Error('chatgpt.open_project_by_name requires projectName');
  await ensureChatMode(page);
  await ensureSidebarOpen(page);
  let entry = await findProjectEntry(page, projectName);
  if (!entry) {
    await exposeProjectsInSidebar(page);
    entry = await findProjectEntry(page, projectName);
  }
  if (!entry) throw new Error('ChatGPT Project not found in sidebar: ' + projectName);
  await humanPointerClick(page, entry);
  await page.waitForTimeout(900);
  return { projectName, projectUrl: page.url(), created: false };
}

async function createProjectOnly(page, { projectName }) {
  if (!projectName) throw new Error('chatgpt.create_project requires projectName');
  await ensureChatMode(page);
  await ensureSidebarOpen(page);
  const existing = await findProjectEntry(page, projectName);
  if (existing) {
    // Recovery only: a prior Phase-1 attempt may have created the Project before
    // failing later. Re-open that exact Project rather than ever creating a duplicate.
    await humanPointerClick(page, existing);
    await page.waitForTimeout(900);
    return { projectName, projectUrl: page.url(), created: false, recoveredExisting: true };
  }
  const entry = await createProject(page, projectName);
  if (entry) {
    await humanPointerClick(page, entry);
    await page.waitForTimeout(900);
  }
  return { projectName, projectUrl: page.url(), created: true, recoveredExisting: false };
}

async function findProjectOverflowControl(page, projectName) {
  await ensureSidebarOpen(page);
  let entry = await findProjectEntry(page, projectName);
  if (!entry) {
    await exposeProjectsInSidebar(page);
    entry = await findProjectEntry(page, projectName);
  }
  if (!entry) throw new Error('ChatGPT Project not found while resolving share menu: ' + projectName);

  await entry.hover().catch(() => {});
  await page.waitForTimeout(350);

  const explicit = await firstVisible(page, [
    'button[aria-label*="project options" i]',
    'button[aria-label*="project menu" i]',
    'button[aria-label*="More" i]',
    '[role="button"][aria-label*="More" i]'
  ], 500);
  if (explicit) return explicit;

  let region = entry;
  for (let depth = 0; depth < 5; depth += 1) {
    region = region.locator('xpath=..');
    const button = region.locator('button:visible, [role="button"]:visible').last();
    if (await button.isVisible().catch(() => false)) return button;
  }
  throw new Error('ChatGPT Project overflow (three-dot) control not found for: ' + projectName);
}

async function captureProjectShareLink(page, { projectName }) {
  if (!projectName) throw new Error('chatgpt.capture_project_share_link requires projectName');

  const overflow = await findProjectOverflowControl(page, projectName);
  await humanPointerClick(page, overflow, { hoverMs: 220, downMs: 70, settleMs: 420 });

  const shareProject = await firstVisible(page, [
    '[role="menuitem"]:has-text("Share project")',
    '[role="menuitem"]:has-text("Share Project")',
    'button:has-text("Share project")',
    '[role="button"]:has-text("Share project")'
  ], 1800);
  if (!shareProject) throw new Error('ChatGPT "Share project" menu option not found');
  await humanPointerClick(page, shareProject, { hoverMs: 180, downMs: 65, settleMs: 520 });

  const shareLink = await firstVisible(page, [
    '[role="dialog"] button:has-text("Share link")',
    '[role="dialog"] [role="button"]:has-text("Share link")',
    'button:has-text("Share link")'
  ], 2200);
  if (!shareLink) throw new Error('ChatGPT Project "Share link" button not found');

  await humanPointerClick(page, shareLink, { hoverMs: 180, downMs: 65, settleMs: 420 });
  await page.waitForTimeout(250);

  const projectUrl = readOsClipboard();
  if (!validProjectUrl(projectUrl)) {
    const error = new Error('Project Share link did not place a valid ChatGPT Project URL on the OS clipboard');
    error.code = 'PROJECT_SHARE_URL_MISSING';
    error.retryable = true;
    throw error;
  }

  console.log('[browser-operations] project-share-url-captured=' + JSON.stringify({
    origin: new URL(projectUrl).origin,
    pathname: new URL(projectUrl).pathname
  }));
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(250);
  return { projectName, projectUrl, shared: true };
}

async function openProjectByUrl(page, { projectName, projectUrl }) {
  if (!validProjectUrl(projectUrl)) {
    if (!projectName) {
      const error = new Error('chatgpt.open_project_url requires a persisted ChatGPT Project URL or a recoverable projectName');
      error.code = 'PROJECT_URL_REQUIRED';
      error.retryable = false;
      throw error;
    }
    const recovered = await openProjectEntry(page, projectName);
    const shared = await captureProjectShareLink(page, { projectName });
    return { ...recovered, projectUrl: shared.projectUrl, recoveredProjectUrl: true };
  }
  await page.goto(projectUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(900);

  const challenge = !!await firstVisible(page, [
    'text=Verify you are human',
    'text=Checking your browser',
    'text=Just a moment',
    'text=security challenge'
  ], 250);
  if (challenge) {
    const error = new Error('Stored ChatGPT Project URL is behind a visible browser/security challenge');
    error.code = 'BROWSER_CHALLENGE';
    error.retryable = true;
    throw error;
  }
  const login = !!await firstVisible(page, [
    'text=Log in',
    'text=Sign up',
    'text=Continue with Google',
    'text=Welcome back'
  ], 250);
  if (login) {
    const error = new Error('Stored ChatGPT Project URL requires authentication');
    error.code = 'AUTH_REQUIRED';
    error.retryable = false;
    throw error;
  }

  return { projectName: projectName || '', projectUrl, created: false, openedByUrl: true };
}

async function findCurrentProjectNewChatControl(page, projectName) {
  const main = page.locator('main, [role="main"]').first();
  if (!await main.isVisible().catch(() => false)) return null;

  if (projectName) {
    const heading = main.getByText(projectName, { exact: true }).first();
    if (await heading.isVisible().catch(() => false)) {
      await heading.hover().catch(() => {});
      await page.waitForTimeout(250);
      let region = heading;
      for (let depth = 0; depth < 5; depth += 1) {
        region = region.locator('xpath=..');
        const explicit = region.locator([
          'button[aria-label*="New chat" i]',
          'button[aria-label*="Add chat" i]',
          'button[aria-label*="Create chat" i]',
          'button[aria-label*="Start chat" i]',
          '[role="button"][aria-label*="New chat" i]',
          '[role="button"][aria-label*="Add chat" i]'
        ].join(',')).first();
        if (await explicit.isVisible().catch(() => false)) return explicit;
      }
    }
  }

  return firstVisible(page, [
    'main button[aria-label*="New chat"]',
    'main button[aria-label*="Add chat"]',
    'main button[aria-label*="Create chat"]',
    'main button:has-text("New chat")',
    'main [role="button"]:has-text("New chat")',
    '[role="main"] button[aria-label*="New chat"]',
    '[role="main"] button[aria-label*="Add chat"]'
  ], 1500);
}

async function startCurrentProjectChat(page, { projectName = '', projectUrl = '' } = {}) {
  const newChat = await findCurrentProjectNewChatControl(page, projectName);
  if (newChat) {
    await humanPointerClick(page, newChat, { hoverMs: 180, downMs: 65, settleMs: 650 });
  } else {
    const existingComposer = await waitForComposer(page, 1200);
    const alreadyInConversation = /^https:\/\/chatgpt\.com\/c\/[A-Za-z0-9_-]+/.test(page.url());
    if (!existingComposer || alreadyInConversation) {
      const error = new Error('ChatGPT Project new-chat (+) control not found on a safe Project landing page; url=' + page.url());
      error.code = 'PROJECT_NEW_CHAT_CONTROL_MISSING';
      error.retryable = true;
      throw error;
    }
  }

  const composer = await waitForComposer(page, 12000);
  if (!composer) {
    const error = new Error('ChatGPT Project chat composer not found after starting a fresh Project chat');
    error.code = 'PROJECT_CHAT_COMPOSER_MISSING';
    error.retryable = true;
    throw error;
  }
  return { projectName, projectUrl: projectUrl || '', ready: true };
}

async function openCurrentChatMenu(page) {
  const current = new URL(page.url());
  const path = current.pathname;
  if (!/^\/c\/[A-Za-z0-9_-]+/.test(path)) return null;

  const anchor = page.locator(`a[href="${path}"]`).first();
  if (await anchor.isVisible().catch(() => false)) {
    await anchor.hover().catch(() => {});
    const row = anchor.locator('xpath=ancestor::*[self::li or @role="listitem" or @data-testid][1]');
    const button = row.locator('button').last();
    if (await button.isVisible().catch(() => false)) return button;
  }

  return firstVisible(page, [
    'button[aria-label*="conversation options"]',
    'button[aria-label*="chat options"]',
    'button[aria-label="More"]'
  ], 900);
}

async function renameCurrentChat(page, { chatName }) {
  if (!chatName) throw new Error('chatgpt.rename_current_chat requires chatName');
  if (!/^https:\/\/chatgpt\.com\/c\/[A-Za-z0-9_-]+/.test(page.url())) {
    throw new Error('Cannot rename ChatGPT chat before conversation URL exists');
  }

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const menu = await openCurrentChatMenu(page);
    if (menu) {
      await humanPointerClick(page, menu);
      const rename = await firstVisible(page, [
        '[role="menuitem"]:has-text("Rename")',
        'button:has-text("Rename")',
        '[role="menu"] :text("Rename")'
      ], 1200);
      if (rename) {
        await humanPointerClick(page, rename);
        const input = await firstVisible(page, [
          '[role="dialog"] input',
          'input[aria-label*="Rename"]',
          'input[value]'
        ], 1200);
        if (input) {
          await humanTypeInto(page, input, chatName, { delay: 45 });
          const save = await firstVisible(page, [
            '[role="dialog"] button:has-text("Save")',
            '[role="dialog"] button:has-text("Rename")',
            '[role="dialog"] button[type="submit"]'
          ], 1000);
          if (save) await humanPointerClick(page, save);
          else await input.press('Enter');
          await page.waitForTimeout(600);
          const named = page.getByText(chatName, { exact: true }).first();
          if (await named.isVisible().catch(() => false)) {
            return { chatName, renamed: true };
          }
        }
      }
    }
    await page.waitForTimeout(650);
  }
  return { chatName, renamed: false };
}

export const browserOperations = {
  'chatgpt.ensure_chat_mode': async ({ page }) => ensureChatMode(page),
  'chatgpt.ensure_thinking_effort': async ({ page, args }) => ensureThinkingEffort(page, args),
  'chatgpt.create_project': async ({ page, args }) => createProjectOnly(page, args),
  'chatgpt.capture_project_share_link': async ({ page, args }) => captureProjectShareLink(page, args),
  'chatgpt.open_project_url': async ({ page, args }) => openProjectByUrl(page, args),
  'chatgpt.open_project_by_name': async ({ page, args }) => openProjectEntry(page, args.projectName),
  'chatgpt.start_current_project_chat': async ({ page, args }) => startCurrentProjectChat(page, args),
  'chatgpt.rename_current_chat': async ({ page, args }) => renameCurrentChat(page, args),
};

export async function executeBrowserOperation({ page, name, args = {} }) {
  const operation = browserOperations[name];
  if (!operation) throw new Error(`Unsupported browser operation: ${name}`);
  return operation({ page, args });
}
