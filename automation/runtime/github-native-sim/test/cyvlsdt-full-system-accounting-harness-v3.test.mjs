import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const root = new URL('../audit-harnesses/cyvlsdt-v30-phase6-system-v3/', import.meta.url);

test('cyvlSDT system harness v3 simulates StakeDAO vlSDT yield with interface-valid audit fakes', async () => {
  const manifest = JSON.parse(await fs.readFile(new URL('manifest.json', root), 'utf8'));
  const source = await fs.readFile(new URL('test/phase6/CyvlSdtSystemPhase6Harness_v3.t.sol', root), 'utf8');
  const medusa = JSON.parse(await fs.readFile(new URL('medusa.json', root), 'utf8'));

  assert.equal(manifest?.bundleId, 'cyvlsdt-v30-phase6-system-v3');
  assert.equal(manifest?.supersedesBundleId, 'cyvlsdt-v30-phase6-system-v2');
  assert.equal(manifest?.repairReason, 'V2_LOCKER_REJECTED_NON_INTERFACE_FAKE_FEE_DISTRIBUTORS');
  assert.equal(manifest?.productionSourceModified, false);

  assert.match(source, /contract Phase6FakeFeeDistributorV3/);
  assert.match(source, /function REWARD_TOKEN\(\) external view returns \(address\)/);
  assert.match(source, /contract Phase6FakeStakeDaoRouterV3/);
  assert.match(source, /function seedYield\(uint256 amount\)/);
  assert.match(source, /function execute\(bytes\[\] calldata/);

  const lockerDeploy = source.indexOf('locker = new CurveYieldVlSDTLocker(');
  assert.ok(lockerDeploy >= 0, 'Locker deployment missing');
  const lockerSlice = source.slice(lockerDeploy, source.indexOf(');', lockerDeploy) + 2);
  assert.match(lockerSlice, /address\(fakeStakeDaoRouter\)/);
  assert.match(lockerSlice, /address\(fakeUsdcFeeDistributor\)/);
  assert.match(lockerSlice, /address\(fakeSdtFeeDistributor\)/);
  assert.equal(lockerSlice.includes('address(dependency), address(dependency), address(dependency), address(dependency)'), false,
    'v2 non-interface fake dependency tuple must not recur');

  assert.match(source, /locker\.configureSystem\(address\(revenueStaking\), address\(boostMerchant\), address\(boostStaking\)\)/);
  assert.match(source, /function actionGenerateVlSdtYield\(uint96 rawAmount\) external/);
  assert.match(source, /locker\.claimVlSDTRewards\(\)/);
  assert.match(source, /vlSdtYieldGenerationCalls/);
  assert.match(source, /successfulTransitions \+ revertedTransitions == calls/);

  assert.ok(
    medusa?.fuzzing?.testing?.targetFunctionSignatures?.includes('CyvlSdtSystemPhase6HarnessV3.actionGenerateVlSdtYield(uint96)'),
    'Medusa must actively fuzz the fake vlSDT yield generation lifecycle'
  );
});
