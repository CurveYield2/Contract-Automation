import path from 'node:path';
import {
  checkoutExactSource,
  safeRepositoryProjectPath,
  stageExactArchiveSource,
} from './execution.mjs';
import { validateDeepAssuranceRequestV2 } from './schema-v3.mjs';
import { runGitHubNativeJob as runGitHubNativeJobV3 } from './run-job-file-v3.mjs';
import { runPhase6ExecutionPreflightV1 } from './phase6-execution-preflight-v1.mjs';
import { runPhase7ForkPreflightV2 } from './phase7-fork-preflight-v2.mjs';
import { prepareAuditorHarnessOverlayV1 } from './auditor-harness-overlay-v1.mjs';

async function stageForPreflight(source, { workspaceRoot, environment }) {
  const checkoutRoot = path.join(workspaceRoot, 'preflight-checkout');
  const checkout = await checkoutExactSource({ repository: source.repository, commit: source.commit, destination: checkoutRoot }, { environment });
  const staged = source.archivePath
    ? await stageExactArchiveSource({
        checkoutRoot,
        workspaceRoot: path.join(workspaceRoot, 'preflight-stage'),
        archivePath: source.archivePath,
        archiveSha256: source.archiveSha256,
        projectPath: source.projectPath,
      })
    : null;
  return { commit: checkout.commit, projectRoot: staged?.projectRoot ?? safeRepositoryProjectPath(checkoutRoot, source.projectPath) };
}

function preflightFailure(request, preflight) {
  const repairRequired = preflight?.nextState === 'RUNNER_REPAIR_REBIND';
  return {
    schemaVersion: 'deep-assurance-github-native-execution-v2',
    requestId: request.requestId,
    requestDigest: request.requestDigest,
    profileId: request.profileId,
    source: structuredClone(request.source),
    status: 'failed',
    preflight,
    build: null,
    deploymentGasEvidence: null,
    analysis: {},
    simulation: null,
    analysisComponentFailureCount: 0,
    failedStepCount: 0,
    failedSteps: [],
    continuityDisposition: repairRequired ? 'RUNNER_REPAIR_REBIND_REQUIRED' : 'PREFLIGHT_BLOCKED',
    error: {
      name: 'V7ExecutionPreflightFailure',
      message: `${request.phaseId} preflight did not pass`,
      kind: preflight?.failureKind ?? (preflight?.nextState === 'PHASE6_HARNESS_CONSTRUCTION' ? 'AUDITOR_HARNESS_REQUIRED' : 'EXECUTION_PREFLIGHT_FAILURE'),
    },
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
  };
}

function auditorHarnessBinding(request) {
  const harness = request.configuration?.harness;
  return harness?.mode === 'auditor-generated' ? harness : null;
}

export async function runGitHubNativeJobV2(input, {
  workspaceRoot = path.resolve('.deep-assurance-work-v2'),
  environment = process.env,
  runnerCommit = process.env.GITHUB_SHA ?? null,
  auditHarnessRoot = null,
  ...delegateOptions
} = {}) {
  const request = validateDeepAssuranceRequestV2(input);
  let preflight = null;
  let auditHarnessEvidence = null;
  let analysisProjectRoot = null;

  if (request.phaseId === 'build-and-test') {
    const staged = await stageForPreflight(request.source, { workspaceRoot, environment });
    if (staged.commit !== request.source.commit) {
      throw new Error(`Phase 6 preflight source mismatch: expected ${request.source.commit}, received ${staged.commit}`);
    }

    preflight = await runPhase6ExecutionPreflightV1({
      request,
      projectRoot: staged.projectRoot,
      auditHarnessRoot,
      runnerCommit,
      ...(delegateOptions.runCommand ? { runCommand: delegateOptions.runCommand } : {}),
    });
    if (preflight.status !== 'PASS') return preflightFailure(request, preflight);

    const binding = auditorHarnessBinding(request);
    if (binding) {
      if (!auditHarnessRoot) {
        return preflightFailure(request, {
          ...preflight,
          status: 'BLOCKED',
          failureKind: 'AUDITOR_HARNESS_PATH_UNRESOLVED',
          nextState: 'PHASE6_HARNESS_CONSTRUCTION',
        });
      }
      auditHarnessEvidence = await prepareAuditorHarnessOverlayV1({
        projectRoot: staged.projectRoot,
        auditHarnessRoot,
        workspaceRoot: path.join(workspaceRoot, 'analysis-overlay'),
        expectedTreeSha256: binding.treeSha256,
      });
      analysisProjectRoot = auditHarnessEvidence.overlayRoot;
    }
  } else if (request.phaseId === 'fork-simulation-lifecycle') {
    preflight = await runPhase7ForkPreflightV2({ request, environment });
    if (preflight.status !== 'PASS') return preflightFailure(request, preflight);
  }

  const result = await runGitHubNativeJobV3(request, {
    workspaceRoot: path.join(workspaceRoot, 'execution'),
    environment,
    ...(analysisProjectRoot ? { analysisProjectRoot } : {}),
    ...delegateOptions,
  });

  return {
    ...result,
    preflight,
    auditHarness: auditHarnessEvidence
      ? {
          schemaVersion: auditHarnessEvidence.schemaVersion,
          mode: 'auditor-generated',
          requestPath: request.configuration.harness.path,
          treeSha256: auditHarnessEvidence.treeSha256,
          components: structuredClone(request.configuration.harness.components),
          fileCount: auditHarnessEvidence.fileCount,
          totalBytes: auditHarnessEvidence.totalBytes,
          files: structuredClone(auditHarnessEvidence.files),
          productionSourceMutation: false,
        }
      : null,
  };
}

export const runGitHubNativeJob = runGitHubNativeJobV2;
