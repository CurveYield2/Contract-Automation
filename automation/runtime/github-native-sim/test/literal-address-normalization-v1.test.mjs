import test from 'node:test';
import assert from 'node:assert/strict';
import { GanacheWorkflowRuntime } from '../../runner/src/engine.mjs';

test('literal 20-byte workflow targets are normalized to lowercase before ethers address parsing', () => {
  const constructed = [];
  class FakeContract {
    constructor(target, abi, signerOrProvider) {
      constructed.push({ target, abi, signerOrProvider });
    }
  }
  const provider = { tag: 'provider' };
  const runtime = new GanacheWorkflowRuntime({
    provider,
    artifacts: { get() { throw new Error('artifact lookup is not expected for external literal targets'); } },
    ethers: { Contract: FakeContract }
  });
  const context = {
    aliases: {},
    values: {},
    snapshots: {},
    deployments: {}
  };

  runtime.contractFor({
    action: 'staticCall',
    target: '0xB7724786ee8247078126Fc091058C46A4F3d9b84',
    function: 'owner()'
  }, context, provider);

  assert.equal(constructed.length, 1);
  assert.equal(constructed[0].target, '0xb7724786ee8247078126fc091058c46a4f3d9b84');
  assert.deepEqual(constructed[0].abi, ['function owner()']);
  assert.equal(constructed[0].signerOrProvider, provider);
});

test('workflow references are not rewritten as literal addresses', () => {
  const constructed = [];
  class FakeContract {
    constructor(target) { constructed.push(target); }
  }
  const provider = {};
  const runtime = new GanacheWorkflowRuntime({
    provider,
    artifacts: { get() { return { abi: ['function owner()'] }; } },
    ethers: { Contract: FakeContract }
  });
  const context = {
    aliases: { vault: '0x1111111111111111111111111111111111111111' },
    values: {},
    snapshots: {},
    deployments: { vault: { contractName: 'Vault', sourceName: 'Vault.sol' } }
  };

  runtime.contractFor({ action: 'staticCall', target: '$vault', function: 'owner()' }, context, provider);
  assert.deepEqual(constructed, ['0x1111111111111111111111111111111111111111']);
});
