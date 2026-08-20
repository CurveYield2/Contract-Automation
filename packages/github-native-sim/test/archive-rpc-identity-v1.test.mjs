import test from 'node:test';
import assert from 'node:assert/strict';

const identity = await import('../src/archive-rpc-identity-v1.mjs').catch(() => ({}));

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
