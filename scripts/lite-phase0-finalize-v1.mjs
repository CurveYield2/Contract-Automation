#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

function args(argv){const out={};for(let i=2;i<argv.length;i+=2){const k=argv[i],v=argv[i+1];if(!k?.startsWith('--')||v===undefined)throw new Error('arguments must be --key value');out[k.slice(2)]=v;}return out;}
function sha(bytes){return createHash('sha256').update(bytes).digest('hex');}
function read(file){return JSON.parse(fs.readFileSync(file,'utf8'));}
function write(file,value){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n');}
function digestFile(file){return sha(fs.readFileSync(file));}
function latest(dir,prefix){const names=fs.readdirSync(dir).filter(n=>new RegExp('^'+prefix+'_v\\d+\\.json$','i').test(n)).sort((a,b)=>Number(a.match(/_v(\\d+)/i)?.[1]??0)-Number(b.match(/_v(\\d+)/i)?.[1]??0));if(!names.length)throw new Error('missing '+prefix+' under '+dir);return path.join(dir,names.at(-1));}
function required(file,label){if(!fs.existsSync(file)||!fs.statSync(file).isFile())throw new Error('missing '+label+': '+file);return file;}
function rel(root,file){return path.relative(root,file).replaceAll('\\\\','/');}

const a=args(process.argv);
for(const k of ['controller-root','campaign-path','qualification-path','contract-automation-sha','workflow-run-id']) if(!a[k]) throw new Error('missing --'+k);
const controllerRoot=path.resolve(a['controller-root']);
const campaignPath=a['campaign-path'];
if(!campaignPath.startsWith('campaigns/')||campaignPath.includes('..')) throw new Error('unsafe campaign path');
const campaignRoot=path.join(controllerRoot,...campaignPath.split('/'));
const controllerDir=path.join(campaignRoot,'controller');
const stateFile=latest(controllerDir,'CAMPAIGN_STATE');
const pointerFile=latest(controllerDir,'ACTIVE_PHASE_POINTER');
const soloFile=latest(controllerDir,'SOLO_AUDIT_STATE');
const state=read(stateFile), pointer=read(pointerFile), solo=read(soloFile);
if(state.assuranceMode?.mode!=='LITE') throw new Error('campaign is not Lite');
if(state.phase?.id!=='phase-0') throw new Error('campaign is not at phase-0');
if(!['AUTOMATION_PENDING','AUTOMATION_ACTIVE'].includes(state.phase?.state)) throw new Error('phase-0 state is not automation-active');
const qualification=read(path.resolve(a['qualification-path']));
if(qualification.status!=='PASS') throw new Error('V7 qualification is not PASS');
if(qualification.qualifiedCommit!==a['contract-automation-sha']) throw new Error('V7 qualification does not bind current Contract-Automation commit');

const evidence = {
  build: required(path.join(campaignRoot,'evidence/build/BUILD_AND_SOURCE_IDENTITY_v1.json'),'build identity'),
  sbom: required(path.join(campaignRoot,'evidence/dependencies/SBOM_v1.json'),'SBOM'),
  slither: required(path.join(campaignRoot,'evidence/static-analysis/SLITHER_v1.json'),'Slither evidence'),
  sourceIntelligence: required(path.join(campaignRoot,'evidence/source-intelligence/SOURCE_INTELLIGENCE_v1.json'),'Source Intelligence'),
  runtimeOverlay: required(path.join(campaignRoot,'evidence/source-intelligence/runtime-deployment-overlay_v1.json'),'runtime overlay'),
  readinessOverlay: required(path.join(campaignRoot,'evidence/source-intelligence/assurance-readiness-overlay_v1.json'),'readiness overlay'),
  bundle: required(path.join(campaignRoot,'evidence/source-intelligence/SOURCE_INTELLIGENCE_BUNDLE_INDEX_v1.json'),'Source Intelligence bundle'),
  readiness: required(path.join(campaignRoot,'evidence/readiness/PROJECT_READINESS_AUTOMATED_v1.json'),'project readiness'),
  graph: required(path.join(campaignRoot,'controller/SECURITY_TRACEABILITY_GRAPH_v1.json'),'traceability graph'),
  ledger: required(path.join(campaignRoot,'controller/CARRIED_FORWARD_OBLIGATION_LEDGER_v1.json'),'obligation ledger')
};
const sourceSha=state.source?.sha256;
if(typeof sourceSha!=='string'||!/^[0-9a-f]{64}$/.test(sourceSha)) throw new Error('canonical source SHA-256 missing');
const build=read(evidence.build);
if(build.source?.archiveSha256Observed!==sourceSha && build.source?.archiveSha256!==sourceSha) throw new Error('build/source evidence does not bind canonical source SHA');
const bundle=read(evidence.bundle);
if(bundle.identity?.sourceDigestSha256!==sourceSha) throw new Error('Source Intelligence bundle does not bind canonical source SHA');

const now=new Date().toISOString();
const phase0Dir=path.join(campaignRoot,'evidence/phase0');
const artifactEntries=Object.entries(evidence).map(([role,file])=>({role,path:rel(campaignRoot,file),sha256:digestFile(file)}));
const manifest={
  schemaVersion:'curveyield-lite-phase0-bootstrap-manifest-v1',
  status:'PASS',
  campaignId:state.campaignId,
  campaignGenerationId:state.campaignGenerationId,
  sourceIdentity:{sha256:sourceSha,archivePath:state.source.archivePath,archiveCommit:state.source.archiveCommit,archiveGitBlobSha:state.source.archiveGitBlobSha},
  skillAuthority:state.skillAuthority?.current??null,
  contractAutomation:{repository:'CurveYield2/Contract-Automation',commit:a['contract-automation-sha'],qualificationRunId:Number(qualification.workflowRunId),qualificationStatus:qualification.status},
  artifacts:artifactEntries,
  createdAt:now
};
const manifestPath=path.join(phase0Dir,'PHASE0_BOOTSTRAP_MANIFEST_v1.json');
write(manifestPath,manifest);

const completion={
  schemaVersion:'curveyield-lite-phase0-automation-completion-v1',
  status:'PASS',
  campaignId:state.campaignId,
  campaignGenerationId:state.campaignGenerationId,
  sourceIdentityDigest:sourceSha,
  executor:{type:'GITHUB_ACTIONS',lineage:'phase0-automation',workflow:'lite-phase0-bootstrap-v1.yml',runId:Number(a['workflow-run-id']),contractAutomationCommit:a['contract-automation-sha']},
  qualification:{status:'PASS',qualifiedCommit:qualification.qualifiedCommit,workflowRunId:Number(qualification.workflowRunId)},
  bootstrapManifest:{path:rel(campaignRoot,manifestPath),sha256:digestFile(manifestPath)},
  artifacts:artifactEntries,
  completedAt:now
};
const completionPath=path.join(phase0Dir,'PHASE0_AUTOMATION_COMPLETION_REPORT_v1.json');
write(completionPath,completion);
const completionDigest=digestFile(completionPath);

const builderUrl=pathToFileURL(path.join(controllerRoot,'packages/controller-core/src/successor-handoff-builder-v1.mjs')).href;
const {buildLiteSuccessorHandoffV1,validateLiteSuccessorHandoffV1,buildLiteSuccessorStartHereV1,buildLiteWakeUpMessageV1}=await import(builderUrl);
const ledger=read(evidence.ledger);
const due=(ledger.obligations??[]).filter(x=>String(x.status??'OPEN').toUpperCase()==='OPEN' && String(x.requiredPhase??'')==='1');
const si=read(evidence.sourceIntelligence);
const handoffInput={
  boundaryProfileId:'P0_TO_P1',
  campaign:{
    campaignId:state.campaignId,
    campaignGenerationId:state.campaignGenerationId,
    campaignName:state.auditName??state.title??state.campaignId,
    workspacePath:campaignPath,
    campaignLink:'https://github.com/CurveYield2/Audit-Controller/tree/main/'+campaignPath.replaceAll(' ','%20'),
    campaignFolderUrl:'https://github.com/CurveYield2/Audit-Controller/tree/main/'+campaignPath.replaceAll(' ','%20')
  },
  source:{
    sourceIdentityDigest:sourceSha,
    archivePath:state.source.archivePath,
    archiveRepository:state.source.archiveRepository,
    archiveCommit:state.source.archiveCommit,
    archiveGitBlobSha:state.source.archiveGitBlobSha
  },
  reviewers:{outgoing:'phase0-automation',incoming:'reviewer-1'},
  milestone:{id:'P0_BOOTSTRAP',status:'SEALED',reportReference:rel(campaignRoot,completionPath),reportDigest:completionDigest},
  globalControls:{
    securityTraceabilityGraph:{path:rel(campaignRoot,evidence.graph),sha256:digestFile(evidence.graph)},
    carriedForwardObligationLedger:{path:rel(campaignRoot,evidence.ledger),sha256:digestFile(evidence.ledger)},
    sourceIntelligenceBundle:{path:rel(campaignRoot,evidence.bundle),sha256:digestFile(evidence.bundle)}
  },
  requiredEvidence:artifactEntries.map(x=>({role:x.role,path:x.path,sha256:x.sha256})),
  dueObligations:due,
  limitations:si.limitations??[],
  sealedAt:now
};
const handoff=buildLiteSuccessorHandoffV1(handoffInput);
const validation=validateLiteSuccessorHandoffV1(handoff);
const handoffDir=path.join(campaignRoot,'handoffs/P0_TO_P1');
fs.mkdirSync(handoffDir,{recursive:true});
write(path.join(handoffDir,'SUCCESSOR_HANDOFF.json'),handoff);
write(path.join(handoffDir,'SUCCESSOR_HANDOFF_VALIDATION_v1.json'),validation);
const start=buildLiteSuccessorStartHereV1({
  handoff,
  mustNotRepeat:['Phase 0 is machine-sealed. Do not rebuild its mechanical inventories unless a typed source/build invalidation requires it.'],
  firstExecutableAction:'Open the current Lite authority Phase-1 instructions and perform the semantic scope/dependency/standards analysis using the sealed Phase-0 baseline.',
  completionCondition:'Complete and seal Phase 1 according to its current Phase Contract, then create the P1_TO_P2 successor boundary.'
});
fs.writeFileSync(path.join(handoffDir,'START_HERE_SUCCESSOR.md'),start);
const startUrl='https://github.com/CurveYield2/Audit-Controller/blob/main/'+campaignPath.replaceAll(' ','%20')+'/handoffs/P0_TO_P1/START_HERE_SUCCESSOR.md';
fs.writeFileSync(path.join(handoffDir,'WAKE_UP_MESSAGE.md'),buildLiteWakeUpMessageV1({handoff,immutableStartUrl:startUrl})+'\n');

const validationReceipt={
  schemaVersion:'curveyield-lite-phase0-automation-validation-v1',
  status:'PASS',
  campaignId:state.campaignId,
  campaignGenerationId:state.campaignGenerationId,
  sourceIdentityDigest:sourceSha,
  bootstrapManifestSha256:digestFile(manifestPath),
  completionReportSha256:completionDigest,
  successorHandoffValidationDigest:validation.validationDigest,
  validatedAt:now
};
write(path.join(controllerDir,'PHASE0_AUTOMATION_VALIDATION_v1.json'),validationReceipt);

state.history ??= [];
state.history.push({phase:0,milestone:'P0_BOOTSTRAP',status:'SEALED',reportPath:rel(campaignRoot,completionPath),reportSha256:completionDigest,handoffPath:'handoffs/P0_TO_P1/SUCCESSOR_HANDOFF.json',handoffSha256:digestFile(path.join(handoffDir,'SUCCESSOR_HANDOFF.json')),endedAt:now});
state.activeAutomation={...(state.activeAutomation??{}),executorType:'GITHUB_ACTIONS',lineage:'phase0-automation',workflow:'lite-phase0-bootstrap-v1.yml',status:'COMPLETE',runId:Number(a['workflow-run-id'])};
state.activeReviewer={lineage:'reviewer-1',model:'gpt-5.6-terra',reasoning:'high',authorizedPhases:[1],status:'WAITING_FOR_ACTIVATION'};
state.phase={sequence:1,id:'phase-1',revision:'v1',state:'WAITING_FOR_SUCCESSOR_AGENT',milestoneId:'P1'};
state.successorHandoff={boundary:'P0_TO_P1',incomingReviewer:'reviewer-1',handoffReference:'handoffs/P0_TO_P1/SUCCESSOR_HANDOFF.json',validationReference:'handoffs/P0_TO_P1/SUCCESSOR_HANDOFF_VALIDATION_v1.json',wakeMessageReference:'handoffs/P0_TO_P1/WAKE_UP_MESSAGE.md'};
state.updatedAt=now;
write(stateFile,state);

pointer.phaseSequence=1;
pointer.status='WAITING_FOR_SUCCESSOR_AGENT';
pointer.reviewerLineage='reviewer-1';
pointer.activeReviewerIdentity='pending-browser-agent';
pointer.lastSealedPhase=0;
pointer.sealedThroughPhase=0;
pointer.phaseStatus='WAITING_FOR_SUCCESSOR_AGENT';
pointer.lastUpdatedAt=now;
pointer.completedMilestone={id:'P0_BOOTSTRAP',status:'SEALED'};
pointer.nextPhaseId='phase-1';
pointer.nextMilestone={id:'P1',state:'WAITING_FOR_SUCCESSOR_AGENT',phaseRange:['1'],reviewer:'reviewer-1'};
pointer.authoritativeHandoff=`${campaignPath}/handoffs/P0_TO_P1/SUCCESSOR_HANDOFF.json`;
write(pointerFile,pointer);
const activePointer=path.join(controllerRoot,'.deep-assurance/active',state.projectSlug+'.json');
if(fs.existsSync(activePointer)) write(activePointer,pointer);

solo.active={milestone:'P1',segment:1,reviewer:'reviewer-1',status:'WAITING_FOR_SUCCESSOR_AGENT'};
solo.handoffs ??= {};
solo.handoffs.P0_TO_P1={status:'VALIDATED',reference:'handoffs/P0_TO_P1/SUCCESSOR_HANDOFF.json',receipt:'handoffs/P0_TO_P1/SUCCESSOR_HANDOFF_VALIDATION_v1.json'};
solo.globalControls={
  securityTraceabilityGraph:'controller/SECURITY_TRACEABILITY_GRAPH_v1.json',
  carriedForwardObligationLedger:'controller/CARRIED_FORWARD_OBLIGATION_LEDGER_v1.json',
  evidenceInvalidationMatrix:null,
  sourceIntelligenceBundle:'evidence/source-intelligence/SOURCE_INTELLIGENCE_BUNDLE_INDEX_v1.json'
};
solo.bootstrapAutomation={executorType:'GITHUB_ACTIONS',workflow:'lite-phase0-bootstrap-v1.yml',status:'COMPLETE',runId:Number(a['workflow-run-id'])};
write(soloFile,solo);

process.stdout.write(JSON.stringify({status:'PASS',campaignId:state.campaignId,campaignName:state.auditName??state.title??state.campaignId,handoffPath:`${campaignPath}/handoffs/P0_TO_P1/SUCCESSOR_HANDOFF.json`,wakePath:`${campaignPath}/handoffs/P0_TO_P1/WAKE_UP_MESSAGE.md`})+'\n');
