import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const root = new URL('../audit-harnesses/cyvlsdt-v30-phase6-system-v2/', import.meta.url);

test('cyvlSDT system harness v2 configures the real Locker only after both token and Locker exist', async () => {
  const manifest = JSON.parse(await fs.readFile(new URL('manifest.json', root), 'utf8'));
  const source = await fs.readFile(new URL('test/phase6/CyvlSdtSystemPhase6Harness_v2.t.sol', root), 'utf8');

  assert.equal(manifest?.bundleId, 'cyvlsdt-v30-phase6-system-v2');
  assert.equal(manifest?.supersedesBundleId, 'cyvlsdt-v30-phase6-system-v1');
  assert.equal(manifest?.repairReason, 'V1_CONSTRUCTOR_REVERT_TOKEN_LOCKER_CONFIGURATION_ORDER');

  const tokenDeploy = source.indexOf('cyvlSdt = new CurveYieldVlSDTToken(address(this));');
  const lockerDeploy = source.indexOf('locker = new CurveYieldVlSDTLocker(');
  const setLocker = source.indexOf('cyvlSdt.setLocker(address(locker));');
  assert.ok(tokenDeploy >= 0, 'token deployment missing');
  assert.ok(lockerDeploy > tokenDeploy, 'Locker must be deployed after token');
  assert.ok(setLocker > lockerDeploy, 'token Locker binding must occur after real Locker deployment');
  assert.equal(source.includes('cyvlSdt.setLocker(address(this));'), false, 'failed v1 self-Locker binding must not recur');
});
