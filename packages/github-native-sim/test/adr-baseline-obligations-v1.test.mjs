import {test} from 'node:test';
import assert from 'node:assert/strict';
import {deriveBaselineObligationsV1} from '../src/adr-baseline-obligations-v1.mjs';
import {digestCanonicalV1} from '../src/canonical-json-v1.mjs';

const makeClass=(id,trigger,required=true)=>({classId:id,title:id.replaceAll('_',' '),
 triggers:[trigger],testMethod:required?'FOUNDRY_PROPERTY':'REVIEW_ONLY',
 testRequired:required,reviewChecks:['Check exact source effect']});
const taxonomy={classes:[
 makeClass('ACCESS_CONTROL','STATE_WRITE'),
 makeClass('ACCOUNTING_MATH','ARITHMETIC_ON_STATE'),
 makeClass('STATE_MACHINE','STATE_WRITE'),
 makeClass('TIME_BLOCK','BLOCK_NUMBER',false)
]};
function context(i,name='Vault'){
 return {contextId:'CTX-'+i,path:name+'.sol',qualifiedContainer:name+'.sol:'+name,
  effectiveIn:[name+'.sol:'+name],scopeTier:'IN_SCOPE'};
}
const inventory=(contexts=[context(1)],triggers={'CTX-1':['STATE_WRITE','ARITHMETIC_ON_STATE','BLOCK_NUMBER']})=>({
 campaignId:'demo-r1',campaignGenerationId:'g1',sourceSha256:'a'.repeat(64),
 generatedAt:'2026-10-12T00:00:00.000Z',payload:{contexts,triggers}
});
const build=(inv=inventory(),sum={payload:{}} ,tax=taxonomy)=>
 deriveBaselineObligationsV1({inventory:inv,taxonomy:tax,summary:sum});
test('zero candidate authorization and accounting surfaces produce mandatory obligations',()=>{
 const p=build().payload;
 assert.ok(p.obligations.some(x=>x.classId==='ACCESS_CONTROL'));
 assert.ok(p.obligations.some(x=>x.classId==='ACCOUNTING_MATH'));
 assert.ok(p.obligations.every(x=>x.obligationId.startsWith('BOB-')));
});
test('REVIEW_ONLY classes do not create test obligations',()=>{
 assert.ok(!build().payload.obligations.some(x=>x.classId==='TIME_BLOCK'));
});
test('NOT_APPLICABLE claims never cancel any test obligation',()=>{
 const baseline=build().payload.obligations.length;
 const sum={payload:{notApplicableClaims:[{contextId:'CTX-1',classId:'ACCESS_CONTROL',evidence:'claimed not applicable'}]}};
 assert.equal(build(inventory(),sum).payload.obligations.length,baseline);
});
test('review concern and uncovered state raises HIGH while ordering HIGH first',()=>{
 const c=[context(1),context(2,'Unrelated')];
 const t={'CTX-1':['STATE_WRITE'],'CTX-2':['ARITHMETIC_ON_STATE']};
 const s={payload:{perContext:{'CTX-2':{'ACCOUNTING_MATH':'CONCERN'}}}};
 const p=build(inventory(c,t),s).payload.obligations;
 assert.equal(p[0].classId,'ACCOUNTING_MATH');assert.equal(p[0].priority,'HIGH');
 assert.ok(p.slice(1).every(x=>x.priority==='NORMAL'));
});
test('attack finding and coverage gap separately make obligations HIGH',()=>{
 const s1={payload:{attackPaths:[{result:'VIABLE',contextIds:['CTX-1'],candidate:{classId:'ACCESS_CONTROL'}}]}};
 assert.ok(build(inventory(),s1).payload.obligations.some(o=>o.classId==='ACCESS_CONTROL'&&o.priority==='HIGH'));
 const s2={payload:{gaps:[{code:'VALIDATION_ATTEMPTS_EXHAUSTED',contextId:'CTX-1'}]}};
 assert.ok(build(inventory(),s2).payload.obligations.every(o=>o.priority==='HIGH'));
});
test('eleven required classes produce two contract-local groups of at most eight',()=>{
 const cs=Array.from({length:11},(_,i)=>makeClass('CLASS_'+String(i).padStart(2,'0'),'TRIGGER_'+i));
 const inv=inventory([context(1)],{'CTX-1':cs.map(x=>x.triggers[0])});
 const p=build(inv,{payload:{}},{classes:cs}).payload;
 assert.equal(p.obligations.length,11);assert.equal(p.testGroups.length,2);
 assert.deepEqual(p.testGroups.map(x=>x.obligationIds.length),[8,3]);
 assert.ok(p.testGroups.every(x=>x.contract==='Vault.sol:Vault'));
});
test('input order reversal yields the same canonical digest',()=>{
 const ctx=[context(1),context(2,'Bar')],triggers={'CTX-1':['STATE_WRITE'],'CTX-2':['ARITHMETIC_ON_STATE']};
 const a=build(inventory(ctx,triggers));
 const b=build(inventory([...ctx].reverse(),triggers));
 assert.equal(digestCanonicalV1(a),digestCanonicalV1(b));
});
test('review-only legacy policy does not independently activate discovery or testing',()=>{
 const text=JSON.stringify(build().payload);
 assert.ok(!text.includes('ACTIVE_DISCOVERY'));
});
