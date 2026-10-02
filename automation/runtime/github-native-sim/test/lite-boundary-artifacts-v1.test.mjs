import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  renderDeployConfigMatrixV1,
  renderTargetedTestMatrixV1,
  renderRemediationDeltaLedgerV1,
  renderFinalEvidenceIndexV1,
  executePhase5TargetsV1,
  validateTargetExecutionRequestBindingV1
} from '../src/lite-boundary-artifacts-v1.mjs';

test('deploy/config matrix preserves task format without repeated campaign bookkeeping',()=>{
  const text=renderDeployConfigMatrixV1({
    readiness:{deploymentAndConfiguration:{deploymentFiles:['automation/scripts/deploy-local.mjs']}},
    execution:{attempts:[{script:'deploy:local',exitCode:0,status:'PASS',resultSummary:'configured',evidenceRef:'evidence/phase0/run.json#attempts/0'}],gaps:[]}
  });
  assert.match(text,/\| Order \| Component\/action/);
  assert.match(text,/deploy:local/);
  assert.doesNotMatch(text,/Campaign\/generation:/);
  assert.doesNotMatch(text,/handoff/i);
  assert.doesNotMatch(text,/Security Traceability Graph/);
});

test('target matrix is filled from accepted design plus machine result',()=>{
  const text=renderTargetedTestMatrixV1({
    targetDesigns:[{candidateKey:'CAND-001',setup:'attacker',prerequisites:'funded',transactionSequence:'deposit -> withdraw',oracle:'balance invariant',fuzzVariablesAndBounds:'amount 0..max',expectedSecurityProperty:'no value extraction'}],
    executionResults:{'CAND-001':{status:'PASS',evidenceRef:'evidence/phase5-boundary/CAND-001/raw-result.json',rawResult:{simulation:{steps:[{},{}]}}}}
  });
  assert.match(text,/CAND-001/);
  assert.match(text,/AI-guided attacker\/exploit sequence/);
  assert.match(text,/AI-guided targeted fuzz variables\/bounds/);
  assert.match(text,/2 simulation step\(s\)/);
  assert.match(text,/evidence\/phase5-boundary\/CAND-001\/raw-result\.json/);
  assert.doesNotMatch(text,/Phase-8 obligation/);
  assert.doesNotMatch(text,/Campaign\/generation:/);
});

test('phase5 executor treats explicit not-applicable target mechanically without executing',async()=>{
  const out=await executePhase5TargetsV1({controllerRoot:process.cwd(),campaignPath:'campaigns/example',targetDesigns:[{candidateKey:'CAND-NA',executionMethod:'NOT_APPLICABLE'}]});
  assert.equal(out['CAND-NA'].status,'NOT_APPLICABLE');
});

test('remediation ledger has task data but no global bookkeeping section',()=>{
  const text=renderRemediationDeltaLedgerV1({
    validatedFindings:[{findingTempKey:'FIND-001'}],
    deltaRows:[{findingId:'FIND-001',oldIdentityRef:'old',remediationIdentityRef:'new',changedFilesAndSymbols:'Vault.sol:withdraw',staleEvidenceInvalidated:'e1',affectedSurfaces:'Vault.withdraw',newEvidenceRefs:'patch.diff'}]
  });
  assert.match(text,/Vault\.sol:withdraw/);
  assert.doesNotMatch(text,/Campaign-global synchronization/);
  assert.doesNotMatch(text,/Carried-forward obligations/);
});

test('final evidence index intentionally retains summary identity',()=>{
  const text=renderFinalEvidenceIndexV1({
    identity:{campaignGeneration:'demo-r1/demo-r1-g1',skill:'skill@sha',source:'src@sha',build:'build@sha',deployment:'matrix',remediation:'SKIPPED_NO_REMEDIATION'},
    milestones:[{milestone:'Phase 0–1',requiredEvidence:'admission',reference:'receipt',sourceIdentity:'src',status:'COMPLETE',limitation:'NONE'}],
    findings:[{id:'FIND-001',disposition:'VALIDATED_FINDING',severityOrStatus:'MEDIUM',evidence:'proof',remediationStatus:'OPEN',residualLimitation:'NONE'}],
    limitations:['Phase 4 step-3.typedLimitations: unresolved callback behavior'],
    omissions:['stateful fuzzing']
  });
  assert.match(text,/Campaign\/generation: demo-r1\/demo-r1-g1/);
  assert.match(text,/FIND-001/);
  assert.match(text,/Carried limitations and unresolved questions/);
  assert.match(text,/unresolved callback behavior/);
  assert.match(text,/stateful fuzzing/);
});


test('final evidence index accepts candidate disposition rows alongside findings',()=>{
  const text=renderFinalEvidenceIndexV1({
    identity:{campaignGeneration:'demo-r1/demo-r1-g1',skill:'skill',source:'source',build:'build',deployment:'matrix'},
    findings:[
      {id:'CAND-001',disposition:'REJECTED',severityOrStatus:'NOT_APPLICABLE',evidence:'phase8-evidence',remediationStatus:'NOT_APPLICABLE',residualLimitation:'none'},
      {id:'FIND-001',disposition:'VALIDATED_FINDING',severityOrStatus:'MEDIUM',evidence:'proof',remediationStatus:'FIXED',residualLimitation:'none'}
    ]
  });
  assert.match(text,/CAND-001/);
  assert.match(text,/REJECTED/);
  assert.match(text,/FIND-001/);
});


test('Phase5 target request binding accepts exact campaign source candidate reproduction and observation identity',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'lite-target-binding-'));
  const campaign='campaigns/demo';
  const rel='work/phase-05/execution-requests/CAND-001.json';
  const abs=path.join(root,campaign,...rel.split('/'));
  fs.mkdirSync(path.dirname(abs),{recursive:true});
  const source='a'.repeat(64);
  fs.writeFileSync(abs,JSON.stringify({
    campaignId:'demo-r1',
    phaseId:'build-and-test',
    source:{archiveSha256:source},
    configuration:{v26:{reproduction:{
      candidateId:'CAND-001',
      reproductionType:'FOUNDRY_TEST',
      expectedObservation:{componentStatus:'FAILED'}
    }}}
  }));
  const target={
    candidateKey:'CAND-001',
    executionMethod:'V7_REQUEST',
    executionRequestRef:rel,
    reproductionType:'FOUNDRY_TEST',
    expectedMachineObservation:{componentStatus:'FAILED'}
  };
  const result=validateTargetExecutionRequestBindingV1({
    controllerRoot:root,campaignPath:campaign,target,
    expectedCampaignId:'demo-r1',expectedSourceSha256:source
  });
  assert.equal(result.status,'PASS_STRUCTURAL_BINDING_REQUIRES_PHASE6_SEMANTIC_HARNESS_REVIEW');
  assert.equal(result.requestRef,rel);
});

test('Phase5 target request binding fails closed on candidate or observation drift',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'lite-target-binding-drift-'));
  const campaign='campaigns/demo';
  const rel='work/phase-05/execution-requests/CAND-001.json';
  const abs=path.join(root,campaign,...rel.split('/'));
  fs.mkdirSync(path.dirname(abs),{recursive:true});
  const source='b'.repeat(64);
  fs.writeFileSync(abs,JSON.stringify({
    campaignId:'demo-r1',
    phaseId:'build-and-test',
    source:{archiveSha256:source},
    configuration:{v26:{reproduction:{
      candidateId:'CAND-OTHER',
      reproductionType:'FOUNDRY_TEST',
      expectedObservation:{componentStatus:'COMPLETED'}
    }}}
  }));
  const target={
    candidateKey:'CAND-001',
    executionMethod:'V7_REQUEST',
    executionRequestRef:rel,
    reproductionType:'FOUNDRY_TEST',
    expectedMachineObservation:{componentStatus:'FAILED'}
  };
  const result=validateTargetExecutionRequestBindingV1({
    controllerRoot:root,campaignPath:campaign,target,
    expectedCampaignId:'demo-r1',expectedSourceSha256:source
  });
  assert.equal(result.status,'FAIL_STRUCTURAL_REQUEST_TARGET_BINDING');
  assert.ok(result.reasons.includes('reproduction candidateId mismatch'));
  assert.ok(result.reasons.includes('expected machine observation mismatch'));
});

test('target matrix exposes structural request binding separately from semantic execution interpretation',()=>{
  const text=renderTargetedTestMatrixV1({
    targetDesigns:[{
      candidateKey:'CAND-001',setup:'attacker',prerequisites:'funded',
      transactionSequence:'deposit -> withdraw',oracle:'balance invariant',
      fuzzVariablesAndBounds:'amount 0..max',expectedSecurityProperty:'no extraction',
      requestBindingStatus:'PASS_STRUCTURAL_BINDING_REQUIRES_PHASE6_SEMANTIC_HARNESS_REVIEW'
    }],
    executionResults:{'CAND-001':{
      status:'PASS',
      requestBindingStatus:'PASS_STRUCTURAL_BINDING_REQUIRES_PHASE6_SEMANTIC_HARNESS_REVIEW',
      evidenceRef:'evidence/phase5-boundary/CAND-001/raw-result.json',
      rawResult:{analysis:{nativeFuzz:{componentStatus:'COMPLETED'}}}
    }}
  });
  assert.match(text,/Request\/target structural binding/);
  assert.match(text,/PASS_STRUCTURAL_BINDING_REQUIRES_PHASE6_SEMANTIC_HARNESS_REVIEW/);
});
