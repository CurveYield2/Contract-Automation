import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PHASE6_MUTABLE_RPC_ENV,
  createPhase6MutableRpcSession,
} from '../src/phase6-mutable-rpc-v1.mjs';

const UPSTREAM = 'https://virtual-upstream.example/rpc';
const LOCAL = 'http://127.0.0.1:18545';
const HASH = `0x${'1'.repeat(64)}`;

function rpcResponse(url, request) {
  if (request.method === 'eth_chainId') {
    return { jsonrpc: '2.0', id: request.id, result: url === LOCAL ? '0x1' : '0xee0059' };
  }
  if (request.method === 'eth_blockNumber') return { jsonrpc: '2.0', id: request.id, result: '0x10' };
  if (request.method === 'eth_getBlockByNumber') {
    return { jsonrpc: '2.0', id: request.id, result: { number: request.params[0], hash: HASH } };
  }
  return { jsonrpc: '2.0', id: request.id, result: null };
}

async function fetchImpl(url, options) {
  const request = JSON.parse(options.body);
  return new Response(JSON.stringify(rpcResponse(url, request)), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

test('Phase 6 launches one local Anvil fork and hands its loopback RPC to execution', async () => {
  let closed = false;
  let launch = null;
  const session = await createPhase6MutableRpcSession({
    environment: { [PHASE6_MUTABLE_RPC_ENV]: UPSTREAM },
    fetchImpl,
    startEngine: async (options) => {
      launch = options;
      return { url: LOCAL, engine: 'anvil', async close() { closed = true; } };
    },
  });

  try {
    assert.equal(session.evidence.status, 'PASS');
    assert.equal(session.evidence.expectedChainId, 1);
    assert.equal(session.evidence.observedChainId, 1);
    assert.equal(session.evidence.identityNormalization.status, 'PASS');
    assert.equal(session.evidence.identityNormalization.mode, 'LOCAL_EPHEMERAL_ANVIL_FORK');
    assert.equal(session.evidence.identityNormalization.upstreamIdentityVirtualized, true);
    assert.equal(session.evidence.blockNumber, 16);
    assert.equal(session.runtime.blockNumber, 16);
    assert.equal(session.runtime.blockHash, HASH);
    assert.equal(session.runtime.profile, PHASE6_MUTABLE_RPC_ENV);
    assert.equal(session.runtime.url, LOCAL);
    assert.equal(launch.forkUrl, UPSTREAM);
    assert.equal(launch.chainId, 1);
    assert.equal(launch.block, 'latest');
    assert.equal(JSON.stringify(session.evidence).includes('virtual-upstream.example'), false);
  } finally {
    await session.close();
  }
  assert.equal(closed, true);
});
