#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const env = process.env;
const runtimeRoot = env.BROWSER_AGENT_RUNTIME_ROOT;
const rr = createRequire(path.join(runtimeRoot, 'package.json'));
const playwrightMod = await import(pathToFileURL(rr.resolve('playwright-core')).href);
const first = playwrightMod.default && typeof playwrightMod.default === 'object' ? playwrightMod.default : playwrightMod;
const second = first.default && typeof first.default === 'object' ? first.default : first;
const chromium = playwrightMod.chromium || first.chromium || second.chromium;
if (!chromium || typeof chromium.launch !== 'function') throw new Error('playwright-core chromium launcher unavailable');
const storage = JSON.parse(Buffer.from(env.CHATGPT_STORAGE_STATE_B64, 'base64').toString('utf8'));
const browser = await chromium.launch({ headless: false, channel: 'chrome' });
const context = await browser.newContext({ storageState: storage });
const page = await context.newPage();
try {
  await page.goto(env.CHAT_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(5000);
  const info = await page.evaluate(() => {
    const visible = (el) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
    };
    const describe = (el, i) => {
      const r = el.getBoundingClientRect();
      const ancestors = [];
      let p = el;
      for (let n = 0; p && n < 7; n++, p = p.parentElement) {
        ancestors.push({
          tag: p.tagName,
          id: p.id || null,
          role: p.getAttribute('role'),
          aria: p.getAttribute('aria-label'),
          testid: p.getAttribute('data-testid'),
          cls: String(p.className || '').slice(0,180)
        });
      }
      return {
        i,
        tag: el.tagName,
        id: el.id || null,
        role: el.getAttribute('role'),
        aria: el.getAttribute('aria-label'),
        testid: el.getAttribute('data-testid'),
        contenteditable: el.getAttribute('contenteditable'),
        placeholder: el.getAttribute('placeholder'),
        rect: {x:r.x,y:r.y,width:r.width,height:r.height},
        text: ('value' in el ? el.value : (el.innerText || el.textContent || '')).slice(0,120),
        ancestors
      };
    };
    const candidates = [...document.querySelectorAll('#prompt-textarea, textarea, [contenteditable="true"]')].filter(visible).map(describe);
    const sendButtons = [...document.querySelectorAll('button')].filter(el => visible(el) && /send/i.test((el.getAttribute('aria-label')||'')+' '+(el.getAttribute('data-testid')||'')+' '+(el.innerText||''))).map(describe);
    return {
      url: location.href,
      title: document.title,
      viewport:{width:innerWidth,height:innerHeight},
      candidates,
      sendButtons,
      mainCount: document.querySelectorAll('main').length,
      dialogCount: document.querySelectorAll('[role="dialog"]').length
    };
  });
  console.log(JSON.stringify(info,null,2));
} finally {
  await browser.close();
}
