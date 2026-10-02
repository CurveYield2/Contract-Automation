import test from 'node:test';
import assert from 'node:assert/strict';
import { validateDeepAssuranceResultV1 } from '../src/result.mjs';

const sha = (c) => c.repeat(64);
const commit = (c) => c.repeat(40);
const baseResult = () => ({
  schemaVersion: 'deep-assurance-contract-automation-result-v1',
  requestId: `dar-${'1'.repeat(32)}`,
  requestDigest: sha('2'),
  source: {
    repository: 'CurveYield/contract-automation',
    commit: commit('3'),
    projectPath: 'audit-targets/example'
  },
  profileId: 'github-native-simulate-v2',
  runnerManifestSha256: sha('4'),
  status: 'PASSED',
  failedStepCount: 0,
  failedSteps: [],
  componentFailureCount: 0,
  analysisComponentFailureCount: 0,
  toolchainComponentFailureCount: 0,
  continuityDisposition: 'COMPLETE_EVIDENCE',
  artifactRefs: [{
    name: 'deep-assurance-artifact-manifest-v1',
    ref: 'github-actions://CurveYield/contract-automation/runs/1/artifacts/a/deep-assurance-artifact-manifest-v1.json',
    sha256: sha('5')
  }],
  artifactManifestSha256: sha('5'),
  outputSha256: sha('6'),
  evidenceRefs: [{
    class: 'exact-source-execution-result',
    ref: 'github-actions://CurveYield/contract-automation/runs/1/artifacts/a/result.json',
    sha256: sha('6'),
    sourceCommit: commit('3')
  }],
  controllerEvidence: {
    class: 'deep-assurance-execution-result',
    ref: 'github-actions://CurveYield/contract-automation/runs/1/artifacts/a/result.json',
    sha256: sha('6'),
    sourceCommit: commit('3'),
    profileId: 'github-native-simulate-v2',
    requestId: `dar-${'1'.repeat(32)}`,
    requestDigest: sha('2'),
    runnerManifestSha256: sha('4'),
    artifactManifestRef: 'github-actions://CurveYield/contract-automation/runs/1/artifacts/a/deep-assurance-artifact-manifest-v1.json',
    artifactManifestSha256: sha('5'),
    outputSha256: sha('6'),
    componentStatus: 'COMPLETED',
    failedStepCount: 0,
    componentFailureCount: 0
  },
  toolVersions: { node: '22.23.2', solc: '0.8.28', medusa: '1.5.1' },
  requestedToolVersions: { compilers: { solidity: '0.8.28' }, medusa: '1.5.1' }
});

test('accepts the exact recovered V7 normalized result shape', () => {
  const result = baseResult();
  assert.deepEqual(validateDeepAssuranceResultV1(result), result);
});

test('accepts typed failed component evidence with continuation limitation', () => {
  const result = baseResult();
  result.status = 'FAILED';
  result.componentFailureCount = 1;
  result.continuityDisposition = 'CONTINUE_WITH_LIMITATION';
  result.controllerEvidence.componentStatus = 'FAILED';
  result.controllerEvidence.componentFailureCount = 1;
  assert.deepEqual(validateDeepAssuranceResultV1(result), result);
});

test('accepts completed execution with a neutral analysis component failure', () => {
  const result = baseResult();
  result.componentFailureCount = 1;
  result.analysisComponentFailureCount = 1;
  result.controllerEvidence.componentStatus = 'COMPLETED_WITH_FAILURES';
  result.controllerEvidence.componentFailureCount = 1;
  assert.deepEqual(validateDeepAssuranceResultV1(result), result);
});

test('requires failedStepCount to equal failedSteps length', () => {
  const result = baseResult();
  result.failedStepCount = 1;
  assert.throws(() => validateDeepAssuranceResultV1(result), /failedStepCount/);
});

test('binds controller evidence to top-level request/source/profile/output identity', () => {
  const result = baseResult();
  result.controllerEvidence.requestDigest = sha('9');
  assert.throws(() => validateDeepAssuranceResultV1(result), /controllerEvidence.requestDigest/);
});

test('rejects malformed evidence hashes and source commits', () => {
  const result = baseResult();
  result.evidenceRefs[0].sourceCommit = 'bad';
  assert.throws(() => validateDeepAssuranceResultV1(result), /evidenceRefs\[0\]\.sourceCommit/);
});
