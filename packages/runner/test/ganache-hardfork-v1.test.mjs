import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGanacheOptions } from '../src/engine.mjs';

test('Ganache options honor the requested Cancun EVM hardfork', () => {
  const options = buildGanacheOptions({
    workflow: { steps: [] },
    chainId: 1,
    forkUrl: 'http://127.0.0.1:8545',
    block: 25737717,
    hardfork: 'cancun'
  });
  assert.equal(options.chain.hardfork, 'cancun');
  assert.equal(options.chain.chainId, 1);
  assert.equal(options.chain.networkId, 1);
  assert.equal(options.fork.blockNumber, 25737717);
});
