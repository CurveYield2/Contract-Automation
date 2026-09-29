import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {refreshControllerPrefillDigest} from '../../../scripts/lib/lite-phase-prefill-v1.mjs';

const mkdir=p=>fs.mkdirSync(p,{recursive:true});
const writeJson=(p,v)=>{mkdir(path.dirname(p));fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n');};
const write=(p,v)=>{mkdir(path.dirname(p));fs.writeFileSync(p,v);};
const readJson=p=>JSON.parse(fs.readFileSync(p,'utf8'));

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
