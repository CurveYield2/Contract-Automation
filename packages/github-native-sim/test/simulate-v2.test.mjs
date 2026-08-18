import test from 'node:test';
import assert from 'node:assert/strict';
import { runGitHubNativeJob } from '../src/run-job-file.mjs';

const commit = (c) => c.repeat(40);
const sha = (c) => c.repeat(64);

function request() {
  return {
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
    gateId: 'stateful-adversarial',
    profileId: 'github-native-simulate-v2',
    source: {
      repository: 'CurveYield/Audits',
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
    requestDigest: sha('3')
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

function build(calls) {
  return async () => {
    calls.push('build');
    return { status: 'completed', system: 'hardhat-native', compilerVersion: '0.8.28', artifacts: [] };
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
