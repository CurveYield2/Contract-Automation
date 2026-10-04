import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {refreshControllerPrefillDigest} from '../../../scripts/lib/lite-phase-prefill-v1.mjs';
import {requiredFile,repoFile} from '../../../scripts/lib/lite-phase-work-v1.mjs';
import {MASTER_REVIEW_SEGMENTS_V1} from '../../../scripts/lib/lite-master-review-v1.mjs';

const mkdir=p=>fs.mkdirSync(p,{recursive:true});
const writeJson=(p,v)=>{mkdir(path.dirname(p));fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n');};
const write=(p,v)=>{mkdir(path.dirname(p));fs.writeFileSync(p,v);};
const readJson=p=>JSON.parse(fs.readFileSync(p,'utf8'));

test('master review topology gates each whole normal-reviewer segment exactly once',()=>{
  assert.deepEqual(MASTER_REVIEW_SEGMENTS_V1.map(x=>({id:x.segmentId,reviewer:x.reviewerId,phases:[...x.phases],boundary:x.boundaryPhase})),[
    {id:'reviewer-1-phase-01',reviewer:'reviewer-1',phases:[1],boundary:1},
    {id:'reviewer-2-phases-02-05',reviewer:'reviewer-2',phases:[2,3,4,5],boundary:5},
    {id:'reviewer-3l-phases-06-07',reviewer:'reviewer-3L',phases:[6,7],boundary:7},
    {id:'reviewer-4-phases-08-10',reviewer:'reviewer-4',phases:[8,9,10],boundary:10}
  ]);
});

function fixture(){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'lite-packet-controller-'));
  const campaign='campaigns/demo';
  const dirRel='Audit Campaign Directory/campaigns/demo.json';
  const authority='Audit Skill - Current Authority/Audit_Litemode_v10.2';
  const source='a'.repeat(64);

  const receiptStub=`export function phaseReceiptPath(workspacePath,sequence,revision=1){return workspacePath+'/receipts/PHASE_'+String(sequence).padStart(2,'0')+'_RECEIPT_v'+revision+'.json';}
export function createLitePhaseReceiptV1(input){return {schemaVersion:'curveyield-lite-phase-receipt-v1',campaign:{campaignId:input.campaignId,campaignGenerationId:input.campaignGenerationId,campaignName:input.campaignName,workspacePath:input.workspacePath,campaignDirectoryEntryPath:input.campaignDirectoryEntryPath,mode:'LITE'},phase:{sequence:input.sequence,id:'phase-'+input.sequence,revision:1,status:input.status},executor:{type:input.executorType,lineage:input.executorLineage},authority:input.authority,source:{sha256:input.sourceSha256,...input.source},startedAt:input.now,updatedAt:input.now,sealedAt:null,inputs:input.inputs??[],evidence:input.evidence??[],outputs:input.outputs??[],globalControls:input.globalControls??{},obligations:{due:[],created:[],closed:[],carriedForward:[],...(input.obligations??{})},invalidation:{status:'NO_MATERIAL_CHANGE',events:[]},automation:[],validation:input.validation??{status:'PENDING',failures:[]},handoff:input.handoff??{required:false,boundary:null,incomingReviewer:null,assignedWork:null,nextPhaseSequence:null,sameReviewer:false,status:'NOT_APPLICABLE'},errors:[]};}
`;
  write(path.join(root,'packages/controller-core/src/lite-phase-receipt-v1.mjs'),receiptStub);

  const phase1Schema={
    schemaVersion:'curveyield-lite-phase-work-schema-v1',phase:1,title:'P1',executor:'reviewer-1',automationOnly:false,
    workForm:{campaignPath:'work/phase-01/PHASE_01_WORK_FORM_v1.json',template:'phases/phase-1/resources/PHASE_01_WORK_FORM_TEMPLATE_v1.json'},
    finalReport:{campaignPath:'work/phase-01/PHASE_01_FINAL_REPORT_v1.md',template:'phases/phase-1/resources/PHASE_01_FINAL_REPORT_TEMPLATE_v1.md',requiredSections:['Executive Conclusion','Material Results','Limitations','Unresolved Substantive Questions']},
    actions:{'step-1':{title:'Analyze',formPath:'work/phase-01/PHASE_01_WORK_FORM_v1.json',section:'Step 1 Input — Analyze',fields:[{name:'analysis',type:'REQUIRED_ANALYSIS',consumers:['phase-2']}]}},
    derivedOutputs:[],bookkeepingMappings:{graphRecordPaths:['actions.step-1.outputs.analysis'],obligationRecordPaths:[],invalidationRecordPaths:[]},
    submission:{packetPath:'submissions/PHASE_01_WORK_PACKET_v1.json',requiredPacketStatus:'SUBMITTED',controllerPassToken:'CONTROLLER_PHASE_PASS',bookkeepingBeforeValidationPass:false}
  };
  const phase2Schema={
    schemaVersion:'curveyield-lite-phase-work-schema-v1',phase:2,title:'P2',executor:'reviewer-2',automationOnly:false,
    workForm:{campaignPath:'work/phase-02/PHASE_02_WORK_FORM_v1.json',template:'phases/phase-2/resources/PHASE_02_WORK_FORM_TEMPLATE_v1.json'},
    finalReport:{campaignPath:'work/phase-02/PHASE_02_FINAL_REPORT_v1.md',template:'phases/phase-2/resources/PHASE_02_FINAL_REPORT_TEMPLATE_v1.md',requiredSections:['Executive Conclusion','Material Results','Limitations','Unresolved Substantive Questions']},
    actions:{'step-1':{title:'Analyze next',formPath:'work/phase-02/PHASE_02_WORK_FORM_v1.json',section:'Step 1 Input — Analyze next',fields:[{name:'nextAnalysis',type:'REQUIRED_ANALYSIS',consumers:['phase-3']}]}},
    derivedOutputs:[],bookkeepingMappings:{graphRecordPaths:[],obligationRecordPaths:[],invalidationRecordPaths:[]},
    submission:{packetPath:'submissions/PHASE_02_WORK_PACKET_v1.json',requiredPacketStatus:'SUBMITTED',controllerPassToken:'CONTROLLER_PHASE_PASS',bookkeepingBeforeValidationPass:false}
  };
  writeJson(path.join(root,authority,'phases/phase-1/PHASE_01_SCHEMA_v1.json'),phase1Schema);
  writeJson(path.join(root,authority,'phases/phase-2/PHASE_02_SCHEMA_v1.json'),phase2Schema);
  writeJson(path.join(root,authority,'phases/phase-2/resources/PHASE_02_WORK_FORM_TEMPLATE_v1.json'),{schemaVersion:'curveyield-lite-phase-work-form-v1',phase:2,actions:{'step-1':{section:'Step 1 Input — Analyze next',outputs:{nextAnalysis:'<REQUIRED>'}}}});
  write(path.join(root,authority,'phases/phase-2/resources/PHASE_02_FINAL_REPORT_TEMPLATE_v1.md'),'# Phase 2 Final Report\n\n## Executive Conclusion\n<REQUIRED>\n\n## Material Results\n<REQUIRED>\n\n## Limitations\n<REQUIRED>\n\n## Unresolved Substantive Questions\n<REQUIRED>\n');
  write(path.join(root,authority,'SKILL.md'),'# authority\n');

  const predecessorRel=campaign+'/receipts/PHASE_00_RECEIPT_v1.json';
  writeJson(path.join(root,predecessorRel),{
    authority:{homepagePath:authority+'/SKILL.md',repository:'CurveYield2/Audit-Controller'},
    source:{sha256:source},
    globalControls:{sourceIntelligenceBundle:'evidence/source-intelligence/SOURCE_INTELLIGENCE_BUNDLE_INDEX_v1.json'},
    phase:{sequence:0,status:'SEALED'}
  });
  writeJson(path.join(root,campaign,'evidence/source-intelligence/SOURCE_INTELLIGENCE_BUNDLE_INDEX_v1.json'),{schemaVersion:'fixture-source-intelligence-bundle-v1',sourceSha256:source});
  writeJson(path.join(root,campaign,'controller/SECURITY_TRACEABILITY_GRAPH_v1.json'),{nodes:[],edges:[]});
  writeJson(path.join(root,campaign,'controller/CARRIED_FORWARD_OBLIGATION_LEDGER_v1.json'),{obligations:[]});
  writeJson(path.join(root,campaign,'controller/EVIDENCE_INVALIDATION_MATRIX_v1.json'),{events:[]});

  const formRel=campaign+'/work/phase-01/PHASE_01_WORK_FORM_v1.json';
  const reportRel=campaign+'/work/phase-01/PHASE_01_FINAL_REPORT_v1.md';
  const packetRel=campaign+'/submissions/PHASE_01_WORK_PACKET_v1.json';
  const initialForm={schemaVersion:'curveyield-lite-phase-work-form-v1',phase:1,automationInputs:{predecessorReceiptPath:predecessorRel,derivedInputPaths:[],controllerOwnedAutomationInputs:['predecessorReceiptPath','derivedInputPaths']},actions:{'step-1':{section:'Step 1 Input — Analyze',outputs:{analysis:'<REQUIRED>'}}}};
  const prefillDigest=refreshControllerPrefillDigest(initialForm);
  writeJson(path.join(root,formRel),initialForm);
  // Packet and final report are intentionally absent: controller automation owns both.
  writeJson(path.join(root,dirRel),{
    schemaVersion:'curveyield-audit-campaign-directory-entry-v2',campaignId:'demo-r1',campaignGenerationId:'demo-r1-g1',campaignName:'Demo',workspacePath:campaign,mode:'LITE',sourceSha256:source,lastSealedReceiptPath:predecessorRel,campaignStatus:'ACTIVE',
    currentAssignment:{phaseSequence:1,phaseId:'phase-1',reviewer:'reviewer-1',status:'ACTIVE',workSchemaPath:authority+'/phases/phase-1/PHASE_01_SCHEMA_v1.json',workFormPath:formRel,finalReportPath:reportRel,packetPath:packetRel,predecessorReceiptPath:predecessorRel,derivedInputPaths:[],controllerPrefillDigestSha256:prefillDigest},updatedAt:'2026-09-28T00:00:00Z'
  });
  return {root,campaign,dirRel,formRel,reportRel,packetRel,authority};
}

function run(f){
  const out=execFileSync(process.execPath,['scripts/lite-phase-packet-controller-v1.mjs','--controller-root',f.root,'--campaign-id','demo-r1','--campaign-path',f.campaign,'--campaign-directory-path',f.dirRel,'--phase-sequence','1'],{encoding:'utf8'});
  return JSON.parse(out.trim());
}

test('controller rejects a campaign id that does not match the canonical directory entry',()=>{
  const f=fixture();
  assert.throws(
    ()=>execFileSync(process.execPath,[
      'scripts/lite-phase-packet-controller-v1.mjs',
      '--controller-root',f.root,
      '--campaign-id','other-r1',
      '--campaign-path',f.campaign,
      '--campaign-directory-path',f.dirRel,
      '--phase-sequence','1'
    ],{encoding:'utf8',stdio:'pipe'}),
    /campaign-id does not match Audit Campaign Directory/
  );
});

test('incomplete semantic work causes exact rework while controller creates the packet and does zero bookkeeping',()=>{
  const f=fixture();
  const graphBefore=fs.readFileSync(path.join(f.root,f.campaign,'controller/SECURITY_TRACEABILITY_GRAPH_v1.json'),'utf8');
  const result=run(f);
  assert.equal(result.status,'NEEDS_REWORK');
  assert.match(result.feedbackText,/actions\.step-1\.outputs\.analysis is missing/);
  assert.equal(fs.existsSync(path.join(f.root,f.campaign,'receipts/PHASE_01_RECEIPT_v1.json')),false);
  assert.equal(fs.readFileSync(path.join(f.root,f.campaign,'controller/SECURITY_TRACEABILITY_GRAPH_v1.json'),'utf8'),graphBefore);
  const packet=readJson(path.join(f.root,f.packetRel));
  assert.equal(packet.status,'REWORK_REQUIRED');
  assert.equal(packet.controllerGenerated,true);
  assert.equal(packet.submissionAttempt,1);
  assert.equal(fs.existsSync(path.join(f.root,f.reportRel)),false);
  assert.equal(readJson(path.join(f.root,f.dirRel)).currentAssignment.status,'REWORK_REQUIRED');
});

test('repaired semantic work PASS auto-regenerates packet/report, bookkeeps once, and prepares Phase2',()=>{
  const f=fixture();
  run(f);
  const form=readJson(path.join(f.root,f.formRel));
  form.actions['step-1'].outputs.analysis='Substantive Phase-1 analysis complete.';
  writeJson(path.join(f.root,f.formRel),form);
  const result=run(f);
  assert.equal(result.status,'PASS');
  assert.equal(result.controllerPassToken,'CONTROLLER_PHASE_PASS');
  assert.equal(fs.existsSync(path.join(f.root,f.campaign,'receipts/PHASE_01_RECEIPT_v1.json')),true);
  assert.equal(fs.existsSync(path.join(f.root,f.campaign,'receipts/PHASE_02_RECEIPT_v1.json')),false);
  const directory=readJson(path.join(f.root,f.dirRel));
  assert.equal(directory.currentAssignment.phaseSequence,2);
  assert.equal(directory.currentAssignment.reviewer,'reviewer-2');
  assert.equal(directory.currentAssignment.status,'WAITING_FOR_SUCCESSOR_AGENT');
  assert.equal(fs.existsSync(path.join(f.root,directory.currentAssignment.workFormPath)),true);
  const acceptedPacket=readJson(path.join(f.root,f.packetRel));
  assert.equal(acceptedPacket.status,'ACCEPTED');
  assert.equal(acceptedPacket.controllerGenerated,true);
  assert.equal(acceptedPacket.submissionAttempt,2);
  assert.equal(fs.existsSync(path.join(f.root,f.reportRel)),true);
  assert.match(fs.readFileSync(path.join(f.root,f.reportRel),'utf8'),/CONTROLLER-GENERATED/);
  const graph=readJson(path.join(f.root,f.campaign,'controller/SECURITY_TRACEABILITY_GRAPH_v1.json'));
  assert.equal(graph.controllerImports.length,1);
});


test('assignment-backed digest rejects tampered controller input even if reviewer recomputes local digest',()=>{
  const f=fixture();
  const form=readJson(path.join(f.root,f.formRel));
  form.automationInputs.derivedInputPaths=['campaigns/demo/derived/forged.json'];
  refreshControllerPrefillDigest(form);
  form.actions['step-1'].outputs.analysis='Complete semantic work.';
  writeJson(path.join(f.root,f.formRel),form);
  const result=run(f);
  assert.equal(result.status,'NEEDS_REWORK');
  assert.match(result.feedbackText,/controller-prefill digest does not match the controller-owned assignment digest|Controller-prefilled\/read-only fields were modified/);
  assert.equal(fs.existsSync(path.join(f.root,f.campaign,'receipts/PHASE_01_RECEIPT_v1.json')),false);
});


test('accepted due-obligation disposition updates ledger and sealed receipt consistently',()=>{
  const f=fixture();
  const schemaPath=path.join(f.root,f.authority,'phases/phase-1/PHASE_01_SCHEMA_v1.json');
  const schema=readJson(schemaPath);
  schema.actions['step-1'].fields.push({
    name:'obligationDispositions',
    type:'REQUIRED_RECORD_LIST',
    consumers:['controller-bookkeeping'],
    itemRequiredFields:['obligationId','requiredAction','completionCondition','disposition','rationale','evidenceRefs','carryForwardPhaseOrNone'],
    itemFieldAllowedValues:{disposition:['SATISFIED','CARRY_FORWARD','BLOCKED_CARRIED','NOT_APPLICABLE'],carryForwardPhaseOrNone:['NONE_IDENTIFIED','4','6']}
  });
  schema.bookkeepingMappings.obligationRecordPaths=['actions.step-1.outputs.obligationDispositions'];
  writeJson(schemaPath,schema);

  const ledgerPath=path.join(f.root,f.campaign,'controller/CARRIED_FORWARD_OBLIGATION_LEDGER_v1.json');
  const obligation={
    obligationId:'OBL-P1-CONTEXT-001',originPhase:'0',originatingFactIds:[],originatingEvidenceRefs:['e0'],
    requiredPhase:'1',requiredReviewer:'reviewer-1',requiredAction:'Interpret Phase-0 evidence',
    completionCondition:'Record semantic disposition',mandatory:true,status:'OPEN',statusReason:null,
    closureEvidenceRefs:[],supersedesOrReplaces:[],createdAt:'2026-09-29T00:00:00Z',updatedAt:'2026-09-29T00:00:00Z'
  };
  writeJson(ledgerPath,{obligations:[obligation],phaseCheckpoints:[]});

  const form=readJson(path.join(f.root,f.formRel));
  form.actions['step-1'].outputs.analysis='Substantive Phase-1 analysis complete.';
  form.actions['step-1'].outputs.obligationDispositions=[{
    obligationId:obligation.obligationId,
    requiredAction:obligation.requiredAction,
    completionCondition:obligation.completionCondition,
    disposition:'SATISFIED',
    rationale:'Phase-1 semantic review completed the obligation.',
    evidenceRefs:['work/phase-01/PHASE_01_WORK_FORM_v1.json'],
    carryForwardPhaseOrNone:'NONE_IDENTIFIED',
    automationOwnedFields:['obligationId','requiredAction','completionCondition']
  }];
  form.automationInputs.expectedDueObligationIds=[obligation.obligationId];
  form.automationInputs.controllerOwnedAutomationInputs=[
    ...(form.automationInputs.controllerOwnedAutomationInputs??[]),
    'expectedDueObligationIds'
  ];
  const digest=refreshControllerPrefillDigest(form);
  writeJson(path.join(f.root,f.formRel),form);
  const directory=readJson(path.join(f.root,f.dirRel));
  directory.currentAssignment.controllerPrefillDigestSha256=digest;
  writeJson(path.join(f.root,f.dirRel),directory);

  const result=run(f);
  assert.equal(result.status,'PASS');
  const ledger=readJson(ledgerPath);
  assert.equal(ledger.obligations[0].status,'SATISFIED');
  assert.ok(ledger.obligations[0].closureEvidenceRefs.some(x=>x.includes('PHASE_01_CANONICAL_DATA_v1.json')));
  const receipt=readJson(path.join(f.root,f.campaign,'receipts/PHASE_01_RECEIPT_v1.json'));
  assert.equal(receipt.obligations.due[0].obligationId,obligation.obligationId);
  assert.equal(receipt.obligations.closed[0].obligationId,obligation.obligationId);
});


function runMaster(f,segmentId='reviewer-1-phase-01'){
  const out=execFileSync(process.execPath,['scripts/lite-phase-packet-controller-v1.mjs','--controller-root',f.root,'--campaign-id','demo-r1','--campaign-path',f.campaign,'--campaign-directory-path',f.dirRel,'--review-kind','master','--segment-id',segmentId],{encoding:'utf8'});
  return JSON.parse(out.trim());
}

test('v11-configured Phase 1 seals but cannot create Phase 2 until exact master ACCEPT',()=>{
  const f=fixture();
  const directory=readJson(path.join(f.root,f.dirRel));
  directory.masterReview={chatUrl:'https://chatgpt.com/c/master-review-chat',reasoning:'MAXIMUM',repairModel:'SOL',repairReasoning:'HIGH'};
  writeJson(path.join(f.root,f.dirRel),directory);
  const predecessor=readJson(path.join(f.root,directory.lastSealedReceiptPath));
  predecessor.authority.liteSkillSha256='b'.repeat(64);
  predecessor.authority.liteRelease='Audit_Litemode_v11';
  writeJson(path.join(f.root,directory.lastSealedReceiptPath),predecessor);
  writeJson(path.join(f.root,f.campaign,'evidence/build/BUILD_AND_SOURCE_IDENTITY_v1.json'),{source:{archiveSha256:'a'.repeat(64)}});
  const form=readJson(path.join(f.root,f.formRel));
  form.actions['step-1'].outputs.analysis='Master-gated Phase-1 analysis.';
  writeJson(path.join(f.root,f.formRel),form);

  const phaseResult=run(f);
  assert.equal(phaseResult.status,'WAITING_FOR_MASTER_REVIEW');
  const waiting=readJson(path.join(f.root,f.dirRel));
  assert.equal(waiting.campaignStatus,'WAITING_FOR_MASTER_REVIEW');
  assert.equal(waiting.currentAssignment,null);
  assert.equal(waiting.pendingMasterReview.segmentId,'reviewer-1-phase-01');
  assert.deepEqual(waiting.pendingMasterReview.segmentPhases,[1]);
  assert.match(waiting.pendingMasterReview.bindingsSha256,/^[0-9a-f]{64}$/);
  const masterPath=path.join(f.root,waiting.pendingMasterReview.workFormPath);
  const master=readJson(masterPath);
  assert.deepEqual([...new Set(master.reviewedArtifacts.map(x=>x.phase))],[1]);
  assert.ok(master.reviewedArtifacts.some(x=>x.kind==='WORK_FORM'));
  assert.ok(master.reviewedArtifacts.some(x=>x.kind==='CANONICAL_DATA'));
  assert.ok(master.reviewedArtifacts.some(x=>x.kind==='PHASE_REPORT'));
  assert.ok(master.reviewedArtifacts.some(x=>x.kind==='SEALED_RECEIPT'));
  assert.ok(master.reviewedArtifacts.some(x=>x.kind==='GLOBAL_CONTROL_SOURCEINTELLIGENCEBUNDLE'));
  assert.ok(master.reviewedArtifacts.some(x=>x.kind==='INPUT_CONTROLLER_GENERATED_PHASE_WORK_PACKET'));
  master.review={outcome:'ACCEPT',summary:'Entire reviewer-1 segment accepted.',deficiencies:[],repairSpec:null};
  master.masterVerification={
    outcome:'ACCEPT',
    verifiedArtifactDigests:master.reviewedArtifacts.map(x=>({path:x.path,sha256:x.sha256})),
    deficiencyDispositions:[],
    notes:'Verified exact segment manifest.',
    verifiedAt:'2026-10-04T00:00:00Z'
  };
  writeJson(masterPath,master);

  const accepted=runMaster(f);
  assert.equal(accepted.status,'PASS');
  assert.equal(accepted.masterReviewAccepted,true);
  const advanced=readJson(path.join(f.root,f.dirRel));
  assert.equal(advanced.pendingMasterReview,null);
  assert.equal(advanced.currentAssignment.phaseSequence,2);
  assert.equal(advanced.campaignStatus,'WAITING_FOR_SUCCESSOR_AGENT');
});

test('master REWORK produces bounded Sol/High scope and leaves successor blocked',()=>{
  const f=fixture();
  const directory=readJson(path.join(f.root,f.dirRel));
  directory.masterReview={chatUrl:'https://chatgpt.com/c/master-review-chat',reasoning:'MAXIMUM',repairModel:'SOL',repairReasoning:'HIGH'};
  writeJson(path.join(f.root,f.dirRel),directory);
  const predecessor=readJson(path.join(f.root,directory.lastSealedReceiptPath));
  predecessor.authority.liteSkillSha256='b'.repeat(64);
  writeJson(path.join(f.root,directory.lastSealedReceiptPath),predecessor);
  writeJson(path.join(f.root,f.campaign,'evidence/build/BUILD_AND_SOURCE_IDENTITY_v1.json'),{});
  const form=readJson(path.join(f.root,f.formRel));
  form.actions['step-1'].outputs.analysis='Reviewable but deficient Phase-1 analysis.';
  writeJson(path.join(f.root,f.formRel),form);
  run(f);
  const waiting=readJson(path.join(f.root,f.dirRel));
  const masterPath=path.join(f.root,waiting.pendingMasterReview.workFormPath);
  const master=readJson(masterPath);
  master.review={
    outcome:'REWORK',
    summary:'One bounded defect.',
    deficiencies:[{id:'MR-001',phase:1,ownedPaths:['actions.step-1.outputs.analysis'],description:'Clarify evidence.',evidenceRefs:[f.formRel]}],
    repairSpec:{
      scopeId:'MR-001-repair',
      allowedFiles:[path.posix.relative(f.campaign,f.formRel)],
      allowedSemanticPaths:[{file:path.posix.relative(f.campaign,f.formRel),path:'actions.step-1.outputs.analysis'}],
      requiredDependentRefreshes:['phase-1-canonical','phase-1-report','phase-1-receipt'],
      prohibitedActions:['SEAL','ADVANCE','MUTATE_ACCEPTED_PREFILL','MUTATE_UNRELATED_EVIDENCE']
    }
  };
  writeJson(masterPath,master);
  const result=runMaster(f);
  assert.equal(result.status,'MASTER_REVIEW_REWORK_REQUIRED');
  assert.equal(result.repairModel,'SOL');
  assert.equal(result.repairReasoning,'HIGH');
  const blocked=readJson(path.join(f.root,f.dirRel));
  assert.equal(blocked.currentAssignment,null);
  assert.equal(blocked.campaignStatus,'MASTER_REVIEW_REWORK_REQUIRED');
  assert.match(blocked.pendingMasterReview.repairSpecSha256,/^[0-9a-f]{64}$/);
  const repeated=runMaster(f);
  assert.equal(repeated.status,'MASTER_REVIEW_INVALID');
  assert.match(repeated.feedbackText,/MASTER_REPAIR_TRANSPORT_BLOCKED/);
  assert.equal(readJson(path.join(f.root,f.dirRel)).currentAssignment,null);
});

test('typed held revision2-to-revision3 admission regenerates controller products and resolves EIM-013',()=>{
  const f=fixture();
  const oldAuthority=f.authority;
  const authority='Audit Skill - Current Authority/Audit_Litemode_v10.3';
  mkdir(path.join(f.root,authority,'phases/phase-1/resources'));
  mkdir(path.join(f.root,authority,'phases/phase-2/resources'));
  for(const rel of [
    'phases/phase-1/PHASE_01_SCHEMA_v1.json',
    'phases/phase-2/PHASE_02_SCHEMA_v1.json',
    'phases/phase-2/resources/PHASE_02_WORK_FORM_TEMPLATE_v1.json',
    'phases/phase-2/resources/PHASE_02_FINAL_REPORT_TEMPLATE_v1.md'
  ]){
    const src=path.join(f.root,oldAuthority,rel),dst=path.join(f.root,authority,rel);
    mkdir(path.dirname(dst));fs.copyFileSync(src,dst);
  }
  write(path.join(f.root,authority,'SKILL.md'),'# frozen v10.3 fixture\n');
  writeJson(path.join(f.root,authority,'MANIFEST.json'),{release:'Audit_Litemode_v10.3',entrypoint:'SKILL.md',files:[]});
  const priorFormRel=f.campaign+'/work/phase-01/PHASE_01_WORK_FORM_v2.json';
  const repairedFormRel=f.campaign+'/work/phase-01/PHASE_01_WORK_FORM_v3.json';
  const priorForm=readJson(path.join(f.root,f.formRel));
  priorForm.actions['step-1'].outputs.analysis='Old incomplete interpretation.';
  writeJson(path.join(f.root,priorFormRel),priorForm);
  const repaired=structuredClone(priorForm);
  repaired.actions['step-1'].outputs.analysis='Corrected, source-bound interpretation.';
  writeJson(path.join(f.root,repairedFormRel),repaired);
  const phase0=readJson(path.join(f.root,f.campaign,'receipts/PHASE_00_RECEIPT_v1.json'));
  phase0.authority={...phase0.authority,homepagePath:authority+'/SKILL.md',liteSkillSha256:'bdb90107ea50580e67be91440ce47087de570c4f54b8474c5a3eb852af95ea27'};
  writeJson(path.join(f.root,f.campaign,'receipts/PHASE_00_RECEIPT_v1.json'),phase0);
  const priorReceiptRel=f.campaign+'/receipts/PHASE_01_RECEIPT_v2.json';
  writeJson(path.join(f.root,priorReceiptRel),{
    phase:{sequence:1,revision:2,status:'SEALED'},source:{sha256:'a'.repeat(64)},authority:phase0.authority,
    inputs:[{role:'PREDECESSOR_RECEIPT',path:f.campaign+'/receipts/PHASE_00_RECEIPT_v1.json'}]
  });
  const qualityRel=f.campaign+'/work/phase-01/review/PHASE_01_QUALITY_REVIEW_v2.md';
  const authRel=f.campaign+'/controller/HUMAN_REWORK_AUTHORIZATION_v1.json';
  write(path.join(f.root,qualityRel),'# Quality review\nBounded correction approved.\n');
  writeJson(path.join(f.root,authRel),{scopeId:'phase1-r2-r3',authorizedAt:'2026-10-04T00:00:00Z'});
  writeJson(path.join(f.root,f.campaign,'controller/EVIDENCE_INVALIDATION_MATRIX_v1.json'),{events:[{eventId:'INV-P1-REWORK-001',ruleId:'EIM-013',status:'RESOLVED_BY_PHASE_1_REVISION_2'}]});
  const digest=rel=>createHash('sha256').update(fs.readFileSync(path.join(f.root,rel))).digest('hex');
  const requestRel=f.campaign+'/controller/SEALED_PHASE_REWORK_REQUEST_v1.json';
  writeJson(path.join(f.root,requestRel),{
    schemaVersion:'curveyield-lite-sealed-phase-rework-request-v1',campaignId:'demo-r1',phaseSequence:1,fromRevision:2,toRevision:3,sourceSha256:'a'.repeat(64),
    authority:{logicalRoot:authority,expectedRootSha256:'bdb90107ea50580e67be91440ce47087de570c4f54b8474c5a3eb852af95ea27',expectedManifestSha256:'846be5f90d6e00757b817b1218dfabeb2aa4dff6c92b8e9ff47335d2db83703a'},
    priorReceipt:{path:priorReceiptRel,sha256:digest(priorReceiptRel)},priorWorkForm:{path:priorFormRel,sha256:digest(priorFormRel)},repairedWorkForm:{path:repairedFormRel,sha256:digest(repairedFormRel)},
    qualityReview:{path:qualityRel,sha256:digest(qualityRel)},humanAuthorization:{scopeId:'phase1-r2-r3',recordPath:authRel,recordSha256:digest(authRel),authorizedAt:'2026-10-04T00:00:00Z'},
    generatedFinalReportPath:f.campaign+'/work/phase-01/PHASE_01_FINAL_REPORT_v3.md',generatedPacketPath:f.campaign+'/submissions/PHASE_01_WORK_PACKET_v3.json',
    allowedSemanticPaths:['actions.step-1.outputs.analysis'],dependentRefresh:{regenerateCanonical:true,regenerateReport:true,regenerateDerived:true,resealReceipt:true,prepareSuccessorAssignment:true},
    evidenceInvalidation:{eventId:'INV-P1-REWORK-002',ruleId:'EIM-013',requiredPriorStatus:'SEALED_REVISION_2',resolveTo:'RESOLVED_BY_PHASE_1_REVISION_3'},holdSuccessorDelivery:true
  });
  const out=execFileSync(process.execPath,['scripts/lite-phase-packet-controller-v1.mjs','--controller-root',f.root,'--campaign-id','demo-r1','--campaign-path',f.campaign,'--campaign-directory-path',f.dirRel,'--review-kind','sealed-rework','--phase-sequence','1','--rework-request-path',requestRel],{encoding:'utf8'});
  const result=JSON.parse(out.trim());
  assert.equal(result.status,'PASS');
  assert.equal(result.sealedRework,true);
  assert.equal(fs.existsSync(path.join(f.root,f.campaign,'receipts/PHASE_01_RECEIPT_v3.json')),true);
  const canonical=readJson(path.join(f.root,f.campaign,'derived/phase-1/PHASE_01_CANONICAL_DATA_v1.json'));
  assert.equal(canonical.actions['step-1'].outputs.analysis,'Corrected, source-bound interpretation.');
  const invalid=readJson(path.join(f.root,f.campaign,'controller/EVIDENCE_INVALIDATION_MATRIX_v1.json'));
  assert.equal(invalid.events[0].status,'RESOLVED_BY_PHASE_1_REVISION_2');
  assert.equal(invalid.events[1].eventId,'INV-P1-REWORK-002');
  assert.equal(invalid.events[1].status,'RESOLVED_BY_PHASE_1_REVISION_3');
  assert.equal(fs.existsSync(path.join(f.root,f.campaign,'work/phase-01/PHASE_01_FINAL_REPORT_v3.md')),true);
  assert.equal(fs.existsSync(path.join(f.root,f.campaign,'submissions/PHASE_01_WORK_PACKET_v3.json')),true);
  assert.equal(readJson(path.join(f.root,f.dirRel)).currentAssignment.phaseSequence,2);
});


test('legacy v10.3 fallback is read-only and rejects an unpinned frozen package',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'lite-frozen-authority-'));
  const frozen='audit-process/v7/frozen-authorities/Audit_Litemode_v10.3';
  write(path.join(root,frozen,'SKILL.md'),'tampered');
  writeJson(path.join(root,frozen,'MANIFEST.json'),{release:'Audit_Litemode_v10.3',entrypoint:'SKILL.md',files:[]});
  assert.throws(()=>requiredFile(root,'Audit Skill - Current Authority/Audit_Litemode_v10.3/SKILL.md'),/root hash mismatch/);
  assert.equal(repoFile(root,'Audit Skill - Current Authority/Audit_Litemode_v10.3/SKILL.md'),path.join(root,'Audit Skill - Current Authority/Audit_Litemode_v10.3/SKILL.md'));
});
