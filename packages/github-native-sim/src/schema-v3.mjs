import { validateDeepAssuranceRequestV2 as validateBaseV2 } from './schema.mjs';

const HEX64 = /^[0-9a-f]{64}$/;
const COMPONENTS = new Set(['medusa', 'nativeFuzz']);
const HARNESS_KEYS = new Set(['mode', 'path', 'treeSha256', 'components', 'productionSourceMutation']);

function fail(path, message) {
  const error = new Error(`${path}: ${message}`);
  error.name = 'DeepAssuranceRequestValidationError';
  error.path = path;
  throw error;
}

function safeRelativePath(value, pathLabel) {
  if (typeof value !== 'string' || value.length < 1 || value.length > 512) fail(pathLabel, 'must be a string between 1 and 512 characters');
  const normalized = value.replaceAll('\\', '/');
  if (normalized.startsWith('/') || /^[A-Za-z]:\//.test(normalized) || normalized === '..' || normalized.split('/').some((part) => part === '..' || part === '.' || part === '')) {
    fail(pathLabel, 'must be a safe repository-relative path');
  }
  return normalized;
}

export function validateAuditorHarnessBindingV1(harness) {
  if (!harness || typeof harness !== 'object' || Array.isArray(harness)) fail('configuration.harness', 'must be an object');
  for (const key of Object.keys(harness)) if (!HARNESS_KEYS.has(key)) fail(`configuration.harness.${key}`, 'is not allowed');
  for (const key of HARNESS_KEYS) if (!(key in harness)) fail(`configuration.harness.${key}`, 'is required');
  if (harness.mode !== 'auditor-generated') fail('configuration.harness.mode', 'must equal auditor-generated');
  safeRelativePath(harness.path, 'configuration.harness.path');
  if (typeof harness.treeSha256 !== 'string' || !HEX64.test(harness.treeSha256)) fail('configuration.harness.treeSha256', 'must be a 64-character lowercase hexadecimal SHA-256 digest');
  if (!Array.isArray(harness.components) || harness.components.length === 0) fail('configuration.harness.components', 'must be a non-empty array');
  if (new Set(harness.components).size !== harness.components.length) fail('configuration.harness.components', 'must not contain duplicates');
  for (const component of harness.components) if (!COMPONENTS.has(component)) fail('configuration.harness.components', 'may contain only medusa and nativeFuzz');
  if (harness.productionSourceMutation !== false) fail('configuration.harness.productionSourceMutation', 'must equal false');
  return structuredClone(harness);
}

export function validateDeepAssuranceRequestV3(input) {
  const validated = validateBaseV2(input);
  const harness = validated.configuration?.harness;
  if (harness?.mode === 'auditor-generated') validateAuditorHarnessBindingV1(harness);
  return validated;
}

export const validateDeepAssuranceRequestV2 = validateDeepAssuranceRequestV3;
