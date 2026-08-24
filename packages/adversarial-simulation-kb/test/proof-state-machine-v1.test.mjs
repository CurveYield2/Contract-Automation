import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PROOF_TIERS_V1,
  evaluateProofTransitionV1,
  validateProofEvidenceForTierV1,
  invalidateProofForExecutableChangeV1,
  canAutoScheduleV1,
} from '../src/proof/state-machine-v1.mjs';

const SHA_A='a'.repeat(64);
const SHA_B='b'.repeat(64);

function proof(overrides={}){
  return {
    proofId:'PROOF-0099',
    knowledgeRef:'RECIPE-0099',
    proofTier:'SCHEMA_VALID',
    status:'ACTIVE',
    evidenceRefs:['schema:recipe-0099'],
    artifactDigests:[],
    runIds:[],
    qualifiedAtCommit:'1'.repeat(40),
    limitations:[],
    ...overrides,
  };
}

test('K10 proof tiers are exact and ordered from reference-only through qualified',()=>{
  assert.deepEqual(PROOF_TIERS_V1,[
    'REFERENCE_ONLY',
    'SCHEMA_VALID',
    'COMPILES',
    'CONTROLLED_REPRODUCTION',
    'HISTORICAL_REPRODUCTION',
    'GENERALIZED_VARIANT_PROVEN',
    'QUALIFIED',
  ]);
});

test('K10 advancement is stepwise and manual skips to QUALIFIED fail closed',()=>{
  const current=proof();
  const compileEvidence={evidenceRefs:['compile-log'],artifactDigests:[SHA_A],runIds:['run-compile-1']};
  assert.equal(evaluateProofTransitionV1(current,'COMPILES',compileEvidence).status,'PASS');
  assert.equal(evaluateProofTransitionV1(current,'CONTROLLED_REPRODUCTION',compileEvidence).status,'FAIL');
  assert.equal(evaluateProofTransitionV1(current,'QUALIFIED',compileEvidence).status,'FAIL');

  const generalized=proof({
    proofTier:'GENERALIZED_VARIANT_PROVEN',
    evidenceRefs:['generalized-fixture'],
    artifactDigests:[SHA_A],
    runIds:['run-generalized-1'],
  });
  const qualification={evidenceRefs:['qualification-gate'],artifactDigests:[SHA_B],runIds:['run-qualification-1']};
  assert.equal(evaluateProofTransitionV1(generalized,'QUALIFIED',qualification).status,'PASS');
});

test('K10 executable proof tiers require run identity and artifact evidence while SCHEMA_VALID does not',()=>{
  assert.equal(validateProofEvidenceForTierV1('SCHEMA_VALID',{evidenceRefs:['schema-pass'],artifactDigests:[],runIds:[]}).status,'PASS');
  assert.equal(validateProofEvidenceForTierV1('COMPILES',{evidenceRefs:['compile-log'],artifactDigests:[],runIds:['run-1']}).status,'FAIL');
  assert.equal(validateProofEvidenceForTierV1('COMPILES',{evidenceRefs:['compile-log'],artifactDigests:[SHA_A],runIds:[]}).status,'FAIL');
  assert.equal(validateProofEvidenceForTierV1('COMPILES',{evidenceRefs:['compile-log'],artifactDigests:[SHA_A],runIds:['run-1']}).status,'PASS');
  assert.equal(validateProofEvidenceForTierV1('CONTROLLED_REPRODUCTION',{evidenceRefs:['effect-evidence'],artifactDigests:[SHA_A],runIds:['run-2']}).status,'PASS');
});

test('K10 executable content change invalidates scheduling until requalification',()=>{
  const qualified=proof({
    proofTier:'QUALIFIED',
    evidenceRefs:['qualification-gate'],
    artifactDigests:[SHA_A],
    runIds:['run-qualified-1'],
  });
  assert.equal(canAutoScheduleV1(qualified),true);

  const unchanged=invalidateProofForExecutableChangeV1(qualified,{previousDigest:SHA_A,newDigest:SHA_A});
  assert.equal(unchanged.status,'ACTIVE');
  assert.equal(canAutoScheduleV1(unchanged),true);

  const changed=invalidateProofForExecutableChangeV1(qualified,{previousDigest:SHA_A,newDigest:SHA_B});
  assert.equal(changed.status,'REQUALIFICATION_REQUIRED');
  assert.equal(changed.proofTier,'QUALIFIED');
  assert.equal(canAutoScheduleV1(changed),false);
  assert.equal(changed.invalidationReason,'EXECUTABLE_CONTENT_CHANGED');
});

test('K10 REFERENCE_ONLY and every non-qualified or inactive proof cannot auto-schedule',()=>{
  for(const tier of PROOF_TIERS_V1.slice(0,-1)) assert.equal(canAutoScheduleV1(proof({proofTier:tier})),false,tier);
  assert.equal(canAutoScheduleV1(proof({proofTier:'QUALIFIED',status:'REQUALIFICATION_REQUIRED'})),false);
  assert.equal(canAutoScheduleV1(proof({proofTier:'QUALIFIED',status:'DISPUTED'})),false);
  assert.equal(canAutoScheduleV1(proof({proofTier:'QUALIFIED',status:'ACTIVE'})),true);
});

test('K10 invalid lifecycle status or missing prerequisite evidence blocks advancement',()=>{
  const current=proof({status:'REFERENCE_ONLY'});
  const compileEvidence={evidenceRefs:['compile-log'],artifactDigests:[SHA_A],runIds:['run-compile-1']};
  assert.equal(evaluateProofTransitionV1(current,'COMPILES',compileEvidence).status,'FAIL');
  assert.equal(evaluateProofTransitionV1(proof(),'COMPILES',{evidenceRefs:[],artifactDigests:[SHA_A],runIds:['run-compile-1']}).status,'FAIL');
  assert.equal(evaluateProofTransitionV1(proof(),'COMPILES',{evidenceRefs:['compile-log'],artifactDigests:['not-a-digest'],runIds:['run-compile-1']}).status,'FAIL');
  assert.equal(evaluateProofTransitionV1(proof({status:'QUALIFIED'}),'COMPILES',compileEvidence).status,'FAIL');
});
