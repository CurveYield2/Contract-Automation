import { runPhase7ForkPreflightV1 } from './phase7-fork-preflight-v1.mjs';
import { validateWorkflowAgainstV7RecipeV1 } from './lifecycle-recipes-v1.mjs';

export async function runPhase7ForkPreflightV2(options) {
  const request = options?.request;
  if (!request || request.phaseId !== 'fork-simulation-lifecycle') {
    throw new Error('Phase 7 fork preflight v2 requires fork-simulation-lifecycle request');
  }
  const workflow = request.configuration?.simulation?.workflow;
  const recipeId = request.configuration?.harness?.recipeId;
  if (typeof recipeId !== 'string' || recipeId.length === 0) {
    return {
      schemaVersion: 'audit-v7-phase7-fork-preflight-v2',
      status: 'FAIL',
      failureKind: 'RECIPE_GAP',
      requestId: request.requestId,
      sourceCommit: request.source?.commit ?? null,
      chain: request.configuration?.simulation?.chain ?? null,
      pinnedBlock: request.configuration?.simulation?.block ?? null,
      evmVersion: request.configuration?.evmVersion ?? null,
      recipeId: null,
      checks: {
        lifecycleRecipe: {
          status: 'FAIL',
          reason: 'configuration.harness.recipeId is mandatory for Phase 7 lifecycle execution',
        },
      },
      nextState: 'PHASE7_FORK_PREFLIGHT',
    };
  }

  const recipe = validateWorkflowAgainstV7RecipeV1(recipeId, workflow);
  if (recipe.status !== 'SUPPORTED') {
    return {
      schemaVersion: 'audit-v7-phase7-fork-preflight-v2',
      status: 'FAIL',
      failureKind: 'RECIPE_GAP',
      requestId: request.requestId,
      sourceCommit: request.source?.commit ?? null,
      chain: request.configuration?.simulation?.chain ?? null,
      pinnedBlock: request.configuration?.simulation?.block ?? null,
      evmVersion: request.configuration?.evmVersion ?? null,
      recipeId,
      checks: {
        lifecycleRecipe: {
          status: 'FAIL',
          recipeId,
          unsupported: recipe.unsupported ?? [],
          missingRequiredLabels: recipe.missingRequiredLabels ?? [],
          supportedRecipeIds: recipe.supportedRecipeIds ?? null,
        },
      },
      nextState: 'PHASE7_FORK_PREFLIGHT',
    };
  }

  const base = await runPhase7ForkPreflightV1(options);
  const lifecycleRecipe = {
    status: 'PASS',
    recipeId,
    purpose: recipe.recipe.purpose,
    requiredLabels: recipe.recipe.requiredLabels ?? [],
  };
  const checks = { ...(base.checks ?? {}), lifecycleRecipe };
  const allPass = Object.values(checks).every((check) => ['PASS', 'UNAVAILABLE'].includes(check?.status))
    && base.status === 'PASS';
  return {
    ...base,
    schemaVersion: 'audit-v7-phase7-fork-preflight-v2',
    status: allPass ? 'PASS' : base.status,
    recipeId,
    checks,
  };
}
