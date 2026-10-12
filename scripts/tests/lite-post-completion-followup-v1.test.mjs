import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {readJson} from '../lib/lite-phase-work-v1.mjs';
import {validatePostCompletionFollowupV1,admitPostCompletionFollowupV1} from '../lib/lite-post-completion-followup-v1.mjs';

const root=path.resolve(process.argv[2]??'.audit-controller');
const campaignPath='campaigns/CurveYield DEX v16 Source r4';
const requestPath=campaignPath+'/controller/POST_COMPLETION_FOLLOWUP_REQUEST_v1.json';
const dirPath='Audit Campaign Directory/campaigns/curveyield-dex-v16-source.json';
const orig=readJson(path.join(root,dirPath));
const phase10=path.join(root,orig.lastSealedReceiptPath);
const sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const receiptBefore=sha(phase10);
const masterBefore=sha(path.join(root,orig.lastAcceptedMasterReview.recordPath));
const expectedStatus=orig.campaignStatus;
assert.equal(expectedStatus,'COMPLETE');
const pass=validatePostCompletionFollowupV1({root,campaignPath,directory:structuredClone(orig),requestPath});
assert.equal(pass.snapshot.sourceSha256,orig.sourceSha256);
for(const field of ['sourceSha256','campaignGenerationId','campaignId']){
  const wrong=structuredClone(orig);wrong[field]='tampered-identity';
  assert.throws(()=>validatePostCompletionFollowupV1({root,campaignPath,directory:wrong,requestPath}),/wrong campaign generation or source/);
}
assert.throws(()=>validatePostCompletionFollowupV1({root,campaignPath,directory:{...orig,campaignStatus:'ACTIVE'},requestPath}),/actually COMPLETE/);
assert.throws(()=>validatePostCompletionFollowupV1({root,campaignPath,directory:{...orig,pendingMasterReview:{}},requestPath}),/actually COMPLETE/);
const adm=structuredClone(orig);
const result=admitPostCompletionFollowupV1({root,campaignPath,directory:adm,requestPath,now:'2026-10-12T07:00:00Z'});
assert.equal(adm.campaignStatus,'WAITING_FOR_MASTER_REVIEW');
assert.equal(adm.currentAssignment,null);
assert.equal(result.pending.segmentId,'reviewer-4-followup-v1');
assert.equal(result.pending.postCompletionFollowup.sourceSha256,orig.sourceSha256);
assert.equal(result.pending.sealedWorkForms.some(x=>x.phase===8),true);
assert.equal(result.pending.sealedWorkForms.some(x=>x.phase===10),true);
assert.equal(sha(phase10),receiptBefore);
assert.equal(sha(path.join(root,orig.lastAcceptedMasterReview.recordPath)),masterBefore);
assert.equal(adm.lastAcceptedMasterReview.recordPath,orig.lastAcceptedMasterReview.recordPath);
assert.throws(()=>admitPostCompletionFollowupV1({root,campaignPath,directory:adm,requestPath,now:'2026-10-12T07:01:00Z'}),/actually COMPLETE/);
console.log(JSON.stringify({status:'PASS',sourceSha256:orig.sourceSha256,priorMasterPreserved:true,priorPhase10Preserved:true,newMasterRecord:result.recordPath,segmentId:result.pending.segmentId,sealCount:result.pending.sealedWorkForms.length}));
