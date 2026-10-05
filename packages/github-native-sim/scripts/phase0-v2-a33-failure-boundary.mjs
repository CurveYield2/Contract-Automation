#!/usr/bin/env node
import fs from 'node:fs/promises';
import fss from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const root=path.resolve('.');
const outRoot=path.resolve(process.argv[2]??'.audit-evidence/phase0-v2-a33');
const controllerRoot=path.join(outRoot,'controller-fixture');
const campaignPath='campaigns/phase0-v2-a33-fixture';
const campaignRoot=path.join(controllerRoot,...campaignPath.split('/'));
const receiptPath=path.join(campaignRoot,'receipts/PHASE_00_RECEIPT_v1.json');
const directoryPath=path.join(controllerRoot,'Audit Campaign Directory/campaigns/a33-fixture.json');
const qualificationPath=path.join(outRoot,'FAILED_REQUIRED_LANE_v1.json');
const safeObservationPath=path.join(outRoot,'INDEPENDENT_SAFE_OBSERVATION_v1.json');
const assertThat=(v,m)=>{if(!v)throw new Error('PHASE0_V2_A33: '+m);};

await fs.rm(outRoot,{recursive:true,force:true});
await fs.mkdir(path.dirname(receiptPath),{recursive:true});
await fs.mkdir(path.dirname(directoryPath),{recursive:true});

const receipt={
  schemaVersion:'curveyield-lite-phase-receipt-v1',
  campaign:{campaignId:'phase0-v2-a33-fixture',campaignGenerationId:'phase0-v2-a33-fixture-g1',campaignName:'Phase0 v2 A33 Fixture',workspacePath:campaignPath,campaignDirectoryEntryPath:'Audit Campaign Directory/campaigns/a33-fixture.json',mode:'LITE'},
  phase:{sequence:0,id:'phase-0',revision:1,status:'ACTIVE'},
  source:{sha256:'a'.repeat(64)},
  authority:{homepagePath:'Audit Skill - Current Authority/Audit_Litemode_v10.3/SKILL.md'},
  outputs:[],automation:[],obligations:{due:[]}
};
const directory={schemaVersion:'curveyield-audit-campaign-directory-entry-v2',campaignId:receipt.campaign.campaignId,campaignGenerationId:receipt.campaign.campaignGenerationId,campaignName:receipt.campaign.campaignName,workspacePath:campaignPath,campaignStatus:'PHASE0_ACTIVE'};
await fs.writeFile(receiptPath,JSON.stringify(receipt,null,2)+'\n');
await fs.writeFile(directoryPath,JSON.stringify(directory,null,2)+'\n');
await fs.writeFile(qualificationPath,JSON.stringify({schemaVersion:'phase0-v2-required-lane-failure-v1',status:'FAIL',qualifiedCommit:process.env.GITHUB_SHA??'fixture',failure:{lane:'REQUIRED_PHASE0_ACCEPTANCE',code:'INTENTIONAL_A33_FAULT'}},null,2)+'\n');

const receiptBefore=await fs.readFile(receiptPath,'utf8');
const directoryBefore=await fs.readFile(directoryPath,'utf8');
const finalizer=path.join(root,'scripts/lite-phase0-finalize-v1.mjs');
const result=spawnSync(process.execPath,[finalizer,
  '--controller-root',controllerRoot,
  '--campaign-path',campaignPath,
  '--qualification-path',qualificationPath,
  '--contract-automation-sha',process.env.GITHUB_SHA??'fixture',
  '--workflow-run-id',process.env.GITHUB_RUN_ID??'1'
],{cwd:root,encoding:'utf8',env:{...process.env}});
assertThat(result.status!==0,'faulted required lane unexpectedly finalized');
assertThat(/qualification is not PASS/i.test(String(result.stderr)+String(result.stdout)),'finalizer did not fail at required acceptance boundary');

await fs.writeFile(safeObservationPath,JSON.stringify({schemaVersion:'phase0-v2-independent-safe-observation-v1',status:'PASS',observation:'INDEPENDENT_SAFE_WORK_COMPLETED_AFTER_REQUIRED_LANE_FAILURE',failedEvidenceRef:path.basename(qualificationPath)},null,2)+'\n');

const receiptAfter=await fs.readFile(receiptPath,'utf8');
const directoryAfter=await fs.readFile(directoryPath,'utf8');
assertThat(receiptAfter===receiptBefore,'failed finalization mutated Phase-0 receipt');
assertThat(directoryAfter===directoryBefore,'failed finalization mutated campaign directory');
assertThat(fss.existsSync(qualificationPath),'failed required-lane evidence did not survive');
assertThat(fss.existsSync(safeObservationPath),'independent safe observation did not finish');
assertThat(!fss.existsSync(path.join(campaignRoot,'work/phase-01')),'successor Phase-1 work packet was created after failed acceptance');
const parsedReceipt=JSON.parse(receiptAfter);
assertThat(parsedReceipt.phase.status==='ACTIVE','failed acceptance changed phase status');
assertThat(parsedReceipt.handoff===undefined,'failed acceptance created successor handoff');

const output={
  schemaVersion:'curveyield-phase0-v2-a33-failure-boundary-v1',
  status:'PASS',
  requiredLaneFault:{exitCode:result.status,evidenceRef:path.basename(qualificationPath)},
  independentSafeObservation:{status:'PASS',evidenceRef:path.basename(safeObservationPath)},
  finalizer:{receiptUnchanged:true,campaignDirectoryUnchanged:true,successorPacketCreated:false,handoffCreated:false,phaseStatus:parsedReceipt.phase.status},
  workflowRunId:process.env.GITHUB_RUN_ID??null,
  qualifiedCommit:process.env.GITHUB_SHA??null
};
await fs.writeFile(path.join(outRoot,'PHASE0_V2_A33_FAILURE_BOUNDARY_v1.json'),JSON.stringify(output,null,2)+'\n');
process.stdout.write(JSON.stringify(output,null,2)+'\n');
