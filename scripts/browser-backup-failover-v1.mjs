#!/usr/bin/env node
import fs from 'node:fs';
const allowed=/^https:\/\/chatgpt\.com\/(?:c\/[A-Za-z0-9_-]+|g\/g-p-[A-Za-z0-9_-]+\/c\/[A-Za-z0-9_-]+)\/?$/;
const idOf=x=>String(x??'').trim();

export function planBackupChatFailoverV1({registration,directory,failedChatUrl,now}={}){
 const fail=(reason)=>({status:'NOT_ELIGIBLE',reason});
 if(!registration||!directory||directory.campaignId!==registration.campaignId)
  return fail('campaign binding mismatch');
 const assignment=directory.currentAssignment;
 if(!assignment||!['ACTIVE','WAITING_FOR_SUCCESSOR_AGENT'].includes(directory.campaignStatus)||
    !['ACTIVE','WAITING_FOR_SUCCESSOR_AGENT'].includes(assignment.status))
  return fail('no active reviewer assignment');
 const role=assignment.reviewer;
 if(!/^reviewer-[1-4](?:L)?$/.test(String(role??'')))return fail('invalid reviewer role');
 const current=registration.agentChats?.[role];
 if(!allowed.test(idOf(current))||current!==failedChatUrl)
  return fail('failed chat no longer bound to current reviewer role');
 const backup=registration.backupChatUrl??registration.agentChats?.['backup']??null;
 if(!allowed.test(idOf(backup)))return fail('no registered valid standby chat');
 if(backup===failedChatUrl)return fail('standby cannot equal failed chat');
 if(Object.entries(registration.agentChats??{}).some(([key,url])=>key!==role&&key!=='backup'&&url===backup))
  return fail('standby already owned by another active role');
 if(registration.backupFailover?.status==='USED')return fail('standby already consumed');
 const index=assignment.workShardIndexPath;
 const nextWork=index?('Read shard INDEX '+index+
   ' and BASE_v1.json. Complete every indexed shard in order and submit ONE phase boundary request after the final shard, without waiting for controller between shards.')
   :('Use the exact assigned work form at '+assignment.workFormPath+' and submit its existing boundary request only after all work is complete.');
 const message=['CONTROLLER_BACKUP_CHAT_HANDOFF: the prior reviewer chat did not acknowledge after the watchdog repair threshold.',
  'Campaign '+directory.campaignId+', role '+role+', current phase '+assignment.phaseSequence+'.',
  'Read the bound authority from the Phase-0 receipt; preserve frozen authority and sealed earlier phases.',
  nextWork,
  'Do not author tests as the test executor; continue only this reviewer role. Do not repeat earlier bookkeeping.'].join('\n');
 const updated=structuredClone(registration);
 updated.retiredChats={...(registration.retiredChats??{}),[role]:failedChatUrl};
 updated.agentChats={...registration.agentChats,[role]:backup};
 if(updated.agentChats.backup===backup)delete updated.agentChats.backup;
 updated.activeChat={...(updated.activeChat??{}),name:role,url:backup};
 updated.activeAssignment={...(updated.activeAssignment??{}),phaseId:'phase-'+assignment.phaseSequence,
  milestoneId:'PHASE_'+assignment.phaseSequence+'_WORK_PACKET',reviewer:role,workerRole:'reviewer'};
 updated.backupFailover={status:'USED',role,failedChatUrl,backupChatUrl:backup,
  assignedPhaseSequence:assignment.phaseSequence,usedAt:now};
 updated.updatedAt=now;
 return {status:'ELIGIBLE',role,backupChatUrl:backup,message,registration:updated};
}

if(process.argv[1]?.endsWith('/browser-backup-failover-v1.mjs')){
 const [registrationPath,directoryPath,failedChatUrl]=process.argv.slice(2);
 if(!registrationPath||!directoryPath||!failedChatUrl)throw Error('Usage: browser-backup-failover-v1.mjs REGISTRATION_JSON DIRECTORY_JSON FAILED_CHAT_URL');
 const planned=planBackupChatFailoverV1({
  registration:JSON.parse(fs.readFileSync(registrationPath,'utf8')),
  directory:JSON.parse(fs.readFileSync(directoryPath,'utf8')),failedChatUrl,
  now:new Date().toISOString()
 });
 process.stdout.write(JSON.stringify(planned)+'\n');
}
