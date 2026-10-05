import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyBaselineResetV2 } from '../src/phase0-randomized-simulation-v1.mjs';

test('A11 expired or failed evm_revert blocks baseline reuse',()=>{
  assert.throws(
    ()=>verifyBaselineResetV2({reverted:false,expectedDigestSha256:'a'.repeat(64),observedDigestSha256:'a'.repeat(64)}),
    error=>error?.code==='PHASE0_BASELINE_REVERT_FAILED'
  );
});

test('A11 altered baseline sentinel blocks reuse even after a successful revert result',()=>{
  assert.throws(
    ()=>verifyBaselineResetV2({reverted:true,expectedDigestSha256:'a'.repeat(64),observedDigestSha256:'b'.repeat(64)}),
    error=>error?.code==='PHASE0_BASELINE_SENTINEL_MISMATCH'
  );
});

test('A11 matching reset and sentinel is admitted',()=>{
  assert.equal(
    verifyBaselineResetV2({reverted:true,expectedDigestSha256:'a'.repeat(64),observedDigestSha256:'a'.repeat(64)}).status,
    'PASS'
  );
});
