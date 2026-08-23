import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const readiness = await import('../src/archive-rpc-state-readiness-v1.mjs').catch(() => ({}));
const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');
const PROBE_ACCOUNT = '0x90f8bf6a479f320ead074411a4b0e7944ea8c9c1';

test('Phase 7 archive state-readiness probe verifies historical nonce access without exposing the RPC URL', async () => {
  assert.equal(typeof readiness.probeArchiveRpcStateReadiness, 'function', 'probeArchiveRpcStateReadiness must be exported');
  const calls = [];
  const fetchImpl = async (url, options) => {
    assert.equal(url, 'https://secret.example/rpc');
    const body = JSON.parse(options.body);
    calls.push(body);
    return {
      ok: true,
      status: 200,
      async json() { return { jsonrpc: '2.0', id: body.id, result: '0x2a' }; }
    };
  };

  const evidence = await readiness.probeArchiveRpcStateReadiness({
    rpcUrl: 'https://secret.example/rpc',
    block: 25737717,
    account: PROBE_ACCOUNT,
    fetchImpl
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, 'eth_getTransactionCount');
  assert.deepEqual(calls[0].params, [PROBE_ACCOUNT, '0x188b9f5']);
  assert.deepEqual(evidence, {
    schemaVersion: 'phase7-archive-rpc-state-readiness-v1',
    status: 'ready',
    block: 25737717,
    account: PROBE_ACCOUNT,
    nonce: 42,
    rpcMethod: 'eth_getTransactionCount'
  });
  assert.equal(JSON.stringify(evidence).includes('secret.example'), false);
});

test('Phase 7 archive state-readiness probe records sanitized HTTP and JSON-RPC failures instead of throwing', async () => {
  assert.equal(typeof readiness.probeArchiveRpcStateReadiness, 'function', 'probeArchiveRpcStateReadiness must be exported');
  const httpFailure = await readiness.probeArchiveRpcStateReadiness({
    rpcUrl: 'https://secret.example/rpc',
    block: 25737717,
    account: PROBE_ACCOUNT,
    fetchImpl: async () => ({ ok: false, status: 403, async json() { return { error: { code: -32602, message: 'archive access denied' } }; } })
  });
  assert.deepEqual(httpFailure, {
    schemaVersion: 'phase7-archive-rpc-state-readiness-v1',
    status: 'unavailable',
    block: 25737717,
    account: PROBE_ACCOUNT,
    rpcMethod: 'eth_getTransactionCount',
    error: { kind: 'HTTP_ERROR', httpStatus: 403, rpcCode: -32602, message: 'archive access denied' }
  });

  const rpcFailure = await readiness.probeArchiveRpcStateReadiness({
    rpcUrl: 'https://secret.example/rpc',
    block: 25737717,
    account: PROBE_ACCOUNT,
    fetchImpl: async () => ({ ok: true, status: 200, async json() { return { jsonrpc: '2.0', id: 1, error: { code: -32000, message: 'historical state unavailable' } }; } })
  });
  assert.equal(rpcFailure.status, 'unavailable');
  assert.deepEqual(rpcFailure.error, { kind: 'JSON_RPC_ERROR', httpStatus: 200, rpcCode: -32000, message: 'historical state unavailable' });
  assert.equal(JSON.stringify(httpFailure).includes('secret.example'), false);
  assert.equal(JSON.stringify(rpcFailure).includes('secret.example'), false);
});

test('V7 trusted workflow records archive state readiness before starting the Phase 7 lifecycle', () => {
  const workflow = fs.readFileSync(path.join(repoRoot, '.github/workflows/audit-controller-execution-v4.yml'), 'utf8');
  const readinessStep = workflow.indexOf('Record Phase 7 archive state readiness');
  const executionStep = workflow.indexOf('Execute V7 GitHub-native request');
  assert.ok(readinessStep >= 0, 'archive state-readiness step must exist');
  assert.ok(executionStep > readinessStep, 'archive state-readiness evidence must be recorded before lifecycle execution');
  assert.match(workflow, /probeArchiveRpcStateReadiness/);
  assert.match(workflow, /archive-rpc-state-readiness-v1\.json/);
  assert.match(workflow, /90f8bf6a479f320ead074411a4b0e7944ea8c9c1/i);
});
