import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {validatePhase6AttackerWorkV1,validatePhase8LinkageV1,validatePhase10CoverageLabelV1,appendAdrCoverageSectionV1} from '../src/adr-phase-validation-v1.mjs';
import {masterWakeMessage} from '../../../scripts/lib/lite-master-review-v1.mjs';
import {fileURLToPath} from 'node:url';

const auto=fileURLToPath(new URL('../../../',import.meta.url));
const setup=()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'adr-p6-')),campaignPath='campaigns/demo';
 const put=(rel,data)=>{const dest=path.join(root,campaignPath,rel);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,JSON.stringify(data));};
 const folder=rel=>fs.mkdirSync(path.join(root,campaignPath,rel),{recursive:true});
 const clean=()=>fs.rmSync(root,{recursive:true,force:true});
 return {root,campaignPath,put,folder,clean};
};
const baseLedger=(status='PASS',invoked=true)=>({schemaVersion:'curveyield-assertion-ledger-v1',parseStatus:'PARSED',toolInvoked:invoked,tests:[
 {name:'Vault::test_prop_BOB_0001',status},{name:'Vault::test_attack',status},
 {name:'Vault::test_control',status:'PASS'}]});
const createForm=(t,ledger=baseLedger())=>{
 t.put('controller/phase6-tests/TG-001/r1.json',{schemaVersion:'v7'});
 t.put('controller/phase6-tests/CP-CAND-1/r1.json',{schemaVersion:'v7'});
 t.put('controller/automation/run1/ASSERTION_LEDGER_v1.json',ledger);
 const ref='controller/automation/run1/ASSERTION_LEDGER_v1.json';
 const common=dir=>({requestDirectory:dir,dispatchRounds:1,requestPaths:[dir+'r1.json'],harnessDesign:'Test real vault roles'});
 return {actions:{'step-4':{outputs:{baselineTestRecords:[{testGroupId:'TG-001',contract:'Vault',
   obligationIds:['BOB-0001'],...common('controller/phase6-tests/TG-001/'),
   obligationOutcomes:[{obligationId:'BOB-0001',outcome:'PASSED',ledgerRef:ref,assertionNames:['Vault::test_prop_BOB_0001']}] }]}},
  'step-5':{outputs:{candidateProofRecords:[{candidateKey:'CAND-1',phase5Result:'NOT_REPRODUCED',
   ...common('controller/phase6-tests/CP-CAND-1/'),verdict:'DISPROVEN',ledgerRef:ref,
   attackAssertionNames:['Vault::test_attack'],controlAssertionNames:['Vault::test_control'],
   reasoning:'onlyOwner blocks unauthorized call at Vault.sol:L4'}],
   newCandidateRecords:['NONE_IDENTIFIED']}}}};
};
const run=(t,f)=>validatePhase6AttackerWorkV1({...t,form:f});
test('Phase 6 valid named PASSED baseline and DISPROVEN blocked attack',()=>{
 const t=setup();try{const f=createForm(t);assert.deepEqual(run(t,f),[]);}finally{t.clean();}
});
test('unparseable ledger cannot satisfy baseline PASSED',()=>{
 const t=setup();try{const f=createForm(t,{...baseLedger(),parseStatus:'UNPARSEABLE'});assert.ok(run(t,f).some(x=>x.includes('ledger')));}finally{t.clean();}
});
test('missing tool invocation cannot certify a test',()=>{
 const t=setup();try{const f=createForm(t,baseLedger('PASS',null));assert.ok(run(t,f).length);}finally{t.clean();}
});
test('ROUNDS_EXHAUSTED at 2 rounds fails; NO_EXECUTABLE_SETUP with note works',()=>{
 const t=setup();try{const f=createForm(t),o=f.actions['step-4'].outputs.baselineTestRecords[0].obligationOutcomes[0];
 o.outcome='NOT_ACHIEVED';o.reasonCode='ROUNDS_EXHAUSTED';o.note='The harness did not deploy';
 assert.ok(run(t,f).some(x=>x.includes('NOT_ACHIEVED')));
 o.reasonCode='NO_EXECUTABLE_SETUP';assert.deepEqual(run(t,f),[]);
 }finally{t.clean();}
});
test('NOT_APPLICABLE_CONFIRMED requires an anchored note',()=>{
 const t=setup();try{const f=createForm(t),o=f.actions['step-4'].outputs.baselineTestRecords[0].obligationOutcomes[0];
 o.outcome='NOT_APPLICABLE_CONFIRMED';o.note='No affected balance';o.anchors=[];
 assert.ok(run(t,f).some(x=>x.includes('anchor')));
 }finally{t.clean();}
});
test('Phase 5 NOT_REPRODUCED alone never proves a candidate safe',()=>{
 const t=setup();try{const f=createForm(t,baseLedger('FAIL'));assert.ok(run(t,f).some(x=>x.includes('attackAssertionNames')));}finally{t.clean();}
});
test('CONFIRMED cannot use a failing control assertion',()=>{
 const t=setup();try{const l=baseLedger('FAIL');l.tests[2].status='FAIL';
 const f=createForm(t,l);const row=f.actions['step-5'].outputs.candidateProofRecords[0];row.verdict='CONFIRMED';
 assert.ok(run(t,f).some(x=>x.includes('controlAssertionNames')));
 }finally{t.clean();}
});
test('request-file count mismatch is rejected',()=>{
 const t=setup();try{const f=createForm(t);f.actions['step-4'].outputs.baselineTestRecords[0].dispatchRounds=2;
 assert.ok(run(t,f).some(x=>x.includes('dispatchRounds')));}finally{t.clean();}
});
test('v11 form remains outside v12 Phase 6 validator',()=>{
 const t=setup();try{assert.deepEqual(run(t,{actions:{'step-1':{outputs:{}}}}),[]);}finally{t.clean();}
});
test('Phase 8 missing P6 property, candidate, and new issue keys causes deficiencies',()=>{
 const t=setup();try{
 t.put('derived/phase-6/PHASE_06_CANONICAL_DATA_v1.json',{actions:{
  'step-4':{outputs:{baselineTestRecords:[{testGroupId:'TG-001',obligationOutcomes:[{obligationId:'BOB-0001',outcome:'PROPERTY_FAILED'}]}]}},
  'step-5':{outputs:{candidateProofRecords:[{candidateKey:'CAND-1',verdict:'INCONCLUSIVE'}],
   newCandidateRecords:[{tempKey:'P6-NEW-001'}]}}}});
 const result=validatePhase8LinkageV1({...t,form:{actions:{'step-2':{outputs:{candidateValidations:[]}}}}});
 assert.equal(result.length,3);assert.ok(result.some(x=>x.includes('P6-NEW-001')));
 }finally{t.clean();}
});
test('coverage helper preserves absent summary, writes matrix and qualification status with summary',()=>{
 const t=setup();try{
 assert.equal(appendAdrCoverageSectionV1({...t,automationRoot:auto,text:'Old index'}),'Old index');
 t.put('work/phase-04/discovery/DISCOVERY_SUMMARY_v1.json',{payload:{discoveryState:{reviewChecks:{},gaps:[]}}});
 t.put('evidence/review-inventory/REVIEW_INVENTORY_v1.json',{payload:{contexts:[],triggers:{}}});
 const result=appendAdrCoverageSectionV1({...t,automationRoot:auto,text:'Old index'});
 assert.match(result,/## Coverage matrix/);assert.match(result,/Detection qualification status: NOT_YET_QUALIFIED/);
 assert.ok(fs.existsSync(path.join(t.root,t.campaignPath,'work/phase-10/COVERAGE_MATRIX_v1.json')));
 }finally{t.clean();}
});
test('Phase 10 verdictRationale must state exact coverage label',()=>{
 const t=setup();try{t.put('work/phase-10/COVERAGE_MATRIX_v1.json',{label:'PARTIAL_COVERAGE'});
 const form={actions:{'step-3':{outputs:{verdictRationale:'The tests are incomplete'}}}};
 assert.ok(validatePhase10CoverageLabelV1({...t,form}).length>0);
 form.actions['step-3'].outputs.verdictRationale='Assurance: PARTIAL_COVERAGE';
 assert.deepEqual(validatePhase10CoverageLabelV1({...t,form}),[]);
 }finally{t.clean();}
});
test('master extraLines appends only when provided',()=>{
 const input={campaignId:'demo',pending:{segmentPhases:[2,3,4,5],segmentId:'reviewer-2-phases-02-05',reviewerId:'reviewer-2',
 recordPath:'seg.json'},authorityRoot:'Audit_Litemode_v11'};
 const legacy=masterWakeMessage(input);
 assert.equal(masterWakeMessage({...input,extraLines:[]}),legacy);
 assert.equal(masterWakeMessage({...input,extraLines:['Challenge all gaps']}),legacy+'\nChallenge all gaps');
});
