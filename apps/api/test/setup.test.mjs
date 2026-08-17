import test from 'node:test';
import assert from 'node:assert/strict';
import worker, { setupReadiness } from '../src/entry.mjs';

test('setup readiness reports missing features without exposing secret values', async () => {
  const env = {
    JOBS: {},
    CLIENT_API_KEY: 'client-secret',
    GITHUB_BRIDGE_API_KEY: 'bridge-secret',
    RUNNER_API_KEY: 'runner-secret',
    GITHUB_TOKEN: 'github-secret',
    CORS_ORIGIN: 'https://preflight.curveyield.online'
  };
  const readiness = setupReadiness(env);
  assert.equal(readiness.status, 'configuration_required');
  assert.deepEqual(readiness.features, {
    storage: true,
    browserApiAuth: true,
    customGptAuth: false,
    githubBridgeAuth: true,
    runnerAuth: true,
    githubDispatch: true,
    largeUploads: false
  });
  assert.equal(JSON.stringify(readiness).includes('client-secret'), false);
  assert.equal(JSON.stringify(readiness).includes('github-secret'), false);

  const response = await worker.fetch(new Request('https://preflight.curveyield.online/api/v1/setup'), env);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal((await response.json()).status, 'configuration_required');
});
