import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('/tmp/browser-monitor-pof-node-v1/node_modules/playwright-core');

const systemChrome = process.env.CHROME_EXECUTABLE || '/usr/bin/google-chrome';

// Connect to the already-running headed browser exactly as the upstream
// playwright-vnc agent example connects over CDP.
const remoteBrowser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const remoteContext = remoteBrowser.contexts()[0];
const remotePage = remoteContext.pages()[0];

const before = await remotePage.evaluate(() => ({
  clicks: document.body.dataset.clicks || '0',
  keyboard: document.body.dataset.keyboard || ''
}));
console.log('POF_BEFORE=' + JSON.stringify(before));

// Open noVNC itself in a separate automation client and drive the remote
// desktop through noVNC's canvas. This exercises:
// Playwright -> noVNC UI -> WebSocket/websockify -> x11vnc -> Xvfb -> headed Chrome.
const clientBrowser = await chromium.launch({
  headless: true,
  executablePath: systemChrome,
  args: ['--no-sandbox', '--disable-dev-shm-usage']
});
const clientPage = await clientBrowser.newPage({ viewport: { width: 1400, height: 900 } });
await clientPage.goto(
  'http://127.0.0.1:6080/vnc.html?autoconnect=true&resize=off&view_only=0&shared=1',
  { waitUntil: 'domcontentloaded', timeout: 60000 }
);

const canvas = clientPage.locator('canvas').first();
await canvas.waitFor({ state: 'visible', timeout: 60000 });
await clientPage.waitForTimeout(4000);
const box = await canvas.boundingBox();
if (!box) throw new Error('noVNC canvas has no bounding box');

const sx = box.width / 1280;
const sy = box.height / 720;
const remotePoint = (x, y) => ({
  x: box.x + x * sx,
  y: box.y + y * sy
});

// Input center: left 80 + padding 28 + input x ~0, top 70 + padding 28 + h1(34) + margin(24)
// conservative point inside the input around (300, 170).
let p = remotePoint(300, 170);
await clientPage.mouse.click(p.x, p.y);
await clientPage.keyboard.type('POF_KEYBOARD_OK', { delay: 45 });

// Button center around x=258, y=272.
p = remotePoint(258, 275);
await clientPage.mouse.click(p.x, p.y);
await clientPage.waitForTimeout(2500);

const after = await remotePage.evaluate(() => ({
  clicks: document.body.dataset.clicks || '0',
  keyboard: document.body.dataset.keyboard || ''
}));
console.log('POF_AFTER=' + JSON.stringify(after));

if (after.keyboard !== 'POF_KEYBOARD_OK') {
  throw new Error('Keyboard input did not traverse noVNC into headed Chrome');
}
if (Number(after.clicks) < 1) {
  throw new Error('Mouse click did not traverse noVNC into headed Chrome');
}

console.log('POF_INTERACTIVE_INPUT_PASS');
await clientBrowser.close();
await remoteBrowser.close();
