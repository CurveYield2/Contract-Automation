const SOURCE_ID=/^SOURCE-[0-9]{4}$/;
const TX=/^0x[0-9a-fA-F]{64}$/;
const ADDRESS=/^0x[0-9a-fA-F]{40}$/;
const REFERENCE_TYPES=new Set(['OFFICIAL_POSTMORTEM','SECURITY_REPORT','PROTOCOL_GOVERNANCE','ONCHAIN_TRANSACTION','VERIFIED_CONTRACT_SOURCE','TRANSACTION_TRACE','REPRODUCTION_REPOSITORY','ACADEMIC_PAPER','INDEPENDENT_TECHNICAL_ANALYSIS']);
const CONFIDENCE=new Set(['PRIMARY_ONCHAIN','PRIMARY_PROTOCOL','PRIMARY_SECURITY_REPORT','SECONDARY_TECHNICAL','COMMUNITY_UNVERIFIED']);
const PRIMARY=new Set(['PRIMARY_ONCHAIN','PRIMARY_PROTOCOL','PRIMARY_SECURITY_REPORT']);
const STATUS=new Set(['ACTIVE','SUPERSEDED','DISPUTED','REFERENCE_ONLY']);
function validUrl(value){try{const u=new URL(value);return u.protocol==='https:'||u.protocol==='http:';}catch{return false;}}
function text(v){return typeof v==='string'&&v.trim().length>0;}

export function validateReferenceV1(source){
 const errors=[]; const fail=(ok,code,detail=null)=>{if(!ok)errors.push({code,detail});};
 fail(source&&typeof source==='object'&&!Array.isArray(source),'SOURCE_OBJECT');
 if(!source||typeof source!=='object'||Array.isArray(source))return{status:'FAIL',errors};
 fail(source.schemaVersion==='adversarial-kb-reference-v1','SCHEMA_VERSION');
 fail(SOURCE_ID.test(source.sourceId??''),'SOURCE_ID');
 fail(Number.isInteger(source.revision)&&source.revision>=1,'REVISION');
 fail(text(source.title),'TITLE'); fail(REFERENCE_TYPES.has(source.referenceType),'REFERENCE_TYPE'); fail(CONFIDENCE.has(source.confidence),'CONFIDENCE');
 fail(validUrl(source.url),'URL'); fail(source.chain===null||text(source.chain),'CHAIN');
 fail(source.transactionHash===null||TX.test(source.transactionHash??''),'TRANSACTION_HASH');
 fail(source.contractAddress===null||ADDRESS.test(source.contractAddress??''),'CONTRACT_ADDRESS');
 if(['ONCHAIN_TRANSACTION','TRANSACTION_TRACE'].includes(source.referenceType)) fail(TX.test(source.transactionHash??''),'TX_REQUIRED_FOR_TYPE');
 if(source.referenceType==='VERIFIED_CONTRACT_SOURCE') fail(ADDRESS.test(source.contractAddress??''),'CONTRACT_REQUIRED_FOR_TYPE');
 fail(text(source.publisher),'PUBLISHER');
 fail(source.publishedAt===null||(text(source.publishedAt)&&!Number.isNaN(Date.parse(source.publishedAt))),'PUBLISHED_AT');
 for(const field of ['claims','contradicts','limitations']) fail(Array.isArray(source[field]),`ARRAY_REQUIRED:${field}`);
 for(const id of source.contradicts??[]) fail(SOURCE_ID.test(id),'CONTRADICTS_ID',id);
 fail(STATUS.has(source.status),'STATUS');
 return{status:errors.length?'FAIL':'PASS',errors};
}

export function collectSourceConflictsV1(sources=[]){
 const pairs=new Set();
 for(const source of sources) for(const other of source?.contradicts??[]){
   const [left,right]=[source.sourceId,other].sort(); if(left!==right)pairs.add(`${left}|${right}`);
 }
 return [...pairs].sort().map((pair)=>{const [left,right]=pair.split('|');return{left,right};});
}

export function validateSourceRegistryV1(registry){
 const errors=[]; const fail=(ok,code,detail=null)=>{if(!ok)errors.push({code,detail});};
 fail(registry&&typeof registry==='object'&&!Array.isArray(registry),'REGISTRY_OBJECT');
 if(!registry||typeof registry!=='object'||Array.isArray(registry))return{status:'FAIL',errors};
 fail(registry.schemaVersion==='adversarial-kb-source-registry-v1','SCHEMA_VERSION');
 fail(Number.isInteger(registry.revision)&&registry.revision>=1,'REVISION'); fail(Array.isArray(registry.sources),'SOURCES_ARRAY');
 const ids=new Set(); for(const source of registry.sources??[]){const r=validateReferenceV1(source);if(r.status==='FAIL')errors.push(...r.errors.map(e=>({...e,sourceId:source?.sourceId})));fail(!ids.has(source.sourceId),'DUPLICATE_SOURCE_ID',source.sourceId);ids.add(source.sourceId);}
 for(const source of registry.sources??[]) for(const other of source.contradicts??[]) fail(ids.has(other),'DANGLING_CONTRADICTION',`${source.sourceId}->${other}`);
 return{status:errors.length?'FAIL':'PASS',errors,conflicts:collectSourceConflictsV1(registry.sources??[])};
}

export function validateIncidentReferenceBasisV1(incident,sourceById){
 const errors=[]; const refs=Array.isArray(incident?.references)?incident.references:[];
 if(!sourceById||typeof sourceById.get!=='function') return{status:'FAIL',errors:[{code:'SOURCE_MAP_REQUIRED'}]};
 const resolved=[]; for(const id of refs){const source=sourceById.get(id);if(!source)errors.push({code:'UNRESOLVED_SOURCE',sourceId:id});else resolved.push(source);}
 if(incident?.incidentStatus==='VERIFIED'){
   if(refs.length===0)errors.push({code:'VERIFIED_REQUIRES_REFERENCE'});
   if(!resolved.some((s)=>PRIMARY.has(s.confidence)))errors.push({code:'VERIFIED_REQUIRES_PRIMARY_EVIDENCE'});
 }
 if(!['VERIFIED','PARTIALLY_VERIFIED','DISPUTED','REFERENCE_ONLY'].includes(incident?.incidentStatus))errors.push({code:'INCIDENT_STATUS'});
 return{status:errors.length?'FAIL':'PASS',errors,resolvedSourceIds:resolved.map(s=>s.sourceId),conflicts:collectSourceConflictsV1(resolved)};
}
