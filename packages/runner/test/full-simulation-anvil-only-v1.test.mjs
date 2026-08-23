import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { selectForkEngineName } from '../src/anvil-engine.mjs';

const runJobPath = fileURLToPath(new URL('../../github-native-sim/src/run-job-file.mjs', import.meta.url));

test('full fork simulation backend policy is Anvil-only for every EVM version', () => {
  for (const evmVersion of ['frontier', 'london', 'shanghai', 'cancun', 'prague', 'osaka', undefined]) {
    assert.equal(selectForkEngineName(evmVersion), 'anvil', `full simulation backend must be Anvil for ${evmVersion ?? 'unspecified'} EVM version`);
  }
});

test('V7 Phase-7 runner is wired directly to Anvil and cannot silently fall back to Ganache', () => {
  const source = fs.readFileSync(runJobPath, 'utf8');
  assert.match(source, /import \{ startAnvilEngine \} from '\.\.\/\.\.\/runner\/src\/anvil-engine\.mjs';/);
  assert.doesNotMatch(source, /startCompatibleForkEngine/);
  assert.match(source, /startSimulationEngine = startAnvilEngine/);
});
