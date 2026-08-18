import test from 'node:test';
import assert from 'node:assert/strict';
import { runNativeFuzzAnalysis } from '../src/native-fuzz.mjs';

const commit = (c) => c.repeat(40);

function baseInput() {
  return {
    projectRoot: '/tmp/project',
    sourceCommit: commit('1'),
    rawArtifactRef: 'github-actions://CurveYield/contract-automation/runs/1/artifacts/native-fuzz/raw.txt',
    command: 'forge',
    args: ['test', '--fuzz-runs', '256'],
    recoverableExitCodes: [2]
  };
}

test('successful native fuzz is a distinct completed component with raw evidence', async () => {
  const calls = [];
  const result = await runNativeFuzzAnalysis(baseInput(), {
    runCommand: async (call) => {
      calls.push(call);
      return { exitCode: 0, stdout: '256 fuzz runs passed\n', stderr: '' };
    }
  });
  assert.equal(result.backend, 'native-fuzz');
  assert.equal(result.terminal, true);
  assert.equal(result.status, 'completed');
  assert.equal(result.componentStatus, 'COMPLETED');
  assert.equal(result.continuationDisposition, 'COMPLETE_EVIDENCE');
  assert.equal(result.rawArtifactRef, baseInput().rawArtifactRef);
  assert.match(result.rawOutput.stdout, /256 fuzz runs passed/);
  assert.deepEqual(calls[0], { command: 'forge', args: ['test', '--fuzz-runs', '256'], cwd: '/tmp/project' });
});

test('configured native-fuzz limitation is typed as recoverable and preserves continuation', async () => {
  const result = await runNativeFuzzAnalysis(baseInput(), {
    runCommand: async () => ({ exitCode: 2, stdout: 'coverage unavailable', stderr: 'backend limitation' })
  });
  assert.equal(result.terminal, true);
  assert.equal(result.status, 'completed_with_limitations');
  assert.equal(result.failureKind, 'RECOVERABLE_LIMITATION');
  assert.equal(result.componentStatus, 'COMPLETED_WITH_FAILURES');
  assert.equal(result.continuationDisposition, 'CONTINUE_WITH_LIMITATION');
  assert.equal(result.rawOutput.exitCode, 2);
});

test('non-recoverable native-fuzz execution failure is typed as hard failure', async () => {
  const result = await runNativeFuzzAnalysis(baseInput(), {
    runCommand: async () => ({ exitCode: 1, stdout: '', stderr: 'fatal fuzz harness error' })
  });
  assert.equal(result.terminal, true);
  assert.equal(result.status, 'failed');
  assert.equal(result.failureKind, 'HARD_FAILURE');
  assert.equal(result.componentStatus, 'FAILED');
  assert.equal(result.continuationDisposition, 'STOP_EXECUTION');
  assert.match(result.rawOutput.stderr, /fatal fuzz harness error/);
});
