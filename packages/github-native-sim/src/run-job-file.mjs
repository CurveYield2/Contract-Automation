import path from 'node:path';
import { buildProject as defaultBuildProject } from '../../runner/src/build-dispatch.mjs';
import { runMedusaAnalysis, runSlitherAnalysis } from './analysis.mjs';
import { checkoutExactSource, safeRepositoryProjectPath } from './execution.mjs';
import { runNativeFuzzAnalysis } from './native-fuzz.mjs';
import { validateDeepAssuranceRequestV2 } from './schema.mjs';
import { runStage2aAnalysis } from './stage2a-toolchain.mjs';

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

function hasHardStop(analysis) {
  return Object.values(analysis).some((component) => component?.continuationDisposition === 'STOP_EXECUTION');
}

async function executeSlither({ request, checkout, build, runSlither, runCommand }) {
  if (runSlither) return runSlither({ projectRoot: checkout.projectRoot, request, build });
  const slitherVersion = request.configuration.analysis?.slither?.version ?? '0.11.6';
  return runSlitherAnalysis({
    projectRoot: checkout.projectRoot,
    version: slitherVersion,
    sourceCommit: request.source.commit,
    rawArtifactRef: rawArtifactRef('slither/raw.json')
  }, { ...(runCommand ? { runCommand } : {}) });
}

async function executeMedusa({ request, checkout, build, runMedusa, runCommand }) {
  if (runMedusa) return runMedusa({ projectRoot: checkout.projectRoot, request, build });
  const medusaVersion = request.configuration.analysis?.medusa?.version ?? '1.5.1';
  return runMedusaAnalysis({
    projectRoot: checkout.projectRoot,
    version: medusaVersion,
    sourceCommit: request.source.commit,
    rawArtifactRef: rawArtifactRef('medusa/raw.json')
  }, { ...(runCommand ? { runCommand } : {}) });
}

async function executeNativeFuzz({ request, checkout, build, runNativeFuzz, runCommand }) {
  if (runNativeFuzz) return runNativeFuzz({ projectRoot: checkout.projectRoot, request, build });
  const native = request.configuration.analysis?.nativeFuzz ?? {};
  return runNativeFuzzAnalysis({
    projectRoot: checkout.projectRoot,
    sourceCommit: request.source.commit,
    rawArtifactRef: rawArtifactRef('native-fuzz/raw.txt'),
    command: native.command ?? 'forge',
    args: native.args ?? ['test'],
    recoverableExitCodes: native.recoverableExitCodes ?? []
  }, { ...(runCommand ? { runCommand } : {}) });
}

export async function runGitHubNativeJob(input, {
  workspaceRoot = path.resolve('.deep-assurance-work'),
  checkoutSource = defaultCheckoutSource,
  buildProject = defaultBuildProject,
  runSlither,
  runMedusa,
  runNativeFuzz,
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

  if (request.profileId === 'github-native-compile-v2') {
    try {
      analysis.slither = await executeSlither({ request, checkout, build, runSlither, runCommand });
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
  } else {
    const requestedAnalysis = request.configuration.analysis ?? {};
    const stage2aConfig = {
      slither: requestedAnalysis.slither !== false,
      medusa: requestedAnalysis.medusa !== false,
      nativeFuzz: requestedAnalysis.nativeFuzz?.enabled === true
    };
    try {
      await runStage2aAnalysis(stage2aConfig, {
        runSlither: async () => {
          analysis.slither = await executeSlither({ request, checkout, build, runSlither, runCommand });
          return analysis.slither;
        },
        runMedusa: async () => {
          analysis.medusa = await executeMedusa({ request, checkout, build, runMedusa, runCommand });
          return analysis.medusa;
        },
        runNativeFuzz: async () => {
          analysis.nativeFuzz = await executeNativeFuzz({ request, checkout, build, runNativeFuzz, runCommand });
          return analysis.nativeFuzz;
        }
      });
    } catch (error) {
      const componentFailures = analysisFailureCount(analysis);
      return failureResult(request, startedAt, error, {
        build,
        analysis,
        analysisComponentFailureCount: componentFailures,
        continuityDisposition: componentFailures > 0 ? 'CONTINUE_WITH_LIMITATION' : 'COMPLETE_EVIDENCE'
      }, now);
    }
  }

  const componentFailures = analysisFailureCount(analysis);
  const hardStop = hasHardStop(analysis);
  return {
    schemaVersion: 'deep-assurance-github-native-execution-v2',
    requestId: request.requestId,
    requestDigest: request.requestDigest,
    profileId: request.profileId,
    source: structuredClone(request.source),
    status: hardStop ? 'failed' : 'completed',
    build,
    analysis,
    analysisComponentFailureCount: componentFailures,
    failedStepCount: 0,
    failedSteps: [],
    continuityDisposition: hardStop ? 'STOP_EXECUTION' : componentFailures > 0 ? 'CONTINUE_WITH_LIMITATION' : 'COMPLETE_EVIDENCE',
    startedAt,
    finishedAt: nowIso(now)
  };
}
