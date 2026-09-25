#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

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

async function importBrowserRuntimeModule(specifier) {
  const runtimeRoot = env.BROWSER_AGENT_RUNTIME_ROOT || '';
  if (!runtimeRoot) return import(specifier);
  const runtimeRequire = createRequire(path.join(runtimeRoot, 'package.json'));
  const resolved = runtimeRequire.resolve(specifier);
  return import(pathToFileURL(resolved).href);
}

async function loadModules() {
  const [{ chromium }, browserbaseMod] = await Promise.all([
    importBrowserRuntimeModule('playwright-core'),
    importBrowserRuntimeModule('@browserbasehq/sdk').catch(() => ({ default: null })),
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

async function post(page, message) {
  if (!message) throw new Error('Wake message is empty');
  const composer = await ensureComposer(page);
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
  const send = await firstVisible(page, [
    'button[data-testid="send-button"]',
    'button[aria-label*="Send"]'
  ]);
  if (send) await send.click();
  else await composer.press('Enter');
  await page.waitForTimeout(1200);
  const needle = message.slice(0, Math.min(80, message.length));
  const visible = await page.getByText(needle, { exact: false }).count().catch(() => 0);
  if (!visible) throw new Error('Wake message submission could not be verified');
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
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
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
