import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const CYVL_FOUNDRY = new URL('../audit-harnesses/cyvlsdt-v30-phase6-vault-v1/foundry.toml', import.meta.url);
const SMOKE_SOURCE = new URL('../src/medusa-e2e-smoke-v1.mjs', import.meta.url);

const REQUIRED_VYPER_SKIPS = [
  'contracts/CurveYieldGovernanceStaking.vy',
  'contracts/external/curve/ChildGauge.vy'
];

test('cyvlSDT Medusa Foundry view excludes only the two frozen Vyper sources that trigger crytic-compile sourceMap parsing', async () => {
  const foundry = await fs.readFile(CYVL_FOUNDRY, 'utf8');
  assert.match(foundry, /skip\s*=\s*\[/, 'audit-only Foundry config must define an explicit compilation skip list');
  for (const source of REQUIRED_VYPER_SKIPS) {
    assert.equal(foundry.includes(`"${source}"`), true, `missing exact Vyper skip: ${source}`);
  }
  assert.equal(foundry.includes('contracts/CurveYieldVault.sol'), false, 'vault production Solidity must never be skipped');
  assert.equal(foundry.includes('test/phase6/CyvlSdtVaultPhase6Harness_v1.t.sol'), false, 'Phase-6 harness must never be skipped');
});

test('trusted-main Medusa E2E qualification includes a mixed Solidity/Vyper fixture guarded by Foundry skip', async () => {
  const smoke = await fs.readFile(SMOKE_SOURCE, 'utf8');
  assert.match(smoke, /mixedLanguagePass/, 'real Medusa smoke must include a mixed-language compatibility case');
  assert.match(smoke, /\.vy/, 'mixed-language smoke must materialize a Vyper source');
  assert.match(smoke, /skip\s*=|skipEntries|foundrySkip/, 'mixed-language smoke must exercise Foundry compilation exclusion');
  assert.match(smoke, /medusaSmokeMixedLanguagePass/, 'qualification summary must fail closed if mixed-language Medusa compilation regresses');
});
