#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs/promises';

const env = process.env;
const action = env.WAKE_ACTION || 'wake';
const mode = env.WAKE_MODE || 'resume_existing';
const wakeId = env.WAKE_ID || crypto.randomUUID();
const wakeMessage = env.WAKE_MESSAGE || '';
const requestedUrl = env.CHAT_URL || '';
const statePath = env.WAKE_RESULT_PATH || '/tmp/browser-agent-wake-result.json';

function sha(text='') {
  return crypto.createHash('sha256').update(text).digest('hex');
}
function bool(v) { return String(v || '').toLowerCase() === 'true'; }

async function loadModules() {
  const [{ chromium }, browserbaseMod] = await Promise.all([
    import('playwright-core'),
    import('@browserbasehq/sdk').catch(() => ({ default: null })),
  ]);
  return { chromium, Browserbase: browserbaseMod.Browserbase || browserbaseMod.default || null };
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
  const assistant = page.locator('[data-message-author-role="assistant"]');
  const user = page.locator('[data-message-author-role="user"]');
  const aCount = await assistant.count().catch(() => 0);
  const uCount = await user.count().catch(() => 0);
  let last = '';
  if (aCount) last = await assistant.nth(aCount - 1).innerText().catch(() => '');
  return {
    generating: !!stop,
    assistantCount: aCount,
    userCount: uCount,
    lastAssistantHash: sha(last),
    lastAssistantLength: last.length,
    url: page.url(),
  };
}

async function ensureComposer(page) {
  const composer = await firstVisible(page, [
    '#prompt-textarea',
    'textarea[placeholder*="Message"]',
    '[contenteditable="true"][data-lexical-editor="true"]',
    '[contenteditable="true"]'
  ]);
  if (!composer) throw new Error('ChatGPT composer not found');
  return composer;
}

async function composerText(composer) {
  return composer.evaluate((el) => {
    if ('value' in el && typeof el.value === 'string') return el.value;
    return (el.innerText || el.textContent || '').replace(/\\u00a0/g, ' ');
  }).catch(() => '');
}

async function sentTurnWitness(page, message) {
  const needle = message.slice(0, Math.min(96, message.length));
  const selectors = [
    '[data-message-author-role="user"]',
    '[data-testid^="conversation-turn-"]',
    'article'
  ];
  for (const selector of selectors) {
    const loc = page.locator(selector);
    const count = await loc.count().catch(() => 0);
    for (let i = Math.max(0, count - 6); i < count; i++) {
      const text = await loc.nth(i).innerText().catch(() => '');
      if (text.includes(needle)) return { selector, index: i, textLength: text.length };
    }
  }
  return null;
}

async function post(page, message) {
  if (!message) throw new Error('Wake message is empty');

  const composer = await ensureComposer(page);
  const beforeTurnCount = await page.locator('[data-testid^="conversation-turn-"]').count().catch(() => 0);
  const beforeUserCount = await page.locator('[data-message-author-role="user"]').count().catch(() => 0);

  await composer.click();
  const tag = await composer.evaluate(el => el.tagName.toLowerCase());
  if (tag === 'textarea' || tag === 'input') {
    await composer.fill(message);
  } else {
    await composer.fill(message).catch(async () => {
      await composer.press('Control+A').catch(()=>{});
      await composer.press('Meta+A').catch(()=>{});
      await composer.press('Backspace').catch(()=>{});
      await composer.type(message, { delay: 1 });
    });
  }

  const filled = await composerText(composer);
  if (!filled.includes(message.slice(0, Math.min(64, message.length)))) {
    throw new Error('Composer fill could not be verified');
  }

  const sendSelectors = [
    'button[data-testid="send-button"]',
    'button[data-testid="composer-submit-button"]',
    'button[aria-label="Send prompt"]',
    'button[aria-label*="Send"]'
  ];
  let send = await firstVisible(page, sendSelectors);

  if (send) {
    const disabled = await send.isDisabled().catch(() => false);
    console.log('[delivery-debug] sendButton=' + JSON.stringify({
      disabled,
      testid: await send.getAttribute('data-testid').catch(() => null),
      aria: await send.getAttribute('aria-label').catch(() => null)
    }));
    if (disabled) throw new Error('Visible send button is disabled after composer fill');
    await send.click();
  } else {
    console.log('[delivery-debug] no visible send button; pressing Enter on composer');
    await composer.press('Enter');
  }

  const deadline = Date.now() + 15000;
  let lastComposerText = '';
  let witness = null;
  let afterTurnCount = beforeTurnCount;
  let afterUserCount = beforeUserCount;
  let generating = false;

  while (Date.now() < deadline) {
    await page.waitForTimeout(500);
    lastComposerText = await composerText(composer);
    witness = await sentTurnWitness(page, message);
    afterTurnCount = await page.locator('[data-testid^="conversation-turn-"]').count().catch(() => beforeTurnCount);
    afterUserCount = await page.locator('[data-message-author-role="user"]').count().catch(() => beforeUserCount);
    generating = !!(await firstVisible(page, [
      'button[data-testid="stop-button"]',
      'button[aria-label*="Stop"]',
      'button:has-text("Stop generating")'
    ]));
    const composerCleared = !lastComposerText.trim();
    const countAdvanced = afterTurnCount > beforeTurnCount || afterUserCount > beforeUserCount;
    if (composerCleared && (witness || countAdvanced || generating)) {
      console.log('[delivery-debug] submissionVerified=' + JSON.stringify({
        composerCleared,
        witness,
        beforeTurnCount,
        afterTurnCount,
        beforeUserCount,
        afterUserCount,
        generating
      }));
      return;
    }
  }

  const body = await page.locator('main').innerText().catch(() => '');
  const buttons = await page.locator('button').evaluateAll((els) => els.slice(-30).map((el) => ({
    text: (el.innerText || '').slice(0, 80),
    aria: el.getAttribute('aria-label'),
    testid: el.getAttribute('data-testid'),
    disabled: el.disabled
  }))).catch(() => []);

  console.log('[delivery-debug] submissionFailed=' + JSON.stringify({
    composerTextLength: lastComposerText.length,
    composerTextPrefix: lastComposerText.slice(0, 80),
    witness,
    beforeTurnCount,
    afterTurnCount,
    beforeUserCount,
    afterUserCount,
    generating,
    url: page.url(),
    mainTextTail: body.slice(-1200),
    buttons
  }));

  throw new Error('Wake message submission not durably verified: composer did not clear with a new sent-message witness');
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
    const before = await snapshot(page);

    if (action === 'observe') {
      const result = { ok: true, provider: providerName, action, wakeId, ...before };
      await fs.writeFile(statePath, JSON.stringify(result, null, 2) + '\n');
      return result;
    }

    if (before.generating && !bool(env.FORCE_WAKE)) {
      const result = { ok: true, provider: providerName, action, wakeId, skipped: 'PRODUCTIVE_GENERATING', ...before };
      await fs.writeFile(statePath, JSON.stringify(result, null, 2) + '\n');
      return result;
    }

    await post(page, wakeMessage);
    await page.waitForTimeout(1500);
    const after = await snapshot(page);

    if (mode === 'create_fresh' && !/^https:\/\/chatgpt\.com\/c\/[A-Za-z0-9_-]+/.test(after.url)) {
      await page.waitForURL(/https:\/\/chatgpt\.com\/c\//, { timeout: 15000 }).catch(()=>{});
      after.url = page.url();
    }

    const result = { ok: true, provider: providerName, action, wakeId, posted: true, before, after, chatUrl: after.url };
    await fs.writeFile(statePath, JSON.stringify(result, null, 2) + '\n');
    return result;
  } finally {
    await close().catch(()=>{});
  }
}

async function localProvider(chromium) {
  const storage = env.CHATGPT_STORAGE_STATE_B64
    ? JSON.parse(Buffer.from(env.CHATGPT_STORAGE_STATE_B64, 'base64').toString('utf8'))
    : undefined;
  if (!storage) throw new Error('CHATGPT_STORAGE_STATE_B64 missing');
  const browser = await chromium.launch({ headless: env.BROWSER_HEADLESS !== 'false', channel: 'chrome' });
  const context = await browser.newContext({ storageState: storage });
  const page = await context.newPage();
  return { browser, context, page, close: () => browser.close() };
}

async function browserlessProvider(chromium) {
  if (!env.BROWSERLESS_TOKEN) throw new Error('BROWSERLESS_TOKEN missing');
  const profile = encodeURIComponent(env.BROWSERLESS_PROFILE || 'chatgpt');
  const ws = 'wss://production-sfo.browserless.io?token=' +
    encodeURIComponent(env.BROWSERLESS_TOKEN) + '&profile=' + profile;
  const browser = await chromium.connectOverCDP(ws);
  const context = browser.contexts()[0] || await browser.newContext();
  const page = context.pages()[0] || await context.newPage();
  return { browser, context, page, close: () => browser.close() };
}

async function browserbaseProvider(chromium, Browserbase) {
  if (!Browserbase) throw new Error('Browserbase SDK unavailable');
  if (!env.BROWSERBASE_API_KEY || !env.BROWSERBASE_PROJECT_ID || !env.BROWSERBASE_CONTEXT_ID) {
    throw new Error('Browserbase credentials/context missing');
  }
  const bb = new Browserbase({ apiKey: env.BROWSERBASE_API_KEY });
  const session = await bb.sessions.create({
    projectId: env.BROWSERBASE_PROJECT_ID,
    browserContext: { id: env.BROWSERBASE_CONTEXT_ID, persist: true },
  });
  const browser = await chromium.connectOverCDP(session.connectUrl);
  const context = browser.contexts()[0];
  const page = context.pages()[0] || await context.newPage();
  return { browser, context, page, close: () => browser.close() };
}

const { chromium, Browserbase } = await loadModules();
const providers = [
  ['github-playwright', () => localProvider(chromium)],
  ['browserless', () => browserlessProvider(chromium)],
  ['browserbase', () => browserbaseProvider(chromium, Browserbase)],
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
