import test from 'node:test';
import assert from 'node:assert/strict';
import {preflightSlitherV1} from '../src/preflight/slither-v1.mjs';

const ok={
  acceptedBuildDigest:'a'.repeat(64),
  acceptedBuildStatus:'PASS',
  observedVersion:'0.11.6',
  soliditySourceCount:2,
  buildViewCompatible:true,
  buildViewEvidence:{compatible:true},
  targetSmokeStatus:'PASS',
  targetSmokeEvidence:{status:'PASS',outputParseable:true},
  smokeOutputParseable:true,
  normalizedResultAuthoritative:false
};

test('slither exact build/version PASS',()=>assert.equal(preflightSlitherV1(ok).status,'PREFLIGHT_PASS'));
test('build failure blocks slither',()=>assert.equal(preflightSlitherV1({...ok,acceptedBuildStatus:'FAIL'}).firstFailure,'SLITHER_BUILD_NOT_ACCEPTED'));
test('unparseable target smoke is a distinct output-contract failure',()=>assert.equal(preflightSlitherV1({...ok,targetSmokeStatus:'PASS',smokeOutputParseable:false}).firstFailure,'SLITHER_SMOKE_OUTPUT_INCOMPATIBLE'));
