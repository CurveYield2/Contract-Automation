import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  validateWorkForm,
  validateFinalReport,
  ensurePacketShape,
  EXPLICIT_NEGATIVES,
} from '../../../scripts/lib/lite-phase-work-v1.mjs';

const read=p=>fs.readFileSync(p,'utf8');

function schema(){
  return {
    schemaVersion:'curveyield-lite-phase-work-schema-v1',
    phase:2,
    finalReport:{requiredSections:['Executive Conclusion','Material Results','Limitations','Unresolved Substantive Questions']},
    actions:{
      'step-1':{
        section:'Step 1 Input — Analyze Thing',
        fields:[
          {name:'analysis',type:'REQUIRED_ANALYSIS',consumers:['phase-3']},
          {name:'items',type:'REQUIRED_LIST',consumers:['phase-3']},
          {name:'records',type:'REQUIRED_RECORD_LIST',itemRequiredFields:['id','rationale'],consumers:['phase-3']},
        ],
      },
    },
  };
}

test('every required action field produces exact deficiency paths',()=>{
  const s=schema();
  const form={schemaVersion:'curveyield-lite-phase-work-form-v1',phase:2,actions:{'step-1':{section:'Step 1 Input — Analyze Thing',outputs:{analysis:'<REQUIRED>',items:['<REQUIRED_OR_EXPLICIT_NEGATIVE>'],records:[{id:'R-1',rationale:'<REQUIRED>'}]}}}};
  assert.deepEqual(validateWorkForm(s,form),[
    'actions.step-1.outputs.analysis is missing',
    'actions.step-1.outputs.items[0] is missing',
    'actions.step-1.outputs.records[0].rationale is missing',
  ]);
});

test('explicit negative values satisfy deliberate none cases',()=>{
  const s=schema();
  const form={schemaVersion:'curveyield-lite-phase-work-form-v1',phase:2,actions:{'step-1':{section:'Step 1 Input — Analyze Thing',outputs:{analysis:'No material issue identified after review.',items:['NONE_IDENTIFIED'],records:['NONE_IDENTIFIED']}}}};
  assert.equal(EXPLICIT_NEGATIVES.has('NONE_IDENTIFIED'),true);
  assert.deepEqual(validateWorkForm(s,form),[]);
});

test('final report validator requires every schema-governed report section',()=>{
  const s=schema();
  const incomplete='# Report\n\n## Executive Conclusion\nComplete.\n\n## Material Results\n<REQUIRED>\n';
  const failures=validateFinalReport(s,incomplete);
  assert.ok(failures.includes('finalReport section incomplete: Material Results'));
  assert.ok(failures.includes('finalReport section missing: Limitations'));
  assert.ok(failures.includes('finalReport section missing: Unresolved Substantive Questions'));
  const complete='# Report\n\n## Executive Conclusion\nComplete.\n\n## Material Results\nNONE_IDENTIFIED\n\n## Limitations\nNONE_IDENTIFIED\n\n## Unresolved Substantive Questions\nNONE_IDENTIFIED\n';
  assert.deepEqual(validateFinalReport(s,complete),[]);
});

test('packet validation accepts only the active assignment paths and explicit SUBMITTED state',()=>{
  const directory={campaignId:'demo-r1'};
  const assignment={phaseSequence:2,workFormPath:'campaigns/demo/work/phase-02/PHASE_02_WORK_FORM_v1.json',finalReportPath:'campaigns/demo/work/phase-02/PHASE_02_FINAL_REPORT_v1.md'};
  const packet={schemaVersion:'curveyield-lite-phase-work-packet-v1',campaignId:'demo-r1',phaseSequence:2,status:'SUBMITTED',workFormPath:assignment.workFormPath,finalReportPath:assignment.finalReportPath,submissionAttempt:1,submittedAt:'2026-09-28T00:00:00Z'};
  assert.deepEqual(ensurePacketShape({packet,directory,assignment}),[]);
  assert.ok(ensurePacketShape({packet:{...packet,status:'REWORK_REQUIRED'},directory,assignment}).some(x=>x.includes('status must be SUBMITTED')));
});

test('controller architecture forbids active receipt bookkeeping before packet validation',()=>{
  const controller=read('scripts/lite-phase-packet-controller-v1.mjs');
  const workflow=read('.github/workflows/lite-phase-work-packet-controller-v1.yml');
  const phase0=read('scripts/lite-phase0-finalize-v1.mjs');
  assert.match(controller,/validateWorkForm/);
  assert.match(controller,/validateFinalReport/);
  assert.match(controller,/status:'NEEDS_REWORK'/);
  assert.match(controller,/packet\.status='REWORK_REQUIRED'/);
  assert.match(controller,/syncControls/);
  assert.match(controller,/createLitePhaseReceiptV1/);
  assert.ok(controller.indexOf("if(deficiencies.length)") < controller.indexOf("const controls=syncControls"));
  assert.match(workflow,/bookkeeping before validation PASS: prohibited/);
  assert.match(phase0,/preparePhaseWork/);
  assert.match(phase0,/curveyield-audit-campaign-directory-entry-v2/);
});

test('assignment-v2 controller validation is reviewer-request driven and not circularly packet-triggered',()=>{
  const workflow=read('.github/workflows/lite-phase-work-packet-controller-v1.yml');
  const watchdog=read('.github/workflows/browser-agent-watchdog.yml');
  const successor=read('scripts/prepare-lite-assignment-successor-v2.mjs');
  assert.match(workflow,/\.agent-upload\/lite-phase-boundary\/\*\.json/);
  assert.match(workflow,/curveyield-lite-phase-boundary-request-v1/);
  assert.match(workflow,/Resolve canonical campaign routing/);
  assert.match(workflow,/--campaign-id/);
  assert.doesNotMatch(watchdog,/packet_status.*SUBMITTED[\s\S]{0,500}lite-phase-work-packet-controller-v1\.yml/);
  assert.match(successor,/\.agent-upload\/lite-phase-boundary\//);
  assert.match(successor,/curveyield-lite-phase-boundary-request-v1/);
});

test('downstream routing preserves all declared Phase-7 and Phase-10 input views',()=>{
  const controller=read('scripts/lite-phase-packet-controller-v1.mjs');
  assert.match(controller,/const p7=derived\(7,'PHASE8_MARKER_INPUT_v1\.json'\)/);
  assert.match(controller,/target===8[^\n]*\[[^\]]*p7/);
  assert.match(controller,/const p8Final=derived\(8,'PHASE10_INPUT_v1\.json'\)/);
  assert.match(controller,/const p9Final=derived\(9,'PHASE10_REMEDIATION_INPUT_v1\.json'\)/);
  assert.match(controller,/target===10[^\n]*\[[^\]]*p8Final[^\]]*p9Final[^\]]*finalIndex/);
});

test('fresh assignment wake names schema form report and packet instead of an active receipt',()=>{
  const script=read('scripts/prepare-lite-assignment-successor-v2.mjs');
  const orch=read('.github/workflows/lite-audit-browser-orchestrator-v1.yml');
  assert.match(script,/Phase schema:/);
  assert.match(script,/Phase work form:/);
  assert.match(script,/Controller-owned phase final report path:/);
  assert.match(script,/Controller-owned phase packet path:/);
  assert.match(script,/wait for CONTROLLER_PHASE_PASS/);
  assert.match(script,/Do not create or edit the Phase Work Packet or phase final report/);
  assert.match(orch,/prepare-lite-assignment-successor-v2\.mjs/);
});

test('browser wake activates assignment-v2 without creating or modifying phase receipt',()=>{
  const wake=read('.github/workflows/browser-agent-wake.yml');
  assert.match(wake,/curveyield-audit-campaign-directory-entry-v2/);
  assert.match(wake,/currentAssignment\.status="ACTIVE"/);
  assert.match(wake,/without creating or modifying a phase receipt/);
});

test('reviewer repair resumes schema-governed active work and exact deficiencies',()=>{
  const repair=read('.github/workflows/browser-agent-reviewer-repair-v1.yml');
  assert.match(repair,/currentAssignment\.workSchemaPath/);
  assert.match(repair,/currentAssignment\.workFormPath/);
  assert.match(repair,/currentAssignment\.packetPath/);
  assert.match(repair,/controllerValidation\.deficiencies/);
  assert.match(repair,/repair only the exact missing fields/i);
});
