import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const root = new URL('../audit-harnesses/cyvlsdt-v30-phase6-revenue-accounting-v4/', import.meta.url);

test('cyvlSDT revenue accounting v4 covers whole-number multi-depositor multi-source lifecycle', async () => {
  const manifest = JSON.parse(await fs.readFile(new URL('manifest.json', root), 'utf8'));
  const source = await fs.readFile(new URL('test/phase6/CyvlSdtRevenueAccountingHarness_v4.t.sol', root), 'utf8');
  const medusa = JSON.parse(await fs.readFile(new URL('medusa.json', root), 'utf8'));

  assert.equal(manifest?.bundleId, 'cyvlsdt-v30-phase6-revenue-accounting-v4');
  assert.equal(manifest?.supersedesBundleId, 'cyvlsdt-v30-phase6-system-v3');
  assert.equal(manifest?.repairReason, 'V3_UNRELATED_DISCOUNTED_SALE_CONSTRUCTOR_BLOCKED_MEDUSA');
  assert.equal(manifest?.productionSourceModified, false);
  assert.equal(manifest?.scope?.includes('CurveYieldVlSDTRevenueStaking'), true);
  assert.equal(manifest?.scope?.includes('CurveYieldVlSDTLocker'), true);
  assert.equal(manifest?.scope?.includes('CurveYieldVlSDTBoostMerchant'), true);
  assert.equal(manifest?.scope?.includes('CurveYieldVault'), true);
  assert.equal(manifest?.scope?.includes('CurveYieldRevenueStrategyV7'), true);
  assert.equal(manifest?.scope?.includes('CurveYieldRevenueConverter'), true);
  assert.equal(manifest?.scope?.includes('CurveYieldUsdcToSdtConverter'), true);

  // Keep the real audited revenue stack while removing the unrelated V3 constructor blocker.
  assert.match(source, /new CurveYieldVlSDTRevenueStaking\(/);
  assert.match(source, /new CurveYieldVlSDTLocker\(/);
  assert.match(source, /new CurveYieldVlSDTBoostMerchant\(/);
  assert.match(source, /new CurveYieldVault\(/);
  assert.match(source, /new CurveYieldRevenueStrategyV7\(/);
  assert.match(source, /new CurveYieldRevenueConverter\(/);
  assert.match(source, /new CurveYieldUsdcToSdtConverter\(/);
  assert.doesNotMatch(source, /CurveYieldCyGovDiscountedSaleConverter/);
  assert.doesNotMatch(source, /discountedSaleConverter\.activate/);

  // Baseline arithmetic is intentionally human-readable and exactly divisible.
  assert.match(source, /DIRECT_STAKE_A\s*=\s*1_000e18/);
  assert.match(source, /DIRECT_STAKE_B\s*=\s*2_000e18/);
  assert.match(source, /DIRECT_STAKE_C\s*=\s*3_000e18/);
  assert.match(source, /VAULT_DEPOSIT\s*=\s*4_000e18/);
  assert.match(source, /VLSDT_FEE_REWARD\s*=\s*1_000e6/);
  assert.match(source, /MERCHANT_REVENUE\s*=\s*2_000e6/);
  assert.match(source, /BASELINE_TOTAL_ACTIVE\s*=\s*10_000e18/);

  // StakeDAO is faked only at its external fee/router boundary; audited Locker + staking remain real.
  assert.match(source, /contract Phase6FakeFeeDistributorV4/);
  assert.match(source, /function REWARD_TOKEN\(\) external view returns \(address\)/);
  assert.match(source, /contract Phase6FakeStakeDaoRouterV4/);
  assert.match(source, /locker\.claimVlSDTRewards\(\)/);

  // Merchant revenue must traverse the real Boost Merchant path into Revenue Staking.
  assert.match(source, /boostMerchant\.setPaymentToken\(/);
  assert.match(source, /leaseBoost\(/);
  assert.match(source, /MERCHANT_REVENUE/);
  assert.match(source, /merchantRevenueInjected/);

  // Vault/strategy/converter lifecycle must deposit, earn, harvest, compound, and withdraw.
  assert.match(source, /vault\.deposit\(/);
  assert.match(source, /vault\.earn\(\)/);
  assert.match(source, /strategy\.harvest/);
  assert.match(source, /vault\.withdraw/);
  assert.match(source, /revenueConverter\.setUsdcRoute/);
  assert.match(source, /CurveYieldUsdcToSdtConverter/);

  // Deterministic scenario checks accounting immediately after every valid state transition.
  assert.match(source, /function testWholeNumberMultiSourceRevenueAccounting\(\)/);
  assert.match(source, /_verifyAccountingCheckpoint\(/);
  assert.match(source, /expectedDirectA/);
  assert.match(source, /expectedDirectB/);
  assert.match(source, /expectedDirectC/);
  assert.match(source, /expectedStrategy/);
  assert.match(source, /totalRevenueInjected/);
  assert.match(source, /totalRevenueClaimed/);

  // Include queued + immediate exits and reward cycle time transitions, not only happy-path deposits.
  assert.match(source, /requestWithdrawal\(/);
  assert.match(source, /completeQueuedWithdrawal\(/);
  assert.match(source, /withdrawImmediate\(/);
  assert.match(source, /startRewardCycle\(/);
  assert.match(source, /claimRewardsSelf\(/);

  const targets = medusa?.fuzzing?.testing?.targetFunctionSignatures ?? [];
  for (const signature of [
    'CyvlSdtRevenueAccountingHarnessV4.actionRevenueStakeWhole(uint16)',
    'CyvlSdtRevenueAccountingHarnessV4.actionRevenueWithdrawWhole(uint16)',
    'CyvlSdtRevenueAccountingHarnessV4.actionQueueWithdrawalWhole(uint16)',
    'CyvlSdtRevenueAccountingHarnessV4.actionCompleteQueuedWithdrawal(uint16)',
    'CyvlSdtRevenueAccountingHarnessV4.actionVaultDepositWhole(uint16)',
    'CyvlSdtRevenueAccountingHarnessV4.actionVaultEarn()',
    'CyvlSdtRevenueAccountingHarnessV4.actionGenerateVlSdtYieldWhole(uint16)',
    'CyvlSdtRevenueAccountingHarnessV4.actionMerchantLeaseWhole(uint16)',
    'CyvlSdtRevenueAccountingHarnessV4.actionStartRewardCycle()',
    'CyvlSdtRevenueAccountingHarnessV4.actionClaimRewards(uint16)',
    'CyvlSdtRevenueAccountingHarnessV4.actionHarvestStrategy()',
    'CyvlSdtRevenueAccountingHarnessV4.actionVaultWithdrawWhole(uint16)'
  ]) assert.ok(targets.includes(signature), `missing Medusa target ${signature}`);

  assert.match(source, /property_revenue_stake_backing/);
  assert.match(source, /property_reward_source_conservation/);
  assert.match(source, /property_reward_claim_conservation/);
  assert.match(source, /property_vault_share_supply_reconciles/);
  assert.match(source, /property_transition_accounting_consistent/);
});
