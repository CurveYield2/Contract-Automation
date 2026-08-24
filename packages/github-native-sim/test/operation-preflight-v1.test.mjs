import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildOperationPreflightV1,
  buildReadOnlyPreflightExemptionV1,
} from '../src/operation-preflight-v1.mjs';

test('same-repository move requires blob reuse and no ad hoc chunking', () => {
  const result = buildOperationPreflightV1({
    operationClass: 'file-move',
    source: { repository: 'CurveYield2/Audit-Controller', ref: 'main', path: 'old/file.bin', blobSha: 'a'.repeat(40), bytes: 1000 },
    destination: { repository: 'CurveYield2/Audit-Controller', ref: 'main', path: 'new/file.bin', exists: false },
    transferMethod: 'GIT_TREE_REUSE_BLOB',
    plannedChunkCount: 1,
    verifyRemoteIdentity: true,
    rollbackPlan: 'restore prior tree',
  });
  assert.equal(result.status, 'PREFLIGHT_PASS');
});

test('normal file transfer rejects thousand-piece chunk plan', () => {
  const result = buildOperationPreflightV1({
    operationClass: 'file-transfer',
    source: { repository: 'CurveYield2/Audit-Controller', ref: 'main', path: 'source.zip', blobSha: 'a'.repeat(40), bytes: 10_000_000 },
    destination: { repository: 'CurveYield2/Contract-Automation', ref: 'work', path: 'source.zip', exists: false },
    transferMethod: 'GIT_EXACT_BLOB_TREE',
    plannedChunkCount: 1000,
    verifyRemoteIdentity: true,
    rollbackPlan: 'delete destination commit',
  });
  assert.equal(result.status, 'PREFLIGHT_FAIL');
  assert.equal(result.checks.find((entry) => entry.id === 'transfer.noAdHocChunking').status, 'FAIL');
});

test('unallowlisted read-only exemption fails closed', () => {
  const result = buildReadOnlyPreflightExemptionV1({ exemptionId: 'whatever-agent-wants' });
  assert.equal(result.status, 'PREFLIGHT_FAIL');
});

test('allowlisted trivial read inspection is exempt', () => {
  const result = buildReadOnlyPreflightExemptionV1({ exemptionId: 'read-workflow-log', repository: 'CurveYield2/Contract-Automation', ref: 'main' });
  assert.equal(result.status, 'PREFLIGHT_EXEMPT');
});

test('workflow preflight requires canonical identity and validated inputs', () => {
  const bad = buildOperationPreflightV1({
    operationClass: 'workflow',
    repository: 'CurveYield2/Contract-Automation',
    ref: 'main',
    workflowPath: '.github/workflows/some-old-v9.yml',
    event: 'pull_request',
    canonical: false,
    triggerValid: true,
    secretsReady: true,
    inputsValidated: false,
    expectedOutputs: ['evidence'],
    retryIdentity: 'run-1',
  });
  assert.equal(bad.status, 'PREFLIGHT_FAIL');

  const good = buildOperationPreflightV1({
    operationClass: 'workflow',
    repository: 'CurveYield2/Contract-Automation',
    ref: 'main',
    workflowPath: '.github/workflows/audit-controller-execution.yml',
    event: 'pull_request',
    canonical: true,
    triggerValid: true,
    secretsReady: true,
    inputsValidated: true,
    expectedOutputs: ['controller-evidence.json'],
    retryIdentity: 'request-digest-abc',
  });
  assert.equal(good.status, 'PREFLIGHT_PASS');
});

test('preflight digest is stable across object key order', () => {
  const a = buildOperationPreflightV1({
    operationClass: 'compile', repository: 'CurveYield2/Contract-Automation', ref: 'main', inputsValidated: true,
    prerequisitesReady: true, expectedOutputs: ['build.json'], rollbackPlan: 'discard workspace',
  });
  const b = buildOperationPreflightV1({
    rollbackPlan: 'discard workspace', expectedOutputs: ['build.json'], prerequisitesReady: true,
    inputsValidated: true, ref: 'main', repository: 'CurveYield2/Contract-Automation', operationClass: 'compile',
  });
  assert.equal(a.inputDigest, b.inputDigest);
});
