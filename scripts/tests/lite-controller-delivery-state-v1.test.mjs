import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {writeAllSyncV1} from '../lib/lite-sync-stdout-v1.mjs';
import {storeControllerResultV1} from '../lib/lite-boundary-result-v1.mjs';
import {prepareControllerDeliveryReplayV1} from '../lite-controller-delivery-replay-v1.mjs';
import {publishedDeliveryStateV1,advanceDeliveryStateV1,DELIVERY_STATE_FILE_V1} from
 '../lib/lite-controller-delivery-state-v1.mjs';

const campaign='campaigns/demo r1',dirRel='Audit Campaign Directory/campaigns/demo.json';
const p=(root,rel)=>path.join(root,...rel.split('/'));
const init=()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'v13-delivery-'));
 fs.mkdirSync(path.dirname(p(root,dirRel)),{recursive:true});
 fs.writeFileSync(p(root,dirRel),JSON.stringify({
   schemaVersion:'curveyield-audit-campaign-directory-entry-v2',
   campaignId:'demo-r1',workspacePath:campaign,campaignStatus:'ACTIVE',
   currentAssignment:{phaseSequence:5,phaseId:'phase-5',reviewer:'reviewer-3',
    workSchemaPath:'Audit Skill - Current Authority/Audit_Litemode_v13/phases/phase-5/PHASE_05_SCHEMA_v1.json'}}));
 return root;
};
const read=root=>JSON.parse(fs.readFileSync(p(root,campaign+'/'+DELIVERY_STATE_FILE_V1),'utf8'));
const write=(root,body)=>fs.writeFileSync(p(root,campaign+'/'+DELIVERY_STATE_FILE_V1),JSON.stringify(body,null,2)+'\n');

test('5MB UTF-8 child output survives partial synchronous writes and EAGAIN intact',()=>{
 const message=JSON.stringify({status:'NEEDS_REWORK',entries:Array.from({length:190000},(_,i)=>'case:'+i+'π')})+'\n';
 assert.ok(Buffer.byteLength(message)>2*1024*1024);
 let chunks=[],calls=0,retries=0;
 const written=writeAllSyncV1(1,message,{writer:(_fd,data,offset,len)=>{
  calls++;
  if(calls%13===0){let error=new Error('temporary buffer full');error.code='EAGAIN';throw error;}
  const n=Math.min(16381,len);
  chunks.push(Buffer.from(data.subarray(offset,offset+n)));return n;
 },onRetry:()=>{retries++;}});
 assert.equal(written,Buffer.byteLength(message));
 assert.ok(calls>200);assert.ok(retries>0);
 assert.deepEqual(JSON.parse(Buffer.concat(chunks).toString()),JSON.parse(message));
});

test('v13 ledger refuses stale reviewer rework, duplicate claims and acknowledged replay',()=>{
 const root=init();
 try{
  const report=x=>storeControllerResultV1({root,campaignPath:campaign,response:{
   status:'NEEDS_REWORK',campaignId:'demo-r1',phaseSequence:5,reviewer:'reviewer-3',
   feedbackText:'Please inspect '+x+' and resubmit.'}});
  const first=report('first');
  const a=publishedDeliveryStateV1({root,campaignPath:campaign,envelope:first,
   requestId:'GH-1',reviewKind:'phase',phaseSequence:5,reviewer:'reviewer-3',
   now:'2026-10-16T08:00:00Z'});
  const replayA=prepareControllerDeliveryReplayV1({root,directoryRel:dirRel,detailRef:first.detailRef});
  assert.equal(replayA.wakeId,a.wakeId);
  assert.equal(replayA.deliveryManaged,true);
  const second=report('newer');
  const b=publishedDeliveryStateV1({root,campaignPath:campaign,envelope:second,
   requestId:'GH-2',reviewKind:'phase',phaseSequence:5,reviewer:'reviewer-3',
   now:'2026-10-16T08:01:00Z'});
  assert.throws(()=>prepareControllerDeliveryReplayV1({root,directoryRel:dirRel,detailRef:first.detailRef}),
   /stale or unregistered/);
  assert.equal(prepareControllerDeliveryReplayV1({root,directoryRel:dirRel,detailRef:second.detailRef}).wakeId,b.wakeId);
  let ledger=read(root);
  ledger=advanceDeliveryStateV1({ledger,resultSha256:b.resultSha256,wakeId:b.wakeId,
   to:'CLAIM',claimId:'replay-1',now:'2026-10-16T08:02:00Z'});
  write(root,ledger);
  assert.throws(()=>advanceDeliveryStateV1({ledger,resultSha256:b.resultSha256,wakeId:b.wakeId,
   to:'CLAIM',claimId:'replay-2',now:'2026-10-16T08:03:00Z'}),/already claimed/);
  ledger=advanceDeliveryStateV1({ledger,resultSha256:b.resultSha256,wakeId:b.wakeId,
   to:'DELIVERED',now:'2026-10-16T08:04:00Z'});
  write(root,ledger);
  assert.equal(read(root).results[b.resultSha256].state,'DELIVERED');
  assert.deepEqual(read(root).results[b.resultSha256].transitions.map(x=>x.state),
   ['COMPUTED','PUBLISHED','DELIVERED']);
  assert.throws(()=>prepareControllerDeliveryReplayV1({root,directoryRel:dirRel,detailRef:second.detailRef}),
   /already acknowledged/);
  assert.throws(()=>advanceDeliveryStateV1({ledger,resultSha256:b.resultSha256,wakeId:b.wakeId,
   to:'CLAIM',claimId:'replay-3',now:'2026-10-16T08:22:00Z'}),/cannot replay delivered/);
 }finally{fs.rmSync(root,{force:true,recursive:true});}
});

test('v12 without ledger stays on original legacy replay protocol',()=>{
 const root=init();
 try{
  const directory=JSON.parse(fs.readFileSync(p(root,dirRel),'utf8'));
  directory.currentAssignment.workSchemaPath='Audit Skill - Current Authority/Audit_Litemode_v12/phases/phase-5/PHASE_05_SCHEMA_v1.json';
  fs.writeFileSync(p(root,dirRel),JSON.stringify(directory));
  const envelope=storeControllerResultV1({root,campaignPath:campaign,response:{
   status:'NEEDS_REWORK',campaignId:'demo-r1',phaseSequence:5,reviewer:'reviewer-3',
   feedbackText:'frozen legacy message'}});
  const replay=prepareControllerDeliveryReplayV1({root,directoryRel:dirRel,detailRef:envelope.detailRef});
  assert.equal(replay.deliveryManaged,false);
  assert.equal(replay.wakeId,'demo-r1-delivery-replay-'+envelope.sha256.slice(0,20));
 }finally{fs.rmSync(root,{force:true,recursive:true});}
});
