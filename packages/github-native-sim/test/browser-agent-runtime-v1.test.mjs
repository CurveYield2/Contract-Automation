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
  const runtime = JSON.parse(read('tools/browser-agent-runtime/package.json'));
  const rootPackage = JSON.parse(read('package.json'));

  assert.deepEqual(runtime.dependencies, {
    '@browserbasehq/sdk': '2.20.0',
    'playwright-core': '1.63.0',
  });
  assert.equal(rootPackage.dependencies?.['playwright-core'], undefined);
  assert.equal(rootPackage.dependencies?.['@browserbasehq/sdk'], undefined);
  assert.equal(rootPackage.devDependencies?.['playwright-core'], undefined);
  assert.equal(rootPackage.devDependencies?.['@browserbasehq/sdk'], undefined);
});

test('shared browser runtime setup caches only isolated node_modules and installs only on cache miss', () => {
  const action = read('.github/actions/setup-browser-agent-runtime/action.yml');
  assert.match(action, /path:\s*tools\/browser-agent-runtime\/node_modules/);
  assert.match(action, /hashFiles\('tools\/browser-agent-runtime\/package\.json'\)/);
  assert.match(action, /if:\s*steps\.cache\.outputs\.cache-hit != 'true'/);
  assert.match(action, /npm install/);
  assert.match(action, /--prefix "\$GITHUB_WORKSPACE\/tools\/browser-agent-runtime"/);
  assert.match(action, /--package-lock=false/);
  assert.match(action, /BROWSER_AGENT_RUNTIME_ROOT=\$GITHUB_WORKSPACE\/tools\/browser-agent-runtime/);
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

test('browser wake script resolves optional modules from the isolated runtime root', () => {
  const source = read('scripts/browser-agent-wake.mjs');
  assert.match(source, /BROWSER_AGENT_RUNTIME_ROOT/);
  assert.match(source, /createRequire\(path\.join\(runtimeRoot, 'package\.json'\)\)/);
  assert.match(source, /runtimeRequire\.resolve\(specifier\)/);
  assert.match(source, /pathToFileURL\(resolved\)\.href/);
  assert.match(source, /importBrowserRuntimeModule\('playwright-core'\)/);
  assert.match(source, /importBrowserRuntimeModule\('@browserbasehq\/sdk'\)/);
});
