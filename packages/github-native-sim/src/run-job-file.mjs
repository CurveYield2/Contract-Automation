import path from 'node:path';
import { CHAINS } from '../../protocol/src/index.mjs';
import { buildProject as defaultBuildProject } from '../../runner/src/build-dispatch.mjs';
import { startCompatibleForkEngine } from '../../runner/src/anvil-engine.mjs';
import { executeWorkflow } from '../../runner/src/workflow.mjs';
import { runMedusaAnalysis, runSlitherAnalysis } from './analysis.mjs';
import { normalizeDeploymentGasEvidence } from './deployment-gas-v1.mjs';
import { checkoutExactSource, safeRepositoryProjectPath, stageExactArchiveSource } from './execution.mjs';
import { runNativeFuzzAnalysis } from './native-fuzz.mjs';
import { validateDeepAssuranceRequestV2 } from './schema.mjs';
import { runStage2aAnalysis } from './stage2a-toolchain.mjs';

function nowIso(now = () => new Date()) { return now().toISOString(); }

function rawArtifactRef(component) {
  const repository = process.env.GITHUB_REPOSITORY ?? 'CurveYield2/Contract-Automation';
  const runId = process.env.GITHUB_RUN_ID ?? 'recovery';
  return `github-actions://${repository}/runs/${runId}/artifacts/v7-execution/${component}`;
}

async function defaultCheckoutSource(source, { workspaceRoot, runCommand, environment } = {}) {
  const checkoutRoot = path.join(workspaceRoot, 'checkout');
  const checkout = await checkoutExactSource({
    repository: source.repository,
    commit: source.commit,
    destination: checkoutRoot
  }, {
    ...(runCommand ? { runCommand } : {}),
    ...(environment ? { environment } : {})
  });
  const staged = source.archivePath
    ? await stageExactArchiveSource({
        checkoutRoot,
        workspaceRoot,
        archivePath: source.archivePath,
        archiveSha256: source.archiveSha256,
        projectPath: source.projectPath
      })
    : null;
  return {
    checkoutRoot,
    projectRoot: staged?.projectRoot ?? safeRepositoryProjectPath(checkoutRoot, source.projectPath),
    commit: checkout.commit,
    ...(staged ? {
      archivePath: staged.archivePath,
      archiveSha256: staged.archiveSha256,
      archiveExtractedBytes: staged.extractedBytes,
      archiveEntryCount: staged.entryCount
    } : {})
  };
}

function failureResult(request, startedAt, error, partial = {}, now) {
  return {
    schemaVersion: 'deep-assurance-github-native-execution-v2',
    requestId: request.requestId,
    requestDigest: request.requestDigest,
    profileId: request.profileId,
    source: structuredClone(request.source),
    status: 'failed',
    build: partial.build,
    deploymentGasEvidence: partial.deploymentGasEvidence ?? null,
    analysis: partial.analysis ?? {},
    simulation: partial.simulation ?? null,
    analysisComponentFailureCount: partial.analysisComponentFailureCount ?? 0,
    failedStepCount: partial.failedStepCount ?? 0,
    failedSteps: partial.failedSteps ?? [],
    continuityDisposition: partial.continuityDisposition ?? 'COMPLETE_EVIDENCE',
    error: {
      name: error?.name ?? 'Error',
      message: error?.message ?? String(error),
      ...(error?.code ? { code: error.code } : {}),
      ...(error?.kind ? { kind: error.kind } : {})
    },
    startedAt,
    finishedAt: nowIso(now)
  };
}

function analysisFailureCount(analysis) {
  return Object.values(analysis).filter((component) => component && component.componentStatus && component.componentStatus !== 'COMPLETED').length;
}

function hasHardStop(analysis) {
  return Object.values(analysis).some((component) => component?.continuationDisposition === 'STOP_EXECUTION');
}

function deploymentGasConfigurationIdentity(request, build) {
  const compiler = (request.configuration.compilers ?? []).find((item) => item?.language === 'solidity') ?? { language: 'solidity', version: build?.compilerVersion };
  return {
    sourceCommit: request.source.commit,
    compiler: { language: compiler.language ?? 'solidity', version: compiler.version ?? build?.compilerVersion },
    optimizer: request.configuration.optimizer ?? null,
    evmVersion: request.configuration.evmVersion ?? null,
    viaIR: request.configuration.viaIR ?? false,
  };
}

function buildDeploymentGasEvidence(request, build) {
  if (request.phaseId !== 'fork-simulation-lifecycle') return null;
  return normalizeDeploymentGasEvidence({
    deployableContracts: request.configuration.deploymentGas.deployableContracts,
    artifacts: build?.artifacts ?? [],
    configurationIdentity: deploymentGasConfigurationIdentity(request, build),
  });
}

function buildArtifactAccessor(artifacts = []) {
  const byQualifiedName = new Map();
  const byName = new Map();
  for (const artifact of artifacts) {
    if (!artifact?.sourceName || !artifact?.contractName) continue;
    byQualifiedName.set(`${artifact.sourceName}:${artifact.contractName}`, artifact);
    const sameName = byName.get(artifact.contractName) ?? [];
    sameName.push(artifact);
    byName.set(artifact.contractName, sameName);
  }
  return {
    all: [...byQualifiedName.values()],
    get(contractName, sourceName = undefined) {
      if (sourceName) {
        const artifact = byQualifiedName.get(`${sourceName}:${contractName}`);
        if (!artifact) throw new Error(`Contract not found in accepted build: ${sourceName}:${contractName}`);
        return artifact;
      }
      const matches = byName.get(contractName) ?? [];
      if (matches.length === 0) throw new Error(`Contract not found in accepted build: ${contractName}`);
      if (matches.length > 1) throw new Error(`Ambiguous contract name ${contractName}; workflow must specify source`);
      return matches[0];
    }
  };
}

function simulationFailure({ request, kind, error, steps = [], deployments = {} }) {
  const simulation = request.configuration.simulation;
  return {
    status: 'failed',
    failureKind: kind,
    chain: simulation.chain,
    chainId: CHAINS[simulation.chain].chainId,
    block: simulation.block,
    pinnedFork: true,
    steps: structuredClone(steps),
    deployments: structuredClone(deployments),
    error: { name: error?.name ?? 'Error', message: error?.message ?? String(error) }
  };
}

function phase7RpcEnv(simulation) {
  if (simulation.chain === 'ethereum') return 'SIM_ARCHIVE_PRIMARY_ETHEREUM_01';
  return CHAINS[simulation.chain].rpcEnv;
}

async function executePhase7Simulation({ request, build, environment, startSimulationEngine, executeSimulationWorkflow }) {
  if (request.phaseId !== 'fork-simulation-lifecycle') return null;
  const simulation = request.configuration.simulation;
  const chain = CHAINS[simulation.chain];
  const rpcEnv = phase7RpcEnv(simulation);
  const forkUrl = environment[rpcEnv];
  if (!forkUrl) {
    const error = new Error(`Runner secret ${rpcEnv} is not configured for the pinned ${simulation.chain} fork`);
    error.kind = 'RPC_CONFIGURATION_FAILURE';
    error.simulationEvidence = simulationFailure({ request, kind: error.kind, error });
    throw error;
  }

  let engine;
  try {
    engine = await startSimulationEngine({
      artifacts: buildArtifactAccessor(build?.artifacts ?? []),
      workflow: simulation.workflow,
      chainId: chain.chainId,
      forkUrl,
      block: simulation.block,
      evmVersion: request.configuration.evmVersion,
    });
    if (engine?.engine !== 'anvil') {
      const error = new Error(`Phase 7 authoritative fork engine must be Anvil; received ${engine?.engine ?? 'unknown'}`);
      error.kind = 'FORK_ENGINE_POLICY_FAILURE';
      throw error;
    }
    const execution = await executeSimulationWorkflow(simulation.workflow, engine.runtime, { aliases: engine.aliases });
    return {
      status: 'completed',
      failureKind: null,
      engine: engine.engine,
      chain: simulation.chain,
      chainId: chain.chainId,
      block: simulation.block,
      pinnedFork: true,
      steps: structuredClone(execution.steps ?? []),
      deployments: structuredClone(execution.context?.deployments ?? {}),
    };
  } catch (error) {
    if (!error.kind) error.kind = 'LIFECYCLE_WORKFLOW_FAILURE';
    error.simulationEvidence = simulationFailure({
      request,
      kind: error.kind,
      error,
      steps: error.workflowSteps ?? [],
      deployments: error.workflowContext?.deployments ?? {},
    });
    throw error;
  } finally {
    if (engine?.close) await engine.close().catch(() => {});
  }
}

async function executeSlither({ request, checkout, build, runSlither, runCommand }) {
  if (runSlither) return runSlither({ projectRoot: checkout.projectRoot, request, build });
  const slitherVersion = request.configuration.analysis?.slither?.version ?? '0.11.6';
  return runSlitherAnalysis({
    projectRoot: checkout.projectRoot,
    version: slitherVersion,
    sourceCommit: request.source.commit,
    rawArtifactRef: rawArtifactRef('slither/raw.json')
  }, { ...(runCommand ? { runCommand } : {}) });
}

async function executeMedusa({ request, checkout, build, runMedusa, runCommand }) {
  if (runMedusa) return runMedusa({ projectRoot: checkout.projectRoot, request, build });
  const medusaVersion = request.configuration.analysis?.medusa?.version ?? '1.5.1';
  return runMedusaAnalysis({
    projectRoot: checkout.projectRoot,
    version: medusaVersion,
    sourceCommit: request.source.commit,
    rawArtifactRef: rawArtifactRef('medusa/raw.json')
  }, { ...(runCommand ? { runCommand } : {}) });
}

async function executeNativeFuzz({ request, checkout, build, runNativeFuzz, runCommand }) {
  if (runNativeFuzz) return runNativeFuzz({ projectRoot: checkout.projectRoot, request, build });
  const native = request.configuration.analysis?.nativeFuzz ?? {};
  const fuzzRuns = native.fuzzRuns ?? 256;
  return runNativeFuzzAnalysis({
    projectRoot: checkout.projectRoot,
    sourceCommit: request.source.commit,
    rawArtifactRef: rawArtifactRef('native-fuzz/raw.txt'),
    command: 'forge',
    args: ['test', '--fuzz-runs', String(fuzzRuns)],
    recoverableExitCodes: native.recoverableExitCodes ?? []
  }, { ...(runCommand ? { runCommand } : {}) });
}

export async function runGitHubNativeJob(input, {
  workspaceRoot = path.resolve('.deep-assurance-work'),
  checkoutSource = defaultCheckoutSource,
  buildProject = defaultBuildProject,
  runSlither,
  runMedusa,
  runNativeFuzz,
  runCommand,
  environment = process.env,
  startSimulationEngine = startCompatibleForkEngine,
  executeSimulationWorkflow = executeWorkflow,
  now = () => new Date()
} = {}) {
  const request = validateDeepAssuranceRequestV2(input);
  const startedAt = nowIso(now);
  const analysis = {};
  let build;
  let checkout;
  let deploymentGasEvidence = null;
  let simulation = null;

  try {
    checkout = await checkoutSource(request.source, { workspaceRoot, runCommand, environment });
    if (!checkout || checkout.commit !== request.source.commit) {
      throw new Error(`Exact source checkout mismatch: expected ${request.source.commit}, got ${checkout?.commit ?? 'missing'}`);
    }
    build = await buildProject({
      projectRoot: checkout.projectRoot,
      request,
      ...(runCommand ? { runCommand } : {})
    });
    deploymentGasEvidence = buildDeploymentGasEvidence(request, build);
  } catch (error) {
    return failureResult(request, startedAt, error, { build, deploymentGasEvidence, analysis, simulation }, now);
  }

  if (request.profileId === 'github-native-compile-v2') {
    try {
      analysis.slither = await executeSlither({ request, checkout, build, runSlither, runCommand });
    } catch (error) {
      analysis.slither = {
        backend: 'slither',
        status: 'failed',
        terminal: true,
        componentStatus: 'FAILED',
        continuationDisposition: 'CONTINUE_WITH_LIMITATION',
        failureKind: error?.kind ?? 'ANALYSIS_COMPONENT_FAILURE',
        error: { name: error?.name ?? 'Error', message: error?.message ?? String(error) }
      };
    }
  } else {
    const requestedAnalysis = request.configuration.analysis ?? {};
    const stage2aConfig = {
      slither: requestedAnalysis.slither !== false,
      medusa: requestedAnalysis.medusa !== false,
      nativeFuzz: requestedAnalysis.nativeFuzz?.enabled === true
    };
    try {
      await runStage2aAnalysis(stage2aConfig, {
        runSlither: async () => {
          analysis.slither = await executeSlither({ request, checkout, build, runSlither, runCommand });
          return analysis.slither;
        },
        runMedusa: async () => {
          analysis.medusa = await executeMedusa({ request, checkout, build, runMedusa, runCommand });
          return analysis.medusa;
        },
        runNativeFuzz: async () => {
          analysis.nativeFuzz = await executeNativeFuzz({ request, checkout, build, runNativeFuzz, runCommand });
          return analysis.nativeFuzz;
        }
      });
    } catch (error) {
      const componentFailures = analysisFailureCount(analysis);
      return failureResult(request, startedAt, error, {
        build,
        deploymentGasEvidence,
        analysis,
        simulation,
        analysisComponentFailureCount: componentFailures,
        continuityDisposition: componentFailures > 0 ? 'CONTINUE_WITH_LIMITATION' : 'COMPLETE_EVIDENCE'
      }, now);
    }
  }

  const componentFailures = analysisFailureCount(analysis);
  const hardStop = hasHardStop(analysis);
  if (hardStop) {
    return failureResult(request, startedAt, new Error('Analysis component requires execution stop'), {
      build,
      deploymentGasEvidence,
      analysis,
      simulation,
      analysisComponentFailureCount: componentFailures,
      continuityDisposition: 'STOP_EXECUTION'
    }, now);
  }

  if (request.phaseId === 'fork-simulation-lifecycle') {
    try {
      simulation = await executePhase7Simulation({ request, build, environment, startSimulationEngine, executeSimulationWorkflow });
    } catch (error) {
      simulation = error.simulationEvidence ?? simulation;
      const failedSteps = simulation?.steps?.filter((step) => step.status === 'failed') ?? [];
      return failureResult(request, startedAt, error, {
        build,
        deploymentGasEvidence,
        analysis,
        simulation,
        analysisComponentFailureCount: componentFailures,
        failedStepCount: failedSteps.length,
        failedSteps,
        continuityDisposition: 'CONTINUE_WITH_LIMITATION'
      }, now);
    }
  }

  const failedSteps = simulation?.steps?.filter((step) => step.status === 'failed') ?? [];
  return {
    schemaVersion: 'deep-assurance-github-native-execution-v2',
    requestId: request.requestId,
    requestDigest: request.requestDigest,
    profileId: request.profileId,
    source: structuredClone(request.source),
    status: 'completed',
    build,
    deploymentGasEvidence,
    analysis,
    simulation,
    analysisComponentFailureCount: componentFailures,
    failedStepCount: failedSteps.length,
    failedSteps,
    continuityDisposition: componentFailures > 0 || failedSteps.length > 0 ? 'CONTINUE_WITH_LIMITATION' : 'COMPLETE_EVIDENCE',
    startedAt,
    finishedAt: nowIso(now)
  };
}
