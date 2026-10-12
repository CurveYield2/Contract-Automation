#!/usr/bin/env node
// Controller-only preparation step. Determine whether a master amendment
// genuinely needs a new V7 runner rather than installing a toolchain merely
// because a Phase-5-containing segment was amended.
import fs from 'node:fs';
import path from 'node:path';
import {
  selectReusablePhase5TargetsV1,verifiedReusablePhase5ResultV1
} from '../packages/github-native-sim/src/lite-boundary-artifacts-v1.mjs';
const [root,campaignPath,campaignId,sourceSha256]=process.argv.slice(2);
if(!root||!campaignPath||!campaignId||!sourceSha256)throw new Error('expected controller root, campaign path/id, and source SHA-256');
const read=(rel)=>JSON.parse(fs.readFileSync(path.join(root,campaignPath,rel),'utf8'));
const canonical4=read('derived/phase-4/PHASE_04_CANONICAL_DATA_v1.json');
const canonical5=read('derived/phase-5/PHASE_05_CANONICAL_DATA_v1.json');
const current4=read('work/phase-04/PHASE_04_WORK_FORM_v1.json');
const current5=read('work/phase-05/PHASE_05_WORK_FORM_v1.json');
const out=(o,k)=>o?.actions?.[k]?.outputs??{};
const oldTargets=out(canonical5,'step-3').targetDesigns??[];
const targets=out(current5,'step-3').targetDesigns??[];
const reusable=new Set(selectReusablePhase5TargetsV1({
  priorTargetDesigns:oldTargets,targetDesigns:targets,
  priorCandidateRecords:[...(out(canonical4,'step-3').candidateRecords??[]),...(out(canonical5,'step-2').newCandidateRecords??[])],
  candidateRecords:[...(out(current4,'step-3').candidateRecords??[]),...(out(current5,'step-2').newCandidateRecords??[])]
}));
const unverified=[];
for(const target of targets){
  if(target?.executionMethod!=='V7_REQUEST')continue;
  const key=String(target.candidateKey??'').trim();
  if(!key||!reusable.has(key)||!verifiedReusablePhase5ResultV1({
    controllerRoot:root,campaignPath,target,
    expectedCampaignId:campaignId,expectedSourceSha256:sourceSha256
  }))unverified.push(key||'MISSING_CANDIDATE_KEY');
}
const decision={requiresExecution:unverified.length>0,reuseCount:reusable.size,unverified};
process.stdout.write(JSON.stringify(decision)+'\n');
