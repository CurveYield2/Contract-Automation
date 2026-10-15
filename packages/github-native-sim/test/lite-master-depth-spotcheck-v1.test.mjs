import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {buildMasterDepthSpotCheckV1,validateMasterDepthSpotCheckV1}
 from '../../../scripts/lib/lite-master-depth-spotcheck-v1.mjs';

function testFixture(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'master-depth-'));
 const campaignPath='campaigns/seed r1',campaignId='seed-r1',sourceSha256='a'.repeat(64),
  segmentId='reviewer-2-phases-02-04';
 const put=(rel,body)=>{
  const abs=path.join(root,...rel.split('/'));fs.mkdirSync(path.dirname(abs),{recursive:true});
  fs.writeFileSync(abs,JSON.stringify(body,null,2)+'\n');
 };
 const dir=path.posix.join(campaignPath,'work/phase-04/discovery');
 const state={schemaVersion:'discovery-state',payload:{
  order:['F-001','R-002'],
  units:{
   'F-001':{role:'FLOW_REVIEW',status:'ACCEPTED',
    openedAt:'2026-10-10T10:00:00Z',acceptedAt:'2026-10-10T11:00:00Z'},
   'R-002':{role:'RESIDUAL_REVIEW',status:'ACCEPTED',
    openedAt:'2026-10-10T10:00:00Z',acceptedAt:'2026-10-10T10:03:00Z'}
  }}};
 put(path.posix.join(dir,'DISCOVERY_STATE_v1.json'),state);
 for(const unitId of state.payload.order){
  put(path.posix.join(dir,unitId,'ASSIGNMENT_PACKET_v1.json'),
   {payload:{reviewPolicy:'correctness-verdict-v13',primaryContextIds:Array.from({length:20},(_,i)=>unitId+'-CTX-'+i)}});
  put(path.posix.join(dir,unitId,'ACCEPTED_SUBMISSION_v1.json'),
   {rows:Array.from({length:20},(_,i)=>({contextId:unitId+'-CTX-'+i,
      verdict:'CORRECT',reason:'Guarded by onlyRole at line 10 with bounded accounting conditions'}))});
 }
 return {root,campaignPath,campaignId,sourceSha256,segmentId,put};
}
test('10% of normal unit sampled; every under-30-second row rejudged',()=>{
 const f=testFixture();
 try{
  const x=buildMasterDepthSpotCheckV1(f);
  assert.equal(x.units[0].contexts.length,2);
  assert.equal(x.units[1].contexts.length,20);
  assert.equal(x.units[1].samplingReason,'FAST_OR_MISSING_TIMING_REJUDGE_ALL');
  const p=path.posix.join(f.campaignPath,'work/master-review',f.segmentId,'DEPTH_SPOTCHECK_RESULTS_v1.json');
  assert.match(validateMasterDepthSpotCheckV1({root:f.root,campaignPath:f.campaignPath,assignment:x})[0],/independently rejudge/);
  const rows=x.units.flatMap(u=>u.contexts.map(c=>({
   unitId:u.unitId,contextId:c.contextId,masterVerdict:c.reviewerVerdict,
   sourceAnchor:'src/Vault.sol:L10-L15',
   independentReason:'Independently evaluated onlyOwner and fee setter constraints at lines 10 to 15'
  })));
  f.put(p,{schemaVersion:'curveyield-master-depth-spotcheck-results-v1',campaignId:f.campaignId,
   sourceSha256:f.sourceSha256,segmentId:f.segmentId,assignmentSha256:x.assignmentSha256,rows});
  assert.deepEqual(validateMasterDepthSpotCheckV1({root:f.root,campaignPath:f.campaignPath,assignment:x}),[]);
  rows.pop();
  f.put(p,{schemaVersion:'curveyield-master-depth-spotcheck-results-v1',campaignId:f.campaignId,
   sourceSha256:f.sourceSha256,segmentId:f.segmentId,assignmentSha256:x.assignmentSha256,rows});
  assert.match(validateMasterDepthSpotCheckV1({root:f.root,campaignPath:f.campaignPath,assignment:x}).join(' '),/not independently reviewed/);
 }finally{fs.rmSync(f.root,{recursive:true,force:true});}
});
