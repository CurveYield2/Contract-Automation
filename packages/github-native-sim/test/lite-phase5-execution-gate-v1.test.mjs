import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  validatePhase5TargetCoverageV1,
  validatePhase5TargetExecutionGateV1,
  validateRecordedPhase5MachineEvidenceV1,
  selectReusablePhase5TargetsV1,
  verifiedReusablePhase5ResultV1,
  executePhase5TargetsV1
} from '../src/lite-boundary-artifacts-v1.mjs';

const key='P4-CAND-001';
const sourceSha='a'.repeat(64);
const requestId='dar-'+'b'.repeat(32);
const campaignPath='campaigns/test-audit-r1';
const requestRef='work/phase-05/execution-requests/'+key+'.json';
const target={candidateKey:key,executionMethod:'V7_REQUEST',reproductionType:'FOUNDRY_TEST',executionRequestRef:requestRef,expectedMachineObservation:{componentStatus:'COMPLETED'}};
const evidenceRef=path.posix.join(campaignPath,'evidence/phase5-boundary',key,requestId,'raw-result.json');

function fixture(){
  const controllerRoot=fs.mkdtempSync(path.join(os.tmpdir(),'lite-p5-gate-'));
  const file=path.join(controllerRoot,...evidenceRef.split('/'));
  fs.mkdirSync(path.dirname(file),{recursive:true});
  const request={requestId,requestDigest:'d'.repeat(64),campaignId:'test-audit-r1',phaseId:'build-and-test',
    source:{archiveSha256:sourceSha,commit:'c'.repeat(40)},
    configuration:{v26:{reproduction:{candidateId:key,reproductionType:'FOUNDRY_TEST',expectedObservation:{componentStatus:'COMPLETED'}}}}};
  const requestFile=path.join(controllerRoot,...campaignPath.split('/'),...requestRef.split('/'));
  fs.mkdirSync(path.dirname(requestFile),{recursive:true});
  fs.writeFileSync(requestFile,JSON.stringify(request)+'\n');
  // Persist the exact machine record, not a status-only placeholder.
  const rawResult={
    requestId,requestDigest:'d'.repeat(64),status:'completed',blocking:false,preflight:{status:'PASS'},
    source:{archiveSha256:sourceSha,commit:'c'.repeat(40)},build:{status:'completed'},
    reproduction:{candidateId:key,status:'REPRODUCED',
      observedPredicate:{matched:true,observed:{componentStatus:'COMPLETED'}}},
    analysis:{nativeFuzz:{componentStatus:'COMPLETED',toolInvoked:true}}
  };
  fs.writeFileSync(file,JSON.stringify(rawResult)+'\n');
  const executionResults={[key]:{
    status:'PASS',exitCode:0,requestBindingStatus:'PASS_STRUCTURAL_BINDING_REQUIRES_PHASE6_SEMANTIC_HARNESS_REVIEW',
    evidenceRef,rawResult
  }};
  const args={controllerRoot,campaignPath,targetDesigns:[target],
    materialCandidateKeys:[key],executionResults,expectedSourceSha256:sourceSha};
  return {args,controllerRoot,file};
}
test('mandatory material candidates cannot be omitted, duplicated or marked NOT_APPLICABLE',()=>{
  assert.match(validatePhase5TargetCoverageV1({targetDesigns:['NONE_IDENTIFIED'],materialCandidateKeys:[key]}).join(' '),/material candidates/);
  assert.match(validatePhase5TargetCoverageV1({targetDesigns:[],materialCandidateKeys:[key]}).join(' '),/mandatory material candidate/);
  assert.match(validatePhase5TargetCoverageV1({targetDesigns:[{...target,executionMethod:'NOT_APPLICABLE'}],materialCandidateKeys:[key]}).join(' '),/NOT_APPLICABLE method requires reproductionType NOT_APPLICABLE/);
  assert.match(validatePhase5TargetCoverageV1({targetDesigns:[target,target],materialCandidateKeys:[key]}).join(' '),/duplicate/);
  assert.deepEqual(validatePhase5TargetCoverageV1({targetDesigns:[target],materialCandidateKeys:[key]}),[]);
  assert.deepEqual(validatePhase5TargetCoverageV1({targetDesigns:['NONE_IDENTIFIED'],materialCandidateKeys:[]}),[]);
});
test('successful source-bound machine execution with persisted raw evidence passes the gate',t=>{
  const {args,controllerRoot}=fixture();t.after(()=>fs.rmSync(controllerRoot,{recursive:true,force:true}));
  assert.deepEqual(validatePhase5TargetExecutionGateV1(args),[]);
});
test('missing, blocked or inconclusive machine runs fail even if the request is structurally bound',t=>{
  const {args,controllerRoot}=fixture();t.after(()=>fs.rmSync(controllerRoot,{recursive:true,force:true}));
  for(const status of ['INCONCLUSIVE','BLOCKED','MISSING']){
    const amended=structuredClone(args);
    amended.executionResults[key].status=status;
    assert.ok(validatePhase5TargetExecutionGateV1(amended).length>0,status);
  }
  const noRaw=structuredClone(args);noRaw.executionResults[key].rawResult=null;
  assert.match(validatePhase5TargetExecutionGateV1(noRaw).join(' '),/missing parsed raw/);
});
test('an orphan raw path, preflight failure, source mismatch, or missing reproduction cannot seal',t=>{
  const {args,controllerRoot,file}=fixture();t.after(()=>fs.rmSync(controllerRoot,{recursive:true,force:true}));
  fs.unlinkSync(file);
  assert.match(validatePhase5TargetExecutionGateV1(args).join(' '),/missing exact persisted/);
  fs.writeFileSync(file,JSON.stringify(args.executionResults[key].rawResult)+'\n');
  const noRpc=structuredClone(args);
  noRpc.executionResults[key].rawResult.preflight={status:'BLOCKED',failureKind:'MUTABLE_RPC_SOURCE_MISSING'};
  assert.match(validatePhase5TargetExecutionGateV1(noRpc).join(' '),/preflight/);
  const differentSource=structuredClone(args);
  differentSource.executionResults[key].rawResult.source.archiveSha256='c'.repeat(64);
  assert.match(validatePhase5TargetExecutionGateV1(differentSource).join(' '),/source identity/);
  const fakeSuccess=structuredClone(args);
  fakeSuccess.executionResults[key].rawResult.reproduction=null;
  assert.match(validatePhase5TargetExecutionGateV1(fakeSuccess).join(' '),/completed, observed reproduction or non-reproduction/);
  const notExecuted=structuredClone(args);
  notExecuted.executionResults[key].rawResult.analysis.nativeFuzz.componentStatus='NOT_APPLICABLE';
  assert.match(validatePhase5TargetExecutionGateV1(notExecuted).join(' '),/never completed/);
});
const aliasKey='P4-CAND-002';
const sharedPlan={
  setup:'Identical immutable source-bound call fixture',
  prerequisites:'Identical prerequisite state and roles',
  transactionSequence:'Identical state transition sequence',
  oracle:'Identical observation and negative assertions',
  fuzzVariablesAndBounds:'Identical fuzz bounds and parameters',
  snapshotReuseSafety:'Identical snapshot replay limitations',
  expectedSecurityProperty:'Identical security claim under identical source'
};
function coveredDesign(){
  const covering={...target,...sharedPlan};
  const duplicate={...covering,candidateKey:aliasKey,
    executionMethod:'NOT_APPLICABLE',reproductionType:'NOT_APPLICABLE',
    expectedMachineObservation:'NOT_APPLICABLE',
    notApplicableDisposition:{
      reasonCode:'COVERED_BY_EXECUTED_TARGET',
      coveredByCandidateKey:key,
      technicalReason:'Exact duplicate source anchor and every candidate test field is identical.'
    }
  };
  const sourceAnchors={[key]:'ANCHOR-1234',[aliasKey]:'ANCHOR-1234'};
  return {covering,duplicate,sourceAnchors};
}
test('verified duplicate method waiver inherits a real completed covering execution',t=>{
  const {args,controllerRoot}=fixture();t.after(()=>fs.rmSync(controllerRoot,{recursive:true,force:true}));
  const {covering,duplicate,sourceAnchors}=coveredDesign();
  args.targetDesigns=[duplicate,covering];
  args.materialCandidateKeys=[key,aliasKey];
  args.candidateSourceAnchors=sourceAnchors;
  assert.deepEqual(validatePhase5TargetCoverageV1(args),[]);
  assert.deepEqual(validatePhase5TargetExecutionGateV1(args),[]);
});
test('duplicate waiver fails closed on source mismatch, different security claim or blocked covering execution',t=>{
  const {args,controllerRoot}=fixture();t.after(()=>fs.rmSync(controllerRoot,{recursive:true,force:true}));
  const {covering,duplicate,sourceAnchors}=coveredDesign();
  args.targetDesigns=[duplicate,covering];args.materialCandidateKeys=[key,aliasKey];
  args.candidateSourceAnchors=sourceAnchors;
  const anchorWrong=structuredClone(args);
  anchorWrong.candidateSourceAnchors[aliasKey]='ANCHOR-9999';
  assert.match(validatePhase5TargetCoverageV1(anchorWrong).join(' '),/source anchor/);
  const claimWrong=structuredClone(args);
  claimWrong.targetDesigns[0].expectedSecurityProperty='Different security threat';
  assert.match(validatePhase5TargetCoverageV1(claimWrong).join(' '),/exactly equivalent expectedSecurityProperty/);
  const blocked=structuredClone(args);
  blocked.executionResults[key].status='INCONCLUSIVE';
  assert.match(validatePhase5TargetExecutionGateV1(blocked).join(' '),/covering evidence/);
  const unsupported=structuredClone(args);
  unsupported.targetDesigns[0].notApplicableDisposition.reasonCode='STATIC_SOURCE_PROOF';
  assert.match(validatePhase5TargetCoverageV1(unsupported).join(' '),/no supported, verifiable/);
});
test('completed negative outcome is evidence, not an automatic execution failure',t=>{
  const {args,controllerRoot,file}=fixture();t.after(()=>fs.rmSync(controllerRoot,{recursive:true,force:true}));
  const result=args.executionResults[key].rawResult;
  result.reproduction.status='NOT_REPRODUCED';
  result.reproduction.observedPredicate.matched=false;
  fs.writeFileSync(file,JSON.stringify(result)+'\n');
  assert.deepEqual(validatePhase5TargetExecutionGateV1(args),[]);
  result.reproduction.status='INCONCLUSIVE';
  fs.writeFileSync(file,JSON.stringify(result)+'\n');
  assert.match(validatePhase5TargetExecutionGateV1(args).join(' '),/completed, observed reproduction or non-reproduction/);
  result.reproduction.status='NOT_REPRODUCED';
  result.analysis.nativeFuzz.componentStatus='COMPLETED_WITH_FAILURES';
  fs.writeFileSync(file,JSON.stringify(result)+'\n');
  assert.match(validatePhase5TargetExecutionGateV1(args).join(' '),/never completed/);
});
test('controller executes and validates Phase-5 results before PASS and audit bookkeeping',()=>{
  const file=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../../scripts/lite-phase-packet-controller-v1.mjs');
  const script=fs.readFileSync(file,'utf8');
  const execute=script.indexOf("phase5MachineResults=await executePhase5TargetsV1");
  const verify=script.indexOf("validatePhase5TargetExecutionGateV1({",execute);
  const pass=script.indexOf("packet.controllerValidation={status:'PASS'");
  const bookkeeping=script.indexOf("const controls=syncControls({",pass);
  const receipt=script.indexOf("writeJson(repoFile(root,receiptRel),receipt)",bookkeeping);
  assert.ok(execute>0&&verify>execute&&pass>verify&&bookkeeping>pass&&receipt>bookkeeping);
  assert.equal(script.split('executePhase5TargetsV1({').length-1,1,
    'required execution must be performed once, prior to phase seal');
});

test('Phase-6/master gate refuses a previously sealed Phase-5 claim without its exact machine result',t=>{
  const {args,controllerRoot}=fixture();t.after(()=>fs.rmSync(controllerRoot,{recursive:true,force:true}));
  const phase4=path.join(controllerRoot,...campaignPath.split('/'),'derived/phase-4/PHASE_04_CANONICAL_DATA_v1.json');
  const phase5=path.join(controllerRoot,...campaignPath.split('/'),'derived/phase-5/PHASE_05_CANONICAL_DATA_v1.json');
  fs.mkdirSync(path.dirname(phase4),{recursive:true});
  fs.mkdirSync(path.dirname(phase5),{recursive:true});
  fs.writeFileSync(phase4,JSON.stringify({actions:{'step-3':{outputs:{candidateRecords:[{tempKey:key}]}}}}));
  fs.writeFileSync(phase5,JSON.stringify({actions:{'step-2':{outputs:{newCandidateRecords:['NONE_IDENTIFIED']}}}}));
  const failures=validateRecordedPhase5MachineEvidenceV1({...args,expectedCampaignId:'test-audit-r1',requireCompletedMatrix:true});
  assert.match(failures.join('; '),/matrix|Sealed/);
  fs.unlinkSync(path.join(controllerRoot,...evidenceRef.split('/')));
  assert.match(validateRecordedPhase5MachineEvidenceV1({...args,expectedCampaignId:'test-audit-r1'}).join('; '),/missing|required/);
});

test('unchanged source-anchored target reuses evidence even if machine-owned prefills were refreshed',()=>{
  const prior={...target,setup:'same setup',oracle:'same expected outcome',
    requestBindingStatus:'PASS_OLD',automationResolvedExecutionRequest:false};
  const current={...prior,requestBindingStatus:'PASS_NEW',
    automationResolvedExecutionRequest:true};
  const before=[{tempKey:key,sourceAnchor:'file.sol#L18',risk:'HIGH'}];
  const after=[{tempKey:key,sourceAnchor:'file.sol#L18',risk:'MEDIUM'}];
  assert.deepEqual(selectReusablePhase5TargetsV1({
    priorTargetDesigns:[prior],targetDesigns:[current],
    priorCandidateRecords:before,candidateRecords:after
  }),[key]);
  assert.deepEqual(selectReusablePhase5TargetsV1({
    priorTargetDesigns:[prior],targetDesigns:[{...current,oracle:'changed oracle'}],
    priorCandidateRecords:before,candidateRecords:after
  }),[]);
  assert.deepEqual(selectReusablePhase5TargetsV1({
    priorTargetDesigns:[prior],targetDesigns:[current],
    priorCandidateRecords:before,candidateRecords:[{tempKey:key,sourceAnchor:'other.sol#L18'}]
  }),[]);
  assert.deepEqual(selectReusablePhase5TargetsV1({
    priorTargetDesigns:[prior],targetDesigns:[current],
    priorCandidateRecords:[],candidateRecords:after
  }),[]);
});

test('an unchanged, verified prior target does not spawn the simulation runner',async t=>{
  const {args,controllerRoot}=fixture();t.after(()=>fs.rmSync(controllerRoot,{recursive:true,force:true}));
  assert.ok(verifiedReusablePhase5ResultV1({
    controllerRoot,campaignPath,target,expectedCampaignId:'test-audit-r1',expectedSourceSha256:sourceSha
  }));
  let spawned=0;
  const results=await executePhase5TargetsV1({
    ...args,expectedCampaignId:'test-audit-r1',reuseCandidateKeys:[key],
    runProcessFn:async()=>{spawned++;return {exitCode:1,stdout:'unexpected execution',stderr:''};}
  });
  assert.equal(spawned,0);
  assert.equal(results[key].reusedRecordedEvidence,true);
  assert.deepEqual(validatePhase5TargetExecutionGateV1({...args,executionResults:results}),[]);
});

test('missing, tampered or source-mismatched result is never reused',async t=>{
  const {args,controllerRoot,file}=fixture();t.after(()=>fs.rmSync(controllerRoot,{recursive:true,force:true}));
  let spawned=0;
  const stub=async()=>{spawned++;return {exitCode:1,stdout:'blocked before completion',stderr:''};};
  const request={...args,expectedCampaignId:'test-audit-r1',
    reuseCandidateKeys:[key],runProcessFn:stub};
  fs.unlinkSync(file);
  let results=await executePhase5TargetsV1(request);
  assert.equal(spawned,1,'missing evidence must execute');
  assert.notEqual(results[key].status,'PASS');
  fs.writeFileSync(file,JSON.stringify({
    ...args.executionResults[key].rawResult,requestDigest:'f'.repeat(64)
  })+'\n');
  results=await executePhase5TargetsV1(request);
  assert.equal(spawned,2,'tampered request digest must not be reused');
  fs.writeFileSync(file,JSON.stringify({
    ...args.executionResults[key].rawResult,source:{archiveSha256:'0'.repeat(64),commit:'c'.repeat(40)}
  })+'\n');
  results=await executePhase5TargetsV1(request);
  assert.equal(spawned,3,'wrong source identity must not be reused');
  assert.ok(validatePhase5TargetExecutionGateV1({...args,executionResults:results}).length>0,
    'blocked tests must never produce a controller PASS');
});

test('only eligible candidates are reused in a mixed set of targets',async t=>{
  const {args,controllerRoot}=fixture();t.after(()=>fs.rmSync(controllerRoot,{recursive:true,force:true}));
  let invoked=0;
  const newTarget={...target,candidateKey:'P4-CAND-002',
    executionRequestRef:'work/phase-05/execution-requests/P4-CAND-002.json'};
  const results=await executePhase5TargetsV1({
    ...args,targetDesigns:[target,newTarget],
    reuseCandidateKeys:[key],
    expectedCampaignId:'test-audit-r1',
    runProcessFn:async()=>{invoked++;return {exitCode:1,stdout:'',stderr:'blocked'};}
  });
  assert.equal(invoked,0,'an unbound new target must be blocked without spawning Anvil');
  assert.equal(results[key].reusedRecordedEvidence,true);
  assert.equal(results['P4-CAND-002'].status,'BLOCKED_REQUEST_TARGET_BINDING_MISMATCH');
});
