import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateDeepAssuranceRequestV2 } from './schema.mjs';
import { runGitHubNativeJob as runGitHubNativeJobV1 } from './run-job-file.mjs';
import { runPhase6ExecutionPreflightV1 } from './phase6-execution-preflight-v1.mjs';
import { createPhase6MutableRpcSession, phase6MutableRpcRuntime } from './phase6-mutable-rpc-v1.mjs';
import { runPhase7ForkPreflightV2 } from './phase7-fork-preflight-v2.mjs';
import { stagePhase6Snapshot, copyPhase6SnapshotForExecution } from './phase6-staged-snapshot-v1.mjs';
import { attachExecutionDisposition } from './execution-disposition-v1.mjs';

const DEFAULT_RUNNER_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

function preflightFailure(request, preflight) {
  const repairRequired = preflight?.nextState === 'RUNNER_REPAIR_REBIND';
  return {
    schemaVersion: 'deep-assurance-github-native-execution-v2', requestId: request.requestId,
    requestDigest: request.requestDigest, profileId: request.profileId, source: structuredClone(request.source),
    status: 'failed', preflight, build: null, deploymentGasEvidence: null, analysis: {}, simulation: null,
    analysisComponentFailureCount: 0, failedStepCount: 0, failedSteps: [],
    continuityDisposition: repairRequired ? 'RUNNER_REPAIR_REBIND_REQUIRED' : 'PREFLIGHT_BLOCKED',
    error: { name: 'V7ExecutionPreflightFailure', message: `${request.phaseId} preflight did not pass`, kind: preflight?.failureKind ?? 'EXECUTION_PREFLIGHT_FAILURE' },
    startedAt: new Date().toISOString(), finishedAt: new Date().toISOString(),
  };
}

function terminalNotApplicable(backend, preflightComponent) {
  return {
    backend, status: 'not_applicable', terminal: true, componentStatus: 'NOT_APPLICABLE',
    continuationDisposition: 'COMPLETE_EVIDENCE', failureKind: null,
    reason: preflightComponent?.reason ?? 'TARGET_HARNESS_NOT_PRESENT', preflightDetermined: true, toolInvoked: false,
  };
}

function phase6MutableRpcRequested(request) {
  const analysis = request.configuration?.analysis ?? {};
  const medusaRequested = analysis.medusa !== false && analysis.medusa !== undefined;
  const nativeFuzzRequested = analysis.nativeFuzz?.enabled === true;
  return medusaRequested || nativeFuzzRequested;
}

function phase6DelegateOptions(delegateOptions, preflight, session) {
  const options = { ...delegateOptions };
  if (preflight?.mutableRpc?.status === 'PASS') {
    options.phase6MutableRpc = phase6MutableRpcRuntime({ session });
  }
  if (preflight?.medusa?.status === 'NOT_APPLICABLE') options.runMedusa = async () => terminalNotApplicable('medusa', preflight.medusa);
  if (preflight?.nativeFuzz?.status === 'NOT_APPLICABLE') options.runNativeFuzz = async () => terminalNotApplicable('native-fuzz', preflight.nativeFuzz);
  return options;
}

function normalizePhase6TerminalSemantics(result) {
  if (!result || result.status !== 'completed') return result;
  const components = Object.values(result.analysis ?? {}).filter(Boolean);
  const failureCount = components.filter((component) => ['FAILED', 'UNAVAILABLE'].includes(component.componentStatus)).length;
  const limitationCount = components.filter((component) => component.componentStatus === 'NOT_APPLICABLE').length;
  return {
    ...result,
    analysisComponentFailureCount: failureCount,
    analysisNotApplicableCount: limitationCount,
    continuityDisposition: failureCount > 0 ? 'CONTINUE_WITH_LIMITATION' : 'COMPLETE_EVIDENCE',
  };
}

export async function runGitHubNativeJobV2(input, {
  workspaceRoot = path.resolve('.deep-assurance-work-v2'),
  environment = process.env,
  runnerCommit = process.env.GITHUB_SHA ?? null,
  runnerRoot = DEFAULT_RUNNER_ROOT,
  requestPath = '<request.json>',
  createPhase6RpcSession = createPhase6MutableRpcSession,
  ...delegateOptions
} = {}) {
  const request = validateDeepAssuranceRequestV2(input);
  let preflight = null;
  let phase6Snapshot = null;
  let phase6RpcSession = null;
  let executionSnapshot = null;

  try {
    if (request.phaseId === 'build-and-test') {
      phase6Snapshot = await stagePhase6Snapshot(request, {
        workspaceRoot: path.join(workspaceRoot, 'staging'),
        environment,
        runnerRoot,
      });

      if (phase6MutableRpcRequested(request)) {
        phase6RpcSession = await createPhase6RpcSession({ environment });
      }

      preflight = await runPhase6ExecutionPreflightV1({
        request,
        projectRoot: phase6Snapshot.projectRoot,
        runnerCommit,
        environment,
        mutableRpcSession: phase6RpcSession,
      });
      preflight = {
        ...preflight,
        harnessOverlay: phase6Snapshot.harnessOverlay,
        stagedSnapshot: {
          schemaVersion: phase6Snapshot.schemaVersion,
          digestSha256: phase6Snapshot.snapshotDigestSha256,
          fileCount: phase6Snapshot.snapshotFileCount,
          bytes: phase6Snapshot.snapshotBytes,
          sourceCommit: phase6Snapshot.commit,
          materializedOnce: true,
        },
      };
    } else if (request.phaseId === 'fork-simulation-lifecycle') {
      preflight = await runPhase7ForkPreflightV2({ request, environment });
    }

    if (preflight && preflight.status !== 'PASS') {
      return attachExecutionDisposition({ request, result: preflightFailure(request, preflight), requestPath });
    }

    const delegated = request.phaseId === 'build-and-test'
      ? phase6DelegateOptions(delegateOptions, preflight, phase6RpcSession)
      : { ...delegateOptions };

    if (request.phaseId === 'build-and-test') {
      delegated.checkoutSource = async () => {
        executionSnapshot = await copyPhase6SnapshotForExecution(phase6Snapshot, {
          workspaceRoot: path.join(workspaceRoot, 'execution'),
        });
        return executionSnapshot;
      };
    }

    let result = await runGitHubNativeJobV1(request, {
      workspaceRoot: path.join(workspaceRoot, 'execution'),
      environment,
      ...delegated,
    });

    if (request.phaseId === 'build-and-test') {
      result = normalizePhase6TerminalSemantics(result);
      const verified = executionSnapshot?.snapshotDigestSha256 === phase6Snapshot?.snapshotDigestSha256;
      result = {
        ...result,
        preflight: {
          ...preflight,
          executionSnapshotDigestSha256: executionSnapshot?.snapshotDigestSha256 ?? null,
          executionSnapshotVerified: verified,
          secondNetworkCheckoutPerformed: false,
          secondOverlayMaterializationPerformed: false,
          normalizedRpcSessionSharedWithExecution: preflight.mutableRpc?.status === 'PASS',
        },
      };
    } else {
      result = { ...result, preflight };
    }

    return attachExecutionDisposition({ request, result, requestPath });
  } finally {
    if (phase6RpcSession?.close) await phase6RpcSession.close().catch(() => {});
  }
}

export const runGitHubNativeJob = runGitHubNativeJobV2;
