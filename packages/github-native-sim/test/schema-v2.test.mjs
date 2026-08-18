import test from 'node:test';
import assert from 'node:assert/strict';
import {
  V2_AUTOMATION_RELEASE,
  V2_RUNNER_RELEASE,
  validateDeepAssuranceRequestV2
} from '../src/schema.mjs';

const baseRequest = () => ({
  schemaVersion: 'deep-assurance-github-request-v2',
  processId: 'deep-assurance-v6',
  contractAutomationRelease: {
    repository: 'CurveYield/contract-automation',
    branch: 'orchestrator/round4-ci-base-v1',
    commit: 'ad11d7d5a623c1411cbabb4bb0cd9acf7975bce8',
    contractVersion: 'contract-automation-finalized-v1'
  },
  runnerRelease: {
    version: 'deep-assurance-github-bridge-v1',
    manifestSha256: 'd32cfca35524606a5c85e98fb3dec1bba58bff8a4bc73466ccef496ceab79734'
  },
  campaignId: 'campaign-1',
  assignmentId: 'assignment-1',
  phaseId: 'phase-6',
  gateId: 'build-test-adversarial',
  profileId: 'github-native-simulate-v2',
  source: {
    repository: 'CurveYield/Audits',
    commit: '1'.repeat(40),
    projectPath: 'audit-targets/example'
  },
  configuration: {
    compilers: [{ language: 'solidity', version: '0.8.28' }],
    timeoutMinutes: 20,
    analysis: { medusa: { version: '1.5.1' }, nativeFuzz: { enabled: true } }
  },
  requestId: `dar-${'2'.repeat(32)}`,
  requestDigest: '3'.repeat(64)
});

test('pins the recovered V7 automation and runner identities', () => {
  assert.deepEqual(V2_AUTOMATION_RELEASE, {
    repository: 'CurveYield/contract-automation',
    branch: 'orchestrator/round4-ci-base-v1',
    commit: 'ad11d7d5a623c1411cbabb4bb0cd9acf7975bce8',
    contractVersion: 'contract-automation-finalized-v1'
  });
  assert.deepEqual(V2_RUNNER_RELEASE, {
    version: 'deep-assurance-github-bridge-v1',
    manifestSha256: 'd32cfca35524606a5c85e98fb3dec1bba58bff8a4bc73466ccef496ceab79734'
  });
});

test('accepts the exact recovered v2 simulation request envelope', () => {
  const request = baseRequest();
  assert.deepEqual(validateDeepAssuranceRequestV2(request), request);
});

test('accepts github-native-compile-v2 and github-native-simulate-v2 only', () => {
  for (const profileId of ['github-native-compile-v2', 'github-native-simulate-v2']) {
    assert.equal(validateDeepAssuranceRequestV2({ ...baseRequest(), profileId }).profileId, profileId);
  }
  assert.throws(() => validateDeepAssuranceRequestV2({ ...baseRequest(), profileId: 'github-native-simulate-v1' }), /profileId/);
});

test('rejects drift in pinned automation or runner identity', () => {
  const request = baseRequest();
  assert.throws(() => validateDeepAssuranceRequestV2({
    ...request,
    contractAutomationRelease: { ...request.contractAutomationRelease, commit: '9'.repeat(40) }
  }), /contractAutomationRelease\.commit/);
  assert.throws(() => validateDeepAssuranceRequestV2({
    ...request,
    runnerRelease: { ...request.runnerRelease, manifestSha256: '8'.repeat(64) }
  }), /runnerRelease\.manifestSha256/);
});

test('rejects malformed exact source, request id, digest, and unsafe project paths', () => {
  const request = baseRequest();
  assert.throws(() => validateDeepAssuranceRequestV2({ ...request, source: { ...request.source, commit: 'abc' } }), /source\.commit/);
  assert.throws(() => validateDeepAssuranceRequestV2({ ...request, source: { ...request.source, projectPath: '../escape' } }), /source\.projectPath/);
  assert.throws(() => validateDeepAssuranceRequestV2({ ...request, requestId: 'bad' }), /requestId/);
  assert.throws(() => validateDeepAssuranceRequestV2({ ...request, requestDigest: 'bad' }), /requestDigest/);
});

test('rejects unknown top-level fields and invalid timeout bounds', () => {
  const request = baseRequest();
  assert.throws(() => validateDeepAssuranceRequestV2({ ...request, surprise: true }), /surprise/);
  assert.throws(() => validateDeepAssuranceRequestV2({
    ...request,
    configuration: { ...request.configuration, timeoutMinutes: 0 }
  }), /timeoutMinutes/);
});
