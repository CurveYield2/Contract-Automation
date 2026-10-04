import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {readJson,writeJson,repoFile,requiredFile,loadPhaseSchema,getByPath} from './lite-phase-work-v1.mjs';

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

export function collectSegmentArtifacts({root,campaignPath,segment}){
  const artifacts=[];
  for(const phase of segment.phases){
    const receiptInfo=latestReceipt(root,campaignPath,phase);
    const receiptKind=receiptInfo.receipt.phase.status==='SKIPPED'?'SKIP_MARKER':'SEALED_RECEIPT';
    if(phase===7){
      const canonical=canonicalRel(campaignPath,phase);
      const canonicalData=readJson(requiredFile(root,canonical,'Phase-7 marker canonical data'));
      artifacts.push(artifact(root,campaignPath,phase,'MACHINE_MARKER',canonical));
      if(canonicalData.workFormPath)artifacts.push(artifact(root,campaignPath,phase,'WORK_FORM',canonicalData.workFormPath));
    }else if(receiptKind!=='SKIP_MARKER'){
      const canonical=canonicalRel(campaignPath,phase);
      const canonicalData=readJson(requiredFile(root,canonical,'Phase '+phase+' canonical data'));
      artifacts.push(artifact(root,campaignPath,phase,'CANONICAL_DATA',canonical));
      artifacts.push(artifact(root,campaignPath,phase,'WORK_FORM',canonicalData.workFormPath));
      if(canonicalData.finalReportPath)artifacts.push(artifact(root,campaignPath,phase,'PHASE_REPORT',canonicalData.finalReportPath));
    }
    artifacts.push(artifact(root,campaignPath,phase,receiptKind,receiptInfo.rel,{receiptRevision:receiptInfo.revision}));
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

export function stageMasterReview({root,campaignPath,directory,predecessor,authorityRoot,boundaryPhase,lastSealedReceiptPath,nextSequence,nextDerivedInputPaths=[],successorPrefillContext={},now}){
  const cfg=validateMasterReviewConfiguration(directory,{required:true});
  if(directory.pendingMasterReview)throw new Error('campaign already has pendingMasterReview');
  const segment=segmentForBoundary(boundaryPhase);
  if(!segment)throw new Error('unsupported master review boundary '+boundaryPhase);
  const reviewedArtifacts=collectSegmentArtifacts({root,campaignPath,segment});
  const bindings=bindingRecord({root,campaignPath,directory,predecessor,authorityRoot,reviewedArtifacts});
  const workFormRel=path.posix.join(campaignPath,'work/master-review',segment.segmentId,'MASTER_REVIEW_WORK_FORM_v1.json');
  const workForm={
    schemaVersion:'curveyield-lite-master-review-work-form-v1',
    campaignId:directory.campaignId,
    campaignGenerationId:directory.campaignGenerationId,
    segmentId:segment.segmentId,
    reviewerId:segment.reviewerId,
    boundaryPhase:segment.boundaryPhase,
    segmentPhases:[...segment.phases],
    reviewAttempt:1,
    masterIdentity:{chatUrl:cfg.chatUrl,reasoning:'MAXIMUM'},
    bindings,
    reviewedArtifacts,
    review:{
      outcome:'<REQUIRED_ACCEPT_OR_REWORK>',
      summary:'<REQUIRED>',
      deficiencies:[],
      repairSpec:null
    },
    childRepair:null,
    masterVerification:{
      outcome:'<REQUIRED_ACCEPT_OR_REWORK>',
      verifiedArtifactDigests:[],
      deficiencyDispositions:[],
      notes:'<REQUIRED>',
      verifiedAt:null
    },
    controllerOwnedPaths:[
      'schemaVersion','campaignId','campaignGenerationId','segmentId','reviewerId','boundaryPhase',
      'segmentPhases','reviewAttempt','masterIdentity','bindings','reviewedArtifacts','controllerOwnedPaths'
    ],
    createdAt:now,
    updatedAt:now
  };
  writeJson(repoFile(root,workFormRel),workForm);
  const pending={
    schemaVersion:'curveyield-lite-master-review-pending-v1',
    segmentId:segment.segmentId,
    reviewerId:segment.reviewerId,
    boundaryPhase:segment.boundaryPhase,
    segmentPhases:[...segment.phases],
    status:'WAITING_FOR_MASTER_REVIEW',
    workFormPath:workFormRel,
    reviewedRevision:Math.max(...reviewedArtifacts.map(x=>x.receiptRevision??0),1),
    reviewAttempt:1,
    masterChatUrl:cfg.chatUrl,
    manifestSha256:bindings.segmentManifestSha256,
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
  return {segment,pending,workForm};
}

function exactJson(a,b){return JSON.stringify(a)===JSON.stringify(b);}
function validateLockedForm(form,pending,directory,cfg){
  const failures=[];
  if(form.schemaVersion!=='curveyield-lite-master-review-work-form-v1')failures.push('master work form schemaVersion mismatch');
  for(const [key,expected] of Object.entries({
    campaignId:directory.campaignId,
    campaignGenerationId:directory.campaignGenerationId,
    segmentId:pending.segmentId,
    reviewerId:pending.reviewerId,
    boundaryPhase:pending.boundaryPhase,
    reviewAttempt:pending.reviewAttempt
  }))if(!exactJson(form[key],expected))failures.push('master work form '+key+' mismatch');
  if(!exactJson(form.segmentPhases,pending.segmentPhases))failures.push('master work form segmentPhases mismatch');
  if(form.masterIdentity?.chatUrl!==cfg.chatUrl||form.masterIdentity?.reasoning!=='MAXIMUM')failures.push('master identity/configuration mismatch');
  if(form.bindings?.segmentManifestSha256!==pending.manifestSha256)failures.push('master manifest digest mismatch');
  if(digestJson(form.reviewedArtifacts)!==pending.manifestSha256)failures.push('master reviewedArtifacts were modified');
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
function validateRepairSpec({root,authorityRoot,segment,form}){
  const failures=[];
  const deficiencies=form.review?.deficiencies;
  const spec=form.review?.repairSpec;
  if(!Array.isArray(deficiencies)||deficiencies.length===0)failures.push('REWORK requires at least one bounded deficiency');
  if(!spec||typeof spec!=='object')return [...failures,'REWORK requires repairSpec'];
  if(typeof spec.scopeId!=='string'||!spec.scopeId)failures.push('repairSpec.scopeId is required');
  if(!Array.isArray(spec.allowedFiles)||spec.allowedFiles.length===0)failures.push('repairSpec.allowedFiles must be non-empty');
  if(!Array.isArray(spec.allowedSemanticPaths)||spec.allowedSemanticPaths.length===0)failures.push('repairSpec.allowedSemanticPaths must be non-empty');
  const workFiles=new Map((form.reviewedArtifacts??[]).filter(x=>x.kind==='WORK_FORM').map(x=>[x.path,x.phase]));
  for(const file of spec.allowedFiles??[])if(!workFiles.has(file))failures.push('repairSpec.allowedFiles is outside reviewed work forms: '+file);
  for(const entry of spec.allowedSemanticPaths??[]){
    if(!entry||typeof entry!=='object'){failures.push('repairSpec.allowedSemanticPaths entries must be objects');continue;}
    const phase=workFiles.get(entry.file);
    if(!segment.phases.includes(phase)){failures.push('repair semantic path phase is outside segment');continue;}
    const match=String(entry.path??'').match(/^actions\.([A-Za-z0-9._-]+)\.outputs\.([A-Za-z0-9._-]+)(?:\[[0-9]+\])?(?:\.[A-Za-z0-9._-]+)*$/);
    if(!match){failures.push('repair semantic path is not a reviewer action output: '+String(entry.path));continue;}
    const schema=loadPhaseSchema(root,authorityRoot,phase).schema;
    const field=(schema.actions?.[match[1]]?.fields??[]).find(x=>x.name===match[2]);
    if(!field)failures.push('repair semantic path is not schema-declared: '+entry.path);
  }
  const prohibited=new Set(spec.prohibitedActions??[]);
  for(const action of ['SEAL','ADVANCE','MUTATE_ACCEPTED_PREFILL','MUTATE_UNRELATED_EVIDENCE'])if(!prohibited.has(action))failures.push('repairSpec.prohibitedActions must include '+action);
  if(!Array.isArray(spec.requiredDependentRefreshes))failures.push('repairSpec.requiredDependentRefreshes must be an array');
  return failures;
}

export function processMasterReviewSubmission({root,campaignPath,directory,authorityRoot,segmentId,now}){
  const cfg=validateMasterReviewConfiguration(directory,{required:true});
  const pending=directory.pendingMasterReview;
  if(!pending)throw new Error('campaign has no pending master review');
  if(segmentId&&segmentId!==pending.segmentId)throw new Error('submitted segment does not match pending master review');
  const segment=segmentForId(pending.segmentId);
  if(!segment)throw new Error('pending master review segment is unsupported');
  const form=readJson(requiredFile(root,pending.workFormPath,'master review work form'));
  const failures=[
    ...validateLockedForm(form,pending,directory,cfg),
    ...currentArtifactFailures(root,campaignPath,form.reviewedArtifacts)
  ];
  if(failures.length)return {status:'MASTER_REVIEW_INVALID',failures,form,pending};
  const outcome=String(form.review?.outcome??'');
  if(outcome==='REWORK'){
    failures.push(...validateRepairSpec({root,authorityRoot,segment,form}));
    if(failures.length)return {status:'MASTER_REVIEW_INVALID',failures,form,pending};
    pending.status='MASTER_REVIEW_REWORK_REQUIRED';
    pending.reviewAttempt=Number(pending.reviewAttempt??1);
    pending.repairScopeId=form.review.repairSpec.scopeId;
    pending.updatedAt=now;
    directory.campaignStatus='MASTER_REVIEW_REWORK_REQUIRED';
    directory.updatedAt=now;
    return {status:'MASTER_REVIEW_REWORK_REQUIRED',failures:[],form,pending,repairSpec:form.review.repairSpec};
  }
  if(outcome!=='ACCEPT')return {status:'MASTER_REVIEW_INVALID',failures:['review.outcome must be ACCEPT or REWORK'],form,pending};
  if((form.review?.deficiencies??[]).length)return {status:'MASTER_REVIEW_INVALID',failures:['ACCEPT cannot retain deficiencies'],form,pending};
  if(form.review?.repairSpec!==null&&form.review?.repairSpec!==undefined)return {status:'MASTER_REVIEW_INVALID',failures:['ACCEPT cannot retain repairSpec'],form,pending};
  const verification=form.masterVerification;
  if(verification?.outcome!=='ACCEPT')return {status:'MASTER_REVIEW_INVALID',failures:['masterVerification.outcome must be ACCEPT'],form,pending};
  const expected=(form.reviewedArtifacts??[]).map(x=>({path:x.path,sha256:x.sha256}));
  if(!exactJson(verification.verifiedArtifactDigests,expected))return {status:'MASTER_REVIEW_INVALID',failures:['masterVerification.verifiedArtifactDigests must exactly match the current segment manifest'],form,pending};
  if(typeof verification.verifiedAt!=='string'||!verification.verifiedAt)return {status:'MASTER_REVIEW_INVALID',failures:['masterVerification.verifiedAt is required'],form,pending};
  return {status:'MASTER_REVIEW_ACCEPTED',failures:[],form,pending,successorPlan:pending.successorPlan};
}

export function masterWakeMessage({campaignId,pending}){
  return [
    'MASTER_REVIEW_REQUIRED.',
    'Act as the persistent Maximum-intelligence master reviewer for campaign '+campaignId+'.',
    'Review the entire '+pending.segmentId+' segment using the exact source, build, authority, receipts, forms, canonical data, reports, and digests in '+pending.workFormPath+'.',
    'Record structured deficiencies and a bounded repair specification, or issue ACCEPT with exact verified artifact digests.',
    'Do not claim independence from your prior master reviews. Do not perform reviewer-owned repairs, seal a phase, advance a successor, or complete the campaign.'
  ].join(' ');
}

export function childRepairWakeMessage({campaignId,pending,repairSpec}){
  return [
    'MASTER_REVIEW_BOUNDED_REPAIR.',
    'You are a fresh Sol agent at High reasoning for campaign '+campaignId+' and scope '+repairSpec.scopeId+'.',
    'Modify only repairSpec.allowedFiles at repairSpec.allowedSemanticPaths, preserve controller prefills and accepted evidence, and perform only listed requiredDependentRefreshes.',
    'Do not seal, advance, wake a successor, or broaden scope. Return changed paths and evidence to the same persistent master reviewer.',
    'Master work form: '+pending.workFormPath+'.'
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
  const priorReceiptFile=assertDigest(root,request.priorReceipt,'prior Phase-1 receipt');
  const priorReceipt=readJson(priorReceiptFile);
  if(priorReceipt.phase?.sequence!==1||priorReceipt.phase?.revision!==2||priorReceipt.phase?.status!=='SEALED')throw new Error('prior receipt is not sealed Phase-1 revision2');
  if(priorReceipt.source?.sha256!==directory.sourceSha256&&priorReceipt.sourceSha256!==directory.sourceSha256)throw new Error('prior receipt source mismatch');
  if(path.posix.dirname(priorReceipt.authority?.homepagePath??'')!==expectedRoot)throw new Error('prior receipt authority mismatch');
  const priorFormFile=assertDigest(root,request.priorWorkForm,'prior Phase-1 work form');
  const repairedFormFile=assertDigest(root,request.repairedWorkForm,'repaired Phase-1 work form');
  assertDigest(root,request.qualityReview,'Phase-1 quality review');
  if(!request.humanAuthorization?.scopeId||!request.humanAuthorization?.authorizedAt)throw new Error('explicit human rework authorization metadata is required');
  assertDigest(root,{path:request.humanAuthorization.recordPath,sha256:request.humanAuthorization.recordSha256},'human rework authorization record');
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
