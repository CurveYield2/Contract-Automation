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
  assert.equal(started.wake.chatKey,'reviewer-2');
  const a=packet(o,'F-001');assert.equal(a.primaryContexts[0].contextId,'CTX-A');
  submit(o,'F-001',validReview(a));
  const next=advanceDiscoveryV1({...o,unitId:'F-001'});
  assert.equal(next.status,'DISCOVERY_NEXT');
  assert.equal(next.wake.chatKey,'reviewer-2');
  submit(o,'R-001',validReview(packet(o,'R-001')));
  const attacker=advanceDiscoveryV1({...o,unitId:'R-001'});
  assert.equal(attacker.status,'DISCOVERY_NEXT');
  assert.equal(attacker.wake.chatKey,'reviewer-3L');
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
  assert.equal(advanceDiscoveryV1({...o,unitId:'R-001'}).status,'DISCOVERY_STALE_REQUEST');
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
  assert.equal(third.status,'DISCOVERY_NEXT');
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
