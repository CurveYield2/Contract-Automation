import test from 'node:test';
import assert from 'node:assert/strict';

const engine = await import('../../runner/src/engine.mjs');

test('Ganache pinned fork pins local networkId to the requested chainId instead of inheriting an upstream virtual-network id', () => {
  assert.equal(typeof engine.buildGanacheOptions, 'function', 'buildGanacheOptions must be exported');
  const options = engine.buildGanacheOptions({
    workflow: { steps: [] },
    chainId: 1,
    forkUrl: 'https://archive.example',
    block: 25737717,
    quiet: true
  });
  assert.equal(options.chain.chainId, 1);
  assert.equal(options.chain.networkId, 1);
  assert.equal(options.fork.url, 'https://archive.example');
  assert.equal(options.fork.blockNumber, 25737717);
});
