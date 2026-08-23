import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const identity = await import('../src/archive-rpc-identity-v1.mjs').catch(() => ({}));
const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');

test('Phase 7 archive preflight records remote identity and pinned block evidence without exposing the RPC URL', async () => {
  assert.equal(typeof identity.probeArchiveRpcIdentity, 'function', 'probeArchiveRpcIdentity must be exported');
  const calls = [];
  const responses = new Map([
    ['eth_chainId', '0xee0059'],
    ['net_version', '15597657'],
    ['eth_getBlockByNumber', {
      number: '0x188b9f5',
      hash: `0x${'1'.repeat(64)}`,
      parentHash: `0x${'2'.repeat(64)}`,
      stateRoot: `0x${'3'.repeat(64)}`,
      transactionsRoot: `0x${'4'.repeat(64)}`,
      receiptsRoot: `0x${'5'.repeat(64)}`,
      timestamp: '0x68a77700',
      transactions: [`0x${'6'.repeat(64)}`]
    }],
    ['eth_getTransactionByHash', {
      hash: `0x${'6'.repeat(64)}`,
      blockNumber: '0x188b9f5',
      chainId: '0x1',
      from: `0x${'7'.repeat(40)}`,
      to: `0x${'8'.repeat(40)}`
    }]
  ]);
  const fetchImpl = async (url, options) => {
    assert.equal(url, 'https://secret.example/rpc');
    const body = JSON.parse(options.body);
    calls.push({ method: body.method, params: body.params });
    return {
      ok: true,
      async json() { return { jsonrpc: '2.0', id: body.id, result: responses.get(body.method) }; }
    };
  };

  const evidence = await identity.probeArchiveRpcIdentity({
    rpcUrl: 'https://secret.example/rpc',
    block: 25737717,
    expectedChainId: 1,
    fetchImpl
  });

  assert.deepEqual(calls.map((entry) => entry.method), [
    'eth_chainId',
    'net_version',
    'eth_getBlockByNumber',
    'eth_getTransactionByHash'
  ]);
  assert.equal(evidence.expectedChainId, 1);
  assert.equal(evidence.remoteChainId, 15597657);
  assert.equal(evidence.remoteNetworkId, 15597657);
  assert.equal(evidence.chainIdMatchesExpected, false);
  assert.equal(evidence.block.number, 25737717);
  assert.equal(evidence.block.hash, `0x${'1'.repeat(64)}`);
  assert.equal(evidence.block.stateRoot, `0x${'3'.repeat(64)}`);
  assert.equal(evidence.block.transactionCount, 1);
  assert.equal(evidence.sampleTransaction.chainId, 1);
  assert.equal(evidence.sampleTransaction.blockNumber, 25737717);
  assert.equal('rpcUrl' in evidence, false);
  assert.equal(JSON.stringify(evidence).includes('secret.example'), false);
});

test('canonical V7 runner records archive identity before Phase 7 lifecycle execution and keeps the RPC secret out of evidence paths', () => {
  const preflight = fs.readFileSync(path.join(repoRoot, 'packages/github-native-sim/src/phase7-fork-preflight-v1.mjs'), 'utf8');
  const runner = fs.readFileSync(path.join(repoRoot, 'packages/github-native-sim/src/run-job-file-v2.mjs'), 'utf8');
  const workflow = fs.readFileSync(path.join(repoRoot, '.github/workflows/audit-controller-execution.yml'), 'utf8');

  assert.match(preflight, /import \{ probeArchiveRpcIdentity \}/);
  assert.match(preflight, /upstreamIdentity = await probeUpstreamIdentity/);
  assert.match(preflight, /rpcUrl: forkUrl/);
  assert.match(preflight, /reconcileUpstreamIdentity/);

  const preflightStep = runner.indexOf('preflight = await runPhase7ForkPreflightV2');
  const lifecycleStep = runner.indexOf('runGitHubNativeJobV1(request');
  assert.ok(preflightStep >= 0, 'canonical runner must invoke Phase 7 preflight');
  assert.ok(lifecycleStep > preflightStep, 'archive identity must be reconciled before lifecycle execution');

  assert.match(workflow, /SIM_ARCHIVE_PRIMARY_ETHEREUM_01:\s*\$\{\{\s*secrets\.SIM_ARCHIVE_PRIMARY_ETHEREUM_01\s*\}\}/);
  assert.match(workflow, /npm run v7:execute -- --request \.v7-request\/request\.json/);
  assert.match(workflow, /path:\s*\.audit-evidence\/v7-execution/);
});
