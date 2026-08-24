import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const root = new URL('../audit-harnesses/cyvlsdt-v30-phase6-broad-system-accounting-v5/', import.meta.url);

const REQUIRED_PRODUCTION_SCOPE = [
  'CurveYieldVlSDTLocker',
  'CurveYieldVlSDTToken',
  'CurveYieldVlSDTRevenueStaking',
  'CurveYieldVault',
  'CurveYieldRevenueStrategyV7',
  'CurveYieldRevenueConverter',
  'CurveYieldUsdcToSdtConverter',
  'CurveYieldVlSDTBoostStaking',
  'CurveYieldVlSDTBoostMerchant',
  'CurveYieldGovernanceToken',
  'CurveYieldGovernanceStaking',
  'CurveYieldGovernanceMintController',
  'CurveYieldCyGovYieldStaking',
  'CurveYieldCyGovFraxswapConverter',
  'CurveYieldCyGovDiscountedSaleConverter'
];

const REQUIRED_ACTION_FAMILIES = [
  // Revenue staking / reward accounting.
  'actionRevenueStakeWhole',
  'actionRevenueWithdrawImmediateWhole',
  'actionRevenueRequestWithdrawalWhole',
  'actionRevenueCompleteQueuedWithdrawal',
  'actionRevenueClaimToken',
  'actionRevenueStartRewardCycle',
  'actionRevenueNotifyTokenWhole',
  'actionRevenueClaimGovernance',
  'actionRevenueGovernanceRateControlled',

  // Vault / strategy lifecycle and emergency states.
  'actionVaultDepositWhole',
  'actionVaultDepositAll',
  'actionVaultEarn',
  'actionVaultWithdrawWhole',
  'actionVaultWithdrawAll',
  'actionVaultRequestWithdrawalWhole',
  'actionVaultCompleteWithdrawal',
  'actionStrategyDeposit',
  'actionStrategyHarvest',
  'actionStrategyHarvestStrict',
  'actionStrategyRequestWithdrawWhole',
  'actionStrategyCompleteWithdraw',
  'actionStrategyPauseControlled',
  'actionStrategyUnpauseControlled',
  'actionStrategyPanicControlled',
  'actionStrategyConverterControlled',

  // Locker / backing / rewards / boost / emergency paths.
  'actionLockerDepositWhole',
  'actionLockerClaimVlSdtRewardsWhole',
  'actionLockerDonateSdtWhole',
  'actionLockerForwardMarketplaceRevenueWhole',
  'actionLockerReserveBoostWhole',
  'actionLockerReleaseBoostWhole',
  'actionLockerDelegateBoostWhole',
  'actionLockerReleaseDelegationWhole',
  'actionLockerRequestEmergencyWithdrawalWhole',
  'actionLockerCompleteEmergencyWithdrawal',

  // Boost staking and merchant revenue / marketplace.
  'actionBoostDepositWhole',
  'actionBoostWithdrawWhole',
  'actionBoostDelegateWhole',
  'actionBoostRedelegateWhole',
  'actionBoostReleaseDelegation',
  'actionBoostClaimGovernance',
  'actionBoostMultiplierControlled',
  'actionMerchantLeaseWhole',
  'actionMerchantCreateListingWhole',
  'actionMerchantUpdateListingWhole',
  'actionMerchantCancelListing',
  'actionMerchantAcceptOfferWhole',

  // Governance token / mint controller / yield staking.
  'actionGovReserveWhole',
  'actionGovIncreaseReservationWhole',
  'actionGovCancelReservation',
  'actionGovMintReserved',
  'actionMintControllerOneTimeWhole',
  'actionMintControllerPeriodicWhole',
  'actionMintControllerCancelPeriodic',
  'actionYieldStakeWhole',
  'actionYieldWithdrawWhole',
  'actionYieldWithdrawAll',
  'actionYieldClaim',
  'actionYieldCheckpoint',
  'actionYieldConfigControlled',

  // Token/converter accounting surfaces.
  'actionTokenTransferWhole',
  'actionTokenApproveWhole',
  'actionTokenTransferFromWhole',
  'actionTokenBurnWhole',
  'actionRevenueConvertWhole',
  'actionRevenueRouteControlled'
];

test('cyvlSDT v30 broad system accounting v5 covers material state-changing families fail-closed', async () => {
  const manifest = JSON.parse(await fs.readFile(new URL('manifest.json', root), 'utf8'));
  const source = await fs.readFile(new URL('test/phase6/CyvlSdtBroadSystemAccountingHarness_v5.t.sol', root), 'utf8');
  const medusa = JSON.parse(await fs.readFile(new URL('medusa.json', root), 'utf8'));

  assert.equal(manifest?.bundleId, 'cyvlsdt-v30-phase6-broad-system-accounting-v5');
  assert.equal(manifest?.baselineBundleId, 'cyvlsdt-v30-phase6-revenue-accounting-v4');
  assert.equal(manifest?.productionSourceModified, false);
  assert.equal(manifest?.exactV30StateChangingAbiSurfaces, 230);
  assert.equal(manifest?.coverageClaim, 'MATERIAL_ECONOMIC_AND_ACCOUNTING_STATE_MACHINE_NOT_ALL_ABI_SURFACES');
  assert.equal(manifest?.phase7ExactVyperAndDeploymentSupplementRequired, true);
  assert.ok(manifest?.randomizedActionFamilyCount >= 56, 'V5 must expose at least 56 materially distinct randomized action families');

  for (const name of REQUIRED_PRODUCTION_SCOPE) {
    assert.ok(manifest?.productionScope?.includes(name), `missing exact V30 production scope ${name}`);
  }

  // Preserve the human-readable multi-depositor/multi-source baseline from V4.
  assert.match(source, /DIRECT_STAKE_A\s*=\s*1_000e18/);
  assert.match(source, /DIRECT_STAKE_B\s*=\s*2_000e18/);
  assert.match(source, /DIRECT_STAKE_C\s*=\s*3_000e18/);
  assert.match(source, /VAULT_DEPOSIT\s*=\s*4_000e18/);
  assert.match(source, /VLSDT_FEE_REWARD\s*=\s*1_000e6/);
  assert.match(source, /MERCHANT_REVENUE\s*=\s*2_000e6/);
  assert.match(source, /BASELINE_TOTAL_ACTIVE\s*=\s*10_000e18/);

  // StakeDAO yield may be faked only at the external dependency boundary.
  assert.match(source, /contract Phase6FakeFeeDistributorV5/);
  assert.match(source, /function REWARD_TOKEN\(\) external view returns \(address\)/);
  assert.match(source, /contract Phase6FakeStakeDaoRouterV5/);
  assert.match(source, /claimVlSDTRewards/);

  // Every successful state-changing action must reconcile accounting immediately.
  assert.match(source, /function _afterSuccessfulTransition\(/);
  assert.match(source, /_verifyAllAccounting\(\)/);
  assert.match(source, /successfulTransitions/);
  assert.match(source, /revertedTransitions/);

  // Require explicit system-level conservation/state properties, not only no-revert fuzzing.
  for (const property of [
    'property_principal_conservation',
    'property_reward_source_conservation',
    'property_reward_claim_conservation',
    'property_vault_share_supply_reconciles',
    'property_strategy_stake_reconciles',
    'property_boost_capacity_reconciles',
    'property_governance_reservations_reconcile',
    'property_converter_flow_conservation',
    'property_transition_accounting_consistent'
  ]) assert.match(source, new RegExp(property));

  const targets = medusa?.fuzzing?.testing?.targetFunctionSignatures ?? [];
  assert.ok(targets.length >= 56, `expected >=56 Medusa action selectors, got ${targets.length}`);
  assert.ok((medusa?.fuzzing?.testLimit ?? 0) >= 100000, 'retain high-volume randomized campaign');
  assert.ok((medusa?.fuzzing?.callSequenceLength ?? 0) >= 180, 'retain long randomized state sequences');

  for (const family of REQUIRED_ACTION_FAMILIES) {
    assert.ok(targets.some((signature) => signature.includes(`.${family}(`) || signature.includes(`.${family}()`)), `missing Medusa action family ${family}`);
    assert.match(source, new RegExp(`function\\s+${family}\\b`), `missing harness action ${family}`);
  }
});
