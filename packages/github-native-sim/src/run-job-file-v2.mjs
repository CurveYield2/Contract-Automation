import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  checkoutExactSource,
  safeRepositoryProjectPath,
  stageExactArchiveSource,
} from './execution.mjs';
import { materializePhase6HarnessOverlayV1 } from './phase6-harness-overlay-v1.mjs';
import { validateDeepAssuranceRequestV2 } from './schema.mjs';
import { runGitHubNativeJob as runGitHubNativeJobV1 } from './run-job-file.mjs';
import { runPhase6ExecutionPreflightV1 } from './phase6-execution-preflight-v1.mjs';
import { phase6MutableRpcRuntime } from './phase6-mutable-rpc-v1.mjs';
import { runPhase7ForkPreflightV2 } from './phase7-fork-preflight-v2.mjs';

const DEFAULT_RUNNER_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const PHASE6_OVERLAY_KIND = 'runner-owned-audit-overlay-v1';

function requestedPhase6Bundle(request) {
  const harness = request?.configuration?.harness;
  if (!harness || harness.kind !== PHASE6_OVERLAY_KIND) return null;
  if (typeof harness.bundleId !== 'string' || harness.bundleId.length === 0) throw new Error('Phase 6 audit overlay requires configuration.harness.bundleId');
  return harness.bundleId;
}

async function stagePhase6Request(request, { workspaceRoot, environment, runnerRoot }) {
  const checkoutRoot = path.join(workspaceRoot, 'checkout');
  const checkout = await checkoutExactSource({ repository: request.source.repository, commit: request.source.commit, destination: checkoutRoot }, { environment });
  const staged = request.source.archivePath
    ? await stageExactArchiveSource({
        checkoutRoot,
        workspaceRoot,
        archivePath: request.source.archivePath,
        archiveSha256: request.source.archiveSha256,
        projectPath: request.source.projectPath,
      })
    : null;
  const projectRoot = staged?.projectRoot ?? safeRepositoryProjectPath(checkoutRoot, request.source.projectPath);
  const bundleId = requestedPhase6Bundle(request);
  const harnessOverlay = bundleId
    ? await materializePhase6HarnessOverlayV1({ projectRoot, runnerRoot, bundleId, source: request.source })
    : null;
  return {
    checkoutRoot,
    projectRoot,
    commit: checkout.commit,
    harnessOverlay,
    ...(staged ? { archivePath: staged.archivePath, archiveSha256: staged.archiveSha256, archiveExtractedBytes: staged.extractedBytes, archiveEntryCount: staged.entryCount } : {})
  };
}

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

function phase6DelegateOptions(delegateOptions, preflight, environment) {
  const options = { ...delegateOptions };
  if (preflight?.mutableRpc?.status === 'PASS') {
    options.phase6MutableRpc = phase6MutableRpcRuntime({ environment, preflight });
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
  ...delegateOptions
} = {}) {
  const request = validateDeepAssuranceRequestV2(input);
  let preflight = null;
  let preflightOverlay = null;

  if (request.phaseId === 'build-and-test') {
    const staged = await stagePhase6Request(request, { workspaceRoot: path.join(workspaceRoot, 'preflight'), environment, runnerRoot });
    if (staged.commit !== request.source.commit) throw new Error(`Phase 6 preflight source mismatch: expected ${request.source.commit}, received ${staged.commit}`);
    preflightOverlay = staged.harnessOverlay;
    preflight = await runPhase6ExecutionPreflightV1({ request, projectRoot: staged.projectRoot, runnerCommit, environment });
    preflight = { ...preflight, harnessOverlay: preflightOverlay };
  } else if (request.phaseId === 'fork-simulation-lifecycle') {
    preflight = await runPhase7ForkPreflightV2({ request, environment });
  }

  if (preflight && preflight.status !== 'PASS') return preflightFailure(request, preflight);

  let executionOverlay = null;
  const phase6CheckoutSource = request.phaseId === 'build-and-test'
    ? async (_source, options = {}) => {
        const staged = await stagePhase6Request(request, {
          workspaceRoot: options.workspaceRoot,
          environment: options.environment ?? environment,
          runnerRoot,
        });
        executionOverlay = staged.harnessOverlay;
        if ((preflightOverlay?.overlayDigestSha256 ?? null) !== (executionOverlay?.overlayDigestSha256 ?? null)) {
          const error = new Error('Phase 6 harness overlay drifted between preflight and execution');
          error.kind = 'HARNESS_OVERLAY_INTEGRITY_FAILURE';
          throw error;
        }
        return staged;
      }
    : delegateOptions.checkoutSource;

  const delegated = request.phaseId === 'build-and-test' ? phase6DelegateOptions(delegateOptions, preflight, environment) : delegateOptions;
  if (phase6CheckoutSource) delegated.checkoutSource = phase6CheckoutSource;
  let result = await runGitHubNativeJobV1(request, {
    workspaceRoot: path.join(workspaceRoot, 'execution'), environment, ...delegated,
  });
  if (request.phaseId === 'build-and-test') {
    result = normalizePhase6TerminalSemantics(result);
    if (result && typeof result === 'object') {
      result.preflight = {
        ...preflight,
        executionHarnessOverlayDigestSha256: executionOverlay?.overlayDigestSha256 ?? null,
        executionHarnessOverlayVerified: (preflightOverlay?.overlayDigestSha256 ?? null) === (executionOverlay?.overlayDigestSha256 ?? null),
      };
    }
  }
  return request.phaseId === 'build-and-test' ? result : { ...result, preflight };
}

export const runGitHubNativeJob = runGitHubNativeJobV2;
