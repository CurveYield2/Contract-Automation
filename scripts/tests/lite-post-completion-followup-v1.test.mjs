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
const observed=readJson(path.join(root,dirPath));
// Reconstruct the terminal snapshot when the live campaign has already been legitimately reopened.
// Never mutate the connected campaign: all admission assertions exercise an isolated in-memory copy.
const orig=structuredClone(observed);
if(orig.campaignStatus==='WAITING_FOR_MASTER_REVIEW'||orig.campaignStatus==='WAITING_FOR_TARGETED_TESTS'){
  assert.equal(orig.pendingMasterReview?.postCompletionFollowup?.originalCampaignStatus,'COMPLETE');
  assert.equal(orig.postCompletionFollowup?.originalCampaignStatus,'COMPLETE');
  assert.equal(orig.postCompletionFollowup?.segmentId,'reviewer-4-followup-v1');
  orig.lastAcceptedMasterReview=structuredClone(orig.postCompletionFollowup.originalAcceptedMasterReview);
  orig.campaignStatus='COMPLETE';
  orig.currentAssignment=null;
  delete orig.pendingMasterReview;
  delete orig.postCompletionFollowup;
}
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

// An admitted follow-up must be committed, not merely returned from an ephemeral controller checkout.
const workflow=fs.readFileSync(path.resolve('.github/workflows/lite-phase-work-packet-controller-v1.yml'),'utf8');
const publish=workflow.split('      - name: Publish validation response or successful phase transaction')[1]?.split('      - name: Resolve active reviewer chat')[0]??'';
assert.match(publish,/FOLLOWUP_ADMITTED/);
assert.match(publish,/git add --/);
