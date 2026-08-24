import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateDeepAssuranceRequestWithV26V1 } from './schema-v26.mjs';
import { runGitHubNativeJob as runGitHubNativeJobV1 } from './run-job-file.mjs';
import { runPhase6ExecutionPreflightV1 } from './phase6-execution-preflight-v1.mjs';
import { createPhase6MutableRpcSession, phase6MutableRpcRuntime } from './phase6-mutable-rpc-v1.mjs';
import { runTargetCompilePreflightV1 } from './compile-target-preflight-v1.mjs';
import { runTargetSlitherPreflightV1 } from './slither-target-preflight-v1.mjs';
import { runTargetMedusaPreflightV1 } from './medusa-target-preflight-v1.mjs';
import { runTargetFoundryPreflightV1 } from './foundry-target-preflight-v1.mjs';
import { runProcess } from './execution.mjs';
import { runPhase7ForkPreflightV2 } from './phase7-fork-preflight-v2.mjs';
import { stagePhase6Snapshot, copyPhase6SnapshotForExecution } from './phase6-staged-snapshot-v1.mjs';
import { attachExecutionDisposition } from './execution-disposition-v1.mjs';
import { stripV26RequestExtensionV1, enrichPhase6V26EvidenceV1, enrichPhase7V26EvidenceV1, attachReproductionEvidenceV1 } from './v26-execution-evidence-v1.mjs';

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

function phase6RequiresMutableRpc(request) {
  const medusaRequested = request.configuration?.analysis?.medusa !== false
    && request.configuration?.analysis?.medusa !== undefined;
  const nativeFuzzRequested = request.configuration?.analysis?.nativeFuzz?.enabled === true;
  const v26 = request.configuration?.v26;
  const coverageRequested = (v26?.foundryCoverageObligations?.length ?? 0) > 0 || v26?.foundryRefinementRequired === true;
  return medusaRequested || nativeFuzzRequested || coverageRequested;
}

function phase6RequiresSlither(request) {
  return request.configuration?.analysis?.slither !== false && request.configuration?.analysis?.slither !== undefined;
}

function expectedCompileArtifacts(request) {
  return (request?.configuration?.deploymentGas?.deployableContracts ?? [])
    .filter((item) => item?.sourceName && item?.contractName)
    .map((item) => `${item.sourceName}:${item.contractName}`);
}

function compilePreflightInput(request, projectRoot, expectedSourceSnapshotDigest = null) {
  return {
    projectRoot,
    ...(expectedSourceSnapshotDigest ? { expectedSourceSnapshotDigest } : {}),
    requestedCompilers: request.configuration?.compilers ?? [],
    optimizer: request.configuration?.optimizer ?? null,
    evmVersion: request.configuration?.evmVersion ?? null,
    viaIR: request.configuration?.viaIR ?? false,
    expectedArtifacts: expectedCompileArtifacts(request),
  };
}

function phase6DelegateOptions(delegateOptions, preflight, mutableRpcSession) {
  const options = { ...delegateOptions };
  delete options.runTargetCompilePreflight;
  delete options.runTargetSlitherPreflight;
  delete options.runTargetMedusaPreflight;
  delete options.runTargetFoundryPreflight;
  if (preflight?.mutableRpc?.status === 'PASS') {
    options.phase6MutableRpc = phase6MutableRpcRuntime({ session: mutableRpcSession });
  }
  if (preflight?.medusa?.status === 'NOT_APPLICABLE') options.runMedusa = async () => terminalNotApplicable('medusa', preflight.medusa);
  if (preflight?.nativeFuzz?.status === 'NOT_APPLICABLE') options.runNativeFuzz = async () => terminalNotApplicable('native-fuzz', preflight.nativeFuzz);
  return options;
}

function normalizePhase6TerminalSemantics(result) {
  if (!result || result.status !== 'completed') return result;
  const components = Object.values(result.analysis ?? {}).filter(Boolean);
  const failureCount = components.filter((component) => ['FAILED', 'UNAVAILABLE', 'COMPLETED_WITH_FAILURES'].includes(component.componentStatus)).length;
  const limitationCount = components.filter((component) => component.componentStatus === 'NOT_APPLICABLE').length;
  return {
    ...result,
    analysisComponentFailureCount: failureCount,
    analysisNotApplicableCount: limitationCount,
    continuityDisposition: failureCount > 0 ? 'CONTINUE_WITH_LIMITATION' : 'COMPLETE_EVIDENCE',
  };
}

function foundryMedusaTerminalStatus(medusa) {
  if (!medusa || medusa.terminal !== true) return 'RUNNING';
  if (medusa.failureKind === 'PROPERTY_FALSIFICATION') return 'PROPERTY_FALSIFICATION';
  if (medusa.failureKind === 'NO_TESTS_DISCOVERED') return 'NO_TESTS_DISCOVERED';
  if (medusa.status === 'completed') return 'COMPLETED';
  if (medusa.status === 'completed_with_failures') return 'COMPLETED_WITH_FAILURES';
  if (medusa.status === 'failed') return 'FAILED';
  return 'FAILED';
}

async function executePhase6V2({
  request,
  workspaceRoot,
  environment,
  runnerCommit,
  runnerRoot,
  requestPath,
  delegateOptions,
  createMutableRpcSession,
}) {
  const legacyRequest = stripV26RequestExtensionV1(request);
  let phase6Snapshot = null;
  let mutableRpcSession = null;
  let executionSnapshot = null;
  let targetCompilePreflight = null;
  let targetSlitherPreflight = null;
  let targetFoundryPreflight = null;
  try {
    phase6Snapshot = await stagePhase6Snapshot(legacyRequest, {
      workspaceRoot: path.join(workspaceRoot, 'staging'),
      environment,
      runnerRoot,
    });

    if (phase6RequiresMutableRpc(request)) {
      mutableRpcSession = await createMutableRpcSession({ environment });
    }

    let preflight = await runPhase6ExecutionPreflightV1({
      request: legacyRequest,
      projectRoot: phase6Snapshot.projectRoot,
      runnerCommit,
      environment,
      ...(mutableRpcSession ? { mutableRpcEvidence: mutableRpcSession.evidence } : {}),
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
      mutableRpcSession: phase6RequiresMutableRpc(request) ? {
        status: mutableRpcSession?.evidence?.status ?? 'FAIL',
        identityNormalized: mutableRpcSession?.runtime?.identityNormalized === true,
        sharedAcrossPreflightMedusaAndFoundry: mutableRpcSession?.evidence?.status === 'PASS',
        runtimeUrlExposed: false,
      } : { status: 'NOT_REQUIRED' },
    };

    if (preflight.status !== 'PASS') {
      return attachExecutionDisposition({ request, result: preflightFailure(request, preflight), requestPath });
    }

    if (preflight.medusa?.status === 'PASS') {
      const mutableRpcRuntime = phase6MutableRpcRuntime({ session: mutableRpcSession });
      const targetMedusaPreflightRunner = delegateOptions.runTargetMedusaPreflight ?? runTargetMedusaPreflightV1;
      const targetMedusaPreflight = await targetMedusaPreflightRunner({
        sourceCommit: phase6Snapshot.commit,
        projectRoot: phase6Snapshot.projectRoot,
        snapshotDigestSha256: phase6Snapshot.snapshotDigestSha256,
        harnessOverlayDigestSha256: phase6Snapshot.harnessOverlay?.overlayDigestSha256,
        rpcUrl: mutableRpcRuntime.url,
        rpcProfile: mutableRpcRuntime.profile,
        rpcBlock: mutableRpcRuntime.blockNumber,
        rpcBlockHash: mutableRpcRuntime.blockHash,
        workspaceRoot: path.join(workspaceRoot, 'preflight'),
      }, {
        ...(delegateOptions.runMedusa ? { runMedusa: delegateOptions.runMedusa } : {}),
      });
      preflight = {
        ...preflight,
        targetMedusa: targetMedusaPreflight,
        targetMedusaSmokeRequired: true,
        targetMedusaSmokePassed: targetMedusaPreflight.status === 'PREFLIGHT_PASS',
      };
      if (targetMedusaPreflight.status !== 'PREFLIGHT_PASS') {
        preflight = {
          ...preflight,
          status: 'FAIL',
          failureKind: targetMedusaPreflight.firstFailure ?? 'MEDUSA_TARGET_PREFLIGHT_FAILURE',
          reason: targetMedusaPreflight.diagnostics?.[0]?.summary ?? 'Actual-target Medusa smoke did not pass',
        };
        return attachExecutionDisposition({ request, result: preflightFailure(request, preflight), requestPath });
      }
    } else {
      preflight = {
        ...preflight,
        targetMedusa: { status: 'NOT_APPLICABLE', reason: preflight.medusa?.reason ?? 'TARGET_HARNESS_NOT_PRESENT' },
        targetMedusaSmokeRequired: false,
        targetMedusaSmokePassed: null,
      };
    }

    const delegated = phase6DelegateOptions(delegateOptions, preflight, mutableRpcSession);
    delegated.checkoutSource = async () => {
      executionSnapshot = await copyPhase6SnapshotForExecution(phase6Snapshot, {
        workspaceRoot: path.join(workspaceRoot, 'execution'),
      });
      return executionSnapshot;
    };

    delegated.preflightBuild = async ({ projectRoot }) => {
      const runner = delegateOptions.runTargetCompilePreflight ?? runTargetCompilePreflightV1;
      targetCompilePreflight = await runner(
        compilePreflightInput(legacyRequest, projectRoot, phase6Snapshot.snapshotDigestSha256),
        { runCommand: delegateOptions.runCommand ?? runProcess },
      );
      return targetCompilePreflight;
    };

    if (phase6RequiresSlither(legacyRequest)) {
      delegated.preflightSlither = async ({ projectRoot, build }) => {
        const runner = delegateOptions.runTargetSlitherPreflight ?? runTargetSlitherPreflightV1;
        targetSlitherPreflight = await runner({
          projectRoot,
          sourceCommit: phase6Snapshot.commit,
          build,
        }, { runCommand: delegateOptions.runCommand ?? runProcess });
        return targetSlitherPreflight;
      };
    }

    if (preflight.nativeFuzz?.status === 'PASS') {
      delegated.preflightNativeFuzz = async ({ projectRoot, medusa, phase6MutableRpc }) => {
        const runner = delegateOptions.runTargetFoundryPreflight ?? runTargetFoundryPreflightV1;
        targetFoundryPreflight = await runner({
          projectRoot,
          sourceCommit: phase6Snapshot.commit,
          snapshotDigestSha256: phase6Snapshot.snapshotDigestSha256,
          expectedSnapshotDigestSha256: phase6Snapshot.snapshotDigestSha256,
          medusaTerminalStatus: foundryMedusaTerminalStatus(medusa),
          rpcUrl: phase6MutableRpc?.url,
          rpcProfile: phase6MutableRpc?.profile,
          rpcChainId: phase6MutableRpc?.chainId,
          rpcBlock: phase6MutableRpc?.blockNumber,
          rpcBlockHash: phase6MutableRpc?.blockHash,
          workspaceRoot: path.join(workspaceRoot, 'preflight'),
          fuzzRuns: Math.min(16, legacyRequest.configuration.analysis?.nativeFuzz?.fuzzRuns ?? 16),
          coverageObligationsValid: true,
          outputPathsWritable: true,
        }, { runCommand: delegateOptions.runCommand ?? runProcess });
        return targetFoundryPreflight;
      };
    }

    let result = await runGitHubNativeJobV1(legacyRequest, {
      workspaceRoot: path.join(workspaceRoot, 'execution'),
      environment,
      ...delegated,
    });

    if (targetCompilePreflight && targetCompilePreflight.status !== 'PREFLIGHT_PASS') {
      result = {
        ...result,
        preflight: {
          ...preflight,
          targetCompile: targetCompilePreflight,
          targetCompileRequired: true,
          targetCompilePassed: false,
          executionSnapshotDigestSha256: executionSnapshot?.snapshotDigestSha256 ?? null,
          executionSnapshotVerified: executionSnapshot?.snapshotDigestSha256 === phase6Snapshot?.snapshotDigestSha256,
          secondNetworkCheckoutPerformed: false,
          secondOverlayMaterializationPerformed: false,
        },
      };
      return attachExecutionDisposition({ request, result, requestPath });
    }

    result = normalizePhase6TerminalSemantics(result);
    const verified = executionSnapshot?.snapshotDigestSha256 === phase6Snapshot?.snapshotDigestSha256;
    result = {
      ...result,
      preflight: {
        ...preflight,
        targetCompile: targetCompilePreflight ?? result.preflight?.compile ?? { status: 'NOT_RUN', reason: 'BUILD_BOUNDARY_NOT_REACHED' },
        targetCompileRequired: true,
        targetCompilePassed: targetCompilePreflight ? targetCompilePreflight.status === 'PREFLIGHT_PASS' : null,
        targetSlither: phase6RequiresSlither(legacyRequest)
          ? (targetSlitherPreflight ?? { status: 'NOT_RUN', reason: 'SLITHER_ACTION_BOUNDARY_NOT_REACHED' })
          : { status: 'NOT_APPLICABLE', reason: 'SLITHER_NOT_REQUESTED' },
        targetSlitherSmokeRequired: phase6RequiresSlither(legacyRequest),
        targetSlitherSmokePassed: targetSlitherPreflight ? targetSlitherPreflight.status === 'PREFLIGHT_PASS' : null,
        targetFoundry: preflight.nativeFuzz?.status === 'PASS'
          ? (targetFoundryPreflight ?? { status: 'NOT_RUN', reason: 'NATIVE_FUZZ_ACTION_BOUNDARY_NOT_REACHED' })
          : { status: 'NOT_APPLICABLE', reason: preflight.nativeFuzz?.reason ?? 'NATIVE_FUZZ_NOT_REQUESTED' },
        targetFoundrySmokeRequired: preflight.nativeFuzz?.status === 'PASS',
        targetFoundrySmokePassed: targetFoundryPreflight ? targetFoundryPreflight.status === 'PREFLIGHT_PASS' : null,
        executionSnapshotDigestSha256: executionSnapshot?.snapshotDigestSha256 ?? null,
        executionSnapshotVerified: verified,
        secondNetworkCheckoutPerformed: false,
        secondOverlayMaterializationPerformed: false,
      },
    };
    result = await enrichPhase6V26EvidenceV1({
      request,
      result,
      projectRoot: executionSnapshot?.projectRoot ?? phase6Snapshot.projectRoot,
      mutableRpcRuntime: mutableRpcSession?.evidence?.status === 'PASS' ? phase6MutableRpcRuntime({ session: mutableRpcSession }) : null,
      environment,
      runCommand: delegateOptions.runCommand,
    });
    return attachExecutionDisposition({ request, result, requestPath });
  } finally {
    if (mutableRpcSession?.close) await mutableRpcSession.close().catch(() => {});
  }
}

export async function runGitHubNativeJobV2(input, {
  workspaceRoot = path.resolve('.deep-assurance-work-v2'),
  environment = process.env,
  runnerCommit = process.env.GITHUB_SHA ?? null,
  runnerRoot = DEFAULT_RUNNER_ROOT,
  requestPath = '<request.json>',
  createMutableRpcSession = createPhase6MutableRpcSession,
  ...delegateOptions
} = {}) {
  const v26Request = validateDeepAssuranceRequestWithV26V1(input);

  if (v26Request.phaseId === 'build-and-test') {
    return executePhase6V2({
      request: v26Request,
      workspaceRoot,
      environment,
      runnerCommit,
      runnerRoot,
      requestPath,
      delegateOptions,
      createMutableRpcSession,
    });
  }

  const request = stripV26RequestExtensionV1(v26Request);
  let preflight = null;
  if (v26Request.phaseId === 'fork-simulation-lifecycle') {
    preflight = await runPhase7ForkPreflightV2({ request, environment });
  }

  if (preflight && preflight.status !== 'PASS') {
    return attachExecutionDisposition({ request: v26Request, result: preflightFailure(v26Request, preflight), requestPath });
  }

  const executionOptions = { ...delegateOptions };
  const targetCompileRunner = executionOptions.runTargetCompilePreflight ?? runTargetCompilePreflightV1;
  const targetSlitherRunner = executionOptions.runTargetSlitherPreflight ?? runTargetSlitherPreflightV1;
  delete executionOptions.runTargetCompilePreflight;
  delete executionOptions.runTargetSlitherPreflight;
  if (!executionOptions.preflightBuild) {
    executionOptions.preflightBuild = async ({ projectRoot }) => targetCompileRunner(
      compilePreflightInput(request, projectRoot),
      { runCommand: delegateOptions.runCommand ?? runProcess },
    );
  }
  if (!executionOptions.preflightSlither && request.configuration?.analysis?.slither !== false && request.configuration?.analysis?.slither !== undefined) {
    executionOptions.preflightSlither = async ({ projectRoot, build }) => targetSlitherRunner({
      projectRoot,
      sourceCommit: request.source.commit,
      build,
    }, { runCommand: delegateOptions.runCommand ?? runProcess });
  }

  let result = await runGitHubNativeJobV1(request, {
    workspaceRoot: path.join(workspaceRoot, 'execution'),
    environment,
    ...executionOptions,
  });
  if (preflight) {
    result = {
      ...result,
      preflight: {
        ...preflight,
        targetCompile: result.preflight?.compile ?? { status: 'NOT_RUN', reason: 'BUILD_BOUNDARY_NOT_REACHED' },
        targetCompileRequired: true,
        targetCompilePassed: result.preflight?.compile ? result.preflight.compile.status === 'PREFLIGHT_PASS' : null,
        targetSlither: result.analysis?.slither?.preflight ?? { status: 'NOT_RUN', reason: 'SLITHER_ACTION_BOUNDARY_NOT_REACHED_OR_PASSED_WITHOUT_INLINE_RECEIPT' },
      },
    };
  }

  if (v26Request.phaseId === 'fork-simulation-lifecycle') {
    result = await enrichPhase7V26EvidenceV1({ request: v26Request, result, environment, fetchImpl: delegateOptions.fetchImpl ?? globalThis.fetch });
  } else {
    result = attachReproductionEvidenceV1(v26Request, result);
  }

  return attachExecutionDisposition({ request: v26Request, result, requestPath });
}

export const runGitHubNativeJob = runGitHubNativeJobV2;
