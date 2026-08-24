import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildOperationPreflightV1,
  buildReadOnlyPreflightExemptionV1,
} from '../src/operation-preflight-v1.mjs';

const COMMIT = 'a'.repeat(40);
const DIGEST = 'b'.repeat(64);

test('wrapper routes file-move to the targeted zero-byte blob-reuse preflight', () => {
  const result = buildOperationPreflightV1({
    operationClass: 'file-move',
    source: { repository: 'CurveYield2/Audit-Controller', ref: COMMIT, path: 'old/file.bin', blobSha: 'c'.repeat(40) },
    destination: { repository: 'CurveYield2/Audit-Controller', ref: COMMIT, path: 'new/file.bin', exists: false },
    transferMethod: 'GIT_TREE_REUSE_BLOB',
    expectedTransferredBytes: 0,
    verifyDestinationBlob: true,
    rollbackPlan: 'restore prior tree',
  });
  assert.equal(result.status, 'PREFLIGHT_PASS');
  assert.equal(result.checks.find((entry) => entry.id === 'move.blob-reuse').status, 'PASS');
});

test('wrapper routes file-transfer to targeted anti-chunking preflight', () => {
  const result = buildOperationPreflightV1({
    operationClass: 'file-transfer',
    source: { repository: 'CurveYield2/Audit-Controller', ref: COMMIT, path: 'source.zip', blobSha: 'c'.repeat(40), sha256: DIGEST, bytes: 10_000_000 },
    destination: { repository: 'CurveYield2/Contract-Automation', ref: 'work', path: 'source.zip', exists: false },
    transferMethod: 'GIT_EXACT_BLOB_TREE',
    plannedChunkCount: 1000,
    destinationWritable: true,
    verifyRemoteBytes: true,
    rollbackPlan: 'delete destination commit',
  });
  assert.equal(result.status, 'PREFLIGHT_FAIL');
  const failure = result.checks.find((entry) => entry.id === 'transfer.chunking');
  assert.equal(failure.status, 'FAIL');
  assert.equal(failure.failureCode, 'TRANSFER_AD_HOC_CHUNKING_FORBIDDEN');
});

test('unallowlisted read-only exemption fails closed', () => {
  const result = buildReadOnlyPreflightExemptionV1({ exemptionId: 'whatever-agent-wants' });
  assert.equal(result.status, 'PREFLIGHT_FAIL');
});

test('allowlisted trivial read inspection is exempt', () => {
  const result = buildReadOnlyPreflightExemptionV1({ exemptionId: 'read-workflow-log', repository: 'CurveYield2/Contract-Automation', ref: COMMIT });
  assert.equal(result.status, 'PREFLIGHT_EXEMPT');
});

test('wrapper workflow preflight rejects noncanonical workflow and passes exact canonical configuration', () => {
  const bad = buildOperationPreflightV1({
    operationClass: 'workflow',
    repository: 'CurveYield2/Contract-Automation',
    ref: COMMIT,
    workflowPath: '.github/workflows/some-old-v9.yml',
    classification: 'SUPERSEDED',
    event: 'pull_request',
    triggerAllowed: true,
    requiredSecrets: [],
    availableSecretNames: [],
    requiredPermissions: { contents: 'read' },
    observedPermissions: { contents: 'read' },
    inputSchemaValid: true,
    expectedOutputs: ['evidence'],
    substantiveJobsBlockedByPreflight: true,
    retry: { isRetry: false },
  });
  assert.equal(bad.status, 'PREFLIGHT_FAIL');
  assert.equal(bad.firstFailure, 'WORKFLOW_NONCANONICAL_ENTRYPOINT');

  const good = buildOperationPreflightV1({
    operationClass: 'workflow',
    repository: 'CurveYield2/Contract-Automation',
    ref: COMMIT,
    workflowPath: '.github/workflows/audit-controller-execution.yml',
    classification: 'ACTIVE_PREFLIGHT_REQUIRED',
    event: 'pull_request',
    triggerAllowed: true,
    requiredSecrets: [],
    availableSecretNames: [],
    requiredPermissions: { contents: 'read' },
    observedPermissions: { contents: 'read' },
    inputSchemaValid: true,
    expectedOutputs: ['controller-evidence.json'],
    substantiveJobsBlockedByPreflight: true,
    retry: { isRetry: false },
  });
  assert.equal(good.status, 'PREFLIGHT_PASS');
});

test('preflight digest is stable across object key order even for rejected configs', () => {
  const a = buildOperationPreflightV1({
    operationClass: 'compile', repository: 'CurveYield2/Contract-Automation', ref: 'main', inputsValidated: true,
    prerequisitesReady: true, expectedOutputs: ['build.json'], rollbackPlan: 'discard workspace',
  });
  const b = buildOperationPreflightV1({
    rollbackPlan: 'discard workspace', expectedOutputs: ['build.json'], prerequisitesReady: true,
    inputsValidated: true, ref: 'main', repository: 'CurveYield2/Contract-Automation', operationClass: 'compile',
  });
  assert.equal(a.inputDigest, b.inputDigest);
  assert.equal(a.status, 'PREFLIGHT_FAIL');
});
