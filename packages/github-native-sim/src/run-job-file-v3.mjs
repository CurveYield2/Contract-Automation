import { runGitHubNativeJob as runGitHubNativeJobBase } from './run-job-file.mjs';
import { runMedusaAnalysis } from './analysis.mjs';
import { runNativeFuzzAnalysis } from './native-fuzz.mjs';

function rawArtifactRef(component) {
  const repository = process.env.GITHUB_REPOSITORY ?? 'CurveYield2/Contract-Automation';
  const runId = process.env.GITHUB_RUN_ID ?? 'recovery';
  return `github-actions://${repository}/runs/${runId}/artifacts/v7-execution/${component}`;
}

function medusaRunner({ analysisProjectRoot, suppliedRunner, runCommand }) {
  if (!analysisProjectRoot) return suppliedRunner;
  return async ({ request, build }) => {
    if (suppliedRunner) return suppliedRunner({ projectRoot: analysisProjectRoot, request, build });
    const version = request.configuration.analysis?.medusa?.version ?? '1.5.1';
    return runMedusaAnalysis({
      projectRoot: analysisProjectRoot,
      version,
      sourceCommit: request.source.commit,
      rawArtifactRef: rawArtifactRef('medusa/raw.json'),
    }, { ...(runCommand ? { runCommand } : {}) });
  };
}

function nativeFuzzRunner({ analysisProjectRoot, suppliedRunner, runCommand }) {
  if (!analysisProjectRoot) return suppliedRunner;
  return async ({ request, build }) => {
    if (suppliedRunner) return suppliedRunner({ projectRoot: analysisProjectRoot, request, build });
    const native = request.configuration.analysis?.nativeFuzz ?? {};
    return runNativeFuzzAnalysis({
      projectRoot: analysisProjectRoot,
      sourceCommit: request.source.commit,
      rawArtifactRef: rawArtifactRef('native-fuzz/raw.txt'),
      command: 'forge',
      args: ['test', '--fuzz-runs', String(native.fuzzRuns ?? 256)],
      recoverableExitCodes: native.recoverableExitCodes ?? [],
    }, { ...(runCommand ? { runCommand } : {}) });
  };
}

export async function runGitHubNativeJobV3(input, options = {}) {
  const {
    analysisProjectRoot = null,
    runMedusa: suppliedMedusa,
    runNativeFuzz: suppliedNativeFuzz,
    runCommand,
    ...rest
  } = options;

  const runMedusa = medusaRunner({ analysisProjectRoot, suppliedRunner: suppliedMedusa, runCommand });
  const runNativeFuzz = nativeFuzzRunner({ analysisProjectRoot, suppliedRunner: suppliedNativeFuzz, runCommand });

  return runGitHubNativeJobBase(input, {
    ...rest,
    ...(runCommand ? { runCommand } : {}),
    ...(runMedusa ? { runMedusa } : {}),
    ...(runNativeFuzz ? { runNativeFuzz } : {}),
  });
}

export const runGitHubNativeJob = runGitHubNativeJobV3;
