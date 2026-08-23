import test from 'node:test';
import assert from 'node:assert/strict';
import { validateDeepAssuranceRequestV2 } from '../src/schema-v3.mjs';

function request(harness) {
  return {
    schemaVersion: 'deep-assurance-github-request-v2',
    processId: 'audit-v7-independent-review',
    contractAutomationRelease: {
      repository: 'CurveYield2/Contract-Automation',
      branch: 'recovery/v7-execution-layer-v1',
      commit: '612fa50264e587e3f24550bf4dae35719b04211c',
      contractVersion: 'contract-automation-v7-relocated-v1'
    },
    runnerRelease: {
      version: 'deep-assurance-github-bridge-v1',
      manifestSha256: '2bebd99bb8ae770eb2feca0de7dc7e54596127a0c768922189e907e6658773dc'
    },
    campaignId: 'cyvlSDT v30',
    assignmentId: 'reviewer-2-phase6-generated-harness-v1',
    phaseId: 'build-and-test',
    gateId: 'phase6-generated-harness-v1',
    profileId: 'github-native-simulate-v2',
    source: {
      repository: 'CurveYield2/Solo-Audit-Controller',
      commit: '1'.repeat(40),
      projectPath: 'CurveYield-cyvlSDT-Deployment-Package-v30'
    },
    configuration: {
      compilers: [{ language: 'solidity', version: '0.8.28' }],
      analysis: { medusa: { version: '1.5.1' }, nativeFuzz: { enabled: true, fuzzRuns: 1000, recoverableExitCodes: [] } },
      harness
    },
    requestId: `dar-${'2'.repeat(32)}`,
    requestDigest: '3'.repeat(64)
  };
}

const validHarness = {
  mode: 'auditor-generated',
  path: 'github-native-sim/requests/dar-22222222222222222222222222222222/audit-harness',
  treeSha256: '4'.repeat(64),
  components: ['medusa', 'nativeFuzz'],
  productionSourceMutation: false
};

test('V2 request accepts a cryptographically bound auditor-generated Phase 6 harness', () => {
  const validated = validateDeepAssuranceRequestV2(request(validHarness));
  assert.deepEqual(validated.configuration.harness, validHarness);
});

test('V2 request rejects unsafe or mutable auditor harness bindings', () => {
  assert.throws(() => validateDeepAssuranceRequestV2(request({ ...validHarness, path: '../audit-harness' })), /safe repository-relative path/);
  assert.throws(() => validateDeepAssuranceRequestV2(request({ ...validHarness, treeSha256: 'abc' })), /64/);
  assert.throws(() => validateDeepAssuranceRequestV2(request({ ...validHarness, components: ['medusa', 'shell'] })), /components/);
  assert.throws(() => validateDeepAssuranceRequestV2(request({ ...validHarness, productionSourceMutation: true })), /must equal false/);
  assert.throws(() => validateDeepAssuranceRequestV2(request({ ...validHarness, extra: true })), /not allowed/);
});
