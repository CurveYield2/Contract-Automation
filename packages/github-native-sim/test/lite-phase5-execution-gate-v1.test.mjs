import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  validatePhase5TargetCoverageV1,
  validatePhase5TargetExecutionGateV1,
  validateRecordedPhase5MachineEvidenceV1
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
  assert.match(validatePhase5TargetCoverageV1({targetDesigns:[{...target,executionMethod:'NOT_APPLICABLE'}],materialCandidateKeys:[key]}).join(' '),/cannot be NOT_APPLICABLE/);
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
  assert.match(validatePhase5TargetExecutionGateV1(fakeSuccess).join(' '),/executed reproduction oracle/);
  const notExecuted=structuredClone(args);
  notExecuted.executionResults[key].rawResult.analysis.nativeFuzz.componentStatus='NOT_APPLICABLE';
  assert.match(validatePhase5TargetExecutionGateV1(notExecuted).join(' '),/never completed/);
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
