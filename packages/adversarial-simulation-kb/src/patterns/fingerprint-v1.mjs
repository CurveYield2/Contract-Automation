import { validatePrimitiveTagsV1 } from '../taxonomy/validate-v1.mjs';

const TOKEN=/^[A-Z][A-Z0-9_]*$/;
const REQUIRED_TEXT_FIELDS=Object.freeze([
  'protocolTopology',
  'assetAccountingModel',
  'triggerAction',
  'incorrectAssumption',
  'violatedInvariantClass',
  'valueExtractionMechanism',
  'externalDependencyRole',
]);
const REQUIRED_ARRAY_FIELDS=Object.freeze([
  'stateVariableClass',
  'attackerCapabilities',
  'primitiveRefs',
]);

function token(value){
  return typeof value==='string'
    ? value.trim().toUpperCase().replace(/[^A-Z0-9]+/g,'_').replace(/^_+|_+$/g,'')
    : '';
}
function sortedTokens(values){
  if(!Array.isArray(values)) return [];
  return [...new Set(values.map(token).filter(Boolean))].sort();
}

export function buildRootCauseFingerprintV1(input={}){
  return {
    schemaVersion:'adversarial-kb-root-cause-fingerprint-v1',
    protocolTopology:token(input.protocolTopology),
    stateVariableClass:sortedTokens(input.stateVariableClass),
    assetAccountingModel:token(input.assetAccountingModel),
    attackerCapabilities:sortedTokens(input.attackerCapabilities),
    triggerAction:token(input.triggerAction),
    incorrectAssumption:token(input.incorrectAssumption),
    violatedInvariantClass:token(input.violatedInvariantClass),
    valueExtractionMechanism:token(input.valueExtractionMechanism),
    externalDependencyRole:token(input.externalDependencyRole),
    primitiveRefs:sortedTokens(input.primitiveRefs),
  };
}

export function validateRootCauseFingerprintV1(fingerprint){
  const errors=[];
  if(!fingerprint||typeof fingerprint!=='object'||Array.isArray(fingerprint)){
    return {status:'FAIL',errors:[{code:'FINGERPRINT_OBJECT_REQUIRED'}]};
  }
  if(fingerprint.schemaVersion!=='adversarial-kb-root-cause-fingerprint-v1') errors.push({code:'SCHEMA_VERSION'});
  for(const field of REQUIRED_TEXT_FIELDS){
    if(typeof fingerprint[field]!=='string'||!TOKEN.test(fingerprint[field])) errors.push({code:'TOKEN_REQUIRED',field});
  }
  for(const field of REQUIRED_ARRAY_FIELDS){
    const values=fingerprint[field];
    if(!Array.isArray(values)||values.length===0){ errors.push({code:'NONEMPTY_TOKEN_ARRAY_REQUIRED',field}); continue; }
    const normalized=sortedTokens(values);
    if(normalized.length!==values.length||normalized.some((value,index)=>value!==values[index])) errors.push({code:'CANONICAL_TOKEN_ARRAY_REQUIRED',field});
  }
  if(Array.isArray(fingerprint.primitiveRefs)){
    const primitiveResult=validatePrimitiveTagsV1(fingerprint.primitiveRefs);
    if(primitiveResult.status!=='PASS') errors.push({code:'INVALID_PRIMITIVE_REFS',detail:primitiveResult.errors});
  }
  return {status:errors.length?'FAIL':'PASS',errors};
}

export function fingerprintKeyV1(fingerprint){
  const validation=validateRootCauseFingerprintV1(fingerprint);
  if(validation.status!=='PASS') throw new Error(`invalid root-cause fingerprint: ${JSON.stringify(validation.errors)}`);
  return [
    'rcf-v1',
    `topology=${fingerprint.protocolTopology}`,
    `state=${fingerprint.stateVariableClass.join(',')}`,
    `accounting=${fingerprint.assetAccountingModel}`,
    `capabilities=${fingerprint.attackerCapabilities.join(',')}`,
    `trigger=${fingerprint.triggerAction}`,
    `assumption=${fingerprint.incorrectAssumption}`,
    `invariant=${fingerprint.violatedInvariantClass}`,
    `extraction=${fingerprint.valueExtractionMechanism}`,
    `dependency=${fingerprint.externalDependencyRole}`,
    `primitives=${fingerprint.primitiveRefs.join(',')}`,
  ].join('|');
}
