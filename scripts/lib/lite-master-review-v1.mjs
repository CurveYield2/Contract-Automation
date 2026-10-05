import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readJson,writeJson,repoFile,requiredFile,loadPhaseSchema,getByPath} from './lite-phase-work-v1.mjs';
import {validatePhaseScaffold} from './lite-phase-prefill-v1.mjs';

export const MASTER_REVIEW_SEGMENTS_V1=Object.freeze([
  Object.freeze({segmentId:'reviewer-1-phase-01',reviewerId:'reviewer-1',phases:Object.freeze([1]),boundaryPhase:1}),
  Object.freeze({segmentId:'reviewer-2-phases-02-05',reviewerId:'reviewer-2',phases:Object.freeze([2,3,4,5]),boundaryPhase:5}),
  Object.freeze({segmentId:'reviewer-3l-phases-06-07',reviewerId:'reviewer-3L',phases:Object.freeze([6,7]),boundaryPhase:7}),
  Object.freeze({segmentId:'reviewer-4-phases-08-10',reviewerId:'reviewer-4',phases:Object.freeze([8,9,10]),boundaryPhase:10})
]);

const SHA256=/^[0-9a-f]{64}$/;
const CHAT_URL=/^https:\/\/chatgpt\.com\/(?:c\/[A-Za-z0-9_-]+|g\/g-p-[A-Za-z0-9_-]+\/c\/[A-Za-z0-9_-]+)\/?$/;

function digestBytes(bytes){return createHash('sha256').update(bytes).digest('hex');}
function digestFile(file){return digestBytes(fs.readFileSync(file));}
function digestJson(value){return digestBytes(JSON.stringify(value));}
function phaseNumber(value){return String(value).padStart(2,'0');}
function relativeToCampaign(campaignPath,rel){return path.posix.relative(campaignPath,rel);}
function existing(root,rel){const file=repoFile(root,rel);return fs.existsSync(file)&&fs.statSync(file).isFile()?file:null;}
function artifact(root,campaignPath,phase,kind,rel,extra={}){
  const file=requiredFile(root,rel,kind.toLowerCase().replaceAll('_',' '));
  return {phase,kind,path:relativeToCampaign(campaignPath,rel),sha256:digestFile(file),...extra};
}
function receiptCandidates(root,campaignPath,phase){
  const dir=repoFile(root,path.posix.join(campaignPath,'receipts'));
  if(!fs.existsSync(dir))return[];
  const rx=new RegExp('^PHASE_'+phaseNumber(phase)+'_RECEIPT_v([0-9]+)\\.json$');
  return fs.readdirSync(dir).map(name=>({name,match:name.match(rx)})).filter(x=>x.match).map(x=>({
    revision:Number(x.match[1]),rel:path.posix.join(campaignPath,'receipts',x.name)
  })).sort((a,b)=>b.revision-a.revision);
}
function latestReceipt(root,campaignPath,phase){
  const found=receiptCandidates(root,campaignPath,phase)[0];
  if(!found)throw new Error('master review segment is missing sealed Phase '+phase+' receipt');
  const receipt=readJson(requiredFile(root,found.rel,'Phase '+phase+' receipt'));
  if(!['SEALED','SKIPPED'].includes(String(receipt?.phase?.status??'')))throw new Error('master review requires sealed/skipped Phase '+phase+' receipt');
  return {...found,receipt};
}
function canonicalRel(campaignPath,phase){return path.posix.join(campaignPath,'derived/phase-'+phase,'PHASE_'+phaseNumber(phase)+'_CANONICAL_DATA_v1.json');}
function segmentForBoundary(boundaryPhase){return MASTER_REVIEW_SEGMENTS_V1.find(x=>x.boundaryPhase===Number(boundaryPhase))??null;}
function segmentForId(segmentId){return MASTER_REVIEW_SEGMENTS_V1.find(x=>x.segmentId===segmentId)??null;}

export function validateMasterReviewConfiguration(directory,{required=false}={}){
  const cfg=directory?.masterReview;
  if(!cfg){
    if(required)throw new Error('v11 campaign requires masterReview configuration');
    return null;
  }
  if(!CHAT_URL.test(String(cfg.chatUrl??'')))throw new Error('masterReview.chatUrl must be a durable ChatGPT conversation URL');
  if(cfg.reasoning!=='MAXIMUM')throw new Error('masterReview.reasoning must be MAXIMUM');
  if(cfg.repairModel!=='SOL')throw new Error('masterReview.repairModel must be SOL');
  if(cfg.repairReasoning!=='HIGH')throw new Error('masterReview.repairReasoning must be HIGH');
  return cfg;
}

export function masterReviewRequired(directory,authorityRoot){
  const isV11=/Audit_Litemode_v11(?:\/|$)/.test(String(authorityRoot??''));
  if(isV11)return Boolean(validateMasterReviewConfiguration(directory,{required:true}));
  return Boolean(directory?.masterReview&&validateMasterReviewConfiguration(directory));
}

function referencedArtifact({root,campaignPath,phase,kind,reference,requireDigest=true}){
  const raw=reference?.path;
  if(typeof raw!=='string'||!raw)throw new Error('sealed receipt reference path is required for Phase '+phase+' '+kind);
  const suppliedDigest=reference.sha256;
  if(requireDigest&&suppliedDigest!==undefined&&suppliedDigest!==null&&suppliedDigest!==''&&!SHA256.test(String(suppliedDigest)))throw new Error('sealed receipt reference has invalid sha256: '+raw);
  const rel=existing(root,raw)?raw:path.posix.join(campaignPath,raw);
  const row=artifact(root,campaignPath,phase,kind,rel);
  if(requireDigest&&SHA256.test(String(suppliedDigest??''))&&suppliedDigest!==row.sha256)throw new Error('sealed receipt reference digest mismatch: '+raw);
  return row;
}
function pushUniqueArtifact(rows,seen,row){
  if(!row)return;
  const key=row.phase+'|'+row.path;
  if(seen.has(key))return;
  seen.add(key);rows.push(row);
}
export function collectSegmentArtifacts({root,campaignPath,segment,directory,expectedAuthority}){
  if(!directory||!expectedAuthority)throw new Error('segment collection requires exact campaign and authority bindings');
  const artifacts=[];const seen=new Set();
  for(const phase of segment.phases){
    const receiptInfo=latestReceipt(root,campaignPath,phase);
    const receipt=receiptInfo.receipt;
    if(receipt.campaign?.campaignId!==directory.campaignId||receipt.campaign?.campaignGenerationId!==directory.campaignGenerationId)throw new Error('sealed receipt campaign binding mismatch for Phase '+phase);
    if(receipt.source?.sha256!==directory.sourceSha256)throw new Error('sealed receipt source binding mismatch for Phase '+phase);
    if(Number(receipt.phase?.sequence)!==phase||Number(receipt.phase?.revision)!==receiptInfo.revision)throw new Error('sealed receipt phase/revision binding mismatch for Phase '+phase);
    if(receipt.authority?.homepagePath!==expectedAuthority.homepagePath||receipt.authority?.liteSkillSha256!==expectedAuthority.liteSkillSha256)throw new Error('sealed receipt authority binding mismatch for Phase '+phase);
    const receiptKind=receipt.phase.status==='SKIPPED'?'SKIP_MARKER':'SEALED_RECEIPT';
    if(!Array.isArray(receipt.inputs)||receipt.inputs.length===0)throw new Error('sealed receipt inputs are missing for Phase '+phase);
    if(receiptKind!=='SKIP_MARKER'&&(!Array.isArray(receipt.evidence)||receipt.evidence.length===0||!Array.isArray(receipt.outputs)||receipt.outputs.length===0))throw new Error('sealed receipt evidence/outputs are missing for Phase '+phase);
    if(phase===7){
      const canonical=canonicalRel(campaignPath,phase);
      const canonicalData=readJson(requiredFile(root,canonical,'Phase-7 marker canonical data'));
      pushUniqueArtifact(artifacts,seen,artifact(root,campaignPath,phase,'MACHINE_MARKER',canonical));
      if(canonicalData.workFormPath)pushUniqueArtifact(artifacts,seen,artifact(root,campaignPath,phase,'WORK_FORM',canonicalData.workFormPath));
    }else if(receiptKind!=='SKIP_MARKER'){
      const canonical=canonicalRel(campaignPath,phase);
      const canonicalData=readJson(requiredFile(root,canonical,'Phase '+phase+' canonical data'));
      const authorityRoot=path.posix.dirname(expectedAuthority.homepagePath);
      const phaseSchema=loadPhaseSchema(root,authorityRoot,phase).schema;
      if(phaseSchema.finalReport&&!canonicalData.finalReportPath)throw new Error('required Phase '+phase+' report path is missing from canonical data');
      pushUniqueArtifact(artifacts,seen,artifact(root,campaignPath,phase,'CANONICAL_DATA',canonical));
      pushUniqueArtifact(artifacts,seen,artifact(root,campaignPath,phase,'WORK_FORM',canonicalData.workFormPath));
      if(canonicalData.finalReportPath)pushUniqueArtifact(artifacts,seen,artifact(root,campaignPath,phase,'PHASE_REPORT',canonicalData.finalReportPath));
    }
    for(const [family,refs] of [['INPUT',receipt.inputs],['EVIDENCE',receipt.evidence],['OUTPUT',receipt.outputs]]){
      for(const ref of refs??[]){
        const role=String(ref?.role??family).replace(/[^A-Za-z0-9_-]+/g,'_').toUpperCase();
        pushUniqueArtifact(artifacts,seen,referencedArtifact({root,campaignPath,phase,kind:family+'_'+role,reference:ref}));
      }
    }
    for(const [name,value] of Object.entries(receipt.globalControls??{})){
      if(typeof value!=='string'||!value)continue;
      pushUniqueArtifact(artifacts,seen,referencedArtifact({root,campaignPath,phase,kind:'GLOBAL_CONTROL_'+name.replace(/[^A-Za-z0-9_-]+/g,'_').toUpperCase(),reference:{path:value},requireDigest:false}));
    }
    pushUniqueArtifact(artifacts,seen,artifact(root,campaignPath,phase,receiptKind,receiptInfo.rel,{receiptRevision:receiptInfo.revision}));
  }
  return artifacts;
}

function bindingRecord({root,campaignPath,directory,predecessor,authorityRoot,reviewedArtifacts}){
  const buildRel=path.posix.join(campaignPath,'evidence/build/BUILD_AND_SOURCE_IDENTITY_v1.json');
  const buildFile=requiredFile(root,buildRel,'build/source identity');
  const sourceRel=predecessor?.source?.archivePath??predecessor?.source?.uploadedPath??null;
  const sourceSha=directory.sourceSha256;
  if(!SHA256.test(String(sourceSha??'')))throw new Error('campaign sourceSha256 is invalid');
  const authoritySha=predecessor?.authority?.liteSkillSha256;
  if(!SHA256.test(String(authoritySha??'')))throw new Error('sealed receipt authority digest is missing');
  return {
    source:{path:sourceRel,sha256:sourceSha},
    build:{path:relativeToCampaign(campaignPath,buildRel),sha256:digestFile(buildFile)},
    authority:{
      root:authorityRoot,
      homepagePath:predecessor.authority.homepagePath,
      sha256:authoritySha,
      release:predecessor.authority.liteRelease??null,
      packageRevision:predecessor.authority.packageRevision??null
    },
    segmentManifestSha256:digestJson(reviewedArtifacts)
  };
}

export const MASTER_OUTCOMES_V1=Object.freeze(['AMENDED','ACCEPT_WITHOUT_MODIFICATIONS']);
export const SUPERSEDED_DIRECTORY_V1='superseded';

function gitBlobSha1(bytes){return createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');}

export function stageMasterReview({root,campaignPath,directory,predecessor,authorityRoot,boundaryPhase,lastSealedReceiptPath,nextSequence,nextDerivedInputPaths=[],successorPrefillContext={},now}){
  const cfg=validateMasterReviewConfiguration(directory,{required:true});
  if(directory.pendingMasterReview)throw new Error('campaign already has pendingMasterReview');
  const segment=segmentForBoundary(boundaryPhase);
  if(!segment)throw new Error('unsupported master review boundary '+boundaryPhase);
  const reviewedArtifacts=collectSegmentArtifacts({root,campaignPath,segment,directory,expectedAuthority:predecessor.authority});
  const bindings=bindingRecord({root,campaignPath,directory,predecessor,authorityRoot,reviewedArtifacts});
  // Exact git blob identities of the sealed work forms let the controller recover
  // each reviewer's original after the master amends it in place.
  const sealedWorkForms=reviewedArtifacts.filter(x=>x.kind==='WORK_FORM').map(x=>({
    phase:x.phase,path:x.path,sha256:x.sha256,
    gitBlobSha1:gitBlobSha1(fs.readFileSync(repoFile(root,path.posix.join(campaignPath,x.path))))
  }));
  const recordRel=path.posix.join(campaignPath,'work/master-review',segment.segmentId,'MASTER_REVIEW_RECORD_v1.json');
  const record={
    schemaVersion:'curveyield-lite-master-review-record-v1',
    campaignId:directory.campaignId,
    campaignGenerationId:directory.campaignGenerationId,
    segmentId:segment.segmentId,
    reviewerId:segment.reviewerId,
    boundaryPhase:segment.boundaryPhase,
    segmentPhases:[...segment.phases],
    masterIdentity:{chatUrl:cfg.chatUrl,reasoning:'MAXIMUM'},
    bindings,
    reviewedArtifacts,
    decision:null,
    createdAt:now,
    updatedAt:now
  };
  writeJson(repoFile(root,recordRel),record);
  const pending={
    schemaVersion:'curveyield-lite-master-review-pending-v2',
    segmentId:segment.segmentId,
    reviewerId:segment.reviewerId,
    boundaryPhase:segment.boundaryPhase,
    segmentPhases:[...segment.phases],
    status:'WAITING_FOR_MASTER_REVIEW',
    recordPath:recordRel,
    masterChatUrl:cfg.chatUrl,
    manifestSha256:bindings.segmentManifestSha256,
    bindingsSha256:digestJson(bindings),
    sealedWorkForms,
    lastSealedReceiptPath,
    successorPlan:{
      nextPhaseSequence:nextSequence,
      derivedInputPaths:[...nextDerivedInputPaths],
      prefillContext:successorPrefillContext
    },
    createdAt:now,
    updatedAt:now
  };
  directory.pendingMasterReview=pending;
  directory.currentAssignment=null;
  directory.campaignStatus='WAITING_FOR_MASTER_REVIEW';
  directory.updatedAt=now;
  return {segment,pending,record};
}

function exactJson(a,b){return JSON.stringify(a)===JSON.stringify(b);}
function validateLockedRecord(record,pending,directory,cfg){
  const failures=[];
  if(record.schemaVersion!=='curveyield-lite-master-review-record-v1')failures.push('master review record schemaVersion mismatch');
  for(const [key,expected] of Object.entries({
    campaignId:directory.campaignId,
    campaignGenerationId:directory.campaignGenerationId,
    segmentId:pending.segmentId,
    reviewerId:pending.reviewerId,
    boundaryPhase:pending.boundaryPhase
  }))if(!exactJson(record[key],expected))failures.push('master review record '+key+' mismatch');
  if(!exactJson(record.segmentPhases,pending.segmentPhases))failures.push('master review record segmentPhases mismatch');
  if(record.masterIdentity?.chatUrl!==cfg.chatUrl||record.masterIdentity?.reasoning!=='MAXIMUM')failures.push('master identity/configuration mismatch');
  if(record.bindings?.segmentManifestSha256!==pending.manifestSha256)failures.push('master manifest digest mismatch');
  if(record.bindings?.source?.sha256!==directory.sourceSha256)failures.push('master source binding does not match current campaign directory');
  if(digestJson(record.bindings)!==pending.bindingsSha256)failures.push('master source/build/authority bindings were modified');
  if(digestJson(record.reviewedArtifacts)!==pending.manifestSha256)failures.push('master reviewedArtifacts were modified');
  return failures;
}
function currentArtifactFailures(root,campaignPath,rows){
  const failures=[];
  for(const row of rows??[]){
    const rel=path.posix.join(campaignPath,row.path);
    const file=existing(root,rel);
    if(!file)failures.push('reviewed artifact missing: '+row.path);
    else if(digestFile(file)!==row.sha256)failures.push('reviewed artifact digest changed: '+row.path);
  }
  return failures;
}
function currentBindingFailures(root,campaignPath,record,directory){
  const failures=[];
  const bindings=record.bindings??{};
  const build=bindings.build;
  if(!build||typeof build.path!=='string'||!SHA256.test(String(build.sha256??'')))failures.push('build binding is incomplete');
  else{
    const rel=path.posix.join(campaignPath,build.path);
    const file=existing(root,rel);
    if(!file)failures.push('bound build identity is missing: '+build.path);
    else if(digestFile(file)!==build.sha256)failures.push('bound build identity digest changed: '+build.path);
  }
  const authority=bindings.authority;
  if(!authority||typeof authority.homepagePath!=='string'||!SHA256.test(String(authority.sha256??'')))failures.push('authority binding is incomplete');
  else{
    try{
      const file=requiredFile(root,authority.homepagePath,'bound master-review authority');
      if(digestFile(file)!==authority.sha256)failures.push('bound authority digest changed: '+authority.homepagePath);
    }catch(error){failures.push(String(error.message||error));}
  }
  const source=bindings.source;
  if(!source||!SHA256.test(String(source.sha256??'')))failures.push('source binding is incomplete');
  else if(source.sha256!==directory.sourceSha256)failures.push('source binding does not match current campaign directory');
  else if(typeof source.path==='string'&&source.path&&!/^https?:\/\//.test(source.path)){
    const candidates=[source.path,path.posix.join(campaignPath,source.path)];
    const rel=candidates.find(x=>existing(root,x));
    if(!rel)failures.push('bound source artifact is missing: '+source.path);
    else if(digestFile(existing(root,rel))!==source.sha256)failures.push('bound source artifact digest changed: '+source.path);
  }
  return failures;
}

export function readSealedOriginal(root,sealed){
  let bytes;
  try{bytes=execFileSync('git',['-C',root,'cat-file','blob',sealed.gitBlobSha1],{stdio:['ignore','pipe','pipe'],maxBuffer:256*1024*1024});}
  catch(error){throw new Error('cannot recover sealed original from git history: '+sealed.path);}
  if(digestBytes(bytes)!==sealed.sha256)throw new Error('recovered sealed original digest mismatch: '+sealed.path);
  return bytes;
}
function reviewerOutputPaths(schema){
  const out=[];
  for(const [stepKey,action] of Object.entries(schema.actions??{}))for(const field of action.fields??[])out.push('actions.'+stepKey+'.outputs.'+field.name);
  return out;
}
function valueAt(object,dot){return String(dot).split('.').reduce((v,k)=>v===undefined||v===null?undefined:v[k],object);}
function amendmentFailures({root,authorityRoot,sealed,original,amended}){
  const failures=[];
  if(sealed.phase===7)return {failures:['Phase 7 is controller-generated and cannot be amended: '+sealed.path],changedFields:[]};
  const schema=loadPhaseSchema(root,authorityRoot,sealed.phase).schema;
  const owned=reviewerOutputPaths(schema);
  const protectedOriginal=structuredClone(original);
  const protectedAmended=structuredClone(amended);
  for(const dot of owned){deleteObjectPath(protectedOriginal,dot);deleteObjectPath(protectedAmended,dot);}
  if(!exactJson(protectedOriginal,protectedAmended))failures.push('amended work form changed controller-owned data outside reviewer-written fields: '+sealed.path);
  const changedFields=owned.filter(dot=>!exactJson(valueAt(original,dot),valueAt(amended,dot)));
  const reducerPaths=[...(schema.bookkeepingMappings?.obligationRecordPaths??[]),...(schema.bookkeepingMappings?.invalidationRecordPaths??[])];
  for(const dot of changedFields)if(reducerPaths.includes(dot))failures.push('amended field requires unsupported historical obligation/invalidation replay: '+sealed.path+'#'+dot);
  for(const deficiency of validatePhaseScaffold(sealed.phase,amended,original?.automationInputs?.controllerPrefillDigestSha256??null))failures.push(sealed.path+': '+deficiency);
  return {failures,changedFields};
}

export function processMasterReviewSubmission({root,campaignPath,directory,authorityRoot,segmentId,outcome,summary=null,now}){
  const cfg=validateMasterReviewConfiguration(directory,{required:true});
  const pending=directory.pendingMasterReview;
  if(!pending)throw new Error('campaign has no pending master review');
  if(['STOPPED_BY_HUMAN','BLOCKED'].includes(String(directory.campaignStatus??'')))return {status:'MASTER_REVIEW_HELD',failures:['campaign is held by explicit human status '+directory.campaignStatus],pending};
  if(segmentId&&segmentId!==pending.segmentId)throw new Error('submitted segment does not match pending master review');
  const segment=segmentForId(pending.segmentId);
  if(!segment)throw new Error('pending master review segment is unsupported');
  if(!MASTER_OUTCOMES_V1.includes(String(outcome??'')))return {status:'MASTER_REVIEW_INVALID',failures:['masterOutcome must be '+MASTER_OUTCOMES_V1.join(' or ')],pending};
  const record=readJson(requiredFile(root,pending.recordPath,'master review record'));
  const failures=[
    ...validateLockedRecord(record,pending,directory,cfg),
    ...currentBindingFailures(root,campaignPath,record,directory)
  ];
  if(failures.length)return {status:'MASTER_REVIEW_INVALID',failures,record,pending};
  const sealedByPath=new Map((pending.sealedWorkForms??[]).map(x=>[x.path,x]));
  // Only reviewer work forms may change; every report, canonical record, receipt
  // and machine artifact must still match the sealed segment manifest.
  failures.push(...currentArtifactFailures(root,campaignPath,record.reviewedArtifacts.filter(x=>!sealedByPath.has(x.path))));
  const changed=[];
  for(const sealed of sealedByPath.values()){
    const file=existing(root,path.posix.join(campaignPath,sealed.path));
    if(!file){failures.push('reviewed work form missing: '+sealed.path);continue;}
    const afterSha256=digestFile(file);
    if(afterSha256!==sealed.sha256)changed.push({sealed,file,afterSha256});
  }
  if(failures.length)return {status:'MASTER_REVIEW_INVALID',failures,record,pending};
  if(outcome==='ACCEPT_WITHOUT_MODIFICATIONS'){
    if(changed.length)return {status:'MASTER_REVIEW_INVALID',failures:['ACCEPT_WITHOUT_MODIFICATIONS was submitted but work forms changed; submit AMENDED instead: '+changed.map(x=>x.sealed.path).join(', ')],record,pending};
    return {status:'MASTER_REVIEW_ACCEPTED',failures:[],record,pending,segment,outcome,summary,amendedForms:[],successorPlan:pending.successorPlan};
  }
  if(!changed.length)return {status:'MASTER_REVIEW_INVALID',failures:['AMENDED was submitted but no segment work form changed; submit ACCEPT_WITHOUT_MODIFICATIONS instead'],record,pending};
  const amendedForms=[];
  for(const item of changed){
    let original;
    try{original=readSealedOriginal(root,item.sealed);}catch(error){failures.push(String(error.message||error));continue;}
    let amended;
    try{amended=readJson(item.file);}catch{failures.push('amended work form is not valid JSON: '+item.sealed.path);continue;}
    const checked=amendmentFailures({root,authorityRoot,sealed:item.sealed,original:JSON.parse(original.toString('utf8')),amended});
    failures.push(...checked.failures);
    if(!checked.changedFields.length&&!checked.failures.length)failures.push('amended work form changed no reviewer-written field: '+item.sealed.path);
    amendedForms.push({phase:item.sealed.phase,path:item.sealed.path,beforeSha256:item.sealed.sha256,afterSha256:item.afterSha256,gitBlobSha1:item.sealed.gitBlobSha1,changedFields:checked.changedFields,originalBytes:original});
  }
  if(failures.length)return {status:'MASTER_REVIEW_INVALID',failures,record,pending};
  return {
    status:'MASTER_AMENDMENT_READY_FOR_REFRESH',
    failures:[],
    record,
    pending,
    segment,
    outcome,
    summary,
    amendedForms,
    affectedPhases:[...new Set(amendedForms.map(x=>x.phase))].sort((a,b)=>a-b),
    amendmentSha256:digestJson(amendedForms.map(({originalBytes,...rest})=>rest)),
    successorPlan:pending.successorPlan
  };
}

export function masterWakeMessage({campaignId,pending,auditControllerRef='main'}){
  const phases=pending.segmentPhases.length===1?'Phase '+pending.segmentPhases[0]:'Phases '+pending.segmentPhases[0]+'-'+pending.segmentPhases.at(-1);
  return [
    'MASTER_REVIEW_REQUIRED.',
    'You are the persistent master reviewer for campaign '+campaignId+'. '+pending.reviewerId+' has sealed '+phases+' (segment '+pending.segmentId+').',
    '1. Open the segment record '+pending.recordPath+' in Audit-Controller. It lists every sealed work form, report, receipt and machine artifact in this segment.',
    '2. Review the segment reports and work forms, focusing on what the next reviewer depends on: errors, unsupported conclusions, coverage gaps and missed findings.',
    '3. If anything needs correcting, edit only the reviewer-written fields (actions.<step>.outputs.<field>) of this segment\'s work forms, in their normal locations. Do not edit reports, canonical data, receipts or controller files; the controller regenerates them and archives the originals under '+SUPERSEDED_DIRECTORY_V1+'/.',
    '4. Do not start new executions or simulations.',
    '5. Submit one request file to process/agent-upload/lite-phase-boundary/ in Contract-Automation: {"schemaVersion":"curveyield-lite-phase-boundary-request-v1","campaignId":"'+campaignId+'","reviewKind":"master","segmentId":"'+pending.segmentId+'","masterOutcome":"AMENDED" or "ACCEPT_WITHOUT_MODIFICATIONS","summary":"<one paragraph>","auditControllerRef":"'+auditControllerRef+'","attempt":1}.',
    'Follow the master-reviewer instructions in the Audit Skill for details.'
  ].join(' ');
}

function assertDigest(root,record,label){
  if(!record||typeof record.path!=='string'||!SHA256.test(String(record.sha256??'')))throw new Error(label+' path/sha256 are required');
  const file=requiredFile(root,record.path,label);
  if(digestFile(file)!==record.sha256)throw new Error(label+' digest mismatch');
  return file;
}
function deleteObjectPath(object,dot){
  const parts=String(dot).split('.');
  let current=object;
  for(let i=0;i<parts.length-1;i++){
    if(!current||typeof current!=='object'||!(parts[i] in current))return;
    current=current[parts[i]];
  }
  if(current&&typeof current==='object')delete current[parts.at(-1)];
}
function validateAllowedSemanticPaths(root,authorityRoot,phase,paths){
  const schema=loadPhaseSchema(root,authorityRoot,phase).schema;
  const failures=[];
  for(const semanticPath of paths??[]){
    const match=String(semanticPath).match(/^actions\.([A-Za-z0-9._-]+)\.outputs\.([A-Za-z0-9._-]+)$/);
    if(!match){failures.push('not a reviewer-owned action output: '+semanticPath);continue;}
    const field=(schema.actions?.[match[1]]?.fields??[]).find(x=>x.name===match[2]);
    if(!field)failures.push('not declared by bound phase schema: '+semanticPath);
  }
  return failures;
}
export function admitSealedPhaseRework({root,campaignPath,directory,requestPath,now}){
  const request=readJson(requiredFile(root,requestPath,'sealed-phase rework request'));
  if(request.schemaVersion!=='curveyield-lite-sealed-phase-rework-request-v1')throw new Error('sealed rework request schemaVersion mismatch');
  if(request.campaignId!==directory.campaignId||request.phaseSequence!==1)throw new Error('sealed rework request campaign/phase mismatch');
  if(request.fromRevision!==2||request.toRevision!==3)throw new Error('sealed rework request must be the authorized revision2-to-revision3 repair');
  if(request.holdSuccessorDelivery!==true)throw new Error('sealed rework request must hold successor delivery');
  if(request.sourceSha256!==directory.sourceSha256)throw new Error('sealed rework source binding mismatch');
  const expectedRoot='Audit Skill - Current Authority/Audit_Litemode_v10.3';
  if(request.authority?.logicalRoot!==expectedRoot)throw new Error('sealed rework must remain bound to logical v10.3 authority');
  if(request.authority?.expectedRootSha256!=='bdb90107ea50580e67be91440ce47087de570c4f54b8474c5a3eb852af95ea27')throw new Error('sealed rework authority root digest mismatch');
  if(request.authority?.expectedManifestSha256!=='846be5f90d6e00757b817b1218dfabeb2aa4dff6c92b8e9ff47335d2db83703a')throw new Error('sealed rework authority manifest digest mismatch');
  requiredFile(root,path.posix.join(expectedRoot,'SKILL.md'),'bound v10.3 authority root');
  requiredFile(root,path.posix.join(expectedRoot,'MANIFEST.json'),'bound v10.3 authority manifest');
  if(directory.lastSealedReceiptPath!==request.priorReceipt?.path)throw new Error('sealed rework priorReceipt must equal directory.lastSealedReceiptPath');
  const priorReceiptFile=assertDigest(root,request.priorReceipt,'prior Phase-1 receipt');
  const priorReceipt=readJson(priorReceiptFile);
  if(priorReceipt.phase?.sequence!==1||priorReceipt.phase?.revision!==2||priorReceipt.phase?.status!=='SEALED')throw new Error('prior receipt is not sealed Phase-1 revision2');
  if(priorReceipt.source?.sha256!==directory.sourceSha256&&priorReceipt.sourceSha256!==directory.sourceSha256)throw new Error('prior receipt source mismatch');
  if(path.posix.dirname(priorReceipt.authority?.homepagePath??'')!==expectedRoot)throw new Error('prior receipt authority mismatch');
  const priorFormRef=[...(priorReceipt.evidence??[]),...(priorReceipt.outputs??[])].find(x=>x?.role==='PHASE_WORK_FORM');
  const normalizeReceiptPath=value=>String(value??'').startsWith(campaignPath+'/')?String(value):path.posix.join(campaignPath,String(value??''));
  if(!priorFormRef||normalizeReceiptPath(priorFormRef.path)!==request.priorWorkForm?.path||priorFormRef.sha256!==request.priorWorkForm?.sha256)throw new Error('sealed rework priorWorkForm is not the exact form bound by the prior receipt');
  const priorFormFile=assertDigest(root,request.priorWorkForm,'prior Phase-1 work form');
  const repairedFormFile=assertDigest(root,request.repairedWorkForm,'repaired Phase-1 work form');
  assertDigest(root,request.qualityReview,'Phase-1 quality review');
  if(!request.humanAuthorization?.scopeId||!request.humanAuthorization?.authorizedAt)throw new Error('explicit human rework authorization metadata is required');
  const authorizationFile=assertDigest(root,{path:request.humanAuthorization.recordPath,sha256:request.humanAuthorization.recordSha256},'human rework authorization record');
  const authorization=readJson(authorizationFile);
  const authorizationMatches=
    authorization.schemaVersion==='curveyield-human-rework-authorization-v1'
    && authorization.scopeId===request.humanAuthorization.scopeId
    && authorization.campaignId===directory.campaignId
    && authorization.campaignGenerationId===directory.campaignGenerationId
    && authorization.phaseSequence===1
    && authorization.fromRevision===2
    && authorization.toRevision===3
    && authorization.sourceSha256===directory.sourceSha256
    && authorization.authorityLogicalRoot===expectedRoot
    && authorization.deliveryHold===true
    && authorization.mainCodeMergeAuthorized===false
    && authorization.recordedAt===request.humanAuthorization.authorizedAt
    && exactJson(authorization.allowedSemanticPaths,request.allowedSemanticPaths);
  if(!authorizationMatches)throw new Error('human rework authorization record does not exactly authorize this campaign/source/scope/path set');
  const allowed=request.allowedSemanticPaths;
  if(!Array.isArray(allowed)||allowed.length===0)throw new Error('allowedSemanticPaths must be non-empty');
  const allowedFailures=validateAllowedSemanticPaths(root,expectedRoot,1,allowed);
  if(allowedFailures.length)throw new Error('invalid sealed rework scope: '+allowedFailures.join('; '));
  const priorForm=readJson(priorFormFile);
  const repairedForm=readJson(repairedFormFile);
  const priorProtected=structuredClone(priorForm);
  const repairedProtected=structuredClone(repairedForm);
  for(const semanticPath of allowed){deleteObjectPath(priorProtected,semanticPath);deleteObjectPath(repairedProtected,semanticPath);}
  if(!exactJson(priorProtected,repairedProtected))throw new Error('repaired work form changed data outside allowedSemanticPaths');
  const refresh=request.dependentRefresh??{};
  for(const key of ['regenerateCanonical','regenerateReport','regenerateDerived','resealReceipt','prepareSuccessorAssignment'])if(refresh[key]!==true)throw new Error('dependentRefresh.'+key+' must be true');
  const invalidation=request.evidenceInvalidation??{};
  if(invalidation.eventId!=='INV-P1-REWORK-002'||invalidation.ruleId!=='EIM-013'||invalidation.requiredPriorStatus!=='SEALED_REVISION_2'||invalidation.resolveTo!=='RESOLVED_BY_PHASE_1_REVISION_3')throw new Error('sealed rework invalidation binding mismatch');
  const invalidRel=path.posix.join(campaignPath,'controller/EVIDENCE_INVALIDATION_MATRIX_v1.json');
  const invalid=readJson(requiredFile(root,invalidRel,'evidence invalidation matrix'));
  const events=invalid.events??invalid.invalidationEvents??[];
  if(events.some(x=>x?.eventId==='INV-P1-REWORK-002'||x?.id==='INV-P1-REWORK-002'))throw new Error('INV-P1-REWORK-002 already exists');
  const predecessorInput=(priorReceipt.inputs??[]).find(x=>x?.role==='PREDECESSOR_RECEIPT')?.path;
  if(!predecessorInput)throw new Error('prior Phase-1 receipt lacks predecessor receipt input');
  const loaded=loadPhaseSchema(root,expectedRoot,1);
  const expectedReport=path.posix.join(campaignPath,'work/phase-01/PHASE_01_FINAL_REPORT_v3.md');
  const expectedPacket=path.posix.join(campaignPath,'submissions/PHASE_01_WORK_PACKET_v3.json');
  if(request.generatedFinalReportPath!==expectedReport||request.generatedPacketPath!==expectedPacket)throw new Error('sealed rework must preserve prior products and use report/packet v3 paths');
  if(repairedForm.schemaVersion!=='curveyield-lite-phase-work-form-v1'||repairedForm.phase!==1)throw new Error('repaired work form identity mismatch');
  const prefillDigest=repairedForm.automationInputs?.controllerPrefillDigestSha256;
  if(!SHA256.test(String(prefillDigest??'')))throw new Error('repaired work form lacks controller prefill digest');
  return {
    request,
    authorityRoot:expectedRoot,
    invalidationRel:invalidRel,
    assignment:{
      phaseSequence:1,phaseId:'phase-1',phaseRevision:3,reviewer:'reviewer-1',status:'ACTIVE',
      workSchemaPath:loaded.rel,workFormPath:request.repairedWorkForm.path,
      finalReportPath:request.generatedFinalReportPath,
      packetPath:request.generatedPacketPath,
      predecessorReceiptPath:predecessorInput,derivedInputPaths:priorReceipt.inputs?.filter(x=>x?.role==='DERIVED_INPUT').map(x=>x.path)??[],
      controllerPrefillDigestSha256:prefillDigest,
      sealedRework:{scopeId:request.humanAuthorization.scopeId,requestPath,admittedAt:now}
    }
  };
}
