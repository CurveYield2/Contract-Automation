import test from 'node:test';
import assert from 'node:assert/strict';
import { runGitHubNativeJob } from '../src/run-job-file-v3.mjs';

const targetRoot = '/tmp/frozen-target';
const auditOverlayRoot = '/tmp/auditor-harness-overlay';

function request() {
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
    assignmentId: 'reviewer-2-phase-6-auditor-harness-v1',
    phaseId: 'build-and-test',
    gateId: 'phase6-auditor-harness-executed',
    profileId: 'github-native-simulate-v2',
    source: {
      repository: 'CurveYield2/Solo-Audit-Controller',
      commit: '1'.repeat(40),
      projectPath: 'frozen-target'
    },
    configuration: {
      compilers: [{ language: 'solidity', version: '0.8.28' }],
      analysis: {
        slither: false,
        medusa: { version: '1.5.1' },
        nativeFuzz: { enabled: true, fuzzRuns: 1000, recoverableExitCodes: [] }
      }
    },
    requestId: `dar-${'2'.repeat(32)}`,
    requestDigest: '3'.repeat(64)
  };
}

test('exact build stays on frozen source while Medusa and Forge execute the auditor overlay', async () => {
  const observed = [];
  const result = await runGitHubNativeJob(request(), {
    workspaceRoot: '/tmp/auditor-harness-execution',
    analysisProjectRoot: auditOverlayRoot,
    checkoutSource: async (source) => ({ checkoutRoot: '/tmp/checkout', projectRoot: targetRoot, commit: source.commit }),
    buildProject: async ({ projectRoot }) => {
      observed.push(['build', projectRoot]);
      return { status: 'completed', system: 'exact-build', compilerVersion: '0.8.28', artifacts: [] };
    },
    runMedusa: async ({ projectRoot }) => {
      observed.push(['medusa', projectRoot]);
      return { backend: 'medusa', status: 'completed', terminal: true, componentStatus: 'COMPLETED', continuationDisposition: 'COMPLETE_EVIDENCE' };
    },
    runNativeFuzz: async ({ projectRoot }) => {
      observed.push(['native-fuzz', projectRoot]);
      return { backend: 'native-fuzz', status: 'completed', terminal: true, componentStatus: 'COMPLETED', continuationDisposition: 'COMPLETE_EVIDENCE' };
    }
  });

  assert.equal(result.status, 'completed');
  assert.deepEqual(observed, [
    ['build', targetRoot],
    ['medusa', auditOverlayRoot],
    ['native-fuzz', auditOverlayRoot]
  ]);
});
