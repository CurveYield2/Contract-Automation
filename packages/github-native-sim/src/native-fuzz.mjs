import { V7ExecutionError, runProcess } from './execution.mjs';

const COMMIT = /^[0-9a-f]{40}$/;

function normalizedRaw(result = {}) {
  return {
    exitCode: Number.isInteger(result.exitCode) ? result.exitCode : -1,
    stdout: String(result.stdout ?? ''),
    stderr: String(result.stderr ?? ''),
    ...(result.signal ? { signal: result.signal } : {})
  };
}

function validateInput(input) {
  if (!input || typeof input !== 'object') throw new V7ExecutionError('NATIVE_FUZZ_CONFIGURATION_FAILURE', 'native fuzz input is required');
  if (!COMMIT.test(input.sourceCommit ?? '')) throw new V7ExecutionError('SOURCE_INTEGRITY_FAILURE', 'sourceCommit must be a 40-hex commit');
  if (typeof input.projectRoot !== 'string' || input.projectRoot.length === 0) throw new V7ExecutionError('NATIVE_FUZZ_CONFIGURATION_FAILURE', 'projectRoot is required');
  if (typeof input.rawArtifactRef !== 'string' || !input.rawArtifactRef.startsWith('github-actions://')) throw new V7ExecutionError('NATIVE_FUZZ_CONFIGURATION_FAILURE', 'rawArtifactRef must be a github-actions:// reference');
  if (typeof input.command !== 'string' || input.command.length === 0) throw new V7ExecutionError('NATIVE_FUZZ_CONFIGURATION_FAILURE', 'command is required');
  if (input.args !== undefined && !Array.isArray(input.args)) throw new V7ExecutionError('NATIVE_FUZZ_CONFIGURATION_FAILURE', 'args must be an array');
  if (input.recoverableExitCodes !== undefined && (!Array.isArray(input.recoverableExitCodes) || input.recoverableExitCodes.some((code) => !Number.isInteger(code)))) {
    throw new V7ExecutionError('NATIVE_FUZZ_CONFIGURATION_FAILURE', 'recoverableExitCodes must contain integers');
  }
}

function baseResult(input, fields) {
  return { backend: 'native-fuzz', sourceCommit: input.sourceCommit, rawArtifactRef: input.rawArtifactRef, ...fields };
}

export async function runNativeFuzzAnalysis(input, { runCommand = runProcess } = {}) {
  validateInput(input);
  const args = input.args ? [...input.args] : [];
  const result = await runCommand({ command: input.command, args, cwd: input.projectRoot });
  const rawOutput = normalizedRaw(result);

  if (rawOutput.exitCode === 0) return baseResult(input, { status:'completed', terminal:true, componentStatus:'COMPLETED', continuationDisposition:'COMPLETE_EVIDENCE', rawOutput });

  const recoverable = new Set(input.recoverableExitCodes ?? []);
  if (recoverable.has(rawOutput.exitCode)) return baseResult(input, { status:'completed_with_limitations', terminal:true, failureKind:'RECOVERABLE_LIMITATION', componentStatus:'COMPLETED_WITH_FAILURES', continuationDisposition:'CONTINUE_WITH_LIMITATION', rawOutput });

  return baseResult(input, { status:'failed', terminal:true, failureKind:'HARD_FAILURE', componentStatus:'FAILED', continuationDisposition:'STOP_EXECUTION', rawOutput });
}
