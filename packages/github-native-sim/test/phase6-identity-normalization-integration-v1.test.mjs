import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';

import { runGitHubNativeJob } from '../src/run-job-file.mjs';
import {
  phase6MutableRpcRuntime,
  probePhase6MutableRpc,
  startPhase6NormalizedRpcV1,
} from '../src/phase6-mutable-rpc-v1.mjs';

const VIRTUAL_CHAIN_ID = 15597657;
const PINNED_BLOCK = 25817400;
const PINNED_BLOCK_HEX = `0x${PINNED_BLOCK.toString(16)}`;
const PINNED_BLOCK_HASH = `0x${'7'.repeat(64)}`;

async function startVirtualEthereumRpc(t) {
  const methods = [];
  const server = http.createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    methods.push(payload.method);
    let result;
    if (payload.method === 'eth_chainId') result = `0x${VIRTUAL_CHAIN_ID.toString(16)}`;
    else if (payload.method === 'net_version') result = String(VIRTUAL_CHAIN_ID);
    else if (payload.method === 'eth_blockNumber') result = PINNED_BLOCK_HEX;
    else if (payload.method === 'eth_getBlockByNumber') result = { number: PINNED_BLOCK_HEX, hash: PINNED_BLOCK_HASH };
    else result = null;
    const body = JSON.stringify({ jsonrpc: '2.0', id: payload.id, result });
    response.writeHead(200, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) });
    response.end(body);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const address = server.address();
  return { url: `http://127.0.0.1:${address.port}`, methods };
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
    campaignId: 'phase6-identity-integration',
    assignmentId: 'reviewer-2-phase-6-identity-v1',
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

test('Phase 6 normalizes a virtual Ethereum identity once and routes preflight, Medusa, and Foundry through the same proxy endpoint', async (t) => {
  const upstream = await startVirtualEthereumRpc(t);
  const normalized = await startPhase6NormalizedRpcV1({
    environment: { SIM_ARCHIVE_PRIMARY_ETHEREUM_01: upstream.url },
  });
  t.after(() => normalized.close());

  assert.notEqual(normalized.url, upstream.url, 'Phase 6 must not expose the raw mutable RPC to tools');

  const mutableRpc = await probePhase6MutableRpc({ rpcUrl: normalized.url });
  assert.equal(mutableRpc.status, 'PASS');
  assert.equal(mutableRpc.observedChainId, 1);
  assert.equal(mutableRpc.chainIdMatchesExpected, true);
  assert.equal(mutableRpc.blockNumber, PINNED_BLOCK);
  assert.equal(mutableRpc.blockHash, PINNED_BLOCK_HASH);

  const runtime = phase6MutableRpcRuntime({
    preflight: { mutableRpc },
    rpcUrl: normalized.url,
  });
  assert.equal(runtime.url, normalized.url);

  const calls = [];
  const request = phase6Request();
  const result = await runGitHubNativeJob(request, {
    checkoutSource: async () => ({
      checkoutRoot: '/tmp/phase6-identity-integration-checkout',
      projectRoot: '/tmp/phase6-identity-integration-project',
      commit: request.source.commit,
    }),
    buildProject: async () => ({ compilerVersion: '0.8.28', artifacts: [] }),
    phase6MutableRpc: runtime,
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
  assert.equal(medusaFuzz.args[medusaFuzz.args.indexOf('--rpc-url') + 1], normalized.url);
  assert.equal(forgeFuzz.args[forgeFuzz.args.indexOf('--fork-url') + 1], normalized.url);
  assert.equal(forgeFuzz.env.ETH_RPC_URL, normalized.url);
  assert.ok(upstream.methods.includes('eth_chainId'), 'Phase-6 preflight must probe through the normalized proxy');
  assert.ok(upstream.methods.includes('eth_blockNumber'));
  assert.ok(upstream.methods.includes('eth_getBlockByNumber'));
});
