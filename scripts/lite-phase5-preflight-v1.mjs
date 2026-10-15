#!/usr/bin/env node
// Dependency-free, read-only pre-toolchain Phase-5 execution gate. Creates only
// fully schema-valid V7 requests from complete, source-bound executable designs.
import fs from 'node:fs';
import path from 'node:path';
import {generateV7ExecutionRequestV1} from './lib/lite-phase5-request-generation-v1.mjs';
import {materializeShardedWorkFormV1,shardWorkFormV1} from './lib/lite-work-shards-v1.mjs';
import {validateTargetExecutionRequestBindingV1} from '../packages/github-native-sim/src/lite-boundary-artifacts-v1.mjs';

const [root,campaignPath,campaignId,sourceSha256]=process.argv.slice(2);
if(!root||!/^campaigns\//.test(campaignPath??'')||!campaignId||!/^[a-f0-9]{64}$/i.test(sourceSha256??''))
  throw new Error('Usage: node scripts/lite-phase5-preflight-v1.mjs ROOT campaigns/PATH CAMPAIGN_ID SOURCE_SHA256');
const fullRel=path.posix.join(campaignPath,'work/phase-05/PHASE_05_WORK_FORM_v1.json');
const fullFile=path.join(root,...fullRel.split('/'));
const indexRel=path.posix.join(campaignPath,'work/phase-05/shards/INDEX_v1.json');
const indexFile=path.join(root,...indexRel.split('/'));
const sharded=fs.existsSync(indexFile);
if(sharded)materializeShardedWorkFormV1({root,formRel:fullRel,refreshDigests:true});
const read=rel=>JSON.parse(fs.readFileSync(path.join(root,campaignPath,rel),'utf8'));
const phase0=read('receipts/PHASE_00_RECEIPT_v1.json');
const form=read('work/phase-05/PHASE_05_WORK_FORM_v1.json');
const designs=form?.actions?.['step-3']?.outputs?.targetDesigns;
const failures=[],ready=[],generated=[];
const shardFor=(index,key)=>{
  for(const s of index?.shards??[])if(s.recordKeys.some(x=>x.includes('candidateKey='+key)))
    return path.posix.join(path.posix.dirname(indexRel),s.file);
  return null;
};
const index=sharded?JSON.parse(fs.readFileSync(indexFile,'utf8')):null;

if(!Array.isArray(designs)||!designs.length)
  failures.push({path:'actions.step-3.outputs.targetDesigns',reason:'Missing target designs'});
else for(const [i,target] of designs.entries()){
  const prefix='targetDesigns['+i+']';
  const key=String(target?.candidateKey??'').trim();
  const shardPath=shardFor(index,key);
  const fail=(path,reason,details=[])=>failures.push({path,candidateKey:key,shardPath,reason,details});
  if(!key){fail(prefix+'.candidateKey','Missing candidate');continue;}
  const method=String(target.executionMethod??'');
  if(method==='NOT_APPLICABLE')continue;
  if(method!=='V7_REQUEST'){fail(prefix+'.executionMethod','Unsupported method');continue;}
  if(!target.executionRequestRef){
    const generatedRequest=generateV7ExecutionRequestV1({
      campaignId,sourceSha256,phase0Source:phase0.source,target});
    if(generatedRequest.status!=='GENERATED'){
      for(const item of generatedRequest.missing)fail(prefix+'.'+item.field,item.reason);
      continue;
    }
    const safe=key.replace(/[^A-Za-z0-9._-]/g,'_');
    const rel='work/phase-05/execution-requests/'+safe+'.json';
    const out=path.join(root,campaignPath,rel);
    fs.mkdirSync(path.dirname(out),{recursive:true});
    const content=JSON.stringify(generatedRequest.request,null,2)+'\n';
    if(!fs.existsSync(out)||fs.readFileSync(out,'utf8')!==content)
      fs.writeFileSync(out,content);
    // Do not change reviewer work or its controller prefill digest in preflight.
    // The existing controller resolver owns the executionRequestRef mutation.
    generated.push({candidateKey:key,executionRequestRef:rel,shardPath});
  }
  const candidateRef=target.executionRequestRef||(generated.some(x=>x.candidateKey===key)?
    generated.find(x=>x.candidateKey===key).executionRequestRef:null);
  const binding=validateTargetExecutionRequestBindingV1({controllerRoot:root,campaignPath,
    target:{...target,executionRequestRef:candidateRef},expectedCampaignId:campaignId,
    expectedSourceSha256:sourceSha256});
  if(!binding.status.startsWith('PASS_'))
    fail(prefix+'.executionRequestRef',binding.status,binding.reasons);
  else ready.push(key);
}

if(sharded)shardWorkFormV1({root,formRel:fullRel,phase:5,retireFull:true,force:true});
const report={status:failures.length?'REWORK_REQUIRED':'PREFLIGHT_PASS',runnable:ready.length>0,
  designCount:designs?.length??0,readyCount:ready.length,generated,failures,
  ...(sharded?{workShardIndexPath:indexRel}:{})};
process.stdout.write(JSON.stringify(report)+'\n');
if(failures.length)process.exitCode=2;
