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
const encodeRepoPath=p=>String(p).split('/').map(encodeURIComponent).join('/');
const controllerFileUrl=p=>'https://github.com/CurveYield2/Audit-Controller/blob/'+encodeURIComponent(controllerRef)+'/'+encodeRepoPath(p);
const controllerTreeUrl=p=>'https://github.com/CurveYield2/Audit-Controller/tree/'+encodeURIComponent(controllerRef)+'/'+encodeRepoPath(p);
const authorityUrl=controllerTreeUrl('Audit Skill - Current Authority');
const validationRequestPath='process/agent-upload/lite-phase-boundary/'+directory.campaignId+'-phase-'+assignment.phaseSequence+'.json';
const campaignUrl=controllerTreeUrl(directory.workspacePath);
const validationUrl='https://github.com/CurveYield2/Contract-Automation/blob/main/.github/workflows/lite-phase-work-packet-controller-v1.yml';
const workFormUrl=controllerFileUrl(assignment.workFormPath);
const schemaUrl=controllerFileUrl(assignment.workSchemaPath);
const finalReportUrl=controllerFileUrl(assignment.finalReportPath);
const packetUrl=controllerFileUrl(assignment.packetPath);
const predecessorUrl=controllerFileUrl(assignment.predecessorReceiptPath);
const derivedInputLinks=(Array.isArray(assignment.derivedInputPaths)?assignment.derivedInputPaths:[]).map((p,i)=>'Phase input '+(i+1)+': '+controllerFileUrl(p));
const lines=[
  'LITE audit: '+directory.campaignName,
  'Reviewer: '+assignment.reviewer,
  'Current phase: '+assignment.phaseId,
  'Campaign: '+campaignUrl,
  'Current Audit Skill Authority: '+authorityUrl,
  'Finalized controller validation: '+validationUrl,
  '',
  'The Audit Skill Authority above is the ultimate authority for this audit. Follow every instruction it gives, in order, precisely, with no deviation. Use the GitHub connector app exactly as required by that authority.',
  '',
  'Start '+assignment.phaseId+' now. Use the sealed predecessor evidence and controller-derived inputs already present in the campaign. Do not redo sealed earlier phases.',
  '',
  'Phase schema: '+schemaUrl,
  'Assigned work form: '+workFormUrl,
  'Controller-owned final report: '+finalReportUrl,
  'Controller-owned Phase Work Packet: '+packetUrl,
  'Sealed predecessor receipt: '+predecessorUrl,
  ...derivedInputLinks,
  '',
  'Complete only '+assignment.phaseId+'. Fill every required reviewer-owned Step X Input field while performing the work. Preserve controller-prefilled/read-only data. Do not perform controller bookkeeping and do not create or edit controller-owned reports, packets, receipts, routing, or handoff state.',
  '',
  'At phase end you MUST invoke the finalized controller validation above by creating/updating '+validationRequestPath+' in CurveYield2/Contract-Automation main using the current lite phase-boundary request schema.',
  'You are not finished until validation returns CONTROLLER_PHASE_PASS. If validation reports any deficiency, repair exactly the reported substantive deficiency, resubmit validation, and repeat until CONTROLLER_PHASE_PASS. Do not advance, retire, or hand off before PASS.',
  '',
  'Begin immediately.'
];
const wakeMessage=lines.join('\n');
process.stdout.write(JSON.stringify({status:'PASS',campaignId:directory.campaignId,campaignName:directory.campaignName,directoryPath:a['campaign-directory-path'],incomingPhaseId:assignment.phaseId,incomingPhaseSequence:assignment.phaseSequence,incomingReviewer:assignment.reviewer,wakeMessage,wakeMessageB64:Buffer.from(wakeMessage).toString('base64')})+'\n');
