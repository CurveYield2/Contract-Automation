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

test('canonical V7 runner proves pinned Phase 7 state readiness before lifecycle execution', () => {
  const preflight = fs.readFileSync(path.join(repoRoot, 'packages/github-native-sim/src/phase7-fork-preflight-v1.mjs'), 'utf8');
  const runner = fs.readFileSync(path.join(repoRoot, 'packages/github-native-sim/src/run-job-file-v2.mjs'), 'utf8');

  assert.match(preflight, /const localBlock = await engine\.provider\.getBlock\(simulation\.block\)/);
  assert.match(preflight, /const pinnedBlockState =/);
  assert.match(preflight, /localHashMatch/);
  assert.match(preflight, /proveImpersonationBalanceControl/);

  const preflightStep = runner.indexOf('preflight = await runPhase7ForkPreflightV2');
  const lifecycleStep = runner.indexOf('runGitHubNativeJobV1(request');
  assert.ok(preflightStep >= 0, 'canonical runner must invoke Phase 7 preflight');
  assert.ok(lifecycleStep > preflightStep, 'pinned historical state readiness must be proven before lifecycle execution');
});
