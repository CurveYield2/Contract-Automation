import { createHash } from 'node:crypto';
import { canonicalRegistryBytesV1 } from '../registry/build-v1.mjs';
import { validateCoreRecordV1 } from '../core-schemas-v1.mjs';

const SHA64=/^[0-9a-f]{64}$/;
const BLOCK_HASH=/^0x[0-9a-fA-F]{64}$/;
const ID_FIELD=Object.freeze({incident:'incidentId',pattern:'patternId',recipe:'recipeId'});
const FORBIDDEN_KEYS=new Set(['privatekey','mnemonic','shell','shellcommand','command','script','rpcurl','rpcendpoint']);

function nonempty(value){ return typeof value==='string'&&value.trim().length>0; }
function array(value){ return Array.isArray(value)?value:[]; }
function recordId(record){
  for(const field of Object.values(ID_FIELD)) if(nonempty(record?.[field])) return record[field];
  return null;
}
function expectedKind(record){
  if(record?.incidentId) return 'incident';
  if(record?.patternId) return 'pattern';
  if(record?.recipeId) return 'recipe';
  return null;
}
function scanForbidden(value,path='$',errors=[]){
  if(Array.isArray(value)){
    value.forEach((entry,index)=>scanForbidden(entry,`${path}[${index}]`,errors));
    return errors;
  }
  if(!value||typeof value!=='object') return errors;
  for(const [key,child] of Object.entries(value)){
    const normalized=key.toLowerCase().replace(/[^a-z0-9]/g,'');
    const childPath=`${path}.${key}`;
    if(FORBIDDEN_KEYS.has(normalized)) errors.push({code:'FORBIDDEN_EXECUTABLE_FIELD',path:childPath,key});
    if(normalized.includes('rpc')&&typeof child==='string'&&/^https?:\/\//i.test(child)) errors.push({code:'LITERAL_RPC_FORBIDDEN',path:childPath});
    scanForbidden(child,childPath,errors);
  }
  return errors;
}

export function digestKnowledgeRecordV1(record){
  return createHash('sha256').update(canonicalRegistryBytesV1(record)).digest('hex');
}

export function validateExecutableContractV1(executable,{knowledgeRecords=[]}={}){
  const errors=[];
  const core=validateCoreRecordV1('executable',executable);
  if(core.status!=='PASS') errors.push(...core.errors.map(error=>({code:'CORE_EXECUTABLE_INVALID',detail:error})));
  if(!executable||typeof executable!=='object'||Array.isArray(executable)) return {status:'FAIL',errors,mode:null,boundKnowledge:[]};

  scanForbidden(executable,'$',errors);

  const recordsById=new Map();
  for(const record of array(knowledgeRecords)){
    const id=recordId(record);
    if(id) recordsById.set(id,record);
  }

  const expectedRefs=[
    ...array(executable.incidentRefs).map(id=>({kind:'incident',id})),
    ...array(executable.patternRefs).map(id=>({kind:'pattern',id})),
    ...array(executable.recipeRefs).map(id=>({kind:'recipe',id})),
  ];
  const bindings=array(executable.knowledgeBindings);
  const seen=new Set();
  for(const binding of bindings){
    if(!binding||typeof binding!=='object'||Array.isArray(binding)){ errors.push({code:'KNOWLEDGE_BINDING_OBJECT_REQUIRED'}); continue; }
    const key=`${binding.kind}:${binding.id}`;
    if(seen.has(key)) errors.push({code:'DUPLICATE_KNOWLEDGE_BINDING',binding:key});
    seen.add(key);
    if(!Object.hasOwn(ID_FIELD,binding.kind)) errors.push({code:'UNKNOWN_KNOWLEDGE_KIND',kind:binding.kind});
    if(!Number.isInteger(binding.revision)||binding.revision<1) errors.push({code:'KNOWLEDGE_REVISION_REQUIRED',id:binding.id});
    if(typeof binding.digest!=='string'||!SHA64.test(binding.digest)) errors.push({code:'KNOWLEDGE_DIGEST_REQUIRED',id:binding.id});

    const record=recordsById.get(binding.id);
    if(!record){ errors.push({code:'KNOWLEDGE_RECORD_NOT_RESOLVED',id:binding.id}); continue; }
    if(expectedKind(record)!==binding.kind) errors.push({code:'KNOWLEDGE_KIND_MISMATCH',id:binding.id});
    if(record?.revision!==binding.revision) errors.push({code:'KNOWLEDGE_REVISION_MISMATCH',id:binding.id,expected:record?.revision,actual:binding.revision});
    const digest=digestKnowledgeRecordV1(record);
    if(digest!==binding.digest) errors.push({code:'KNOWLEDGE_DIGEST_MISMATCH',id:binding.id,expected:digest,actual:binding.digest});
  }
  for(const ref of expectedRefs) if(!seen.has(`${ref.kind}:${ref.id}`)) errors.push({code:'MISSING_KNOWLEDGE_BINDING',kind:ref.kind,id:ref.id});
  for(const binding of bindings){
    if(binding&&typeof binding==='object'&&!expectedRefs.some(ref=>ref.kind===binding.kind&&ref.id===binding.id)) errors.push({code:'UNREFERENCED_KNOWLEDGE_BINDING',kind:binding.kind,id:binding.id});
  }

  if(!['CONTROLLED','HISTORICAL'].includes(executable.executionMode)) errors.push({code:'EXECUTION_MODE_REQUIRED'});
  const rpc=executable.requiredRpcForkState;
  if(!rpc||typeof rpc!=='object'||Array.isArray(rpc)) errors.push({code:'RPC_FORK_STATE_REQUIRED'});
  if(executable.executionMode==='HISTORICAL'){
    if(rpc?.required!==true||rpc?.archiveRequired!==true||!nonempty(rpc?.rpcEnvVar)) errors.push({code:'HISTORICAL_ARCHIVE_RPC_REQUIRED'});
    const block=executable.requiredBlockIdentity;
    if(!block||typeof block!=='object'||!Number.isInteger(block.blockNumber)||block.blockNumber<0||!BLOCK_HASH.test(block.blockHash??'')) errors.push({code:'HISTORICAL_BLOCK_IDENTITY_REQUIRED'});
  }
  if(executable.executionMode==='CONTROLLED'&&executable.requiredBlockIdentity!==null) errors.push({code:'CONTROLLED_MODE_BLOCK_IDENTITY_MUST_BE_NULL'});

  if(array(executable.sourceFiles).length<1) errors.push({code:'SOURCE_FILE_REQUIRED'});
  if(array(executable.expectedSetup).length<1) errors.push({code:'EXPECTED_SETUP_REQUIRED'});
  if(!executable.expectedResult||typeof executable.expectedResult!=='object'||Array.isArray(executable.expectedResult)) errors.push({code:'EXPECTED_RESULT_REQUIRED'});
  if(array(executable.expectedEvidence).length<1) errors.push({code:'EXPECTED_EVIDENCE_REQUIRED'});

  return {
    status:errors.length?'FAIL':'PASS',
    errors,
    mode:executable.executionMode??null,
    boundKnowledge:errors.some(error=>error.code.startsWith('KNOWLEDGE_')||error.code==='MISSING_KNOWLEDGE_BINDING'||error.code==='UNREFERENCED_KNOWLEDGE_BINDING')
      ? []
      : expectedRefs.map(ref=>ref.id),
  };
}
