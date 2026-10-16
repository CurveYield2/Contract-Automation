import test from 'node:test';
import assert from 'node:assert/strict';
import {planBackupChatFailoverV1} from '../../../scripts/browser-backup-failover-v1.mjs';

const failed='https://chatgpt.com/c/aaaaaaaa-bbbb';
const backup='https://chatgpt.com/c/cccccccc-dddd';
const fixture=()=>({
 registration:{campaignId:'demo-r1',agentChats:{'reviewer-3':failed,backup},
   activeChat:{name:'reviewer-3',url:failed},
   activeAssignment:{phaseId:'phase-5',milestoneId:'PHASE_5_WORK_PACKET',reviewer:'reviewer-3',workerRole:'reviewer'}},
 directory:{campaignId:'demo-r1',campaignStatus:'ACTIVE',
  currentAssignment:{phaseSequence:5,reviewer:'reviewer-3',status:'ACTIVE',
   workShardIndexPath:'campaigns/demo r1/work/phase-05/shards/INDEX_v1.json'}}});
test('D4 registered standby consumes one backup; role/phase and sharded wake intact',()=>{
 const f=fixture(),x=planBackupChatFailoverV1({...f,failedChatUrl:failed,now:'2026-10-15T00:00:00Z'});
 assert.equal(x.status,'ELIGIBLE',x.reason);
 assert.equal(x.registration.agentChats['reviewer-3'],backup);
 assert.equal(x.registration.retiredChats['reviewer-3'],failed);
 assert.equal(x.registration.activeChat.url,backup);
 assert.equal(x.registration.backupFailover.status,'USED');
 assert.match(x.message,/INDEX_v1.json/);
 assert.match(x.message,/ONE phase boundary request/);
 assert.equal(planBackupChatFailoverV1({registration:x.registration,directory:f.directory,
  failedChatUrl:backup,now:'2026-10-15T00:05:00Z'}).status,'NOT_ELIGIBLE');
});
test('D4 rejects unregistered, already-owned, stale and cross-campaign backups',()=>{
 const f=fixture();
 delete f.registration.agentChats.backup;
 assert.equal(planBackupChatFailoverV1({...f,failedChatUrl:failed}).status,'NOT_ELIGIBLE');
 f.registration.agentChats.backup=backup;
 f.registration.agentChats['reviewer-2']=backup;
 assert.equal(planBackupChatFailoverV1({...f,failedChatUrl:failed}).status,'NOT_ELIGIBLE');
 delete f.registration.agentChats['reviewer-2'];
 assert.equal(planBackupChatFailoverV1({...f,failedChatUrl:'https://chatgpt.com/c/stale'}).status,'NOT_ELIGIBLE');
 f.directory.campaignId='unrelated';
 assert.equal(planBackupChatFailoverV1({...f,failedChatUrl:failed}).status,'NOT_ELIGIBLE');
});
