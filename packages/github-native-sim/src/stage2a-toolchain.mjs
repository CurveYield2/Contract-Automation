const SHA256 = /^[0-9a-f]{64}$/;
const TERMINAL_MEDUSA = new Set(['failed', 'disabled', 'passed', 'completed', 'not_applicable']);

function fail(path, message) { throw new Error(`${path}: ${message}`); }
function obj(value, path) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) fail(path, 'must be an object');
  return value;
}
function hash(value, path) {
  if (typeof value !== 'string' || !SHA256.test(value)) fail(path, 'must be a 64-hex SHA-256');
}

export function validateStage2aToolchainEvidence(input, { solidityVersion } = {}) {
  obj(input, '$');
  if (input.schemaVersion !== 'deep-assurance-stage2a-toolchain/v1') fail('schemaVersion', 'must equal deep-assurance-stage2a-toolchain/v1');
  if (input.status !== 'completed') fail('status', 'must equal completed');
  if (!Array.isArray(input.componentFailures)) fail('componentFailures', 'must be an array');
  obj(input.medusaCompiler, 'medusaCompiler');
  if (input.medusaCompiler.provider !== 'slither-analyzer@0.11.6') fail('medusaCompiler.provider', 'must equal slither-analyzer@0.11.6');
  hash(input.medusaCompiler.pipReportSha256, 'medusaCompiler.pipReportSha256');
  hash(input.medusaCompiler.executableSha256, 'medusaCompiler.executableSha256');
  obj(input.solcSelection, 'solcSelection');
  if (solidityVersion && input.solcSelection.version !== solidityVersion) fail('solcSelection.version', `must equal ${solidityVersion}`);
  hash(input.solcSelection.executableSha256, 'solcSelection.executableSha256');
  obj(input.medusa, 'medusa');
  if (input.medusa.version !== '1.5.1') fail('medusa.version', 'must equal 1.5.1');
  if (input.medusa.compilerToolchainReady !== true) fail('medusa.compilerToolchainReady', 'must be true');
  hash(input.medusa.executableSha256, 'medusa.executableSha256');
  if (!Number.isInteger(input.pathEntryCount) || input.pathEntryCount < 1) fail('pathEntryCount', 'must be a positive integer');
  return structuredClone(input);
}

export function planStage2aAnalysis({ slither = false, medusa = false, nativeFuzz = false } = {}) {
  const plan = [];
  if (slither) plan.push('slither');
  if (medusa) plan.push('medusa');
  if (nativeFuzz) plan.push('native-fuzz');
  return plan;
}

export function assertNativeFuzzMayStart(medusaResult) {
  obj(medusaResult, 'medusaResult');
  if (medusaResult.backend !== 'medusa') fail('medusaResult.backend', 'must equal medusa');
  if (!TERMINAL_MEDUSA.has(medusaResult.status)) fail('medusaResult.status', 'terminal Medusa evidence is required before native fuzz');
  return true;
}
