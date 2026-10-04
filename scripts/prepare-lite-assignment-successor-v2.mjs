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
const controllerTreeUrl=p=>'https://github.com/CurveYield2/Audit-Controller/tree/'+encodeURIComponent(controllerRef)+'/'+encodeRepoPath(p);
const controllerBlobUrl=p=>'https://github.com/CurveYield2/Audit-Controller/blob/'+encodeURIComponent(controllerRef)+'/'+encodeRepoPath(p);
const logicalAuthorityHome=predecessor.authority?.homepagePath??assignment.workSchemaPath.replace(/\/phases\/phase-[^/]+\/[^/]+$/,'/SKILL.md');
let linkedAuthorityHome=logicalAuthorityHome;
const legacyLogical='Audit Skill - Current Authority/Audit_Litemode_v10.3/SKILL.md';
if(logicalAuthorityHome===legacyLogical&&!fs.existsSync(repoFile(root,legacyLogical)))linkedAuthorityHome='audit-process/v7/frozen-authorities/Audit_Litemode_v10.3/SKILL.md';
if(predecessor.authority?.homepagePath)requiredFile(root,logicalAuthorityHome,'bound successor authority homepage');
const campaignUrl=controllerTreeUrl(directory.workspacePath);
const requestPath='process/agent-upload/lite-phase-boundary/'+directory.campaignId+'-phase-'+assignment.phaseSequence+'.json';
const artifactLines=[
  'Bound authority homepage: '+controllerBlobUrl(linkedAuthorityHome),
  'Logical phase schema identity: '+controllerBlobUrl(assignment.workSchemaPath),
  'Phase work form: '+controllerBlobUrl(assignment.workFormPath),
  'Controller-owned final report target: '+controllerBlobUrl(assignment.finalReportPath),
  'Controller work packet: '+controllerBlobUrl(assignment.packetPath),
  'Sealed predecessor receipt: '+controllerBlobUrl(assignment.predecessorReceiptPath),
  ...(assignment.derivedInputPaths??[]).map(x=>'Controller-derived input: '+controllerBlobUrl(x))
];
const lines=[
  'LITE audit: '+directory.campaignName,
  'Reviewer: '+assignment.reviewer,
  'Current phase: '+assignment.phaseId,
  'Campaign: '+campaignUrl,
  ...artifactLines,
  '',
  'The exact bound authority homepage above is the ultimate authority for this audit. Follow every instruction it gives, in order, precisely, with no deviation. Use the GitHub connector app exactly as required by that authority.',
  '',
  'Start '+assignment.phaseId+' now. Use the sealed predecessor evidence and controller-derived inputs already present in the campaign. Do not redo sealed earlier phases.',
  'Submit validation through '+requestPath+'. Finalized controller validation: https://github.com/CurveYield2/Contract-Automation/blob/main/.github/workflows/lite-phase-work-packet-controller-v1.yml.',
  'Only CONTROLLER_PHASE_PASS permits advancement. If validation reports deficiencies, repair exactly the reported substantive deficiency and resubmit validation; do not seal, advance, or perform controller bookkeeping yourself.'
];
const wakeMessage=lines.join('\n');
process.stdout.write(JSON.stringify({status:'PASS',campaignId:directory.campaignId,campaignName:directory.campaignName,directoryPath:a['campaign-directory-path'],incomingPhaseId:assignment.phaseId,incomingPhaseSequence:assignment.phaseSequence,incomingReviewer:assignment.reviewer,wakeMessage,wakeMessageB64:Buffer.from(wakeMessage).toString('base64')})+'\n');
