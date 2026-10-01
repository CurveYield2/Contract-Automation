#!/usr/bin/env node
import os from 'node:os';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const env = process.env;

function required(name) {
  const value = String(env[name] || '').trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

const runtimeRoot = required('BROWSER_AGENT_RUNTIME_ROOT');
const requestPath = required('SELF_HOSTED_BROWSER_REQUEST');
const request = JSON.parse(await fs.readFile(requestPath, 'utf8'));

const action = String(request.action || 'authenticate_and_send');
const chatUrl = String(request.chat_url || '').trim();
const wakeMessage = String(request.wake_message || '').trim();
const manualWaitSeconds = Number(request.manual_auth_wait_seconds || 900);
const pollMs = Number(request.poll_ms || 5000);

if (!['authenticate_only', 'authenticate_and_send', 'resume_existing'].includes(action)) {
  throw new Error(`Unsupported action: ${action}`);
}
if (action !== 'authenticate_only' && !/^https:\/\/chatgpt\.com\/c\/[A-Za-z0-9_-]+\/?$/.test(chatUrl)) {
  throw new Error('chat_url must be a durable https://chatgpt.com/c/... URL');
}
if (action !== 'authenticate_only' && !wakeMessage) {
  throw new Error('wake_message is required for send actions');
}

const runtimeRequire = createRequire(path.join(runtimeRoot, 'package.json'));
const playwrightModule = await import(pathToFileURL(runtimeRequire.resolve('playwright-core')).href);
const first = playwrightModule.default && typeof playwrightModule.default === 'object'
  ? playwrightModule.default
  : playwrightModule;
const second = first.default && typeof first.default === 'object' ? first.default : first;
const chromium = playwrightModule.chromium || first.chromium || second.chromium;
if (!chromium || typeof chromium.launchPersistentContext !== 'function') {
  throw new Error('playwright-core chromium persistent-context launcher unavailable');
}

const profileDir = env.CURVEYIELD_CHATGPT_PROFILE_DIR
  ? path.resolve(env.CURVEYIELD_CHATGPT_PROFILE_DIR)
  : path.join(os.homedir(), '.curveyield', 'chatgpt-playwright-profile-v6');

await fs.mkdir(profileDir, { recursive: true });

const context = await chromium.launchPersistentContext(profileDir, {
  headless: false,
  channel: 'chrome',
  viewport: null,
  args: ['--start-maximized']
});

const pages = context.pages();
const page = pages[0] || await context.newPage();

async function backendProbe() {
  return await page.evaluate(async () => {
    const targets = [
      '/backend-api/models',
      '/backend-api/conversations?offset=0&limit=1&order=updated'
    ];
    const out = {};
    for (const target of targets) {
      try {
        const r = await fetch(target, { credentials: 'include', cache: 'no-store' });
        out[target] = {
          status: r.status,
          ok: r.ok,
          cfMitigated: r.headers.get('cf-mitigated'),
          server: r.headers.get('server')
        };
      } catch (error) {
        out[target] = { status: 0, ok: false, error: String(error) };
      }
    }
    return out;
  });
}

async function composerVisible() {
  return await page.locator('div[role="textbox"][aria-label="Ask ChatGPT"], #prompt-textarea, textarea').first()
    .isVisible().catch(() => false);
}

async function healthy() {
  const probe = await backendProbe().catch(error => ({ error: String(error) }));
  const composer = await composerVisible();
  const entries = Object.values(probe).filter(v => v && typeof v === 'object' && 'ok' in v);
  const allBackendHealthy = entries.length >= 1 && entries.every(v => v.ok && v.cfMitigated !== 'challenge');
  return { ok: allBackendHealthy && composer, composer, probe };
}

async function waitForInteractiveAuth() {
  const deadline = Date.now() + manualWaitSeconds * 1000;
  let last = null;
  while (Date.now() < deadline) {
    last = await healthy();
    console.log('[self-hosted-browser-v6] health=' + JSON.stringify(last));
    if (last.ok) return last;
    console.log('[self-hosted-browser-v6] Browser is intentionally left visible. Complete ChatGPT login / verification in the Chrome window if prompted.');
    await page.waitForTimeout(pollMs);
  }
  throw new Error('Interactive authentication window expired before ChatGPT backend became healthy: ' + JSON.stringify(last));
}

async function mainComposer() {
  const selectors = [
    'div[role="textbox"][aria-label="Ask ChatGPT"]',
    '#prompt-textarea',
    'textarea'
  ];
  for (const selector of selectors) {
    const loc = page.locator(selector).first();
    if (await loc.isVisible().catch(() => false)) return loc;
  }
  throw new Error('Main ChatGPT composer not visible');
}

async function sendAndVerify(message) {
  const composer = await mainComposer();
  await composer.click();
  await composer.fill(message).catch(async () => {
    await composer.focus();
    if (process.platform === 'darwin') await page.keyboard.press('Meta+A').catch(() => {});
    else await page.keyboard.press('Control+A').catch(() => {});
    await page.keyboard.press('Backspace').catch(() => {});
    await page.keyboard.insertText(message);
  });

  const send = page.locator('button[aria-label="Send"], button[data-testid="send-button"], button[data-testid="composer-submit-button"]').first();
  if (!await send.isVisible({ timeout: 5000 }).catch(() => false)) {
    throw new Error('Send button not visible after filling composer');
  }

  let prepareStatus = null;
  let challenge = null;
  const responseHandler = async (response) => {
    if (/\/backend-api\/f\/conversation\/prepare/.test(response.url())) {
      prepareStatus = response.status();
      challenge = await response.headerValue('cf-mitigated').catch(() => null);
    }
  };
  page.on('response', responseHandler);

  const beforeUrl = page.url();
  await send.click();

  const deadline = Date.now() + 45000;
  let generating = false;
  let composerCleared = false;
  while (Date.now() < deadline) {
    await page.waitForTimeout(500);
    generating = (await page.locator('button[data-testid="stop-button"], button[aria-label*="Stop"]').count().catch(() => 0)) > 0;
    const text = await composer.innerText().catch(() => '');
    composerCleared = !text.trim();

    if (prepareStatus && prepareStatus >= 200 && prepareStatus < 300 && challenge !== 'challenge' && (generating || composerCleared)) {
      page.off('response', responseHandler);
      return {
        ok: true,
        prepareStatus,
        cfMitigated: challenge,
        generating,
        composerCleared,
        beforeUrl,
        afterUrl: page.url()
      };
    }
    if (prepareStatus === 403 || challenge === 'challenge') break;
  }

  page.off('response', responseHandler);
  throw new Error('ChatGPT send was not accepted: ' + JSON.stringify({
    prepareStatus,
    cfMitigated: challenge,
    generating,
    composerCleared,
    url: page.url()
  }));
}

try {
  const startUrl = action === 'authenticate_only' ? 'https://chatgpt.com/' : chatUrl;
  await page.goto(startUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.bringToFront();
  console.log('[self-hosted-browser-v6] Visible Chrome launched with persistent profile: ' + profileDir);

  const auth = await waitForInteractiveAuth();

  if (action === 'authenticate_only') {
    console.log(JSON.stringify({
      ok: true,
      action,
      authenticated: true,
      profileDir,
      url: page.url(),
      health: auth
    }));
    process.exitCode = 0;
  } else {
    if (page.url() !== chatUrl) {
      await page.goto(chatUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(1500);
      await waitForInteractiveAuth();
    }
    const delivery = await sendAndVerify(wakeMessage);
    console.log(JSON.stringify({
      ok: true,
      action,
      profileDir,
      chatUrl,
      delivery
    }));
    process.exitCode = 0;
  }
} finally {
  if (String(request.keep_browser_open_after_success || 'false') === 'true') {
    console.log('[self-hosted-browser-v6] keep_browser_open_after_success=true; leaving Chrome open for 10 minutes.');
    await page.waitForTimeout(10 * 60 * 1000).catch(() => {});
  }
  await context.close().catch(() => {});
}
