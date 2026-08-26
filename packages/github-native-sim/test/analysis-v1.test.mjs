import test from 'node:test';
import assert from 'node:assert/strict';
import { V7ExecutionError } from '../src/execution.mjs';
import {
  parseMedusaOutput,
  runMedusaAnalysis,
  runSlitherAnalysis
} from '../src/analysis.mjs';

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

const medusaInput = () => ({
  projectRoot: '/tmp/project',
  version: '1.5.1',
  sourceCommit: commit('1'),
  rawArtifactRef: 'github-actions://CurveYield/contract-automation/runs/1/artifacts/medusa/raw.json',
  rpcUrl: 'http://127.0.0.1:18545',
  rpcBlock: 25817400,
  rpcBlockHash: `0x${'2'.repeat(64)}`,
  rpcProfile: 'SIM_ARCHIVE_PRIMARY_ETHEREUM_01'
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

test('Slither exit 255 with success:true JSON is completed neutral evidence, not a component failure', async () => {
  const fake = sequence([
    { exitCode: 0, stdout: 'slither 0.11.6\n', stderr: '' },
    {
      exitCode: 255,
      stdout: JSON.stringify({ success: true, results: { detectors: [{ check: 'reentrancy-eth' }, { check: 'unused-return' }] } }),
      stderr: '2 detector observations'
    }
  ]);
  const result = await runSlitherAnalysis(input(), { runCommand: fake.runCommand });
  assert.equal(result.status, 'completed_with_findings');
  assert.equal(result.componentStatus, 'COMPLETED');
  assert.equal(result.continuationDisposition, 'COMPLETE_EVIDENCE');
  assert.equal(result.authoritativeFinding, false);
  assert.equal(result.findingCount, 2);
  assert.equal(result.rawOutput.exitCode, 255);
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

test('terminal nonzero Slither analysis with success:false is a neutral component failure with allowed continuation', async () => {
  const fake = sequence([
    { exitCode: 0, stdout: 'slither 0.11.6\n', stderr: '' },
    { exitCode: 2, stdout: '{"success":false,"results":{"detectors":[{"check":"reentrancy"}]}}', stderr: 'analysis failed' }
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

test('successful Medusa 1.5.1 run emits terminal machine-readable campaign evidence', async () => {
  const fake = sequence([
    { exitCode: 0, stdout: 'medusa version 1.5.1\n', stderr: '' },
    {
      exitCode: 0,
      stdout: JSON.stringify({
        status: 'completed',
        properties: [{ name: 'invariant_total_assets', status: 'passed' }],
        corpus: { sequences: 127 },
        coverage: { percent: 91.2 },
        statistics: { testCases: 18000, callSequences: 4200 }
      }),
      stderr: ''
    }
  ]);
  const result = await runMedusaAnalysis(medusaInput(), { runCommand: fake.runCommand });
  assert.equal(result.backend, 'medusa');
  assert.equal(result.version, '1.5.1');
  assert.equal(result.terminal, true);
  assert.equal(result.status, 'completed');
  assert.equal(result.componentStatus, 'COMPLETED');
  assert.equal(result.continuationDisposition, 'COMPLETE_EVIDENCE');
  assert.equal(result.campaign.properties[0].status, 'passed');
  assert.equal(result.campaign.corpus.sequences, 127);
  assert.equal(result.campaign.coverage.percent, 91.2);
  assert.equal(result.campaign.statistics.testCases, 18000);
  assert.equal(result.rawArtifactRef, medusaInput().rawArtifactRef);
  assert.deepEqual(fake.calls[1].args.slice(0, 5), ['fuzz', '--rpc-url', medusaInput().rpcUrl, '--rpc-block', String(medusaInput().rpcBlock)]);
  assert.equal(result.fork.rpcProfile, 'SIM_ARCHIVE_PRIMARY_ETHEREUM_01');
  assert.equal(result.fork.rpcUrlExposed, false);
});

test('Medusa falsification preserves counterexample and shrinking evidence as a terminal component failure', async () => {
  const fake = sequence([
    { exitCode: 0, stdout: '1.5.1\n', stderr: '' },
    {
      exitCode: 1,
      stdout: JSON.stringify({
        status: 'falsified',
        properties: [{
          name: 'invariant_no_loss',
          status: 'failed',
          counterexample: [{ function: 'deposit', args: ['100'] }, { function: 'withdraw', args: ['100'] }],
          shrinking: { originalLength: 17, minimizedLength: 2, completed: true }
        }],
        corpus: { sequences: 82 },
        coverage: { percent: 87.5 },
        statistics: { testCases: 9120, callSequences: 2331 }
      }),
      stderr: 'property falsified'
    }
  ]);
  const result = await runMedusaAnalysis(medusaInput(), { runCommand: fake.runCommand });
  assert.equal(result.terminal, true);
  assert.equal(result.status, 'completed_with_failures');
  assert.equal(result.failureKind, 'PROPERTY_FALSIFICATION');
  assert.equal(result.componentStatus, 'COMPLETED_WITH_FAILURES');
  assert.equal(result.continuationDisposition, 'CONTINUE_WITH_LIMITATION');
  assert.equal(result.campaign.falsifiedProperties, 1);
  assert.equal(result.campaign.properties[0].counterexample.length, 2);
  assert.equal(result.campaign.properties[0].shrinking.minimizedLength, 2);
});

test('Medusa execution failure is typed and terminal without becoming an integrity failure', async () => {
  const fake = sequence([
    { exitCode: 0, stdout: '1.5.1\n', stderr: '' },
    { exitCode: -1, stdout: '', stderr: 'medusa process could not start' }
  ]);
  const result = await runMedusaAnalysis(medusaInput(), { runCommand: fake.runCommand });
  assert.equal(result.terminal, true);
  assert.equal(result.status, 'failed');
  assert.equal(result.failureKind, 'TOOL_FAILURE');
  assert.equal(result.componentStatus, 'FAILED');
  assert.equal(result.continuationDisposition, 'CONTINUE_WITH_LIMITATION');
  assert.match(result.rawOutput.stderr, /could not start/);
});

test('recovered Medusa fixture parser retains properties, corpus, coverage, statistics and shrinking details', () => {
  const recoveredFixture = JSON.stringify({
    status: 'falsified',
    properties: [
      { name: 'prop_a', status: 'passed' },
      {
        name: 'prop_b',
        status: 'failed',
        counterexample: [{ function: 'claim', args: [] }],
        shrinking: { originalLength: 9, minimizedLength: 1, completed: true }
      }
    ],
    corpus: { sequences: 31, uniqueSequences: 21 },
    coverage: { percent: 76.4, coveredInstructions: 401, totalInstructions: 525 },
    statistics: { testCases: 7000, callSequences: 1300, durationSeconds: 60 }
  });
  const parsed = parseMedusaOutput(recoveredFixture);
  assert.equal(parsed.status, 'falsified');
  assert.equal(parsed.falsifiedProperties, 1);
  assert.equal(parsed.properties[1].shrinking.completed, true);
  assert.equal(parsed.corpus.uniqueSequences, 21);
  assert.equal(parsed.coverage.coveredInstructions, 401);
  assert.equal(parsed.statistics.durationSeconds, 60);
});

test('wrong Medusa version is rejected as toolchain integrity failure', async () => {
  const fake = sequence([{ exitCode: 0, stdout: 'medusa 1.5.0\n', stderr: '' }]);
  await assert.rejects(
    runMedusaAnalysis(medusaInput(), { runCommand: fake.runCommand }),
    (error) => error instanceof V7ExecutionError && error.kind === 'TOOLCHAIN_INTEGRITY_FAILURE'
  );
});

test('real Medusa terminal text with exit 0 is accepted as completed evidence without requiring JSON stdout', async () => {
  const fake = sequence([
    { exitCode: 0, stdout: 'medusa version 1.5.1\n', stderr: '' },
    {
      exitCode: 0,
      stdout: 'INFO Fuzzing campaign completed\nProperty tests: all passed\n',
      stderr: ''
    }
  ]);
  const result = await runMedusaAnalysis(medusaInput(), { runCommand: fake.runCommand });
  assert.equal(result.status, 'completed');
  assert.equal(result.componentStatus, 'COMPLETED');
  assert.equal(result.continuationDisposition, 'COMPLETE_EVIDENCE');
  assert.equal(result.campaign.outputFormat, 'terminal-text');
  assert.equal(result.campaign.falsificationDetected, false);
  assert.match(result.rawOutput.stdout, /campaign completed/);
  assert.deepEqual(fake.calls[1].args, ['fuzz', '--no-color']);
});

test('real Medusa exit code 7 is normalized as a property falsification with raw counterexample text preserved', async () => {
  const fake = sequence([
    { exitCode: 0, stdout: 'medusa 1.5.1\n', stderr: '' },
    {
      exitCode: 7,
      stdout: 'FAILED property_no_loss\nCall sequence:\ndeposit(100)\nwithdraw(100)\n',
      stderr: ''
    }
  ]);
  const result = await runMedusaAnalysis(medusaInput(), { runCommand: fake.runCommand });
  assert.equal(result.status, 'completed_with_failures');
  assert.equal(result.failureKind, 'PROPERTY_FALSIFICATION');
  assert.equal(result.componentStatus, 'COMPLETED_WITH_FAILURES');
  assert.equal(result.continuationDisposition, 'CONTINUE_WITH_LIMITATION');
  assert.equal(result.campaign.outputFormat, 'terminal-text');
  assert.equal(result.campaign.falsificationDetected, true);
  assert.equal(result.campaign.falsifiedPropertiesLowerBound, 1);
  assert.match(result.rawOutput.stdout, /Call sequence/);
});

test('real Medusa handled-error exit code 6 is a component limitation rather than a property falsification', async () => {
  const fake = sequence([
    { exitCode: 0, stdout: 'medusa 1.5.1\n', stderr: '' },
    {
      exitCode: 6,
      stdout: 'Unable to find tests\n',
      stderr: 'fuzzing campaign stopped'
    }
  ]);
  const result = await runMedusaAnalysis(medusaInput(), { runCommand: fake.runCommand });
  assert.equal(result.status, 'completed_with_failures');
  assert.equal(result.failureKind, 'ANALYSIS_COMPONENT_FAILURE');
  assert.equal(result.componentStatus, 'COMPLETED_WITH_FAILURES');
  assert.equal(result.continuationDisposition, 'CONTINUE_WITH_LIMITATION');
  assert.equal(result.campaign.outputFormat, 'terminal-text');
  assert.equal(result.campaign.falsificationDetected, false);
  assert.equal(result.rawOutput.exitCode, 6);
});
