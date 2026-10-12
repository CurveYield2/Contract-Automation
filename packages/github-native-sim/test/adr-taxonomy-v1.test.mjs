import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {loadTaxonomyV1, validateTaxonomyV1, classesForTriggersV1} from '../src/adr-taxonomy-v1.mjs';

const root = resolve(fileURLToPath(new URL('../../../', import.meta.url)));
const original = loadTaxonomyV1(root);
const copy = () => structuredClone(original);

test('real 18-class taxonomy validates', () => {
  const result = validateTaxonomyV1(original);
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.equal(result.value.classes.length, 18);
});
test('duplicate class is rejected', () => {
  const taxonomy=copy();
  taxonomy.classes[1].classId=taxonomy.classes[0].classId;
  assert.ok(validateTaxonomyV1(taxonomy).errors.some(x=>x.code==='TAXONOMY_DUPLICATE_CLASS'));
});
test('unknown class trigger is rejected', () => {
  const taxonomy=copy();
  taxonomy.classes[0].triggers.push('NOT_IN_REGISTRY');
  assert.ok(validateTaxonomyV1(taxonomy).errors.some(x=>x.code==='TAXONOMY_UNKNOWN_TRIGGER'));
});
test('state writes always get access control and state machine', () => {
  assert.deepEqual(classesForTriggersV1(original,['STATE_WRITE']),['ACCESS_CONTROL','STATE_MACHINE']);
});
test('trigger ordering does not affect class matching', () => {
  const a=['TOKEN_TRANSFER','ARITHMETIC_ON_STATE','STATE_WRITE_EXTERNAL','PAYABLE'];
  assert.deepEqual(classesForTriggersV1(original,a), classesForTriggersV1(original,[...a].reverse()));
});
