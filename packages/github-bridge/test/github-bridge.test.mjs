import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BRIDGE_MARKER,
  extractJobRequest,
  parseAllowedUsers,
  splitResultComments,
  runGithubBridge
} from '../src/index.mjs';

const request = {
  mode: 'compile',
  project: {
    type: 'inline',
    files: { 'Counter.sol': 'pragma solidity 0.8.30; contract Counter {}' }
  },
  compilerVersion: '0.8.30',
  workflow: { steps: [] }
};

test('extracts and validates a marked JSON job request', () => {
  const body = `${BRIDGE_MARKER}\n\n\`\`\`json\n${JSON.stringify({ preflightsimJob: request }, null, 2)}\n\`\`\``;
  const normalized = extractJobRequest(body);
  assert.equal(normalized.mode, 'compile');
  assert.deepEqual(normalized.project, request.project);
  assert.equal(normalized.compilerVersion, '0.8.30');
  assert.equal(normalized.block, 'latest');
  assert.equal(normalized.timeoutMinutes, 10);
  assert.deepEqual(normalized.optimizer, { enabled: true, runs: 200 });
  assert.deepEqual(normalized.workflow, { steps: [] });
  assert.equal(normalized.viaIR, false);
});

test('rejects missing marker, malformed JSON, and unsafe job requests', () => {
  assert.throws(() => extractJobRequest('```json\n{}\n```'), /marker/i);
  assert.throws(() => extractJobRequest(`${BRIDGE_MARKER}\n\`\`\`json\n{broken}\n\`\`\``), /valid JSON/i);
  const unsafe = { ...request, rpcUrl: 'https://example.com' };
  assert.throws(
    () => extractJobRequest(`${BRIDGE_MARKER}\n\`\`\`json\n${JSON.stringify(unsafe)}\n\`\`\``),
    /forbidden/i
  );
});

test('normalizes a case-insensitive GitHub author allowlist', () => {
  assert.deepEqual(parseAllowedUsers('James-Nexus, CurveYield-Bot, james-nexus'), new Set(['james-nexus', 'curveyield-bot']));
});

test('splits large result JSON into issue-comment-sized parts', () => {
  const comments = splitResultComments({ value: 'x'.repeat(110_000) }, { maxBodyChars: 20_000, maxParts: 10 });
  assert.equal(comments.length > 1, true);
  assert.equal(comments.every((comment) => comment.length <= 20_000), true);
  assert.match(comments[0], /PreflightSim result part 1\//);
});

test('submits, polls, comments, and closes an authorized issue job', async () => {
  const calls = [];
  const statuses = [
    { jobId: 'job_abc', status: 'queued', stage: 'queued' },
    { jobId: 'job_abc', status: 'completed', stage: 'completed' }
  ];
  const fetcher = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    const method = init.method ?? 'GET';
    if (String(url).includes('/issues/7/comments?per_page=100') && method === 'GET') return Response.json([]);
    if (String(url).endsWith('/api/v1/jobs') && method === 'POST') {
      return Response.json({ jobId: 'job_abc', status: 'queued', stage: 'queued' }, { status: 202 });
    }
    if (String(url).endsWith('/api/v1/jobs/job_abc') && method === 'GET') return Response.json(statuses.shift());
    if (String(url).endsWith('/api/v1/jobs/job_abc/summary')) {
      return Response.json({ jobId: 'job_abc', status: 'completed', workflow: { completedSteps: 1, failedSteps: 0 } });
    }
    if (String(url).endsWith('/api/v1/jobs/job_abc/result')) {
      return Response.json({ jobId: 'job_abc', status: 'completed', steps: [{ status: 'completed' }] });
    }
    if (String(url).endsWith('/issues/7/comments') && method === 'POST') return Response.json({ id: calls.length }, { status: 201 });
    if (String(url).endsWith('/issues/7') && method === 'PATCH') return Response.json({ state: 'closed' });
    throw new Error(`Unexpected request: ${method} ${url}`);
  };

  const body = `${BRIDGE_MARKER}\n\`\`\`json\n${JSON.stringify({ preflightsimJob: request })}\n\`\`\``;
  const result = await runGithubBridge({
    issue: { number: 7, body, user: { login: 'James-Nexus' }, pull_request: undefined },
    repository: 'CurveYield/Agent-Code-Development',
    allowedUsers: 'James-Nexus',
    apiUrl: 'https://preflight.curveyield.online',
    apiKey: 'client-secret',
    githubToken: 'github-token',
    fetcher,
    sleep: async () => {},
    pollIntervalMs: 1,
    maxPolls: 5
  });

  assert.equal(result.jobId, 'job_abc');
  assert.equal(result.status, 'completed');
  assert.equal(calls.some(({ url, init }) => url.endsWith('/issues/7/comments') && init.method === 'POST'), true);
  assert.equal(calls.some(({ url, init }) => url.endsWith('/issues/7') && init.method === 'PATCH'), true);
});

test('rejects unauthorized authors and duplicate bridge execution', async () => {
  await assert.rejects(() => runGithubBridge({
    issue: { number: 7, body: `${BRIDGE_MARKER}\n\`\`\`json\n${JSON.stringify({ preflightsimJob: request })}\n\`\`\``, user: { login: 'stranger' } },
    repository: 'CurveYield/Agent-Code-Development',
    allowedUsers: 'James-Nexus',
    apiUrl: 'https://api.example',
    apiKey: 'key',
    githubToken: 'token',
    fetcher: async () => Response.json([])
  }), /not authorized/i);

  await assert.rejects(() => runGithubBridge({
    issue: { number: 7, body: `${BRIDGE_MARKER}\n\`\`\`json\n${JSON.stringify({ preflightsimJob: request })}\n\`\`\``, user: { login: 'James-Nexus' } },
    repository: 'CurveYield/Agent-Code-Development',
    allowedUsers: 'James-Nexus',
    apiUrl: 'https://api.example',
    apiKey: 'key',
    githubToken: 'token',
    fetcher: async () => Response.json([{ body: '<!-- preflightsim-bridge-started -->' }])
  }), /already started/i);
});

test('posts and closes cleanly when a failed job has no full result', async () => {
  const calls = [];
  const fetcher = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    const method = init.method ?? 'GET';
    if (String(url).includes('/issues/9/comments?per_page=100') && method === 'GET') return Response.json([]);
    if (String(url).endsWith('/api/v1/jobs') && method === 'POST') {
      return Response.json({ jobId: 'job_failed', status: 'failed', stage: 'dispatch' }, { status: 202 });
    }
    if (String(url).endsWith('/api/v1/jobs/job_failed') && method === 'GET') {
      return Response.json({ jobId: 'job_failed', status: 'failed', stage: 'dispatch' });
    }
    if (String(url).endsWith('/api/v1/jobs/job_failed/summary')) {
      return Response.json({ jobId: 'job_failed', status: 'failed', stage: 'dispatch', error: { message: 'dispatch failed' } });
    }
    if (String(url).endsWith('/api/v1/jobs/job_failed/result')) {
      return Response.json({ error: { code: 'result_not_ready', message: 'Job is failed' } }, { status: 409 });
    }
    if (String(url).endsWith('/issues/9/comments') && method === 'POST') return Response.json({ id: calls.length }, { status: 201 });
    if (String(url).endsWith('/issues/9') && method === 'PATCH') return Response.json({ state: 'closed' });
    throw new Error(`Unexpected request: ${method} ${url}`);
  };
  const body = `${BRIDGE_MARKER}\n\`\`\`json\n${JSON.stringify({ preflightsimJob: request })}\n\`\`\``;
  const result = await runGithubBridge({
    issue: { number: 9, body, user: { login: 'James-Nexus' } },
    repository: 'CurveYield/Agent-Code-Development',
    allowedUsers: 'James-Nexus',
    apiUrl: 'https://preflight.curveyield.online',
    apiKey: 'client-secret',
    githubToken: 'github-token',
    fetcher,
    sleep: async () => {}
  });
  assert.equal(result.status, 'failed');
  assert.equal(calls.some(({ url, init }) => url.endsWith('/issues/9') && init.method === 'PATCH'), true);
});
