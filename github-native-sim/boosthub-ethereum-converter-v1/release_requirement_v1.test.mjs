// First red gate: the requested combined converter must exist before release tests can pass.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
test('a single deployable converter is supplied for every traced Ethereum route',()=>{
  assert.ok(fs.existsSync('contracts/BoostHubEthereumRewardConverter_v1.sol'), 'Missing unified converter: only separate deployed converters currently exist');
});
