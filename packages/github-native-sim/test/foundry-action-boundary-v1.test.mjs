import test from 'node:test';
import assert from 'node:assert/strict';
import { runGitHubNativeJob } from '../src/run-job-file.mjs';

function request() {
  return {
    schemaVersion: 'deep-assurance-github-request-v2', processId: 'audit-v7-independent-review',
    contractAutomationRelease: { repository: 'CurveYield2/Contract-Automation', branch: 'recovery/v7-execution-layer-v1', commit: '612fa50264e587e3f24550bf4dae35719b04211c', contractVersion: 'contract-automation-v7-relocated-v1' },
    runnerRelease: { version: 'deep-assurance-github-bridge-v1', manifestSha256: '2bebd99bb8ae770eb2feca0de7dc7e54596127a0c768922189e907e6658773dc' },
    campaignId: 'foundry-boundary-v1', assignmentId: 'reviewer-2-phase6-foundry-boundary-v1', phaseId: 'build-and-test', gateId: 'exact-build-and-tests-complete', profileId: 'github-native-simulate-v2',
    source: { repository: 'CurveYield2/Audits', commit: '1'.repeat(40), projectPath: 'audit-targets/example' },
    configuration: { compilers: [{ language: 'solidity', version: '0.8.28' }], timeoutMinutes: 20, analysis: { slither: { version: '0.11.6' }, medusa: { version: '1.5.1' }, nativeFuzz: { enabled: true, fuzzRuns: 64 } } },
    requestId: `dar-${'2'.repeat(32)}`, requestDigest: '3'.repeat(64),
  };
}

test('Foundry targeted preflight executes after terminal Medusa and immediately before substantive native fuzz', async () => {
  const calls = [];
  const result = await runGitHubNativeJob(request(), {
    checkoutSource: async () => { calls.push('checkout'); return { checkoutRoot: '/tmp/foundry-boundary', projectRoot: '/tmp/foundry-boundary/project', commit: '1'.repeat(40) }; },
    buildProject: async () => { calls.push('build'); return { status: 'completed', compilerVersion: '0.8.28', artifacts: [] }; },
    runSlither: async () => { calls.push('slither'); return { backend: 'slither', status: 'completed', terminal: true, componentStatus: 'COMPLETED', continuationDisposition: 'COMPLETE_EVIDENCE' }; },
    runMedusa: async () => { calls.push('medusa'); return { backend: 'medusa', version: '1.5.1', status: 'completed', terminal: true, failureKind: null, componentStatus: 'COMPLETED', continuationDisposition: 'COMPLETE_EVIDENCE' }; },
    preflightNativeFuzz: async ({ medusa }) => { calls.push('foundry-preflight'); assert.equal(medusa.terminal, true); return { status: 'PREFLIGHT_PASS', firstFailure: null }; },
    runNativeFuzz: async () => { calls.push('native-fuzz'); return { backend: 'native-fuzz', status: 'completed', terminal: true, componentStatus: 'COMPLETED', continuationDisposition: 'COMPLETE_EVIDENCE' }; },
  });
  assert.equal(result.status, 'completed');
  assert.deepEqual(calls, ['checkout', 'build', 'slither', 'medusa', 'foundry-preflight', 'native-fuzz']);
});

test('Foundry targeted preflight failure blocks native fuzz and preserves exact preflight failure code', async () => {
  const calls = [];
  const result = await runGitHubNativeJob(request(), {
    checkoutSource: async () => ({ checkoutRoot: '/tmp/foundry-boundary', projectRoot: '/tmp/foundry-boundary/project', commit: '1'.repeat(40) }),
    buildProject: async () => ({ status: 'completed', compilerVersion: '0.8.28', artifacts: [] }),
    runSlither: async () => ({ backend: 'slither', status: 'completed', terminal: true, componentStatus: 'COMPLETED', continuationDisposition: 'COMPLETE_EVIDENCE' }),
    runMedusa: async () => { calls.push('medusa'); return { backend: 'medusa', version: '1.5.1', status: 'completed', terminal: true, failureKind: null, componentStatus: 'COMPLETED', continuationDisposition: 'COMPLETE_EVIDENCE' }; },
    preflightNativeFuzz: async () => { calls.push('foundry-preflight'); return { status: 'PREFLIGHT_FAIL', firstFailure: 'FOUNDRY_SEMANTIC_SUITE_FAILURE', diagnostics: [{ failureCode: 'FOUNDRY_SEMANTIC_SUITE_FAILURE', summary: 'bounded target suite failed', remediation: 'repair failing test' }] }; },
    runNativeFuzz: async () => { calls.push('native-fuzz'); throw new Error('native fuzz must not execute'); },
  });
  assert.equal(result.status, 'failed');
  assert.equal(result.error.kind, 'FOUNDRY_SEMANTIC_SUITE_FAILURE');
  assert.deepEqual(calls, ['medusa', 'foundry-preflight']);
});
