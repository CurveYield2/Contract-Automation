import { createHash } from 'node:crypto';
import { validateIncidentRelationshipsV1 } from '../incidents/relationships-v1.mjs';

const ID_FIELDS=Object.freeze({
  incidents:'incidentId',
  patterns:'patternId',
  recipes:'recipeId',
  executables:'executableId',
  proofs:'proofId',
});

function canonicalize(value){
  if(Array.isArray(value)) return value.map(canonicalize);
  if(value&&typeof value==='object'){
    return Object.fromEntries(Object.keys(value).sort().map((key)=>[key,canonicalize(value[key])]));
  }
  return value;
}
export function canonicalRegistryBytesV1(value){ return `${JSON.stringify(canonicalize(value))}\n`; }
export function digestRegistryV1(value){ return createHash('sha256').update(canonicalRegistryBytesV1(value)).digest('hex'); }

function array(value){ return Array.isArray(value)?value:[]; }
function text(value){ return typeof value==='string'?value.trim():''; }
function normalizeKey(value){ return text(value).toLowerCase().replace(/\s+/g,' '); }
function uniqueSorted(values){ return [...new Set(values)].sort(); }
function sortRecords(records,idField){ return [...records].map((entry)=>structuredClone(entry)).sort((a,b)=>String(a?.[idField]??'').localeCompare(String(b?.[idField]??''))); }
function addIndex(index,key,id){
  if(!key||!id) return;
  (index[key]??=[]).push(id);
}
function finalizeIndex(index){
  return Object.fromEntries(Object.keys(index).sort().map((key)=>[key,uniqueSorted(index[key])]));
}
function idsFor(records,idField){ return new Set(records.map((record)=>record?.[idField]).filter(Boolean)); }
function requireUnique(records,idField,errors){
  const seen=new Set();
  for(const record of records){
    const id=record?.[idField];
    if(typeof id!=='string'||id.length===0){ errors.push({code:'MISSING_ID',idField}); continue; }
    if(seen.has(id)) errors.push({code:'DUPLICATE_ID',idField,id});
    seen.add(id);
  }
}
function checkRefs(ownerId,field,refs,known,errors){
  for(const ref of array(refs)) if(!known.has(ref)) errors.push({code:'DANGLING_REFERENCE',ownerId,field,ref});
}

export function validateRegistryGraphV1(input={}){
  const corpus={
    incidents:array(input.incidents), patterns:array(input.patterns), recipes:array(input.recipes),
    executables:array(input.executables), proofs:array(input.proofs), relationships:array(input.relationships),
  };
  const errors=[];
  for(const [family,idField] of Object.entries(ID_FIELDS)) requireUnique(corpus[family],idField,errors);
  const incidentIds=idsFor(corpus.incidents,'incidentId');
  const patternIds=idsFor(corpus.patterns,'patternId');
  const recipeIds=idsFor(corpus.recipes,'recipeId');
  const executableIds=idsFor(corpus.executables,'executableId');
  const proofIds=idsFor(corpus.proofs,'proofId');

  for(const record of corpus.incidents){
    const id=record.incidentId;
    checkRefs(id,'generalizedPatternRefs',record.generalizedPatternRefs,patternIds,errors);
    checkRefs(id,'affectedPatterns',record.affectedPatterns,patternIds,errors);
    checkRefs(id,'reproductionRefs',record.reproductionRefs,executableIds,errors);
    if(record.proofStatusRef&&!proofIds.has(record.proofStatusRef)) errors.push({code:'DANGLING_REFERENCE',ownerId:id,field:'proofStatusRef',ref:record.proofStatusRef});
  }
  for(const record of corpus.patterns){
    const id=record.patternId;
    checkRefs(id,'historicalIncidentRefs',record.historicalIncidentRefs,incidentIds,errors);
    checkRefs(id,'recipeRefs',record.recipeRefs,recipeIds,errors);
  }
  for(const record of corpus.recipes){
    const id=record.recipeId;
    checkRefs(id,'patternRefs',record.patternRefs,patternIds,errors);
    checkRefs(id,'executableRefs',record.executableRefs,executableIds,errors);
    if(record.proofStatusRef&&!proofIds.has(record.proofStatusRef)) errors.push({code:'DANGLING_REFERENCE',ownerId:id,field:'proofStatusRef',ref:record.proofStatusRef});
  }
  for(const record of corpus.executables){
    const id=record.executableId;
    checkRefs(id,'incidentRefs',record.incidentRefs,incidentIds,errors);
    checkRefs(id,'patternRefs',record.patternRefs,patternIds,errors);
    checkRefs(id,'recipeRefs',record.recipeRefs,recipeIds,errors);
    if(record.proofStatusRef&&!proofIds.has(record.proofStatusRef)) errors.push({code:'DANGLING_REFERENCE',ownerId:id,field:'proofStatusRef',ref:record.proofStatusRef});
  }
  const knowledgeIds=new Set([...incidentIds,...patternIds,...recipeIds,...executableIds]);
  for(const record of corpus.proofs){
    if(record.knowledgeRef&&!knowledgeIds.has(record.knowledgeRef)) errors.push({code:'DANGLING_REFERENCE',ownerId:record.proofId,field:'knowledgeRef',ref:record.knowledgeRef});
  }

  const relationResult=validateIncidentRelationshipsV1(corpus.relationships,incidentIds);
  if(relationResult.status==='FAIL') errors.push(...relationResult.errors.map((error)=>({code:'INCIDENT_RELATIONSHIP',detail:error})));
  return {status:errors.length?'FAIL':'PASS',errors,relationships:relationResult.relationships??[]};
}

function duplicateMessage(error){
  if(error.code==='DUPLICATE_ID') return `duplicate ${error.idField}: ${error.id}`;
  if(error.code==='DANGLING_REFERENCE') return `dangling ${error.field}: ${error.ref}`;
  if(error.code==='INCIDENT_RELATIONSHIP') return `dangling or invalid incident relationship: ${JSON.stringify(error.detail)}`;
  return `registry validation failed: ${JSON.stringify(error)}`;
}

function registry(schemaVersion,records,extra={}){ return {schemaVersion,revision:1,records,...extra}; }
function indexRegistry(indexType,index){ return {schemaVersion:'adversarial-kb-index-v1',revision:1,indexType,index}; }

export function buildRegistriesV1(input={}){
  const graph=validateRegistryGraphV1(input);
  if(graph.status!=='PASS') throw new Error(duplicateMessage(graph.errors[0]));
  const incidents=sortRecords(array(input.incidents),'incidentId');
  const patterns=sortRecords(array(input.patterns),'patternId');
  const recipes=sortRecords(array(input.recipes),'recipeId');
  const executables=sortRecords(array(input.executables),'executableId');
  const proofs=sortRecords(array(input.proofs),'proofId');

  const byPrimitive={};
  for(const item of incidents) for(const primitive of array(item.attackPrimitives)) addIndex(byPrimitive,text(primitive),item.incidentId);
  for(const item of patterns) for(const primitive of array(item.rootCauseClass)) addIndex(byPrimitive,text(primitive),item.patternId);

  const byTopology={};
  for(const item of recipes) for(const topology of array(item.targetTopologies)) addIndex(byTopology,normalizeKey(topology),item.recipeId);

  const byChain={};
  for(const item of incidents) for(const chain of array(item.affectedChain)) addIndex(byChain,normalizeKey(chain),item.incidentId);

  const byProofStatus={};
  for(const item of proofs) addIndex(byProofStatus,text(item.proofTier),item.knowledgeRef);

  const registries={
    INCIDENT_REGISTRY_v1:registry('adversarial-kb-incident-registry-v1',incidents,{relationships:graph.relationships}),
    ATTACK_PATTERN_REGISTRY_v1:registry('adversarial-kb-attack-pattern-registry-v1',patterns),
    RECIPE_REGISTRY_v1:registry('adversarial-kb-recipe-registry-v1',recipes),
    EXECUTABLE_REGISTRY_v1:registry('adversarial-kb-executable-registry-v1',executables),
    BY_PRIMITIVE_v1:indexRegistry('PRIMITIVE',finalizeIndex(byPrimitive)),
    BY_PROTOCOL_TOPOLOGY_v1:indexRegistry('PROTOCOL_TOPOLOGY',finalizeIndex(byTopology)),
    BY_CHAIN_v1:indexRegistry('CHAIN',finalizeIndex(byChain)),
    BY_PROOF_STATUS_v1:indexRegistry('PROOF_TIER',finalizeIndex(byProofStatus)),
  };
  const digests=Object.fromEntries(Object.entries(registries).map(([name,value])=>[name,digestRegistryV1(value)]));
  return {registries,digests};
}
