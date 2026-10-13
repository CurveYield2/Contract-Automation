import test from 'node:test';
import assert from 'node:assert/strict';
import {validateFlowReviewSubmissionV1} from '../src/adr-discovery-validators-v1.mjs';

const path='upgrade/src/A.sol';
const inventory={payload:{sourceUnits:[{path,scopeTier:'IN_SCOPE',lineCount:200}]}};
const C='upgrade/src/A.sol:A';
const ctx=(contextId,kind,modifiers=[])=>({contextId,kind,qualifiedContainer:C,modifiers});
const packet={unitId:'R-001',flowIds:[],primaryContextIds:['K1','K2','S1','S2','S3'],
  primaryContexts:[ctx('K1','CONSTANT'),ctx('K2','GENERATED_GETTER'),ctx('S1','FUNCTION',['onlyOwner']),ctx('S2','FUNCTION',['onlyOwner']),ctx('S3','FUNCTION')],
  requiredClasses:{K1:['ACCOUNTING_MATH'],K2:[],S1:['ACCESS_CONTROL'],S2:['ACCESS_CONTROL'],S3:['ACCESS_CONTROL']},
  trivialContextIds:['K1','K2'],contractChecks:[{contract:C,classId:'UPGRADE_INIT_STORAGE'}]};
const check=(classId,extra={})=>({classId,applicability:'APPLICABLE',assessment:'SUPPORTED',evidence:'Specific reasoning for '+classId+' '+JSON.stringify(extra),anchors:[path+':L10-L12'],...extra});
const base=()=>({schemaVersion:'curveyield-flow-review-submission-v1',unitId:'R-001',flowNotes:[],
  trivialReviews:[{contract:C,assessment:'SUPPORTED',evidence:'BPS is 10000 and the getter only reads the fee cap',anchors:[path+':L28']}],
  groupChecks:[{contextIds:['S1','S2'],...check('ACCESS_CONTROL',{g:1})}],
  contractChecks:[{contract:C,...check('UPGRADE_INIT_STORAGE',{c:1})}],
  rows:[{contextId:'S1',summary:'Sets the cap',checks:[]},{contextId:'S2',summary:'Sets the floor',checks:[]},
    {contextId:'S3',summary:'Public sync',checks:[check('ACCESS_CONTROL',{s:3})]}]});

test('compact forms: trivial contexts need no rows, grouped classes need no row checks', () => {
  const result=validateFlowReviewSubmissionV1({packet,submission:base(),inventory});
  assert.deepEqual(result.errors,[]);
});

test('a group needs a shared modifier and contract checks are mandatory when listed', () => {
  const s=base();
  s.groupChecks[0].contextIds=['S1','S3'];
  s.rows[2].checks=[];s.rows[0].checks=[];s.rows[1].checks=[check('ACCESS_CONTROL',{s:2})];
  delete s.contractChecks;
  const codes=validateFlowReviewSubmissionV1({packet,submission:s,inventory}).errors.map(e=>e.code);
  assert.ok(codes.includes('GROUP_WITHOUT_SHARED_GUARD'));
  assert.ok(codes.includes('CONTRACT_CHECK_MISSING'));
});

test('without trivialReviews every trivial context still needs its row', () => {
  const s=base();delete s.trivialReviews;
  const codes=validateFlowReviewSubmissionV1({packet,submission:s,inventory}).errors.map(e=>e.code);
  assert.ok(codes.includes('MISSING_CONTEXT'));
});

test('the discovery summary expands compact forms into per-context records', async () => {
  const {buildDiscoverySummaryV1}=await import('../src/adr-discovery-v1.mjs');
  const taxonomy={classes:[{classId:'ACCESS_CONTROL',triggers:['ROLE'],testRequired:false},{classId:'ACCOUNTING_MATH',triggers:['MATH'],testRequired:false},
    {classId:'UPGRADE_INIT_STORAGE',triggers:['PROXY_PATTERN'],testRequired:false}]};
  const contexts=['K1','S1','S2','S3','U1'].map((id,i)=>({contextId:id,path,qualifiedContainer:C,kind:id==='K1'?'CONSTANT':'FUNCTION',lineStart:i+1,lineEnd:i+1,scopeTier:'IN_SCOPE'}));
  const inv={payload:{...inventory.payload,contexts,triggers:{K1:['MATH'],S1:['ROLE'],S2:['ROLE'],S3:['ROLE'],U1:['PROXY_PATTERN']}}};
  const plan={payload:{reviewUnits:[{unitId:'R-001',primaryContextIds:['K1','S1','S2','S3','U1']}],attackUnits:[]}};
  const s=base();s.rows.push({contextId:'U1',summary:'Upgrade hook',checks:[]});
  const summary=buildDiscoverySummaryV1({state:{payload:{gaps:[]}},inventory:inv,plan,acceptedSubmissions:[{unitId:'R-001',submission:s}],taxonomy,now:'t'});
  const per=summary.payload.perContext;
  assert.equal(per.K1.ACCOUNTING_MATH,'SUPPORTED');
  assert.equal(per.S1.ACCESS_CONTROL,'SUPPORTED');
  assert.equal(per.U1.UPGRADE_INIT_STORAGE,'SUPPORTED');
  assert.equal(summary.payload.coverage.label,'FULL_COVERAGE');
});
