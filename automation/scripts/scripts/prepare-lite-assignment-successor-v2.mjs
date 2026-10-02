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
const lines=[
  'Campaign type: LITE',
  'Campaign name: '+directory.campaignName,
  'Campaign folder URL: https://github.com/CurveYield2/Audit-Controller/tree/'+controllerRef+'/'+directory.workspacePath.replaceAll(' ','%20'),
  'Campaign ID / generation: '+directory.campaignId+' / '+directory.campaignGenerationId,
  'Incoming reviewer: '+assignment.reviewer,
  'Assigned phase: '+assignment.phaseId,
  'Current authority: '+authorityUrl,
  'Predecessor sealed receipt: '+assignment.predecessorReceiptPath,
  'Phase schema: '+assignment.workSchemaPath,
  'Phase work form: '+assignment.workFormPath,
  'Controller-owned phase final report path: '+(assignment.finalReportPath??'NONE_AUTOMATION_ONLY'),
  'Controller-owned phase packet path: '+assignment.packetPath,
  'Automation-derived input files: '+(assignment.derivedInputPaths.length?assignment.derivedInputPaths.join(', '):'NONE'),
  'Controller validation request path: automation/control-plane/agent-upload/lite-phase-boundary/'+directory.campaignId+'-phase-'+assignment.phaseSequence+'.json in CurveYield2/Contract-Automation main',
  'Controller validation request schema: {"schemaVersion":"curveyield-lite-phase-boundary-request-v1","campaignId":"'+directory.campaignId+'","phaseSequence":'+assignment.phaseSequence+',"auditControllerRef":"'+controllerRef+'","attempt":<increment on each validation request>}',
  'Use the GitHub connector app. Perform only the assigned phase. Every agent action must fill its schema-defined Step X Input fields while the action is performed. Preserve controller-prefilled/read-only data. Do not create or edit the Phase Work Packet or phase final report and do not perform controller bookkeeping. At phase end invoke controller validation by creating/updating the request path above; on rework increment attempt and update the same request. Repair only exact substantive deficiencies and wait for CONTROLLER_PHASE_PASS before advancing or retiring.'
];
const wakeMessage=lines.join('\n');
process.stdout.write(JSON.stringify({status:'PASS',campaignId:directory.campaignId,campaignName:directory.campaignName,directoryPath:a['campaign-directory-path'],incomingPhaseId:assignment.phaseId,incomingPhaseSequence:assignment.phaseSequence,incomingReviewer:assignment.reviewer,wakeMessage,wakeMessageB64:Buffer.from(wakeMessage).toString('base64')})+'\n');
