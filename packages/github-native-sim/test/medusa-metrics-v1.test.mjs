import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMedusaOutput } from '../src/analysis.mjs';

test('CLI evidence reports unavailable metric groups explicitly',()=>{
  const result=parseMedusaOutput('[PASSED] Property Test: property_ok()\n');
  assert.deepEqual(result.corpus,{});
  assert.deepEqual(result.coverage,{});
  assert.deepEqual(result.statistics,{});
  assert.deepEqual(result.metricAvailability,{corpus:'UNAVAILABLE_FROM_OUTPUT_MODE',coverage:'UNAVAILABLE_FROM_OUTPUT_MODE',statistics:'UNAVAILABLE_FROM_OUTPUT_MODE'});
});

test('JSON evidence marks present metric groups and does not invent absent ones',()=>{
  const result=parseMedusaOutput(JSON.stringify({status:'completed',properties:[],coverage:{covered:7},statistics:{calls:12}}));
  assert.equal(result.metricAvailability.coverage,'PRESENT');
  assert.equal(result.metricAvailability.statistics,'PRESENT');
  assert.equal(result.metricAvailability.corpus,'UNAVAILABLE_FROM_OUTPUT_MODE');
  assert.deepEqual(result.corpus,{});
});
