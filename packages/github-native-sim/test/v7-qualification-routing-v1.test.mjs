import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyV7QualificationChanges } from '../../../scripts/classify-v7-qualification-change.mjs';

test('browser and audit control-plane changes qualify through the light lane', () => {
  const result = classifyV7QualificationChanges([
    '.github/workflows/browser-agent-watchdog.yml',
    '.github/workflows/browser-agent-wake.yml',
    'packages/github-native-sim/test/browser-agent-interphase-v1.test.mjs',
    'protocol/schemas/curveyield-lite-interphase-completion-v1.schema.json',
    'process/browser-agent-wake/README.md',
  ]);
  assert.equal(result.lane, 'CONTROL_LIGHT');
  assert.equal(result.escalatedPaths, undefined);
});

test('canonical audit-controller execution workflow is control-plane, not runner engine', () => {
  const result = classifyV7QualificationChanges([
    '.github/workflows/audit-controller-execution.yml',
    'packages/github-native-sim/test/execution-workflow-v2.test.mjs',
    'packages/github-native-sim/test/atomic-request-bridge-v1.test.mjs',
  ]);
  assert.equal(result.lane, 'CONTROL_LIGHT');
});

test('runner, dependency, protocol, qualification-workflow, or unknown paths fail safe to FULL', () => {
  for (const file of [
    'packages/github-native-sim/src/run-job-file-v2.mjs',
    'packages/runner/src/anvil-engine.mjs',
    'packages/protocol/src/index.mjs',
    'package.json',
    'package-lock.json',
    '.github/workflows/v7-execution-infrastructure-qualification.yml',
    '.github/workflows/v7-agent-qualification-bridge.yml',
    'unknown/future-file.txt',
  ]) {
    const result = classifyV7QualificationChanges([file]);
    assert.equal(result.lane, 'FULL', file);
    assert.deepEqual(result.escalatedPaths, [file]);
  }
});

test('mixed light and runner-critical change sets escalate the whole qualification to FULL', () => {
  const result = classifyV7QualificationChanges([
    '.github/workflows/browser-agent-watchdog.yml',
    'packages/runner/src/workflow-runtime.mjs',
  ]);
  assert.equal(result.lane, 'FULL');
  assert.deepEqual(result.escalatedPaths, ['packages/runner/src/workflow-runtime.mjs']);
});

test('empty or explicitly forced qualification is FULL', () => {
  assert.equal(classifyV7QualificationChanges([]).lane, 'FULL');
  assert.equal(classifyV7QualificationChanges([
    '.github/workflows/browser-agent-wake.yml',
  ], { forceFull: true }).lane, 'FULL');
});


test('qualification status markers are control-plane metadata for controller-only baseline reuse', () => {
  const result = classifyV7QualificationChanges([
    'process/V7_QUALIFICATION_STATUS.json',
    'process/V7_QUALIFICATION_LAST_RUN.json',
  ]);
  assert.equal(result.lane, 'CONTROL_LIGHT');
  assert.equal(result.escalatedPaths, undefined);
});


test('documentation and browser-watchdog runtime state remain control-light', () => {
  const result = classifyV7QualificationChanges([
    'docs/TRACE_PR_LIFECYCLE_BOUNDARY_v1.md',
    'process/browser-agent-watchdog/active/watchdog-sweep-smoke-v4.json',
    'process/browser-agent-watchdog/completed/example.json',
  ]);
  assert.equal(result.lane, 'CONTROL_LIGHT');
  assert.equal(result.escalatedPaths, undefined);
});

test('qualification classifier implementation is itself control-light but regression-tested', () => {
  const result = classifyV7QualificationChanges([
    'scripts/classify-v7-qualification-change.mjs',
    'packages/github-native-sim/test/v7-qualification-routing-v1.test.mjs',
  ]);
  assert.equal(result.lane, 'CONTROL_LIGHT');
  assert.equal(result.escalatedPaths, undefined);
});
