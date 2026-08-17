import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.mjs';

class MemoryR2Object {
  constructor(bytes, customMetadata = {}) {
    this.bytes = bytes;
    this.size = bytes.byteLength;
    this.customMetadata = customMetadata;
    this.httpMetadata = {};
    this.body = new Blob([bytes]).stream();
  }
  async text() { return new TextDecoder().decode(this.bytes); }
  async json() { return JSON.parse(await this.text()); }
  async arrayBuffer() { return this.bytes.buffer.slice(this.bytes.byteOffset, this.bytes.byteOffset + this.bytes.byteLength); }
}

class MemoryR2 {
  constructor() { this.objects = new Map(); }
  async put(key, value, options = {}) {
    let bytes;
    if (typeof value === 'string') bytes = new TextEncoder().encode(value);
    else if (value instanceof Uint8Array) bytes = value;
    else if (value instanceof ArrayBuffer) bytes = new Uint8Array(value);
    else bytes = new Uint8Array(await new Response(value).arrayBuffer());
    this.objects.set(key, new MemoryR2Object(bytes, options.customMetadata ?? {}));
    return { key, size: bytes.byteLength };
  }
  async get(key) { return this.objects.get(key) ?? null; }
  async head(key) { return this.objects.get(key) ?? null; }
  async delete(key) { this.objects.delete(key); }
}

function makeEnv(overrides = {}) {
  return {
    JOBS: new MemoryR2(),
    CLIENT_API_KEY: 'client-secret',
    RUNNER_API_KEY: 'runner-secret',
    GITHUB_TOKEN: 'github-token',
    GITHUB_OWNER: 'curveyield',
    GITHUB_REPO: 'contract-automation',
    GITHUB_WORKFLOW: 'simulate.yml',
    GITHUB_REF: 'main',
    R2_ACCOUNT_ID: 'account-id',
    R2_BUCKET_NAME: 'curveyield-preflight',
    R2_ACCESS_KEY_ID: 'r2-access',
    R2_SECRET_ACCESS_KEY: 'r2-secret',
    CORS_ORIGIN: 'https://preflight.curveyield.online',
    ...overrides
  };
}

function request(path, { method = 'GET', key, body } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (key) headers.authorization = `Bearer ${key}`;
  return new Request(`https://preflight.curveyield.online${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
}

async function jsonResponse(response) {
  const json = await response.json();
  return { response, json };
}

const validJob = {
  project: {
    type: 'inline',
    files: { 'Counter.sol': 'pragma solidity 0.8.30; contract Counter {}' }
  },
  compilerVersion: '0.8.30',
  chain: 'polygon',
  block: 'latest',
  workflow: { steps: [{ action: 'deploy', alias: 'counter', contract: 'Counter', args: [] }] }
};

test('health endpoint is public', async () => {
  const response = await worker.fetch(request('/api/v1/health'), makeEnv());
  assert.equal(response.status, 200);
  assert.equal((await response.json()).status, 'ok');
});

test('chains endpoint requires client bearer auth', async () => {
  const env = makeEnv();
  assert.equal((await worker.fetch(request('/api/v1/chains'), env)).status, 401);
  const response = await worker.fetch(request('/api/v1/chains', { key: 'client-secret' }), env);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).chains.polygon.chainId, 137);
});

test('creates a job, stores it, and dispatches the trusted GitHub workflow', async () => {
  const calls = [];
  const env = makeEnv({
    FETCH: async (url, init) => {
      calls.push({ url, init });
      return Response.json({ workflow_run_id: 55, html_url: 'https://github.com/run/55' }, { status: 200 });
    }
  });
  const { response, json } = await jsonResponse(await worker.fetch(
    request('/api/v1/jobs', { method: 'POST', key: 'client-secret', body: validJob }), env
  ));
  assert.equal(response.status, 202);
  assert.match(json.jobId, /^job_/);
  assert.equal(json.status, 'queued');
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /actions\/workflows\/simulate\.yml\/dispatches$/);
  const status = await env.JOBS.get(`jobs/${json.jobId}/status.json`);
  assert.equal((await status.json()).githubRunId, 55);
});

test('rejects invalid and broadcast-capable jobs before dispatch', async () => {
  let dispatched = false;
  const env = makeEnv({ FETCH: async () => { dispatched = true; return Response.json({}, { status: 200 }); } });
  const invalid = {
    ...validJob,
    workflow: { steps: [{ action: 'sendRawTransaction', rawTransaction: '0x00' }] }
  };
  const { response, json } = await jsonResponse(await worker.fetch(
    request('/api/v1/jobs', { method: 'POST', key: 'client-secret', body: invalid }), env
  ));
  assert.equal(response.status, 400);
  assert.equal(json.error.code, 'forbidden_field');
  assert.equal(dispatched, false);
});

test('marks job failed when GitHub dispatch fails', async () => {
  const env = makeEnv({ FETCH: async () => Response.json({ message: 'denied' }, { status: 403 }) });
  const { response, json } = await jsonResponse(await worker.fetch(
    request('/api/v1/jobs', { method: 'POST', key: 'client-secret', body: validJob }), env
  ));
  assert.equal(response.status, 502);
  assert.equal(json.error.code, 'dispatch_failed');
  const status = await env.JOBS.get(`jobs/${json.jobId}/status.json`);
  assert.equal((await status.json()).status, 'failed');
});

test('creates a size-limited upload session', async () => {
  const env = makeEnv();
  const { response, json } = await jsonResponse(await worker.fetch(
    request('/api/v1/uploads', {
      method: 'POST', key: 'client-secret', body: { size: 1024, contentType: 'application/zip' }
    }), env
  ));
  assert.equal(response.status, 201);
  assert.match(json.objectKey, /^uploads\/upl_[A-Za-z0-9_-]+\/project\.zip$/);
  assert.match(json.uploadUrl, /^https:\/\/account-id\.r2\.cloudflarestorage\.com\/curveyield-preflight\//);
  assert.equal(json.requiredHeaders['content-type'], 'application/zip');
});

test('rejects upload jobs when the R2 object is missing or oversized', async () => {
  const env = makeEnv({ FETCH: async () => Response.json({ workflow_run_id: 1 }, { status: 200 }) });
  const uploadJob = {
    ...validJob,
    project: { type: 'upload', objectKey: 'uploads/upl_missing/project.zip' }
  };
  const response = await worker.fetch(request('/api/v1/jobs', {
    method: 'POST', key: 'client-secret', body: uploadJob
  }), env);
  assert.equal(response.status, 400);
});

test('runner can fetch request, update status, and publish results', async () => {
  const env = makeEnv({ FETCH: async () => Response.json({ workflow_run_id: 77 }, { status: 200 }) });
  const created = await (await worker.fetch(request('/api/v1/jobs', {
    method: 'POST', key: 'client-secret', body: validJob
  }), env)).json();

  const internalRequest = await worker.fetch(request(`/internal/v1/jobs/${created.jobId}`, {
    key: 'runner-secret'
  }), env);
  assert.equal(internalRequest.status, 200);
  assert.equal((await internalRequest.json()).chain, 'polygon');

  const running = await worker.fetch(request(`/internal/v1/jobs/${created.jobId}/status`, {
    method: 'POST', key: 'runner-secret', body: { status: 'running', stage: 'compiling' }
  }), env);
  assert.equal(running.status, 204);

  const result = {
    jobId: created.jobId,
    status: 'completed',
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    compilerDiagnostics: [],
    deployments: {},
    steps: []
  };
  const published = await worker.fetch(request(`/internal/v1/jobs/${created.jobId}/result`, {
    method: 'POST', key: 'runner-secret', body: { result, html: '<html>done</html>' }
  }), env);
  assert.equal(published.status, 204);

  const publicResult = await worker.fetch(request(`/api/v1/jobs/${created.jobId}/result`, {
    key: 'client-secret'
  }), env);
  assert.equal(publicResult.status, 200);
  assert.equal((await publicResult.json()).status, 'completed');


  const report = await worker.fetch(request(`/api/v1/jobs/${created.jobId}/report`, {
    key: 'client-secret'
  }), env);
  assert.equal(report.headers.get('x-content-type-options'), 'nosniff');
  assert.match(report.headers.get('content-security-policy'), /default-src 'none'/);
});

test('runner endpoints reject client credentials', async () => {
  const response = await worker.fetch(request('/internal/v1/jobs/job_fake', { key: 'client-secret' }), makeEnv());
  assert.equal(response.status, 401);
});

test('accepts form-encoded job requests and returns an agent job URL', async () => {
  const env = makeEnv({
    PUBLIC_APP_URL: 'https://preflight.curveyield.online',
    FETCH: async () => Response.json({ workflow_run_id: 99 }, { status: 200 })
  });
  const form = new URLSearchParams({ request: JSON.stringify(validJob) });
  const response = await worker.fetch(new Request('https://preflight.curveyield.online/api/v1/jobs', {
    method: 'POST',
    headers: {
      authorization: 'Bearer client-secret',
      'content-type': 'application/x-www-form-urlencoded'
    },
    body: form
  }), env);
  assert.equal(response.status, 202);
  const body = await response.json();
  assert.equal(body.agentJobUrl, `https://preflight.curveyield.online/agent/job.html?job=${body.jobId}`);
});

test('rejects malformed form request JSON', async () => {
  const env = makeEnv();
  const response = await worker.fetch(new Request('https://preflight.curveyield.online/api/v1/jobs', {
    method: 'POST',
    headers: {
      authorization: 'Bearer client-secret',
      'content-type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({ request: '{broken' })
  }), env);
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error.code, 'invalid_json');
});

test('returns a compact authenticated job summary for queued and completed jobs', async () => {
  const env = makeEnv({ FETCH: async () => Response.json({ workflow_run_id: 101 }, { status: 200 }) });
  const created = await (await worker.fetch(request('/api/v1/jobs', {
    method: 'POST', key: 'client-secret', body: validJob
  }), env)).json();

  const queued = await worker.fetch(request(`/api/v1/jobs/${created.jobId}/summary`, {
    key: 'client-secret'
  }), env);
  assert.equal(queued.status, 200);
  assert.deepEqual(await queued.json(), {
    jobId: created.jobId,
    status: 'queued',
    stage: 'queued',
    chain: 'polygon',
    createdAt: created.createdAt,
    updatedAt: created.updatedAt,
    agentJobUrl: created.agentJobUrl
  });

  const result = {
    jobId: created.jobId,
    status: 'completed',
    mode: 'simulate',
    chain: 'polygon',
    chainId: 137,
    block: 'latest',
    compilerVersion: '0.8.30',
    compilerDiagnostics: [{ severity: 'warning', message: 'warning' }],
    deployments: { vault: '0x0000000000000000000000000000000000000001' },
    steps: [
      { index: 0, action: 'deploy', status: 'completed' },
      { index: 1, action: 'assertCall', status: 'failed', error: { message: 'mismatch' } }
    ],
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString()
  };
  await worker.fetch(request(`/internal/v1/jobs/${created.jobId}/result`, {
    method: 'POST', key: 'runner-secret', body: { result, html: '<html>done</html>' }
  }), env);

  const completed = await worker.fetch(request(`/api/v1/jobs/${created.jobId}/summary`, {
    key: 'client-secret'
  }), env);
  assert.equal(completed.status, 200);
  const summary = await completed.json();
  assert.equal(summary.status, 'completed');
  assert.equal(summary.compiler.warningCount, 1);
  assert.equal(summary.workflow.completedSteps, 1);
  assert.equal(summary.workflow.failedSteps, 1);
  assert.equal(summary.deployments.vault, result.deployments.vault);
  assert.equal(summary.error, undefined);
});

test('accepts separate revocable client, Custom GPT, and GitHub bridge keys on public routes', async () => {
  const env = makeEnv({
    GPT_API_KEY: 'gpt-secret',
    GITHUB_BRIDGE_API_KEY: 'bridge-secret'
  });
  for (const key of ['client-secret', 'gpt-secret', 'bridge-secret']) {
    const response = await worker.fetch(request('/api/v1/chains', { key }), env);
    assert.equal(response.status, 200, `key ${key} should be accepted`);
  }
  const runnerKey = await worker.fetch(request('/api/v1/chains', { key: 'runner-secret' }), env);
  assert.equal(runnerKey.status, 401);
});
