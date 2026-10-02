import test from 'node:test';
import assert from 'node:assert/strict';
import { V7_POLICY } from '../src/v7-policy.mjs';
import {
  V7_TOOLCHAIN,
  verifyV7Toolchain,
} from '../src/v7-toolchain-v1.mjs';

test('V7 toolchain contract pins Slither Medusa and Forge from the central policy', () => {
  assert.deepEqual(V7_TOOLCHAIN, {
    slither: { command: 'slither', version: V7_POLICY.tools.slither },
    medusa: { command: 'medusa', version: V7_POLICY.tools.medusa },
    forge: { command: 'forge', version: V7_POLICY.tools.forge },
  });
});

test('V7 toolchain verifier accepts the exact pinned executables used by Phase 6', async () => {
  const calls = [];
  const result = await verifyV7Toolchain({
    runCommand: async ({ command, args }) => {
      calls.push([command, ...args]);
      if (command === 'slither') return { exitCode: 0, stdout: '0.11.6\n', stderr: '' };
      if (command === 'medusa') return { exitCode: 0, stdout: 'medusa 1.5.1\n', stderr: '' };
      if (command === 'forge') return { exitCode: 0, stdout: 'forge Version: 1.7.1-stable\n', stderr: '' };
      return { exitCode: 127, stdout: '', stderr: 'unexpected tool' };
    },
  });

  assert.deepEqual(calls, [
    ['slither', '--version'],
    ['medusa', '--version'],
    ['forge', '--version'],
  ]);
  assert.equal(result.status, 'PASS');
  assert.equal(result.tools.slither.status, 'PASS');
  assert.equal(result.tools.medusa.status, 'PASS');
  assert.equal(result.tools.forge.status, 'PASS');
});

test('V7 toolchain verifier fails closed when Medusa is missing', async () => {
  const result = await verifyV7Toolchain({
    runCommand: async ({ command }) => {
      if (command === 'slither') return { exitCode: 0, stdout: '0.11.6', stderr: '' };
      if (command === 'medusa') return { exitCode: -1, stdout: '', stderr: 'spawn medusa ENOENT' };
      if (command === 'forge') return { exitCode: 0, stdout: 'forge Version: 1.7.1-stable', stderr: '' };
      return { exitCode: 127, stdout: '', stderr: '' };
    },
  });

  assert.equal(result.status, 'FAIL');
  assert.equal(result.tools.medusa.status, 'FAIL');
  assert.equal(result.tools.medusa.failureKind, 'TOOL_UNAVAILABLE');
});
