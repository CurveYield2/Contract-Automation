import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { runProcess } from './execution.mjs';

const EXACT = Object.freeze({
  campaignId: 'curveyield-dex-fresh-audit-r1',
  phaseId: 'lite-p67',
  sourceRepository: 'CurveYield2/Audit-Controller',
  sourceCommit: 'c41958422daf46c3b929182f90e53b872cedada6',
  archiveSha256: '526a729ce73d493f2ccbb568378a18dd1eec0788d0165e02dc5ceb773b9953ed',
  actionKind: 'curveyield-lite-p67-v1',
  executionSet: 'retained-lite-v1',
});
const RUNNER_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const DEV_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function sanitizeFailureText(value) {
  const redacted = String(value ?? '')
    .replaceAll(DEV_PRIVATE_KEY, '[REDACTED_DEV_PRIVATE_KEY]')
    .replace(/https?:\/\/[^\s"']+/gi, '[REDACTED_URL]');
  return redacted.slice(-12000);
}

function exactAction(request) {
  const action = request?.configuration?.actions;
  return request?.campaignId === EXACT.campaignId
    && request?.phaseId === EXACT.phaseId
    && request?.source?.repository === EXACT.sourceRepository
    && request?.source?.commit === EXACT.sourceCommit
    && request?.source?.archiveSha256 === EXACT.archiveSha256
    && action?.kind === EXACT.actionKind
    && action?.executionSet === EXACT.executionSet;
}

export function isCurveYieldLiteP67Request(request) {
  return exactAction(request);
}

function commandEvidence(result) {
  return {
    exitCode: result?.exitCode ?? -1,
    stdoutSha256: sha256(String(result?.stdout ?? '')),
    stderrSha256: sha256(String(result?.stderr ?? '')),
  };
}

function vitestSummary(stdout) {
  const lines = String(stdout ?? '').split(/\r?\n/);
  return {
    testFiles: lines.find((line) => /Test Files/.test(line))?.trim() ?? null,
    tests: lines.find((line) => /^\s*Tests\s/.test(line))?.trim() ?? null,
    duration: lines.find((line) => /^\s*Duration\s/.test(line))?.trim() ?? null,
  };
}

async function reportInventory(projectRoot) {
  const directory = path.join(projectRoot, 'deployment-artifacts');
  try {
    const entries = await fs.readdir(directory);
    return new Set(entries.filter((name) => name.startsWith('curveyield-dex-fresh-live-simulation-') && name.endsWith('.json')));
  } catch {
    return new Set();
  }
}

async function readNewSimulationReport(projectRoot, before) {
  const directory = path.join(projectRoot, 'deployment-artifacts');
  const entries = (await fs.readdir(directory))
    .filter((name) => name.startsWith('curveyield-dex-fresh-live-simulation-') && name.endsWith('.json') && !before.has(name))
    .sort();
  if (entries.length !== 1) throw new Error(`Expected exactly one new deployment simulation report, observed ${entries.length}`);
  const bytes = await fs.readFile(path.join(directory, entries[0]));
  const report = JSON.parse(bytes.toString('utf8'));
  const sanitized = structuredClone(report);
  sanitized.rpcUrl = '[REDACTED_PUBLIC_ENDPOINT]';
  return {
    file: entries[0],
    sha256: sha256(bytes),
    report: sanitized,
  };
}

export async function runCurveYieldLiteP67({ request, projectRoot, environment = process.env, runCommand = runProcess }) {
  if (!exactAction(request)) throw new Error('CurveYield Lite P6-7 action is not admitted for this exact campaign/source/action identity');

  const anvilPath = path.join(RUNNER_ROOT, 'node_modules', '.bin', 'anvil');
  const testResult = await runCommand({
    command: 'npm',
    args: ['run', 'ops:test'],
    cwd: projectRoot,
    env: { ...environment, ANVIL_PATH: anvilPath },
  });

  const before = await reportInventory(projectRoot);
  const simulationResult = await runCommand({
    command: 'node',
    args: ['tooling/scripts/simulateCurveYieldDexFresh.mjs'],
    cwd: projectRoot,
    env: { ...environment, DEPLOYER_PRIVATE_KEY: DEV_PRIVATE_KEY },
  });
  let deploymentConfigurationSimulation = null;
  try {
    deploymentConfigurationSimulation = await readNewSimulationReport(projectRoot, before);
  } catch (error) {
    deploymentConfigurationSimulation = { reportReadError: error.message };
  }

  const testEvidence = {
    status: testResult.exitCode === 0 ? 'PASS' : 'FAIL',
    command: 'npm run ops:test',
    ...commandEvidence(testResult),
    summary: vitestSummary(testResult.stdout),
    ...(testResult.exitCode === 0 ? {} : { failureOutput: { stdoutTail: sanitizeFailureText(testResult.stdout), stderrTail: sanitizeFailureText(testResult.stderr) } }),
    retainedCoverage: [
      'candidate-specific-deterministic-simulation',
      'basic-targeted-fuzzing',
    ],
  };
  const simulationEvidence = {
    status: simulationResult.exitCode === 0 && deploymentConfigurationSimulation?.report?.simulation?.success === true ? 'PASS' : 'FAIL',
    command: 'node tooling/scripts/simulateCurveYieldDexFresh.mjs',
    ...commandEvidence(simulationResult),
    evidence: deploymentConfigurationSimulation,
    ...(simulationResult.exitCode === 0 ? {} : { failureOutput: { stdoutTail: sanitizeFailureText(simulationResult.stdout), stderrTail: sanitizeFailureText(simulationResult.stderr) } }),
    retainedCoverage: ['complete-deployment-configuration-simulation'],
  };
  const status = testEvidence.status === 'PASS' && simulationEvidence.status === 'PASS' ? 'completed' : 'failed';
  const logSummary = {
    status,
    sourceToolingTests: {
      status: testEvidence.status,
      exitCode: testEvidence.exitCode,
      summary: testEvidence.summary,
      ...(testEvidence.failureOutput ? { failureOutput: testEvidence.failureOutput } : {}),
    },
    deploymentConfigurationSimulation: {
      status: simulationEvidence.status,
      exitCode: simulationEvidence.exitCode,
      reportFile: deploymentConfigurationSimulation?.file ?? null,
      reportSha256: deploymentConfigurationSimulation?.sha256 ?? null,
      simulation: deploymentConfigurationSimulation?.report?.simulation ?? null,
      reportReadError: deploymentConfigurationSimulation?.reportReadError ?? null,
      ...(simulationEvidence.failureOutput ? { failureOutput: simulationEvidence.failureOutput } : {}),
    },
  };

  return {
    schemaVersion: 'audit-v7-lite-p67-execution-v1',
    status,
    exactIdentity: { ...EXACT },
    excludedFullMethods: [
      'medusa',
      'broad-random-discovery',
      'stateful-randomized',
      'chaos',
      'mutation',
      'differential-reference',
      'corpus-deep',
      'exhaustive-known-attack',
      'coverage-guided-reruns',
    ],
    sourceToolingTests: testEvidence,
    deploymentConfigurationSimulation: simulationEvidence,
    logSummary,
  };
}
