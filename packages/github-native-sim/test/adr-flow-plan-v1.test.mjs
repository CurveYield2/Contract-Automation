import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildFlowPlanV1,DEFAULT_LIMITS} from '../src/adr-flow-plan-v1.mjs';
import {digestCanonicalV1} from '../src/canonical-json-v1.mjs';

const contract=n=>'contracts/'+n+'.sol:'+n;
const mk=(n,ix=1,extra={})=>({
 contextId:'CTX-'+n+'-'+ix,symbolId:'SYM-'+n+'-'+ix,path:'contracts/'+n+'.sol',
 qualifiedContainer:contract(n),kind:'FUNCTION',canonicalSignature:'run'+ix+'()',visibility:'external',
 lineStart:ix*3,lineEnd:ix*3+2,effectiveIn:[contract(n)],scopeTier:'IN_SCOPE',
 internalCalls:[],dependencySymbolIds:[],modifiers:[],externalCalls:[],...extra
});
function inp(contexts,edges=[],opts={}) {
 const triggers=Object.fromEntries(contexts.map(c=>[c.contextId,opts.triggers?.[c.contextId]??(c.visibility==='external'?['STATE_WRITE_EXTERNAL']:[])]));
 const inventory={schemaVersion:'curveyield-review-inventory-v1',campaignId:'fixture',campaignGenerationId:'g1',
  sourceSha256:'f'.repeat(64),taxonomyVersion:'curveyield-defect-taxonomy-v1',detectionPolicy:'audit-detection-rebuild-v1',
  generatedAt:'2026-10-12T00:00:00.000Z',
  payload:{contexts,sourceUnits:[],declarations:[],triggers,limitations:opts.limitations??[],complete:true}};
 const facts={payload:{crossContractEdges:edges,dependencyEdges:opts.dependencyEdges??[],
  siblingGroups:opts.siblingGroups??[],guardTable:opts.guardTable??[],valueFlows:opts.valueFlows??[]}};
 return {inventory,facts};
}
const edge=(a,b,ix=1,member='run1')=>({fromContextId:'CTX-'+a+'-'+ix,fromContract:contract(a),
 toType:contract(b),memberName:member,line:ix*3});
const plan=(i,limits)=>buildFlowPlanV1({...i,...(limits?{limits}:{})});
function uniquePrimary(p){
 const all=p.payload.reviewUnits.flatMap(u=>u.primaryContextIds);
 assert.equal(new Set(all).size,all.length,'each context should be primary exactly once');
 return all;
}

test('A -> B -> C is cross-contract, one cluster and no split flow',()=>{
 const c=[mk('A'),mk('B'),mk('C')],e=[edge('A','B'),edge('B','C')];
 const i=inp(c,e,{triggers:{'CTX-A-1':['EXTERNAL_CALL'],'CTX-B-1':[],'CTX-C-1':[]}});
 const p=plan(i,{...DEFAULT_LIMITS,maxPrimaryContextsPerUnit:1}).payload;
 assert.equal(p.flows.length,1);
 assert.deepEqual(p.flows[0].contexts,['CTX-A-1','CTX-B-1','CTX-C-1']);
 assert.equal(p.flows[0].crossContract,true);
 assert.equal(p.clusters.length,1);
 assert.equal(p.reviewUnits[0].oversize,true);
 assert.deepEqual(p.reviewUnits[0].flowIds,[p.flows[0].flowId]);
});
test('30 connected contracts: all primary once and units never cross clusters',()=>{
 const c=Array.from({length:30},(_,j)=>mk('C'+String(j).padStart(2,'0')));
 const edges=c.slice(1).map((_,j)=>edge('C'+String(j).padStart(2,'0'),'C'+String(j+1).padStart(2,'0')));
 const p=plan(inp(c,edges)).payload;
 assert.equal(p.clusters.length,1);
 assert.equal(uniquePrimary({payload:p}).length,30);
 assert.ok(p.reviewUnits.filter(u=>u.role==='FLOW_REVIEW').every(u=>u.clusterId===p.clusters[0].clusterId));
});
test('60-context flow receives an oversize unit',()=>{
 const start=mk('A'),rest=Array.from({length:59},(_,n)=>mk('A',n+2,{visibility:'internal'}));
 start.internalCalls=rest.map(c=>c.symbolId);
 const p=plan(inp([start,...rest],[],{triggers:{[start.contextId]:['STATE_WRITE_EXTERNAL']}})).payload;
 assert.equal(p.flows.length,1);assert.equal(p.flows[0].contexts.length,60);
 assert.equal(p.reviewUnits[0].oversize,true);
 assert.equal(p.reviewUnits[0].primaryContextIds.length,60);
});
test('unused private helper goes to R unit',()=>{
 const c=[mk('A'),mk('A',2,{visibility:'private'})];
 const p=plan(inp(c)).payload;
 assert.equal(p.reviewUnits.some(u=>u.role==='RESIDUAL_REVIEW'&&u.primaryContextIds.includes(c[1].contextId)),true);
});
test('two unconnected contract groups give two clusters and two attacker units',()=>{
 const p=plan(inp([mk('A'),mk('B'),mk('C'),mk('D')],[edge('A','B'),edge('C','D')])).payload;
 assert.equal(p.clusters.length,2);assert.equal(p.attackUnits.length,2);
 assert.equal(new Set(p.attackUnits.map(x=>x.clusterId)).size,2);
});
test('asymmetric siblings, unguarded writer and cross-contract reentry all give attack questions',()=>{
 const a=mk('A'),b=mk('B');
 const i=inp([a,b],[edge('A','B')],{
  triggers:{'CTX-A-1':['STATE_WRITE_EXTERNAL','EXTERNAL_CALL_BEFORE_STATE_WRITE'],'CTX-B-1':[]},
  siblingGroups:[{signature:'run1()',asymmetric:true,members:[{contract:contract('A'),modifiers:[],hasGuard:false},{contract:contract('B'),modifiers:['onlyOwner'],hasGuard:true}]}],
  guardTable:[{contextId:a.contextId,contract:contract('A'),function:'run1()',hasGuard:false,modifiers:[],txOriginLines:[]}]});
 const p=plan(i).payload,types=new Set(p.integrationQuestions.map(q=>q.kind));
 for(const k of ['CROSS_CONTRACT_CALL','SIBLING_GUARD_ASYMMETRY','UNGUARDED_EXTERNAL_STATE_WRITE','CROSS_CONTRACT_REENTRY'])assert.ok(types.has(k),k);
 for(const q of p.integrationQuestions)assert.ok(p.attackUnits.some(x=>x.clusterId===q.clusterId&&x.integrationQuestionIds.includes(q.obligationId)));
});
test('40 questions in one cluster produce exactly three X units',()=>{
 const a=mk('A'),b=mk('B');
 const guards=Array.from({length:40},(_,j)=>({contextId:a.contextId+'-'+j,contract:contract('A'),function:'f'+j+'()',hasGuard:false,txOriginLines:[]}));
 const p=plan(inp([a,b],[edge('A','B')],{guardTable:guards})).payload;
 assert.equal(p.attackUnits.length,3);
 assert.ok(p.attackUnits.every(x=>JSON.stringify(x.flowIds)===JSON.stringify(p.clusters[0].flowIds)));
 assert.deepEqual(p.attackUnits.map(x=>x.integrationQuestionIds.length),[15,15,11]); // plus contract-pair question
});
test('shuffling source contexts and cross-contract edges preserves digest',()=>{
 const c=[mk('A'),mk('B'),mk('C')],e=[edge('A','B'),edge('B','C')];
 const first=plan(inp(c,e));
 const second=plan(inp([...c].reverse(),[...e].reverse()));
 assert.equal(digestCanonicalV1(first),digestCanonicalV1(second));
});
test('FILE_FALLBACK goes to gaps and residual unit',()=>{
 const fallback=mk('Missing',1,{kind:'FILE_FALLBACK',visibility:'internal'});
 const p=plan(inp([fallback],[],{limitations:[{code:'INVENTORY_INCOMPLETE',path:fallback.path,detail:'missing AST'}]})).payload;
 assert.equal(p.gaps.filter(x=>x.code==='INVENTORY_INCOMPLETE').length,2);
 assert.ok(p.reviewUnits.some(x=>x.role==='RESIDUAL_REVIEW'&&x.primaryContextIds.includes(fallback.contextId)));
});
test('snapshot creates deployed configuration question and constructor trigger',()=>{
 const constructor=mk('A',1,{kind:'CONSTRUCTOR',visibility:'internal',canonicalSignature:'constructor()'});
 const i=inp([constructor]);
 const snapshot={status:'CAPTURED',rows:[{contract:contract('A'),address:'0x1234'}]};
 const p=buildFlowPlanV1({...i,snapshot}).payload;
 assert.ok(p.integrationQuestions.some(x=>x.kind==='DEPLOYED_CONFIGURATION'));
 assert.ok(i.inventory.payload.triggers[constructor.contextId].includes('DEPLOY_ROLE_STATE'));
});
