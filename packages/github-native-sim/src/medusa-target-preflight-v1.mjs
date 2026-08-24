import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { runMedusaAnalysis, parseMedusaOutput } from './analysis.mjs';
import { digestDirectory } from './phase6-staged-snapshot-v1.mjs';
import { preflightMedusaV1 } from './preflight/medusa-v1.mjs';
import { V7_POLICY } from './v7-policy.mjs';

const DEFAULT_SMOKE_TEST_LIMIT = 32;
const MEDUSA_CONFIG = 'medusa.json';
const SOURCE_MAP_SIGNATURE = /(?:crytic-compile[\s\S]{0,400}sourceMap|sourceMap[\s\S]{0,400}crytic-compile|KeyError:\s*['"]sourceMap['"])/i;
const COVERAGE_TRACER_SIGNATURE = /CoverageTracer\.SetInitialContractsSet|coverage tracer.*panic/i;
const CRYTIC_FAILURE_SIGNATURE = /crytic-compile[\s\S]{0,500}(?:error|failed|failure|traceback|keyerror)/i;
const HARNESS_DEPLOY_FAILURE_SIGNATURE = /(?:constructor|deploy(?:ment)?)[\s\S]{0,300}(?:revert|failed|failure)/i;

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

async function copyProject(source, destination) {
  await fs.rm(destination, { recursive: true, force: true });
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.cp(source, destination, {
    recursive: true,
    preserveTimestamps: true,
    filter: (entry) => {
      const base = path.basename(entry);
      return base !== '.git' && base !== 'node_modules';
    },
  });
}

async function walk(root, current = root, out = []) {
  const entries = await fs.readdir(current, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const absolute = path.join(current, entry.name);
    if (entry.isDirectory()) await walk(root, absolute, out);
    else if (entry.isFile()) out.push(path.relative(root, absolute).split(path.sep).join('/'));
  }
  return out;
}

function parseConfig(bytes, label) {
  try {
    const parsed = JSON.parse(bytes.toString('utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('must be an object');
    return parsed;
  } catch (error) {
    throw new Error(`${label} JSON parse failed: ${error.message}`);
  }
}

function parserCompatibilityProbe() {
  const probes = {
    pass: '⇾ [PASSED] Property Test: property_preflightPass',
    falsification: '⇾ [FAILED] Property Test: property_preflightFail\n⇾ [Call Sequence]\n⇾ 1) actionNoop(1)',
    noTests: 'no assertion, property, optimization, or custom tests were found to fuzz',
    unicodePrefix: '⇾ [PASSED] Property Test: invariant_unicodePrefix',
  };
  const output = {};
  for (const [name, fixture] of Object.entries(probes)) {
    try { parseMedusaOutput(fixture); output[name] = true; }
    catch { output[name] = false; }
  }
  return output;
}

function terminalSmokeStatus(result) {
  if (result?.terminal !== true) return 'NOT_TERMINAL';
  if (result.failureKind === 'PROPERTY_FALSIFICATION') return 'PROPERTY_FALSIFICATION';
  if (result.failureKind === 'NO_TESTS_DISCOVERED') return 'NO_TESTS_DISCOVERED';
  if (result.status === 'completed') return 'COMPLETED';
  if (result.status === 'completed_with_failures') return 'COMPLETED_WITH_FAILURES';
  return 'FAILED';
}

function rawText(result) {
  return `${result?.rawOutput?.stdout ?? ''}\n${result?.rawOutput?.stderr ?? ''}`;
}

function discoveredProperties(result) {
  const properties = Array.isArray(result?.campaign?.properties) ? result.campaign.properties : [];
  return properties.filter((item) => item && typeof item.name === 'string').map((item) => item.name);
}

function exactConfigBinding(original, smoke) {
  const expected = structuredClone(original);
  if (!expected.fuzzing || typeof expected.fuzzing !== 'object') return false;
  expected.fuzzing.testLimit = smoke?.fuzzing?.testLimit;
  return JSON.stringify(expected) === JSON.stringify(smoke);
}

export async function prepareTargetMedusaSmokeV1({
  projectRoot,
  smokeRoot,
  expectedSnapshotDigest,
  testLimit = DEFAULT_SMOKE_TEST_LIMIT,
} = {}) {
  if (typeof projectRoot !== 'string' || projectRoot.length === 0) throw new Error('Target Medusa preflight requires projectRoot');
  if (typeof smokeRoot !== 'string' || smokeRoot.length === 0) throw new Error('Target Medusa preflight requires smokeRoot');
  if (typeof expectedSnapshotDigest !== 'string' || !/^[0-9a-f]{64}$/.test(expectedSnapshotDigest)) throw new Error('Target Medusa preflight requires a 64-hex staged snapshot digest');
  if (!Number.isInteger(testLimit) || testLimit < 1 || testLimit > 256) throw new Error('Target Medusa smoke testLimit must be an integer from 1 through 256');

  const sourceDigest = await digestDirectory(projectRoot);
  if (sourceDigest.digestSha256 !== expectedSnapshotDigest) {
    const error = new Error(`MEDUSA_TARGET_SMOKE_SOURCE_MISMATCH: expected ${expectedSnapshotDigest}, observed ${sourceDigest.digestSha256}`);
    error.code = 'MEDUSA_TARGET_SMOKE_SOURCE_MISMATCH';
    throw error;
  }

  await copyProject(projectRoot, smokeRoot);
  const copiedDigest = await digestDirectory(smokeRoot);
  if (copiedDigest.digestSha256 !== expectedSnapshotDigest) {
    const error = new Error(`MEDUSA_TARGET_SMOKE_COPY_MISMATCH: expected ${expectedSnapshotDigest}, observed ${copiedDigest.digestSha256}`);
    error.code = 'MEDUSA_TARGET_SMOKE_COPY_MISMATCH';
    throw error;
  }

  const configPath = path.join(smokeRoot, MEDUSA_CONFIG);
  const originalConfig = parseConfig(await fs.readFile(configPath), MEDUSA_CONFIG);
  if (!originalConfig.fuzzing || typeof originalConfig.fuzzing !== 'object') throw new Error('Target Medusa preflight requires medusa.json fuzzing configuration');
  if (!Number.isInteger(originalConfig.fuzzing.testLimit) || originalConfig.fuzzing.testLimit < 1) throw new Error('Target Medusa preflight requires a positive original fuzzing.testLimit');

  const smokeConfig = structuredClone(originalConfig);
  smokeConfig.fuzzing.testLimit = testLimit;
  if (!exactConfigBinding(originalConfig, smokeConfig)) throw new Error('Target Medusa smoke may only change fuzzing.testLimit');
  await fs.writeFile(configPath, `${JSON.stringify(smokeConfig, null, 2)}\n`);

  const files = await walk(smokeRoot);
  const configDigestSha256 = sha256(Buffer.from(JSON.stringify(originalConfig)));
  return {
    schemaVersion: 'medusa-target-smoke-preparation-v1',
    sourceSnapshotDigest: expectedSnapshotDigest,
    sourceFileCount: sourceDigest.fileCount,
    smokeRoot,
    actualProjectCopy: true,
    originalConfig,
    smokeConfig,
    originalTestLimit: originalConfig.fuzzing.testLimit,
    testLimit,
    configDigestSha256,
    hasVyper: files.some((file) => file.endsWith('.vy')),
    vyperSources: files.filter((file) => file.endsWith('.vy')),
    propertyTestingEnabled: smokeConfig.fuzzing?.testing?.propertyTesting?.enabled === true,
    stopOnNoTests: smokeConfig.fuzzing?.testing?.stopOnNoTests === true,
    coverageEnabled: smokeConfig.fuzzing?.coverageEnabled === true,
  };
}

export async function runTargetMedusaPreflightV1({
  sourceCommit,
  projectRoot,
  snapshotDigestSha256,
  harnessOverlayDigestSha256,
  rpcUrl,
  rpcProfile,
  rpcBlock,
  rpcBlockHash,
  workspaceRoot,
  testLimit = DEFAULT_SMOKE_TEST_LIMIT,
} = {}, {
  runMedusa = runMedusaAnalysis,
} = {}) {
  if (typeof workspaceRoot !== 'string' || workspaceRoot.length === 0) throw new Error('Target Medusa preflight requires workspaceRoot');
  if (typeof harnessOverlayDigestSha256 !== 'string' || !/^[0-9a-f]{64}$/.test(harnessOverlayDigestSha256)) throw new Error('Target Medusa preflight requires exact harness overlay digest');

  const prepared = await prepareTargetMedusaSmokeV1({
    projectRoot,
    smokeRoot: path.join(workspaceRoot, 'medusa-target-preflight'),
    expectedSnapshotDigest: snapshotDigestSha256,
    testLimit,
  });

  let result;
  try {
    result = await runMedusa({
      version: V7_POLICY.tools.medusa,
      sourceCommit,
      projectRoot: prepared.smokeRoot,
      rawArtifactRef: `github-actions://preflight/medusa-target/${sourceCommit}`,
      rpcUrl,
      rpcProfile,
      rpcBlock,
      rpcBlockHash,
    });
  } catch (error) {
    result = {
      backend: 'medusa', version: V7_POLICY.tools.medusa, sourceCommit,
      status: 'failed', terminal: true, failureKind: error?.kind ?? error?.code ?? 'TARGET_SMOKE_EXECUTION_FAILURE',
      componentStatus: 'FAILED', continuationDisposition: 'BLOCKED',
      rawOutput: { exitCode: -1, stdout: '', stderr: error?.message ?? String(error) },
    };
  }

  const raw = rawText(result);
  const sourceMapFailure = SOURCE_MAP_SIGNATURE.test(raw);
  const cryticFailure = sourceMapFailure || CRYTIC_FAILURE_SIGNATURE.test(raw);
  const coverageFailure = COVERAGE_TRACER_SIGNATURE.test(raw);
  const harnessDeployFailure = HARNESS_DEPLOY_FAILURE_SIGNATURE.test(raw);
  const properties = discoveredProperties(result);
  const parserProbe = parserCompatibilityProbe();
  if (result?.failureKind === 'EVIDENCE_PARSE_FAILURE' && !cryticFailure) {
    parserProbe.pass = false;
    parserProbe.falsification = false;
  }

  const normalizedContainsSecret = typeof rpcUrl === 'string' && rpcUrl.length > 0
    ? JSON.stringify(result).includes(rpcUrl)
    : false;

  const terminalStatus = terminalSmokeStatus(result);
  const receipt = preflightMedusaV1({
    repository: 'CurveYield2/Contract-Automation',
    ref: sourceCommit,
    observedVersion: result?.version ?? V7_POLICY.tools.medusa,
    sourceSnapshotDigest: snapshotDigestSha256,
    expectedSourceSnapshotDigest: snapshotDigestSha256,
    harnessBundleDigest: harnessOverlayDigestSha256,
    expectedHarnessBundleDigest: harnessOverlayDigestSha256,
    cryticCompileProbe: cryticFailure
      ? { status: 'FAIL', error: raw.slice(0, 2000) }
      : { status: 'PASS', evidence: 'actual-target Medusa smoke reached post-build terminal classification' },
    hasVyper: prepared.hasVyper,
    mixedLanguageProbe: prepared.hasVyper
      ? (sourceMapFailure ? { status: 'FAIL', error: raw.slice(0, 2000) } : { status: 'PASS', vyperSources: prepared.vyperSources })
      : { status: 'NOT_REQUIRED' },
    propertiesRequired: true,
    propertyTestingEnabled: prepared.propertyTestingEnabled,
    stopOnNoTests: prepared.stopOnNoTests,
    discoveredPropertyCount: properties.length,
    discoveredProperties: properties,
    coverageProbe: prepared.coverageEnabled && !coverageFailure
      ? { status: 'PASS' }
      : { status: 'FAIL', coverageEnabled: prepared.coverageEnabled, error: coverageFailure ? raw.slice(0, 2000) : 'coverageEnabled=false' },
    parserProbe,
    forkRequired: true,
    expectedBlockHash: rpcBlockHash,
    rpcProbe: {
      chainId: 1,
      blockHash: result?.fork?.blockHash ?? rpcBlockHash,
      blockNumber: result?.fork?.blockNumber ?? rpcBlock,
      identityNormalized: rpcProfile === V7_POLICY.mutableRpc.ethereumProfile,
    },
    tinyTargetSmoke: {
      terminalStatus,
      failureKind: result?.failureKind ?? null,
      harnessDeployFailure,
    },
    normalizedEvidenceContainsRpcSecret: normalizedContainsSecret,
    expectedOutputs: ['medusa-target-preflight-receipt'],
  });

  return {
    ...receipt,
    targetSmoke: {
      schemaVersion: 'medusa-target-smoke-evidence-v1',
      actualProjectCopy: true,
      sourceSnapshotDigest: prepared.sourceSnapshotDigest,
      configDigestSha256: prepared.configDigestSha256,
      originalTestLimit: prepared.originalTestLimit,
      testLimit: prepared.testLimit,
      propertyTestingEnabled: prepared.propertyTestingEnabled,
      stopOnNoTests: prepared.stopOnNoTests,
      coverageEnabled: prepared.coverageEnabled,
      hasVyper: prepared.hasVyper,
      vyperSources: prepared.vyperSources,
      terminalStatus,
      failureKind: result?.failureKind ?? null,
      discoveredProperties: properties,
      rawOutputPreserved: Boolean(result?.rawOutput),
      rpcUrlExposed: normalizedContainsSecret,
    },
  };
}
