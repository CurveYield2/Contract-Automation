import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname);

async function read(relative) {
  return fs.readFile(path.join(root, relative), 'utf8');
}

test('static build includes agent pages and keeps private integration files out of public assets', async () => {
  const built = spawnSync(process.execPath, ['scripts/build.mjs'], { cwd: root, encoding: 'utf8' });
  assert.equal(built.status, 0, built.stderr);
  assert.equal(await fs.stat(path.join(root, 'dist/web/agent/index.html')).then(() => true), true);
  await assert.rejects(() => fs.stat(path.join(root, 'dist/web/openapi.json')), { code: 'ENOENT' });
  const packageJson = JSON.parse(await read('package.json'));
  assert.equal(packageJson.scripts['validate:openapi'], undefined);
});

test('GitHub workflows provide trusted simulation, issue bridging, and Cloudflare deployment', async () => {
  const simulate = await read('.github/workflows/simulate.yml');
  const deploy = await read('.github/workflows/deploy.yml');
  const bridge = await read('.github/workflows/github-bridge.yml');
  const wrangler = await read('apps/api/wrangler.toml');
  assert.match(simulate, /workflow_dispatch:/);
  assert.match(simulate, /PREFLIGHTSIM_JOB_ID/);
  assert.match(simulate, /PREFLIGHTSIM_RUNNER_API_KEY/);
  assert.doesNotMatch(simulate, /pull_request_target/);
  assert.match(deploy, /wrangler deploy/);
  assert.match(deploy, /preflight\.curveyield\.online/);
  assert.match(wrangler, /pattern = \"preflight\.curveyield\.online\"/);
  assert.match(wrangler, /\[assets\]/);
  assert.match(wrangler, /directory = \"\.\.\/\.\.\/dist\/web\"/);
  assert.doesNotMatch(wrangler, /\[secrets\]/);
  assert.match(wrangler, /custom_domain = true/);
  assert.match(deploy, /r2 bucket cors set/);
  assert.match(deploy, /r2 bucket lifecycle set/);
  assert.match(bridge, /issues:/);
  assert.match(bridge, /preflightsim-job/);
  assert.match(bridge, /PREFLIGHTSIM_ALLOWED_GITHUB_USERS/);
  assert.match(bridge, /PREFLIGHTSIM_GITHUB_BRIDGE_API_KEY/);
  assert.doesNotMatch(bridge, /pull_request_target/);
});


test('Cloudflare native build scripts pin current Wrangler and target the nested Worker config', async () => {
  const packageJson = JSON.parse(await read('package.json'));
  assert.equal(packageJson.scripts.cfbuild, 'npm test && npm run lint && npm run build');
  assert.match(packageJson.scripts.cfdeploy, /wrangler deploy --config apps\/api\/wrangler\.toml/);
  assert.equal(packageJson.devDependencies.wrangler, '4.116.0');
});
