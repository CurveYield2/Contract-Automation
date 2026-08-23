import test from 'node:test';
import assert from 'node:assert/strict';
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

test('Phase 6 normalizes a virtual-ID mutable Ethereum backend and keeps one normalized RPC alive for execution', async () => {
  const session = await createPhase6MutableRpcSession({
    environment: { [PHASE6_MUTABLE_RPC_ENV]: 'https://virtual-mutable-anvil.example/rpc' },
    fetchImpl: upstreamFetch,
  });

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
