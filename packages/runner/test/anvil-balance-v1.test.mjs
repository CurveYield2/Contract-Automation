import test from 'node:test';
import assert from 'node:assert/strict';
import { GanacheWorkflowRuntime } from '../src/engine.mjs';

test('workflow runtime uses configured Anvil balance RPC for setBalance', async () => {
  const calls = [];
  const provider = {
    async send(method, params) {
      calls.push([method, params]);
      return true;
    }
  };
  const runtime = new GanacheWorkflowRuntime({
    provider,
    artifacts: {},
    ethers: { toBeHex: (value) => `0x${value.toString(16)}` },
    balanceRpcMethod: 'anvil_setBalance'
  });
  const context = {
    aliases: { account1: '0x0000000000000000000000000000000000000001' },
    values: {},
    snapshots: {},
    deployments: {}
  };
  await runtime.setBalance({ account: '$account1', amount: '16' }, context);
  assert.deepEqual(calls, [[
    'anvil_setBalance',
    ['0x0000000000000000000000000000000000000001', '0x10']
  ]]);
});
