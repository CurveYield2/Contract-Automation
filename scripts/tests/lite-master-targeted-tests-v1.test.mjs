import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {registerMasterTargetedTests,acceptMasterTargetedTestResults,verifyMasterTargetedTestEvidence,unresolvedFinalCandidateFailures} from '../lib/lite-master-targeted-tests-v1.mjs';

const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const camp='campaigns/Example Audit r1';
const segment='reviewer-4-phases-08-10';
const source='a'.repeat(64);
function setup(t){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'lite-master-targeted-test-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const directory={campaignId:'example-audit-r1',sourceSha256:source,campaignStatus:'WAITING_FOR_MASTER_REVIEW',currentAssignment:null,pendingMasterReview:{segmentId:segment,reviewerId:'reviewer-4',status:'WAITING_FOR_MASTER_REVIEW'}};
  const put=(p,x)=>{const full=path.join(root,p);fs.mkdirSync(path.dirname(full),{recursive:true});fs.writeFileSync(full,typeof x==='string'?x:JSON.stringify(x,null,2)+'\n');return full;};
  const planPath=camp+'/work/master-review/'+segment+'/TARGETED_TEST_REQUEST_v1.json';
  const plan={schemaVersion:'curveyield-lite-master-targeted-tests-v1',campaignId:directory.campaignId,segmentId:segment,sourceSha256:source,assignedReviewer:'reviewer-3L',tests:[{
    candidateId:'P4-CAND-001',
    securityProperty:'Invariant: the beneficiary must retain the entire intended payout allocation.',
    setupAndActors:'Deploy actual vault, router and keeper; configure owners, balances and authorized actors.',
    transactionSequence:'Run healthy route, unauthorized caller, failing dependency and post-state collection.',
    decisiveAssertions:'Assert successful route and separately verify failure path custody and beneficiary balance.',
    expectedPassAndFail:'Disprove only if attacker cannot cause loss under realistic reachability and conditions.',
    economicImpactMethod:'Measure token balance delta and conservatively bound repeated settlement exposure.',
    requiredRawEvidence:'Persist every transaction, revert, assertion count, amount and exact source identity.'
  }]};
  put(planPath,plan);
  return {root,directory,put,planPath,plan};
}

test('a valid master directive holds the campaign and chooses another reviewer',t=>{
  const f=setup(t);
  const row=registerMasterTargetedTests({root:f.root,campaignPath:camp,directory:f.directory,planPath:f.planPath,now:'2026-01-01T00:00:00Z'});
  assert.match(row.requestId,/^[0-9a-f]{64}$/);
  assert.equal(row.assignedReviewer,'reviewer-3L');
  assert.equal(f.directory.campaignStatus,'WAITING_FOR_TARGETED_TESTS');
  assert.equal(f.directory.currentAssignment,null);
  assert.equal(f.directory.pendingMasterReview.status,'WAITING_FOR_TARGETED_TESTS');
  assert.equal(f.directory.pendingMasterReview.targetedTests.length,1);
  assert.throws(()=>registerMasterTargetedTests({root:f.root,campaignPath:camp,directory:f.directory,planPath:f.planPath,now:'2026-01-01T00:00:01Z'}),/pending master-review gate/);
});
test('directive refuses original reviewer and incomplete test design',t=>{
  const f=setup(t);
  f.plan.assignedReviewer='reviewer-4';
  f.put(f.planPath,f.plan);
  assert.throws(()=>registerMasterTargetedTests({root:f.root,campaignPath:camp,directory:f.directory,planPath:f.planPath,now:'x'}),/different registered reviewer/);
  f.plan.assignedReviewer='reviewer-3L';
  f.plan.tests[0].decisiveAssertions='TBD';
  f.put(f.planPath,f.plan);
  assert.throws(()=>registerMasterTargetedTests({root:f.root,campaignPath:camp,directory:f.directory,planPath:f.planPath,now:'x'}),/requires concrete decisiveAssertions/);
});
test('raw result admission preserves the hold, checks digests and permits master return',t=>{
  const f=setup(t);
  const entry=registerMasterTargetedTests({root:f.root,campaignPath:camp,directory:f.directory,planPath:f.planPath,now:'x'});
  const ev=camp+'/evidence/master-targeted-tests/'+entry.requestId+'/raw-result.json';
  const raw='{"txCount":5,"assertions":{"healthy":true,"attack":false}}\n';
  f.put(ev,raw);
  const result={schemaVersion:'curveyield-lite-master-targeted-test-result-v1',campaignId:f.directory.campaignId,segmentId:segment,requestId:entry.requestId,sourceSha256:source,reviewer:'reviewer-3L',tests:[{
    candidateId:'P4-CAND-001',disposition:'DISPROVEN',
    executionNarrative:'Executed five observable contract calls against actual representative dependencies.',
    observedAssertions:'Healthy controls passed, attack condition failed, token accounting conserved.',
    impactAssessment:'Exact measured token deltas were zero across the tested reachable sequence.',
    executedCalls:5,evidence:[{path:ev,sha256:sha(raw)}]
  }]};
  f.put(entry.resultPath,result);
  const accepted=acceptMasterTargetedTestResults({root:f.root,campaignPath:camp,directory:f.directory,resultPath:entry.resultPath,now:'y'});
  assert.equal(accepted.status,'EVIDENCE_SUBMITTED');
  assert.equal(f.directory.campaignStatus,'WAITING_FOR_MASTER_REVIEW');
  assert.deepEqual(verifyMasterTargetedTestEvidence({root:f.root,campaignPath:camp,directory:f.directory}),[]);
  f.put(ev,'{"tampered":true}\n');
  assert.match(verifyMasterTargetedTestEvidence({root:f.root,campaignPath:camp,directory:f.directory}).join('; '),/raw evidence changed/);
});
test('zero observed calls and wrong raw digests cannot certify a conclusive test',t=>{
  const f=setup(t);
  const e=registerMasterTargetedTests({root:f.root,campaignPath:camp,directory:f.directory,planPath:f.planPath,now:'x'});
  const ev=camp+'/evidence/master-targeted-tests/'+e.requestId+'/raw-result.json';f.put(ev,'{}\n');
  const result={schemaVersion:'curveyield-lite-master-targeted-test-result-v1',campaignId:f.directory.campaignId,segmentId:segment,requestId:e.requestId,sourceSha256:source,reviewer:'reviewer-3L',tests:[{
    candidateId:'P4-CAND-001',disposition:'CONFIRMED',executionNarrative:'Observed runner execution with source-matched address and preconditions.',
    observedAssertions:'Reported results include assertion outcomes, observed balances and controls.',
    impactAssessment:'The actual measured economic effect and maximum values are documented.',
    executedCalls:0,evidence:[{path:ev,sha256:sha('{}\n')}]
  }]};
  f.put(e.resultPath,result);
  assert.throws(()=>acceptMasterTargetedTestResults({root:f.root,campaignPath:camp,directory:f.directory,resultPath:e.resultPath,now:'y'}),/observed execution/);
  result.tests[0].executedCalls=1;result.tests[0].evidence[0].sha256='b'.repeat(64);
  f.put(e.resultPath,result);
  assert.throws(()=>acceptMasterTargetedTestResults({root:f.root,campaignPath:camp,directory:f.directory,resultPath:e.resultPath,now:'y'}),/digest mismatch/);
});
test('terminal gate requires conclusive delegated evidence for an originally unresolved candidate',t=>{
  const f=setup(t);
  const can=camp+'/derived/phase-8/PHASE_08_CANONICAL_DATA_v1.json';
  const original={candidateKey:'P4-CAND-001',findingPromotion:'NO_FINDING',finalDisposition:'UNCONFIRMED_NO_FINDING',outcome:'NOT_PROMOTED',propertyViolation:'NOT_ESTABLISHED',impact:'UNQUANTIFIED'};
  const originalPath=camp+'/work/master-review/'+segment+'/sealed-originals/phase-08/PHASE_08_WORK_FORM_v1.json';
  const originalFile=f.put(originalPath,{actions:{'step-2':{outputs:{candidateValidations:[original]}}}});
  f.directory.pendingMasterReview.sealedWorkForms=[{phase:8,sealedOriginalPath:originalPath,sha256:sha(fs.readFileSync(originalFile))}];
  const candidate={...original};
  f.put(can,{actions:{'step-2':{outputs:{candidateValidations:[candidate]}}}});
  assert.match(unresolvedFinalCandidateFailures({root:f.root,campaignPath:camp,directory:f.directory}).join('; '),/P4-CAND-001/);
  candidate.finalDisposition='DISPROVEN_WITH_RAW_EXECUTION';
  candidate.propertyViolation='NO_VIOLATION_UNDER_PROVEN_REACHABLE_CASES';
  candidate.impact='Measured zero under the complete healthy and adversarial lifecycle';
  f.put(can,{actions:{'step-2':{outputs:{candidateValidations:[candidate]}}}});
  assert.match(unresolvedFinalCandidateFailures({root:f.root,campaignPath:camp,directory:f.directory}).join('; '),/requires a raw-evidence-bound delegated DISPROVEN/);
  const entry=registerMasterTargetedTests({root:f.root,campaignPath:camp,directory:f.directory,planPath:f.planPath,now:'x'});
  const ev=camp+'/evidence/master-targeted-tests/'+entry.requestId+'/raw-result.json';const raw='{"executed":5,"complete":true}\\n';f.put(ev,raw);
  const result={schemaVersion:'curveyield-lite-master-targeted-test-result-v1',campaignId:f.directory.campaignId,segmentId:segment,requestId:entry.requestId,sourceSha256:source,reviewer:'reviewer-3L',tests:[{
    candidateId:'P4-CAND-001',disposition:'DISPROVEN',
    executionNarrative:'Measured all five realistic contract calls and both controls with native dependencies.',
    observedAssertions:'Healthy and adversarial trace assertions passed under bounded reachability.',
    impactAssessment:'The token balance and beneficiary effects were measured without loss.',
    executedCalls:5,evidence:[{path:ev,sha256:sha(raw)}]
  }]};
  f.put(entry.resultPath,result);
  acceptMasterTargetedTestResults({root:f.root,campaignPath:camp,directory:f.directory,resultPath:entry.resultPath,now:'y'});
  assert.match(unresolvedFinalCandidateFailures({root:f.root,campaignPath:camp,directory:f.directory}).join('; '),/must cite the exact delegated raw evidence/);
  candidate.evidenceRefs=ev+'#assertions';
  f.put(can,{actions:{'step-2':{outputs:{candidateValidations:[candidate]}}}});
  assert.deepEqual(unresolvedFinalCandidateFailures({root:f.root,campaignPath:camp,directory:f.directory}),[]);
});

test('controller CLI holds master review, admits reviewer results and returns to master',t=>{
  const f=setup(t);
  const dirPath='Audit Campaign Directory/campaigns/example-audit.json';
  const rootAuthority='Audit Skill - Current Authority/Audit_Litemode_v11/SKILL.md';
  const authorityBytes='fixture bound audit authority\\n';
  f.put(rootAuthority,authorityBytes);
  const buildRel='evidence/build/build-identity.json';
  const buildBytes='{"build":"exact test identity"}\\n';
  f.put(camp+'/'+buildRel,buildBytes);
  const bindings={
    source:{path:null,sha256:source},
    build:{path:buildRel,sha256:sha(buildBytes)},
    authority:{homepagePath:rootAuthority,sha256:sha(authorityBytes)},
    segmentManifestSha256:sha(JSON.stringify([]))
  };
  const recordPath=camp+'/work/master-review/'+segment+'/MASTER_REVIEW_RECORD_v1.json';
  f.put(recordPath,{
    schemaVersion:'curveyield-lite-master-review-record-v1',
    campaignId:f.directory.campaignId,campaignGenerationId:'fixture-generation',
    segmentId:segment,reviewerId:'reviewer-4',boundaryPhase:10,segmentPhases:[8,9,10],
    masterIdentity:{chatUrl:'https://chatgpt.com/c/12345678-1234-1234-1234-123456789abc',reasoning:'MAXIMUM'},
    bindings,reviewedArtifacts:[]
  });
  const receiptPath=camp+'/receipts/PHASE_10_RECEIPT_v1.json';
  f.put(receiptPath,{authority:{homepagePath:rootAuthority}});
  Object.assign(f.directory,{
    schemaVersion:'curveyield-audit-campaign-directory-entry-v2',
    campaignGenerationId:'fixture-generation',workspacePath:camp,
    masterReview:{chatUrl:'https://chatgpt.com/c/12345678-1234-1234-1234-123456789abc',
      reasoning:'MAXIMUM',repairModel:'SOL',repairReasoning:'HIGH'},
    lastSealedReceiptPath:receiptPath
  });
  Object.assign(f.directory.pendingMasterReview,{
    boundaryPhase:10,segmentPhases:[8,9,10],recordPath,lastSealedReceiptPath:receiptPath,
    manifestSha256:sha(JSON.stringify([])),bindingsSha256:sha(JSON.stringify(bindings)),
    sealedWorkForms:[],successorPlan:{nextPhaseSequence:null}
  });
  f.put(dirPath,f.directory);
  const controller=path.resolve('scripts/lite-phase-packet-controller-v1.mjs');
  const args=['--controller-root',f.root,'--campaign-id',f.directory.campaignId,'--campaign-path',camp,
    '--campaign-directory-path',dirPath,'--audit-controller-ref','main'];
  const invoke=tail=>JSON.parse(execFileSync(process.execPath,[controller,...args,...tail],{encoding:'utf8'}));
  const request=invoke(['--review-kind','master','--segment-id',segment,'--master-outcome','REQUEST_TARGETED_TESTS','--test-plan-path',f.planPath]);
  assert.equal(request.status,'MASTER_TESTS_REQUESTED',request.feedbackText??JSON.stringify(request));
  assert.equal(request.testReviewer,'reviewer-3L');
  const held=JSON.parse(fs.readFileSync(path.join(f.root,dirPath)));
  assert.equal(held.campaignStatus,'WAITING_FOR_TARGETED_TESTS');
  assert.equal(held.pendingMasterReview.status,'WAITING_FOR_TARGETED_TESTS');
  const entry=held.pendingMasterReview.targetedTests[0];
  const ev=camp+'/evidence/master-targeted-tests/'+entry.requestId+'/raw-result.json';
  const raw='{"observedCalls":5,"assertionsPassed":5}\\n';
  f.put(ev,raw);
  f.put(entry.resultPath,{
    schemaVersion:'curveyield-lite-master-targeted-test-result-v1',
    campaignId:f.directory.campaignId,segmentId:segment,requestId:entry.requestId,
    sourceSha256:source,reviewer:'reviewer-3L',
    tests:[{
      candidateId:'P4-CAND-001',disposition:'DISPROVEN',
      executionNarrative:'Observed full external dependencies and five execution calls on the bound fork.',
      observedAssertions:'The healthy and adversarial tests produced five validated expected assertions.',
      impactAssessment:'Token balance and beneficiary payout deltas were measured and fully reconciled.',
      executedCalls:5,evidence:[{path:ev,sha256:sha(raw)}]
    }]
  });
  const returned=invoke(['--review-kind','master-test-result','--segment-id',segment,'--test-result-path',entry.resultPath]);
  assert.equal(returned.status,'WAITING_FOR_MASTER_REVIEW');
  const after=JSON.parse(fs.readFileSync(path.join(f.root,dirPath)));
  assert.equal(after.campaignStatus,'WAITING_FOR_MASTER_REVIEW');
  assert.equal(after.pendingMasterReview.targetedTests[0].status,'EVIDENCE_SUBMITTED');
  assert.equal(after.currentAssignment,null);
  assert.deepEqual(verifyMasterTargetedTestEvidence({root:f.root,campaignPath:camp,directory:after}),[]);
});
