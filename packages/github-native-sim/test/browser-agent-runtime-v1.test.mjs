import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');

function read(relative) {
  return fs.readFileSync(path.join(root, relative), 'utf8');
}

test('browser agent runtime is isolated from the root contract dependency graph', () => {
  const runtime = JSON.parse(read('.github/actions/setup-browser-agent-runtime/package.json'));
  const rootPackage = JSON.parse(read('package.json'));

  assert.deepEqual(runtime.dependencies, {
    'playwright-core': '1.63.0',
  });
  assert.equal(rootPackage.dependencies?.['playwright-core'], undefined);
  assert.equal(rootPackage.dependencies?.['@browserbasehq/sdk'], undefined);
  assert.equal(rootPackage.devDependencies?.['playwright-core'], undefined);
  assert.equal(rootPackage.devDependencies?.['@browserbasehq/sdk'], undefined);
  assert.equal(fs.existsSync(path.join(root, 'tools', 'browser-agent-runtime')), false, 'old tools browser runtime path stays retired');
});

test('isolated browser runtime package stays in the control-light qualification lane', async () => {
  const { classifyV7QualificationChanges } = await import('../../../scripts/classify-v7-qualification-change.mjs');
  const result = classifyV7QualificationChanges([
    '.github/actions/setup-browser-agent-runtime/package.json',
    '.github/workflows/browser-agent-wake.yml',
    '.github/workflows/browser-agent-watchdog.yml',
    'scripts/browser-agent-wake.mjs',
  ]);
  assert.equal(result.lane, 'CONTROL_LIGHT');
});

test('shared browser runtime setup caches only isolated node_modules and installs only on cache miss', () => {
  const action = read('.github/actions/setup-browser-agent-runtime/action.yml');
  assert.match(action, /path:\s*\.github\/actions\/setup-browser-agent-runtime\/node_modules/);
  assert.match(action, /hashFiles\('\.github\/actions\/setup-browser-agent-runtime\/package\.json'\)/);
  assert.match(action, /if:\s*steps\.cache\.outputs\.cache-hit != 'true'/);
  assert.match(action, /npm install/);
  assert.match(action, /--prefix "\$GITHUB_WORKSPACE\/\.github\/actions\/setup-browser-agent-runtime"/);
  assert.match(action, /--package-lock=false/);
  assert.match(action, /BROWSER_AGENT_RUNTIME_ROOT=\$GITHUB_WORKSPACE\/\.github\/actions\/setup-browser-agent-runtime/);
  assert.doesNotMatch(action, /npm install --no-save/);
});

test('wake and watchdog reuse the shared isolated browser runtime setup', () => {
  for (const relative of [
    '.github/workflows/browser-agent-wake.yml',
    '.github/workflows/browser-agent-watchdog.yml',
  ]) {
    const workflow = read(relative);
    assert.match(workflow, /uses:\s*\.\/\.github\/actions\/setup-browser-agent-runtime/);
    assert.doesNotMatch(workflow, /npm install --no-save --ignore-scripts playwright-core @browserbasehq\/sdk/);
    assert.doesNotMatch(workflow, /Install ephemeral (wake|watchdog) dependencies/);
  }
});

test('browser wake script resolves Playwright from the isolated runtime root without retired remote providers', () => {
  const source = read('scripts/browser-agent-wake.mjs');
  assert.match(source, /BROWSER_AGENT_RUNTIME_ROOT/);
  assert.match(source, /createRequire\(path\.join\(runtimeRoot, 'package\.json'\)\)/);
  assert.match(source, /runtimeRequire\.resolve\(specifier\)/);
  assert.match(source, /pathToFileURL\(resolved\)\.href/);
  assert.match(source, /importBrowserRuntimeModule\('playwright-core'\)/);
  assert.doesNotMatch(source, /@browserbasehq\/sdk|browserlessProvider|browserbaseProvider/);
});

test('browser wake normalizes CommonJS and ESM runtime module shapes before using Chromium', () => {
  const source = read('scripts/browser-agent-wake.mjs');
  assert.match(source, /function unwrapRuntimeModule\(mod\)/);
  assert.match(source, /mod\.default && typeof mod\.default === 'object'/);
  assert.match(source, /const playwright = unwrapRuntimeModule\(playwrightMod\)/);
  assert.match(source, /const chromium = playwright\.chromium/);
  assert.match(source, /typeof chromium\.launch !== 'function'/);
  assert.doesNotMatch(source, /const \[\{ chromium \}, browserbaseMod\]/);
});


test('missing-composer diagnostics classify state without logging page body text or cookie values', () => {
  const source = read('scripts/browser-agent-wake.mjs');
  assert.match(source, /loginPrompt=/);
  assert.match(source, /humanChallenge=/);
  assert.match(source, /conversationUnavailable=/);
  assert.match(source, /textareaCount=/);
  assert.match(source, /editableCount=/);
  assert.doesNotMatch(source, /bodyText\s*\+|JSON\.stringify\(bodyText\)/);
});


test('browser wake allows bounded time for ChatGPT browser challenge to resolve', () => {
  const source = read('scripts/browser-agent-wake.mjs');
  assert.match(source, /const deadline = Date\.now\(\) \+ 30000/);
  assert.match(source, /while \(!composer && Date\.now\(\) < deadline\)/);
  assert.match(source, /await page\.waitForTimeout\(1000\)/);
  assert.match(source, /ChatGPT composer not found after 30s/);
  assert.match(source, /Just a moment\|Cloudflare\/i\.test\(title\)/);
});


test('audit browser wake and watchdog use visible Xvfb Chrome through the private home-exit route', () => {
  const source = read('scripts/browser-agent-wake.mjs');
  assert.match(source, /headless:\s*env\.BROWSER_HEADLESS !== 'false'/);
  assert.match(source, /args:\s*\['--disable-quic'\]/);

  for (const relative of [
    '.github/workflows/browser-agent-wake.yml',
    '.github/workflows/browser-agent-watchdog.yml',
  ]) {
    const workflow = read(relative);
    assert.match(workflow, /BROWSER_HEADLESS:\s*'false'/);
    assert.match(workflow, /Xvfb :99/);
    assert.match(workflow, /tailscale\/github-action@v4/);
    assert.match(workflow, /TAILSCALE_AUTHKEY/);
    assert.match(workflow, /tailscale set --exit-node=/);
    assert.match(workflow, /x11vnc/);
    assert.match(workflow, /node scripts\/browser-agent-wake\.mjs/);
    assert.doesNotMatch(workflow, /xvfb-run -a node scripts\/browser-agent-wake\.mjs/);
    assert.doesNotMatch(workflow, /BROWSERLESS_|BROWSERBASE_/);
  }
});


test('browser runtime classifies only pre-post infrastructure failures as fresh-runner retryable', () => {
  const source = read('scripts/browser-agent-wake.mjs');
  assert.match(source, /class BrowserAgentError extends Error/);
  assert.match(source, /BrowserAgentError\('BROWSER_CHALLENGE', diagnostic, true\)/);
  assert.match(source, /BrowserAgentError\('CHATGPT_UI_UNAVAILABLE', diagnostic, true\)/);
  assert.match(source, /BrowserAgentError\('AUTH_REQUIRED', diagnostic, false\)/);
  assert.match(source, /BrowserAgentError\('CHAT_UNAVAILABLE', diagnostic, false\)/);
  assert.match(source, /retryable:\s*error\?\.retryable === true/);
  assert.match(source, /code:\s*error\?\.code \|\| 'PROVIDER_ERROR'/);
  assert.match(source, /WRITE_RESPONSE_MISSING/);
  assert.match(source, /WRITE_REJECTED/);
  assert.match(source, /DURABILITY_NOT_OBSERVED/);
  assert.match(source, /postSendChallenge/);
  assert.match(source, /domPersisted:\s*true/);
});

test('wake workflow retries retryable browser failures on a bounded fresh runner and gates all durable follow-ons', () => {
  const workflow = read('.github/workflows/browser-agent-wake.yml');
  assert.match(workflow, /runner_retry_attempt:[\s\S]*default:\s*'0'/);
  assert.doesNotMatch(workflow, /runner_retry_max:/);
  assert.match(workflow, /max=3/);
  assert.match(workflow, /select\(\.provider=="github-playwright" and \.retryable==true\)/);
  assert.match(workflow, /gh workflow run browser-agent-wake\.yml/);
  assert.match(workflow, /--json/);
  assert.match(workflow, /steps\.fresh-runner-retry\.outputs\.dispatched != 'true'/);

  for (const stepName of [
    'Detect refreshed encrypted ChatGPT session state',
    'Create watchdog state',
    'Persist watchdog state',
    'Persist fresh-chat URL into campaign registration',
    'Arm immediate watchdog observation',
  ]) {
    const start = workflow.indexOf('- name: ' + stepName);
    assert.ok(start >= 0, stepName + ' missing');
    const next = workflow.indexOf('\n      - name:', start + 1);
    const block = workflow.slice(start, next >= 0 ? next : workflow.length);
    assert.match(block, /steps\.deliver\.outputs\.ok == 'true'/, stepName + ' must require successful delivery');
  }
});
