import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HISTORICAL_V7_RELEASE_PROVENANCE,
  V2_AUTOMATION_RELEASE,
  V2_RUNNER_RELEASE,
  validateDeepAssuranceRequestV2
} from '../src/schema.mjs';

const baseRequest = () => ({
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
  campaignId: 'campaign-1',
  assignmentId: 'reviewer-2-phase-6-v1',
  phaseId: 'build-and-test',
  gateId: 'exact-build-and-tests-complete',
  profileId: 'github-native-simulate-v2',
  source: {
    repository: 'CurveYield2/Audits',
    commit: '1'.repeat(40),
    projectPath: 'audit-targets/example'
  },
  configuration: {
    compilers: [{ language: 'solidity', version: '0.8.28' }],
    timeoutMinutes: 20,
    analysis: { medusa: { version: '1.5.1' }, nativeFuzz: { enabled: true, fuzzRuns: 256 } }
  },
  requestId: `dar-${'2'.repeat(32)}`,
  requestDigest: '3'.repeat(64)
});

function phase7Request() {
  const request = baseRequest();
  return {
    ...request,
    assignmentId: 'reviewer-2-phase-7-v1',
    phaseId: 'fork-simulation-lifecycle',
    gateId: 'fork-simulation-lifecycle-complete',
    configuration: {
      ...request.configuration,
      deploymentGas: {
        deployableContracts: [{ sourceName: 'contracts/Vault.sol', contractName: 'Vault' }]
      },
      simulation: {
        chain: 'ethereum',
        block: 25666794,
        workflow: {
          steps: [
            { action: 'deploy', alias: 'vault', contract: 'Vault' },
            { action: 'snapshot', alias: 'before' },
            { action: 'mine', blocks: 2 },
            { action: 'revertSnapshot', snapshot: '$before' }
          ]
        }
      }
    }
  };
}

test('pins the active CurveYield2 V7 automation and runner identities', () => {
  assert.deepEqual(V2_AUTOMATION_RELEASE, {
    repository: 'CurveYield2/Contract-Automation',
    branch: 'recovery/v7-execution-layer-v1',
    commit: '612fa50264e587e3f24550bf4dae35719b04211c',
    contractVersion: 'contract-automation-v7-relocated-v1'
  });
  assert.deepEqual(V2_RUNNER_RELEASE, {
    version: 'deep-assurance-github-bridge-v1',
    manifestSha256: '2bebd99bb8ae770eb2feca0de7dc7e54596127a0c768922189e907e6658773dc'
  });
});

test('retains deleted CurveYield release only as historical provenance', () => {
  assert.equal(HISTORICAL_V7_RELEASE_PROVENANCE.status, 'HISTORICAL_DELETED_ORGANIZATION_PROVENANCE_ONLY');
  assert.equal(HISTORICAL_V7_RELEASE_PROVENANCE.repository, 'CurveYield/contract-automation');
  const request = baseRequest();
  assert.throws(() => validateDeepAssuranceRequestV2({
    ...request,
    contractAutomationRelease: {
      repository: HISTORICAL_V7_RELEASE_PROVENANCE.repository,
      branch: 'orchestrator/round4-ci-base-v1',
      commit: HISTORICAL_V7_RELEASE_PROVENANCE.requestBaseCommit,
      contractVersion: 'contract-automation-finalized-v1'
    }
  }), /contractAutomationRelease/);
});

test('accepts the exact relocated v2 simulation request envelope', () => {
  const request = baseRequest();
  assert.deepEqual(validateDeepAssuranceRequestV2(request), request);
});

test('accepts a structured Phase-7 Ethereum pinned-fork lifecycle request', () => {
  const request = phase7Request();
  assert.deepEqual(validateDeepAssuranceRequestV2(request), request);
});

test('Phase 7 rejects latest/unpinned fork state and unsupported chains', () => {
  const request = phase7Request();
  assert.throws(() => validateDeepAssuranceRequestV2({
    ...request,
    configuration: { ...request.configuration, simulation: { ...request.configuration.simulation, block: 'latest' } }
  }), /simulation\.block/);
  assert.throws(() => validateDeepAssuranceRequestV2({
    ...request,
    configuration: { ...request.configuration, simulation: { ...request.configuration.simulation, chain: 'polygon' } }
  }), /simulation\.chain/);
});

test('Phase 7 rejects arbitrary workflow actions and forbidden command fields', () => {
  const request = phase7Request();
  assert.throws(() => validateDeepAssuranceRequestV2({
    ...request,
    configuration: {
      ...request.configuration,
      simulation: { chain: 'ethereum', block: 25666794, workflow: { steps: [{ action: 'shell', command: 'curl attacker' }] } }
    }
  }), /forbidden|Unsupported action|unsupported_action|command/);
  assert.throws(() => validateDeepAssuranceRequestV2({
    ...baseRequest(),
    configuration: {
      ...baseRequest().configuration,
      analysis: { nativeFuzz: { enabled: true, command: 'bash', args: ['-c', 'anything'] } }
    }
  }), /command|args|nativeFuzz/);
});

test('Phase 7 requires frozen deployment-gas inventory and pinned simulation configuration', () => {
  const request = phase7Request();
  const { deploymentGas: _gas, ...withoutGas } = request.configuration;
  assert.throws(() => validateDeepAssuranceRequestV2({ ...request, configuration: withoutGas }), /deploymentGas/);
  const { simulation: _simulation, ...withoutSimulation } = request.configuration;
  assert.throws(() => validateDeepAssuranceRequestV2({ ...request, configuration: withoutSimulation }), /simulation/);
});

test('accepts github-native-compile-v2 and github-native-simulate-v2 only', () => {
  for (const profileId of ['github-native-compile-v2', 'github-native-simulate-v2']) {
    assert.equal(validateDeepAssuranceRequestV2({ ...baseRequest(), profileId }).profileId, profileId);
  }
  assert.throws(() => validateDeepAssuranceRequestV2({ ...baseRequest(), profileId: 'github-native-simulate-v1' }), /profileId/);
});

test('rejects process and pinned release drift', () => {
  const request = baseRequest();
  assert.throws(() => validateDeepAssuranceRequestV2({ ...request, processId: 'deep-assurance-v6' }), /processId/);
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

test('rejects unknown top-level/configuration fields and invalid timeout bounds', () => {
  const request = baseRequest();
  assert.throws(() => validateDeepAssuranceRequestV2({ ...request, surprise: true }), /surprise/);
  assert.throws(() => validateDeepAssuranceRequestV2({
    ...request,
    configuration: { ...request.configuration, timeoutMinutes: 0 }
  }), /timeoutMinutes/);
  assert.throws(() => validateDeepAssuranceRequestV2({
    ...request,
    configuration: { ...request.configuration, arbitraryExecution: { shell: 'bash' } }
  }), /arbitraryExecution/);
});

test('Phase 6 accepts an exact paired Medusa frozen block identity and rejects partial or malformed pins', () => {
  const request = baseRequest();
  const pinned = {
    ...request,
    configuration: {
      ...request.configuration,
      analysis: {
        ...request.configuration.analysis,
        medusa: {
          version: '1.5.1',
          frozenBlockNumber: 25827826,
          frozenBlockHash: '0x1c2d63e86243eaa4779f90e84263a47685c6ecc907421bd14ef00b46ce9bf4d7'
        }
      }
    }
  };
  assert.deepEqual(validateDeepAssuranceRequestV2(pinned), pinned);
  const partial = structuredClone(pinned);
  delete partial.configuration.analysis.medusa.frozenBlockHash;
  assert.throws(() => validateDeepAssuranceRequestV2(partial), /provided together/);
  const malformed = structuredClone(pinned);
  malformed.configuration.analysis.medusa.frozenBlockHash = '0x1234';
  assert.throws(() => validateDeepAssuranceRequestV2(malformed), /frozenBlockHash/);
});
