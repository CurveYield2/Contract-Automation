import fs from 'node:fs/promises';
import path from 'node:path';
import { runProcess } from './execution.mjs';

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

function analysisRequested(request, component) {
  const analysis = request.configuration?.analysis ?? {};
  if (component === 'medusa') return analysis.medusa !== false && analysis.medusa !== undefined;
  if (component === 'nativeFuzz') return analysis.nativeFuzz?.enabled === true;
  return false;
}

function harnessRequired(component) {
  return {
    status: 'HARNESS_REQUIRED',
    harnessApplicable: true,
    harnessOrigin: 'AUDITOR_GENERATED_REQUIRED',
    toolInvoked: false,
    reason: `AUDITOR_GENERATED_${component.toUpperCase()}_HARNESS_REQUIRED`,
  };
}

function disabled(component) {
  return {
    status: 'NOT_REQUESTED',
    harnessApplicable: false,
    harnessOrigin: 'NOT_REQUESTED',
    toolInvoked: false,
    reason: `${component.toUpperCase()}_NOT_REQUESTED`,
  };
}

export async function runPhase6ExecutionPreflightV1({
  request,
  projectRoot,
  runnerCommit,
  runCommand = runProcess,
}) {
  if (!request || request.phaseId !== 'build-and-test') throw new Error('Phase 6 preflight requires a build-and-test request');
  if (request.profileId !== 'github-native-simulate-v2') throw new Error('Phase 6 preflight requires github-native-simulate-v2');
  if (!projectRoot || typeof projectRoot !== 'string') throw new Error('Phase 6 preflight requires projectRoot');

  const files = await walk(projectRoot);
  const medusaConfigs = files.filter((file) => /(^|\/)medusa[^/]*\.json$/i.test(file));
  const foundryConfigs = files.filter((file) => /(^|\/)foundry\.toml$/i.test(file));
  const solidityTests = files.filter((file) => /\.t\.sol$/i.test(file));
  const propertySources = [];
  for (const file of files.filter((item) => item.endsWith('.sol'))) {
    if (await containsPropertyFunction(projectRoot, file)) propertySources.push(file);
  }

  const medusaHarnessPresent = medusaConfigs.length > 0 || propertySources.length > 0;
  const nativeFuzzHarnessPresent = foundryConfigs.length > 0 && solidityTests.length > 0;
  const medusaRequested = analysisRequested(request, 'medusa');
  const nativeFuzzRequested = analysisRequested(request, 'nativeFuzz');

  const compilerAcceptance = request.configuration?.compilers?.length > 0
    && request.configuration.compilers.every((compiler) => SUPPORTED_COMPILER_LANGUAGES.has(compiler.language) && typeof compiler.version === 'string' && compiler.version.length > 0);

  let medusa;
  if (!medusaRequested) {
    medusa = disabled('medusa');
  } else if (!medusaHarnessPresent) {
    medusa = harnessRequired('medusa');
  } else {
    medusa = {
      status: 'PENDING_TOOL_CHECK',
      harnessApplicable: true,
      harnessOrigin: 'TARGET_PACKAGE',
      toolInvoked: true,
      tool: await toolVersion('medusa', { cwd: projectRoot, runCommand }),
    };
    medusa.status = medusa.tool.available ? 'COMPLETED' : 'FAILED';
  }

  let nativeFuzz;
  if (!nativeFuzzRequested) {
    nativeFuzz = disabled('nativeFuzz');
  } else if (!nativeFuzzHarnessPresent) {
    nativeFuzz = harnessRequired('nativeFuzz');
  } else {
    nativeFuzz = {
      status: 'PENDING_TOOL_CHECK',
      harnessApplicable: true,
      harnessOrigin: 'TARGET_PACKAGE',
      toolInvoked: true,
      tool: await toolVersion('forge', { cwd: projectRoot, runCommand }),
    };
    nativeFuzz.status = nativeFuzz.tool.available ? 'COMPLETED' : 'FAILED';
  }

  const harnessConstructionRequired = medusa.status === 'HARNESS_REQUIRED' || nativeFuzz.status === 'HARNESS_REQUIRED';
  const infrastructureFailure = medusa.status === 'FAILED' || nativeFuzz.status === 'FAILED';
  const status = !compilerAcceptance || infrastructureFailure
    ? 'FAIL'
    : harnessConstructionRequired
      ? 'BLOCKED'
      : 'PASS';

  const nextState = status === 'PASS'
    ? 'ACTIVE'
    : status === 'BLOCKED'
      ? 'PHASE6_HARNESS_CONSTRUCTION'
      : 'RUNNER_REPAIR_REBIND';

  return {
    schemaVersion: 'audit-v7-phase6-execution-preflight-v1',
    status,
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
    harnessInventory: {
      fileCount: files.length,
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
