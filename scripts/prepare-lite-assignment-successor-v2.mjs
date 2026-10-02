#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {repoFile,requiredFile,readJson} from './lib/lite-phase-work-v1.mjs';

function parse(argv){const o={};for(let i=2;i<argv.length;i+=2){if(!argv[i]?.startsWith('--')||argv[i+1]===undefined) throw new Error('args must be --key value');o[argv[i].slice(2)]=argv[i+1];}return o;}
const a=parse(process.argv);
for(const k of ['controller-root','campaign-directory-path','audit-controller-ref']) if(!a[k]) throw new Error('missing --'+k);
const root=path.resolve(a['controller-root']);
const directory=readJson(requiredFile(root,a['campaign-directory-path'],'campaign directory entry'));
if(directory.schemaVersion!=='curveyield-audit-campaign-directory-entry-v2') throw new Error('assignment successor requires Audit Campaign Directory v2');
if(directory.campaignStatus!=='WAITING_FOR_SUCCESSOR_AGENT') throw new Error('campaign is not waiting for successor');
const assignment=directory.currentAssignment;
if(!assignment||assignment.status!=='WAITING_FOR_SUCCESSOR_AGENT') throw new Error('current assignment is not waiting for successor');
requiredFile(root,assignment.workSchemaPath,'incoming phase schema');
requiredFile(root,assignment.workFormPath,'incoming phase work form');
if(assignment.finalReportPath){
  const expectedPrefix=directory.workspacePath.replace(/\/+$/,'')+'/work/phase-'+String(assignment.phaseSequence).padStart(2,'0')+'/';
  if(!assignment.finalReportPath.startsWith(expectedPrefix)) throw new Error('incoming phase final report path is outside the assigned phase work directory');
  if(fs.existsSync(repoFile(root,assignment.finalReportPath))) throw new Error('incoming phase final report must not exist before reviewer semantic work; controller owns report generation at validation time');
}
const predecessor=readJson(requiredFile(root,assignment.predecessorReceiptPath,'sealed predecessor receipt'));
if(!['SEALED','SKIPPED'].includes(predecessor.phase?.status)) throw new Error('predecessor receipt is not sealed/skipped');
const controllerRef=a['audit-controller-ref'];
const authorityUrl='https://github.com/CurveYield2/Audit-Controller/tree/'+controllerRef+'/Audit%20Skill%20-%20Current%20Authority';
const campaignUrl='https://github.com/CurveYield2/Audit-Controller/tree/'+controllerRef+'/'+directory.workspacePath.replaceAll(' ','%20');
const validationPath='process/agent-upload/lite-phase-boundary/'+directory.campaignId+'-phase-'+assignment.phaseSequence+'.json';
const derivedInputs=assignment.derivedInputPaths.length?assignment.derivedInputPaths.join(', '):'NONE';
const lines=[
  'Start '+assignment.phaseId+' of the LITE audit for '+directory.campaignName+' as '+assignment.reviewer+'.',
  '',
  'Use the GitHub connector and follow the current Audit Skill Authority exactly:',
  authorityUrl,
  '',
  'Campaign: '+campaignUrl,
  'Sealed predecessor receipt: '+assignment.predecessorReceiptPath,
  'Phase work form: '+assignment.workFormPath,
  'Phase schema: '+assignment.workSchemaPath,
  'Phase-0-derived inputs: '+derivedInputs,
  '',
  'Do '+assignment.phaseId+' only. Fill the work form Step X Input fields as you perform the work. Preserve controller-prefilled/read-only data. Do not rebuild Phase 0 mechanical inventories, edit the controller-owned Phase Work Packet/final report, or perform controller bookkeeping.',
  '',
  'When the phase work is complete, trigger controller validation by creating/updating '+validationPath+' in CurveYield2/Contract-Automation main using schema curveyield-lite-phase-boundary-request-v1 for campaign '+directory.campaignId+' and phaseSequence '+assignment.phaseSequence+'. Increment attempt only for rework. If validation returns exact deficiencies, repair only those. Continue until CONTROLLER_PHASE_PASS; do not advance or retire before that.'
];
const wakeMessage=lines.join('\n');
process.stdout.write(JSON.stringify({status:'PASS',campaignId:directory.campaignId,campaignName:directory.campaignName,directoryPath:a['campaign-directory-path'],incomingPhaseId:assignment.phaseId,incomingPhaseSequence:assignment.phaseSequence,incomingReviewer:assignment.reviewer,wakeMessage,wakeMessageB64:Buffer.from(wakeMessage).toString('base64')})+'\n');
