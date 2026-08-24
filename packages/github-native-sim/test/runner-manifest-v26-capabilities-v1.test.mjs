import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRunnerManifestV2 } from '../src/runner-manifest-v2.mjs';

const expected = Object.freeze({
  'v26-result-components-v1': 'audit-v7-github-execution-evidence-v2',
  'v26-build-sbom-v1': 'audit-v7-build-sbom-v1',
  'v26-phase6-campaign-evidence-v1': 'audit-v7-phase6-campaign-evidence-v1',
  'v26-foundry-coverage-v1': 'audit-v7-foundry-coverage-v1',
  'v26-simulation-ledger-v1': 'audit-v7-simulation-lifecycle-ledger-v1',
  'v26-live-attestation-v1': 'audit-v7-live-deployment-attestation-v1',
  'v26-reproduction-v1': 'audit-v7-candidate-reproduction-v1',
});

test('runner manifest advertises only v26 components exercised by repository qualification tests', () => {
  const manifest = buildRunnerManifestV2();
  assert.deepEqual(manifest.qualifiedCapabilities?.components, expected);
  assert.deepEqual(manifest.qualifiedCapabilities?.recipes, ['repeated-lifecycle-v1']);
  assert.equal(manifest.qualifiedCapabilities?.requestExtension, 'configuration.v26-v1');
  assert.equal(manifest.qualifiedCapabilities?.qualificationWorkflow, '.github/workflows/v7-execution-infrastructure-qualification.yml');
});
