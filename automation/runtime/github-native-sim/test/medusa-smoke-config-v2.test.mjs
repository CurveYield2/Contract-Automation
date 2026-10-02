import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMedusaSmokeConfigV1 } from '../src/medusa-e2e-smoke-v1.mjs';

test('real Medusa smoke keeps coverage enabled to avoid the pinned 1.5.1 CoverageTracer panic', () => {
  const config = buildMedusaSmokeConfigV1({
    contractName: 'MedusaSmokePassV1',
    targetFunctions: ['MedusaSmokePassV1.actionNoop(uint256)']
  });

  assert.equal(config.fuzzing.coverageEnabled, true);
  assert.equal(config.fuzzing.testing.propertyTesting.enabled, true);
  assert.equal(config.fuzzing.testing.stopOnNoTests, true);
});
