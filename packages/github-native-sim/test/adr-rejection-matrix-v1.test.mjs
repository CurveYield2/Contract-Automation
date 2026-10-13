import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import solc from 'solc';
import {createHash} from 'node:crypto';
import {buildFlowPlanV1} from '../src/adr-flow-plan-v1.mjs';
import {buildReviewInventoryV1,writeReviewInventoryOutputsV1} from '../src/adr-review-inventory-v1.mjs';
import {validateFlowReviewSubmissionV1,validateAttackSubmissionV1} from '../src/adr-discovery-validators-v1.mjs';
import {startDiscoveryV1,advanceDiscoveryV1,buildDiscoverySummaryV1,buildUnitPacketV1} from '../src/adr-discovery-v1.mjs';
import {deriveBaselineObligationsV1} from '../src/adr-baseline-obligations-v1.mjs';
import {validatePhase6AttackerWorkV1,validatePhase8LinkageV1,validatePhase10CoverageLabelV1} from '../src/adr-phase-validation-v1.mjs';
import {detectionPolicyForAuthorityV1} from '../src/adr-policy-v1.mjs';
import {resolveFrozenAuthorityFileV1} from '../src/adr-frozen-authority-v1.mjs';
import {scoreQualificationV1} from '../src/adr-detection-qualification-v1.mjs';
import {repoFile,writeJson,readJson} from '../../../scripts/lib/lite-phase-work-v1.mjs';

const repoRoot=fileURLToPath(new URL('../../../',import.meta.url));
const fixtureRoot=fileURLToPath(new URL('./fixtures/adr-inventory/',import.meta.url));
const campaign={campaignId:'qualification-fixture',campaignGenerationId:'qualification-fixture-g1',sourceSha256:'a'.repeat(64),generatedAt:'2026-10-12T00:00:00.000Z'};
const contract=n=>'contracts/'+n+'.sol:'+n;
const ctx=(n,i=1,extra={})=>({contextId:'CTX-'+n+'-'+i,symbolId:'SYM-'+n+'-'+i,path:'contracts/'+n+'.sol',qualifiedContainer:contract(n),kind:'FUNCTION',canonicalSignature:'run'+i+'()',visibility:'external',lineStart:2,lineEnd:9,effectiveIn:[contract(n)],scopeTier:'IN_SCOPE',internalCalls:[],dependencySymbolIds:[],externalCalls:[],...extra});
function flowInputs(contexts,edges=[]){
 const triggers=Object.fromEntries(contexts.map(c=>[c.contextId,c.visibility==='external'?['STATE_WRITE_EXTERNAL']:[]]));
 return {inventory:{schemaVersion:'curveyield-review-inventory-v1',...campaign,payload:{contexts,sourceUnits:contexts.map(c=>({path:c.path,scopeTier:'IN_SCOPE',lineCount:15})),triggers,complete:true}},facts:{payload:{crossContractEdges:edges,dependencyEdges:[],siblingGroups:[],guardTable:[],valueFlows:[]}}};
}
const edge=(a,b)=>({fromContextId:'CTX-'+a+'-1',fromContract:contract(a),toType:contract(b),memberName:'run1',line:3});
function temp(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'adr-rejection-'));
 const campaignPath='campaigns/synthetic';
 const put=(rel,value)=>writeJson(repoFile(root,campaignPath+'/'+rel),value);
 const clean=()=>fs.rmSync(root,{recursive:true,force:true});
 return {root,campaignPath,put,clean};
}
const srcInventory={payload:{sourceUnits:[{path:'contracts/A.sol',scopeTier:'IN_SCOPE',lineCount:15},{path:'contracts/B.sol',scopeTier:'IN_SCOPE',lineCount:15}]}};
const anchor='contracts/B.sol:L2-L4';
const check=(assessment='SUPPORTED')=>({classId:'ACCESS_CONTROL',assessment,applicability:'APPLICABLE',evidence:'The onlyOwner guard prevents the unauthorized caller',anchors:[anchor]});
const reviewPacket=(ids=['CTX-A'])=>({unitId:'F-001',primaryContexts:ids.map(contextId=>({contextId})),requiredClasses:Object.fromEntries(ids.map(id=>[id,['ACCESS_CONTROL']])),flows:[],flowIds:[]});
const reviewSubmission=(ids=['CTX-A'])=>({schemaVersion:'curveyield-flow-review-submission-v1',unitId:'F-001',flowNotes:[],rows:ids.map(contextId=>({contextId,summary:'Reviewed external authorization',checks:[check()]})),candidates:[]});
const flowReview=(packet,submission)=>validateFlowReviewSubmissionV1({packet,submission,inventory:srcInventory});
const attackPacket={unitId:'X-001',flowIds:['FLOW-0001'],integrationQuestions:[],integrationQuestionIds:[]};
const attackSubmission=()=>({schemaVersion:'curveyield-attack-submission-v1',unitId:'X-001',attackPaths:[{pathId:'ATK-1',flowIds:['FLOW-0001'],goal:'Steal vault assets',role:'UNPRIVILEGED_CALLER',steps:['Call the vault from nonowner'],anchors:[anchor],result:'BLOCKED',blockingControl:'onlyOwner blocks this sender'}],integrationAnswers:[]});
const attack=(packet,submission)=>validateAttackSubmissionV1({packet,submission,inventory:srcInventory});
const hasCode=(result,code)=>assert.ok(result.errors.some(row=>row.code===code),code+' missing: '+JSON.stringify(result.errors));
const tierClass=(classId,trigger)=>({classId,title:classId,triggers:[trigger],testRequired:true,testMethod:'FOUNDRY_PROPERTY',reviewChecks:['Inspect exact source effect']});
const baselineTaxonomy={classes:[tierClass('ACCESS_CONTROL','STATE_WRITE'),tierClass('ACCOUNTING_MATH','ARITHMETIC_ON_STATE')]};
const baseInventory={...campaign,payload:{contexts:[ctx('Vault',1,{contextId:'CTX-1',path:'Vault.sol',qualifiedContainer:'Vault.sol:Vault',effectiveIn:['Vault.sol:Vault']})],triggers:{'CTX-1':['STATE_WRITE','ARITHMETIC_ON_STATE']}}};
const baseline=(summary={payload:{}})=>deriveBaselineObligationsV1({inventory:baseInventory,taxonomy:baselineTaxonomy,summary});
function p6Fixture(){
 const t=temp(),base='controller/automation/run1/ASSERTION_LEDGER_v1.json';
 const ledger={schemaVersion:'curveyield-assertion-ledger-v1',parseStatus:'PARSED',toolInvoked:true,tests:[{name:'Vault::property',status:'PASS'},{name:'Vault::attack',status:'PASS'},{name:'Vault::control',status:'PASS'}]};
 t.put('controller/phase6-tests/TG-001/r1.json',{schemaVersion:'v7'});
 t.put('controller/phase6-tests/CP-1/r1.json',{schemaVersion:'v7'});
 t.put(base,ledger);
 const common=dir=>({requestDirectory:dir,dispatchRounds:1,requestPaths:[dir+'r1.json'],harnessDesign:'Run correct onchain actor'});
 const form={actions:{'step-4':{outputs:{baselineTestRecords:[{testGroupId:'TG-001',contract:'Vault',obligationIds:['BOB-0001'],...common('controller/phase6-tests/TG-001/'),obligationOutcomes:[{obligationId:'BOB-0001',outcome:'PASSED',ledgerRef:base,assertionNames:['Vault::property']}]}]}},
  'step-5':{outputs:{candidateProofRecords:[{candidateKey:'CP-1',phase5Result:'NOT_REPRODUCED',...common('controller/phase6-tests/CP-1/'),verdict:'DISPROVEN',ledgerRef:base,attackAssertionNames:['Vault::attack'],controlAssertionNames:['Vault::control'],reasoning:'The owner-only gate blocks attacker actions'}],newCandidateRecords:['NONE_IDENTIFIED']}}}};
 return {...t,form,ledger,ledgerPath:base,run:()=>validatePhase6AttackerWorkV1({root:t.root,campaignPath:t.campaignPath,form})};
}
function discoveryFixture(n=3,includeAttack=true){
 const t=temp(),contexts=Array.from({length:n},(_,i)=>ctx('C'+i,1,{contextId:'CTX-'+i}));
 const inventory={...campaign,payload:{sourceUnits:contexts.map(c=>({path:c.path,scopeTier:'IN_SCOPE',lineCount:15})),contexts,triggers:Object.fromEntries(contexts.map(c=>[c.contextId,['STATE_WRITE']]))}};
 const flowIds=['FLOW-0001'],flows=[{flowId:'FLOW-0001',entryContextId:'CTX-0',contexts:['CTX-0'],contracts:[contract('C0')],crossContract:false}];
 const reviewUnits=contexts.map((c,i)=>({unitId:'R-'+String(i+1).padStart(3,'0'),role:'RESIDUAL_REVIEW',primaryContextIds:[c.contextId],readContextIds:[c.contextId],flowIds:[]}));
 const attackUnits=includeAttack?[{unitId:'X-001',role:'ATTACK',clusterId:'CL-001',flowIds,contracts:[contract('C0')],integrationQuestionIds:[]}]:[];
 const plan={payload:{flows,clusters:[{clusterId:'CL-001',contracts:[contract('C0')],flowIds}],reviewUnits,attackUnits,integrationQuestions:[],gaps:[]}};
 t.put('evidence/review-inventory/REVIEW_INVENTORY_v1.json',inventory);
 t.put('evidence/review-inventory/SYSTEM_FACTS_v1.json',{payload:{guardTable:[],crossContractEdges:[],dependencyEdges:[],siblingGroups:[],valueFlows:[]}});
 t.put('evidence/review-inventory/FLOW_PLAN_v1.json',plan);
 const o={...t,directory:{...campaign,campaignName:'Synthetic'},authorityRoot:'Audit Skill - Current Authority/Audit_Litemode_v12',automationRoot:repoRoot,now:campaign.generatedAt};
 const packet=id=>readJson(repoFile(t.root,t.campaignPath+'/work/phase-04/discovery/'+id+'/ASSIGNMENT_PACKET_v1.json')).payload;
 const submit=(id,value)=>t.put('work/phase-04/discovery/'+id+'/SUBMISSION_v1.json',value);
 return {...o,inventory,plan,packet,submit};
}
function validUnit(packet){
 const anchor='contracts/C0.sol:L2-L4';
 return {schemaVersion:'curveyield-flow-review-submission-v1',unitId:packet.unitId,flowNotes:packet.flowIds.map(flowId=>({flowId,note:'Inspected all linked execution paths',anchors:[anchor]})),rows:packet.primaryContexts.map(context=>({contextId:context.contextId,summary:'Owner-only entry inspected',checks:packet.requiredClasses[context.contextId].map(classId=>({classId,assessment:'SUPPORTED',applicability:'APPLICABLE',evidence:'Explicit owner authorization blocks the attack',anchors:[anchor]}))})),candidates:[]};
}
let compiledInventoryPromise;
async function compiled(){
 if(!compiledInventoryPromise)compiledInventoryPromise=(async()=>{
   const sources={};
   const scan=dir=>{for(const x of fs.readdirSync(dir,{withFileTypes:true})){const full=path.join(dir,x.name);if(x.isDirectory())scan(full);else if(x.name.endsWith('.sol'))sources[path.relative(fixtureRoot,full).replaceAll(path.sep,'/')]={content:fs.readFileSync(full,'utf8')};}};
   scan(fixtureRoot);
   // Compilation is performed only inside the GitHub Actions CI runner, not locally.
   const out=JSON.parse(solc.compile(JSON.stringify({language:'Solidity',sources,settings:{outputSelection:{'*':{'*':['abi'],'':['ast']}}}})));
   assert.deepEqual((out.errors??[]).filter(x=>x.severity==='error'),[]);
   const sourceAsts=Object.fromEntries(Object.entries(out.sources??{}).map(([k,v])=>[k,v.ast]));
   return buildReviewInventoryV1({projectRoot:fixtureRoot,build:{sourceAsts,artifacts:[]},campaign});
 })();
 return compiledInventoryPromise;
}

// Row 01
test('A to B to C external calls remain one flow, cluster and attacker unit',()=>{
 const c=['A','B','C'].map(n=>ctx(n));
 const input=flowInputs(c,[edge('A','B'),edge('B','C')]);
 input.inventory.payload.triggers={'CTX-A-1':['EXTERNAL_CALL'],'CTX-B-1':[],'CTX-C-1':[]};
 const p=buildFlowPlanV1({...input,limits:{maxPrimaryContextsPerUnit:1,maxFlowDepth:8,maxIntegrationQuestionsPerAttackUnit:15}}).payload;
 assert.equal(p.flows.length,1);
 assert.deepEqual(p.flows[0].contexts,['CTX-A-1','CTX-B-1','CTX-C-1']);
 assert.equal(p.clusters.length,1);
 assert.equal(p.attackUnits.length,1);
 assert.equal(new Set(p.reviewUnits.flatMap(x=>x.flowIds)).size,1);
});
// Row 02
test('30 contracts with only two accepted units end as PARTIAL_COVERAGE and release Phase 4',()=>{
 const o=discoveryFixture(30,false);
 try{
   startDiscoveryV1(o);
   let last;
   for(let i=0;i<30;i++){
     const id='R-'+String(i+1).padStart(3,'0');
     for(let attempt=1;attempt<=(i<2?1:3);attempt++){
       const submission=i<2?validUnit(o.packet(id)):{schemaVersion:'invalid-'+attempt,unitId:id,rows:[]};
       o.submit(id,submission);
       last=advanceDiscoveryV1({...o,unitId:id});
       if(i>=2&&attempt<3)assert.equal(last.status,'DISCOVERY_REWORK');
     }
   }
   assert.equal(last.status,'DISCOVERY_COMPLETE');
   assert.equal(last.wake.phaseId,'phase-4');
   const state=readJson(repoFile(o.root,o.campaignPath+'/work/phase-04/discovery/DISCOVERY_STATE_v1.json')).payload;
   assert.equal(state.gaps.filter(x=>x.code==='VALIDATION_ATTEMPTS_EXHAUSTED').length,28);
   const summary=readJson(repoFile(o.root,o.campaignPath+'/work/phase-04/discovery/DISCOVERY_SUMMARY_v1.json'));
   assert.equal(summary.payload.coverage.label,'PARTIAL_COVERAGE');
 }finally{o.clean();}
});
// Row 03
test('internal and private functions remain inventoried with triggers',async()=>{
 const inventory=await compiled();
 const helpers=inventory.payload.contexts.filter(x=>['internal','private'].includes(x.visibility));
 assert.ok(helpers.length>0);
 assert.ok(helpers.every(x=>Array.isArray(inventory.payload.triggers[x.contextId])));
});
// Row 04
test('inherited base function is one context effective in both children',async()=>{
 const inventory=await compiled();
 const functions=inventory.payload.contexts.filter(x=>x.canonicalSignature==='inherited()'&&x.qualifiedContainer.endsWith(':SharedBase'));
 assert.equal(functions.length,1);
 assert.ok(functions[0].effectiveIn.includes('Inheritance.sol:ChildOne'));
 assert.ok(functions[0].effectiveIn.includes('Inheritance.sol:ChildTwo'));
});
// Row 05
test('review anchors in a different in-scope contract are accepted',()=>{
 assert.equal(flowReview(reviewPacket(),reviewSubmission()).ok,true);
});
// Row 06
test('anchor beyond source file EOF is ANCHOR_INVALID',()=>{
 const s=reviewSubmission();s.rows[0].checks[0].anchors=['contracts/B.sol:L16'];
 hasCode(flowReview(reviewPacket(),s),'ANCHOR_INVALID');
});
// Row 07
test('four contexts repeating boilerplate evidence are rejected',()=>{
 const ids=['A','B','C','D'],s=reviewSubmission(ids),packet=reviewPacket(ids);
 hasCode(flowReview(packet,s),'REPEATED_EVIDENCE');
});
// Row 08
test('CONCERN without a candidate is rejected',()=>{
 const s=reviewSubmission();s.rows[0].checks[0].assessment='CONCERN';
 hasCode(flowReview(reviewPacket(),s),'CONCERN_WITHOUT_CANDIDATE');
});
// Row 09
test('attack submission skipping its assigned flow is rejected',()=>{
 const s=attackSubmission();s.attackPaths=[];
 hasCode(attack(attackPacket,s),'FLOW_NOT_ATTACKED');
});
// Row 10
test('VIABLE attack without simulation idea is rejected',()=>{
 const s=attackSubmission();s.attackPaths[0].result='VIABLE';
 s.attackPaths[0].candidate={tempKey:'C-001',title:'Access bypass',description:'Caller can bypass the gate',anchors:[anchor]};
 delete s.attackPaths[0].blockingControl;
 hasCode(attack(attackPacket,s),'SIMULATION_IDEA_REQUIRED');
});
// Row 11
test('X packet does not expose hypotheses or reviewer-2 submissions',()=>{
 const o=discoveryFixture(1,true);
 try{
   const state=startDiscoveryV1(o).state;
   const packet=buildUnitPacketV1({...o,unitId:'X-001',state});
   const text=JSON.stringify(packet);
   assert.ok(packet.payload.role==='ATTACK');
   assert.doesNotMatch(text,/hypotheses|work\/phase-03|SUBMISSION_v1\.json.*R-001/);
 }finally{o.clean();}
});
// Row 12
test('viable attack contradicting reviewer SUPPORTED becomes reconciliation item',()=>{
 const o=discoveryFixture(1,true);
 try{
   const state={...o.directory,generatedAt:o.now,payload:{gaps:[]}};
   const review={unitId:'R-001',submission:{rows:[{contextId:'CTX-0',checks:[{classId:'ACCESS_CONTROL',assessment:'SUPPORTED'}]}],candidates:[]}};
   const threat={unitId:'X-001',submission:{attackPaths:[{result:'VIABLE',contextIds:['CTX-0'],anchors:['contracts/C0.sol:L2-L4'],goal:'Unauthorized write',candidate:{classId:'ACCESS_CONTROL',description:'Bypass owner guard'}}],integrationAnswers:[]}};
   const taxonomy={classes:[tierClass('ACCESS_CONTROL','STATE_WRITE')]};
   const summary=buildDiscoverySummaryV1({state,inventory:o.inventory,plan:o.plan,acceptedSubmissions:[review,threat],taxonomy,now:o.now});
   assert.ok(summary.payload.reconciliationItems.some(x=>x.origin==='ATTACK_CONTRADICTS_REVIEW'));
 }finally{o.clean();}
});
// Row 13
test('stale unit request leaves discovery state bytes unchanged',()=>{
 const o=discoveryFixture();
 try{
   startDiscoveryV1(o);
   const file=repoFile(o.root,o.campaignPath+'/work/phase-04/discovery/DISCOVERY_STATE_v1.json'),before=fs.readFileSync(file,'utf8');
   assert.equal(advanceDiscoveryV1({...o,unitId:'X-999'}).status,'DISCOVERY_STALE_REQUEST');
   assert.equal(fs.readFileSync(file,'utf8'),before);
 }finally{o.clean();}
});
// Row 14
test('identical submission bytes do not consume another validation attempt',()=>{
 const o=discoveryFixture();
 try{
   startDiscoveryV1(o);
   o.submit('R-001',{schemaVersion:'wrong',unitId:'R-001'});
   advanceDiscoveryV1({...o,unitId:'R-001'});
   const stateRel=o.campaignPath+'/work/phase-04/discovery/DISCOVERY_STATE_v1.json';
   const before=readJson(repoFile(o.root,stateRel)).payload.units['R-001'].attempts;
   assert.equal(advanceDiscoveryV1({...o,unitId:'R-001'}).status,'DISCOVERY_REWORK');
   assert.equal(readJson(repoFile(o.root,stateRel)).payload.units['R-001'].attempts,before);
 }finally{o.clean();}
});
// Row 15
test('zero candidates still require authorization and accounting baselines',()=>{
 const p=baseline().payload.obligations;
 assert.ok(p.some(x=>x.classId==='ACCESS_CONTROL'));
 assert.ok(p.some(x=>x.classId==='ACCOUNTING_MATH'));
});
// Row 16
test('reviewer NOT_APPLICABLE does not remove test obligation',()=>{
 const sum={payload:{notApplicableClaims:[{contextId:'CTX-1',classId:'ACCESS_CONTROL',evidence:'not applicable'}]}};
 assert.equal(baseline(sum).payload.obligations.length,baseline().payload.obligations.length);
});
// Row 17
test('gap contexts preserve obligations at HIGH priority',()=>{
 const sum={payload:{gaps:[{code:'VALIDATION_ATTEMPTS_EXHAUSTED',contextId:'CTX-1'}]}};
 const p=baseline(sum).payload.obligations;
 assert.ok(p.length>0);
 assert.ok(p.every(x=>x.priority==='HIGH'));
});
// Row 18
test('PASSED with an unparseable assertion ledger is a deficiency',()=>{
 const t=p6Fixture();try{t.put(t.ledgerPath,{...t.ledger,parseStatus:'UNPARSEABLE'});assert.ok(t.run().length>0);}finally{t.clean();}
});
// Row 19
test('PASSED with toolInvoked null is a deficiency',()=>{
 const t=p6Fixture();try{t.put(t.ledgerPath,{...t.ledger,toolInvoked:null});assert.ok(t.run().length>0);}finally{t.clean();}
});
// Row 20
test('DISPROVEN based solely on Phase5 NOT_REPRODUCED is a deficiency',()=>{
 const t=p6Fixture();try{t.put(t.ledgerPath,{...t.ledger,tests:[...t.ledger.tests.filter(x=>x.name!=='Vault::attack'),{name:'Vault::attack',status:'FAIL'}]});assert.ok(t.run().some(x=>x.includes('attackAssertionNames')));}finally{t.clean();}
});
// Row 21
test('CONFIRMED with failing control assertion is a deficiency',()=>{
 const t=p6Fixture();try{
   t.put(t.ledgerPath,{...t.ledger,tests:t.ledger.tests.map(x=>x.name==='Vault::control'?{...x,status:'FAIL'}:x)});
   t.form.actions['step-5'].outputs.candidateProofRecords[0].verdict='CONFIRMED';
   assert.ok(t.run().some(x=>x.includes('controlAssertionNames')));
 }finally{t.clean();}
});
// Row 22
test('two ROUNDS_EXHAUSTED requests cannot certify NOT_ACHIEVED',()=>{
 const t=p6Fixture();try{
   const out=t.form.actions['step-4'].outputs.baselineTestRecords[0].obligationOutcomes[0];
   out.outcome='NOT_ACHIEVED';out.reasonCode='ROUNDS_EXHAUSTED';out.note='No conclusion after two runs';
   assert.ok(t.run().some(x=>x.includes('NOT_ACHIEVED')));
 }finally{t.clean();}
});
// Row 23
test('Phase8 rejects missing PROPERTY_FAILED and P6-NEW candidate dispositions',()=>{
 const t=temp();try{
   t.put('derived/phase-6/PHASE_06_CANONICAL_DATA_v1.json',{actions:{'step-4':{outputs:{baselineTestRecords:[{testGroupId:'TG-1',obligationOutcomes:[{obligationId:'BOB-1',outcome:'PROPERTY_FAILED'}]}]}},'step-5':{outputs:{candidateProofRecords:[{candidateKey:'CP-1',verdict:'INCONCLUSIVE'}],newCandidateRecords:[{tempKey:'P6-NEW-1'}]}}}});
   const f={actions:{'step-2':{outputs:{candidateValidations:[]}}}};
   const problems=validatePhase8LinkageV1({...t,form:f});
   assert.ok(problems.length>=3);
   assert.ok(problems.some(x=>x.includes('P6-NEW-1')));
 }finally{t.clean();}
});
// Row 24
test('Phase10 verdict without coverage label is rejected',()=>{
 const t=temp();try{
   t.put('work/phase-10/COVERAGE_MATRIX_v1.json',{label:'PARTIAL_COVERAGE'});
   const form={actions:{'step-3':{outputs:{verdictRationale:'The evidence is limited'}}}};
   assert.ok(validatePhase10CoverageLabelV1({...t,form}).length>0);
 }finally{t.clean();}
});
// Row 25
test('v11 Phase3 PASS uses standard same-reviewer Phase4 without discovery activation',()=>{
 const selected=detectionPolicyForAuthorityV1({repoRoot,authorityRoot:'Audit Skill - Current Authority/Audit_Litemode_v11',readJsonIfExists:()=>({release:'Audit_Litemode_v11'})});
 assert.equal(selected,null);
 const controller=fs.readFileSync(path.join(repoRoot,'scripts/lite-phase-packet-controller-v1.mjs'),'utf8');
 assert.match(controller,/sequence===3&&!masterAmendmentRefreshSha&&activeDetectionPolicyV1\(predecessor\)/);
 assert.match(controller,/reviewer:'reviewer-2'/);
 assert.match(controller,/sameReviewerAdvanced:!discoveryStarted/);
});
// Row 26
test('Phase0 inventory build failure writes typed incomplete inventory rather than failing',async()=>{
 const t=temp();
 try{
   await writeReviewInventoryOutputsV1({outputDir:t.root,projectRoot:'/nonexistent-rejection-matrix-fixture',build:{sourceAsts:{},artifacts:[]},request:{...campaign,source:{archiveSha256:campaign.sourceSha256}},policy:'audit-detection-rebuild-v1'});
   const saved=JSON.parse(await fsp.readFile(path.join(t.root,'REVIEW_INVENTORY_v1.json'),'utf8'));
   assert.equal(saved.payload.complete,false);
   assert.ok(saved.payload.limitations.some(x=>x.code==='INVENTORY_BUILD_ERROR'));
 }finally{t.clean();}
});
// Row 27
test('tampering frozen v11 SKILL file makes registry resolver fail closed',()=>{
 const t=temp();
 try{
   const oldRoot='Audit Skill - Current Authority/Audit_Litemode_v11',frozen='audit-process/v7/frozen-authorities/Audit_Litemode_v11';
   const sha=x=>createHash('sha256').update(x).digest('hex');
   const dir=repoFile(t.root,frozen);fs.mkdirSync(dir,{recursive:true});
   const skill='Trusted v11 skill\n',manifest=JSON.stringify({release:'Audit_Litemode_v11',entrypoint:'SKILL.md',files:[{path:'SKILL.md',bytes:Buffer.byteLength(skill),sha256:sha(skill)}]})+'\n';
   fs.writeFileSync(path.join(dir,'SKILL.md'),skill);fs.writeFileSync(path.join(dir,'MANIFEST.json'),manifest);
   const entry={release:'Audit_Litemode_v11',logicalRoot:oldRoot,frozenRoot:frozen,skillSha256:sha(skill),manifestSha256:sha(manifest)};
   writeJson(repoFile(t.root,'audit-process/v7/frozen-authorities/FROZEN_AUTHORITY_REGISTRY_v1.json'),{schemaVersion:'curveyield-frozen-authority-registry-v1',entries:[entry]});
   fs.appendFileSync(path.join(dir,'SKILL.md'),'corrupted');
   assert.throws(()=>resolveFrozenAuthorityFileV1(t.root,oldRoot+'/SKILL.md'),/hash mismatch/);
 }finally{t.clean();}
});
// Row 28
test('adjudicated Critical defect rated Medium remains a critical-high miss',()=>{
 const r=scoreQualificationV1({truth:[{caseId:'C-1',kind:'defect',severity:'CRITICAL',classId:'ACCESS_CONTROL',contract:'Vault'}],findings:[{findingId:'F-1',caseRefs:['C-1'],severity:'MEDIUM'}],adjudications:[{caseId:'C-1',findingId:'F-1',match:'MATCH',severityReadjudicated:false,reason:'Exact source match'}]});
 assert.deepEqual(r.criticalHighMisses.map(x=>x.caseId),['C-1']);
});
// Windowed discovery: one controller run validates a whole window of submissions.
test('a window of 25 submissions is validated in one run and the next window is issued with one wake',()=>{
 const o=discoveryFixture(30,false);
 try{
   const started=startDiscoveryV1(o);
   const ids=n=>Array.from({length:n},(_,i)=>'R-'+String(i+1).padStart(3,'0'));
   assert.deepEqual(started.state.payload.order.filter(id=>started.state.payload.units[id].status==='ACTIVE'),ids(25));
   for(const id of ids(25))o.submit(id,validUnit(o.packet(id)));
   const result=advanceDiscoveryV1({...o,unitId:'R-001'});
   assert.equal(result.status,'DISCOVERY_NEXT');
   const message=Buffer.from(result.wake.messageB64,'base64').toString('utf8');
   assert.ok(message.includes('R-026')&&message.includes('R-030')&&!message.includes('R-025:'));
   const state=readJson(repoFile(o.root,o.campaignPath+'/work/phase-04/discovery/DISCOVERY_STATE_v1.json')).payload;
   assert.equal(ids(25).filter(id=>state.units[id].status==='ACCEPTED').length,25);
   assert.equal(state.activeUnitId,'R-026');
 }finally{o.clean();}
});
