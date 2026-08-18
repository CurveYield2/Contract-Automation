import path from 'node:path';
import { buildProject as defaultBuildProject } from '../../runner/src/build-dispatch.mjs';
import { runSlitherAnalysis } from './analysis.mjs';
import { checkoutExactSource, safeRepositoryProjectPath } from './execution.mjs';
import { validateDeepAssuranceRequestV2 } from './schema.mjs';

function nowIso(now = () => new Date()) { return now().toISOString(); }

function rawArtifactRef(component) {
  const repository = process.env.GITHUB_REPOSITORY ?? 'CurveYield/contract-automation';
  const runId = process.env.GITHUB_RUN_ID ?? 'recovery';
  return `github-actions://${repository}/runs/${runId}/artifacts/v7-execution/${component}`;
}

async function defaultCheckoutSource(source, { workspaceRoot, runCommand } = {}) {
  const checkoutRoot = path.join(workspaceRoot, 'checkout');
  const checkout = await checkoutExactSource({
    repository: source.repository,
    commit: source.commit,
    destination: checkoutRoot
  }, { ...(runCommand ? { runCommand } : {}) });
  return {
    checkoutRoot,
    projectRoot: safeRepositoryProjectPath(checkoutRoot, source.projectPath),
    commit: checkout.commit
  };
}

function failureResult(request, startedAt, error, partial = {}, now) {
  return {
    schemaVersion: 'deep-assurance-github-native-execution-v2',
    requestId: request.requestId,
    requestDigest: request.requestDigest,
    profileId: request.profileId,
    source: structuredClone(request.source),
    status: 'failed',
    build: partial.build,
    analysis: partial.analysis ?? {},
    analysisComponentFailureCount: partial.analysisComponentFailureCount ?? 0,
    failedStepCount: partial.failedStepCount ?? 0,
    failedSteps: partial.failedSteps ?? [],
    continuityDisposition: partial.continuityDisposition ?? 'COMPLETE_EVIDENCE',
    error: {
      name: error?.name ?? 'Error',
      message: error?.message ?? String(error),
      ...(error?.code ? { code: error.code } : {}),
      ...(error?.kind ? { kind: error.kind } : {})
    },
    startedAt,
    finishedAt: nowIso(now)
  };
}

function analysisFailureCount(analysis) {
  return Object.values(analysis).filter((component) => component && component.componentStatus && component.componentStatus !== 'COMPLETED').length;
}

export async function runGitHubNativeJob(input, {
  workspaceRoot = path.resolve('.deep-assurance-work'),
  checkoutSource = defaultCheckoutSource,
  buildProject = defaultBuildProject,
  runSlither,
  runCommand,
  now = () => new Date()
} = {}) {
  const request = validateDeepAssuranceRequestV2(input);
  const startedAt = nowIso(now);
  const analysis = {};
  let build;
  let checkout;

  try {
    checkout = await checkoutSource(request.source, { workspaceRoot, runCommand });
    if (!checkout || checkout.commit !== request.source.commit) {
      throw new Error(`Exact source checkout mismatch: expected ${request.source.commit}, got ${checkout?.commit ?? 'missing'}`);
    }
    build = await buildProject({
      projectRoot: checkout.projectRoot,
      request,
      ...(runCommand ? { runCommand } : {})
    });
  } catch (error) {
    return failureResult(request, startedAt, error, { build, analysis }, now);
  }

  if (request.profileId === 'github-native-simulate-v2') {
    return failureResult(request, startedAt, new Error('github-native-simulate-v2 execution is not restored yet'), { build, analysis }, now);
  }

  try {
    const slitherVersion = request.configuration.analysis?.slither?.version ?? '0.11.6';
    analysis.slither = runSlither
      ? await runSlither({ projectRoot: checkout.projectRoot, request, build })
      : await runSlitherAnalysis({
          projectRoot: checkout.projectRoot,
          version: slitherVersion,
          sourceCommit: request.source.commit,
          rawArtifactRef: rawArtifactRef('slither/raw.json')
        }, { ...(runCommand ? { runCommand } : {}) });
  } catch (error) {
    analysis.slither = {
      backend: 'slither',
      status: 'failed',
      terminal: true,
      componentStatus: 'FAILED',
      continuationDisposition: 'CONTINUE_WITH_LIMITATION',
      failureKind: error?.kind ?? 'ANALYSIS_COMPONENT_FAILURE',
      error: { name: error?.name ?? 'Error', message: error?.message ?? String(error) }
    };
  }

  const componentFailures = analysisFailureCount(analysis);
  return {
    schemaVersion: 'deep-assurance-github-native-execution-v2',
    requestId: request.requestId,
    requestDigest: request.requestDigest,
    profileId: request.profileId,
    source: structuredClone(request.source),
    status: 'completed',
    build,
    analysis,
    analysisComponentFailureCount: componentFailures,
    failedStepCount: 0,
    failedSteps: [],
    continuityDisposition: componentFailures > 0 ? 'CONTINUE_WITH_LIMITATION' : 'COMPLETE_EVIDENCE',
    startedAt,
    finishedAt: nowIso(now)
  };
}
