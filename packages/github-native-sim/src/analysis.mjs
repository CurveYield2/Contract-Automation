import { V7ExecutionError, runProcess } from './execution.mjs';

const EXACT_SLITHER_VERSION = '0.11.6';
const EXACT_MEDUSA_VERSION = '1.5.1';
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

function medusaResult(input, fields) {
  return {
    backend: 'medusa',
    version: EXACT_MEDUSA_VERSION,
    sourceCommit: input.sourceCommit,
    rawArtifactRef: input.rawArtifactRef,
    ...fields
  };
}

function objectOrEmpty(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? structuredClone(value) : {};
}

function parseSlitherOutput(output) {
  try {
    const parsed = JSON.parse(String(output ?? ''));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const detectors = Array.isArray(parsed?.results?.detectors) ? structuredClone(parsed.results.detectors) : [];
    return {
      success: parsed.success === true,
      detectors,
      findingCount: detectors.length
    };
  } catch {
    return null;
  }
}

export function parseMedusaOutput(output) {
  let parsed;
  try {
    parsed = JSON.parse(String(output ?? ''));
  } catch (error) {
    throw new V7ExecutionError('EVIDENCE_PARSE_FAILURE', 'Medusa terminal output is not valid JSON', { cause: error.message });
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new V7ExecutionError('EVIDENCE_PARSE_FAILURE', 'Medusa terminal output must be a JSON object');
  }
  const properties = Array.isArray(parsed.properties) ? structuredClone(parsed.properties) : [];
  const falsifiedProperties = properties.filter((property) => property && property.status === 'failed').length;
  return {
    status: typeof parsed.status === 'string' ? parsed.status : (falsifiedProperties > 0 ? 'falsified' : 'completed'),
    properties,
    falsifiedProperties,
    corpus: objectOrEmpty(parsed.corpus),
    coverage: objectOrEmpty(parsed.coverage),
    statistics: objectOrEmpty(parsed.statistics)
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

  const parsed = parseSlitherOutput(analysisResult.stdout);
  if (parsed?.success === true) {
    return slitherResult(input, {
      status: parsed.findingCount > 0 ? 'completed_with_findings' : 'completed',
      terminal: true,
      componentStatus: 'COMPLETED',
      continuationDisposition: 'COMPLETE_EVIDENCE',
      authoritativeFinding: false,
      findingCount: parsed.findingCount,
      detectors: parsed.detectors,
      rawOutput: raw(analysisResult)
    });
  }

  if (analysisResult.exitCode !== 0 || parsed?.success === false) {
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

export async function runMedusaAnalysis(input, { runCommand = runProcess } = {}) {
  validateCommon(input, EXACT_MEDUSA_VERSION);

  const versionResult = await runCommand({ command: 'medusa', args: ['--version'], cwd: input.projectRoot });
  if (!versionResult || versionResult.exitCode !== 0) {
    return medusaResult(input, {
      status: 'failed',
      terminal: true,
      failureKind: 'TOOL_FAILURE',
      componentStatus: 'FAILED',
      continuationDisposition: 'CONTINUE_WITH_LIMITATION',
      rawOutput: raw(versionResult)
    });
  }
  if (!versionMatches(versionResult, EXACT_MEDUSA_VERSION)) {
    throw new V7ExecutionError('TOOLCHAIN_INTEGRITY_FAILURE', 'Medusa version does not match the recovered V7 pin', {
      expectedVersion: EXACT_MEDUSA_VERSION,
      stdout: String(versionResult.stdout ?? ''),
      stderr: String(versionResult.stderr ?? '')
    });
  }

  const campaignResult = await runCommand({ command: 'medusa', args: ['fuzz'], cwd: input.projectRoot });
  if (!campaignResult || campaignResult.exitCode < 0) {
    return medusaResult(input, {
      status: 'failed',
      terminal: true,
      failureKind: 'TOOL_FAILURE',
      componentStatus: 'FAILED',
      continuationDisposition: 'CONTINUE_WITH_LIMITATION',
      rawOutput: raw(campaignResult)
    });
  }

  const campaign = parseMedusaOutput(campaignResult.stdout);
  const falsified = campaign.falsifiedProperties > 0 || campaign.status === 'falsified';
  if (falsified || campaignResult.exitCode !== 0) {
    return medusaResult(input, {
      status: 'completed_with_failures',
      terminal: true,
      failureKind: falsified ? 'PROPERTY_FALSIFICATION' : 'ANALYSIS_COMPONENT_FAILURE',
      componentStatus: 'COMPLETED_WITH_FAILURES',
      continuationDisposition: 'CONTINUE_WITH_LIMITATION',
      campaign,
      rawOutput: raw(campaignResult)
    });
  }

  return medusaResult(input, {
    status: 'completed',
    terminal: true,
    componentStatus: 'COMPLETED',
    continuationDisposition: 'COMPLETE_EVIDENCE',
    campaign,
    rawOutput: raw(campaignResult)
  });
}
