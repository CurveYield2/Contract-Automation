import { V7ExecutionError, runProcess } from './execution.mjs';

const COMMIT = /^[0-9a-f]{40}$/;

function redact(value, secrets = []) {
  let text = String(value ?? '');
  for (const secret of secrets) {
    if (typeof secret === 'string' && secret.length > 0) text = text.replaceAll(secret, '<redacted-mutable-anvil-rpc>');
  }
  return text;
}

function normalizedRaw(result = {}, secrets = []) {
  return {
    exitCode: Number.isInteger(result.exitCode) ? result.exitCode : -1,
    stdout: redact(result.stdout, secrets),
    stderr: redact(result.stderr, secrets),
    ...(result.signal ? { signal: result.signal } : {})
  };
}

function forgeReportsFailedTests(command, rawOutput) {
  if (command !== 'forge') return false;
  const output = `${rawOutput.stdout}\n${rawOutput.stderr}`;
  return /Suite result:\s*FAILED\b/.test(output)
    || /Encountered a total of [1-9][0-9]* failing tests\b/.test(output);
}

function validateInput(input) {
  if (!input || typeof input !== 'object') throw new V7ExecutionError('NATIVE_FUZZ_CONFIGURATION_FAILURE', 'native fuzz input is required');
  if (!COMMIT.test(input.sourceCommit ?? '')) throw new V7ExecutionError('SOURCE_INTEGRITY_FAILURE', 'sourceCommit must be a 40-hex commit');
  if (typeof input.projectRoot !== 'string' || input.projectRoot.length === 0) throw new V7ExecutionError('NATIVE_FUZZ_CONFIGURATION_FAILURE', 'projectRoot is required');
  if (typeof input.rawArtifactRef !== 'string' || !input.rawArtifactRef.startsWith('github-actions://')) throw new V7ExecutionError('NATIVE_FUZZ_CONFIGURATION_FAILURE', 'rawArtifactRef must be a github-actions:// reference');
  if (typeof input.command !== 'string' || input.command.length === 0) throw new V7ExecutionError('NATIVE_FUZZ_CONFIGURATION_FAILURE', 'command is required');
  if (input.args !== undefined && !Array.isArray(input.args)) throw new V7ExecutionError('NATIVE_FUZZ_CONFIGURATION_FAILURE', 'args must be an array');
  if (input.env !== undefined && (!input.env || typeof input.env !== 'object' || Array.isArray(input.env))) throw new V7ExecutionError('NATIVE_FUZZ_CONFIGURATION_FAILURE', 'env must be an object');
  if (input.redactValues !== undefined && !Array.isArray(input.redactValues)) throw new V7ExecutionError('NATIVE_FUZZ_CONFIGURATION_FAILURE', 'redactValues must be an array');
  if (input.recoverableExitCodes !== undefined && (!Array.isArray(input.recoverableExitCodes) || input.recoverableExitCodes.some((code) => !Number.isInteger(code)))) {
    throw new V7ExecutionError('NATIVE_FUZZ_CONFIGURATION_FAILURE', 'recoverableExitCodes must contain integers');
  }
}

function baseResult(input, fields) {
  return {
    backend: 'native-fuzz',
    sourceCommit: input.sourceCommit,
    rawArtifactRef: input.rawArtifactRef,
    ...(input.forkEvidence ? { fork: structuredClone(input.forkEvidence) } : {}),
    ...fields,
  };
}

export async function runNativeFuzzAnalysis(input, { runCommand = runProcess } = {}) {
  validateInput(input);
  const args = input.args ? [...input.args] : [];
  const secrets = input.redactValues ?? [];
  const result = await runCommand({ command: input.command, args, cwd: input.projectRoot, ...(input.env ? { env: input.env } : {}) });
  const rawOutput = normalizedRaw(result, secrets);

  if (forgeReportsFailedTests(input.command, rawOutput)) return baseResult(input, { status:'failed', terminal:true, failureKind:'HARD_FAILURE', componentStatus:'FAILED', continuationDisposition:'STOP_EXECUTION', rawOutput });
  if (rawOutput.exitCode === 0) return baseResult(input, { status:'completed', terminal:true, componentStatus:'COMPLETED', continuationDisposition:'COMPLETE_EVIDENCE', rawOutput });

  const recoverable = new Set(input.recoverableExitCodes ?? []);
  if (recoverable.has(rawOutput.exitCode)) return baseResult(input, { status:'completed_with_limitations', terminal:true, failureKind:'RECOVERABLE_LIMITATION', componentStatus:'COMPLETED_WITH_FAILURES', continuationDisposition:'CONTINUE_WITH_LIMITATION', rawOutput });

  return baseResult(input, { status:'failed', terminal:true, failureKind:'HARD_FAILURE', componentStatus:'FAILED', continuationDisposition:'STOP_EXECUTION', rawOutput });
}
