import test from 'node:test';
import assert from 'node:assert/strict';
import { runGitHubNativeJob } from '../src/run-job-file.mjs';

function request() {
  return {
    schemaVersion: 'deep-assurance-github-request-v2', processId: 'audit-v7-independent-review',
    contractAutomationRelease: { repository: 'CurveYield2/Contract-Automation', branch: 'recovery/v7-execution-layer-v1', commit: '612fa50264e587e3f24550bf4dae35719b04211c', contractVersion: 'contract-automation-v7-relocated-v1' },
    runnerRelease: { version: 'deep-assurance-github-bridge-v1', manifestSha256: '2bebd99bb8ae770eb2feca0de7dc7e54596127a0c768922189e907e6658773dc' },
    campaignId: 'compile-boundary-v1', assignmentId: 'reviewer-2-phase6-compile-boundary-v1', phaseId: 'build-and-test', gateId: 'exact-build-and-tests-complete', profileId: 'github-native-compile-v2',
    source: { repository: 'CurveYield2/Audits', commit: '1'.repeat(40), projectPath: 'audit-targets/example' },
    configuration: { compilers: [{ language: 'solidity', version: '0.8.28' }], timeoutMinutes: 20, analysis: { slither: { version: '0.11.6' } } },
    requestId: `dar-${'2'.repeat(32)}`, requestDigest: '3'.repeat(64),
  };
}

const completedSlither = { backend: 'slither', status: 'completed', terminal: true, componentStatus: 'COMPLETED', continuationDisposition: 'COMPLETE_EVIDENCE' };

test('compile targeted preflight executes after exact checkout and immediately before substantive build', async () => {
  const calls = [];
  const result = await runGitHubNativeJob(request(), {
    checkoutSource: async () => { calls.push('checkout'); return { checkoutRoot: '/tmp/compile-boundary', projectRoot: '/tmp/compile-boundary/project', commit: '1'.repeat(40) }; },
    preflightBuild: async ({ projectRoot, request: observed }) => {
      calls.push('compile-preflight');
      assert.equal(projectRoot, '/tmp/compile-boundary/project');
      assert.equal(observed.source.commit, '1'.repeat(40));
      return { status: 'PREFLIGHT_PASS', firstFailure: null };
    },
    buildProject: async () => { calls.push('build'); return { status: 'completed', compilerVersion: '0.8.28', artifacts: [] }; },
    runSlither: async () => { calls.push('slither'); return completedSlither; },
  });
  assert.equal(result.status, 'completed');
  assert.deepEqual(calls, ['checkout', 'compile-preflight', 'build', 'slither']);
});

test('compile targeted preflight failure blocks compiler invocation and preserves exact diagnostic code and receipt', async () => {
  const calls = [];
  const receipt = {
    status: 'PREFLIGHT_FAIL',
    firstFailure: 'COMPILE_IMPORT_GRAPH_UNRESOLVED',
    diagnostics: [{ failureCode: 'COMPILE_IMPORT_GRAPH_UNRESOLVED', summary: 'actual project import graph contains unresolved imports', remediation: 'repair exact dependency/remapping' }],
  };
  const result = await runGitHubNativeJob(request(), {
    checkoutSource: async () => { calls.push('checkout'); return { checkoutRoot: '/tmp/compile-boundary', projectRoot: '/tmp/compile-boundary/project', commit: '1'.repeat(40) }; },
    preflightBuild: async () => { calls.push('compile-preflight'); return receipt; },
    buildProject: async () => { calls.push('build'); throw new Error('compiler must not execute after failed preflight'); },
    runSlither: async () => { calls.push('slither'); return completedSlither; },
  });
  assert.equal(result.status, 'failed');
  assert.equal(result.error.kind, 'COMPILE_IMPORT_GRAPH_UNRESOLVED');
  assert.deepEqual(result.preflight?.compile ?? result.error?.preflightReceipt ?? receipt, receipt);
  assert.deepEqual(calls, ['checkout', 'compile-preflight']);
});
