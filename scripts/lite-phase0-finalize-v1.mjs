#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import {preparePhaseWork} from './lib/lite-phase-work-v1.mjs';
import {CAPABILITY_CONTRACT_VERSION_V2,validateTelemetryCountersV2} from '../packages/github-native-sim/src/phase0-execution-contract-v2.mjs';

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
  executionBuildArtifacts:required(path.join(campaignRoot,'evidence/build/PHASE0_EXECUTION_BUILD_ARTIFACTS_v2.json'),'Phase-0 reusable execution build artifacts v2'),
  sbom:required(path.join(campaignRoot,'evidence/dependencies/SBOM_v1.json'),'SBOM'),
  slither:required(path.join(campaignRoot,'evidence/static-analysis/SLITHER_v1.json'),'Slither evidence'),
  sourceIntelligence:required(path.join(campaignRoot,'evidence/source-intelligence/SOURCE_INTELLIGENCE_v1.json'),'Source Intelligence'),
  runtimeOverlay:required(path.join(campaignRoot,'evidence/source-intelligence/runtime-deployment-overlay_v1.json'),'runtime overlay'),
  readinessOverlay:required(path.join(campaignRoot,'evidence/source-intelligence/assurance-readiness-overlay_v1.json'),'readiness overlay'),
  bundle:required(path.join(campaignRoot,'evidence/source-intelligence/SOURCE_INTELLIGENCE_BUNDLE_INDEX_v1.json'),'Source Intelligence bundle'),
  readiness:required(path.join(campaignRoot,'evidence/readiness/PROJECT_READINESS_AUTOMATED_v1.json'),'project readiness'),
  deployConfigExecution:required(path.join(campaignRoot,'evidence/phase0/PHASE0_DEPLOY_CONFIG_EXECUTION_v1.json'),'Phase-0 deploy/config execution evidence'),
  randomizedSimulation:required(path.join(campaignRoot,'evidence/phase0/PHASE0_RANDOMIZED_SIMULATION_SUMMARY_v1.json'),'Phase-0 randomized simulation summary'),
  simulationRunIndex:required(path.join(campaignRoot,'evidence/phase0/simulations/PHASE0_SIMULATION_RUN_INDEX_v1.json'),'Phase-0 simulation run index'),
  phase5SimulationInput:required(path.join(campaignRoot,'derived/phase-0/PHASE5_SIMULATION_BASELINE_INPUT_v1.json'),'Phase-5 simulation baseline input'),
  phase6SimulationInput:required(path.join(campaignRoot,'derived/phase-0/PHASE6_SIMULATION_BASELINE_INPUT_v1.json'),'Phase-6 simulation baseline input'),
  deployConfigMatrix:required(path.join(campaignRoot,'work/phase-06/LITE_DEPLOY_CONFIG_MATRIX.md'),'Phase-6 deploy/config matrix'),
  targetedTestMatrix:required(path.join(campaignRoot,'work/phase-06/LITE_TARGETED_TEST_MATRIX.md'),'Phase-6 targeted-test matrix'),
  auditSurface:required(path.join(campaignRoot,'evidence/phase0/PHASE0_AUDIT_SURFACE_v1.json'),'Phase-0 audit surface'),
  graph:required(path.join(campaignRoot,'controller/SECURITY_TRACEABILITY_GRAPH_v1.json'),'traceability graph'),
  ledger:required(path.join(campaignRoot,'controller/CARRIED_FORWARD_OBLIGATION_LEDGER_v1.json'),'obligation ledger'),
  invalidation:required(path.join(campaignRoot,'controller/EVIDENCE_INVALIDATION_MATRIX_v1.json'),'evidence invalidation matrix')
};
const sourceSha=receipt.source?.sha256;
if(typeof sourceSha!=='string'||!/^[0-9a-f]{64}$/.test(sourceSha)) throw new Error('canonical source SHA-256 missing');
const build=read(evidence.build);
if(build.source?.archiveSha256Observed!==sourceSha && build.source?.archiveSha256!==sourceSha) throw new Error('build/source evidence does not bind canonical source SHA');
const bundle=read(evidence.bundle);
if(bundle.identity?.sourceDigestSha256!==sourceSha) throw new Error('Source Intelligence bundle does not bind canonical source SHA');

const simulation=read(evidence.randomizedSimulation);
const runIndex=read(evidence.simulationRunIndex);
const deployExecution=read(evidence.deployConfigExecution);
const executionBuildArtifacts=read(evidence.executionBuildArtifacts);
const medusa=simulation.medusa??{};
if(executionBuildArtifacts.schemaVersion!=='curveyield-phase0-execution-build-artifacts-v2'||executionBuildArtifacts.source?.archiveSha256!==sourceSha||executionBuildArtifacts.reuseContract?.secondBuildRequired!==false)throw new Error('Phase-0 reusable execution build artifact contract is missing or not bound to the canonical source');
if(simulation.capabilityContractVersion!==CAPABILITY_CONTRACT_VERSION_V2)throw new Error('Phase-0 execution evidence does not implement curveyield-phase0-execution-capability-v2');
if(simulation.legacyDisposition==='LEGACY_LIMITED'||simulation.status==='LEGACY_LIMITED')throw new Error('LEGACY_LIMITED Phase-0 evidence is retained for history but cannot satisfy v2 finalization');
if(Number(deployExecution.coverage?.sourcePlanUnresolved??0)!==0||Number(deployExecution.coverage?.sourceKnownMissingTargets??0)!==0||(medusa.status!=='BLOCKED_NO_EXECUTABLE_TARGETS'&&deployExecution.status!=='PASS'))throw new Error('Phase-0 deployment is incomplete');
if(runIndex.sourceIdentity?.sourceSha256!==sourceSha||runIndex.sourceIdentity?.campaignId!==receipt.campaign.campaignId)throw new Error('Phase-0 simulation source mismatch');
if(runIndex.executionNormalization?.policy!=='ALL_EVM_PACKAGES_USE_CANONICAL_ETHEREUM_ANVIL_BASELINE')throw new Error('Phase-0 simulation must normalize EVM packages onto the canonical Ethereum Anvil baseline');
if(runIndex.policy?.realAbiCallsOnly!==true||runIndex.policy?.rawRandomBytes!==false)throw new Error('Phase-0 randomized simulation policy must require real ABI calls and forbid raw random calldata');
if(Number(runIndex.policy?.accountingActionWeight??0)<0.8)throw new Error('Phase-0 randomized simulation accounting/state-change action weight must be at least 80%');
if(runIndex.policy?.crossContractBursts!==true)throw new Error('Phase-0 ABI telemetry must use randomized cross-contract bursts');

if(medusa.status!=='BLOCKED_NO_EXECUTABLE_TARGETS'){
  if(Number(medusa.observedCalls??0)<100001)throw new Error('Phase-0 Medusa simulation did not exceed 100,000 randomized ABI calls');
  if(medusa.executionStatus!=='COMPLETED')throw new Error('Phase-0 Medusa did not record executable engine activity');
  if(medusa.mode==='CHECKED_DISCOVERY'){
    if(!['CHECKED','CHECK_DEVIATIONS_OBSERVED'].includes(medusa.checkStatus))throw new Error('CHECKED_DISCOVERY Medusa evidence did not execute every applicable target-behavior property with non-vacuous witnesses');
    const properties=medusa.propertyRegistry??[];
    if(!properties.length)throw new Error('CHECKED_DISCOVERY Medusa evidence has no property registry');
    for(const property of properties){
      if(property.category!=='TARGET_BEHAVIOR'||property.discoveredByEngine!==true)throw new Error('Medusa target-behavior property was not discovered by the engine');
      if(!Array.isArray(property.preconditionWitnessRefs)||property.preconditionWitnessRefs.length===0)throw new Error('Medusa target-behavior property lacks a relevant successful transition witness');
      if(!Array.isArray(property.executionEvidenceRefs)||property.executionEvidenceRefs.length===0)throw new Error('Medusa target-behavior property lacks engine execution evidence');
      if(!['CHECKED_NO_DEVIATION_OBSERVED','DEVIATION_OBSERVED'].includes(property.result))throw new Error('Medusa target-behavior property did not produce a checked result');
    }
  }else if(medusa.mode==='DISCOVERY_WITH_ORACLE_GAPS'){
    if(medusa.checkStatus!=='ORACLE_GAP')throw new Error('Medusa discovery-only evidence must state an explicit ORACLE_GAP');
    if(!(medusa.limitations??[]).some(x=>x?.type==='ORACLE_GAP'||x?.reason==='NO_EXPLICIT_PACKET_DECLARED_PROPERTY_FUNCTIONS_WERE_QUALIFIED'))throw new Error('Medusa discovery-only evidence lacks its explicit semantic/oracle gap');
  }else throw new Error('Phase-0 Medusa mode is unsupported: '+String(medusa.mode??'MISSING'));
}

const telemetry=simulation.telemetry??[];
if(medusa.status!=='BLOCKED_NO_EXECUTABLE_TARGETS'&&telemetry.length!==4)throw new Error('Phase-0 requires four complete telemetry shards');
for(const t of telemetry){
  if(t.status!=='PASS'||Number(t.calls)!==1200||Number(t.plannedActions)!==1200||Number(t.terminalActions)!==1200)throw new Error('Phase-0 telemetry shard is incomplete: '+String(t.runId));
  if(t.executionStatus!=='COMPLETED'||!['COMPLETE','PARTIAL'].includes(t.observationStatus))throw new Error('Phase-0 telemetry shard lacks execution/observation evidence: '+String(t.runId));
  if(Number(t.accountingFunctionCount??0)>0&&Number(t.accountingActionShare??0)<0.79)throw new Error('Phase-0 ABI telemetry materially missed the 80% qualified-economic action target in '+String(t.runId));
  if(Number(t.accountingFunctionCount??0)===0&&t.weightingLimitation!=='NO_QUALIFIED_ECONOMIC_STATE_CHANGE_FUNCTIONS')throw new Error('Phase-0 telemetry without qualified economic functions must carry the typed weighting limitation');
  if(Number(t.simulationInfrastructureError??0)!==0||Number(t.submissionInfrastructureError??0)!==0||Number(t.submittedOutcomeUnknown??0)!==0)throw new Error('Phase-0 telemetry contains unresolved infrastructure/submission outcomes in '+String(t.runId));
  if(Number(t.accountingFunctionCount??0)>0&&Number(t.positiveEconomicTransitions??0)===0)throw new Error('Phase-0 telemetry failed to demonstrate a successful relevant economic transition in '+String(t.runId));
  if(t.reconciliation?.status!=='PASS')throw new Error('Phase-0 telemetry summary reconciliation is not PASS in '+String(t.runId));
}
for(const run of runIndex.runs??[]){
  if(run.type!=='ABI_ACCOUNTING_TELEMETRY')continue;
  const ref=run.rawTranscriptRef;
  if(typeof ref!=='string'||!ref.startsWith('runs/'))throw new Error('Phase-0 ABI telemetry run is missing raw transcript reference: '+String(run.runId));
  const transcriptPath=required(path.join(campaignRoot,'evidence/phase0/simulations',...ref.split('/')),'raw Phase-0 simulation transcript '+String(run.runId));
  const rows=fs.readFileSync(transcriptPath,'utf8').trim().split(/\r?\n/).filter(Boolean).map(line=>JSON.parse(line));
  const shard=telemetry.find(x=>x.runId===run.runId);
  if(!shard)throw new Error('raw telemetry transcript has no matching summary shard: '+String(run.runId));
  if(rows.length!==Number(shard.calls))throw new Error('raw telemetry transcript count mismatch: '+String(run.runId));
  validateTelemetryCountersV2(shard,rows);
  for(const row of rows){
    if(row.capabilityContractVersion!==CAPABILITY_CONTRACT_VERSION_V2||!row.stages?.ARG_GEN||!row.executionOutcome)throw new Error('raw telemetry row does not satisfy v2 lifecycle schema: '+String(run.runId));
    if(!row.stages.OBSERVATION&&row.executionOutcome!=='NOT_EXECUTED_ENCODING_OR_PLANNING')throw new Error('executed telemetry row lacks observation stage: '+String(run.runId));
  }
}
const phase5Input=read(evidence.phase5SimulationInput);
const phase6Input=read(evidence.phase6SimulationInput);
if(!phase5Input?.data?.automationInputs?.phase0BaselineSimulation) throw new Error('Phase-5 simulation baseline input is malformed');
if(!Array.isArray(phase6Input?.data?.automationInputs?.phase0BaselineTargetDispositions)) throw new Error('Phase-6 simulation baseline target dispositions are malformed');

const now=new Date().toISOString();
const refs=Object.entries(evidence).map(([role,file])=>({role,path:rel(campaignRoot,file),sha256:digestFile(file)}));
receipt.evidence=refs.reduce((rows,row)=>upsert(rows,row),receipt.evidence??[]);
receipt.outputs=upsert(receipt.outputs??[],{role:'PHASE0_AUDIT_SURFACE',path:'evidence/phase0/PHASE0_AUDIT_SURFACE_v1.json',sha256:digestFile(evidence.auditSurface)});
receipt.outputs=upsert(receipt.outputs,{role:'PRECOMPUTED_DEPLOY_CONFIG_EVIDENCE',path:'work/phase-06/LITE_DEPLOY_CONFIG_MATRIX.md',sha256:digestFile(evidence.deployConfigMatrix)});
receipt.outputs=upsert(receipt.outputs,{role:'PHASE0_RANDOMIZED_SIMULATION',path:'evidence/phase0/PHASE0_RANDOMIZED_SIMULATION_SUMMARY_v1.json',sha256:digestFile(evidence.randomizedSimulation)});
receipt.outputs=upsert(receipt.outputs,{role:'PHASE0_SIMULATION_RUN_INDEX',path:'evidence/phase0/simulations/PHASE0_SIMULATION_RUN_INDEX_v1.json',sha256:digestFile(evidence.simulationRunIndex)});
receipt.outputs=upsert(receipt.outputs,{role:'PHASE5_SIMULATION_BASELINE_INPUT',path:'derived/phase-0/PHASE5_SIMULATION_BASELINE_INPUT_v1.json',sha256:digestFile(evidence.phase5SimulationInput)});
receipt.outputs=upsert(receipt.outputs,{role:'PHASE6_SIMULATION_BASELINE_INPUT',path:'derived/phase-0/PHASE6_SIMULATION_BASELINE_INPUT_v1.json',sha256:digestFile(evidence.phase6SimulationInput)});
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
