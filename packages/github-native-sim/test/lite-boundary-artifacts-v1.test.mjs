import test from 'node:test';
import assert from 'node:assert/strict';
import {
  renderDeployConfigMatrixV1,
  renderTargetedTestMatrixV1,
  renderRemediationDeltaLedgerV1,
  renderFinalEvidenceIndexV1,
  executePhase5TargetsV1
} from '../src/lite-boundary-artifacts-v1.mjs';

test('deploy/config matrix preserves task format without repeated campaign bookkeeping',()=>{
  const text=renderDeployConfigMatrixV1({
    readiness:{deploymentAndConfiguration:{deploymentFiles:['scripts/deploy-local.mjs']}},
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
