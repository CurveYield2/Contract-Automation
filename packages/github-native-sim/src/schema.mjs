export const V2_AUTOMATION_RELEASE = Object.freeze({
  repository: 'CurveYield/contract-automation',
  branch: 'orchestrator/round4-ci-base-v1',
  commit: 'ad11d7d5a623c1411cbabb4bb0cd9acf7975bce8',
  contractVersion: 'contract-automation-finalized-v1'
});

export const V2_RUNNER_RELEASE = Object.freeze({
  version: 'deep-assurance-github-bridge-v1',
  manifestSha256: 'd32cfca35524606a5c85e98fb3dec1bba58bff8a4bc73466ccef496ceab79734'
});

const TOP_LEVEL_FIELDS = new Set([
  'schemaVersion', 'processId', 'contractAutomationRelease', 'runnerRelease',
  'campaignId', 'assignmentId', 'phaseId', 'gateId', 'profileId', 'source',
  'configuration', 'requestId', 'requestDigest'
]);
const PROFILE_IDS = new Set(['github-native-compile-v2', 'github-native-simulate-v2']);

export class DeepAssuranceRequestValidationError extends Error {
  constructor(path, message) {
    super(`${path}: ${message}`);
    this.name = 'DeepAssuranceRequestValidationError';
    this.path = path;
  }
}

function fail(path, message) {
  throw new DeepAssuranceRequestValidationError(path, message);
}

function object(value, path) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) fail(path, 'must be an object');
  return value;
}

function string(value, path, { min = 1, max = 512, pattern } = {}) {
  if (typeof value !== 'string' || value.length < min || value.length > max) fail(path, `must be a string between ${min} and ${max} characters`);
  if (pattern && !pattern.test(value)) fail(path, 'has invalid format');
  return value;
}

function exactObject(value, expected, path) {
  object(value, path);
  const keys = Object.keys(value);
  const expectedKeys = Object.keys(expected);
  if (keys.length !== expectedKeys.length || keys.some((key) => !expectedKeys.includes(key))) fail(path, 'contains unexpected fields');
  for (const [key, expectedValue] of Object.entries(expected)) {
    if (value[key] !== expectedValue) fail(`${path}.${key}`, `must equal ${expectedValue}`);
  }
}

function validateSource(source) {
  object(source, 'source');
  const allowed = new Set(['repository', 'commit', 'projectPath']);
  for (const key of Object.keys(source)) if (!allowed.has(key)) fail(`source.${key}`, 'is not allowed');
  string(source.repository, 'source.repository', { max: 200, pattern: /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/ });
  string(source.commit, 'source.commit', { min: 40, max: 40, pattern: /^[0-9a-f]{40}$/ });
  const projectPath = string(source.projectPath, 'source.projectPath', { max: 512 });
  const normalized = projectPath.replaceAll('\\', '/');
  if (normalized.startsWith('/') || normalized === '..' || normalized.includes('../') || normalized.includes('/./')) fail('source.projectPath', 'must be a safe repository-relative path');
}

function validateConfiguration(configuration) {
  object(configuration, 'configuration');
  if ('compilers' in configuration && !Array.isArray(configuration.compilers)) fail('configuration.compilers', 'must be an array');
  if ('analysis' in configuration) object(configuration.analysis, 'configuration.analysis');
  if ('timeoutMinutes' in configuration) {
    const value = configuration.timeoutMinutes;
    if (!Number.isInteger(value) || value < 1 || value > 35) fail('configuration.timeoutMinutes', 'must be an integer from 1 to 35');
  }
}

export function validateDeepAssuranceRequestV2(input) {
  object(input, '$');
  for (const key of Object.keys(input)) if (!TOP_LEVEL_FIELDS.has(key)) fail(key, 'is not allowed');
  for (const key of TOP_LEVEL_FIELDS) if (!(key in input)) fail(key, 'is required');

  if (input.schemaVersion !== 'deep-assurance-github-request-v2') fail('schemaVersion', 'must equal deep-assurance-github-request-v2');
  if (input.processId !== 'deep-assurance-v6') fail('processId', 'must equal deep-assurance-v6');
  exactObject(input.contractAutomationRelease, V2_AUTOMATION_RELEASE, 'contractAutomationRelease');
  exactObject(input.runnerRelease, V2_RUNNER_RELEASE, 'runnerRelease');

  string(input.campaignId, 'campaignId', { max: 160 });
  string(input.assignmentId, 'assignmentId', { max: 200 });
  string(input.phaseId, 'phaseId', { max: 100 });
  string(input.gateId, 'gateId', { max: 160 });
  if (!PROFILE_IDS.has(input.profileId)) fail('profileId', 'must be github-native-compile-v2 or github-native-simulate-v2');
  validateSource(input.source);
  validateConfiguration(input.configuration);
  string(input.requestId, 'requestId', { min: 36, max: 36, pattern: /^dar-[0-9a-f]{32}$/ });
  string(input.requestDigest, 'requestDigest', { min: 64, max: 64, pattern: /^[0-9a-f]{64}$/ });

  return structuredClone(input);
}
