#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import {preparePhaseWork} from './lib/lite-phase-work-v1.mjs';

function args(argv){const out={};for(let i=2;i<argv.length;i+=2){const k=argv[i],v=argv[i+1];if(!k?.startsWith('--')||v===undefined)throw new Error('arguments must be --key value');out[k.slice(2)]=v;}return out;}
function sha(bytes){return createHash('sha256').update(bytes).digest('hex');}
function read(file){return JSON.parse(fs.readFileSync(file,'utf8'));}
function write(file,value){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n');}
function digestFile(file){return sha(fs.readFileSync(file));}
function required(file,label){if(!fs.existsSync(file)||!fs.statSync(file).isFile())throw new Error('missing '+label+': '+file);return file;}
function rel(root,file){return path.relative(root,file).replaceAll('\\','/');}
function upsert(rows,row,key='path'){const out=Array.isArray(rows)?structuredClone(rows):[];const i=out.findIndex(x=>x?.[key]===row?.[key]);if(i>=0)out[i]=row;else out.push(row);return out;}

const a=args(process.argv);
for(const k of ['controller-root','campaign-path','qualification-path','contract-automation-sha','workflow-run-id']) if(!a[k]) throw new Error('missing --'+k);
const controllerRoot=path.resolve(a['controller-root']);
const campaignPath=a['campaign-path'];
if(!campaignPath.startsWith('campaigns/')||campaignPath.includes('..')) throw new Error('unsafe campaign path');
const campaignRoot=path.join(controllerRoot,...campaignPath.split('/'));
const receiptPath=path.join(campaignRoot,'receipts/PHASE_00_RECEIPT_v1.json');
const receipt=read(required(receiptPath,'Phase-0 receipt'));
if(receipt.schemaVersion!=='curveyield-lite-phase-receipt-v1'||receipt.campaign?.mode!=='LITE'||receipt.phase?.sequence!==0) throw new Error('invalid Phase-0 receipt');
if(!['ACTIVE','EVIDENCE_READY','VALIDATING'].includes(receipt.phase.status)) throw new Error('Phase-0 receipt is not finalizable');
const qualification=read(path.resolve(a['qualification-path']));
if(qualification.status!=='PASS') throw new Error('V7 qualification is not PASS');
if(qualification.qualifiedCommit!==a['contract-automation-sha']) throw new Error('V7 qualification does not bind current Contract-Automation commit');

const evidence={
  build:required(path.join(campaignRoot,'evidence/build/BUILD_AND_SOURCE_IDENTITY_v1.json'),'build identity'),
  executionBuildArtifacts:required(path.join(campaignRoot,'evidence/build/PHASE0_EXECUTION_BUILD_ARTIFACTS_v2.json'),'reusable build artifacts'),
  sbom:required(path.join(campaignRoot,'evidence/dependencies/SBOM_v1.json'),'SBOM'),
  slither:required(path.join(campaignRoot,'evidence/static-analysis/SLITHER_v1.json'),'Slither evidence'),
  sourceIntelligence:required(path.join(campaignRoot,'evidence/source-intelligence/SOURCE_INTELLIGENCE_v1.json'),'Source Intelligence'),
  runtimeOverlay:required(path.join(campaignRoot,'evidence/source-intelligence/runtime-deployment-overlay_v1.json'),'runtime overlay'),
  readinessOverlay:required(path.join(campaignRoot,'evidence/source-intelligence/assurance-readiness-overlay_v1.json'),'readiness overlay'),
  bundle:required(path.join(campaignRoot,'evidence/source-intelligence/SOURCE_INTELLIGENCE_BUNDLE_INDEX_v1.json'),'Source Intelligence bundle'),
  readiness:required(path.join(campaignRoot,'evidence/readiness/PROJECT_READINESS_AUTOMATED_v1.json'),'project readiness'),
  deployConfigExecution:required(path.join(campaignRoot,'evidence/phase0/PHASE0_DEPLOY_CONFIG_EXECUTION_v1.json'),'forked package deploy/config evidence'),
  deployConfigMatrix:required(path.join(campaignRoot,'work/phase-06/LITE_DEPLOY_CONFIG_MATRIX.md'),'Phase-6 deploy/config matrix'),
  targetedTestMatrix:required(path.join(campaignRoot,'work/phase-06/LITE_TARGETED_TEST_MATRIX.md'),'Phase-6 targeted-test matrix'),
  auditSurface:required(path.join(campaignRoot,'evidence/phase0/PHASE0_AUDIT_SURFACE_v1.json'),'Phase-0 audit surface'),
  graph:required(path.join(campaignRoot,'controller/SECURITY_TRACEABILITY_GRAPH_v1.json'),'traceability graph'),
  ledger:required(path.join(campaignRoot,'controller/CARRIED_FORWARD_OBLIGATION_LEDGER_v1.json'),'obligation ledger'),
  invalidation:required(path.join(campaignRoot,'controller/EVIDENCE_INVALIDATION_MATRIX_v1.json'),'evidence invalidation matrix')
};
const sourceSha=receipt.source?.sha256;
if(typeof sourceSha!=='string'||!/^[0-9a-f]{64}$/.test(sourceSha))throw new Error('canonical source digest missing');
const build=read(evidence.build);
if(build.source?.archiveSha256Observed!==sourceSha&&build.source?.archiveSha256!==sourceSha)throw new Error('build identity differs from canonical archive');
const bundle=read(evidence.bundle);
if(bundle.identity?.sourceDigestSha256!==sourceSha)throw new Error('Source Intelligence source digest mismatch');
const artifacts=read(evidence.executionBuildArtifacts);
if(artifacts.schemaVersion!=='curveyield-phase0-execution-build-artifacts-v2'||artifacts.source?.archiveSha256!==sourceSha||artifacts.reuseContract?.secondBuildRequired!==false)throw new Error('reusable build artifact contract is missing');
const deploy=read(evidence.deployConfigExecution);
if(deploy.schemaVersion!=='curveyield-lite-phase0-deploy-config-execution-v3'||deploy.executionMode!=='ANVIL_FORK_PACKAGE_DEPLOY_CONFIG_ONLY')throw new Error('Phase-0 requires only source package forked deployment evidence');
if(deploy.campaignId!==receipt.campaign.campaignId||deploy.sourceSha256!==sourceSha||deploy.fork?.engine!=='anvil'||deploy.fork?.chainId!==1)throw new Error('Phase-0 fork deployment identity mismatch');
if(deploy.status==='PASS'){
  if(!(deploy.attempts?.length>0)||deploy.attempts.some(x=>x.status!=='PASS'||x.exitCode!==0)||deploy.scriptDispositions?.some(x=>x.disposition!=='EXECUTED_PASS'))throw new Error('Phase-0 native deployment scripts are incomplete');
}else if(deploy.status==='NOT_APPLICABLE_NO_DEPLOYMENT_SCRIPT'){
  if((deploy.attempts?.length??0)!==0||(deploy.scriptDispositions?.length??0)!==0)throw new Error('Non-applicable deploy status has executed scripts');
}else throw new Error('Phase-0 deploy/config failed: '+String(deploy.status));

const now=new Date().toISOString();
const refs=Object.entries(evidence).map(([role,file])=>({role,path:rel(campaignRoot,file),sha256:digestFile(file)}));
const retired=/PHASE0_RANDOMIZED_SIMULATION|PHASE0_SIMULATION_RUN_INDEX|PHASE5_SIMULATION_BASELINE_INPUT|PHASE6_SIMULATION_BASELINE_INPUT|PHASE0_TELEMETRY_ANALYSIS|MEDUSA/;
receipt.evidence=refs.reduce((rows,row)=>upsert(rows,row),(receipt.evidence??[]).filter(row=>!retired.test(String(row.role??'')+' '+String(row.path??''))));
receipt.outputs=(receipt.outputs??[]).filter(row=>!retired.test(String(row.role??'')+' '+String(row.path??'')));
receipt.outputs=upsert(receipt.outputs??[],{role:'PHASE0_AUDIT_SURFACE',path:'evidence/phase0/PHASE0_AUDIT_SURFACE_v1.json',sha256:digestFile(evidence.auditSurface)});
receipt.outputs=upsert(receipt.outputs,{role:'PRECOMPUTED_DEPLOY_CONFIG_EVIDENCE',path:'work/phase-06/LITE_DEPLOY_CONFIG_MATRIX.md',sha256:digestFile(evidence.deployConfigMatrix)});
receipt.outputs=upsert(receipt.outputs,{role:'PHASE0_FORK_DEPLOY_CONFIG',path:'evidence/phase0/PHASE0_DEPLOY_CONFIG_EXECUTION_v1.json',sha256:digestFile(evidence.deployConfigExecution)});
receipt.outputs=upsert(receipt.outputs,{role:'PRECOMPUTED_TARGETED_TEST_EVIDENCE',path:'work/phase-06/LITE_TARGETED_TEST_MATRIX.md',sha256:digestFile(evidence.targetedTestMatrix)});
receipt.globalControls={
  securityTraceabilityGraph:'controller/SECURITY_TRACEABILITY_GRAPH_v1.json',
  carriedForwardObligationLedger:'controller/CARRIED_FORWARD_OBLIGATION_LEDGER_v1.json',
  evidenceInvalidationMatrix:'controller/EVIDENCE_INVALIDATION_MATRIX_v1.json',
  sourceIntelligenceBundle:'evidence/source-intelligence/SOURCE_INTELLIGENCE_BUNDLE_INDEX_v1.json'
};
const ledger=read(evidence.ledger);
receipt.obligations.due=(ledger.obligations??[]).filter(x=>String(x.status??'OPEN').toUpperCase()==='OPEN'&&String(x.requiredPhase??'')==='1');
receipt.automation=upsert(receipt.automation??[],{workflow:'v7-execution-infrastructure-qualification.yml',runId:Number(qualification.workflowRunId),status:'PASS',qualifiedCommit:qualification.qualifiedCommit},'workflow');
receipt.automation=upsert(receipt.automation,{workflow:'lite-phase0-bootstrap-v1.yml',runId:Number(a['workflow-run-id']),status:'PASS',contractAutomationCommit:a['contract-automation-sha'],bootstrapCommit:a['bootstrap-sha']??a['contract-automation-sha']},'workflow');
receipt.validation={status:'PASS',validatedAt:now,failures:[]};
receipt.phase.status='SEALED';
receipt.sealedAt=now;
receipt.updatedAt=now;
receipt.handoff={required:true,boundary:'P0_TO_P1',incomingReviewer:'reviewer-1',assignedWork:'Phase 1',nextPhaseSequence:1,sameReviewer:false,status:'SUCCESSOR_PENDING'};
write(receiptPath,receipt);

const directoryPath=path.join(controllerRoot,...String(receipt.campaign.campaignDirectoryEntryPath).split('/'));
const directory=read(required(directoryPath,'Audit Campaign Directory entry'));
if(directory.campaignId!==receipt.campaign.campaignId) throw new Error('campaign directory identity mismatch');
const sealedPhase0Receipt=rel(controllerRoot,receiptPath);
const authorityRoot=path.posix.dirname(receipt.authority.homepagePath);
const assignment=preparePhaseWork({
  root:controllerRoot,
  campaignPath,
  authorityRoot,
  sequence:1,
  reviewer:'reviewer-1',
  predecessorReceiptPath:sealedPhase0Receipt,
  derivedInputPaths:[
    path.posix.join(campaignPath,'evidence/phase0/PHASE0_AUDIT_SURFACE_v1.json'),
    path.posix.join(campaignPath,'evidence/source-intelligence/SOURCE_INTELLIGENCE_BUNDLE_INDEX_v1.json')
  ],
  status:'WAITING_FOR_SUCCESSOR_AGENT'
});
const directoryV2={
  schemaVersion:'curveyield-audit-campaign-directory-entry-v2',
  campaignId:receipt.campaign.campaignId,
  campaignGenerationId:receipt.campaign.campaignGenerationId,
  campaignName:receipt.campaign.campaignName,
  workspacePath:campaignPath,
  mode:'LITE',
  sourceSha256:sourceSha,
  masterReview:directory.masterReview,
  lastSealedReceiptPath:sealedPhase0Receipt,
  campaignStatus:'WAITING_FOR_SUCCESSOR_AGENT',
  currentAssignment:assignment,
  updatedAt:now
};
write(directoryPath,directoryV2);

process.stdout.write(JSON.stringify({
  status:'PASS',
  campaignId:receipt.campaign.campaignId,
  campaignName:receipt.campaign.campaignName,
  receiptPath:sealedPhase0Receipt,
  campaignDirectoryEntryPath:receipt.campaign.campaignDirectoryEntryPath,
  successorReviewer:'reviewer-1',
  successorPhase:1
})+'\n');
