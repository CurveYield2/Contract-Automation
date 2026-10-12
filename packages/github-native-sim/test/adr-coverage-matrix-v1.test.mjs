import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {loadTaxonomyV1} from '../src/adr-taxonomy-v1.mjs';
import {buildCoverageMatrixV1, renderCoverageMarkdownV1} from '../src/adr-coverage-matrix-v1.mjs';
import {digestCanonicalV1} from '../src/canonical-json-v1.mjs';

const taxonomy=loadTaxonomyV1(resolve(fileURLToPath(new URL('../../../',import.meta.url))));
const contexts=[
  {contextId:'CTX-a',path:'A.sol',qualifiedContainer:'A.sol:A',lineStart:1,scopeTier:'IN_SCOPE'},
  {contextId:'CTX-b',path:'B.sol',qualifiedContainer:'B.sol:B',lineStart:2,scopeTier:'IN_SCOPE'},
  {contextId:'CTX-c',path:'C.sol',qualifiedContainer:'C.sol:C',lineStart:3,scopeTier:'IN_SCOPE'}
];
const triggers={'CTX-a':['STATE_WRITE_EXTERNAL'],'CTX-b':['TOKEN_TRANSFER'],'CTX-c':['BLOCK_TIMESTAMP']};
const baseInventory=()=>({payload:{contexts:structuredClone(contexts),triggers:structuredClone(triggers)}});
const checks=()=>Object.fromEntries(contexts.map(x=>[x.contextId,Object.fromEntries(taxonomy.classes.map(c=>[c.classId,'SUPPORTED']))]));
const discovery=()=>({reviewChecks:checks(),attackContradictions:[],gaps:[]});
const passes=(inventory)=> {
 const pending=buildCoverageMatrixV1({inventory,taxonomy});
 return Object.fromEntries(pending.rows.filter(row=>row.testStatus!=='NOT_REQUIRED').map(row=>[row.contextId+':'+row.classId,'PASSED']));
};

test('no discovery produces PENDING and PARTIAL_COVERAGE',()=>{
 const m=buildCoverageMatrixV1({inventory:baseInventory(),taxonomy});
 assert.ok(m.rows.length>0);
 assert.ok(m.rows.every(r=>r.reviewStatus==='PENDING'));
 assert.equal(m.label,'PARTIAL_COVERAGE');
});
test('full review and passing tests produce FULL_COVERAGE',()=>{
 const inventory=baseInventory();
 const matrix=buildCoverageMatrixV1({inventory,taxonomy,discoveryState:discovery(),phase6Results:passes(inventory)});
 assert.equal(matrix.label,'FULL_COVERAGE');
 assert.equal(matrix.gapCount,0);
 assert.match(renderCoverageMarkdownV1(matrix),/FULL_COVERAGE/);
});
test('one gap is reported per contract and makes coverage partial',()=>{
 const inventory=baseInventory(),d=discovery();d.gaps.push('CTX-a');
 const m=buildCoverageMatrixV1({inventory,taxonomy,discoveryState:d,phase6Results:passes(inventory)});
 assert.equal(m.label,'PARTIAL_COVERAGE');
 assert.ok(m.byContract['A.sol:A'].gaps>0);
});
test('REVIEW_ONLY classes never require a test',()=>{
 const m=buildCoverageMatrixV1({inventory:baseInventory(),taxonomy,discoveryState:discovery(),phase6Results:{}});
 assert.ok(m.rows.some(r=>r.classId==='TIME_BLOCK'&&r.testStatus==='NOT_REQUIRED'));
});
test('resolved contradiction is not a gap, unresolved contradiction is',()=>{
 const inventory=baseInventory(),d=discovery();
 d.attackContradictions.push({contextId:'CTX-a',classId:'ACCESS_CONTROL'});
 const yes=buildCoverageMatrixV1({inventory,taxonomy,discoveryState:d,phase6Results:passes(inventory)});
 assert.equal(yes.label,'FULL_COVERAGE');
 assert.notEqual(yes.rows.find(r=>r.contextId==='CTX-a'&&r.classId==='ACCESS_CONTROL').reviewStatus,'CONTRADICTED');
 const no=passes(inventory);no['CTX-a:ACCESS_CONTROL']='INCONCLUSIVE';
 const result=buildCoverageMatrixV1({inventory,taxonomy,discoveryState:d,phase6Results:no});
 assert.equal(result.label,'PARTIAL_COVERAGE');
 assert.equal(result.rows.find(r=>r.contextId==='CTX-a'&&r.classId==='ACCESS_CONTROL').reviewStatus,'CONTRADICTED');
});
test('shuffled contexts, contradictions and gaps have deterministic digest',()=>{
 const inventory=baseInventory(),d=discovery(),phase6=passes(inventory);
 d.gaps=['CTX-a','CTX-b'];
 const a=buildCoverageMatrixV1({inventory,taxonomy,discoveryState:d,phase6Results:phase6});
 inventory.payload.contexts.reverse();d.gaps.reverse();
 const b=buildCoverageMatrixV1({inventory,taxonomy,discoveryState:d,phase6Results:phase6});
 assert.equal(digestCanonicalV1(a),digestCanonicalV1(b));
});
