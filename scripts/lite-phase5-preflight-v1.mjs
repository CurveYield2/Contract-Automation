#!/usr/bin/env node
// Dependency-free, read-only Phase-5 gate; runs BEFORE npm ci and V7 setup.
import fs from 'node:fs';
import path from 'node:path';
import {validateTargetExecutionRequestBindingV1} from '../packages/github-native-sim/src/lite-boundary-artifacts-v1.mjs';
const [root,campaignPath,campaignId,sourceSha256]=process.argv.slice(2);
if(!root||!/^campaigns\//.test(campaignPath??'')||!campaignId||!/^[a-f0-9]{64}$/i.test(sourceSha256??''))
  throw new Error('Usage: node scripts/lite-phase5-preflight-v1.mjs ROOT campaigns/PATH CAMPAIGN_ID SOURCE_SHA256');
const read=rel=>JSON.parse(fs.readFileSync(path.join(root,campaignPath,rel),'utf8'));
const form=read('work/phase-05/PHASE_05_WORK_FORM_v1.json');
const designs=form?.actions?.['step-3']?.outputs?.targetDesigns;
const failures=[],ready=[];
if(!Array.isArray(designs)||!designs.length)failures.push({path:'actions.step-3.outputs.targetDesigns',reason:'Missing target designs'});
else for(const [index,target] of designs.entries()){
  const prefix='targetDesigns['+index+']';
  const key=String(target?.candidateKey??'').trim();
  if(!key){failures.push({path:prefix+'.candidateKey',reason:'Missing candidate'});continue;}
  const method=String(target.executionMethod??'');
  if(method==='NOT_APPLICABLE')continue;
  if(method!=='V7_REQUEST'){failures.push({path:prefix+'.executionMethod',reason:'Unsupported method'});continue;}
  const binding=validateTargetExecutionRequestBindingV1({controllerRoot:root,campaignPath,
    target,expectedCampaignId:campaignId,expectedSourceSha256:sourceSha256});
  if(!binding.status.startsWith('PASS_'))
    failures.push({path:prefix+'.executionRequestRef',candidateKey:key,reason:binding.status,
      details:binding.reasons});
  else ready.push(key);
}
const report={status:failures.length?'REWORK_REQUIRED':'PREFLIGHT_PASS',runnable:ready.length>0,
  designCount:designs?.length??0,readyCount:ready.length,failures};
process.stdout.write(JSON.stringify(report)+'\n');
if(failures.length)process.exitCode=2;
