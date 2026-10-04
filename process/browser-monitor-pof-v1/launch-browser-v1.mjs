import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('/tmp/browser-monitor-pof-node-v1/node_modules/playwright-core');

const root = process.env.POF_ROOT || path.resolve('process/browser-monitor-pof-v1');
const testPage = pathToFileURL(path.join(root, 'test-page-v1.html')).href;

const context = await chromium.launchPersistentContext('/tmp/browser-monitor-pof-userdata-v1', {
  headless: false,
  executablePath: process.env.CHROME_EXECUTABLE,
  ignoreDefaultArgs: ['--enable-automation'],
  args: [
    '--remote-debugging-port=9222',
    '--remote-debugging-address=127.0.0.1',
    '--disable-blink-features=AutomationControlled',
    '--disable-dev-shm-usage',
    '--no-sandbox',
    '--window-position=0,0',
    '--window-size=1280,720',
    '--no-first-run'
  ],
  viewport: { width: 1280, height: 720 }
});

const page = context.pages()[0] || await context.newPage();
await page.goto(testPage, { waitUntil: 'load', timeout: 60000 });
console.log('BROWSER_MONITOR_POF_CHROME_READY');
await new Promise(() => {});
