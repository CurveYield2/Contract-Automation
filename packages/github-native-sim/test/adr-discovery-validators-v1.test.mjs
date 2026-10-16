import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseAnchorV1,validateFlowReviewSubmissionV1,validateAttackSubmissionV1,feedbackTextV1}
 from '../src/adr-discovery-validators-v1.mjs';

const inventory={payload:{sourceUnits:[
 {path:'contracts/A.sol',scopeTier:'IN_SCOPE',lineCount:20},
 {path:'contracts/B.sol',scopeTier:'IN_SCOPE',lineCount:30},
 {path:'lib/Math.sol',scopeTier:'DEPENDENCY',lineCount:7},
 {path:'test/Mock.sol',scopeTier:'TEST_OR_MOCK',lineCount:100}
]}};
const anchor='contracts/B.sol:L2-L4';
const candidate=()=>({tempKey:'C-001',title:'Missing guard',description:'An unguarded state write is reachable.',anchors:[anchor]});
const flowPacket={unitId:'F-001',primaryContexts:[{contextId:'CTX-A'}],requiredClasses:{'CTX-A':['ACCESS_CONTROL']},flows:[{flowId:'FLOW-0001'}]};
const flowSubmission=()=>({
 schemaVersion:'curveyield-flow-review-submission-v1',unitId:'F-001',
 flowNotes:[{flowId:'FLOW-0001',note:'User entry moves funds from A to B.',anchors:[anchor]}],
 rows:[{contextId:'CTX-A',summary:'State-changing entry through A and B',
  checks:[{classId:'ACCESS_CONTROL',assessment:'SUPPORTED',applicability:'APPLICABLE',
   evidence:'onlyOwner checks caller and reverts before state write',anchors:[anchor]}]}],
 candidates:[]
});
const flow=(packet=flowPacket,submission=flowSubmission())=>validateFlowReviewSubmissionV1({packet,submission,inventory});
const attackPacket={unitId:'X-001',flows:[{flowId:'FLOW-0001'}],integrationQuestions:[{obligationId:'IOB-0001'}]};
const attackSubmission=()=>({
 schemaVersion:'curveyield-attack-submission-v1',unitId:'X-001',
 attackPaths:[{pathId:'ATK-1',flowIds:['FLOW-0001'],goal:'Steal token assets',
  role:'UNPRIVILEGED_CALLER',steps:['Call write() from a nonowner'],
  anchors:[anchor],result:'BLOCKED',blockingControl:'onlyOwner modifier checks msg.sender'}],
 integrationAnswers:[{obligationId:'IOB-0001',assessment:'SUPPORTED',
  reasoning:'The callee rejects unauthorized senders before a write.',anchors:[anchor]}]
});
const attack=(packet=attackPacket,submission=attackSubmission())=>validateAttackSubmissionV1({packet,submission,inventory});
const has=(result,code)=>assert.ok(result.errors.some(e=>e.code===code),
 code+' absent; received '+JSON.stringify(result.errors));
test('accepted source anchors include cross-contract references and dependency sources',()=>{
 assert.deepEqual(parseAnchorV1('contracts/A.sol:L1',inventory),{path:'contracts/A.sol',lineStart:1,lineEnd:1});
 assert.deepEqual(parseAnchorV1(anchor,inventory),{path:'contracts/B.sol',lineStart:2,lineEnd:4});
 assert.deepEqual(parseAnchorV1('lib/Math.sol:L7',inventory),{path:'lib/Math.sol',lineStart:7,lineEnd:7});
 assert.equal(parseAnchorV1('contracts/A.sol:L21',inventory),null);
 assert.equal(parseAnchorV1('test/Mock.sol:L2',inventory),null);
 assert.equal(parseAnchorV1('contracts/A.sol:L5-L2',inventory),null);
 assert.equal(parseAnchorV1('contracts/A.sol:L0',inventory),null);
});
test('fully valid F flow, R residual and X attack pass; unrelated contract anchor is allowed',()=>{
 assert.equal(flow().ok,true,JSON.stringify(flow().errors));
 const residual={unitId:'R-001',primaryContexts:[{contextId:'CTX-A'}],requiredClasses:{'CTX-A':['ACCESS_CONTROL']},flows:[]};
 const submission=flowSubmission();submission.unitId='R-001';submission.flowNotes=[];
 assert.equal(flow(residual,submission).ok,true,JSON.stringify(flow(residual,submission).errors));
 assert.equal(attack().ok,true,JSON.stringify(attack().errors));
});
test('null submissions return errors, never throw',()=>{
 has(flow(flowPacket,null),'SUBMISSION_SCHEMA');
 has(attack(attackPacket,null),'SUBMISSION_SCHEMA');
});
test('flow-review schema rejects invalid form, unit, unknown/extra/duplicate/missing contexts',()=>{
 const s=flowSubmission();s.schemaVersion='bad';has(flow(flowPacket,s),'SUBMISSION_SCHEMA');
 s.schemaVersion='curveyield-flow-review-submission-v1';s.unitId='R-002';has(flow(flowPacket,s),'UNIT_MISMATCH');
 s.unitId='F-001';s.rows=[{...s.rows[0],contextId:'CTX-X'}];
 has(flow(flowPacket,s),'EXTRA_CONTEXT');has(flow(flowPacket,s),'MISSING_CONTEXT');
 s.rows=[flowSubmission().rows[0],flowSubmission().rows[0]];
 has(flow(flowPacket,s),'DUPLICATE_CONTEXT');
});
test('flow-review missing/empty flow notes and context summaries',()=>{
 const s=flowSubmission();s.flowNotes=[];has(flow(flowPacket,s),'FLOW_NOTE_MISSING');
 s.flowNotes=[{flowId:'FLOW-0001',note:'  ',anchors:[]}];has(flow(flowPacket,s),'FLOW_NOTE_EMPTY');
 s.flowNotes=flowSubmission().flowNotes;s.rows[0].summary=' ';has(flow(flowPacket,s),'SUMMARY_EMPTY');
});
test('flow review class and evidence validation codes',()=>{
 const s=flowSubmission(),check=s.rows[0].checks[0];
 s.rows[0].checks=[];has(flow(flowPacket,s),'CHECK_MISSING');
 s.rows[0].checks=[{...check,classId:'OTHER'}];has(flow(flowPacket,s),'CHECK_UNKNOWN_CLASS');
 s.rows[0].checks=[check,{...check}];has(flow(flowPacket,s),'CHECK_DUPLICATE');
 s.rows[0].checks=[{...check,evidence:'No Issue'}];has(flow(flowPacket,s),'EVIDENCE_EMPTY');
 s.rows[0].checks=[{...check,anchors:[]}];has(flow(flowPacket,s),'ANCHOR_REQUIRED');
 s.rows[0].checks=[{...check,anchors:['test/Mock.sol:L3']}];has(flow(flowPacket,s),'ANCHOR_INVALID');
 s.rows[0].checks=[{...check,assessment:'NOT_APPLICABLE'}];has(flow(flowPacket,s),'NA_MISMATCH');
 s.rows[0].checks=[{...check,assessment:'CONCERN'}];has(flow(flowPacket,s),'CONCERN_WITHOUT_CANDIDATE');
 s.rows[0].checks=[{...check,assessment:'CONCERN',candidate:{title:'',description:'',anchors:[]}}];
 has(flow(flowPacket,s),'CANDIDATE_INVALID');
});
test('evidence repetition is across distinct contexts only, including numbers',()=>{
 const packet={unitId:'F-001',primaryContexts:Array.from({length:4},(_,i)=>({contextId:'CTX-'+i})),
  requiredClasses:Object.fromEntries(Array.from({length:4},(_,i)=>['CTX-'+i,['ACCESS_CONTROL']])),flows:[]};
 const s=flowSubmission();s.flowNotes=[];
 s.rows=Array.from({length:4},(_,i)=>({
  contextId:'CTX-'+i,summary:'reviewed function '+i,
  checks:[{classId:'ACCESS_CONTROL',assessment:'SUPPORTED',applicability:'APPLICABLE',
   evidence:'guard checks exactly 100 sender conditions',anchors:[anchor]}]
 }));
 has(flow(packet,s),'REPEATED_EVIDENCE');
 s.rows[0].checks=Array.from({length:4},()=>({...s.rows[0].checks[0]}));
 s.rows=s.rows.slice(0,1);
 const one={...packet,primaryContexts:[{contextId:'CTX-0'}],requiredClasses:{'CTX-0':['ACCESS_CONTROL']}};
 assert.ok(!flow(one,s).errors.some(x=>x.code==='REPEATED_EVIDENCE'));
 s.rows=Array.from({length:4},(_,i)=>({
  contextId:'CTX-'+i,summary:'reviewed '+i,checks:[{classId:'ACCESS_CONTROL',
   assessment:'SUPPORTED',applicability:'APPLICABLE',anchors:[anchor],evidence:'guard condition number '+i}]
 }));
 assert.ok(!flow(packet,s).errors.some(x=>x.code==='REPEATED_EVIDENCE'));
});
test('attack schema, unit, flow coverage and path identity validation',()=>{
 const s=attackSubmission();s.schemaVersion='bad';has(attack(attackPacket,s),'SUBMISSION_SCHEMA');
 s.schemaVersion='curveyield-attack-submission-v1';s.unitId='X-002';has(attack(attackPacket,s),'UNIT_MISMATCH');
 s.unitId='X-001';s.attackPaths=[];has(attack(attackPacket,s),'FLOW_NOT_ATTACKED');
 s.attackPaths=attackSubmission().attackPaths;s.attackPaths[0].flowIds=['FLOW-9999'];
 has(attack(attackPacket,s),'UNKNOWN_FLOW');
 s.attackPaths=[attackSubmission().attackPaths[0],{...attackSubmission().attackPaths[0]}];
 has(attack(attackPacket,s),'PATH_DUPLICATE_ID');
});
test('attack goal, steps, role, anchors and blocked controls are validated',()=>{
 const s=attackSubmission(),p=s.attackPaths[0];
 p.goal=' ';has(attack(attackPacket,s),'GOAL_EMPTY');
 p.goal='Funds theft';p.steps=[];has(attack(attackPacket,s),'STEPS_EMPTY');
 p.steps=['Call the vault'];p.role='BAD_ROLE';has(attack(attackPacket,s),'ROLE_UNKNOWN');
 p.role='OTHER_ROLE';p.anchors=['contracts/A.sol:L21'];has(attack(attackPacket,s),'ANCHOR_INVALID');
 p.anchors=[];has(attack(attackPacket,s),'ANCHOR_REQUIRED');
 p.anchors=[anchor];p.blockingControl=' ';has(attack(attackPacket,s),'BLOCKING_CONTROL_MISSING');
});
test('viable and uncertain paths require candidate and simulation idea',()=>{
 for(const result of ['VIABLE','UNCERTAIN']){
  const s=attackSubmission(),p=s.attackPaths[0];p.result=result;delete p.blockingControl;
  has(attack(attackPacket,s),'CANDIDATE_REQUIRED');
  has(attack(attackPacket,s),'SIMULATION_IDEA_REQUIRED');
  p.candidate=candidate();p.simulationIdea={transactionSequence:['attacker writes a record'],oracle:'victim balance decreases'};
  assert.equal(attack(attackPacket,s).ok,true,JSON.stringify(attack(attackPacket,s).errors));
 }
});
test('integration questions enforce completeness, uniqueness, bounds and reasons',()=>{
 const s=attackSubmission();s.integrationAnswers=[];
 has(attack(attackPacket,s),'QUESTION_UNANSWERED');
 s.integrationAnswers=[{...attackSubmission().integrationAnswers[0],obligationId:'IOB-OTHER'}];
 has(attack(attackPacket,s),'QUESTION_EXTRA');
 s.integrationAnswers=[attackSubmission().integrationAnswers[0],attackSubmission().integrationAnswers[0]];
 has(attack(attackPacket,s),'QUESTION_DUPLICATE');
 s.integrationAnswers=[{...attackSubmission().integrationAnswers[0],reasoning:'none'}];
 has(attack(attackPacket,s),'REASONING_EMPTY');
 s.integrationAnswers=[{...attackSubmission().integrationAnswers[0],assessment:'CONCERN'}];
 has(attack(attackPacket,s),'CONCERN_WITHOUT_CANDIDATE');
});
test('the same blocking control on four different flows is rejected, three is accepted',()=>{
 const packet={unitId:'X-001',flowIds:['FLOW-0001','FLOW-0002','FLOW-0003','FLOW-0004'],integrationQuestions:[]};
 const s=attackSubmission();s.integrationAnswers=[];
 s.attackPaths=packet.flowIds.map((id,i)=>({...attackSubmission().attackPaths[0],pathId:'ATK-'+i,flowIds:[id]}));
 has(attack(packet,s),'REPEATED_BLOCKING_CONTROL');
 s.attackPaths[3].blockingControl='A different onchain access guard';
 assert.equal(attack(packet,s).ok,true,JSON.stringify(attack(packet,s).errors));
});
test('feedback text is bounded to 60 errors and includes repair instructions',()=>{
 const errors=Array.from({length:64},(_,i)=>({code:'ANCHOR_INVALID',path:'rows['+i+']',message:'bad'}));
 const msg=feedbackTextV1({ok:false,errors,value:null},{attempt:2,maxAttempts:3,submissionPath:'SUBMISSION_v1.json',unitId:'F-001'});
 assert.match(msg,/Discovery unit F-001 attempt 2\/3 failed validation/);
 assert.match(msg,/… 4 more/);
 assert.match(msg,/Repair only these items in SUBMISSION_v1.json/);
 assert.equal(msg.split('\n').length,63);
});

test('v13 requires correctness verdict and named decisive test for unresolved row',()=>{
 const packet={...flowPacket,reviewPolicy:'correctness-verdict-v13'};
 const submission={...flowSubmission(),rows:[{contextId:'CTX-A',intent:'Only authorized owner may change vault roles',
  reason:'The function reads and changes the owner with a required caller guard at B.sol L2',
  anchors:[anchor],specInspection:{status:'MATCH',docsAndCommentsChecked:'README and NatSpec inspected',
    namedConstantsChecked:'Named constants inspected'},documentedRules:[]}]};
 has(flow(packet,submission),'VERDICT_REQUIRED');
 submission.rows[0].verdict='UNRESOLVED';
 has(flow(packet,submission),'UNRESOLVED_TEST_REQUIRED');
 submission.rows[0].decidingTest={name:'owner writes',expectedObservation:'Nonowner write reverts with Unauthorized'};
 assert.equal(flow(packet,submission).ok,true,JSON.stringify(flow(packet,submission).errors));
 submission.rows[0].verdict='CORRECT';
 assert.equal(flow(packet,submission).ok,true,JSON.stringify(flow(packet,submission).errors));
});
test('v13 class checklist is never accepted as a correctness verdict',()=>{
 const packet={...flowPacket,reviewPolicy:'correctness-verdict-v13'};
 const sub=flowSubmission();
 has(flow(packet,sub),'VERDICT_REQUIRED');
 has(flow(packet,sub),'INTENT_REQUIRED');
 has(flow(packet,sub),'REASON_REQUIRED');
});
test('v13 storage initializer cannot be covered by trivialReviews',()=>{
 const packet={...flowPacket,reviewPolicy:'correctness-verdict-v13',primaryContexts:[
   {contextId:'CTX-A',qualifiedContainer:'contracts/A.sol:A',kind:'STATE_INITIALIZER'}
  ],trivialContextIds:[]};
 const sub={...flowSubmission(),rows:[],trivialReviews:[
   {contract:'contracts/A.sol:A',reason:'assumed trivial state initializer'}
  ]};
 has(flow(packet,sub),'TRIVIAL_CONTRACT_UNKNOWN');
 has(flow(packet,sub),'MISSING_CONTEXT');
});

test('v13 requires each packet NatSpec and literal rule to be compared, and sibling asymmetry checked',()=>{
 const packet={...flowPacket,reviewPolicy:'correctness-verdict-v13',
  documentationItems:[{contextId:'CTX-A',ruleId:'NATSPEC:CTX-A',rule:'Only owner may set fee'}],
  siblingChecks:[{pattern:'owner guard',members:[{contract:'contracts/A.sol:A',name:'setFee'},
    {contract:'contracts/A.sol:A',name:'setLimit'}]}],
  primaryContexts:[{contextId:'CTX-A',qualifiedContainer:'contracts/A.sol:A'}]};
 const sub={...flowSubmission(),rows:[{contextId:'CTX-A',verdict:'CORRECT',
  intent:'Only owner should change the fee and setter must apply declared fee limits',
  reason:'Only owner modifier validates signer before fee setter B.sol L3',
  anchors:[anchor],documentedRules:[],specInspection:{status:'NO_DOCUMENTED_RULES',
    docsAndCommentsChecked:'README reviewed',namedConstantsChecked:'No named constants found'}}]};
 has(flow(packet,sub),'SPEC_FALSE_ABSENCE');
 has(flow(packet,sub),'SPEC_RULE_MISSING');
 has(flow(packet,sub),'SIBLING_CHECK_REQUIRED');
 sub.rows[0].documentedRules=[{ruleId:'NATSPEC:CTX-A',rule:'Only owner may set fee',
   comparison:'MATCH',reason:'onlyOwner checks msg.sender'}];
 sub.rows[0].specInspection.status='MATCH';
 sub.rows[0].siblingComparisons=[{sibling:'setLimit',comparison:'Both check owner; no fee-limit asymmetry'}];
 assert.equal(flow(packet,sub).ok,true,JSON.stringify(flow(packet,sub).errors));
});

test('v13 DEFECT accepts inline, row-local or linked candidate without throwing',()=>{
 const packet={...flowPacket,reviewPolicy:'correctness-verdict-v13'};
 const row={contextId:'CTX-A',verdict:'DEFECT',
   intent:'Unauthorized callers must not move protected funds',
   reason:'The state change executes before the caller authorization guard',
   anchors:[anchor],specInspection:{status:'MISMATCH',
     docsAndCommentsChecked:'README and NatSpec reviewed',
     namedConstantsChecked:'Relevant constants checked'},documentedRules:[]};
 for(const flavor of ['inline','row','linked']){
   const s={...flowSubmission(),rows:[{...row}],candidates:[]};
   if(flavor==='inline')s.rows[0].candidate=candidate();
   if(flavor==='row')s.rows[0].candidates=[candidate()];
   if(flavor==='linked'){s.rows[0].candidateTempKey='C-001';s.candidates=[candidate()];}
   const result=flow(packet,s);
   assert.equal(result.ok,true,flavor+': '+JSON.stringify(result.errors));
 }
});
