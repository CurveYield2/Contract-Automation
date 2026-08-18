import test from 'node:test';
import assert from 'node:assert/strict';
import { V7ExecutionError } from '../src/execution.mjs';
import { runSlitherAnalysis } from '../src/analysis.mjs';

const commit = (c) => c.repeat(40);

function sequence(results) {
  const calls = [];
  const runCommand = async (call) => {
    calls.push(call);
    if (results.length === 0) throw new Error('unexpected command');
    return results.shift();
  };
  return { calls, runCommand };
}

const input = () => ({
  projectRoot: '/tmp/project',
  version: '0.11.6',
  sourceCommit: commit('1'),
  rawArtifactRef: 'github-actions://CurveYield/contract-automation/runs/1/artifacts/slither/raw.txt'
});

test('successful Slither 0.11.6 run preserves raw evidence and normalized completion', async () => {
  const fake = sequence([
    { exitCode: 0, stdout: '0.11.6\n', stderr: '' },
    { exitCode: 0, stdout: '{"success":true,"results":{"detectors":[]}}\n', stderr: '' }
  ]);
  const result = await runSlitherAnalysis(input(), { runCommand: fake.runCommand });
  assert.equal(result.backend, 'slither');
  assert.equal(result.version, '0.11.6');
  assert.equal(result.status, 'completed');
  assert.equal(result.componentStatus, 'COMPLETED');
  assert.equal(result.continuationDisposition, 'COMPLETE_EVIDENCE');
  assert.equal(result.rawArtifactRef, input().rawArtifactRef);
  assert.match(result.rawOutput.stdout, /detectors/);
  assert.deepEqual(fake.calls.map((call) => [call.command, ...call.args]), [
    ['slither', '--version'],
    ['slither', '.', '--json', '-']
  ]);
});

test('Slither tool start failure is typed separately from integrity failure', async () => {
  const fake = sequence([{ exitCode: -1, stdout: '', stderr: 'ENOENT' }]);
  const result = await runSlitherAnalysis(input(), { runCommand: fake.runCommand });
  assert.equal(result.status, 'failed');
  assert.equal(result.failureKind, 'TOOL_FAILURE');
  assert.equal(result.componentStatus, 'FAILED');
  assert.equal(result.continuationDisposition, 'CONTINUE_WITH_LIMITATION');
  assert.match(result.rawOutput.stderr, /ENOENT/);
});

test('terminal nonzero Slither analysis is a neutral component failure with allowed continuation', async () => {
  const fake = sequence([
    { exitCode: 0, stdout: 'slither 0.11.6\n', stderr: '' },
    { exitCode: 2, stdout: '{"success":false,"results":{"detectors":[{"check":"reentrancy"}]}}', stderr: 'detectors reported' }
  ]);
  const result = await runSlitherAnalysis(input(), { runCommand: fake.runCommand });
  assert.equal(result.status, 'completed_with_failures');
  assert.equal(result.failureKind, 'ANALYSIS_COMPONENT_FAILURE');
  assert.equal(result.componentStatus, 'COMPLETED_WITH_FAILURES');
  assert.equal(result.continuationDisposition, 'CONTINUE_WITH_LIMITATION');
  assert.equal(result.rawOutput.exitCode, 2);
});

test('wrong Slither version is rejected as toolchain integrity failure', async () => {
  const fake = sequence([{ exitCode: 0, stdout: '0.11.5\n', stderr: '' }]);
  await assert.rejects(
    runSlitherAnalysis(input(), { runCommand: fake.runCommand }),
    (error) => error instanceof V7ExecutionError && error.kind === 'TOOLCHAIN_INTEGRITY_FAILURE'
  );
});
