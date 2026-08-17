import test from 'node:test';
import assert from 'node:assert/strict';
import { createApiClient } from '../src/client.mjs';

function response(body, status = 200, headers = {}) {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers: { 'content-type': typeof body === 'string' ? 'text/plain' : 'application/json', ...headers }
  });
}

test('client attaches bearer auth and normalizes the API URL', async () => {
  const calls = [];
  const client = createApiClient({
    apiUrl: 'https://api.example.test/',
    apiKey: 'secret',
    fetcher: async (url, init) => {
      calls.push({ url, init });
      return response({ chains: {} });
    }
  });
  await client.getChains();
  assert.equal(calls[0].url, 'https://api.example.test/api/v1/chains');
  assert.equal(new Headers(calls[0].init.headers).get('authorization'), 'Bearer secret');
});

test('client creates an upload session and PUTs bytes directly to R2', async () => {
  const calls = [];
  const client = createApiClient({
    apiUrl: 'https://api.example.test',
    apiKey: 'secret',
    fetcher: async (url, init) => {
      calls.push({ url, init });
      if (url.endsWith('/api/v1/uploads')) {
        return response({
          objectKey: 'uploads/upl_test/project.zip',
          uploadUrl: 'https://r2.example.test/upload',
          requiredHeaders: { 'content-type': 'application/zip' }
        }, 201);
      }
      return response('', 200);
    }
  });
  const file = new Blob(['zip bytes'], { type: 'application/zip' });
  const result = await client.uploadProject(file);
  assert.equal(result.objectKey, 'uploads/upl_test/project.zip');
  assert.equal(calls[1].url, 'https://r2.example.test/upload');
  assert.equal(calls[1].init.method, 'PUT');
  assert.equal(new Headers(calls[1].init.headers).get('authorization'), null);
});

test('pollJob stops at a terminal state and emits updates', async () => {
  let count = 0;
  const updates = [];
  const client = createApiClient({
    apiUrl: 'https://api.example.test',
    apiKey: 'secret',
    fetcher: async () => response({ status: ++count < 3 ? 'running' : 'completed', stage: `stage-${count}` }),
    sleep: async () => {}
  });
  const terminal = await client.pollJob('job_test', { onUpdate: (status) => updates.push(status.stage) });
  assert.equal(terminal.status, 'completed');
  assert.deepEqual(updates, ['stage-1', 'stage-2', 'stage-3']);
});

test('client surfaces structured API errors', async () => {
  const client = createApiClient({
    apiUrl: 'https://api.example.test',
    apiKey: 'secret',
    fetcher: async () => response({ error: { code: 'invalid_request', message: 'bad input' } }, 400)
  });
  await assert.rejects(() => client.createJob({}), (error) => {
    assert.equal(error.code, 'invalid_request');
    assert.match(error.message, /bad input/);
    return true;
  });
});

test('agent pages exist without OpenAPI or API keys in URLs', async () => {
  const fs = await import('node:fs/promises');
  const index = await fs.readFile(new URL('../public/agent/index.html', import.meta.url), 'utf8');
  const job = await fs.readFile(new URL('../public/agent/job.html', import.meta.url), 'utf8');
  const root = await fs.readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  assert.match(index, /id="agent-job-form"/);
  assert.match(job, /id="agent-job-status"/);
  assert.match(job, /API key/);
  assert.doesNotMatch(index + job + root, /openapi/i);
  assert.doesNotMatch(index + job, /api[_-]?key=/i);
});
