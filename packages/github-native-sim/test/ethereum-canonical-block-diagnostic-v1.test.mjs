import test from 'node:test';
import assert from 'node:assert/strict';

const blockNumber = 25737717;
const blockTag = `0x${blockNumber.toString(16)}`;
const expectedHash = '0x360a9fcfe686529fbf4ef56d9b86c7527c89b52d73e17bff82308bc80816f12a';
const expectedStateRoot = '0x2c3d6d2e93993e4c58e826454ea8f638562921a38796ec5807fa1674ebacb65a';
const endpoints = [
  'https://ethereum-rpc.publicnode.com',
  'https://eth.llamarpc.com',
  'https://rpc.flashbots.net'
];

async function rpc(url) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getBlockByNumber', params: [blockTag, false] })
  });
  if (!response.ok) throw new Error(`${new URL(url).hostname}: HTTP ${response.status}`);
  const payload = await response.json();
  if (payload.error) throw new Error(`${new URL(url).hostname}: ${payload.error.message}`);
  if (!payload.result) throw new Error(`${new URL(url).hostname}: no block result`);
  return {
    endpoint: new URL(url).hostname,
    number: Number(BigInt(payload.result.number)),
    hash: payload.result.hash,
    stateRoot: payload.result.stateRoot,
    transactionsRoot: payload.result.transactionsRoot,
    receiptsRoot: payload.result.receiptsRoot,
    timestamp: Number(BigInt(payload.result.timestamp)),
    transactionCount: Array.isArray(payload.result.transactions) ? payload.result.transactions.length : null
  };
}

test('independent public Ethereum RPCs confirm the pinned Phase 7 block identity', async () => {
  const settled = await Promise.allSettled(endpoints.map(rpc));
  const successes = settled.filter((item) => item.status === 'fulfilled').map((item) => item.value);
  const failures = settled.filter((item) => item.status === 'rejected').map((item) => item.reason?.message ?? String(item.reason));
  console.log(`canonical_ethereum_block_evidence=${JSON.stringify({ successes, failures })}`);
  assert.ok(successes.length >= 2, `need at least two independent public RPC confirmations; failures=${failures.join(' | ')}`);
  for (const result of successes) {
    assert.equal(result.number, blockNumber);
    assert.equal(result.hash, expectedHash, `${result.endpoint} block hash mismatch`);
    assert.equal(result.stateRoot, expectedStateRoot, `${result.endpoint} state root mismatch`);
  }
});
