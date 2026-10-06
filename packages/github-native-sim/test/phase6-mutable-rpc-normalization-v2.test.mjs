import test from 'node:test';
import assert from 'node:assert/strict';
import { runGitHubNativeJob } from '../src/run-job-file.mjs';
import { PHASE6_MUTABLE_RPC_ENV, createPhase6MutableRpcSession } from '../src/phase6-mutable-rpc-v1.mjs';

const UPSTREAM = 'https://virtual-upstream.example/rpc';
const LOCAL = 'http://127.0.0.1:18545';

function makeFetch({ localHash = `0x${'1'.repeat(64)}`, observed = [] } = {}) {
  return async (url, options) => {
    const request = JSON.parse(options.body);
    observed.push({ url, method: request.method, params: request.params });
    let result = null;
    if (request.method === 'eth_chainId') result = url === LOCAL ? '0x1' : '0xee0059';
    else if (request.method === 'eth_blockNumber') result = '0x10';
    else if (request.method === 'eth_getBlockByNumber') result = { number: request.params[0], hash: localHash };
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: request.id, result }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
}

function fakeEngine(capture = {}) {
  return async (options) => {
    capture.options = options;
    return { url: LOCAL, engine: 'anvil', async close() { capture.closed = true; } };
  };
}

function request() {
  return {
    schemaVersion: 'deep-assurance-github-request-v2',
    processId: 'audit-v7-independent-review',
    contractAutomationRelease: { repository: 'CurveYield2/Contract-Automation', branch: 'recovery/v7-execution-layer-v1', commit: '612fa50264e587e3f24550bf4dae35719b04211c', contractVersion: 'contract-automation-v7-relocated-v1' },
    runnerRelease: { version: 'deep-assurance-github-bridge-v1', manifestSha256: '2bebd99bb8ae770eb2feca0de7dc7e54596127a0c768922189e907e6658773dc' },
    campaignId: 'phase6-normalized-rpc-v2', assignmentId: 'reviewer-2-phase6-normalized-rpc-v2', phaseId: 'build-and-test', gateId: 'exact-build-and-tests-complete', profileId: 'github-native-simulate-v2',
    source: { repository: 'CurveYield2/Audits', commit: '1'.repeat(40), projectPath: 'audit-targets/example' },
    configuration: { compilers: [{ language: 'solidity', version: '0.8.28' }], timeoutMinutes: 20, analysis: { slither: false, medusa: { version: '1.5.1' }, nativeFuzz: { enabled: true, fuzzRuns: 64 } } },
    requestId: `dar-${'2'.repeat(32)}`, requestDigest: '3'.repeat(64),
  };
}

test('Phase 6 hands the same local Anvil URL to Medusa and Foundry', async () => {
  const capture = {};
  const session = await createPhase6MutableRpcSession({
    environment: { [PHASE6_MUTABLE_RPC_ENV]: UPSTREAM },
    fetchImpl: makeFetch(),
    startEngine: fakeEngine(capture),
  });
  const calls = [];
  try {
    assert.equal(session.evidence.status, 'PASS');
    assert.equal(session.evidence.identityNormalization.mode, 'LOCAL_EPHEMERAL_ANVIL_FORK');
    assert.equal(session.runtime.url, LOCAL);
    assert.equal(capture.options.forkUrl, UPSTREAM);

    const result = await runGitHubNativeJob(request(), {
      checkoutSource: async () => ({ checkoutRoot: '/tmp/p6-v2-checkout', projectRoot: '/tmp/p6-v2-project', commit: '1'.repeat(40) }),
      buildProject: async () => ({ compilerVersion: '0.8.28', artifacts: [] }),
      phase6MutableRpc: session.runtime,
      environment: {},
      runCommand: async (call) => {
        calls.push(call);
        if (call.command === 'medusa' && call.args[0] === '--version') return { exitCode: 0, stdout: 'medusa 1.5.1', stderr: '' };
        if (call.command === 'medusa') return { exitCode: 0, stdout: JSON.stringify({ status: 'completed', properties: [], corpus: {}, coverage: {}, statistics: {} }), stderr: '' };
        if (call.command === 'forge') return { exitCode: 0, stdout: '64 fuzz runs passed', stderr: '' };
        throw new Error(`unexpected command ${call.command}`);
      },
    });

    assert.equal(result.status, 'completed');
    const medusa = calls.find((call) => call.command === 'medusa' && call.args[0] === 'fuzz');
    const forge = calls.find((call) => call.command === 'forge');
    assert.equal(medusa.args[medusa.args.indexOf('--rpc-url') + 1], LOCAL);
    assert.equal(forge.args[forge.args.indexOf('--fork-url') + 1], LOCAL);
    assert.equal(forge.env.ETH_RPC_URL, LOCAL);
  } finally {
    await session.close();
  }
});

test('Phase 6 request pin launches local Anvil at the admitted historical block', async () => {
  const expectedHash = `0x${'a'.repeat(64)}`;
  const observed = [];
  const capture = {};
  const session = await createPhase6MutableRpcSession({
    environment: { [PHASE6_MUTABLE_RPC_ENV]: UPSTREAM },
    fetchImpl: makeFetch({ localHash: expectedHash, observed }),
    startEngine: fakeEngine(capture),
    frozenBlockNumber: 16,
    frozenBlockHash: expectedHash,
  });
  try {
    assert.equal(session.evidence.status, 'PASS');
    assert.equal(session.evidence.requestPinned, true);
    assert.equal(session.evidence.blockNumber, 16);
    assert.equal(session.evidence.blockHash, expectedHash);
    assert.equal(session.evidence.blockHashMatchesExpected, true);
    assert.equal(session.runtime.blockNumber, 16);
    assert.equal(capture.options.block, 16);
    assert.equal(observed.filter((entry) => entry.url === LOCAL).some((entry) => entry.method === 'eth_blockNumber'), false);
    assert.deepEqual(observed.find((entry) => entry.url === LOCAL && entry.method === 'eth_getBlockByNumber').params, ['0x10', false]);
  } finally {
    await session.close();
  }
});

test('Phase 6 frozen block hash mismatch fails closed and shuts down local Anvil', async () => {
  const capture = {};
  const session = await createPhase6MutableRpcSession({
    environment: { [PHASE6_MUTABLE_RPC_ENV]: UPSTREAM },
    fetchImpl: makeFetch({ localHash: `0x${'b'.repeat(64)}` }),
    startEngine: fakeEngine(capture),
    frozenBlockNumber: 16,
    frozenBlockHash: `0x${'a'.repeat(64)}`,
  });
  assert.equal(session.evidence.status, 'FAIL');
  assert.equal(session.evidence.failureKind, 'MUTABLE_RPC_FROZEN_BLOCK_MISMATCH');
  assert.equal(session.runtime, null);
  assert.equal(capture.closed, true);
});
