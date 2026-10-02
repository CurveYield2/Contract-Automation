import test from 'node:test';
import assert from 'node:assert/strict';
import { runGitHubNativeJob } from '../src/run-job-file.mjs';
import { PHASE6_MUTABLE_RPC_ENV, createPhase6MutableRpcSession } from '../src/phase6-mutable-rpc-v1.mjs';

function upstreamResponse(request) {
  if (request.method === 'eth_chainId') return { jsonrpc: '2.0', id: request.id, result: '0xee0059' };
  if (request.method === 'net_version') return { jsonrpc: '2.0', id: request.id, result: '15597657' };
  if (request.method === 'eth_blockNumber') return { jsonrpc: '2.0', id: request.id, result: '0x10' };
  if (request.method === 'eth_getBlockByNumber') return { jsonrpc: '2.0', id: request.id, result: { number: '0x10', hash: `0x${'1'.repeat(64)}` } };
  return { jsonrpc: '2.0', id: request.id, result: null };
}

async function upstreamFetch(url, options) {
  if (url !== 'https://virtual-mutable-anvil.example/rpc') return fetch(url, options);
  const request = JSON.parse(options.body);
  const payload = Array.isArray(request) ? request.map(upstreamResponse) : upstreamResponse(request);
  return new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json' } });
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

test('Phase 6 keeps virtual identity discovery inside the proxy and hands the same normalized URL to Medusa and Foundry', async () => {
  const session = await createPhase6MutableRpcSession({ environment: { [PHASE6_MUTABLE_RPC_ENV]: 'https://virtual-mutable-anvil.example/rpc' }, fetchImpl: upstreamFetch });
  const calls = [];
  try {
    assert.equal(session.evidence.status, 'PASS');
    assert.equal(session.evidence.identityNormalization.upstreamIdentityVirtualized, true);
    assert.equal(session.evidence.identityNormalization.rawIdentityProbeBypassUsed, false);
    assert.match(session.runtime.url, /^http:\/\/127\.0\.0\.1:/);

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
    assert.equal(medusa.args[medusa.args.indexOf('--rpc-url') + 1], session.runtime.url);
    assert.equal(forge.args[forge.args.indexOf('--fork-url') + 1], session.runtime.url);
    assert.equal(forge.env.ETH_RPC_URL, session.runtime.url);
  } finally {
    await session.close();
  }
});

test('Phase 6 request pin selects and verifies the admitted historical block instead of the mutable head', async () => {
  const expectedHash = `0x${'a'.repeat(64)}`;
  const observedMethods = [];
  async function pinnedFetch(url, options) {
    if (url !== 'https://virtual-mutable-anvil.example/rpc') return fetch(url, options);
    const request = JSON.parse(options.body);
    observedMethods.push({ method: request.method, params: request.params });
    let result = null;
    if (request.method === 'eth_chainId') result = '0xee0059';
    else if (request.method === 'net_version') result = '15597657';
    else if (request.method === 'eth_blockNumber') result = '0x20';
    else if (request.method === 'eth_getBlockByNumber') result = { number: request.params[0], hash: expectedHash };
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: request.id, result }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  const session = await createPhase6MutableRpcSession({
    environment: { [PHASE6_MUTABLE_RPC_ENV]: 'https://virtual-mutable-anvil.example/rpc' },
    fetchImpl: pinnedFetch,
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
    assert.equal(observedMethods.some((entry) => entry.method === 'eth_blockNumber'), false);
    assert.deepEqual(observedMethods.find((entry) => entry.method === 'eth_getBlockByNumber').params, ['0x10', false]);
  } finally {
    await session.close();
  }
});

test('Phase 6 frozen block hash mismatch fails closed', async () => {
  async function mismatchFetch(url, options) {
    if (url !== 'https://virtual-mutable-anvil.example/rpc') return fetch(url, options);
    const request = JSON.parse(options.body);
    let result = null;
    if (request.method === 'eth_chainId') result = '0xee0059';
    else if (request.method === 'net_version') result = '15597657';
    else if (request.method === 'eth_getBlockByNumber') result = { number: request.params[0], hash: `0x${'b'.repeat(64)}` };
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: request.id, result }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  const session = await createPhase6MutableRpcSession({
    environment: { [PHASE6_MUTABLE_RPC_ENV]: 'https://virtual-mutable-anvil.example/rpc' },
    fetchImpl: mismatchFetch,
    frozenBlockNumber: 16,
    frozenBlockHash: `0x${'a'.repeat(64)}`,
  });
  try {
    assert.equal(session.evidence.status, 'FAIL');
    assert.equal(session.evidence.failureKind, 'MUTABLE_RPC_FROZEN_BLOCK_MISMATCH');
    assert.equal(session.runtime, null);
  } finally {
    await session.close();
  }
});
