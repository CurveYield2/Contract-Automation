import fs from 'node:fs';

const TAXONOMY_PATH = new URL('../../registry/ATTACK_PRIMITIVE_TAXONOMY_v1.json', import.meta.url);
const ID = /^[A-Z][A-Z0-9_]*$/;
const FAMILIES = new Set(['REENTRANCY','MARKET_ORACLE','LIQUIDITY','ACCOUNTING','AUTHORIZATION','CALL_EXECUTION','TOKEN_BEHAVIOR','VAULT','LENDING','POOL','SLIPPAGE_MEV','GOVERNANCE','CROSS_CHAIN','AUTOMATION','AVAILABILITY','STORAGE_CODE','DEPENDENCY']);
let cached;
function canonical(){ if(!cached) cached=JSON.parse(fs.readFileSync(TAXONOMY_PATH,'utf8')); return cached; }

export function validateTaxonomyV1(taxonomy){
 const errors=[]; const fail=(ok,code,detail=null)=>{if(!ok)errors.push({code,detail});};
 fail(taxonomy&&typeof taxonomy==='object'&&!Array.isArray(taxonomy),'TAXONOMY_OBJECT');
 if(!taxonomy||typeof taxonomy!=='object'||Array.isArray(taxonomy)) return {status:'FAIL',errors};
 fail(taxonomy.schemaVersion==='adversarial-kb-taxonomy-v1','SCHEMA_VERSION');
 fail(taxonomy.taxonomyId==='ATTACK_PRIMITIVE_TAXONOMY','TAXONOMY_ID');
 fail(Number.isInteger(taxonomy.revision)&&taxonomy.revision>=1,'REVISION');
 fail(Array.isArray(taxonomy.primitives)&&taxonomy.primitives.length>0,'PRIMITIVES');
 fail(taxonomy.extensionPolicy&&typeof taxonomy.extensionPolicy==='object','EXTENSION_POLICY');
 fail(taxonomy.extensionPolicy?.mode==='APPEND_OR_NEW_VERSION','EXTENSION_MODE');
 fail(taxonomy.extensionPolicy?.removePublishedPrimitive==='NEW_MAJOR_VERSION_OR_DEPRECATE','REMOVAL_POLICY');
 fail(taxonomy.extensionPolicy?.unknownActiveTag==='REJECT','UNKNOWN_TAG_POLICY');
 const seen=new Set();
 for(const p of taxonomy.primitives??[]){
   fail(p&&typeof p==='object'&&!Array.isArray(p),'PRIMITIVE_OBJECT');
   if(!p||typeof p!=='object') continue;
   fail(typeof p.id==='string'&&ID.test(p.id),'PRIMITIVE_ID',p.id);
   fail(!seen.has(p.id),'DUPLICATE_PRIMITIVE',p.id); seen.add(p.id);
   fail(FAMILIES.has(p.family),'PRIMITIVE_FAMILY',p.id);
   fail(p.status==='ACTIVE'||p.status==='DEPRECATED','PRIMITIVE_STATUS',p.id);
   fail(typeof p.description==='string'&&p.description.trim().length>0,'PRIMITIVE_DESCRIPTION',p.id);
   fail(Array.isArray(p.related),'RELATED_ARRAY',p.id);
 }
 for(const p of taxonomy.primitives??[]) for(const rel of p.related??[]) fail(seen.has(rel),'DANGLING_RELATED_PRIMITIVE',`${p.id}->${rel}`);
 return {status:errors.length?'FAIL':'PASS',errors};
}

export function isKnownPrimitiveV1(id){
 const taxonomy=canonical();
 return taxonomy.primitives.some((p)=>p.id===id&&p.status==='ACTIVE');
}

export function validatePrimitiveTagsV1(tags){
 const errors=[];
 if(!Array.isArray(tags)) return {status:'FAIL',errors:[{code:'TAGS_ARRAY_REQUIRED'}]};
 const seen=new Set();
 for(const tag of tags){
   if(typeof tag!=='string'||!isKnownPrimitiveV1(tag)) errors.push({code:'UNKNOWN_ACTIVE_PRIMITIVE',tag});
   if(seen.has(tag)) errors.push({code:'DUPLICATE_PRIMITIVE_TAG',tag});
   seen.add(tag);
 }
 return {status:errors.length?'FAIL':'PASS',errors};
}
