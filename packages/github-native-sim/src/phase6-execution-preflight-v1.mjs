import fs from 'node:fs/promises';
import path from 'node:path';
import { runProcess } from './execution.mjs';
import { probePhase6MutableRpc } from './phase6-mutable-rpc-v1.mjs';

const SUPPORTED_COMPILER_LANGUAGES = new Set(['solidity', 'vyper']);

async function walk(root, dir = root, out = []) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    if (['node_modules', '.git'].includes(entry.name)) continue;
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(root, absolute, out);
    else if (entry.isFile()) out.push(path.relative(root, absolute).split(path.sep).join('/'));
  }
  return out;
}

async function containsPropertyFunction(projectRoot, file) {
  if (!file.endsWith('.sol')) return false;
  const source = await fs.readFile(path.join(projectRoot, file), 'utf8');
  return /\b(property_|echidna_|invariant_)[A-Za-z0-9_]*\s*\(/.test(source);
}

async function toolVersion(command, { cwd, runCommand }) {
  const result = await runCommand({ command, args: ['--version'], cwd });
  return {
    available: Boolean(result && result.exitCode === 0),
    exitCode: Number.isInteger(result?.exitCode) ? result.exitCode : -1,
    stdout: String(result?.stdout ?? ''),
    stderr: String(result?.stderr ?? ''),
  };
}

function requested(component) {
  return component !== false && component !== undefined;
}

export async function runPhase6ExecutionPreflightV1({
  request,
  projectRoot,
  runnerCommit,
  environment = process.env,
  fetchImpl = globalThis.fetch,
  runCommand = runProcess,
  mutableRpcSession = null,
}) {
  if (!request || request.phaseId !== 'build-and-test') throw new Error('Phase 6 preflight requires a build-and-test request');
  if (request.profileId !== 'github-native-simulate-v2') throw new Error('Phase 6 preflight requires github-native-simulate-v2');
  if (!projectRoot || typeof projectRoot !== 'string') throw new Error('Phase 6 preflight requires projectRoot');

  const files = await walk(projectRoot);
  const soliditySources = files.filter((file) => file.endsWith('.sol') && !/\.t\.sol$/i.test(file));
  const vyperSources = files.filter((file) => file.endsWith('.vy'));
  const medusaConfigs = files.filter((file) => /(^|\/)medusa[^/]*\.json$/i.test(file));
  const foundryConfigs = files.filter((file) => /(^|\/)foundry\.toml$/i.test(file));
  const solidityTests = files.filter((file) => /\.t\.sol$/i.test(file));
  const propertySources = [];
  for (const file of files.filter((item) => item.endsWith('.sol'))) {
    if (await containsPropertyFunction(projectRoot, file)) propertySources.push(file);
  }

  const medusaRequested = requested(request.configuration?.analysis?.medusa);
  const nativeFuzzRequested = request.configuration?.analysis?.nativeFuzz?.enabled === true;
  const mutableRpcRequired = medusaRequested || nativeFuzzRequested;
  const mutableRpc = mutableRpcRequired
    ? (mutableRpcSession?.evidence
        ? structuredClone(mutableRpcSession.evidence)
        : await probePhase6MutableRpc({ environment, fetchImpl }))
    : { status: 'NOT_REQUIRED', profile: null, backendPolicy: 'EXISTING_CURVEYIELD_MUTABLE_ANVIL_RPC_ONLY' };

  const medusaHarnessPresent = medusaConfigs.length > 0 || propertySources.length > 0;
  const nativeFuzzHarnessPresent = foundryConfigs.length > 0 && solidityTests.length > 0;
  const medusaTechnicallyApplicable = medusaRequested && soliditySources.length > 0;
  const nativeFuzzTechnicallyApplicable = nativeFuzzRequested && (soliditySources.length > 0 || vyperSources.length > 0);

  const compilerAcceptance = request.configuration?.compilers?.length > 0
    && request.configuration.compilers.every((compiler) => SUPPORTED_COMPILER_LANGUAGES.has(compiler.language) && typeof compiler.version === 'string' && compiler.version.length > 0);

  let medusa;
  if (!medusaRequested) {
    medusa = { status: 'NOT_REQUESTED', technicallyApplicable: null, harnessPresent: null, toolInvoked: false };
  } else if (!medusaTechnicallyApplicable) {
    medusa = { status: 'NOT_APPLICABLE', technicallyApplicable: false, harnessPresent: false, toolInvoked: false, reason: 'NO_SOLIDITY_TARGET_FOR_MEDUSA' };
  } else if (!medusaHarnessPresent) {
    medusa = { status: 'HARNESS_REQUIRED', technicallyApplicable: true, harnessPresent: false, toolInvoked: false, reason: 'AUDITOR_MUST_AUTHOR_MEDUSA_HARNESS' };
  } else {
    medusa = { status: 'PENDING_TOOL_CHECK', technicallyApplicable: true, harnessPresent: true, toolInvoked: true, tool: await toolVersion('medusa', { cwd: projectRoot, runCommand }) };
    medusa.status = medusa.tool.available ? 'READY' : 'BLOCKED_INFRASTRUCTURE';
  }

  let nativeFuzz;
  if (!nativeFuzzRequested) {
    nativeFuzz = { status: 'NOT_REQUESTED', technicallyApplicable: null, harnessPresent: null, toolInvoked: false };
  } else if (!nativeFuzzTechnicallyApplicable) {
    nativeFuzz = { status: 'NOT_APPLICABLE', technicallyApplicable: false, harnessPresent: false, toolInvoked: false, reason: 'NO_SUPPORTED_TARGET_FOR_NATIVE_FUZZ' };
  } else if (!nativeFuzzHarnessPresent) {
    nativeFuzz = { status: 'HARNESS_REQUIRED', technicallyApplicable: true, harnessPresent: false, toolInvoked: false, reason: 'AUDITOR_MUST_AUTHOR_FOUNDRY_HARNESS' };
  } else {
    nativeFuzz = { status: 'PENDING_TOOL_CHECK', technicallyApplicable: true, harnessPresent: true, toolInvoked: true, tool: await toolVersion('forge', { cwd: projectRoot, runCommand }) };
    nativeFuzz.status = nativeFuzz.tool.available ? 'READY' : 'BLOCKED_INFRASTRUCTURE';
  }

  const harnessRequired = [medusa, nativeFuzz].some((component) => component.status === 'HARNESS_REQUIRED');
  const toolInfrastructureBlocked = [medusa, nativeFuzz].some((component) => component.status === 'BLOCKED_INFRASTRUCTURE');
  const mutableRpcBlocked = mutableRpcRequired && mutableRpc.status !== 'PASS';
  const infrastructureBlocked = toolInfrastructureBlocked || mutableRpcBlocked;
  const status = compilerAcceptance && !harnessRequired && !infrastructureBlocked ? 'PASS' : 'BLOCKED';
  const nextState = harnessRequired
    ? 'PHASE6_HARNESS_AUTHORING'
    : infrastructureBlocked
      ? 'RUNNER_REPAIR_REBIND'
      : status === 'PASS'
        ? 'ACTIVE'
        : 'PHASE6_EXECUTION_PREFLIGHT';

  return {
    schemaVersion: 'audit-v7-phase6-execution-preflight-v4',
    status,
    failureKind: mutableRpcBlocked ? (mutableRpc.failureKind ?? 'MUTABLE_RPC_UNAVAILABLE') : null,
    phaseId: request.phaseId,
    profileId: request.profileId,
    requestId: request.requestId,
    sourceCommit: request.source.commit,
    runnerCommit,
    contractAutomationRelease: request.contractAutomationRelease,
    runnerRelease: request.runnerRelease,
    compilerAcceptance: {
      status: compilerAcceptance ? 'PASS' : 'FAIL',
      requested: request.configuration.compilers,
    },
    mutableRpcPolicy: {
      rule: 'ONE_IDENTITY_NORMALIZED_RPC_SESSION_FOR_PHASE6_PREFLIGHT_MEDUSA_AND_FOUNDRY',
      requesterSuppliedRpcAllowed: false,
      alternateMutableRpcAllowed: false,
      medusaForkModeRequired: medusaRequested,
      foundryForkModeRequired: nativeFuzzRequested,
      runtimeSecretMustNotAppearInEvidence: true,
      sharedSessionRequired: mutableRpcRequired,
      sharedSessionObserved: mutableRpcRequired ? Boolean(mutableRpcSession?.runtime?.identityNormalized) : null,
    },
    mutableRpc,
    harnessPolicy: {
      rule: 'AUDITOR_AUTHORS_REQUIRED_HARNESSES_WITHOUT_MODIFYING_FROZEN_PRODUCTION_SOURCE',
      missingHarnessIsNotNotApplicable: true,
      notApplicableRequiresTechnicalInapplicability: true,
      modelBasedTestingMaySupplementButNeverReplaceRequiredExecutableHarnesses: true,
      phaseCannotPassWhileHarnessRequired: true,
    },
    harnessInventory: {
      fileCount: files.length,
      soliditySources,
      vyperSources,
      medusaConfigs,
      propertySources,
      foundryConfigs,
      solidityTests,
    },
    medusa,
    nativeFuzz,
    nextState,
  };
}
