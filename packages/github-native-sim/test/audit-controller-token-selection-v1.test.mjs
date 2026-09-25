import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');
const selector = path.join(repoRoot, 'scripts/select-audit-controller-token.sh');

function runSelector({ primary = '', fallback = '', required = 'true', successToken = '' } = {}) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-token-select-'));
  const bin = path.join(tmp, 'bin');
  fs.mkdirSync(bin);
  const gh = path.join(bin, 'gh');
  fs.writeFileSync(gh, `#!/usr/bin/env bash
set -euo pipefail
printf '%s\\n' "\${GH_TOKEN:-}" >> "${tmp}/gh-tokens.log"
if [ "\${GH_TOKEN:-}" = "${successToken}" ] && [ -n "${successToken}" ]; then exit 0; fi
exit 1
`);
  fs.chmodSync(gh, 0o755);
  const githubEnv = path.join(tmp, 'github-env');
  const summary = path.join(tmp, 'summary');
  fs.writeFileSync(githubEnv, '');
  fs.writeFileSync(summary, '');
  const result = spawnSync('bash', [selector], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${bin}:${process.env.PATH}`,
      GITHUB_ENV: githubEnv,
      GITHUB_STEP_SUMMARY: summary,
      AUDIT_CONTROLLER_PRIMARY_TOKEN: primary,
      PREFLIGHTSIM_FALLBACK_TOKEN: fallback,
      AUDIT_CONTROLLER_TOKEN_REQUIRED: required,
    },
  });
  return {
    ...result,
    envFile: fs.readFileSync(githubEnv, 'utf8'),
    summary: fs.readFileSync(summary, 'utf8'),
    probed: fs.existsSync(path.join(tmp, 'gh-tokens.log'))
      ? fs.readFileSync(path.join(tmp, 'gh-tokens.log'), 'utf8').trim().split(/\n/).filter(Boolean)
      : [],
  };
}

test('runtime selector prefers a valid dedicated Audit-Controller token', () => {
  const result = runSelector({ primary: 'primary-good', fallback: 'fallback-good', successToken: 'primary-good' });
  assert.equal(result.status, 0);
  assert.deepEqual(result.probed, ['primary-good']);
  assert.match(result.envFile, /AUDIT_CONTROLLER_CREDENTIAL_SOURCE=AUDIT_CONTROLLER_GITHUB_TOKEN/);
  assert.match(result.envFile, /primary-good/);
});

test('runtime selector falls back when the primary token is present but invalid', () => {
  const result = runSelector({ primary: 'primary-dead', fallback: 'fallback-good', successToken: 'fallback-good' });
  assert.equal(result.status, 0);
  assert.deepEqual(result.probed, ['primary-dead', 'fallback-good']);
  assert.match(result.envFile, /AUDIT_CONTROLLER_CREDENTIAL_SOURCE=PREFLIGHTSIM_GITHUB_TOKEN/);
  assert.match(result.envFile, /fallback-good/);
  assert.doesNotMatch(result.envFile, /primary-dead/);
});

test('runtime selector fails closed when a working token is required', () => {
  const result = runSelector({ primary: 'primary-dead', fallback: 'fallback-dead', successToken: '' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /No configured Audit-Controller credential successfully authenticated/);
});

test('runtime selector can remain empty for optional watchdog access', () => {
  const result = runSelector({ primary: 'primary-dead', fallback: 'fallback-dead', successToken: '', required: 'false' });
  assert.equal(result.status, 0);
  assert.match(result.envFile, /^AUDIT_CONTROLLER_GITHUB_TOKEN=$/m);
  assert.match(result.envFile, /AUDIT_CONTROLLER_CREDENTIAL_SOURCE=NONE/);
});

test('private workflows use runtime authentication probing rather than presence-only secret fallback', () => {
  for (const relative of [
    '.github/workflows/audit-controller-execution.yml',
    '.github/workflows/v7-execution-infrastructure-qualification.yml',
    '.github/workflows/agent-zip-import-v1.yml',
    '.github/workflows/browser-agent-watchdog.yml',
  ]) {
    const workflow = fs.readFileSync(path.join(repoRoot, relative), 'utf8');
    assert.doesNotMatch(workflow, /AUDIT_CONTROLLER_GITHUB_TOKEN\s*\|\|\s*secrets\.PREFLIGHTSIM_GITHUB_TOKEN/);
    assert.match(workflow, /scripts\/select-audit-controller-token\.sh/);
  }
});
