import { createHash } from 'node:crypto';

export const PREFLIGHT_SCHEMA = 'curveyield-operation-preflight-v2';
const SHA40=/^[0-9a-f]{40}$/;
const SHA64=/^[0-9a-f]{64}$/;

function canonicalize(value){
  if(Array.isArray(value)) return value.map(canonicalize);
  if(value && typeof value==='object') return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonicalize(value[k])]));
  return value;
}
export function canonicalDigest(value){ return createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex'); }
export function isText(v){ return typeof v==='string' && v.trim().length>0; }
export function isSha40(v){ return typeof v==='string' && SHA40.test(v); }
export function isSha64(v){ return typeof v==='string' && SHA64.test(v); }
export function same(a,b){ return JSON.stringify(canonicalize(a))===JSON.stringify(canonicalize(b)); }
export function subset(expected, observed){
  if(!expected || typeof expected!=='object') return false;
  if(!observed || typeof observed!=='object') return false;
  return Object.entries(expected).every(([k,v])=>observed[k]===v);
}
export function deepForbiddenPaths(value, forbidden, path='config'){
  const out=[];
  if(Array.isArray(value)){ value.forEach((v,i)=>out.push(...deepForbiddenPaths(v,forbidden,`${path}[${i}]`))); return out; }
  if(!value || typeof value!=='object') return out;
  for(const [k,v] of Object.entries(value)){ const p=`${path}.${k}`; if(forbidden.has(k)) out.push(p); out.push(...deepForbiddenPaths(v,forbidden,p)); }
  return out;
}
export function check({id, pass, failureCode, summary, expected=null, observed=null, remediation, historicalSignatureId=null, evidenceRefs=[]}){
  return {id,status:pass?'PASS':'FAIL',failureCode:pass?null:failureCode,summary:pass?`${summary} — satisfied`:summary,expected,observed,remediation:pass?null:remediation,historicalSignatureId:pass?null:historicalSignatureId,evidenceRefs:Array.isArray(evidenceRefs)?evidenceRefs:[],blocksExecution:!pass};
}
export function requireText(id,value,{code,summary,remediation,history=null}){return check({id,pass:isText(value),failureCode:code,summary,expected:'non-empty string',observed:value??null,remediation,historicalSignatureId:history});}
export function requireSha40(id,value,{code,summary,remediation,history=null}){return check({id,pass:isSha40(value),failureCode:code,summary,expected:'40 lowercase hex git SHA',observed:value??null,remediation,historicalSignatureId:history});}
export function requireSha64(id,value,{code,summary,remediation,history=null}){return check({id,pass:isSha64(value),failureCode:code,summary,expected:'64 lowercase hex SHA-256',observed:value??null,remediation,historicalSignatureId:history});}
export function finalize(operationClass, config, checks, {repository=null, ref=null, expectedOutputs=[], rollback=null, proofIdentity=null}={}){
  const failed=checks.filter(x=>x.status==='FAIL');
  return {schemaVersion:PREFLIGHT_SCHEMA,operationClass,status:failed.length?'PREFLIGHT_FAIL':'PREFLIGHT_PASS',executionAuthorized:failed.length===0,repository,ref,inputDigest:canonicalDigest(config),configurationDigest:canonicalDigest(config?.configuration??config),checks,diagnostics:failed.map(({id,failureCode,summary,expected,observed,remediation,historicalSignatureId,evidenceRefs})=>({id,failureCode,summary,expected,observed,remediation,historicalSignatureId,evidenceRefs})),firstFailure:failed.length?failed[0].failureCode:null,failureCount:failed.length,expectedOutputs:Array.isArray(expectedOutputs)?expectedOutputs:[],rollback:rollback??null,proofIdentity:proofIdentity??null,retryPolicy:'RECHECK_AFTER_FAILURE',doNotExecute:failed.length>0};
}
export function equalityCheck(id, expected, observed, {code,summary,remediation,history=null,evidenceRefs=[]}){return check({id,pass:same(expected,observed),failureCode:code,summary,expected,observed,remediation,historicalSignatureId:history,evidenceRefs});}
export function boolCheck(id, observed, expected, meta){ return equalityCheck(id, expected, observed, meta); }
export function nonEmptyArrayCheck(id, observed, meta){return check({id,pass:Array.isArray(observed)&&observed.length>0,failureCode:meta.code,summary:meta.summary,expected:'non-empty array',observed:Array.isArray(observed)?observed:observed??null,remediation:meta.remediation,historicalSignatureId:meta.history??null,evidenceRefs:meta.evidenceRefs??[]});}
