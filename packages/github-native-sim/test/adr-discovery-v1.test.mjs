import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {startDiscoveryV1,advanceDiscoveryV1,buildDiscoverySummaryV1,
 discoveryWakeMessageV1} from '../src/adr-discovery-v1.mjs';
import {writeJson,repoFile,readJson} from '../../../scripts/lib/lite-phase-work-v1.mjs';
const repoRoot=fileURLToPath(new URL('../../../',import.meta.url));
const campaignPath='campaigns/demo',directory={campaignId:'demo-r1',campaignGenerationId:'demo-r1-g1',
 campaignName:'Demo',sourceSha256:'a'.repeat(64)};
const c=id=>({contextId:'CTX-'+id,symbolId:'SYM-'+id,path:'contracts/'+id+'.sol',
 qualifiedContainer:'contracts/'+id+'.sol:'+id,kind:'FUNCTION',
 canonicalSignature:'run()',lineStart:2,lineEnd:9,visibility:'public',
 effectiveIn:['contracts/'+id+'.sol:'+id],scopeTier:'IN_SCOPE'});
const contexts=[c('A'),c('B'),c('C')];
const inventory={schemaVersion:'curveyield-review-inventory-v1',campaignId:directory.campaignId,
 campaignGenerationId:directory.campaignGenerationId,sourceSha256:directory.sourceSha256,
 payload:{sourceUnits:[...contexts.map(x=>({path:x.path,scopeTier:'IN_SCOPE',lineCount:20}))],
 contexts,triggers:Object.fromEntries(contexts.map(x=>[x.contextId,['STATE_WRITE']]))}};
const plan={payload:{
 flows:[{flowId:'FLOW-0001',entryContextId:'CTX-A',contexts:['CTX-A','CTX-B'],contracts:[contexts[0].qualifiedContainer,contexts[1].qualifiedContainer],crossContract:true,depthLimited:false}],
 clusters:[{clusterId:'CL-001',contracts:contexts.map(x=>x.qualifiedContainer),flowIds:['FLOW-0001']}],
 reviewUnits:[
 {unitId:'F-001',role:'FLOW_REVIEW',clusterId:'CL-001',flowIds:['FLOW-0001'],primaryContextIds:['CTX-A'],readContextIds:['CTX-A','CTX-B']},
 {unitId:'R-001',role:'RESIDUAL_REVIEW',primaryContextIds:['CTX-B','CTX-C'],readContextIds:['CTX-A','CTX-B','CTX-C']}],
 attackUnits:[{unitId:'X-001',role:'ATTACK',clusterId:'CL-001',flowIds:['FLOW-0001'],
 contracts:contexts.map(x=>x.qualifiedContainer),integrationQuestionIds:['IOB-0001']}],
 integrationQuestions:[{obligationId:'IOB-0001',clusterId:'CL-001',kind:'CROSS_CONTRACT_CALL',
 contracts:[contexts[0].qualifiedContainer,contexts[1].qualifiedContainer],contextIds:['CTX-A'],evidence:[],
 question:'Check authorization across contracts'}],gaps:[]}};
const facts={payload:{guardTable:[],crossContractEdges:[],dependencyEdges:[],siblingGroups:[],valueFlows:[]}};
function setup(withPlan=true) {
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'adr-discovery-test-'));
 for(const [name,obj] of [['REVIEW_INVENTORY_v1.json',inventory],['SYSTEM_FACTS_v1.json',facts],...(withPlan?[['FLOW_PLAN_v1.json',plan]]:[])])
  writeJson(repoFile(root,campaignPath+'/evidence/review-inventory/'+name),obj);
 return {root,campaignPath,directory,authorityRoot:'Audit Skill - Current Authority/Audit_Litemode_v12',
 automationRoot:repoRoot,now:'2026-10-12T12:00:00.000Z'};
}
function packet(opts,id){
 return readJson(repoFile(opts.root,opts.campaignPath+'/work/phase-04/discovery/'+id+'/ASSIGNMENT_PACKET_v1.json')).payload;
}
function submit(opts,id,row){
 writeJson(repoFile(opts.root,opts.campaignPath+'/work/phase-04/discovery/'+id+'/SUBMISSION_v1.json'),row);
}
const anchor='contracts/B.sol:L2-L4';
const check=(classId,assessment='SUPPORTED')=>({classId,assessment,
 applicability:assessment==='NOT_APPLICABLE'?'NOT_APPLICABLE':'APPLICABLE',
 evidence:'Security guard enforces the intended authorization',anchors:[anchor]});
function validReview(packet){
 const rows=packet.primaryContexts.map(x=>({
  contextId:x.contextId,summary:'The entry is protected by explicit guard calls',
  checks:packet.requiredClasses[x.contextId].map(k=>check(k))}));
 return {schemaVersion:'curveyield-flow-review-submission-v1',unitId:packet.unitId,rows,
  flowNotes:packet.flowIds.map(flowId=>({flowId,note:'The flow moves access and state from A through B',anchors:[anchor]})),
  candidates:[]};
}
function validAttack(packet){
 return {schemaVersion:'curveyield-attack-submission-v1',unitId:packet.unitId,
  attackPaths:packet.flowIds.map((flowId,i)=>({pathId:'ATK-'+i,flowIds:[flowId],
   goal:'Extract assets',role:'UNPRIVILEGED_CALLER',steps:['Try unauthorized write'],
   anchors:[anchor],result:'BLOCKED',blockingControl:'onlyOwner checks the sender'})),
  integrationAnswers:packet.integrationQuestionIds.map(obligationId=>({obligationId,assessment:'SUPPORTED',
   reasoning:'Caller gate prevents an unprivileged write',anchors:[anchor]}))};
}
test('start, F->R->X routing, sealed packet independence and completion',()=>{
 const o=setup();
 try{
  const started=startDiscoveryV1(o);
  assert.equal(started.state.payload.activeUnitId,'F-001');
  // Reviewer-2 and the attacker start their windows in parallel.
  assert.deepEqual(started.wakes.map(w=>w.chatKey),['reviewer-2','reviewer-3L']);
  const a=packet(o,'F-001');assert.equal(a.primaryContexts[0].contextId,'CTX-A');
  submit(o,'F-001',validReview(a));
  // F-001 and R-001 form one reviewer-2 window: accepting F-001 alone needs no wake.
  assert.ok(fs.existsSync(repoFile(o.root,'campaigns/demo/work/phase-04/discovery/R-001/ASSIGNMENT_PACKET_v1.json')));
  const next=advanceDiscoveryV1({...o,unitId:'F-001'});
  assert.equal(next.status,'DISCOVERY_PARTIAL');
  assert.equal(next.wake,null);
  submit(o,'R-001',validReview(packet(o,'R-001')));
  const reviewerDone=advanceDiscoveryV1({...o,unitId:'R-001'});
  assert.equal(reviewerDone.status,'DISCOVERY_PARTIAL');
  assert.equal(reviewerDone.wakes.length,0);
  const x=packet(o,'X-001');
  assert.equal(JSON.stringify(x).includes('hypotheses'),false);
  assert.equal(JSON.stringify(x).includes('work/phase-03'),false);
  assert.equal(JSON.stringify(x).includes('reviewer-2 work'),false);
  submit(o,'X-001',validAttack(x));
  const finished=advanceDiscoveryV1({...o,unitId:'X-001'});
  assert.equal(finished.status,'DISCOVERY_COMPLETE');
  const state=readJson(repoFile(o.root,'campaigns/demo/work/phase-04/discovery/DISCOVERY_STATE_v1.json'));
  assert.equal(state.payload.status,'COMPLETE');
  const stored=readJson(repoFile(o.root,'campaigns/demo/work/phase-04/discovery/DISCOVERY_SUMMARY_v1.json'));
  assert.ok(stored.payload.coverage);
 }finally{fs.rmSync(o.root,{force:true,recursive:true});}
});
test('stale id and missing submission do not modify state or consume attempts',()=>{
 const o=setup();try{
  startDiscoveryV1(o);
  const file=repoFile(o.root,'campaigns/demo/work/phase-04/discovery/DISCOVERY_STATE_v1.json');
  const before=fs.readFileSync(file,'utf8');
  assert.equal(advanceDiscoveryV1({...o,unitId:'X-999'}).status,'DISCOVERY_STALE_REQUEST');
  assert.equal(fs.readFileSync(file,'utf8'),before);
  assert.equal(advanceDiscoveryV1({...o,unitId:'F-001'}).status,'DISCOVERY_REWORK');
  assert.equal(fs.readFileSync(file,'utf8'),before);
 }finally{fs.rmSync(o.root,{force:true,recursive:true});}
});
test('bad submissions are bounded, repeated bytes never increase attempt count',()=>{
 const o=setup();try{
  startDiscoveryV1(o);
  const file=repoFile(o.root,'campaigns/demo/work/phase-04/discovery/DISCOVERY_STATE_v1.json');
  submit(o,'F-001',{schemaVersion:'bad',unitId:'F-001',rows:[]});
  assert.equal(advanceDiscoveryV1({...o,unitId:'F-001'}).status,'DISCOVERY_REWORK');
  assert.equal(advanceDiscoveryV1({...o,unitId:'F-001'}).status,'DISCOVERY_REWORK');
  assert.equal(readJson(file).payload.units['F-001'].attempts,1);
  submit(o,'F-001',{schemaVersion:'other',unitId:'F-001',rows:[]});
  assert.equal(advanceDiscoveryV1({...o,unitId:'F-001'}).status,'DISCOVERY_REWORK');
  submit(o,'F-001',{schemaVersion:'third',unitId:'F-001',rows:[]});
  const third=advanceDiscoveryV1({...o,unitId:'F-001'});
  assert.equal(third.status,'DISCOVERY_PARTIAL');
  const state=readJson(file);
  assert.equal(state.payload.units['F-001'].status,'GAP_RECORDED');
  assert.ok(state.payload.gaps.some(x=>x.code==='VALIDATION_ATTEMPTS_EXHAUSTED'&&x.contextId==='CTX-A'));
 }finally{fs.rmSync(o.root,{force:true,recursive:true});}
});
test('cross-check contradictions and not-applicable claims are preserved',()=>{
 const o=setup();try{
  const state={...directory,generatedAt:o.now,payload:{gaps:[]}};
  const review={unitId:'F-001',submission:{rows:[{contextId:'CTX-A',checks:[
   {...check('ACCESS_CONTROL'),assessment:'SUPPORTED'},
   {...check('STATE_MACHINE'),assessment:'NOT_APPLICABLE'}]}],candidates:[]}};
  const attack={unitId:'X-001',submission:{attackPaths:[{
   pathId:'ATK-001',result:'VIABLE',anchors:['contracts/A.sol:L2-L4'],
   goal:'Unauthorized transfer',candidate:{classId:'ACCESS_CONTROL',description:'Escalation of authority',title:'Unauthorized write'}
  }],integrationAnswers:[]}};
  const taxonomy={classes:[{classId:'ACCESS_CONTROL',triggers:['STATE_WRITE'],testRequired:true},
   {classId:'STATE_MACHINE',triggers:['STATE_WRITE'],testRequired:true}]};
  const sum=buildDiscoverySummaryV1({state,inventory,plan,acceptedSubmissions:[review,attack],taxonomy,now:o.now});
  assert.ok(sum.payload.reconciliationItems.some(x=>x.origin==='ATTACK_CONTRADICTS_REVIEW'));
  assert.ok(sum.payload.notApplicableClaims.some(x=>x.classId==='STATE_MACHINE'));
 }finally{fs.rmSync(o.root,{force:true,recursive:true});}
});
test('missing flow plan ends with typed incomplete gap',()=>{
 const o=setup(false);try{
  const start=startDiscoveryV1(o);assert.equal(start.completeImmediately,true);
  assert.equal(start.state.payload.status,'COMPLETE');
  assert.equal(start.state.payload.gaps[0].code,'INVENTORY_INCOMPLETE');
 }finally{fs.rmSync(o.root,{force:true,recursive:true});}
});
test('wake includes precise URLs and X restrictions',()=>{
 const text=discoveryWakeMessageV1({directory,auditControllerRef:'main',packetPath:'campaigns/demo/ASSIGNMENT_PACKET_v1.json',
  submissionPath:'campaigns/demo/SUBMISSION_v1.json',instructionsPath:'Audit_Litemode_v12/discovery/ATTACKER_START_HERE.md',
  unitId:'X-001',role:'ATTACK',attempt:2});
 assert.match(text,/You are the attacker reviewer/);assert.match(text,/reviewKind":"discovery"/);
 assert.match(text,/Do not open work\/phase-03\//);
});
test('reviewer and attacker windows run in parallel and the last one to finish completes discovery',()=>{
 const o=setup();
 try{
  startDiscoveryV1(o);
  const x=packet(o,'X-001');
  submit(o,'X-001',validAttack(x));
  // The attacker finishes first; reviewer-2 is still working, so discovery is not complete.
  const attackerDone=advanceDiscoveryV1({...o,unitId:'X-001'});
  assert.equal(attackerDone.status,'DISCOVERY_PARTIAL');
  submit(o,'F-001',validReview(packet(o,'F-001')));
  submit(o,'R-001',validReview(packet(o,'R-001')));
  assert.equal(advanceDiscoveryV1({...o,unitId:'F-001'}).status,'DISCOVERY_COMPLETE');
 }finally{fs.rmSync(o.root,{force:true,recursive:true});}
});

test('v13 correctness verdicts keep class coverage and row-local candidates without a graded checklist',()=>{
 const state={...directory,generatedAt:'2026-10-14T00:00:00Z',payload:{gaps:[],reviewPolicy:'correctness-verdict-v13'}};
 const review={unitId:'F-001',submission:{rows:[
  {contextId:'CTX-A',verdict:'DEFECT',reason:'State update violates spec',anchors:['contracts/A.sol:L2'],
   candidates:[{tempKey:'V13-CAND',title:'Broken state update',description:'The update exceeds the declared limit',anchors:['contracts/A.sol:L2']}]},
  {contextId:'CTX-B',verdict:'CORRECT',reason:'Consistent role checks',anchors:['contracts/B.sol:L2']},
  {contextId:'CTX-C',verdict:'UNRESOLVED',reason:'Decisive limit test required',anchors:['contracts/C.sol:L2']}
 ]}};
 const taxonomy={classes:[{classId:'STATE_MACHINE',triggers:['STATE_WRITE'],testRequired:true}]};
 const result=buildDiscoverySummaryV1({state,inventory,plan,acceptedSubmissions:[review],taxonomy});
 assert.equal(result.payload.perContext['CTX-A'].STATE_MACHINE,'CONCERN');
 assert.equal(result.payload.perContext['CTX-B'].STATE_MACHINE,'SUPPORTED');
 assert.equal(result.payload.perContext['CTX-C'].STATE_MACHINE,'UNRESOLVED');
 assert.ok(result.payload.reconciliationItems.some(x=>x.origin==='REVIEWER_CANDIDATE'&&
   x.contextIds.includes('CTX-A')));
 assert.ok(result.payload.reconciliationItems.some(x=>x.origin==='REVIEWER_UNRESOLVED'&&
   x.contextIds.includes('CTX-C')));
});
test('v13 discovery state routes independent attacker to reviewer-3, while v12 keeps reviewer-3L',()=>{
 const o=setup();
 try{
  const a=startDiscoveryV1({...o,authorityRoot:'Audit Skill - Current Authority/Audit_Litemode_v13',qualificationVerifier:()=>({status:'QUALIFIED'})});
  assert.equal(a.state.payload.reviewPolicy,'correctness-verdict-v13');
  assert.equal(a.state.payload.units['X-001'].chatKey,'reviewer-3');
  assert.ok(a.wakes.some(w=>w.chatKey==='reviewer-3'));
 }finally{fs.rmSync(o.root,{recursive:true,force:true});}
});

test('200-unit v13 discovery window uses bounded index pages and one wake below 8 KiB',()=>{
 const o={...setup(),authorityRoot:'Audit Skill - Current Authority/Audit_Litemode_v13'};
 try{
  const many=structuredClone(plan);
  many.payload.reviewUnits=Array.from({length:200},(_,i)=>({
   unitId:'R-'+String(i+1).padStart(3,'0'),role:'RESIDUAL_REVIEW',
   primaryContextIds:['CTX-A'],readContextIds:['CTX-A']
  }));
  many.payload.attackUnits=[];
  writeJson(repoFile(o.root,o.campaignPath+'/evidence/review-inventory/FLOW_PLAN_v1.json'),many);
  const result=startDiscoveryV1(o);
  assert.equal(result.wakes.length,1);
  assert.ok(Buffer.from(result.wakes[0].messageB64,'base64').length<8192);
  const indexRel=o.campaignPath+'/work/phase-04/discovery/index/flow-review/INDEX_v1.json';
  const index=readJson(repoFile(o.root,indexRel));
  assert.equal(index.unitCount,200);
  assert.equal(index.pages.length,8);
  let count=0;
  for(const page of index.pages){
    const file=repoFile(o.root,page.path);
    assert.ok(fs.statSync(file).size<=32*1024);
    const body=readJson(file);
    assert.equal(body.units.length,25);
    count+=body.units.length;
  }
  assert.equal(count,200);
 }finally{fs.rmSync(o.root,{force:true,recursive:true});}
});

test('v12 discovery with forty-five real packet slots preserves folder wake and no v13 index',()=>{
 const o=setup();
 try{
   const ids=Array.from({length:45},(_,i)=>'F-'+String(i+1).padStart(3,'0'));
   const plan0=readJson(repoFile(o.root,campaignPath+'/evidence/review-inventory/FLOW_PLAN_v1.json'));
   plan0.payload.reviewUnits=ids.map(unitId=>({unitId,role:'FLOW_REVIEW',clusterId:'CL-001',
     flowIds:['FLOW-0001'],primaryContextIds:['CTX-A'],readContextIds:['CTX-A']}));
   plan0.payload.attackUnits=[];
   writeJson(repoFile(o.root,campaignPath+'/evidence/review-inventory/FLOW_PLAN_v1.json'),plan0);
   const result=startDiscoveryV1(o);
   const wake=Buffer.from(result.wakes[0].messageB64,'base64').toString('utf8');
   assert.doesNotMatch(wake,/Complete assignment index:/);
   assert.match(wake,/Discovery folder:/);
   assert.equal(fs.existsSync(repoFile(o.root,campaignPath+'/work/phase-04/discovery/index/flow-review/INDEX_v1.json')),false);
 }finally{fs.rmSync(o.root,{force:true,recursive:true});}
});
