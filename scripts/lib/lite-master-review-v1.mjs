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

function referencedArtifact({root,campaignPath,phase,kind,reference,requireDigest=true}){
  const raw=reference?.path;
  if(typeof raw!=='string'||!raw)return null;
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
    if(phase===7){
      const canonical=canonicalRel(campaignPath,phase);
      const canonicalData=readJson(requiredFile(root,canonical,'Phase-7 marker canonical data'));
      pushUniqueArtifact(artifacts,seen,artifact(root,campaignPath,phase,'MACHINE_MARKER',canonical));
      if(canonicalData.workFormPath)pushUniqueArtifact(artifacts,seen,artifact(root,campaignPath,phase,'WORK_FORM',canonicalData.workFormPath));
    }else if(receiptKind!=='SKIP_MARKER'){
      const canonical=canonicalRel(campaignPath,phase);
      const canonicalData=readJson(requiredFile(root,canonical,'Phase '+phase+' canonical data'));
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

export function stageMasterReview({root,campaignPath,directory,predecessor,authorityRoot,boundaryPhase,lastSealedReceiptPath,nextSequence,nextDerivedInputPaths=[],successorPrefillContext={},now}){
  const cfg=validateMasterReviewConfiguration(directory,{required:true});
  if(directory.pendingMasterReview)throw new Error('campaign already has pendingMasterReview');
  const segment=segmentForBoundary(boundaryPhase);
  if(!segment)throw new Error('unsupported master review boundary '+boundaryPhase);
  const reviewedArtifacts=collectSegmentArtifacts({root,campaignPath,segment,directory,expectedAuthority:predecessor.authority});
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
    bindingsSha256:digestJson(bindings),
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
  if(form.bindings?.source?.sha256!==directory.sourceSha256)failures.push('master source binding does not match current campaign directory');
  if(digestJson(form.bindings)!==pending.bindingsSha256)failures.push('master source/build/authority bindings were modified');
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
function currentBindingFailures(root,campaignPath,form,directory){
  const failures=[];
  const bindings=form.bindings??{};
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
function substantiveText(value){return typeof value==='string'&&value.trim().length>=8&&!/^<REQUIRED/.test(value.trim());}
function validateRepairSpec({root,authorityRoot,segment,form}){
  const failures=[];
  const deficiencies=form.review?.deficiencies;
  const spec=form.review?.repairSpec;
  if(!substantiveText(form.review?.summary))failures.push('REWORK requires a substantive review.summary');
  if(!Array.isArray(deficiencies)||deficiencies.length===0)failures.push('REWORK requires at least one bounded deficiency');
  const deficiencyIds=new Set();
  for(const deficiency of Array.isArray(deficiencies)?deficiencies:[]){
    if(!deficiency||typeof deficiency!=='object'){failures.push('REWORK deficiencies must be objects');continue;}
    if(typeof deficiency.id!=='string'||!deficiency.id||deficiencyIds.has(deficiency.id))failures.push('REWORK deficiency IDs must be non-empty and unique');
    else deficiencyIds.add(deficiency.id);
    if(!segment.phases.includes(Number(deficiency.phase)))failures.push('REWORK deficiency phase is outside the reviewed segment: '+String(deficiency.id));
    if(!Array.isArray(deficiency.ownedPaths)||deficiency.ownedPaths.length===0||deficiency.ownedPaths.some(x=>typeof x!=='string'||!x))failures.push('REWORK deficiency ownedPaths must be non-empty: '+String(deficiency.id));
    if(!Array.isArray(deficiency.evidenceRefs)||deficiency.evidenceRefs.length===0||deficiency.evidenceRefs.some(x=>typeof x!=='string'||!x))failures.push('REWORK deficiency evidenceRefs must be non-empty: '+String(deficiency.id));
  }
  if(!spec||typeof spec!=='object')return [...failures,'REWORK requires repairSpec'];
  if(typeof spec.scopeId!=='string'||!spec.scopeId)failures.push('repairSpec.scopeId is required');
  if(!Array.isArray(spec.allowedFiles)||spec.allowedFiles.length===0)failures.push('repairSpec.allowedFiles must be non-empty');
  if(!Array.isArray(spec.allowedSemanticPaths)||spec.allowedSemanticPaths.length===0)failures.push('repairSpec.allowedSemanticPaths must be non-empty');
  const workFiles=new Map((form.reviewedArtifacts??[]).filter(x=>x.kind==='WORK_FORM').map(x=>[x.path,x.phase]));
  const reviewedPaths=new Set((form.reviewedArtifacts??[]).map(x=>x.path));
  for(const file of spec.allowedFiles??[])if(!workFiles.has(file))failures.push('repairSpec.allowedFiles is outside reviewed work forms: '+file);
  const allowedFileSet=new Set(spec.allowedFiles??[]);
  const allowedSemanticPathSet=new Set((spec.allowedSemanticPaths??[]).map(x=>String(x?.file??'')+'|'+String(x?.path??'')));
  for(const deficiency of Array.isArray(deficiencies)?deficiencies:[]){
    if(typeof deficiency?.file!=='string'||workFiles.get(deficiency.file)!==Number(deficiency.phase))failures.push('REWORK deficiency file/phase must identify its staged segment work form: '+String(deficiency?.id));
    if(!substantiveText(deficiency?.rationale))failures.push('REWORK deficiency rationale must be substantive: '+String(deficiency?.id));
    for(const ownedPath of deficiency?.ownedPaths??[])if(!allowedSemanticPathSet.has(String(deficiency?.file??'')+'|'+ownedPath))failures.push('repairSpec does not admit deficiency file/path: '+String(deficiency?.file)+'#'+ownedPath);
    for(const evidenceRef of deficiency?.evidenceRefs??[])if(!reviewedPaths.has(evidenceRef))failures.push('REWORK deficiency evidenceRef is outside the staged segment manifest: '+evidenceRef);
  }
  for(const entry of spec.allowedSemanticPaths??[]){
    if(!entry||typeof entry!=='object'){failures.push('repairSpec.allowedSemanticPaths entries must be objects');continue;}
    if(!allowedFileSet.has(entry.file)){failures.push('repair semantic path file is not listed in repairSpec.allowedFiles: '+String(entry.file));continue;}
    const phase=workFiles.get(entry.file);
    if(!segment.phases.includes(phase)){failures.push('repair semantic path phase is outside segment');continue;}
    const match=String(entry.path??'').match(/^actions\.([A-Za-z0-9._-]+)\.outputs\.([A-Za-z0-9._-]+)$/);
    if(!match){failures.push('repair semantic path is not a reviewer action output: '+String(entry.path));continue;}
    const schema=loadPhaseSchema(root,authorityRoot,phase).schema;
    const field=(schema.actions?.[match[1]]?.fields??[]).find(x=>x.name===match[2]);
    if(!field)failures.push('repair semantic path is not schema-declared: '+entry.path);
    const controllerReducerPaths=[...(schema.bookkeepingMappings?.obligationRecordPaths??[]),...(schema.bookkeepingMappings?.invalidationRecordPaths??[])];
    if(controllerReducerPaths.includes(entry.path))failures.push('repair semantic path requires unsupported historical obligation/invalidation replay: '+entry.path);
  }
  const prohibited=new Set(spec.prohibitedActions??[]);
  for(const action of ['SEAL','ADVANCE','MUTATE_ACCEPTED_PREFILL','MUTATE_UNRELATED_EVIDENCE'])if(!prohibited.has(action))failures.push('repairSpec.prohibitedActions must include '+action);
  if(!Array.isArray(spec.acceptanceConditions)||spec.acceptanceConditions.length===0||spec.acceptanceConditions.some(x=>!substantiveText(x)))failures.push('repairSpec.acceptanceConditions must be a non-empty substantive string array');
  const supportedRefreshes=['REGENERATE_CANONICAL','REGENERATE_REPORT','REGENERATE_DERIVED','RESEAL_RECEIPT'];
  if(!exactJson(spec.requiredDependentRefreshes,supportedRefreshes))failures.push('repairSpec.requiredDependentRefreshes must exactly match controller-supported deterministic refreshes');
  return failures;
}

function repairPathsByFile(spec){
  const out=new Map();
  for(const entry of spec?.allowedSemanticPaths??[]){
    if(!out.has(entry.file))out.set(entry.file,[]);
    out.get(entry.file).push(entry.path);
  }
  return out;
}
function protectedWorkFormDigest(root,campaignPath,file,semanticPaths){
  const form=readJson(requiredFile(root,path.posix.join(campaignPath,file),'master-repair work form'));
  const protectedForm=structuredClone(form);
  for(const semanticPath of semanticPaths)deleteObjectPath(protectedForm,semanticPath);
  return digestJson(protectedForm);
}
function createRepairBaseline({root,campaignPath,form}){
  const pathsByFile=repairPathsByFile(form.review.repairSpec);
  return [...pathsByFile.entries()].map(([file,semanticPaths])=>({
    file,
    phase:(form.reviewedArtifacts??[]).find(x=>x.kind==='WORK_FORM'&&x.path===file)?.phase??null,
    semanticPaths:[...semanticPaths],
    beforeSha256:digestFile(requiredFile(root,path.posix.join(campaignPath,file),'master-repair work form')),
    protectedProjectionSha256:protectedWorkFormDigest(root,campaignPath,file,semanticPaths)
  })).sort((a,b)=>a.file.localeCompare(b.file));
}
function expectedPreRefreshRows({root,campaignPath,form,baseline}){
  const allowed=new Map((baseline??[]).map(x=>[x.file,x]));
  return (form.reviewedArtifacts??[]).map(row=>{
    if(row.kind!=='WORK_FORM'||!allowed.has(row.path))return row;
    const file=requiredFile(root,path.posix.join(campaignPath,row.path),'master-repair changed work form');
    return {...row,sha256:digestFile(file)};
  });
}
function validateRepairCompletion({root,campaignPath,form,pending,cfg,normalReviewerChatUrls=[]}){
  const failures=[];
  const spec=form.review?.repairSpec;
  if(!spec||digestJson(spec)!==pending.repairSpecSha256)failures.push('repairSpec changed after bounded REWORK admission');
  if(digestJson(form.review?.deficiencies)!==pending.originalDeficienciesSha256)failures.push('review deficiencies changed after bounded REWORK admission');
  if(spec?.scopeId!==pending.repairScopeId)failures.push('repair scopeId changed after bounded REWORK admission');
  const baseline=pending.repairBaseline;
  if(!Array.isArray(baseline)||baseline.length===0)failures.push('pending repair baseline is missing');
  const child=form.childRepair;
  if(!child||typeof child!=='object')failures.push('childRepair evidence is required');
  else{
    if(child.scopeId!==pending.repairScopeId)failures.push('childRepair.scopeId mismatch');
    if(child.model!=='SOL'||child.reasoning!=='HIGH')failures.push('childRepair must identify exact SOL / HIGH capability');
    if(child.freshChild!==true)failures.push('childRepair.freshChild must be true');
    if(!CHAT_URL.test(String(child.childChatUrl??''))||child.childChatUrl===cfg.chatUrl||normalReviewerChatUrls.includes(child.childChatUrl))failures.push('childRepair requires a durable fresh-child ChatGPT URL distinct from the master and registered normal reviewers');
    if(child.result!=='COMPLETED')failures.push('childRepair.result must be COMPLETED');
    if(typeof child.completedAt!=='string'||!child.completedAt)failures.push('childRepair.completedAt is required');
  }
  const expectedFiles=(baseline??[]).map(x=>x.file).sort();
  const actualFiles=(child?.changedFiles??[]).map(x=>x?.file).sort();
  if(!exactJson(actualFiles,expectedFiles))failures.push('childRepair.changedFiles must exactly match repairSpec.allowedFiles');
  const expectedPaths=(spec?.allowedSemanticPaths??[]).map(x=>({file:x.file,path:x.path})).sort((a,b)=>(a.file+'|'+a.path).localeCompare(b.file+'|'+b.path));
  const actualPaths=(child?.changedSemanticPaths??[]).map(x=>({file:x?.file,path:x?.path})).sort((a,b)=>(a.file+'|'+a.path).localeCompare(b.file+'|'+b.path));
  if(!exactJson(actualPaths,expectedPaths))failures.push('childRepair.changedSemanticPaths must exactly match repairSpec.allowedSemanticPaths');
  const childFiles=new Map((child?.changedFiles??[]).map(x=>[x?.file,x]));
  for(const base of baseline??[]){
    const file=requiredFile(root,path.posix.join(campaignPath,base.file),'master-repair changed work form');
    const after=digestFile(file);
    const evidence=childFiles.get(base.file);
    if(evidence?.beforeSha256!==base.beforeSha256||evidence?.afterSha256!==after)failures.push('childRepair changed-file digest evidence mismatch: '+base.file);
    if(after===base.beforeSha256)failures.push('childRepair did not change allowed work form: '+base.file);
    if(protectedWorkFormDigest(root,campaignPath,base.file,base.semanticPaths)!==base.protectedProjectionSha256)failures.push('childRepair modified prefills or evidence outside allowed semantic paths: '+base.file);
  }
  const allowed=new Set(expectedFiles);
  failures.push(...currentArtifactFailures(root,campaignPath,(form.reviewedArtifacts??[]).filter(x=>x.kind!=='WORK_FORM'||!allowed.has(x.path))));
  const candidateRows=expectedPreRefreshRows({root,campaignPath,form,baseline});
  return {failures,candidateRows};
}
function validateRefreshedRepairVerification({root,campaignPath,form,pending,segment,directory}){
  const failures=[];
  if(digestJson(form.review?.repairSpec)!==pending.repairSpecSha256)failures.push('repairSpec changed after controller refresh');
  if(digestJson(form.review?.deficiencies)!==pending.originalDeficienciesSha256)failures.push('review deficiencies changed after controller refresh');
  if(digestJson(form.childRepair)!==form.bindings?.repairChildSha256)failures.push('childRepair evidence changed after controller refresh');
  const post=form.postRepair;
  if(!post||post.schemaVersion!=='curveyield-lite-master-repair-refresh-v1')failures.push('controller postRepair record is missing');
  else{
    if(post.scopeId!==pending.repairScopeId||post.repairSpecSha256!==pending.repairSpecSha256)failures.push('postRepair scope binding mismatch');
    if(post.manifestSha256!==pending.postRepairManifestSha256||digestJson(post.artifacts)!==pending.postRepairManifestSha256)failures.push('postRepair manifest binding mismatch');
    try{
      const currentRows=collectSegmentArtifacts({root,campaignPath,segment,directory,expectedAuthority:{homepagePath:form.bindings.authority.homepagePath,liteSkillSha256:form.bindings.authority.sha256}});
      if(!exactJson(currentRows,post.artifacts))failures.push('refreshed segment artifacts no longer match controller postRepair manifest');
    }catch(error){failures.push(String(error.message||error));}
  }
  const verification=form.masterVerification;
  if(verification?.outcome!=='ACCEPT')failures.push('masterVerification.outcome must be ACCEPT after controller refresh');
  const expectedDigests=(post?.artifacts??[]).map(x=>({path:x.path,sha256:x.sha256}));
  if(!exactJson(verification?.verifiedArtifactDigests,expectedDigests))failures.push('masterVerification.verifiedArtifactDigests must exactly match controller-refreshed segment artifacts');
  const deficiencyIds=(form.review?.deficiencies??[]).map(x=>x?.id).filter(Boolean).sort();
  const dispositions=(verification?.deficiencyDispositions??[]);
  const disposedIds=dispositions.map(x=>x?.deficiencyId).filter(Boolean).sort();
  if(!exactJson(disposedIds,deficiencyIds)||dispositions.some(x=>x?.disposition!=='RESOLVED'))failures.push('masterVerification must mark every bounded deficiency RESOLVED exactly once');
  if(typeof verification?.verifiedAt!=='string'||!verification.verifiedAt)failures.push('masterVerification.verifiedAt is required');
  return failures;
}

export function processMasterReviewSubmission({root,campaignPath,directory,authorityRoot,segmentId,now,normalReviewerChatUrls=[]}){
  const cfg=validateMasterReviewConfiguration(directory,{required:true});
  const pending=directory.pendingMasterReview;
  if(!pending)throw new Error('campaign has no pending master review');
  if(['STOPPED_BY_HUMAN','BLOCKED'].includes(String(directory.campaignStatus??'')))return {status:'MASTER_REVIEW_HELD',failures:['campaign is held by explicit human status '+directory.campaignStatus],pending};
  if(segmentId&&segmentId!==pending.segmentId)throw new Error('submitted segment does not match pending master review');
  const segment=segmentForId(pending.segmentId);
  if(!segment)throw new Error('pending master review segment is unsupported');
  const form=readJson(requiredFile(root,pending.workFormPath,'master review work form'));
  const failures=[
    ...validateLockedForm(form,pending,directory,cfg),
    ...currentBindingFailures(root,campaignPath,form,directory)
  ];
  const outcome=String(form.review?.outcome??'');
  if(pending.status==='MASTER_REVIEW_REWORK_REQUIRED'){
    const completed=validateRepairCompletion({root,campaignPath,form,pending,cfg,normalReviewerChatUrls});
    failures.push(...completed.failures);
    if(failures.length)return {status:'MASTER_REVIEW_INVALID',failures,form,pending};
    return {
      status:'MASTER_REPAIR_READY_FOR_REFRESH',
      failures:[],
      form,
      pending,
      segment,
      repairSpec:form.review.repairSpec,
      repairedArtifactRows:completed.candidateRows,
      affectedPhases:[...new Set((pending.repairBaseline??[]).map(x=>x.phase))].sort((a,b)=>a-b),
      successorPlan:pending.successorPlan
    };
  }
  if(pending.status==='WAITING_FOR_MASTER_REVIEW'&&pending.postRepairManifestSha256){
    failures.push(...validateRefreshedRepairVerification({root,campaignPath,form,pending,segment,directory}));
    if(failures.length)return {status:'MASTER_REVIEW_INVALID',failures,form,pending};
    return {status:'MASTER_REPAIR_ACCEPTED',failures:[],form,pending,segment,successorPlan:pending.successorPlan};
  }
  const currentRows=collectSegmentArtifacts({root,campaignPath,segment,directory,expectedAuthority:{homepagePath:form.bindings.authority.homepagePath,liteSkillSha256:form.bindings.authority.sha256}});
  failures.push(...currentArtifactFailures(root,campaignPath,form.reviewedArtifacts));
  if(digestJson(currentRows)!==pending.manifestSha256)failures.push('current segment manifest no longer matches the staged master-review manifest');
  if(failures.length)return {status:'MASTER_REVIEW_INVALID',failures,form,pending};
  if(outcome==='REWORK'){
    failures.push(...validateRepairSpec({root,authorityRoot,segment,form}));
    if(failures.length)return {status:'MASTER_REVIEW_INVALID',failures,form,pending};
    pending.originalDeficienciesSha256=digestJson(form.review.deficiencies);
    pending.status='MASTER_REVIEW_REWORK_REQUIRED';
    pending.reviewAttempt=Number(pending.reviewAttempt??1);
    pending.repairScopeId=form.review.repairSpec.scopeId;
    pending.repairSpecSha256=digestJson(form.review.repairSpec);
    pending.repairBaseline=createRepairBaseline({root,campaignPath,form});
    pending.updatedAt=now;
    directory.campaignStatus='MASTER_REVIEW_REWORK_REQUIRED';
    directory.updatedAt=now;
    return {status:'MASTER_REVIEW_REWORK_REQUIRED',failures:[],form,pending,repairSpec:form.review.repairSpec};
  }
  if(outcome!=='ACCEPT')return {status:'MASTER_REVIEW_INVALID',failures:['review.outcome must be ACCEPT or REWORK'],form,pending};
  if(!substantiveText(form.review?.summary))return {status:'MASTER_REVIEW_INVALID',failures:['ACCEPT requires a substantive review.summary'],form,pending};
  if(!Array.isArray(form.review?.deficiencies)||form.review.deficiencies.length)return {status:'MASTER_REVIEW_INVALID',failures:['ACCEPT requires deficiencies to be an empty array'],form,pending};
  if(form.review?.repairSpec!==null&&form.review?.repairSpec!==undefined)return {status:'MASTER_REVIEW_INVALID',failures:['ACCEPT cannot retain repairSpec'],form,pending};
  if(form.childRepair!==null&&form.childRepair!==undefined)return {status:'MASTER_REVIEW_INVALID',failures:['ACCEPT without a REWORK cycle cannot retain childRepair evidence'],form,pending};
  const verification=form.masterVerification;
  if(verification?.outcome!=='ACCEPT')return {status:'MASTER_REVIEW_INVALID',failures:['masterVerification.outcome must be ACCEPT'],form,pending};
  const expected=(form.reviewedArtifacts??[]).map(x=>({path:x.path,sha256:x.sha256}));
  if(!exactJson(verification.verifiedArtifactDigests,expected))return {status:'MASTER_REVIEW_INVALID',failures:['masterVerification.verifiedArtifactDigests must exactly match the current segment manifest'],form,pending};
  if(!Array.isArray(verification.deficiencyDispositions)||verification.deficiencyDispositions.length)return {status:'MASTER_REVIEW_INVALID',failures:['ACCEPT requires empty masterVerification.deficiencyDispositions'],form,pending};
  if(!substantiveText(verification.notes))return {status:'MASTER_REVIEW_INVALID',failures:['ACCEPT requires substantive masterVerification.notes'],form,pending};
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
    'Modify only repairSpec.allowedFiles at repairSpec.allowedSemanticPaths and preserve controller prefills and accepted evidence. The controller, not the child, performs every listed dependent refresh.',
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
