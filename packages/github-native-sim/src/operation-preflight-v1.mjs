import { createHash } from 'node:crypto';

export const OPERATION_PREFLIGHT_SCHEMA = 'curveyield-operation-preflight-v1';

export const OPERATION_CLASSES = Object.freeze([
  'workflow',
  'request-submit',
  'file-transfer',
  'file-move',
  'branch-pr',
  'source-staging',
  'compile',
  'slither',
  'medusa',
  'foundry',
  'anvil-simulation',
  'live-read-probe',
  'remediation-rerun',
  'publication',
  'destructive-cleanup',
]);

const TRIVIAL_READ_ONLY_EXEMPTIONS = new Set([
  'read-known-file',
  'read-pr-metadata',
  'read-workflow-log',
]);

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

function digest(value) {
  return createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex');
}

function check(checks, id, condition, detail) {
  checks.push({ id, status: condition ? 'PASS' : 'FAIL', detail });
}

function requireString(checks, id, value) {
  check(checks, id, typeof value === 'string' && value.trim().length > 0, value ?? null);
}

function requireBoolean(checks, id, value) {
  check(checks, id, typeof value === 'boolean', value ?? null);
}

function evaluateFileOperation(input, checks) {
  requireString(checks, 'source.repository', input.source?.repository);
  requireString(checks, 'source.ref', input.source?.ref);
  requireString(checks, 'source.path', input.source?.path);
  requireString(checks, 'source.blobSha', input.source?.blobSha);
  check(checks, 'source.bytes', Number.isInteger(input.source?.bytes) && input.source.bytes >= 0, input.source?.bytes ?? null);
  requireString(checks, 'destination.repository', input.destination?.repository);
  requireString(checks, 'destination.ref', input.destination?.ref);
  requireString(checks, 'destination.path', input.destination?.path);
  requireBoolean(checks, 'destination.existsKnown', input.destination?.exists);

  if (input.destination?.exists === true) {
    check(checks, 'destination.overwriteIntent', input.overwriteIntent === true, input.overwriteIntent ?? false);
  }

  const sameRepository = input.source?.repository === input.destination?.repository;
  const sameRef = sameRepository && input.source?.ref === input.destination?.ref;
  const plannedChunkCount = Number.isInteger(input.plannedChunkCount) ? input.plannedChunkCount : 1;
  const approvedChunkedSubsystem = input.approvedChunkedSubsystem === true;
  check(
    checks,
    'transfer.noAdHocChunking',
    plannedChunkCount <= 1 || approvedChunkedSubsystem,
    { plannedChunkCount, approvedChunkedSubsystem },
  );

  if (sameRef && input.operationClass === 'file-move') {
    check(
      checks,
      'transfer.sameRepoBlobReuse',
      input.transferMethod === 'GIT_TREE_REUSE_BLOB',
      input.transferMethod ?? null,
    );
  } else {
    check(
      checks,
      'transfer.exactMethod',
      ['GIT_EXACT_BLOB_TREE', 'WORKFLOW_ARTIFACT_REFERENCE'].includes(input.transferMethod),
      input.transferMethod ?? null,
    );
  }

  check(checks, 'transfer.postWriteVerification', input.verifyRemoteIdentity === true, input.verifyRemoteIdentity ?? false);
  requireString(checks, 'transfer.rollbackPlan', input.rollbackPlan);
}

function evaluateWorkflow(input, checks) {
  requireString(checks, 'workflow.repository', input.repository);
  requireString(checks, 'workflow.ref', input.ref);
  requireString(checks, 'workflow.path', input.workflowPath);
  requireString(checks, 'workflow.event', input.event);
  check(checks, 'workflow.canonicalIdentity', input.canonical === true, input.canonical ?? false);
  check(checks, 'workflow.triggerValid', input.triggerValid === true, input.triggerValid ?? false);
  check(checks, 'workflow.secretsReady', input.secretsReady !== false, input.secretsReady ?? null);
  check(checks, 'workflow.inputsValidated', input.inputsValidated === true, input.inputsValidated ?? false);
  check(checks, 'workflow.outputsDeclared', Array.isArray(input.expectedOutputs) && input.expectedOutputs.length > 0, input.expectedOutputs ?? null);
  requireString(checks, 'workflow.retryIdentity', input.retryIdentity);
}

function evaluateBranchPr(input, checks) {
  requireString(checks, 'branch.repository', input.repository);
  requireString(checks, 'branch.baseRef', input.baseRef);
  requireString(checks, 'branch.baseSha', input.baseSha);
  check(checks, 'branch.existingWorkSearched', input.existingWorkSearched === true, input.existingWorkSearched ?? false);
  check(checks, 'branch.newBranchRequired', typeof input.newBranchRequired === 'boolean', input.newBranchRequired ?? null);
  requireString(checks, 'branch.lifecycleDisposition', input.lifecycleDisposition);
  check(checks, 'branch.intendedDiffDeclared', Array.isArray(input.intendedPaths) && input.intendedPaths.length > 0, input.intendedPaths ?? null);
}

function evaluateRequestSubmit(input, checks) {
  requireString(checks, 'request.path', input.requestPath);
  requireString(checks, 'request.id', input.requestId);
  requireString(checks, 'request.digest', input.requestDigest);
  requireString(checks, 'request.sourceCommit', input.sourceCommit);
  requireString(checks, 'request.baseRef', input.baseRef);
  check(checks, 'request.schemaValidated', input.schemaValidated === true, input.schemaValidated ?? false);
  check(checks, 'request.secretFieldsAbsent', input.secretFieldsAbsent === true, input.secretFieldsAbsent ?? false);
  check(checks, 'request.atomicDiffPlanned', input.atomicDiffPlanned === true, input.atomicDiffPlanned ?? false);
  check(checks, 'request.remoteVerificationPlanned', input.verifyRemoteIdentity === true, input.verifyRemoteIdentity ?? false);
}

function evaluateGeneric(input, checks) {
  requireString(checks, 'generic.repository', input.repository);
  requireString(checks, 'generic.ref', input.ref);
  check(checks, 'generic.inputsValidated', input.inputsValidated === true, input.inputsValidated ?? false);
  check(checks, 'generic.prerequisitesReady', input.prerequisitesReady === true, input.prerequisitesReady ?? false);
  check(checks, 'generic.expectedOutputsDeclared', Array.isArray(input.expectedOutputs) && input.expectedOutputs.length > 0, input.expectedOutputs ?? null);
  requireString(checks, 'generic.rollbackPlan', input.rollbackPlan);
}

export function buildOperationPreflightV1(input = {}) {
  const operationClass = input.operationClass;
  if (!OPERATION_CLASSES.includes(operationClass)) {
    return {
      schemaVersion: OPERATION_PREFLIGHT_SCHEMA,
      operationClass: operationClass ?? null,
      status: 'PREFLIGHT_FAIL',
      inputDigest: digest(input),
      checks: [{ id: 'operationClass', status: 'FAIL', detail: operationClass ?? null }],
      expectedOutputs: input.expectedOutputs ?? [],
      rollback: input.rollbackPlan ?? null,
      retryPolicy: 'RECHECK_AFTER_FAILURE',
    };
  }

  const checks = [];
  if (operationClass === 'file-transfer' || operationClass === 'file-move') evaluateFileOperation(input, checks);
  else if (operationClass === 'workflow') evaluateWorkflow(input, checks);
  else if (operationClass === 'branch-pr') evaluateBranchPr(input, checks);
  else if (operationClass === 'request-submit') evaluateRequestSubmit(input, checks);
  else evaluateGeneric(input, checks);

  const status = checks.every((entry) => entry.status === 'PASS') ? 'PREFLIGHT_PASS' : 'PREFLIGHT_FAIL';
  return {
    schemaVersion: OPERATION_PREFLIGHT_SCHEMA,
    operationClass,
    status,
    repository: input.repository ?? input.source?.repository ?? null,
    ref: input.ref ?? input.source?.ref ?? null,
    inputDigest: digest(input),
    checks,
    expectedOutputs: input.expectedOutputs ?? [],
    rollback: input.rollbackPlan ?? null,
    retryPolicy: 'RECHECK_AFTER_FAILURE',
  };
}

export function buildReadOnlyPreflightExemptionV1({ exemptionId, repository = null, ref = null } = {}) {
  if (!TRIVIAL_READ_ONLY_EXEMPTIONS.has(exemptionId)) {
    return {
      schemaVersion: OPERATION_PREFLIGHT_SCHEMA,
      operationClass: 'read-only',
      status: 'PREFLIGHT_FAIL',
      repository,
      ref,
      inputDigest: digest({ exemptionId, repository, ref }),
      checks: [{ id: 'exemption.allowlisted', status: 'FAIL', detail: exemptionId ?? null }],
      expectedOutputs: [],
      rollback: null,
      retryPolicy: 'RECHECK_AFTER_FAILURE',
    };
  }
  return {
    schemaVersion: OPERATION_PREFLIGHT_SCHEMA,
    operationClass: 'read-only',
    status: 'PREFLIGHT_EXEMPT',
    repository,
    ref,
    inputDigest: digest({ exemptionId, repository, ref }),
    checks: [{ id: 'exemption.allowlisted', status: 'PASS', detail: exemptionId }],
    expectedOutputs: [],
    rollback: null,
    retryPolicy: 'RECHECK_AFTER_FAILURE',
  };
}
