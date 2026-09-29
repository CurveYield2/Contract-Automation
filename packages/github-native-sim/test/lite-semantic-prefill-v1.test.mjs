import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  applyPhaseBoundaryPrefill,
  phase4CoverageFromForm,
  materializeValidatedFindings,
  renderControllerPhaseReport,
  populatePhase9RerunEvidenceRefs
} from '../../../scripts/lib/lite-phase-prefill-v1.mjs';

const mkdir=p=>fs.mkdirSync(p,{recursive:true});
const writeJson=(p,v)=>{mkdir(path.dirname(p));fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n');};
const readJson=p=>JSON.parse(fs.readFileSync(p,'utf8'));

function base(){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'lite-prefill-'));
  const campaign='campaigns/demo';
  const authority='Audit Skill - Current Authority/Audit_Litemode_v10.2';
  writeJson(path.join(root,campaign,'evidence/source-intelligence/SOURCE_INTELLIGENCE_v1.json'),{
    artifactType:'CANONICAL_SOURCE_INTELLIGENCE',
    identity:{sourceIdentity:'src',sourceDigestSha256:'a'.repeat(64)},
    completion:{status:'PASS',noFillSentinelsRemaining:true},
    contracts:[{contractId:'C1',qualifiedName:'Vault'}],
    functions:[
      {functionId:'F1',contractId:'C1',signature:'deposit(uint256)',sourceLocation:'Vault.sol:10'},
      {functionId:'F2',contractId:'C1',signature:'withdraw(uint256)',sourceLocation:'Vault.sol:20'},
      {functionId:'F3',contractId:'C1',signature:'upgradeTo(address)',sourceLocation:'Vault.sol:30'}
    ],
    sourceAnchors:[
      {anchorId:'A1',symbolId:'F1'},{anchorId:'A2',symbolId:'F2'},{anchorId:'A3',symbolId:'F3'}
    ],
    externalInterfaces:[{interfaceId:'E1',sourceFunctionId:'F1',dependencyOrInterface:'IERC20',selectorOrSignature:'transferFrom(address,address,uint256)',interactionKind:'external-call'}],
    privilegeCandidates:[{candidateId:'P1',functionId:'F3',candidateKind:'OWNER_GUARD',authorityExpression:'owner',sourceLocation:'Vault.sol:30'}],
    valueFlowCandidates:[{flowId:'V1',sourceFunctionId:'F1',assetOrValueExpression:'asset',direction:'IN',mechanism:'deposit',counterpartyExpression:'caller',sourceLocation:'Vault.sol:10'}],
    protocolTopology:{upgradeabilityEdges:[{from:'proxy',to:'implementation'}],dependencyEdges:[{from:'Vault',to:'IERC20'}],crossChainEdges:[],offchainAutomationEdges:[]},
    limitations:[]
  });
  writeJson(path.join(root,authority,'shared/controller/DOMAIN_APPLICABILITY_MATRIX.json'),{
    domains:[
      {domainId:'DOMAIN-UPGRADE',methodResources:['upgrade.md'],requiredExecutionPhases:[4]},
      {domainId:'DOMAIN-DEPENDENCY',methodResources:['dependency.md'],requiredExecutionPhases:[4,6]},
      {domainId:'DOMAIN-VAULT',methodResources:['vault.md'],requiredExecutionPhases:[4,6]}
    ]
  });
  writeJson(path.join(root,authority,'phases/phase-6/PHASE_06_SCHEMA_v1.json'),{
    controllerOwnedDefaults:{fullOnlyOmissions:['deep fuzz']}
  });
  return {root,campaign,authority};
}

test('Phase3 boundary writes one controller domain registry and only references it from the form',()=>{
  const b=base();
  const form={schemaVersion:'curveyield-lite-phase-work-form-v1',phase:3,actions:{
    'step-1':{section:'x',outputs:{architectureTrustModel:'<REQUIRED>',attackHypotheses:[{tempKey:'<REQUIRED>'}]}},
    'step-2':{section:'y',outputs:{customValidationObligations:['NONE_IDENTIFIED']}}
  }};
  const out=applyPhaseBoundaryPrefill({root:b.root,campaignPath:b.campaign,authorityRoot:b.authority,sequence:3,form,derivedInputPaths:[],predecessorReceiptPath:'campaigns/demo/receipts/P2.json'});
  assert.equal(typeof out.automationInputs.domainRegistryPath,'string');
  assert.equal(out.automationInputs.domainAssessments,undefined);
  const registry=readJson(path.join(b.root,b.campaign,out.automationInputs.domainRegistryPath));
  assert.equal(registry.owner,'CONTROLLER_AUTOMATION_AT_PHASE_2_BOUNDARY');
  assert.ok(registry.decisions.some(x=>x.domainId==='DOMAIN-UPGRADE'&&x.classification==='TRIGGERED'));
  assert.ok(registry.generatedObligations.some(x=>x.requiredPhase==='4'));
});

test('Phase4 boundary scaffolds source and specialist rows while coverage is controller-computed',()=>{
  const b=base();
  const registryRel='controller/DOMAIN_APPLICABILITY_REGISTRY_v1.json';
  writeJson(path.join(b.root,b.campaign,registryRel),{
    decisions:[{domainId:'DOMAIN-UPGRADE',classification:'TRIGGERED',requiredPhase4Method:'upgrade.md'}]
  });
  const form={schemaVersion:'curveyield-lite-phase-work-form-v1',phase:4,actions:{
    'step-1':{section:'x',outputs:{sourceReviewRecords:[]}},
    'step-2':{section:'y',outputs:{specialistReviewRecords:[]}},
    'step-3':{section:'z',outputs:{typedLimitations:['NONE_IDENTIFIED'],candidateRecords:['NO_CANDIDATE']}}
  }};
  const out=applyPhaseBoundaryPrefill({root:b.root,campaignPath:b.campaign,authorityRoot:b.authority,sequence:4,form,derivedInputPaths:[],predecessorReceiptPath:'campaigns/demo/receipts/P3.json'});
  assert.equal(out.actions['step-1'].outputs.sourceReviewRecords.length,3);
  assert.ok(out.actions['step-2'].outputs.specialistReviewRecords.length>=2);
  const coverage=phase4CoverageFromForm(out);
  assert.deepEqual(coverage.unreviewedRequiredSurfaces,['NONE_IDENTIFIED']);
  out.actions['step-1'].outputs.sourceReviewRecords.pop();
  assert.notDeepEqual(phase4CoverageFromForm(out).unreviewedRequiredSurfaces,['NONE_IDENTIFIED']);
});

test('Phase8 controller materializes promoted findings from one candidate record',()=>{
  const rows=materializeValidatedFindings([
    {candidateKey:'CAND-1',findingPromotion:'PROMOTE_FINDING',findingTitleOrNone:'Share theft',rootCauseOrNone:'Unchecked accounting',impact:'loss',severity:'HIGH',evidenceRefs:['e1']},
    {candidateKey:'CAND-2',findingPromotion:'NO_FINDING',findingTitleOrNone:'NONE_IDENTIFIED',rootCauseOrNone:'NONE_IDENTIFIED',impact:'none',severity:'NONE',evidenceRefs:['e2']}
  ]);
  assert.equal(rows.length,1);
  assert.equal(rows[0].candidateKey,'CAND-1');
  assert.equal(rows[0].title,'Share theft');
  assert.equal(rows[0].controllerMaterialized,true);
});

test('controller report includes controller-owned materializations',()=>{
  const report=renderControllerPhaseReport({
    schema:{phase:10},
    form:{actions:{'step-3':{outputs:{liteVerdict:'PASS_WITH_LIMITATIONS',verdictRationale:'bounded evidence'}}}},
    canonical:{actions:{'step-3':{outputs:{liteVerdict:'PASS_WITH_LIMITATIONS',verdictRationale:'bounded evidence'}}},automationOutputs:{residualLimitations:['L1'],fullUpgradeRecommendations:['R1']}}
  });
  assert.match(report,/CONTROLLER-GENERATED/);
  assert.match(report,/residualLimitations/);
  assert.match(report,/fullUpgradeRecommendations/);
});


test('Phase9 controller harvests rerun evidence refs from trusted ingested execution evidence',()=>{
  const b=base();
  const findingKey='FIND-001';
  const requestId='dar-0123456789abcdef0123456789abcdef';
  const requestDir='controller/phase9-reruns/FIND-001/rerun-1';
  writeJson(path.join(b.root,b.campaign,requestDir,'EXECUTION_REQUEST_v1.json'),{requestId});
  const evidenceDir=path.join(b.root,b.campaign,'controller/automation',requestId);
  writeJson(path.join(evidenceDir,'EXECUTION_EVIDENCE_v1.json'),{schemaVersion:'test-evidence',requestId});
  writeJson(path.join(evidenceDir,'EXECUTION_OBSERVER_RECEIPT_v1.json'),{schemaVersion:'observer',requestId});
  writeJson(path.join(evidenceDir,'ingestion/EXECUTION_EVIDENCE_INGESTION_RECEIPT_v1.json'),{
    schemaVersion:'audit-execution-evidence-ingestion-receipt-v1',
    requestId,
    requestDigest:'a'.repeat(64),
    phaseId:'build-and-test',
    profileId:'test',
    source:{},
    artifactDigest:'b'.repeat(64),
    componentRefs:[],
    securityDisposition:'REVIEWER_REQUIRED',
    findingPromotion:'FORBIDDEN_BY_INGESTOR',
    ingestionDigest:'c'.repeat(64)
  });
  const form={schemaVersion:'curveyield-lite-phase-work-form-v1',phase:9,automationInputs:{},actions:{
    'step-2':{outputs:{remediationDispositions:[{
      findingKey,
      rerunRequestDirectory:'controller/phase9-reruns/FIND-001/',
      rerunEvidenceRefs:['<CONTROLLER_AUTO_COLLECT_AFTER_RERUNS>'],
      rootCauseFixed:'YES',
      regressionAssessment:'NO_REGRESSION',
      disposition:'FIXED',
      rationale:'evidence-backed',
      newCandidateOrNone:'NONE_IDENTIFIED',
      automationOwnedFields:['findingKey','rerunRequestDirectory']
    }]}}
  }};
  const deficiencies=populatePhase9RerunEvidenceRefs({root:b.root,campaignPath:b.campaign,form});
  assert.deepEqual(deficiencies,[]);
  const row=form.actions['step-2'].outputs.remediationDispositions[0];
  assert.ok(row.rerunEvidenceRefs.includes('controller/automation/'+requestId+'/EXECUTION_EVIDENCE_v1.json'));
  assert.ok(row.rerunEvidenceRefs.includes('controller/automation/'+requestId+'/ingestion/EXECUTION_EVIDENCE_INGESTION_RECEIPT_v1.json'));
  assert.ok(row.automationOwnedFields.includes('rerunEvidenceRefs'));
  assert.match(form.automationInputs.controllerPrefillDigestSha256,/^[0-9a-f]{64}$/);
});

test('Phase9 controller fails closed while rerun evidence ingestion is incomplete',()=>{
  const b=base();
  const requestId='dar-fedcba9876543210fedcba9876543210';
  writeJson(path.join(b.root,b.campaign,'controller/phase9-reruns/FIND-002/rerun-1/EXECUTION_REQUEST_v1.json'),{requestId});
  const form={schemaVersion:'curveyield-lite-phase-work-form-v1',phase:9,automationInputs:{},actions:{
    'step-2':{outputs:{remediationDispositions:[{
      findingKey:'FIND-002',
      rerunRequestDirectory:'controller/phase9-reruns/FIND-002/',
      rerunEvidenceRefs:['<CONTROLLER_AUTO_COLLECT_AFTER_RERUNS>'],
      rootCauseFixed:'YES',
      regressionAssessment:'PENDING',
      disposition:'PENDING',
      rationale:'pending evidence',
      newCandidateOrNone:'NONE_IDENTIFIED',
      automationOwnedFields:['findingKey','rerunRequestDirectory']
    }]}}
  }};
  const deficiencies=populatePhase9RerunEvidenceRefs({root:b.root,campaignPath:b.campaign,form});
  assert.ok(deficiencies.some(x=>x.includes('no durable ingested execution evidence yet')));
});
