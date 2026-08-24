import test from 'node:test';
import assert from 'node:assert/strict';
import { validateWorkflowAgainstV7RecipeV1 } from '../src/lifecycle-recipes-v1.mjs';

const productionRecipes = [
  'deposit-withdraw-cycle-v1',
  'reward-accrual-claim-v1',
  'privilege-transition-v1',
  'external-swap-minout-v1',
  'zero-supply-restart-v1',
];

test('Phase 7 production lifecycle recipes reject function testing without a fresh audited-contract deployment', () => {
  for (const recipeId of productionRecipes) {
    const result = validateWorkflowAgainstV7RecipeV1(recipeId, {
      steps: [
        { action: 'call', target: '$vault', function: 'harvest()', args: [], from: '$account0', label: 'test deployed protocol function' },
      ],
    });
    assert.equal(result.status, 'RECIPE_GAP', recipeId);
    assert.equal(result.deploymentPrerequisite?.status, 'MISSING_FRESH_DEPLOYMENT', recipeId);
  }
});

test('Phase 7 production lifecycle recipes accept deployed aliases only after their deploy step', () => {
  for (const recipeId of productionRecipes) {
    const result = validateWorkflowAgainstV7RecipeV1(recipeId, {
      steps: [
        { action: 'deploy', alias: 'vault', contract: 'CurveYieldVault', source: 'contracts/CurveYieldVault.sol', args: [], from: '$account0', label: 'deploy audited vault' },
        { action: 'call', target: '$vault', function: 'harvest()', args: [], from: '$account0', label: 'test deployed protocol function' },
      ],
    });
    assert.equal(result.status, 'SUPPORTED', recipeId);
    assert.equal(result.deploymentPrerequisite?.status, 'SATISFIED', recipeId);
  }
});

test('Phase 7 production lifecycle recipes reject references to audited aliases before deployment', () => {
  const result = validateWorkflowAgainstV7RecipeV1('zero-supply-restart-v1', {
    steps: [
      { action: 'call', target: '$vault', function: 'deposit(uint256)', args: ['1'], from: '$account1', label: 'premature function test' },
      { action: 'deploy', alias: 'vault', contract: 'CurveYieldVault', source: 'contracts/CurveYieldVault.sol', args: [], from: '$account0', label: 'late deploy' },
    ],
  });
  assert.equal(result.status, 'RECIPE_GAP');
  assert.deepEqual(result.deploymentPrerequisite?.aliasesUsedBeforeDeployment, ['vault']);
});

test('external readiness remains read-only and does not require deploying third-party dependencies', () => {
  const result = validateWorkflowAgainstV7RecipeV1('external-readiness-v1', {
    steps: [
      { action: 'staticCall', target: '0x0000000000000000000000000000000000000001', function: 'foo() view returns (uint256)', args: [], saveAs: 'probe', label: 'probe external dependency' },
    ],
  });
  assert.equal(result.status, 'SUPPORTED');
  assert.equal(result.deploymentPrerequisite?.status, 'NOT_REQUIRED');
});

test('deploy-configure smoke supports snapshot rollback around a deployment-first live suite', () => {
  const result = validateWorkflowAgainstV7RecipeV1('deploy-configure-smoke-v1', {
    steps: [
      { action: 'snapshot', alias: 'baseline', label: 'pin suite baseline' },
      { action: 'deploy', alias: 'vault', contract: 'CurveYieldVault', source: 'contracts/CurveYieldVault.sol', args: [], from: '$account0', label: 'deploy audited vault' },
      { action: 'staticCall', target: '$vault', function: 'totalSupply() view returns (uint256)', args: [], saveAs: 'supply', label: 'test freshly deployed vault' },
      { action: 'revertSnapshot', snapshot: '$baseline', label: 'restore suite baseline' },
    ],
  });
  assert.equal(result.status, 'SUPPORTED');
  assert.equal(result.deploymentPrerequisite?.status, 'SATISFIED');
  assert.deepEqual(result.unsupported, []);
});
