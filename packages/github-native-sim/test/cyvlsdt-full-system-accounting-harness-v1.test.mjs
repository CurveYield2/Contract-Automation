import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const root = new URL('../audit-harnesses/cyvlsdt-v30-phase6-system-v1/', import.meta.url);

test('cyvlSDT Phase-6 supplemental harness covers the interconnected accounting state machine', async () => {
  const manifest = JSON.parse(await fs.readFile(new URL('manifest.json', root), 'utf8'));
  const medusa = JSON.parse(await fs.readFile(new URL('medusa.json', root), 'utf8'));
  const source = await fs.readFile(new URL('test/phase6/CyvlSdtSystemPhase6Harness_v1.t.sol', root), 'utf8');

  assert.equal(manifest?.schemaVersion, 'phase6-audit-harness-overlay-v1');
  assert.equal(manifest?.bundleId, 'cyvlsdt-v30-phase6-system-v1');
  assert.equal(manifest?.sourceBinding?.commit, '6bde63416a4611e127b8bb3a5958e6b6d874c188');
  assert.equal(manifest?.sourceBinding?.archiveSha256, 'cc5c4dc6f8aa5d2e48043f6c3a837317ce6a4590c291e7e0571e4206c7d9877a');

  assert.deepEqual(medusa?.fuzzing?.targetContracts, ['CyvlSdtSystemPhase6HarnessV1']);
  assert.equal(medusa?.fuzzing?.testing?.propertyTesting?.enabled, true);
  assert.equal(medusa?.fuzzing?.testing?.stopOnNoTests, true);
  const targets = medusa?.fuzzing?.testing?.targetFunctionSignatures ?? [];
  for (const required of [
    'actionRevenueStake(uint96)',
    'actionRevenueWithdraw(uint96)',
    'actionBoostDeposit(uint96)',
    'actionBoostWithdraw(uint96)',
    'actionVaultDeposit(uint96)',
    'actionVaultWithdraw(uint96)',
    'actionYieldStake(uint96)',
    'actionYieldWithdraw(uint96)',
    'actionNotifyReward(uint96)',
    'actionGovernanceReservation(uint96)',
    'actionConverterRoute(uint16)',
    'actionLockerAccounting(uint16)',
  ]) assert.ok(targets.includes(required), `missing randomized target ${required}`);

  for (const productionImport of [
    'CurveYieldVlSDTToken.sol',
    'CurveYieldVlSDTRevenueStaking.sol',
    'CurveYieldVlSDTBoostStaking.sol',
    'CurveYieldVault.sol',
    'CurveYieldRevenueStrategyV20.sol',
    'CurveYieldRevenueConverter.sol',
    'CurveYieldVlSDTLocker.sol',
    'CurveYieldVlSDTBoostMerchant.sol',
    'CurveYieldGovernanceToken.sol',
    'CurveYieldGovernanceMintController.sol',
    'CurveYieldCyGovYieldStaking.sol',
    'CurveYieldCyGovFraxswapConverter.sol',
    'CurveYieldCyGovDiscountedSaleConverterV9.sol',
  ]) assert.match(source, new RegExp(productionImport.replace('.', '\\.')));

  assert.match(source, /invariant_cross_module_cyvlsdt_conservation/);
  assert.match(source, /invariant_governance_cap_not_exceeded/);
  assert.match(source, /invariant_vault_share_supply_reconciles/);
});
