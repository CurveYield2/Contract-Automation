import test from 'node:test';
import assert from 'node:assert/strict';
import { runMedusaAnalysis } from '../src/analysis.mjs';

const medusaInput = () => ({
  projectRoot: '/tmp/project',
  version: '1.5.1',
  sourceCommit: '1'.repeat(40),
  rawArtifactRef: 'github-actions://CurveYield2/Contract-Automation/runs/1/artifacts/medusa/raw.txt',
  rpcUrl: 'http://127.0.0.1:18545',
  rpcBlock: 25817400,
  rpcBlockHash: `0x${'2'.repeat(64)}`,
  rpcProfile: 'SIM_ARCHIVE_PRIMARY_ETHEREUM_01'
});

function sequence(results) {
  const calls = [];
  return {
    calls,
    runCommand: async (call) => {
      calls.push(call);
      if (results.length === 0) throw new Error('unexpected command');
      return results.shift();
    }
  };
}

test('Medusa 1.5.1 successful unstructured CLI output is accepted as terminal campaign evidence', async () => {
  const stdout = [
    'Reading the configuration file at: /tmp/project/medusa.json',
    'Fuzzer stopped, test results follow below ...',
    '[PASSED] Property Test: CyvlSdtVaultPhase6Harness_v1.property_totalAssetsCoversSupply()',
    '[PASSED] Property Test: CyvlSdtVaultPhase6Harness_v1.property_previewRedeemBounded()',
    ''
  ].join('\n');
  const fake = sequence([
    { exitCode: 0, stdout: 'medusa version 1.5.1\n', stderr: '' },
    { exitCode: 0, stdout, stderr: '' }
  ]);

  const result = await runMedusaAnalysis(medusaInput(), { runCommand: fake.runCommand });

  assert.equal(result.terminal, true);
  assert.equal(result.status, 'completed');
  assert.equal(result.componentStatus, 'COMPLETED');
  assert.equal(result.continuationDisposition, 'COMPLETE_EVIDENCE');
  assert.deepEqual(result.campaign.properties, [
    { name: 'CyvlSdtVaultPhase6Harness_v1.property_totalAssetsCoversSupply()', status: 'passed' },
    { name: 'CyvlSdtVaultPhase6Harness_v1.property_previewRedeemBounded()', status: 'passed' }
  ]);
  assert.equal(result.campaign.falsifiedProperties, 0);
  assert.match(result.rawOutput.stdout, /Fuzzer stopped/);
});
