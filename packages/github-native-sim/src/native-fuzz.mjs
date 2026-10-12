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

export function inspectForgeTestEvidenceV1(command, rawOutput) {
  if (command !== 'forge') return {applicable:false};
  const output = String(rawOutput?.stdout??'')+'\n'+String(rawOutput?.stderr??'');
  const compilerFailure = /(?:Unable to resolve imports:|Error:\s*Compiler run failed|ParserError:|Compilation failed|Error \(6275\): Source)/i.test(output);
  const summaries = [...output.matchAll(/(?:Suite|Test) result:\s*(ok|FAILED)\.?\s*(\d+)\s+passed;\s*(\d+)\s+failed/gi)];
  const passed = summaries.reduce((n,m)=>n+Number(m[2]),0);
  const failed = summaries.reduce((n,m)=>n+Number(m[3]),0);
  const selectedTests = [...new Set([...output.matchAll(/\[(?:PASS|FAIL)\]\s+([A-Za-z_][A-Za-z_0-9]*)\s*\(/g)].map(m=>m[1]))];
  return {applicable:true,compilerFailure,passed,failed,selectedTests,
    successful:!compilerFailure&&summaries.length>0&&passed>0&&failed===0&&
      summaries.every(m=>m[1].toLowerCase()==='ok')&&
      !forgeReportsFailedTests(command,rawOutput)};
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

  const testExecution=inspectForgeTestEvidenceV1(input.command,rawOutput);
  if (forgeReportsFailedTests(input.command, rawOutput)||testExecution.applicable&&!testExecution.successful)
    return baseResult(input, { status:'failed', terminal:true, failureKind:testExecution.compilerFailure?'COMPILER_OUTPUT_FAILURE':'NO_SUCCESSFUL_TEST_EXECUTION', componentStatus:'FAILED', continuationDisposition:'STOP_EXECUTION', testExecution, rawOutput });
  if (rawOutput.exitCode === 0) return baseResult(input, { status:'completed', terminal:true, componentStatus:'COMPLETED', continuationDisposition:'COMPLETE_EVIDENCE', toolInvoked:true, ...(testExecution.applicable?{testExecution}:{}), rawOutput });

  const recoverable = new Set(input.recoverableExitCodes ?? []);
  if (recoverable.has(rawOutput.exitCode)) return baseResult(input, { status:'completed_with_limitations', terminal:true, failureKind:'RECOVERABLE_LIMITATION', componentStatus:'COMPLETED_WITH_FAILURES', continuationDisposition:'CONTINUE_WITH_LIMITATION', rawOutput });

  return baseResult(input, { status:'failed', terminal:true, failureKind:'HARD_FAILURE', componentStatus:'FAILED', continuationDisposition:'STOP_EXECUTION', rawOutput });
}
