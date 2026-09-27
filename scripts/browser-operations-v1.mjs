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
    for (const selector of PROJECT_LINK_PATTERNS) {
      const locator = page.locator(selector).filter({ hasText: text }).first();
      try {
        if (await locator.isVisible({ timeout })) {
          if (!exact) return locator;
          const observed = (await locator.innerText().catch(() => '')).trim();
          if (observed === text) return locator;
        }
      } catch {}
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
  if (!workSelected) return { mode: 'chat', changed: false };

  const chat = await firstVisible(page, [
    '[role="tab"]:has-text("Chat")',
    'button:has-text("Chat")'
  ], 1000);
  if (!chat) throw new Error('ChatGPT Chat mode control not found while Work mode appears active');
  await chat.click();
  await page.waitForTimeout(600);
  return { mode: 'chat', changed: true };
}

async function ensureSidebarOpen(page) {
  const open = await firstVisible(page, [
    'button[data-testid="open-sidebar-button"]',
    'button[aria-label="Open sidebar"]',
    'button[aria-label*="Open sidebar"]',
    'button[aria-label*="Show sidebar"]',
    'button[title*="sidebar"]'
  ], 500);
  if (open) {
    await open.click().catch(() => {});
    await page.waitForTimeout(700);
    return { opened: true };
  }
  return { opened: false };
}

async function findNewProjectControl(page) {
  const direct = await firstVisible(page, [
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

  let region = projects;
  for (let depth = 0; depth < 5; depth += 1) {
    region = region.locator('xpath=..');
    const candidates = region.locator('button, [role="button"], a');
    const count = Math.min(await candidates.count().catch(() => 0), 8);

    // Prefer a semantically labelled add/create-project control.
    for (let i = 0; i < count; i += 1) {
      const candidate = candidates.nth(i);
      if (!await candidate.isVisible().catch(() => false)) continue;
      const label = [
        await candidate.getAttribute('aria-label').catch(() => ''),
        await candidate.getAttribute('title').catch(() => ''),
      ].filter(Boolean).join(' ');
      if (/(new|add|create).*project|project.*(new|add|create)/i.test(label)) return candidate;
    }

    // Current ChatGPT may render the add control as an icon-only button next
    // to the Projects heading. Only accept such a control in a very small
    // nearest ancestor, never from the whole sidebar.
    if (count > 0 && count <= 3) {
      for (let i = 0; i < count; i += 1) {
        const candidate = candidates.nth(i);
        if (!await candidate.isVisible().catch(() => false)) continue;
        const text = (await candidate.innerText().catch(() => '')).trim();
        const box = await candidate.boundingBox().catch(() => null);
        if (text === '' && box && box.width <= 56 && box.height <= 56) return candidate;
      }
    }
  }
  return null;
}

async function createProject(page, projectName) {
  await ensureSidebarOpen(page);

  let trigger = await findNewProjectControl(page);
  if (!trigger) {
    const projects = page.getByText('Projects', { exact: true }).first();
    if (await projects.isVisible().catch(() => false)) {
      const sectionAdd = await findProjectsSectionAddControl(page);
      if (sectionAdd) {
        trigger = sectionAdd;
      } else {
        await projects.click().catch(() => {});
        await page.waitForTimeout(600);
        trigger = await findNewProjectControl(page);
      }
    }
  }

  if (!trigger) {
    const sidebarToggleVisible = !!await firstVisible(page, [
      'button[data-testid="open-sidebar-button"]',
      'button[aria-label*="Open sidebar"]',
      'button[aria-label*="Show sidebar"]'
    ], 250);
    const projectsVisible = await page.getByText('Projects', { exact: true }).first().isVisible().catch(() => false);
    const newProjectTextVisible = await page.getByText('New project', { exact: true }).first().isVisible().catch(() => false);
    throw new Error(
      'ChatGPT project creation control not found' +
      ' (sidebarToggleVisible=' + sidebarToggleVisible +
      ', projectsVisible=' + projectsVisible +
      ', newProjectTextVisible=' + newProjectTextVisible + ')'
    );
  }

  await trigger.click();
  await page.waitForTimeout(500);

  const input = await firstVisible(page, [
    'input[placeholder*="Project name"]',
    'input[aria-label*="Project name"]',
    'input[name="name"]',
    '[role="dialog"] input'
  ], 2200);
  if (!input) throw new Error('ChatGPT project-name input not found');
  await input.fill(projectName);

  const submit = await firstVisible(page, [
    '[role="dialog"] button:has-text("Create project")',
    '[role="dialog"] button:has-text("Create")',
    'button:has-text("Create project")',
    'button[type="submit"]'
  ], 1200);
  if (!submit) throw new Error('ChatGPT project-create submit control not found');
  await submit.click();

  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    const entry = await findProjectEntry(page, projectName);
    if (entry) return entry;
    if (/chatgpt\.com\//.test(page.url())) {
      const heading = page.getByText(projectName, { exact: true }).first();
      if (await heading.isVisible().catch(() => false)) return null;
    }
    await page.waitForTimeout(500);
  }
  throw new Error('ChatGPT project creation could not be verified');
}

async function ensureProject(page, { projectName }) {
  if (!projectName) throw new Error('chatgpt.ensure_project requires projectName');
  await ensureChatMode(page);

  let entry = await findProjectEntry(page, projectName);
  let created = false;
  if (!entry) {
    entry = await createProject(page, projectName);
    created = true;
  }

  if (entry) {
    await entry.click();
    await page.waitForTimeout(900);
  }

  const visibleName = page.getByText(projectName, { exact: true }).first();
  if (!await visibleName.isVisible().catch(() => false)) {
    const refreshedEntry = await findProjectEntry(page, projectName);
    if (refreshedEntry) {
      await refreshedEntry.click();
      await page.waitForTimeout(900);
    }
  }

  return {
    projectName,
    projectUrl: page.url(),
    created,
  };
}

async function startProjectChat(page, { projectName }) {
  if (projectName) {
    const project = await ensureProject(page, { projectName });
    const newChat = await firstVisible(page, [
      'button[aria-label*="New chat"]',
      'button:has-text("New chat")',
      'a:has-text("New chat")',
      '[role="button"]:has-text("New chat")'
    ], 1200);
    if (newChat) {
      await newChat.click();
      await page.waitForTimeout(700);
    }
    const composer = await waitForComposer(page, 12000);
    if (!composer) throw new Error('ChatGPT project chat composer not found');
    return { ...project, ready: true };
  }
  const composer = await waitForComposer(page, 12000);
  if (!composer) throw new Error('ChatGPT composer not found');
  return { projectName: '', projectUrl: '', ready: true };
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
      await menu.click();
      const rename = await firstVisible(page, [
        '[role="menuitem"]:has-text("Rename")',
        'button:has-text("Rename")',
        '[role="menu"] :text("Rename")'
      ], 1200);
      if (rename) {
        await rename.click();
        const input = await firstVisible(page, [
          '[role="dialog"] input',
          'input[aria-label*="Rename"]',
          'input[value]'
        ], 1200);
        if (input) {
          await input.fill(chatName);
          const save = await firstVisible(page, [
            '[role="dialog"] button:has-text("Save")',
            '[role="dialog"] button:has-text("Rename")',
            '[role="dialog"] button[type="submit"]'
          ], 1000);
          if (save) await save.click();
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
  'chatgpt.ensure_project': async ({ page, args }) => ensureProject(page, args),
  'chatgpt.start_project_chat': async ({ page, args }) => startProjectChat(page, args),
  'chatgpt.rename_current_chat': async ({ page, args }) => renameCurrentChat(page, args),
};

export async function executeBrowserOperation({ page, name, args = {} }) {
  const operation = browserOperations[name];
  if (!operation) throw new Error(`Unsupported browser operation: ${name}`);
  return operation({ page, args });
}
