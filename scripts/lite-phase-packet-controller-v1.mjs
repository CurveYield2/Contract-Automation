#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {
  readJson,writeJson,repoFile,requiredFile,authorityRootFromReceipt,loadPhaseSchema,
  validateWorkForm,validateFinalReport,ensurePacketShape,buildDerivedOutputs,preparePhaseWork,getByPath
} from './lib/lite-phase-work-v1.mjs';

function parse(argv){const o={};for(let i=2;i<argv.length;i+=2){if(!argv[i]?.startsWith('--')||argv[i+1]===undefined) throw new Error('args must be --key value');o[argv[i].slice(2)]=argv[i+1];}return o;}
function shaFile(file){return createHash('sha256').update(fs.readFileSync(file)).digest('hex');}
function phaseNum(n){return String(n).padStart(2,'0');}
function feedbackText(sequence,defs){return ['Phase '+sequence+' packet validation failed.','Repair only the exact items below and resubmit the same phase packet.','',...defs.map(x=>'- '+x),'','Do not advance, retire, update receipts, or perform controller bookkeeping.'].join('\n');}
function listFilesRecursive(dir){if(!fs.existsSync(dir)) return [];const out=[];for(const ent of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,ent.name);if(ent.isDirectory()) out.push(...listFilesRecursive(p));else if(ent.isFile()) out.push(p);}return out;}
function hasRemediation(campaignRoot){return listFilesRecursive(path.join(campaignRoot,'remediation')).length>0;}
function canonicalFamilyForField(name){return ({propertyDesigns:'PROP',attackHypotheses:'HYP',candidateRecords:'CAND',newCandidateRecords:'CAND',validatedFindings:'FIND',remediationDispositions:'REM'})[name]??null;}
function nextId(graph,family){let max=0;for(const n of graph.nodes??[]){const m=String(n.nodeId??'').match(new RegExp('^'+family+'-(\\d+)$'));if(m) max=Math.max(max,Number(m[1]));}return family+'-'+String(max+1).padStart(3,'0');}
function assignCanonicalIds(canonical,graph,phase){
  graph.nodes??=[];
  for(const [stepKey,row] of Object.entries(canonical.actions??{})){
    for(const [fieldName,value] of Object.entries(row.outputs??{})){
      const family=canonicalFamilyForField(fieldName);
      if(!family||!Array.isArray(value)) continue;
      for(let i=0;i<value.length;i++){
        const item=value[i];if(!item||typeof item!=='object'||Array.isArray(item)) continue;
        if(!item.canonicalId) item.canonicalId=nextId(graph,family);
        if(!(graph.nodes??[]).some(n=>n.nodeId===item.canonicalId)) graph.nodes.push({nodeId:item.canonicalId,nodeType:family,originPhase:phase,sourceRecordPath:'actions.'+stepKey+'.outputs.'+fieldName+'['+i+']'});
      }
    }
  }
}
function importedRecords(canonical,paths){return (paths??[]).map(p=>({path:p,value:getByPath(canonical,p)}));}
function syncControls({root,campaignPath,schema,canonical,canonicalRel,now}){
  const controlDir=path.posix.join(campaignPath,'controller');
  const graphRel=path.posix.join(controlDir,'SECURITY_TRACEABILITY_GRAPH_v1.json');
  const ledgerRel=path.posix.join(controlDir,'CARRIED_FORWARD_OBLIGATION_LEDGER_v1.json');
  const invalidRel=path.posix.join(controlDir,'EVIDENCE_INVALIDATION_MATRIX_v1.json');
  const graph=readJson(requiredFile(root,graphRel,'traceability graph'));
  const ledger=readJson(requiredFile(root,ledgerRel,'obligation ledger'));
  const invalid=readJson(requiredFile(root,invalidRel,'invalidation matrix'));
  assignCanonicalIds(canonical,graph,schema.phase);
  graph.controllerImports??=[]; ledger.controllerImports??=[]; invalid.controllerImports??=[];
  graph.controllerImports.push({phase:schema.phase,canonicalDataPath:canonicalRel,records:importedRecords(canonical,schema.bookkeepingMappings?.graphRecordPaths),importedAt:now});
  ledger.controllerImports.push({phase:schema.phase,canonicalDataPath:canonicalRel,records:importedRecords(canonical,schema.bookkeepingMappings?.obligationRecordPaths),importedAt:now});
  invalid.controllerImports.push({phase:schema.phase,canonicalDataPath:canonicalRel,records:importedRecords(canonical,schema.bookkeepingMappings?.invalidationRecordPaths),importedAt:now});
  writeJson(repoFile(root,graphRel),graph);writeJson(repoFile(root,ledgerRel),ledger);writeJson(repoFile(root,invalidRel),invalid);
  return {graphRel,ledgerRel,invalidRel};
}
function receiptRef(root,rel,role){return {role,path:rel.split('/').slice(2).join('/'),sha256:shaFile(repoFile(root,rel))};}
function assignmentReviewer(sequence){if(sequence===1)return'reviewer-1';if(sequence>=2&&sequence<=5)return'reviewer-2';if(sequence===6)return'reviewer-3L';if(sequence>=8&&sequence<=10)return'reviewer-4';throw new Error('no agent reviewer for phase '+sequence);}
function isFreshBoundary(next){return next===2||next===6||next===8;}

const a=parse(process.argv);
for(const k of ['controller-root','campaign-path','campaign-directory-path','phase-sequence']) if(a[k]===undefined) throw new Error('missing --'+k);
const root=path.resolve(a['controller-root']);
const campaignPath=a['campaign-path']; const campaignRoot=repoFile(root,campaignPath);
const sequence=Number(a['phase-sequence']);
const directoryRel=a['campaign-directory-path']; const directoryFile=requiredFile(root,directoryRel,'campaign directory entry');
const directory=readJson(directoryFile);
if(directory.schemaVersion!=='curveyield-audit-campaign-directory-entry-v2') throw new Error('packet controller requires Audit Campaign Directory v2');
const assignment=directory.currentAssignment;
if(!assignment||assignment.phaseSequence!==sequence) throw new Error('current assignment does not match submitted phase');
const predecessor=readJson(requiredFile(root,assignment.predecessorReceiptPath,'predecessor sealed receipt'));
const authorityRoot=authorityRootFromReceipt(predecessor);
const loaded=loadPhaseSchema(root,authorityRoot,sequence); const schema=loaded.schema;
if(assignment.workSchemaPath!==loaded.rel) throw new Error('assignment workSchemaPath mismatch');

const packetFile=requiredFile(root,assignment.packetPath,'phase work packet');
const packet=readJson(packetFile);
let deficiencies=ensurePacketShape({packet,directory,assignment});
let form=null;
try{form=readJson(requiredFile(root,assignment.workFormPath,'phase work form'));deficiencies.push(...validateWorkForm(schema,form));}catch(e){deficiencies.push(String(e.message||e));}
let reportText='';
if(schema.finalReport){
  try{reportText=fs.readFileSync(requiredFile(root,assignment.finalReportPath,'phase final report'),'utf8');deficiencies.push(...validateFinalReport(schema,reportText));}catch(e){deficiencies.push(String(e.message||e));}
const now=new Date().toISOString();
if(deficiencies.length){
  packet.controllerValidation={status:'FAIL',validatedAt:now,deficiencies};
  directory.currentAssignment.status='REWORK_REQUIRED';directory.campaignStatus='ACTIVE';directory.updatedAt=now;
  writeJson(packetFile,packet);writeJson(directoryFile,directory);
  const feedback=feedbackText(sequence,deficiencies);
  process.stdout.write(JSON.stringify({status:'NEEDS_REWORK',campaignId:directory.campaignId,campaignName:directory.campaignName,phaseSequence:sequence,phaseId:'phase-'+sequence,reviewer:assignment.reviewer,feedbackText:feedback,feedbackB64:Buffer.from(feedback).toString('base64'),packetPath:assignment.packetPath,directoryPath:directoryRel})+'\n');
  process.exit(0);
}

packet.controllerValidation={status:'PASS',validatedAt:now,deficiencies:[],controllerPassToken:'CONTROLLER_PHASE_PASS'};
const canonicalRel=path.posix.join(campaignPath,'derived/phase-'+sequence,'PHASE_'+phaseNum(sequence)+'_CANONICAL_DATA_v1.json');
const canonical={schemaVersion:'curveyield-lite-phase-canonical-data-v1',phase:sequence,campaignId:directory.campaignId,workSchemaPath:assignment.workSchemaPath,workFormPath:assignment.workFormPath,finalReportPath:assignment.finalReportPath,actions:form.actions,generatedAt:now};
const controls=syncControls({root,campaignPath,schema,canonical,canonicalRel,now});
writeJson(repoFile(root,canonicalRel),canonical);
const derivedRels=buildDerivedOutputs({root,campaignPath,schema,canonicalData:canonical,canonicalRel,now});

const receiptLibUrl=pathToFileURL(repoFile(root,'packages/controller-core/src/lite-phase-receipt-v1.mjs')).href;
const receiptLib=await import(receiptLibUrl);
const receiptRel=receiptLib.phaseReceiptPath(campaignPath,sequence,1);
const evidence=[receiptRef(root,assignment.workFormPath,'PHASE_WORK_FORM')];
if(assignment.finalReportPath) evidence.push(receiptRef(root,assignment.finalReportPath,'PHASE_FINAL_REPORT'));
evidence.push(receiptRef(root,canonicalRel,'PHASE_CANONICAL_DATA'));
for(const rel of derivedRels) evidence.push(receiptRef(root,rel,'DERIVED_DOWNSTREAM_DATA'));

let nextSequence=sequence===10?null:sequence+1;
let fresh=false;let nextAssignment=null;let nextDerivedInputs=[...derivedRels];
let handoff={required:false,boundary:null,incomingReviewer:null,assignedWork:null,nextPhaseSequence:nextSequence,sameReviewer:true,status:'NOT_APPLICABLE'};
if(sequence===1){nextSequence=2;fresh=true;handoff={required:true,boundary:'P1_TO_P2',incomingReviewer:'reviewer-2',assignedWork:'Combined Lite Phases 2-5',nextPhaseSequence:2,sameReviewer:false,status:'SUCCESSOR_PENDING'};}
if(sequence===5){nextSequence=6;fresh=true;handoff={required:true,boundary:'P5_TO_P6',incomingReviewer:'reviewer-3L',assignedWork:'Merged Lite Phases 6-7',nextPhaseSequence:6,sameReviewer:false,status:'SUCCESSOR_PENDING'};}
if(sequence===6){nextSequence=8;}
if(sequence===8){nextSequence=hasRemediation(campaignRoot)?9:10;handoff={required:false,boundary:null,incomingReviewer:'reviewer-4',assignedWork:'Phase '+nextSequence,nextPhaseSequence:nextSequence,sameReviewer:true,status:'NOT_APPLICABLE'};}
if(sequence===9){nextSequence=10;}
if(sequence===10){handoff={required:false,boundary:null,incomingReviewer:null,assignedWork:null,nextPhaseSequence:null,sameReviewer:false,status:'NOT_APPLICABLE'};}

const receipt=receiptLib.createLitePhaseReceiptV1({
  campaignId:directory.campaignId,campaignGenerationId:directory.campaignGenerationId,campaignName:directory.campaignName,
  workspacePath:campaignPath,campaignDirectoryEntryPath:directoryRel,sequence,executorType:'AI_REVIEWER',executorLineage:assignment.reviewer,
  authority:predecessor.authority,sourceSha256:directory.sourceSha256,source:predecessor.source,status:sequence===10?'COMPLETE':'SEALED',
  inputs:[{role:'PREDECESSOR_RECEIPT',path:assignment.predecessorReceiptPath},{role:'PHASE_WORK_PACKET',path:assignment.packetPath}],
  evidence,outputs:evidence,
  globalControls:{securityTraceabilityGraph:controls.graphRel.split('/').slice(2).join('/'),carriedForwardObligationLedger:controls.ledgerRel.split('/').slice(2).join('/'),evidenceInvalidationMatrix:controls.invalidRel.split('/').slice(2).join('/'),sourceIntelligenceBundle:predecessor.globalControls?.sourceIntelligenceBundle??null},
  validation:{status:'PASS',validatedAt:now,failures:[]},handoff,now
});
receipt.sealedAt=now;receipt.updatedAt=now;
writeJson(repoFile(root,receiptRel),receipt);
packet.status='ACCEPTED';packet.controllerValidation.receiptPath=receiptRel;packet.controllerValidation.canonicalDataPath=canonicalRel;packet.controllerValidation.derivedOutputPaths=derivedRels;
writeJson(packetFile,packet);

let sealedReceiptRel=receiptRel;
if(sequence===6){
  const loaded7=loadPhaseSchema(root,authorityRoot,7);const schema7=loaded7.schema;
  const form7Rel=path.posix.join(campaignPath,schema7.workForm.campaignPath);const form7=readJson(requiredFile(root,path.posix.join(authorityRoot,schema7.workForm.template),'Phase-7 automation form template'));
  form7.actions['step-1'].outputs={predecessorPhase6Receipt:receiptRel,phase6DerivedInput:derivedRels[0]??'NONE_IDENTIFIED',markerDisposition:'SEALED_AUTOMATIC_MARKER',successorPhase:'8',successorReviewer:'reviewer-4'};
  form7.automationInputs={predecessorReceiptPath:receiptRel,derivedInputPaths:derivedRels};
  writeJson(repoFile(root,form7Rel),form7);
  const canonical7Rel=path.posix.join(campaignPath,'derived/phase-7/PHASE_07_CANONICAL_DATA_v1.json');
  const canonical7={schemaVersion:'curveyield-lite-phase-canonical-data-v1',phase:7,campaignId:directory.campaignId,workSchemaPath:loaded7.rel,workFormPath:form7Rel,finalReportPath:null,actions:form7.actions,generatedAt:now};
  writeJson(repoFile(root,canonical7Rel),canonical7);
  const derived7=buildDerivedOutputs({root,campaignPath,schema:schema7,canonicalData:canonical7,canonicalRel:canonical7Rel,now});
  const markerRel=receiptLib.phaseReceiptPath(campaignPath,7,1);
  const markerEvidence=[receiptRef(root,form7Rel,'AUTOMATIC_PHASE7_WORK_FORM'),receiptRef(root,canonical7Rel,'AUTOMATIC_PHASE7_CANONICAL_DATA'),...derived7.map(x=>receiptRef(root,x,'DERIVED_DOWNSTREAM_DATA'))];
  const marker=receiptLib.createLitePhaseReceiptV1({campaignId:directory.campaignId,campaignGenerationId:directory.campaignGenerationId,campaignName:directory.campaignName,workspacePath:campaignPath,campaignDirectoryEntryPath:directoryRel,sequence:7,executorType:'GITHUB_ACTIONS',executorLineage:'phase7-automation',authority:predecessor.authority,sourceSha256:directory.sourceSha256,source:predecessor.source,status:'SEALED',inputs:[{role:'PREDECESSOR_RECEIPT',path:receiptRel}],evidence:markerEvidence,outputs:markerEvidence,globalControls:receipt.globalControls,validation:{status:'PASS',validatedAt:now,failures:[]},handoff:{required:true,boundary:'P67_TO_P8',incomingReviewer:'reviewer-4',assignedWork:'Combined Lite Phases 8-10',nextPhaseSequence:8,sameReviewer:false,status:'SUCCESSOR_PENDING'},now});
  marker.sealedAt=now;writeJson(repoFile(root,markerRel),marker);sealedReceiptRel=markerRel;nextDerivedInputs=[...derivedRels,...derived7];fresh=true;nextSequence=8;
}
if(sequence===8&&nextSequence===10){
  const skippedRel=receiptLib.phaseReceiptPath(campaignPath,9,1);
  const skipped=receiptLib.createLitePhaseReceiptV1({campaignId:directory.campaignId,campaignGenerationId:directory.campaignGenerationId,campaignName:directory.campaignName,workspacePath:campaignPath,campaignDirectoryEntryPath:directoryRel,sequence:9,executorType:'GITHUB_ACTIONS',executorLineage:'phase9-skip-automation',authority:predecessor.authority,sourceSha256:directory.sourceSha256,source:predecessor.source,status:'SKIPPED',inputs:[{role:'PREDECESSOR_RECEIPT',path:receiptRel}],outputs:[{role:'SKIP_REASON',path:'NO_REMEDIATION'}],globalControls:receipt.globalControls,validation:{status:'NOT_APPLICABLE',validatedAt:now,failures:[]},handoff:{required:false,boundary:null,incomingReviewer:'reviewer-4',assignedWork:'Phase 10',nextPhaseSequence:10,sameReviewer:true,status:'NOT_APPLICABLE'},now});
  skipped.sealedAt=now;writeJson(repoFile(root,skippedRel),skipped);sealedReceiptRel=skippedRel;
}
directory.lastSealedReceiptPath=sealedReceiptRel;
if(sequence===10){
  directory.campaignStatus='COMPLETE';directory.currentAssignment=null;directory.updatedAt=now;
}else{
  const nextReviewer=assignmentReviewer(nextSequence);
  const nextStatus=fresh||isFreshBoundary(nextSequence)?'WAITING_FOR_SUCCESSOR_AGENT':'ACTIVE';
  nextAssignment=preparePhaseWork({root,campaignPath,authorityRoot,sequence:nextSequence,reviewer:nextReviewer,predecessorReceiptPath:sealedReceiptRel,derivedInputPaths:nextDerivedInputs,status:nextStatus});
  directory.currentAssignment=nextAssignment;directory.campaignStatus=nextStatus==='WAITING_FOR_SUCCESSOR_AGENT'?'WAITING_FOR_SUCCESSOR_AGENT':'ACTIVE';directory.updatedAt=now;
}
writeJson(directoryFile,directory);
const feedback='CONTROLLER_PHASE_PASS: Phase '+sequence+' validated and sealed.'+(nextAssignment?' Next authorized assignment: Phase '+nextAssignment.phaseSequence+' / '+nextAssignment.reviewer+'.':' Campaign complete.');
process.stdout.write(JSON.stringify({status:'PASS',controllerPassToken:'CONTROLLER_PHASE_PASS',campaignId:directory.campaignId,campaignName:directory.campaignName,phaseSequence:sequence,receiptPath:receiptRel,lastSealedReceiptPath:directory.lastSealedReceiptPath,freshSuccessorRequired:Boolean(nextAssignment&&nextAssignment.status==='WAITING_FOR_SUCCESSOR_AGENT'),sameReviewerAdvanced:Boolean(nextAssignment&&nextAssignment.status==='ACTIVE'),nextAssignment,feedbackText:feedback,feedbackB64:Buffer.from(feedback).toString('base64'),directoryPath:directoryRel})+'\n');
