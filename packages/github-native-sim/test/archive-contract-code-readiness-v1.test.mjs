import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const readiness = await import('../src/archive-contract-code-readiness-v1.mjs').catch(() => ({}));
const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');
const TARGET = '0xB7724786ee8247078126Fc091058C46A4F3d9b84';

test('Phase 7 target-code probe reports code presence at the pinned block without exposing the RPC URL', async () => {
  assert.equal(typeof readiness.probeArchiveContractCode, 'function', 'probeArchiveContractCode must be exported');
  const calls = [];
  const fetchImpl = async (url, options) => {
    assert.equal(url, 'https://secret.example/rpc');
    const body = JSON.parse(options.body);
    calls.push(body);
    return {
      ok: true,
      status: 200,
      async json() { return { jsonrpc: '2.0', id: body.id, result: '0x6001600055' }; }
    };
  };

  const evidence = await readiness.probeArchiveContractCode({
    rpcUrl: 'https://secret.example/rpc',
    block: 25737717,
    address: TARGET,
    fetchImpl
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, 'eth_getCode');
  assert.deepEqual(calls[0].params, [TARGET.toLowerCase(), '0x188b9f5']);
  assert.deepEqual(evidence, {
    schemaVersion: 'phase7-archive-contract-code-readiness-v1',
    status: 'code_present',
    block: 25737717,
    address: TARGET.toLowerCase(),
    byteLength: 5,
    rpcMethod: 'eth_getCode'
  });
  assert.equal(JSON.stringify(evidence).includes('secret.example'), false);
});

test('Phase 7 target-code probe distinguishes no-code from sanitized RPC failure', async () => {
  assert.equal(typeof readiness.probeArchiveContractCode, 'function', 'probeArchiveContractCode must be exported');
  const noCode = await readiness.probeArchiveContractCode({
    rpcUrl: 'https://secret.example/rpc',
    block: 25737717,
    address: TARGET,
    fetchImpl: async () => ({ ok: true, status: 200, async json() { return { jsonrpc: '2.0', id: 1, result: '0x' }; } })
  });
  assert.deepEqual(noCode, {
    schemaVersion: 'phase7-archive-contract-code-readiness-v1',
    status: 'no_code',
    block: 25737717,
    address: TARGET.toLowerCase(),
    byteLength: 0,
    rpcMethod: 'eth_getCode'
  });

  const failure = await readiness.probeArchiveContractCode({
    rpcUrl: 'https://secret.example/rpc',
    block: 25737717,
    address: TARGET,
    fetchImpl: async () => ({ ok: false, status: 403, async json() { return { error: { code: -32000, message: 'historical code unavailable' } }; } })
  });
  assert.equal(failure.status, 'unavailable');
  assert.deepEqual(failure.error, {
    kind: 'HTTP_ERROR',
    httpStatus: 403,
    rpcCode: -32000,
    message: 'historical code unavailable'
  });
  assert.equal(JSON.stringify(failure).includes('secret.example'), false);
});

test('canonical V7 runner derives literal Phase 7 targets and proves code before lifecycle execution', () => {
  const preflight = fs.readFileSync(path.join(repoRoot, 'packages/github-native-sim/src/phase7-fork-preflight-v1.mjs'), 'utf8');
  const runner = fs.readFileSync(path.join(repoRoot, 'packages/github-native-sim/src/run-job-file-v2.mjs'), 'utf8');
  const workflow = fs.readFileSync(path.join(repoRoot, '.github/workflows/audit-controller-execution.yml'), 'utf8');

  assert.match(preflight, /function literalTargets\(workflow\)/);
  assert.match(preflight, /\^0x\[0-9a-fA-F\]\{40\}\$/);
  assert.match(preflight, /engine\.provider\.getCode\(address\)/);
  assert.match(preflight, /const targetCode =/);

  const preflightStep = runner.indexOf('preflight = await runPhase7ForkPreflightV2');
  const lifecycleStep = runner.lastIndexOf('runGitHubNativeJobV1(request');
  assert.ok(preflightStep >= 0, 'Phase 7 preflight must be invoked by the canonical runner');
  assert.ok(lifecycleStep > preflightStep, 'target code readiness must be proven before lifecycle execution');

  assert.match(workflow, /name:\s*Execute V7 request/);
  assert.match(workflow, /npm run v7:execute -- --request \.v7-request\/request\.json/);
});
