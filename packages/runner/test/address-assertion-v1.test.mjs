import test from 'node:test';
import assert from 'node:assert/strict';
import { valuesEqualForAssertion } from '../src/engine.mjs';

test('assertion equality treats EVM addresses as identical regardless of checksum casing', () => {
  assert.equal(
    valuesEqualForAssertion(
      '0xf939E0A03FB07F59A73314E73794Be0E57ac1b4E',
      '0xf939e0a03fb07f59a73314e73794be0e57ac1b4e'
    ),
    true
  );
});

test('assertion equality remains strict for non-address strings', () => {
  assert.equal(valuesEqualForAssertion('ABC', 'abc'), false);
});
