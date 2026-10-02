import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyV7QualificationChanges } from '../../../scripts/classify-v7-qualification-change.mjs';

test('browser and audit control-plane changes qualify through the light lane', () => {
  const result = classifyV7QualificationChanges([
    '.github/workflows/browser-agent-watchdog.yml',
    '.github/workflows/browser-agent-wake.yml',
    'automation/runtime/github-native-sim/test/browser-agent-interphase-v1.test.mjs',
    'automation/schemas/curveyield-lite-interphase-completion-v1.schema.json',
    'automation/control-plane/browser-agent-wake/README.md',
  ]);
  assert.equal(result.lane, 'CONTROL_LIGHT');
  assert.equal(result.escalatedPaths, undefined);
});

test('canonical audit-controller execution workflow is control-plane, not runner engine', () => {
  const result = classifyV7QualificationChanges([
    '.github/workflows/audit-controller-execution.yml',
    'automation/runtime/github-native-sim/test/execution-workflow-v2.test.mjs',
    'automation/runtime/github-native-sim/test/atomic-request-bridge-v1.test.mjs',
  ]);
  assert.equal(result.lane, 'CONTROL_LIGHT');
});

test('qualification classifier policy edits use the light lane and remain covered by control-plane regression tests', () => {
  const result = classifyV7QualificationChanges([
    'automation/scripts/classify-v7-qualification-change.mjs',
  ]);
  assert.equal(result.lane, 'CONTROL_LIGHT');
  assert.equal(result.escalatedPaths, undefined);
});

test('runner, dependency, protocol, qualification-workflow, or unknown paths fail safe to FULL', () => {
  for (const file of [
    'automation/runtime/github-native-sim/src/run-job-file-v2.mjs',
    'automation/runtime/runner/src/anvil-engine.mjs',
    'automation/protocol.mjs',
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
    'automation/runtime/runner/src/workflow-runtime.mjs',
  ]);
  assert.equal(result.lane, 'FULL');
  assert.deepEqual(result.escalatedPaths, ['automation/runtime/runner/src/workflow-runtime.mjs']);
});

test('empty or explicitly forced qualification is FULL', () => {
  assert.equal(classifyV7QualificationChanges([]).lane, 'FULL');
  assert.equal(classifyV7QualificationChanges([
    '.github/workflows/browser-agent-wake.yml',
  ], { forceFull: true }).lane, 'FULL');
});

test('qualification status markers are control-plane metadata for controller-only baseline reuse', () => {
  const result = classifyV7QualificationChanges([
    'automation/control-plane/V7_QUALIFICATION_STATUS.json',
    'automation/control-plane/V7_QUALIFICATION_LAST_RUN.json',
  ]);
  assert.equal(result.lane, 'CONTROL_LIGHT');
  assert.equal(result.escalatedPaths, undefined);
});
