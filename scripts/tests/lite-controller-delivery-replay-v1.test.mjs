import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {storeControllerResultV1} from '../lib/lite-boundary-result-v1.mjs';
import {prepareControllerDeliveryReplayV1} from '../lite-controller-delivery-replay-v1.mjs';

test('delivery retry reads published status without invoking controller or resealing',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'delivery-replay-'));
 const campaignPath='campaigns/demo r1',directoryRel='Audit Campaign Directory/campaigns/demo.json';
 try{
  const dirFile=path.join(root,directoryRel);
  fs.mkdirSync(path.dirname(dirFile),{recursive:true});
  const directory={schemaVersion:'curveyield-audit-campaign-directory-entry-v2',
   campaignId:'demo-r1',workspacePath:campaignPath,campaignStatus:'ACTIVE',
   currentAssignment:{phaseSequence:5,phaseId:'phase-5',reviewer:'reviewer-2'}};
  fs.writeFileSync(dirFile,JSON.stringify(directory));
  const response={status:'NEEDS_REWORK',campaignId:'demo-r1',phaseSequence:5,
    reviewer:'reviewer-2',feedbackText:'Fix oracle for CAND-021'};
  const envelope=storeControllerResultV1({root,campaignPath,response});
  const args={root,directoryRel,detailRef:envelope.detailRef};
  const first=prepareControllerDeliveryReplayV1(args);
  assert.equal(first.kind,'REVIEWER');
  assert.equal(first.role,'reviewer-2');
  assert.equal(first.state,'PUBLISHED_AWAITING_DELIVERY');
  assert.equal(Buffer.from(first.messageB64,'base64').toString(),response.feedbackText);
  assert.deepEqual(prepareControllerDeliveryReplayV1(args),first);
  const receipts=path.join(root,campaignPath,'receipts');
  assert.ok(!fs.existsSync(receipts),'replay must not create new receipts');
  directory.currentAssignment.reviewer='reviewer-3';
  fs.writeFileSync(dirFile,JSON.stringify(directory));
  assert.throws(()=>prepareControllerDeliveryReplayV1(args),/stale reviewer rework/);
  directory.currentAssignment.reviewer='reviewer-2';
  fs.writeFileSync(dirFile,JSON.stringify(directory));
  const rawPage=path.join(root,campaignPath,'controller/results',envelope.sha256.slice(0,20),'page-0001_v1.bin');
  fs.appendFileSync(rawPage,'tamper');
  assert.throws(()=>prepareControllerDeliveryReplayV1(args),/page integrity failure/);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
