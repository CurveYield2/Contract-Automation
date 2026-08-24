import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const root = new URL('../audit-harnesses/cyvlsdt-v30-phase6-system-v3/', import.meta.url);

test('cyvlSDT system harness v3 uses the real pinned StakeDAO Locker dependencies', async () => {
  const manifest = JSON.parse(await fs.readFile(new URL('manifest.json', root), 'utf8'));
  const source = await fs.readFile(new URL('test/phase6/CyvlSdtSystemPhase6Harness_v3.t.sol', root), 'utf8');

  assert.equal(manifest?.bundleId, 'cyvlsdt-v30-phase6-system-v3');
  assert.equal(manifest?.supersedesBundleId, 'cyvlsdt-v30-phase6-system-v2');
  assert.equal(manifest?.repairReason, 'V2_LOCKER_REJECTED_FAKE_FEE_DISTRIBUTORS');

  for (const address of [
    '0x0f542fA75c871EB1b93Ef881b73e46acF733392f',
    '0xCa94395469a88E9cAC0D5E5e308910E298270d30',
    '0x6d57d34259f6dc31c9a241c199822861940d38f9',
    '0xbc38D256E559FEd3fA95A6cdC633C667283fb6b8',
  ]) assert.match(source, new RegExp(address, 'i'));

  const lockerDeploy = source.indexOf('locker = new CurveYieldVlSDTLocker(');
  assert.ok(lockerDeploy >= 0, 'Locker deployment missing');
  const lockerSlice = source.slice(lockerDeploy, source.indexOf(');', lockerDeploy) + 2);
  assert.equal(lockerSlice.includes('address(dependency), address(dependency), address(dependency), address(dependency)'), false,
    'v2 fake dependency tuple must not recur');
  assert.match(lockerSlice, /STAKE_DAO_ROUTER/);
  assert.match(lockerSlice, /VLSDT_FEE_DISTRIBUTOR_USDC/);
  assert.match(lockerSlice, /VLSDT_FEE_DISTRIBUTOR_SDT/);
  assert.match(lockerSlice, /BOOST_MARKETPLACE/);
});
