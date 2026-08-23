import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { selectForkEngineName, buildAnvilArgs, createAnvilProviderAdapter } from '../src/anvil-engine.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const runnerSrc = path.resolve(here, '../src');

test('full lifecycle simulation selects Anvil for both modern and legacy EVM versions', () => {
  assert.equal(selectForkEngineName('cancun'), 'anvil');
  assert.equal(selectForkEngineName('shanghai'), 'anvil');
  assert.equal(selectForkEngineName('london'), 'anvil');
});

test('Anvil fork arguments pin chain, block, hardfork and loopback binding', () => {
  const args = buildAnvilArgs({
    chainId: 1,
    forkUrl: 'http://127.0.0.1:18445',
    block: 25737717,
    port: 19545,
    hardfork: 'cancun'
  });
  assert.deepEqual(args, [
    '--host', '127.0.0.1',
    '--port', '19545',
    '--chain-id', '1',
    '--hardfork', 'cancun',
    '--fork-url', 'http://127.0.0.1:18445',
    '--fork-block-number', '25737717',
    '--accounts', '20',
    '--silent'
  ]);
});

test('Anvil provider adapter translates only balance-control RPC and preserves provider methods', async () => {
  const calls = [];
  const realProvider = {
    async send(method, params) {
      calls.push([method, params]);
      return method;
    },
    getSigner(address) {
      return `signer:${address}`;
    }
  };
  const adapted = createAnvilProviderAdapter(realProvider);
  await adapted.send('evm_setAccountBalance', ['0xabc', '0x10']);
  await adapted.send('evm_mine', []);
  assert.deepEqual(calls, [
    ['anvil_setBalance', ['0xabc', '0x10']],
    ['evm_mine', []]
  ]);
  assert.equal(adapted.getSigner('0xabc'), 'signer:0xabc');
});

test('Anvil runtime is isolated from the Ganache-bearing engine module', () => {
  const anvilSource = fs.readFileSync(path.join(runnerSrc, 'anvil-engine.mjs'), 'utf8');
  const sharedRuntimePath = path.join(runnerSrc, 'workflow-runtime.mjs');
  assert.equal(fs.existsSync(sharedRuntimePath), true, 'shared Ganache-free workflow runtime module must exist');
  const sharedRuntime = fs.readFileSync(sharedRuntimePath, 'utf8');

  assert.match(anvilSource, /from ['"]\.\/workflow-runtime\.mjs['"]/);
  assert.doesNotMatch(anvilSource, /from ['"]\.\/engine\.mjs['"]/);
  assert.doesNotMatch(sharedRuntime, /\bganache\b/i);
  assert.match(sharedRuntime, /export class WorkflowRuntime/);
});
