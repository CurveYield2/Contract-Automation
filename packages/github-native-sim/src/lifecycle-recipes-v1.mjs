export const V7_LIFECYCLE_RECIPES_V1 = Object.freeze({
  'external-readiness-v1': Object.freeze({
    purpose: 'Pinned external dependency identity and state assertions.',
    allowedActions: Object.freeze(['staticCall', 'assertCall', 'snapshot']),
  }),
  'deploy-configure-smoke-v1': Object.freeze({
    purpose: 'Deploy exact accepted artifacts and exercise intended configuration ordering.',
    allowedActions: Object.freeze(['deploy', 'call', 'staticCall', 'assertCall', 'expectRevert']),
  }),
  'deposit-withdraw-cycle-v1': Object.freeze({
    purpose: 'Complete custody, share-accounting, fee and withdrawal lifecycle.',
    allowedActions: Object.freeze(['setBalance', 'call', 'staticCall', 'assertCall', 'assertBalance', 'increaseTime', 'mine']),
  }),
  'reward-accrual-claim-v1': Object.freeze({
    purpose: 'Reward index, checkpoint, zero-supply, accrual and claim lifecycle.',
    allowedActions: Object.freeze(['setBalance', 'call', 'increaseTime', 'mine', 'staticCall', 'assertCall']),
  }),
  'privilege-transition-v1': Object.freeze({
    purpose: 'Owner, DAO, operator, keeper or delegation transition and stale-state assertions.',
    allowedActions: Object.freeze(['call', 'expectRevert', 'staticCall', 'assertCall', 'snapshot', 'revertSnapshot']),
  }),
  'external-swap-minout-v1': Object.freeze({
    purpose: 'External route identity, units and atomic final minOut protection.',
    allowedActions: Object.freeze(['setBalance', 'call', 'staticCall', 'expectRevert', 'snapshot', 'revertSnapshot']),
  }),
  'zero-supply-restart-v1': Object.freeze({
    purpose: 'Final-exit and first-redeposit value attribution across zero supply.',
    allowedActions: Object.freeze(['call', 'increaseTime', 'mine', 'staticCall', 'assertCall', 'snapshot']),
  }),
  'repeated-lifecycle-v1': Object.freeze({
    purpose: 'Repeat an applicable standard recipe for at least two full cycles.',
    allowedActions: Object.freeze(['deploy', 'call', 'staticCall', 'expectRevert', 'setBalance', 'transferNative', 'mine', 'increaseTime', 'snapshot', 'revertSnapshot', 'assertBalance', 'assertCall']),
  }),
});

export function getV7LifecycleRecipeV1(recipeId) {
  const recipe = V7_LIFECYCLE_RECIPES_V1[recipeId];
  if (!recipe) {
    return {
      status: 'RECIPE_GAP',
      recipeId,
      supportedRecipeIds: Object.keys(V7_LIFECYCLE_RECIPES_V1).sort(),
    };
  }
  return { status: 'SUPPORTED', recipeId, recipe: structuredClone(recipe) };
}

export function validateWorkflowAgainstV7RecipeV1(recipeId, workflow) {
  const resolved = getV7LifecycleRecipeV1(recipeId);
  if (resolved.status !== 'SUPPORTED') return resolved;
  const allowed = new Set(resolved.recipe.allowedActions);
  const unsupported = (workflow?.steps ?? [])
    .map((step, index) => ({ index, action: step?.action }))
    .filter(({ action }) => !allowed.has(action));
  return {
    status: unsupported.length === 0 ? 'SUPPORTED' : 'RECIPE_GAP',
    recipeId,
    unsupported,
    recipe: resolved.recipe,
  };
}
