import { runGitHubNativeJob as runGitHubNativeJobBase } from './run-job-file.mjs';
import { runMedusaAnalysis } from './analysis.mjs';
import { runNativeFuzzAnalysis } from './native-fuzz.mjs';
import { runProcess } from './execution.mjs';

const SAFE_ANALYZER_ENV_KEYS = Object.freeze([
  'PATH', 'HOME', 'USER', 'LOGNAME', 'TMPDIR', 'TMP', 'TEMP', 'LANG', 'LC_ALL',
  'CI', 'NO_COLOR', 'TERM', 'XDG_CACHE_HOME',
]);

function rawArtifactRef(component) {
  const repository = process.env.GITHUB_REPOSITORY ?? 'CurveYield2/Contract-Automation';
  const runId = process.env.GITHUB_RUN_ID ?? 'recovery';
  return `github-actions://${repository}/runs/${runId}/artifacts/v7-execution/${component}`;
}

function safeAnalyzerEnvironment(environment = process.env) {
  const sanitized = {};
  for (const key of SAFE_ANALYZER_ENV_KEYS) {
    if (typeof environment?.[key] === 'string') sanitized[key] = environment[key];
  }
  return sanitized;
}

function analyzerRunCommand(environment) {
  const env = safeAnalyzerEnvironment(environment);
  return (call) => runProcess({ ...call, env });
}

function medusaRunner({ analysisProjectRoot, suppliedRunner, runCommand, environment }) {
  if (!analysisProjectRoot) return suppliedRunner;
  return async ({ request, build }) => {
    if (suppliedRunner) return suppliedRunner({ projectRoot: analysisProjectRoot, request, build });
    const version = request.configuration.analysis?.medusa?.version ?? '1.5.1';
    return runMedusaAnalysis({
      projectRoot: analysisProjectRoot,
      version,
      sourceCommit: request.source.commit,
      rawArtifactRef: rawArtifactRef('medusa/raw.txt'),
    }, { runCommand: runCommand ?? analyzerRunCommand(environment) });
  };
}

function nativeFuzzRunner({ analysisProjectRoot, suppliedRunner, runCommand, environment }) {
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
    }, { runCommand: runCommand ?? analyzerRunCommand(environment) });
  };
}

export async function runGitHubNativeJobV3(input, options = {}) {
  const {
    analysisProjectRoot = null,
    runMedusa: suppliedMedusa,
    runNativeFuzz: suppliedNativeFuzz,
    runCommand,
    environment = process.env,
    ...rest
  } = options;

  const runMedusa = medusaRunner({ analysisProjectRoot, suppliedRunner: suppliedMedusa, runCommand, environment });
  const runNativeFuzz = nativeFuzzRunner({ analysisProjectRoot, suppliedRunner: suppliedNativeFuzz, runCommand, environment });

  return runGitHubNativeJobBase(input, {
    ...rest,
    environment,
    ...(runCommand ? { runCommand } : {}),
    ...(runMedusa ? { runMedusa } : {}),
    ...(runNativeFuzz ? { runNativeFuzz } : {}),
  });
}

export { safeAnalyzerEnvironment };
export const runGitHubNativeJob = runGitHubNativeJobV3;
