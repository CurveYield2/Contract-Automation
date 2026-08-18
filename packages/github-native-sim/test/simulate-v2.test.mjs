import test from 'node:test';
import assert from 'node:assert/strict';
import { runGitHubNativeJob } from '../src/run-job-file.mjs';

const commit = (c) => c.repeat(40);
const sha = (c) => c.repeat(64);

function request(overrides = {}) {
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
    campaignId: 'campaign-1',
    assignmentId: 'reviewer-2-phase-6-v1',
    phaseId: 'build-and-test',
    gateId: 'exact-build-and-tests-complete',
    profileId: 'github-native-simulate-v2',
    source: {
      repository: 'CurveYield2/Audits',
      commit: commit('1'),
      projectPath: 'audit-targets/example'
    },
    configuration: {
      compilers: [{ language: 'solidity', version: '0.8.28' }],
      timeoutMinutes: 20,
      analysis: {
        slither: { version: '0.11.6' },
        medusa: { version: '1.5.1' },
        nativeFuzz: { enabled: true, command: 'forge', args: ['test', '--fuzz-runs', '256'], recoverableExitCodes: [2] }
      }
    },
    requestId: `dar-${'2'.repeat(32)}`,
    requestDigest: sha('3'),
    ...overrides,
  };
}

function checkout(calls) {
  return async (source) => {
    calls.push('checkout');
    return {
      checkoutRoot: '/tmp/v7-simulate/checkout',
      projectRoot: '/tmp/v7-simulate/checkout/audit-targets/example',
      commit: source.commit
    };
  };
}

function build(calls, artifacts = []) {
  return async () => {
    calls.push('build');
    return { status: 'completed', system: 'hardhat-native', compilerVersion: '0.8.28', artifacts };
  };
}

function slither(calls) {
  return async () => {
    calls.push('slither');
    return {
      backend: 'slither', version: '0.11.6', status: 'completed', terminal: true,
      componentStatus: 'COMPLETED', continuationDisposition: 'COMPLETE_EVIDENCE', authoritativeFinding: false
    };
  };
}

test('simulate-v2 preserves build -> Slither -> terminal Medusa -> native-fuzz ordering', async () => {
  const calls = [];
  const result = await runGitHubNativeJob(request(), {
    workspaceRoot: '/tmp/v7-simulate',
    checkoutSource: checkout(calls),
    buildProject: build(calls),
    runSlither: slither(calls),
    runMedusa: async () => {
      calls.push('medusa');
      return {
        backend: 'medusa', version: '1.5.1', status: 'completed_with_failures', terminal: true,
        failureKind: 'PROPERTY_FALSIFICATION', componentStatus: 'COMPLETED_WITH_FAILURES',
        continuationDisposition: 'CONTINUE_WITH_LIMITATION', campaign: { falsifiedProperties: 1 }
      };
    },
    runNativeFuzz: async () => {
      calls.push('native-fuzz');
      return {
        backend: 'native-fuzz', status: 'completed', terminal: true,
        componentStatus: 'COMPLETED', continuationDisposition: 'COMPLETE_EVIDENCE'
      };
    }
  });
  assert.deepEqual(calls, ['checkout', 'build', 'slither', 'medusa', 'native-fuzz']);
  assert.equal(result.profileId, 'github-native-simulate-v2');
  assert.equal(result.status, 'completed');
  assert.equal(result.analysis.medusa.failureKind, 'PROPERTY_FALSIFICATION');
  assert.equal(result.analysis.nativeFuzz.status, 'completed');
  assert.equal(result.analysisComponentFailureCount, 1);
  assert.equal(result.continuityDisposition, 'CONTINUE_WITH_LIMITATION');
  assert.equal(result.deploymentGasEvidence, null);
});

test('simulate-v2 allows native fuzz after terminal Medusa tool failure and preserves both component outcomes', async () => {
  const calls = [];
  const result = await runGitHubNativeJob(request(), {
    workspaceRoot: '/tmp/v7-simulate',
    checkoutSource: checkout(calls),
    buildProject: build(calls),
    runSlither: slither(calls),
    runMedusa: async () => {
      calls.push('medusa');
      return {
        backend: 'medusa', version: '1.5.1', status: 'failed', terminal: true,
        failureKind: 'TOOL_FAILURE', componentStatus: 'FAILED', continuationDisposition: 'CONTINUE_WITH_LIMITATION'
      };
    },
    runNativeFuzz: async () => {
      calls.push('native-fuzz');
      return {
        backend: 'native-fuzz', status: 'completed_with_limitations', terminal: true,
        failureKind: 'RECOVERABLE_LIMITATION', componentStatus: 'COMPLETED_WITH_FAILURES',
        continuationDisposition: 'CONTINUE_WITH_LIMITATION'
      };
    }
  });
  assert.deepEqual(calls, ['checkout', 'build', 'slither', 'medusa', 'native-fuzz']);
  assert.equal(result.status, 'completed');
  assert.equal(result.analysisComponentFailureCount, 2);
  assert.equal(result.analysis.medusa.failureKind, 'TOOL_FAILURE');
  assert.equal(result.analysis.nativeFuzz.failureKind, 'RECOVERABLE_LIMITATION');
});

test('simulate-v2 refuses native fuzz when Medusa has not reached terminal evidence', async () => {
  const calls = [];
  const result = await runGitHubNativeJob(request(), {
    workspaceRoot: '/tmp/v7-simulate',
    checkoutSource: checkout(calls),
    buildProject: build(calls),
    runSlither: slither(calls),
    runMedusa: async () => {
      calls.push('medusa');
      return { backend: 'medusa', version: '1.5.1', status: 'running', terminal: false };
    },
    runNativeFuzz: async () => {
      calls.push('native-fuzz');
      throw new Error('native fuzz must not start');
    }
  });
  assert.deepEqual(calls, ['checkout', 'build', 'slither', 'medusa']);
  assert.equal(result.status, 'failed');
  assert.match(result.error.message, /terminal Medusa evidence/);
  assert.equal(result.analysis.nativeFuzz, undefined);
});

test('Phase 7 attaches deployment gas evidence from the same accepted build artifacts', async () => {
  const calls = [];
  const phase7 = request({
    assignmentId: 'reviewer-2-phase-7-v1',
    phaseId: 'fork-simulation-lifecycle',
    gateId: 'fork-simulation-lifecycle-complete',
    configuration: {
      compilers: [{ language: 'solidity', version: '0.8.28' }],
      optimizer: { enabled: true, runs: 200 },
      evmVersion: 'cancun',
      viaIR: false,
      timeoutMinutes: 20,
      deploymentGas: { deployableContracts: [{ sourceName: 'contracts/Vault.sol', contractName: 'Vault' }] },
      analysis: { slither: false, medusa: false, nativeFuzz: { enabled: false } }
    }
  });
  const artifacts = [{ sourceName: 'contracts/Vault.sol', contractName: 'Vault', bytecode: '0x6000', gasEstimates: { creation: { totalCost: '222222', codeDepositCost: '200000', executionCost: '22222' } } }];
  const result = await runGitHubNativeJob(phase7, {
    workspaceRoot: '/tmp/v7-phase7-gas',
    checkoutSource: checkout(calls),
    buildProject: build(calls, artifacts),
  });
  assert.deepEqual(calls, ['checkout', 'build']);
  assert.equal(result.status, 'completed');
  assert.equal(result.deploymentGasEvidence.rows.length, 1);
  assert.equal(result.deploymentGasEvidence.rows[0].deploymentGasEstimate, '222222');
  assert.equal(result.deploymentGasEvidence.sourceCommit, commit('1'));
});

test('Phase 7 fails truthfully when frozen deployable contract inventory is absent', async () => {
  const calls = [];
  const phase7 = request({ assignmentId: 'reviewer-2-phase-7-v1', phaseId: 'fork-simulation-lifecycle', gateId: 'fork-simulation-lifecycle-complete' });
  const result = await runGitHubNativeJob(phase7, {
    workspaceRoot: '/tmp/v7-phase7-gas-missing',
    checkoutSource: checkout(calls),
    buildProject: build(calls),
  });
  assert.equal(result.status, 'failed');
  assert.match(result.error.message, /deployableContracts/);
});
