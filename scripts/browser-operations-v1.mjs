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

async function ensureThinkingEffort(page, { level = 'high' } = {}) {
  const normalized = String(level || '').trim().toLowerCase();
  if (normalized !== 'high') {
    throw new Error('chatgpt.ensure_thinking_effort currently requires level=high');
  }

  const highSelectors = [
    '[role="menuitemradio"]:has-text("High")',
    '[role="option"]:has-text("High")',
    '[role="radio"]:has-text("High")',
    '[role="menuitem"]:has-text("High")',
    'button:has-text("High")',
    'label:has-text("High")'
  ];

  const visibleHighChoice = async () => firstVisible(page, highSelectors, 650);

  // The current picker exposes a Power menu row with a keyboard-controlled
  // reasoning slider. Verify both its numeric endpoint and spoken High label.
  const powerRow = () => page.locator('[data-reasoning-slider="true"][role="menuitem"][aria-label="Power"]').first();
  const sliderHigh = async () => {
    const row = powerRow();
    if (!await row.isVisible().catch(() => false)) return false;
    const slider = row.locator('[role="slider"]').first();
    const current = await slider.getAttribute('aria-valuenow').catch(() => null);
    const max = await slider.getAttribute('aria-valuemax').catch(() => null);
    if (current === null || max === null || current !== max) return false;
    const describedBy = await row.getAttribute('aria-describedby').catch(() => '');
    for (const id of String(describedBy || '').split(/\s+/).filter(Boolean)) {
      if (!/^[A-Za-z0-9_-]+$/.test(id)) continue;
      const label = await page.locator('[id="' + id + '"]').innerText().catch(() => '');
      if (/^High(?:,|$)/i.test(label.trim())) return true;
    }
    return false;
  };
  const chooseSliderHigh = async () => {
    const row = powerRow();
    if (!await row.isVisible().catch(() => false)) return false;
    const slider = row.locator('[role="slider"]').first();
    const min = Number(await slider.getAttribute('aria-valuemin'));
    const max = Number(await slider.getAttribute('aria-valuemax'));
    let current = Number(await slider.getAttribute('aria-valuenow'));
    // Admit only the observed three-position Low/Medium/High widget.
    if (min !== 0 || max !== 2 || !Number.isInteger(current) || current < min || current > max) return false;
    for (let step = current; step < max; step += 1) {
      await row.press('ArrowRight');
      await page.waitForTimeout(200);
      const next = Number(await slider.getAttribute('aria-valuenow'));
      if (next !== current + 1) return false;
      current = next;
    }
    const verified = await sliderHigh();
    if (verified) await row.press('Escape');
    return verified;
  };

  const selectedHigh = async () => {
    if (await sliderHigh()) return true;
    const selectors = [
      '[role="menuitemradio"][aria-checked="true"]:has-text("High")',
      '[role="radio"][aria-checked="true"]:has-text("High")',
      '[role="option"][aria-selected="true"]:has-text("High")',
      '[aria-checked="true"]:has-text("High")',
      '[aria-selected="true"]:has-text("High")',
      '[aria-pressed="true"]:has-text("High")',
      '[data-state="checked"]:has-text("High")',
      '[data-state="active"]:has-text("High")'
    ];
    if (await firstVisible(page, selectors, 450)) return true;

    // After selection, current ChatGPT variants may collapse the menu and show
    // the effort as a compact "High" control beside the composer/model button.
    const openPicker = await firstVisible(page, [
      '[role="menu"]:visible',
      '[role="listbox"]:visible',
      '[data-radix-menu-content]:visible'
    ], 150);
    if (!openPicker) {
      const controls = page.locator('button, [role="button"]');
      const count = Math.min(await controls.count().catch(() => 0), 100);
      for (let i = 0; i < count; i += 1) {
        const control = controls.nth(i);
        if (!await control.isVisible().catch(() => false)) continue;
        const text = (await control.innerText().catch(() => '')).trim();
        const attrs = [
          await control.getAttribute('aria-label').catch(() => ''),
          await control.getAttribute('title').catch(() => ''),
          await control.getAttribute('data-testid').catch(() => '')
        ].filter(Boolean).join(' ');
        if (/^High$/i.test(text) || /(?:thinking|reasoning|effort)[^\n]*\bHigh\b/i.test(text + ' ' + attrs)) return true;
      }
    }
    return false;
  };

  if (await selectedHigh()) return { level: 'high', changed: false, verified: true };

  const openerSelectors = [
    'button[aria-label*="thinking" i]',
    'button[aria-label*="reasoning" i]',
    'button[aria-label*="effort" i]',
    'button[data-testid*="thinking" i]',
    'button[data-testid*="model" i]',
    'button[aria-label*="model" i]',
    'button[aria-haspopup="menu"]:has-text("GPT")',
    'button:has-text("GPT-5.6")',
    'button:has-text("GPT-5")',
    'button:has-text("Thinking")',
    'button:has-text("Think")',
    'button:has-text("Reasoning")',
    'button:has-text("Instant")',
    'button:has-text("Medium")'
  ];

  const chooseHigh = async () => {
    if (await chooseSliderHigh()) return true;
    const high = await visibleHighChoice();
    if (!high) return false;
    await high.click();
    await page.waitForTimeout(700);
    if (await selectedHigh()) return true;

    // Some menu implementations keep the picker open after the click. In that
    // case verify selection state on the option or its nearest interactive row.
    const candidates = [
      high,
      high.locator('xpath=ancestor-or-self::*[@role="menuitemradio" or @role="radio" or @role="option" or @role="menuitem"][1]'),
      high.locator('xpath=ancestor-or-self::*[@data-state][1]')
    ];
    for (const candidate of candidates) {
      for (const [name, expected] of [['aria-checked','true'],['aria-selected','true'],['aria-pressed','true'],['data-state','checked'],['data-state','active']]) {
        const value = await candidate.getAttribute(name).catch(() => null);
        if (value === expected) return true;
      }
    }
    return false;
  };

  const submenuLabels = ['Thinking', 'Think', 'Reasoning', 'Thinking time', 'Reasoning effort'];
  for (let depth = 0; depth < 3; depth += 1) {
    if (await chooseHigh()) return { level: 'high', changed: true, verified: true };

    const opener = await firstVisible(page, openerSelectors, 1200);
    if (opener) {
      await opener.click();
      await page.waitForTimeout(550);
      if (await chooseHigh()) return { level: 'high', changed: true, verified: true };
    }

    let openedSubmenu = false;
    for (const label of submenuLabels) {
      const submenu = page.getByText(label, { exact: true }).first();
      if (await submenu.isVisible().catch(() => false)) {
        await submenu.click();
        await page.waitForTimeout(500);
        openedSubmenu = true;
        if (await chooseHigh()) return { level: 'high', changed: true, verified: true };
      }
    }
    if (!opener && !openedSubmenu) break;
  }

  const diagnostic = [];
  const controls = page.locator('button, [role="button"], [role="menuitem"], [role="menuitemradio"], [role="option"], [role="radio"]');
  const count = Math.min(await controls.count().catch(() => 0), 120);
  for (let i = 0; i < count && diagnostic.length < 40; i += 1) {
    const control = controls.nth(i);
    if (!await control.isVisible().catch(() => false)) continue;
    const text = (await control.innerText().catch(() => '')).trim().replace(/\s+/g, ' ').slice(0, 140);
    const label = (await control.getAttribute('aria-label').catch(() => '') || '').trim().slice(0, 140);
    const role = (await control.getAttribute('role').catch(() => '') || '').trim();
    if (text || label) diagnostic.push({ role, text, label });
  }
  const bodyText = await page.locator('body').innerText().catch(() => '');
  const relevantText = bodyText.split(/\n+/).map(x => x.trim()).filter(x => /High|Think|Reason|GPT-5|Instant|Medium/i.test(x)).slice(0, 40);
  // Capture only effort-widget structure, never authentication/session data.
  const effortWidget = await page.locator('[role="slider"], input[type="range"], [aria-valuetext], [aria-label*="effort" i]')
    .evaluateAll(elements => elements.filter(el => el.getClientRects().length).map(el => ({
      tag: el.tagName, role: el.getAttribute('role'), label: el.getAttribute('aria-label'),
      min: el.getAttribute('aria-valuemin') || el.getAttribute('min'),
      max: el.getAttribute('aria-valuemax') || el.getAttribute('max'),
      value: el.getAttribute('aria-valuenow') || el.getAttribute('value'),
      valueText: el.getAttribute('aria-valuetext'),
    }))).catch(() => []);
  const error = new Error(
    'ChatGPT High thinking-effort control could not be selected and verified; effortWidget=' +
    JSON.stringify(effortWidget) + '; visibleControls=' +
    JSON.stringify(diagnostic) + '; relevantText=' + JSON.stringify(relevantText)
  );
  error.code = 'THINKING_EFFORT_UI_CHANGED';
  error.retryable = true;
  throw error;
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
    await open.click().catch(() => {});
    await page.waitForTimeout(700);
    return { opened: true };
  }
  return { opened: false };
}

async function findSemanticProjectAction(page) {
  const candidates = page.locator('button, a, [role="button"]');
  const count = Math.min(await candidates.count().catch(() => 0), 160);
  for (let i = 0; i < count; i += 1) {
    const candidate = candidates.nth(i);
    if (!await candidate.isVisible().catch(() => false)) continue;
    const attrs = [
      await candidate.innerText().catch(() => ''),
      await candidate.getAttribute('aria-label').catch(() => ''),
      await candidate.getAttribute('title').catch(() => ''),
      await candidate.getAttribute('data-testid').catch(() => '')
    ].filter(Boolean).join(' ').trim();
    if (/\b(?:new|add|create)\b[^\n]{0,40}\bproject\b|\bproject\b[^\n]{0,40}\b(?:new|add|create)\b/i.test(attrs)) {
      return candidate;
    }
  }
  return null;
}

async function visibleNavigationDiagnostics(page) {
  return page.locator('button, a, [role="button"]').evaluateAll(nodes =>
    nodes.filter(el => el.getClientRects().length).slice(0, 120).map(el => ({
      tag: el.tagName,
      text: String(el.innerText || '').trim().slice(0, 90),
      aria: el.getAttribute('aria-label'),
      title: el.getAttribute('title'),
      testid: el.getAttribute('data-testid'),
      href: (() => {
        const raw = el.getAttribute('href') || '';
        return raw.replace(/[a-f0-9]{8}-[a-f0-9-]{12,}/gi, '<id>').slice(0, 140);
      })()
    }))
  ).catch(() => []);
}

async function exposeProjectsInSidebar(page) {
  // 2026 web sidebar redesign can hide Projects from the top-level navigation.
  // Recover through the visible Recents/sidebar organization controls rather than
  // assuming Projects was removed or bypassing project creation.
  const recents = await firstVisible(page, [
    'button[aria-label="Recents"]',
    'button:has-text("Recents")',
    '[role="button"]:has-text("Recents")'
  ], 700);
  if (recents) {
    await recents.click().catch(() => {});
    await page.waitForTimeout(650);
  }

  let organize = await firstVisible(page, [
    'button:has-text("Organize sidebar")',
    '[role="menuitem"]:has-text("Organize sidebar")',
    '[role="button"]:has-text("Organize sidebar")',
    'button[aria-label*="Organize sidebar" i]'
  ], 700);

  if (!organize) {
    // Some variants expose the organizer from an adjacent overflow button.
    const controls = page.locator('button, [role="button"]');
    const count = Math.min(await controls.count().catch(() => 0), 120);
    for (let i = 0; i < count && !organize; i += 1) {
      const control = controls.nth(i);
      if (!await control.isVisible().catch(() => false)) continue;
      const attrs = [
        await control.innerText().catch(() => ''),
        await control.getAttribute('aria-label').catch(() => ''),
        await control.getAttribute('title').catch(() => '')
      ].filter(Boolean).join(' ');
      if (/organize.*sidebar/i.test(attrs)) organize = control;
    }
  }

  if (organize) {
    await organize.click().catch(() => {});
    await page.waitForTimeout(600);
  }

  const projectsOption = await firstVisible(page, [
    '[role="menuitemcheckbox"]:has-text("Projects")',
    '[role="menuitem"]:has-text("Projects")',
    '[role="checkbox"]:has-text("Projects")',
    'label:has-text("Projects")',
    'button:has-text("Projects")'
  ], 900);

  if (projectsOption) {
    const checked = await projectsOption.getAttribute('aria-checked').catch(() => null);
    const selected = await projectsOption.getAttribute('aria-selected').catch(() => null);
    const state = await projectsOption.getAttribute('data-state').catch(() => null);
    if (checked !== 'true' && selected !== 'true' && state !== 'checked') {
      await projectsOption.click().catch(() => projectsOption.press('Enter').catch(() => {}));
      await page.waitForTimeout(800);
    } else {
      await projectsOption.press('Escape').catch(() => {});
      await page.waitForTimeout(300);
    }
  }

  await ensureSidebarOpen(page);
  const visible = await page.getByText('Projects', { exact: true }).first().isVisible().catch(() => false);
  console.log('[browser-operations] sidebar-projects-recovery=' + JSON.stringify({
    recentsVisible: Boolean(recents),
    organizerFound: Boolean(organize),
    projectsOptionFound: Boolean(projectsOption),
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
  const projectNetworkFailures = [];
  const recordResponse = response => {
    try {
      const url = new URL(response.url());
      if (url.hostname === 'chatgpt.com' && response.status() >= 400) {
        projectNetworkFailures.push({ status: response.status(), path: url.pathname.replace(/[a-f0-9]{8}-[a-f0-9-]{12,}/gi, '<id>') });
      }
    } catch {}
  };
  page.on('response', recordResponse);
  await ensureSidebarOpen(page);

  let trigger = await findNewProjectControl(page);
  if (!trigger) {
    await exposeProjectsInSidebar(page);
    trigger = await findNewProjectControl(page);
  }
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
    const controls = await visibleNavigationDiagnostics(page);
    throw new Error(
      'ChatGPT project creation control not found' +
      ' (sidebarToggleVisible=' + sidebarToggleVisible +
      ', projectsVisible=' + projectsVisible +
      ', newProjectTextVisible=' + newProjectTextVisible +
      ', url=' + page.url() +
      ', visibleControls=' + JSON.stringify(controls) + ')'
    );
  }

  const triggerLabel = await trigger.getAttribute('aria-label').catch(() => '');
  // Current sidebar paints overlapping section layers above the add button.
  // Its standard keyboard activation remains available and avoids misclicks.
  if (triggerLabel === 'Add new project') await trigger.press('Enter');
  else await trigger.click();
  await page.waitForTimeout(500);

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
    const fields = await page.locator('input, textarea, [role="dialog"]').evaluateAll(nodes => nodes.filter(el => el.getClientRects().length).map(el => ({
      tag: el.tagName, type: el.getAttribute('type'), role: el.getAttribute('role'),
      label: el.getAttribute('aria-label'), placeholder: el.getAttribute('placeholder'), name: el.getAttribute('name'),
    }))).catch(() => []);
    throw new Error('ChatGPT project-name input not found; visibleFieldStructure=' + JSON.stringify(fields));
  }
  await input.fill(projectName);

  const submit = await firstVisible(page, [
    '[role="dialog"] button:has-text("Create project")',
    '[role="dialog"] button:has-text("Create")',
    'button:has-text("Create project")',
    'button[type="submit"]'
  ], 1200);
  if (!submit) throw new Error('ChatGPT project-create submit control not found');

  const projectCreateResponse = page.waitForResponse(response => {
    try {
      const url = new URL(response.url());
      return url.origin === 'https://chatgpt.com' &&
        url.pathname === '/backend-api/projects' &&
        response.request().method() === 'POST';
    } catch { return false; }
  }, { timeout: 20000 }).catch(() => null);

  await submit.click();

  const createResponse = await projectCreateResponse;
  if (createResponse) {
    const status = createResponse.status();
    const cfMitigated = await createResponse.headerValue('cf-mitigated').catch(() => null);
    const server = await createResponse.headerValue('server').catch(() => null);
    const contentType = await createResponse.headerValue('content-type').catch(() => null);
    let safeBody = '';
    if (status >= 400) {
      const raw = await createResponse.text().catch(() => '');
      if (/json|text/i.test(contentType || '')) {
        safeBody = raw.replace(/[A-Za-z0-9_-]{32,}/g, '<redacted>').slice(0, 1200);
      }
    }
    const diagnostics = { status, cfMitigated, server, contentType, safeBody };
    console.log('[browser-operations] project-create-response=' + JSON.stringify(diagnostics));
    if (status >= 400) {
      const error = new Error('ChatGPT project create HTTP ' + status + ': ' + JSON.stringify(diagnostics));
      if (cfMitigated === 'challenge') {
        error.code = 'BROWSER_CHALLENGE';
        error.retryable = true;
      } else {
        error.code = 'PROJECT_CREATE_REJECTED';
        error.retryable = false;
      }
      throw error;
    }
  }

  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    const entry = await findProjectEntry(page, projectName);
    if (entry) return entry;
    if (/chatgpt\.com\//.test(page.url())) {
      const heading = page.getByText(projectName, { exact: true }).first();
      if (await heading.isVisible().catch(() => false)) return null;
    }
    await page.waitForTimeout(500);
  }
  const alerts = await page.locator('[role="alert"]').allTextContents().catch(() => []);
  throw new Error('ChatGPT project creation could not be verified; url=' + page.url() +
    '; formStillVisible=' + await input.isVisible().catch(() => false) +
    '; alerts=' + JSON.stringify(alerts.map(text => text.slice(0, 250))) +
    '; failedResponses=' + JSON.stringify(projectNetworkFailures.slice(-10)));

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
  'chatgpt.ensure_thinking_effort': async ({ page, args }) => ensureThinkingEffort(page, args),
  'chatgpt.ensure_project': async ({ page, args }) => ensureProject(page, args),
  'chatgpt.start_project_chat': async ({ page, args }) => startProjectChat(page, args),
  'chatgpt.rename_current_chat': async ({ page, args }) => renameCurrentChat(page, args),
};

export async function executeBrowserOperation({ page, name, args = {} }) {
  const operation = browserOperations[name];
  if (!operation) throw new Error(`Unsupported browser operation: ${name}`);
  return operation({ page, args });
}
