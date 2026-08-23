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

test('V7 trusted workflow derives and records the first literal Phase 7 target code before lifecycle execution', () => {
  const workflow = fs.readFileSync(path.join(repoRoot, '.github/workflows/audit-controller-execution-v4.yml'), 'utf8');
  const codeStep = workflow.indexOf('Record Phase 7 target code readiness');
  const executionStep = workflow.indexOf('Execute V7 GitHub-native request');
  assert.ok(codeStep >= 0, 'target code-readiness step must exist');
  assert.ok(executionStep > codeStep, 'target code evidence must be recorded before lifecycle execution');
  assert.match(workflow, /probeArchiveContractCode/);
  assert.match(workflow, /archive-contract-code-readiness-v1\.json/);
  assert.match(workflow, /workflow\.steps\.find/);
  assert.match(workflow, /\^0x\[0-9a-fA-F\]\{40\}\$/);
});
