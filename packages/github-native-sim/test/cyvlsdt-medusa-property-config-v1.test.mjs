import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const configUrl = new URL('../audit-harnesses/cyvlsdt-v30-phase6-vault-v1/medusa.json', import.meta.url);

test('cyvlSDT Phase-6 Medusa overlay must execute property tests and fail closed if none are discovered', async () => {
  const config = JSON.parse(await fs.readFile(configUrl, 'utf8'));
  const testing = config?.fuzzing?.testing;

  assert.equal(testing?.propertyTesting?.enabled, true);
  assert.deepEqual(testing?.propertyTesting?.testPrefixes, ['property_', 'invariant_']);
  assert.equal(testing?.stopOnNoTests, true);
  assert.deepEqual(config?.fuzzing?.targetContracts, ['CyvlSdtVaultPhase6HarnessV1']);
  assert.ok(Array.isArray(testing?.targetFunctionSignatures) && testing.targetFunctionSignatures.length > 0);
});
