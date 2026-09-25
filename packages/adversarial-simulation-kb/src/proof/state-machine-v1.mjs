export const PROOF_TIERS_V1=Object.freeze([
  'REFERENCE_ONLY',
  'SCHEMA_VALID',
  'COMPILES',
  'CONTROLLED_REPRODUCTION',
  'HISTORICAL_REPRODUCTION',
  'GENERALIZED_VARIANT_PROVEN',
  'QUALIFIED',
]);

export const PROOF_LIFECYCLE_STATUS_V1=Object.freeze([
  'ACTIVE',
  'REQUALIFICATION_REQUIRED',
  'REFERENCE_ONLY',
  'DEPRECATED',
  'SUPERSEDED',
  'DISPUTED',
]);

const TIER_INDEX=new Map(PROOF_TIERS_V1.map((tier,index)=>[tier,index]));
const STATUS=new Set(PROOF_LIFECYCLE_STATUS_V1);
const SHA256=/^[0-9a-f]{64}$/;

function nonemptyStrings(values){
  return Array.isArray(values)&&values.length>0&&values.every(value=>typeof value==='string'&&value.trim().length>0);
}
function validDigests(values){
  return Array.isArray(values)&&values.length>0&&values.every(value=>typeof value==='string'&&SHA256.test(value));
}

export function validateProofEvidenceForTierV1(tier,evidence={}){
  const errors=[];
  if(!TIER_INDEX.has(tier)) return {status:'FAIL',errors:[{code:'UNKNOWN_PROOF_TIER',tier}]};

  const evidenceRefs=Array.isArray(evidence.evidenceRefs)?evidence.evidenceRefs:[];
  const artifactDigests=Array.isArray(evidence.artifactDigests)?evidence.artifactDigests:[];
  const runIds=Array.isArray(evidence.runIds)?evidence.runIds:[];

  if(tier==='REFERENCE_ONLY'){
    if(evidenceRefs.some(value=>typeof value!=='string'||!value.trim())) errors.push({code:'INVALID_EVIDENCE_REF'});
    return {status:errors.length?'FAIL':'PASS',errors};
  }

  if(!nonemptyStrings(evidenceRefs)) errors.push({code:'EVIDENCE_REFERENCE_REQUIRED'});

  if(TIER_INDEX.get(tier)>=TIER_INDEX.get('COMPILES')){
    if(!validDigests(artifactDigests)) errors.push({code:'ARTIFACT_DIGEST_REQUIRED'});
    if(!nonemptyStrings(runIds)) errors.push({code:'RUN_ID_REQUIRED'});
  } else {
    if(artifactDigests.length&&!artifactDigests.every(value=>typeof value==='string'&&SHA256.test(value))) errors.push({code:'INVALID_ARTIFACT_DIGEST'});
    if(runIds.length&&!runIds.every(value=>typeof value==='string'&&value.trim().length>0)) errors.push({code:'INVALID_RUN_ID'});
  }

  return {status:errors.length?'FAIL':'PASS',errors};
}

export function evaluateProofTransitionV1(currentProof,requestedTier,newEvidence={}){
  const errors=[];
  if(!currentProof||typeof currentProof!=='object'||Array.isArray(currentProof)) return {status:'FAIL',errors:[{code:'CURRENT_PROOF_REQUIRED'}]};
  if(!TIER_INDEX.has(currentProof.proofTier)) errors.push({code:'UNKNOWN_CURRENT_TIER',tier:currentProof.proofTier});
  if(!TIER_INDEX.has(requestedTier)) errors.push({code:'UNKNOWN_REQUESTED_TIER',tier:requestedTier});
  if(!STATUS.has(currentProof.status)) errors.push({code:'INVALID_LIFECYCLE_STATUS',status:currentProof.status});
  if(currentProof.status!=='ACTIVE') errors.push({code:'ACTIVE_STATUS_REQUIRED',status:currentProof.status});
  if(errors.length) return {status:'FAIL',errors};

  const currentIndex=TIER_INDEX.get(currentProof.proofTier);
  const requestedIndex=TIER_INDEX.get(requestedTier);
  if(requestedIndex!==currentIndex+1) errors.push({code:'NON_SEQUENTIAL_PROOF_ADVANCEMENT',from:currentProof.proofTier,to:requestedTier});

  const transitionEvidence={
    evidenceRefs:Array.isArray(newEvidence.evidenceRefs)?newEvidence.evidenceRefs:[],
    artifactDigests:Array.isArray(newEvidence.artifactDigests)?newEvidence.artifactDigests:[],
    runIds:Array.isArray(newEvidence.runIds)?newEvidence.runIds:[],
  };
  const evidenceValidation=validateProofEvidenceForTierV1(requestedTier,transitionEvidence);
  if(evidenceValidation.status!=='PASS') errors.push(...evidenceValidation.errors);

  const candidateEvidence={
    evidenceRefs:[...(currentProof.evidenceRefs??[]),...transitionEvidence.evidenceRefs],
    artifactDigests:[...(currentProof.artifactDigests??[]),...transitionEvidence.artifactDigests],
    runIds:[...(currentProof.runIds??[]),...transitionEvidence.runIds],
  };

  return {
    status:errors.length?'FAIL':'PASS',
    errors,
    fromTier:currentProof.proofTier,
    requestedTier,
    transitionEvidence,
    candidateEvidence,
  };
}

export function invalidateProofForExecutableChangeV1(proof,{previousDigest,newDigest}={}){
  if(!proof||typeof proof!=='object'||Array.isArray(proof)) throw new Error('proof object required');
  if(typeof previousDigest!=='string'||!SHA256.test(previousDigest)||typeof newDigest!=='string'||!SHA256.test(newDigest)) throw new Error('valid previous and new executable digests required');
  if(previousDigest===newDigest) return structuredClone(proof);
  return {
    ...structuredClone(proof),
    status:'REQUALIFICATION_REQUIRED',
    invalidationReason:'EXECUTABLE_CONTENT_CHANGED',
    invalidatedExecutableDigest:previousDigest,
    replacementExecutableDigest:newDigest,
  };
}

export function canAutoScheduleV1(proof){
  return Boolean(proof&&typeof proof==='object'&&!Array.isArray(proof)
    &&proof.proofTier==='QUALIFIED'
    &&proof.status==='ACTIVE');
}
