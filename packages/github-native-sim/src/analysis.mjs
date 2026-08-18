import { V7ExecutionError, runProcess } from './execution.mjs';

const EXACT_SLITHER_VERSION = '0.11.6';
const COMMIT = /^[0-9a-f]{40}$/;

function raw(result = {}) {
  return {
    exitCode: Number.isInteger(result.exitCode) ? result.exitCode : -1,
    stdout: String(result.stdout ?? ''),
    stderr: String(result.stderr ?? ''),
    ...(result.signal ? { signal: result.signal } : {})
  };
}

function validateCommon(input, expectedVersion) {
  if (!input || typeof input !== 'object') throw new V7ExecutionError('ANALYSIS_CONFIGURATION_FAILURE', 'analysis input is required');
  if (input.version !== expectedVersion) {
    throw new V7ExecutionError('TOOLCHAIN_INTEGRITY_FAILURE', `requested tool version must equal ${expectedVersion}`, {
      expectedVersion,
      requestedVersion: input.version ?? null
    });
  }
  if (!COMMIT.test(input.sourceCommit ?? '')) throw new V7ExecutionError('SOURCE_INTEGRITY_FAILURE', 'sourceCommit must be a 40-hex commit');
  if (typeof input.projectRoot !== 'string' || input.projectRoot.length === 0) throw new V7ExecutionError('ANALYSIS_CONFIGURATION_FAILURE', 'projectRoot is required');
  if (typeof input.rawArtifactRef !== 'string' || !input.rawArtifactRef.startsWith('github-actions://')) {
    throw new V7ExecutionError('ANALYSIS_CONFIGURATION_FAILURE', 'rawArtifactRef must be a github-actions:// reference');
  }
}

function versionMatches(output, expected) {
  const text = `${output?.stdout ?? ''}\n${output?.stderr ?? ''}`;
  const escaped = expected.replaceAll('.', '\\.');
  return new RegExp(`(?:^|\\s)${escaped}(?:\\s|$)`).test(text.trim());
}

function slitherResult(input, fields) {
  return {
    backend: 'slither',
    version: EXACT_SLITHER_VERSION,
    sourceCommit: input.sourceCommit,
    rawArtifactRef: input.rawArtifactRef,
    ...fields
  };
}

export async function runSlitherAnalysis(input, { runCommand = runProcess } = {}) {
  validateCommon(input, EXACT_SLITHER_VERSION);

  const versionResult = await runCommand({ command: 'slither', args: ['--version'], cwd: input.projectRoot });
  if (!versionResult || versionResult.exitCode !== 0) {
    return slitherResult(input, {
      status: 'failed',
      terminal: true,
      failureKind: 'TOOL_FAILURE',
      componentStatus: 'FAILED',
      continuationDisposition: 'CONTINUE_WITH_LIMITATION',
      rawOutput: raw(versionResult)
    });
  }
  if (!versionMatches(versionResult, EXACT_SLITHER_VERSION)) {
    throw new V7ExecutionError('TOOLCHAIN_INTEGRITY_FAILURE', 'Slither version does not match the recovered V7 pin', {
      expectedVersion: EXACT_SLITHER_VERSION,
      stdout: String(versionResult.stdout ?? ''),
      stderr: String(versionResult.stderr ?? '')
    });
  }

  const analysisResult = await runCommand({ command: 'slither', args: ['.', '--json', '-'], cwd: input.projectRoot });
  if (!analysisResult || analysisResult.exitCode < 0) {
    return slitherResult(input, {
      status: 'failed',
      terminal: true,
      failureKind: 'TOOL_FAILURE',
      componentStatus: 'FAILED',
      continuationDisposition: 'CONTINUE_WITH_LIMITATION',
      rawOutput: raw(analysisResult)
    });
  }
  if (analysisResult.exitCode !== 0) {
    return slitherResult(input, {
      status: 'completed_with_failures',
      terminal: true,
      failureKind: 'ANALYSIS_COMPONENT_FAILURE',
      componentStatus: 'COMPLETED_WITH_FAILURES',
      continuationDisposition: 'CONTINUE_WITH_LIMITATION',
      rawOutput: raw(analysisResult)
    });
  }

  return slitherResult(input, {
    status: 'completed',
    terminal: true,
    componentStatus: 'COMPLETED',
    continuationDisposition: 'COMPLETE_EVIDENCE',
    rawOutput: raw(analysisResult)
  });
}
