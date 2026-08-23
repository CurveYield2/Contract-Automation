import test from 'node:test';
import assert from 'node:assert/strict';
import { runGitHubNativeJob } from '../src/run-job-file.mjs';
import {
  PHASE6_MUTABLE_RPC_ENV,
  createPhase6MutableRpcSession,
} from '../src/phase6-mutable-rpc-v1.mjs';

function upstreamResponse(request) {
  const item = Array.isArray(request) ? request[0] : request;
  if (item.method === 'eth_chainId') return { jsonrpc: '2.0', id: item.id, result: '0xee0059' };
  if (item.method === 'net_version') return { jsonrpc: '2.0', id: item.id, result: '15597657' };
  if (item.method === 'eth_blockNumber') return { jsonrpc: '2.0', id: item.id, result: '0x10' };
  if (item.method === 'eth_getBlockByNumber') {
    return {
      jsonrpc: '2.0',
      id: item.id,
      result: {
        number: '0x10',
        hash: `0x${'1'.repeat(64)}`,
        stateRoot: `0x${'2'.repeat(64)}`,
      },
    };
  }
  return { jsonrpc: '2.0', id: item.id, result: null };
}

async function upstreamFetch(url, options) {
  if (url !== 'https://virtual-mutable-anvil.example/rpc') return fetch(url, options);
  const request = JSON.parse(options.body);
  const payload = Array.isArray(request) ? request.map(upstreamResponse) : upstreamResponse(request);
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function phase6Request() {
  return {
    schemaVersion: 'deep-assurance-github-request-v2',
    processId: 'audit-v7-independent-review',
    contractAutomationRelease: {
      repository: 'CurveYield2/Contract-Automation',
      branch: 'recovery/v7-execution-layer-v1',
      commit: '612fa50264e587e3f24550bf4dae35719b04211c',
      contractVersion: 'contract-automation-v7-relocated-v1',
    },
    runnerRelease: {
      version: 'deep-assurance-github-bridge-v1',
      manifestSha256: '2bebd99bb8ae770eb2feca0de7dc7e54596127a0c768922189e907e6658773dc',
    },
    campaignId: 'phase6-rpc-normalization-integration',
    assignmentId: 'reviewer-2-phase-6-rpc-normalization-v1',
    phaseId: 'build-and-test',
    gateId: 'exact-build-and-tests-complete',
    profileId: 'github-native-simulate-v2',
    source: {
      repository: 'CurveYield2/Audits',
      commit: '1'.repeat(40),
      projectPath: 'audit-targets/example',
    },
    configuration: {
      compilers: [{ language: 'solidity', version: '0.8.28' }],
      timeoutMinutes: 20,
      analysis: {
        slither: false,
        medusa: { version: '1.5.1' },
        nativeFuzz: { enabled: true, fuzzRuns: 64 },
      },
    },
    requestId: `dar-${'2'.repeat(32)}`,
    requestDigest: '3'.repeat(64),
  };
}

async function createSession() {
  return createPhase6MutableRpcSession({
    environment: { [PHASE6_MUTABLE_RPC_ENV]: 'https://virtual-mutable-anvil.example/rpc' },
    fetchImpl: upstreamFetch,
  });
}

test('Phase 6 normalizes a virtual-ID mutable Ethereum backend and keeps one normalized RPC alive for execution', async () => {
  const session = await createSession();

  try {
    assert.equal(session.evidence.status, 'PASS');
    assert.equal(session.evidence.expectedChainId, 1);
    assert.equal(session.evidence.observedChainId, 1);
    assert.equal(session.evidence.identityNormalization.status, 'PASS');
    assert.equal(session.evidence.identityNormalization.upstreamIdentityVirtualized, true);
    assert.equal(session.evidence.blockNumber, 16);
    assert.equal(session.runtime.blockNumber, 16);
    assert.equal(session.runtime.blockHash, `0x${'1'.repeat(64)}`);
    assert.equal(session.runtime.profile, PHASE6_MUTABLE_RPC_ENV);
    assert.match(session.runtime.url, /^http:\/\/127\.0\.0\.1:/);
    assert.notEqual(session.runtime.url, 'https://virtual-mutable-anvil.example/rpc');
    assert.equal(JSON.stringify(session.evidence).includes('virtual-mutable-anvil.example'), false);

    const response = await fetch(session.runtime.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 7, method: 'eth_chainId', params: [] }),
    });
    const payload = await response.json();
    assert.equal(payload.result, '0x1');
  } finally {
    await session.close();
  }
});

test('the same Phase-6 normalized endpoint is handed to Medusa and Foundry after preflight', async () => {
  const session = await createSession();
  const request = phase6Request();
  const calls = [];

  try {
    const result = await runGitHubNativeJob(request, {
      checkoutSource: async () => ({
        checkoutRoot: '/tmp/phase6-rpc-normalization-checkout',
        projectRoot: '/tmp/phase6-rpc-normalization-project',
        commit: request.source.commit,
      }),
      buildProject: async () => ({ compilerVersion: '0.8.28', artifacts: [] }),
      phase6MutableRpc: session.runtime,
      environment: {},
      runCommand: async (call) => {
        calls.push(call);
        if (call.command === 'medusa' && call.args[0] === '--version') {
          return { exitCode: 0, stdout: 'medusa version 1.5.1\n', stderr: '' };
        }
        if (call.command === 'medusa' && call.args[0] === 'fuzz') {
          return {
            exitCode: 0,
            stdout: JSON.stringify({ status: 'completed', properties: [], corpus: {}, coverage: {}, statistics: {} }),
            stderr: '',
          };
        }
        if (call.command === 'forge') return { exitCode: 0, stdout: '64 fuzz runs passed\n', stderr: '' };
        throw new Error(`unexpected command ${call.command} ${call.args?.join(' ') ?? ''}`);
      },
    });

    assert.equal(result.status, 'completed');
    const medusaFuzz = calls.find((call) => call.command === 'medusa' && call.args[0] === 'fuzz');
    const forgeFuzz = calls.find((call) => call.command === 'forge');
    assert.ok(medusaFuzz, 'Medusa campaign must execute');
    assert.ok(forgeFuzz, 'Foundry campaign must execute');
    assert.equal(medusaFuzz.args[medusaFuzz.args.indexOf('--rpc-url') + 1], session.runtime.url);
    assert.equal(forgeFuzz.args[forgeFuzz.args.indexOf('--fork-url') + 1], session.runtime.url);
    assert.equal(forgeFuzz.env.ETH_RPC_URL, session.runtime.url);
    assert.equal(JSON.stringify(result).includes('virtual-mutable-anvil.example'), false);
  } finally {
    await session.close();
  }
});
