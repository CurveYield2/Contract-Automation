import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runTargetFoundryPreflightV1 } from '../src/foundry-target-preflight-v1.mjs';
import { digestDirectory } from '../src/phase6-staged-snapshot-v1.mjs';

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'foundry-target-preflight-'));
  await fs.mkdir(path.join(root, 'test'), { recursive: true });
  await fs.writeFile(path.join(root, 'foundry.toml'), '[profile.default]\nsrc="src"\ntest="test"\nsolc_version="0.8.28"\n');
  await fs.mkdir(path.join(root, 'src'), { recursive: true });
  await fs.writeFile(path.join(root, 'src', 'Counter.sol'), 'pragma solidity ^0.8.28; contract Counter { uint256 public x; function set(uint256 v) external { x=v; } }\n');
  await fs.writeFile(path.join(root, 'test', 'Counter.t.sol'), 'pragma solidity ^0.8.28; import "../src/Counter.sol"; contract CounterTest { function testFuzzSet(uint256 v) public { Counter c=new Counter(); c.set(v); assert(c.x()==v); } }\n');
  return root;
}

function commandHarness({ smokeStdout = 'Ran 1 test for test/Counter.t.sol:CounterTest\n[PASS] testFuzzSet(uint256)\nSuite result: ok. 1 passed; 0 failed; 0 skipped', smokeExitCode = 0 } = {}) {
  const calls = [];
  return {
    calls,
    runCommand: async ({ command, args, cwd }) => {
      calls.push({ command, args: [...args], cwd });
      assert.equal(command, 'forge');
      if (args[0] === '--version') return { exitCode: 0, stdout: 'forge Version: 1.7.1', stderr: '' };
      if (args[0] === 'test' && args.includes('--list')) return { exitCode: 0, stdout: 'test/Counter.t.sol\n  CounterTest\n    testFuzzSet(uint256)\n', stderr: '' };
      if (args[0] === 'test') return { exitCode: smokeExitCode, stdout: smokeStdout, stderr: '' };
      throw new Error(`unexpected forge args ${args.join(' ')}`);
    },
  };
}

async function baseInput(root) {
  const snapshot = await digestDirectory(root);
  return {
    projectRoot: root,
    sourceCommit: '1'.repeat(40),
    snapshotDigestSha256: snapshot.digestSha256,
    expectedSnapshotDigestSha256: snapshot.digestSha256,
    medusaTerminalStatus: 'COMPLETED',
    rpcUrl: 'http://127.0.0.1:8545',
    rpcProfile: 'SIM_ARCHIVE_PRIMARY_ETHEREUM_01',
    rpcBlock: 25666794,
    rpcBlockHash: `0x${'2'.repeat(64)}`,
    fuzzRuns: 16,
  };
}

test('Foundry actual-target smoke discovers and executes the real target before authorizing native fuzz', async () => {
  const root = await fixture();
  const harness = commandHarness();
  const receipt = await runTargetFoundryPreflightV1(await baseInput(root), { runCommand: harness.runCommand });
  assert.equal(receipt.status, 'PREFLIGHT_PASS');
  assert.equal(receipt.targetSmoke.discoveredTestCount, 1);
  assert.deepEqual(receipt.targetSmoke.discoveredTests, ['testFuzzSet(uint256)']);
  assert.equal(receipt.targetSmoke.semanticSuiteStatus, 'PASS');
  assert.equal(harness.calls.filter((x) => x.args[0] === 'test').length, 2);
});

test('Foundry actual-target smoke blocks the historical zero-exit FAILED suite from PR 144', async () => {
  const root = await fixture();
  const harness = commandHarness({ smokeStdout: 'Ran 1 test for test/Counter.t.sol:CounterTest\n[FAIL: assertion failed] testFuzzSet(uint256)\nSuite result: FAILED. 0 passed; 1 failed; 0 skipped', smokeExitCode: 0 });
  const receipt = await runTargetFoundryPreflightV1(await baseInput(root), { runCommand: harness.runCommand });
  assert.equal(receipt.status, 'PREFLIGHT_FAIL');
  assert.equal(receipt.firstFailure, 'FOUNDRY_SEMANTIC_SUITE_FAILURE');
  const failure = receipt.diagnostics.find((d) => d.failureCode === 'FOUNDRY_SEMANTIC_SUITE_FAILURE');
  assert.equal(failure.historicalSignatureId, 'FOUNDRY-001');
  assert.match(failure.remediation, /failing test/i);
});

test('Foundry actual-target smoke blocks zero discovered tests before the expensive campaign', async () => {
  const root = await fixture();
  const receipt = await runTargetFoundryPreflightV1(await baseInput(root), {
    runCommand: async ({ args }) => {
      if (args[0] === '--version') return { exitCode: 0, stdout: 'forge Version: 1.7.1', stderr: '' };
      if (args.includes('--list')) return { exitCode: 0, stdout: '', stderr: '' };
      throw new Error('full smoke must not run when discovery is empty');
    },
  });
  assert.equal(receipt.firstFailure, 'FOUNDRY_NO_TESTS_DISCOVERED');
  assert.equal(receipt.doNotExecute, true);
});

test('Foundry actual-target smoke refuses to run before substantive Medusa terminal evidence', async () => {
  const root = await fixture();
  const harness = commandHarness();
  const receipt = await runTargetFoundryPreflightV1({ ...(await baseInput(root)), medusaTerminalStatus: 'RUNNING' }, { runCommand: harness.runCommand });
  assert.equal(receipt.firstFailure, 'FOUNDRY_MEDUSA_PREDECESSOR_NOT_TERMINAL');
  assert.equal(harness.calls.some((x) => x.args[0] === 'test'), false);
});
