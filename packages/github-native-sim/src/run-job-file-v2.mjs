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
  const checkout = await checkoutExactSource({
    repository: source.repository,
    commit: source.commit,
    destination: checkoutRoot,
  }, { environment });
  const staged = source.archivePath
    ? await stageExactArchiveSource({
        checkoutRoot,
        workspaceRoot: path.join(workspaceRoot, 'preflight-stage'),
        archivePath: source.archivePath,
        archiveSha256: source.archiveSha256,
        projectPath: source.projectPath,
      })
    : null;
  return {
    commit: checkout.commit,
    projectRoot: staged?.projectRoot ?? safeRepositoryProjectPath(checkoutRoot, source.projectPath),
  };
}

function preflightFailure(request, preflight) {
  return {
    schemaVersion: 'deep-assurance-github-native-execution-v2',
    requestId: request.requestId,
    requestDigest: request.requestDigest,
    profileId: request.profileId,
    source: structuredClone(request.source),
    status: 'failed',
    preflight,
    build: null,
    deploymentGasEvidence: null,
    analysis: {},
    simulation: null,
    analysisComponentFailureCount: 0,
    failedStepCount: 0,
    failedSteps: [],
    continuityDisposition: 'RUNNER_REPAIR_REBIND_REQUIRED',
    error: {
      name: 'V7ExecutionPreflightFailure',
      message: `${request.phaseId} preflight did not pass`,
      kind: 'EXECUTION_PREFLIGHT_FAILURE',
    },
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
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
    if (staged.commit !== request.source.commit) {
      throw new Error(`Phase 6 preflight source mismatch: expected ${request.source.commit}, received ${staged.commit}`);
    }
    preflight = await runPhase6ExecutionPreflightV1({
      request,
      projectRoot: staged.projectRoot,
      runnerCommit,
    });
  } else if (request.phaseId === 'fork-simulation-lifecycle') {
    preflight = await runPhase7ForkPreflightV1({ request, environment });
  }

  if (preflight && preflight.status !== 'PASS') return preflightFailure(request, preflight);

  const result = await runGitHubNativeJobV1(request, {
    workspaceRoot: path.join(workspaceRoot, 'execution'),
    environment,
    ...delegateOptions,
  });
  return {
    ...result,
    preflight,
  };
}

export const runGitHubNativeJob = runGitHubNativeJobV2;
