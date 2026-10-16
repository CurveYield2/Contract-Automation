import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {validateFlowReviewSubmissionV1,validateAttackSubmissionV1}
  from '../../packages/github-native-sim/src/adr-discovery-validators-v1.mjs';
import {storeControllerResultV1,restoreControllerResultV1}
  from '../lib/lite-boundary-result-v1.mjs';

const repo=fileURLToPath(new URL('../../',import.meta.url));
const realRoot=process.env.AC_R4_ROOT;
const campaign='campaigns/cyavKATv25b r4';
const read=(root,rel)=>JSON.parse(fs.readFileSync(path.join(root,rel),'utf8'));

test('actual frozen r4 78 submitted discovery units retain accepted v12 validation', {skip:!realRoot},()=>{
 const inventory=read(realRoot,campaign+'/evidence/review-inventory/scope-corrected/REVIEW_INVENTORY_v1.json');
 const dir=path.join(realRoot,campaign,'work/phase-04/discovery');
 const unitIds=fs.readdirSync(dir,{withFileTypes:true}).filter(x=>x.isDirectory()&&
   fs.existsSync(path.join(dir,x.name,'SUBMISSION_v1.json'))).map(x=>x.name).sort();
 assert.equal(unitIds.length,78,'real accepted v12 discovery unit count changed');
 let accepted=0;
 const rejected=[];
 for(const id of unitIds){
   const packet=read(realRoot,campaign+'/work/phase-04/discovery/'+id+'/ASSIGNMENT_PACKET_v1.json').payload;
   const submission=read(realRoot,campaign+'/work/phase-04/discovery/'+id+'/SUBMISSION_v1.json');
   const result=packet.role==='ATTACK'
     ?validateAttackSubmissionV1({packet,submission,inventory})
     :validateFlowReviewSubmissionV1({packet,submission,inventory});
   if(result.ok)accepted++;else rejected.push({id,errors:result.errors.slice(0,2)});
 }
 assert.deepEqual(rejected,[],'frozen v12 submissions changed validation outcome');
 console.log('R4_REAL_DISCOVERY_V12_VALIDATED='+accepted+'/78');
});

test('actual frozen r4 Phase-5 preflight gives bounded design rework, not module-crash', {skip:!realRoot},()=>{
 const phase0=read(realRoot,campaign+'/receipts/PHASE_00_RECEIPT_v1.json');
 const form=read(realRoot,campaign+'/work/phase-05/PHASE_05_WORK_FORM_v1.json');
 const targets=form?.actions?.['step-3']?.outputs?.targetDesigns??[];
 assert.equal(targets.length,323,'r4 323-target workload changed');
 const proc=spawnSync(process.execPath,[
    path.join(repo,'scripts/lite-phase5-preflight-v1.mjs'),
    path.resolve(realRoot),campaign,phase0.campaign.campaignId,phase0.source.sha256
 ],{encoding:'utf8',maxBuffer:12*1024*1024,timeout:120000});
 assert.ok([0,2].includes(proc.status),'preflight crashed: '+String(proc.stderr).slice(0,900));
 const report=JSON.parse(proc.stdout);
 assert.equal(report.designCount,323);
 assert.ok(['REWORK_REQUIRED','PREFLIGHT_PASS'].includes(report.status));
 assert.ok(report.failures.every(x=>!String(x.reason).includes('file does not exist')),
   'unresolved placeholder was incorrectly treated as a real file');
 console.log('R4_REAL_PHASE5 status='+report.status+' designs='+report.designCount+
   ' ready='+report.readyCount+' rework='+report.failures.length);
});

test('real r4 campaign identity restores all controller statuses', {skip:!realRoot},()=>{
 const phase0=read(realRoot,campaign+'/receipts/PHASE_00_RECEIPT_v1.json');
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'r4-envelope-'));
 try{
   for(const status of ['DISCOVERY_NEXT','DISCOVERY_PARTIAL','DISCOVERY_COMPLETE',
      'DISCOVERY_STALE_REQUEST','MASTER_REVIEW_INVALID','ALREADY_ACCEPTED',
      'CONTROLLER_ERROR','NEEDS_REWORK','PASS']){
     const response={status,campaignId:phase0.campaign.campaignId,realR4Source:phase0.source.sha256};
     const envelope=storeControllerResultV1({root,campaignPath:campaign,response});
     assert.deepEqual(restoreControllerResultV1({root,campaignPath:campaign,envelope}),response);
   }
   const legacy={status:'DISCOVERY_STALE_REQUEST'};
   const env=storeControllerResultV1({root,campaignPath:campaign,response:legacy});
   assert.deepEqual(restoreControllerResultV1({root,campaignPath:campaign,envelope:env}),legacy);
   console.log('R4_REAL_ENVELOPES=10/10');
 }finally{fs.rmSync(root,{force:true,recursive:true});}
});
