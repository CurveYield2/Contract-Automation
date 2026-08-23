import path from 'node:path';
import {
  checkoutExactSource,
  safeRepositoryProjectPath,
  stageExactArchiveSource,
} from './execution.mjs';
import { validateDeepAssuranceRequestV2 } from './schema.mjs';
import { runGitHubNativeJob as runGitHubNativeJobV1 } from './run-job-file.mjs';
import { runPhase6ExecutionPreflightV1 } from './phase6-execution-preflight-v1.mjs';
import { runPhase7ForkPreflightV1 } from './phase7-fork-preflight-v1.mjs';

async function stageForPreflight(source, { workspaceRoot, environment }) {
  const checkoutRoot = path.join(workspaceRoot, 'preflight-checkout');
  const checkout = await checkoutExactSource({ repository: source.repository, commit: source.commit, destination: checkoutRoot }, { environment });
  const staged = source.archivePath
    ? await stageExactArchiveSource({
        checkoutRoot,
        workspaceRoot: path.join(workspaceRoot, 'preflight-stage'),
        archivePath: source.archivePath,
        archiveSha256: source.archiveSha256,
        projectPath: source.projectPath,
      })
    : null;
  return { commit: checkout.commit, projectRoot: staged?.projectRoot ?? safeRepositoryProjectPath(checkoutRoot, source.projectPath) };
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

function phase6DelegateOptions(delegateOptions, preflight) {
  const options = { ...delegateOptions };
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
  ...delegateOptions
} = {}) {
  const request = validateDeepAssuranceRequestV2(input);
  let preflight = null;

  if (request.phaseId === 'build-and-test') {
    const staged = await stageForPreflight(request.source, { workspaceRoot, environment });
    if (staged.commit !== request.source.commit) throw new Error(`Phase 6 preflight source mismatch: expected ${request.source.commit}, received ${staged.commit}`);
    preflight = await runPhase6ExecutionPreflightV1({ request, projectRoot: staged.projectRoot, runnerCommit });
  } else if (request.phaseId === 'fork-simulation-lifecycle') {
    preflight = await runPhase7ForkPreflightV1({ request, environment });
  }

  if (preflight && preflight.status !== 'PASS') return preflightFailure(request, preflight);

  const delegated = request.phaseId === 'build-and-test' ? phase6DelegateOptions(delegateOptions, preflight) : delegateOptions;
  let result = await runGitHubNativeJobV1(request, {
    workspaceRoot: path.join(workspaceRoot, 'execution'), environment, ...delegated,
  });
  if (request.phaseId === 'build-and-test') result = normalizePhase6TerminalSemantics(result);
  return { ...result, preflight };
}

export const runGitHubNativeJob = runGitHubNativeJobV2;
