#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import {renderDeployConfigMatrixV1,renderTargetedTestMatrixV1} from '../packages/github-native-sim/src/lite-boundary-artifacts-v1.mjs';

function args(argv){const o={};for(let i=2;i<argv.length;i+=2){const k=argv[i],v=argv[i+1];if(!k?.startsWith('--')||v===undefined)throw new Error('arguments must be --key value');o[k.slice(2)]=v;}return o;}
async function readJson(f){return JSON.parse(await fs.readFile(f,'utf8'));}
async function writeJson(f,v){await fs.mkdir(path.dirname(f),{recursive:true});await fs.writeFile(f,JSON.stringify(v,null,2)+'\n');}
const a=args(process.argv);
for(const k of ['controller-root','campaign-path','simulation-output'])if(!a[k])throw new Error('missing --'+k);
const root=path.resolve(a['controller-root']),campaignPath=a['campaign-path'],campaignRoot=path.join(root,...campaignPath.split('/')),src=path.resolve(a['simulation-output']);
const summary=await readJson(path.join(src,'PHASE0_RANDOMIZED_SIMULATION_SUMMARY_v1.json'));
const runIndex=await readJson(path.join(src,'PHASE0_SIMULATION_RUN_INDEX_v1.json'));
const deployPath=path.join(src,'PHASE0_DEPLOY_CONFIG_EXECUTION_v1.json');
const deploy=await readJson(deployPath).catch(()=>({schemaVersion:'curveyield-lite-phase0-deploy-config-execution-v2',status:'BLOCKED',gaps:[{type:'NO_DEPLOYMENT_EVIDENCE'}],attempts:[],deployedContracts:[]}));

const phase0Evidence=path.join(campaignRoot,'evidence/phase0');
const simEvidence=path.join(phase0Evidence,'simulations');
await fs.mkdir(simEvidence,{recursive:true});
await fs.copyFile(path.join(src,'PHASE0_RANDOMIZED_SIMULATION_SUMMARY_v1.json'),path.join(phase0Evidence,'PHASE0_RANDOMIZED_SIMULATION_SUMMARY_v1.json'));
await fs.copyFile(path.join(src,'PHASE0_SIMULATION_RUN_INDEX_v1.json'),path.join(simEvidence,'PHASE0_SIMULATION_RUN_INDEX_v1.json'));
await fs.copyFile(deployPath,path.join(phase0Evidence,'PHASE0_DEPLOY_CONFIG_EXECUTION_v1.json')).catch(()=>{});
await fs.rm(path.join(simEvidence,'runs'),{recursive:true,force:true});
await fs.cp(path.join(src,'runs'),path.join(simEvidence,'runs'),{recursive:true}).catch(()=>{});

const summaryRef='evidence/phase0/PHASE0_RANDOMIZED_SIMULATION_SUMMARY_v1.json';
const runIndexRef='evidence/phase0/simulations/PHASE0_SIMULATION_RUN_INDEX_v1.json';
const deployRef='evidence/phase0/PHASE0_DEPLOY_CONFIG_EXECUTION_v1.json';
const observedAccountingShare=Math.round(((summary.telemetry?.[0]?.accountingActionShare??0)*1000))/10;
const baselineRows=[
  {
    targetId:'PHASE0-BASELINE-MEDUSA',candidateKey:'PHASE0-BASELINE-MEDUSA',
    candidateOrProperty:'Broad randomized stateful ABI execution from the deployment-prepared Anvil state',
    setup:'Ethereum Anvil fork after supported source deployment-script simulation and deterministic fallback deployment',
    transactionSequence:'Medusa internal randomized sequence; configured call limit '+String(summary.medusa?.configuredCallLimit??'UNRESOLVED')+'; observed '+String(summary.medusa?.observedCalls??0),
    expectedSecureOutcome:'INVESTIGATIVE_BASELINE_NO_PREDECIDED_SECURITY_CONCLUSION',
    oracle:'Mechanical completion, coverage/revert telemetry, later-reviewer investigation',
    requestBindingStatus:'PHASE0_CONTROLLER_GENERATED',simulationResult:summary.medusa?.status??'UNRESOLVED',
    fuzzVariablesAndBounds:'ABI-valid generated arguments; underlying source-contract calls routed through generated Medusa ABI wrappers; no raw random calldata',
    result:summary.medusa?.status??'UNRESOLVED',
    evidenceRefs:[summary.medusa?.rawOutputRef?('evidence/phase0/simulations/'+summary.medusa.rawOutputRef):summaryRef,summaryRef]
  },
  {
    targetId:'PHASE0-BASELINE-ABI-TELEMETRY',candidateKey:'PHASE0-BASELINE-ABI-TELEMETRY',
    candidateOrProperty:'Telemetry-rich randomized source-contract interaction baseline',
    setup:'Same deployment-prepared Anvil state; independent stateful shards reset to the common baseline',
    transactionSequence:'Randomized cross-contract bursts that repeatedly revisit contracts rather than exhausting one contract at a time',
    expectedSecureOutcome:'INVESTIGATIVE_BASELINE_NO_PREDECIDED_SECURITY_CONCLUSION',
    oracle:'Per-call pre/post accounting state, deltas, receipts/logs, success/revert/error telemetry',
    requestBindingStatus:'PHASE0_CONTROLLER_GENERATED',simulationResult:(summary.telemetry??[]).every(x=>x.status==='PASS')?'PASS':'INCOMPLETE',
    fuzzVariablesAndBounds:'Real ABI functions only; observed accounting/state-changing share '+String(observedAccountingShare)+'%; configured policy 80%',
    result:'INVESTIGATIVE_TELEMETRY_GENERATED',
    evidenceRefs:[runIndexRef,...(summary.telemetry??[]).map(x=>'evidence/phase0/simulations/'+x.rawTranscriptRef)]
  }
];

const phase5={schemaVersion:'curveyield-lite-phase0-phase5-simulation-baseline-input-v1',data:{automationInputs:{phase0BaselineSimulation:{
  purpose:'USE_PHASE0_RANDOMIZED_EVIDENCE_TO_DESIGN_HIGHER_VALUE_PHASE5_TARGETED_TESTS',summaryRef,runIndexRef,deployEvidenceRef:deployRef,
  medusa:{status:summary.medusa?.status??'UNRESOLVED',configuredCallLimit:summary.medusa?.configuredCallLimit??null,observedCalls:summary.medusa?.observedCalls??0,minimumRequiredCalls:summary.medusa?.minimumRequiredCalls??100001},
  telemetry:(summary.telemetry??[]).map(x=>({runId:x.runId,calls:x.calls,accountingActionShare:x.accountingActionShare,accountingFunctionCount:x.accountingFunctionCount,otherFunctionCount:x.otherFunctionCount,weightingLimitation:x.weightingLimitation,successes:x.successes,reverts:x.reverts,errors:x.errors,rawTranscriptRef:'evidence/phase0/simulations/'+x.rawTranscriptRef,burstSchedule:x.burstSchedule})),
  limitations:summary.limitations??[],
  reviewerUse:'Investigate patterns/anomalies and use them to design Phase-5 candidate-specific simulations. Raw transcripts are investigative telemetry, not a manual reverification obligation.'
}}}};
const phase6Rows=(summary.baselineTargetDispositions??[]).map(r=>({...r,
  executionEvidenceRefs:(r.executionEvidenceRefs??[]).map(ref=>ref==='NO_MEDUSA_OUTPUT'||ref==='NO_CONFIG'?ref:(ref.startsWith('evidence/')?ref:'evidence/phase0/simulations/'+ref)),
  requestBindingEvidenceRef:(()=>{const ref=r.requestBindingEvidenceRef??'NO_BINDING_EVIDENCE';return ref==='NO_CONFIG'||ref==='NO_BINDING_EVIDENCE'||ref.startsWith('evidence/')?ref:'evidence/phase0/simulations/'+ref;})(),
  semanticHarnessBindingAssessment:'<REQUIRED>',
  securityInterpretation:'<REQUIRED>',
  limitations:'<REQUIRED>',
  recommendedPhase8Disposition:'<REQUIRED>',
  automationOwnedFields:['candidateKey','executionEvidenceRefs','oracleOutcome','reproductionStatus','requestBindingStatus','requestBindingEvidenceRef']
}));
const phase6={schemaVersion:'curveyield-lite-phase0-phase6-simulation-baseline-input-v1',data:{automationInputs:{phase0BaselineTargetDispositions:phase6Rows,phase0SimulationLimitations:summary.limitations??[],phase0SimulationRunIndexRef:runIndexRef}},baselineMatrixRows:baselineRows};
await writeJson(path.join(campaignRoot,'derived/phase-0/PHASE5_SIMULATION_BASELINE_INPUT_v1.json'),phase5);
await writeJson(path.join(campaignRoot,'derived/phase-0/PHASE6_SIMULATION_BASELINE_INPUT_v1.json'),phase6);

const readiness=await readJson(path.join(campaignRoot,'evidence/readiness/PROJECT_READINESS_AUTOMATED_v1.json'));
await fs.mkdir(path.join(campaignRoot,'work/phase-06'),{recursive:true});
await fs.writeFile(path.join(campaignRoot,'work/phase-06/LITE_DEPLOY_CONFIG_MATRIX.md'),renderDeployConfigMatrixV1({readiness,execution:deploy}));
await fs.writeFile(path.join(campaignRoot,'work/phase-06/LITE_TARGETED_TEST_MATRIX.md'),renderTargetedTestMatrixV1({baselineRows}));

process.stdout.write(JSON.stringify({status:'PASS',summaryRef,runIndexRef,phase5Input:'derived/phase-0/PHASE5_SIMULATION_BASELINE_INPUT_v1.json',phase6Input:'derived/phase-0/PHASE6_SIMULATION_BASELINE_INPUT_v1.json',baselineRows:baselineRows.length},null,2)+'\n');
