import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateDevelopmentRecoveryStateV1,
  validateRequiredRecoveryFilesV1,
  renderCurrentStatusV1,
} from '../src/development-recovery-v1.mjs';

const SHA = '468b749076fb5b9c166c14a187fdd29a6f967acd';
function validState() {
  return {
    schemaVersion: 'curve-yield-development-recovery-v1',
    projectId: 'HISTORICAL_EXPLOIT_ADVERSARIAL_SIMULATION_KB',
    planVersion: 'v3',
    repository: 'CurveYield2/Contract-Automation',
    branch: 'feat/adversarial-simulation-kb-v1',
    pullRequest: null,
    baselineMainSha: SHA,
    lastKnownGoodCommit: SHA,
    currentCommit: SHA,
    overallStatus: 'IN_PROGRESS',
    currentModuleId: 'K00',
    currentStepId: 'K00-S04',
    currentStepStatus: 'IN_PROGRESS',
    lastCompletedModuleId: null,
    lastCompletedStepId: 'K00-S03',
    nextExactAction: 'Open the draft PR after recording the first durable K00 implementation commit.',
    activeExternalRun: null,
    openBlockers: [],
    knownFailures: [],
    modifiedPaths: [],
    moduleStates: {
      K00: { status: 'IN_PROGRESS', steps: { 'K00-S01': 'PASS', 'K00-S02': 'PASS', 'K00-S03': 'PASS', 'K00-S04': 'IN_PROGRESS', 'K00-S05': 'READY' }, hardGate: 'PENDING' },
    },
    testSummary: {},
    proofSummary: {},
    decisions: [],
    lastUpdatedAt: '2026-08-24T05:40:00Z',
  };
}

test('valid recovery state passes and renders deterministic current status', () => {
  const state = validState();
  const result = validateDevelopmentRecoveryStateV1(state);
  assert.equal(result.status, 'PASS');
  assert.deepEqual(result.errors, []);
  const a = renderCurrentStatusV1(state);
  const b = renderCurrentStatusV1(structuredClone(state));
  assert.equal(a, b);
  assert.match(a, /K00 — Development Recovery System/);
  assert.match(a, /Open the draft PR/);
});

test('current module and step must belong to the v3 plan', () => {
  const badModule = validState();
  badModule.currentModuleId = 'K99';
  assert.equal(validateDevelopmentRecoveryStateV1(badModule).status, 'FAIL');
  const badStep = validState();
  badStep.currentStepId = 'K01-S01';
  assert.equal(validateDevelopmentRecoveryStateV1(badStep).status, 'FAIL');
});

test('in-progress work requires lastKnownGoodCommit and nextExactAction', () => {
  const missingSha = validState();
  missingSha.lastKnownGoodCommit = null;
  assert.equal(validateDevelopmentRecoveryStateV1(missingSha).status, 'FAIL');
  const missingNext = validState();
  missingNext.nextExactAction = '';
  assert.equal(validateDevelopmentRecoveryStateV1(missingNext).status, 'FAIL');
});

test('completed module requires hard-gate PASS evidence', () => {
  const state = validState();
  state.moduleStates.K00.status = 'COMPLETE';
  state.moduleStates.K00.hardGate = 'FAIL';
  assert.equal(validateDevelopmentRecoveryStateV1(state).status, 'FAIL');
});

test('terminal external run cannot remain active', () => {
  const state = validState();
  state.activeExternalRun = { runId: 123, status: 'PASS' };
  assert.equal(validateDevelopmentRecoveryStateV1(state).status, 'FAIL');
});

test('required recovery-file set is exact and complete', () => {
  const paths = [
    'docs/development-state/RECOVERY_START_HERE_v1.md',
    'docs/development-state/DEVELOPMENT_RECOVERY_STATE_v1.json',
    'docs/development-state/CURRENT_STATUS_v1.md',
    'docs/development-state/DECISION_LOG_v1.md',
    'docs/development-state/TEST_AND_PROOF_INDEX_v1.json',
  ];
  assert.deepEqual(validateRequiredRecoveryFilesV1(paths), { status: 'PASS', missing: [] });
  assert.deepEqual(validateRequiredRecoveryFilesV1(paths.slice(0, -1)).status, 'FAIL');
});
