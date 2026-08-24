import { createHash } from 'node:crypto';
import { OPERATION_CLASSES, runTargetedPreflightV1 } from './preflight/registry-v1.mjs';
export { OPERATION_CLASSES };
export const OPERATION_PREFLIGHT_SCHEMA='curveyield-operation-preflight-v2';
const TRIVIAL_READ_ONLY_EXEMPTIONS=new Set(['read-known-file','read-pr-metadata','read-workflow-log']);
function canonicalize(v){if(Array.isArray(v))return v.map(canonicalize);if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonicalize(v[k])]));return v;}
function digest(v){return createHash('sha256').update(JSON.stringify(canonicalize(v))).digest('hex');}
export function buildOperationPreflightV1(input={}){
 const op=input.operationClass;
 if(!OPERATION_CLASSES.includes(op))return{schemaVersion:OPERATION_PREFLIGHT_SCHEMA,operationClass:op??null,status:'PREFLIGHT_FAIL',executionAuthorized:false,inputDigest:digest(input),configurationDigest:digest(input),checks:[],diagnostics:[{id:'operation.class',failureCode:'PREFLIGHT_OPERATION_CLASS_UNKNOWN',summary:'Operation class has no targeted preflight validator',expected:OPERATION_CLASSES,observed:op??null,remediation:'Classify the action and add/use its dedicated validator.',historicalSignatureId:null,evidenceRefs:[]}],firstFailure:'PREFLIGHT_OPERATION_CLASS_UNKNOWN',failureCount:1,expectedOutputs:input.expectedOutputs??[],rollback:input.rollbackPlan??null,proofIdentity:null,retryPolicy:'RECHECK_AFTER_FAILURE',doNotExecute:true};
 return runTargetedPreflightV1(op,input);
}
export function buildReadOnlyPreflightExemptionV1({exemptionId,repository=null,ref=null}={}){
 const ok=TRIVIAL_READ_ONLY_EXEMPTIONS.has(exemptionId);
 return{schemaVersion:OPERATION_PREFLIGHT_SCHEMA,operationClass:'read-only',status:ok?'PREFLIGHT_EXEMPT':'PREFLIGHT_FAIL',executionAuthorized:ok,repository,ref,inputDigest:digest({exemptionId,repository,ref}),configurationDigest:digest({exemptionId,repository,ref}),checks:[{id:'exemption.allowlisted',status:ok?'PASS':'FAIL',failureCode:ok?null:'PREFLIGHT_EXEMPTION_NOT_ALLOWLISTED',summary:ok?'Trivial read-only inspection is allowlisted':'Requested preflight exemption is not allowlisted',expected:[...TRIVIAL_READ_ONLY_EXEMPTIONS],observed:exemptionId??null,remediation:ok?null:'Run the action-specific preflight instead.',historicalSignatureId:null,evidenceRefs:[],blocksExecution:!ok}],diagnostics:ok?[]:[{id:'exemption.allowlisted',failureCode:'PREFLIGHT_EXEMPTION_NOT_ALLOWLISTED',summary:'Requested preflight exemption is not allowlisted',expected:[...TRIVIAL_READ_ONLY_EXEMPTIONS],observed:exemptionId??null,remediation:'Run the action-specific preflight instead.',historicalSignatureId:null,evidenceRefs:[]}],firstFailure:ok?null:'PREFLIGHT_EXEMPTION_NOT_ALLOWLISTED',failureCount:ok?0:1,expectedOutputs:[],rollback:null,proofIdentity:null,retryPolicy:'RECHECK_AFTER_FAILURE',doNotExecute:!ok};
}
export function assertExecutionAuthorizedByPreflightV1(receipt,{operationClass,inputDigest=null,repository=null,ref=null}={}){
 if(!receipt||receipt.status!=='PREFLIGHT_PASS'||receipt.executionAuthorized!==true)throw new Error('Execution blocked: current PREFLIGHT_PASS receipt required');
 if(receipt.operationClass!==operationClass)throw new Error(`Execution blocked: receipt operation class ${receipt.operationClass} does not match ${operationClass}`);
 if(inputDigest&&receipt.inputDigest!==inputDigest)throw new Error('Execution blocked: preflight input digest is stale');
 if(repository&&receipt.repository!==repository)throw new Error('Execution blocked: preflight repository binding is stale');
 if(ref&&receipt.ref!==ref)throw new Error('Execution blocked: preflight ref binding is stale');
 return true;
}
