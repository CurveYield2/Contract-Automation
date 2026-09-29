#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {
  readJson,writeJson,writeText,repoFile,requiredFile,authorityRootFromReceipt,loadPhaseSchema,
  validateWorkForm,validateFinalReport,ensurePacketShape,buildDerivedOutputs,preparePhaseWork,getByPath
} from './lib/lite-phase-work-v1.mjs';
import {
  executePhase5TargetsV1,renderTargetedTestMatrixV1,renderRemediationDeltaLedgerV1,renderFinalEvidenceIndexV1
} from '../packages/github-native-sim/src/lite-boundary-artifacts-v1.mjs';
import {
  buildControllerPacket,renderControllerPhaseReport,validatePhaseScaffold,
  phase4CoverageFromForm,materializeValidatedFindings,resolveTargetExecutionRequestRef,
  populatePhase9RerunEvidenceRefs,refreshControllerPrefillDigest,
  normalizeFormalObligationsIntoLedger,applyObligationDispositionsToLedger
} from './lib/lite-phase-prefill-v1.mjs';

function parse(argv){const o={};for(let i=2;i<argv.length;i+=2){if(!argv[i]?.startsWith('--')||argv[i+1]===undefined) throw new Error('args must be --key value');o[argv[i].slice(2)]=argv[i+1];}return o;}
function shaFile(file){return createHash('sha256').update(fs.readFileSync(file)).digest('hex');}
function phaseNum(n){return String(n).padStart(2,'0');}
function feedbackText(sequence,defs){return ['Phase '+sequence+' semantic validation failed.','Repair only the exact substantive items below and invoke controller validation again.','',...defs.map(x=>'- '+x),'','Do not advance, retire, update receipts, or perform controller bookkeeping.'].join('\n');}
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
function receiptObligationSummary({ledger,canonical,form,sequence,now}){
  const all=ledger?.obligations??[];
  const byId=new Map(all.map(o=>[String(o?.obligationId??''),o]).filter(([id])=>id));
  const dueIds=form?.automationInputs?.expectedDueObligationIds??[];
  const rows=[];
  for(const action of Object.values(canonical?.actions??{})){
    const value=action?.outputs?.obligationDispositions;
    if(Array.isArray(value)) rows.push(...value.filter(x=>x&&typeof x==='object'&&!Array.isArray(x)));
  }
  const created=all.filter(o=>String(o.originPhase??'')===String(sequence)&&o.createdAt===now);
  const closed=rows.filter(r=>['SATISFIED','NOT_APPLICABLE'].includes(String(r.disposition??''))).map(r=>byId.get(String(r.obligationId))??r);
  const carriedForward=rows.filter(r=>['CARRY_FORWARD','BLOCKED_CARRIED'].includes(String(r.disposition??''))).map(r=>byId.get(String(r.obligationId))??r);
  const due=dueIds.map(id=>byId.get(String(id))??{obligationId:id,status:'UNRESOLVED_LEDGER_REFERENCE'});
  return {due,created,closed,carriedForward};
}
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
  const graphRecords=importedRecords(canonical,schema.bookkeepingMappings?.graphRecordPaths);
  const obligationRecords=importedRecords(canonical,schema.bookkeepingMappings?.obligationRecordPaths);
  const invalidationRecords=importedRecords(canonical,schema.bookkeepingMappings?.invalidationRecordPaths);
  graph.controllerImports.push({phase:schema.phase,canonicalDataPath:canonicalRel,records:graphRecords,importedAt:now});
  ledger.controllerImports.push({phase:schema.phase,canonicalDataPath:canonicalRel,records:obligationRecords,importedAt:now});
  invalid.controllerImports.push({phase:schema.phase,canonicalDataPath:canonicalRel,records:invalidationRecords,importedAt:now});

  for(const record of obligationRecords){
    normalizeFormalObligationsIntoLedger({ledger,items:record.value,originPhase:schema.phase,canonicalRel,now});
  }

  const identityComparison=canonical?.automationInputs?.identityComparison;
  if(identityComparison){
    invalid.controllerImports.push({phase:schema.phase,canonicalDataPath:canonicalRel,records:[{path:'automationInputs.identityComparison',value:identityComparison}],importedAt:now,owner:'CONTROLLER_AUTOMATION'});
  }

  const domainRegistryPath=canonical?.automationInputs?.domainRegistryPath;
  if(domainRegistryPath){
    const domainRel=path.posix.join(campaignPath,domainRegistryPath);
    const registry=maybeJson(root,domainRel);
    if(registry){
      graph.controllerImports.push({phase:schema.phase,canonicalDataPath:canonicalRel,records:[{path:'controllerDomainRegistry',value:{path:domainRegistryPath,decisions:registry.decisions??[]}}],importedAt:now,owner:'CONTROLLER_AUTOMATION'});
      ledger.controllerImports.push({phase:schema.phase,canonicalDataPath:canonicalRel,records:[{path:'controllerDomainRegistry.generatedObligations',value:registry.generatedObligations??[]}],importedAt:now,owner:'CONTROLLER_AUTOMATION'});
      normalizeFormalObligationsIntoLedger({ledger,items:registry.generatedObligations??[],originPhase:schema.phase,canonicalRel,now});
    }
  }

  applyObligationDispositionsToLedger({ledger,canonical,sequence:schema.phase,canonicalRel,now});
  writeJson(repoFile(root,graphRel),graph);writeJson(repoFile(root,ledgerRel),ledger);writeJson(repoFile(root,invalidRel),invalid);
  return {graphRel,ledgerRel,invalidRel};
}
function receiptRef(root,campaignPath,rel,role){return {role,path:path.posix.relative(campaignPath,rel),sha256:shaFile(repoFile(root,rel))};}
function assignmentReviewer(sequence){if(sequence===1)return'reviewer-1';if(sequence>=2&&sequence<=5)return'reviewer-2';if(sequence===6)return'reviewer-3L';if(sequence>=8&&sequence<=10)return'reviewer-4';throw new Error('no agent reviewer for phase '+sequence);}
function isFreshBoundary(next){return next===2||next===6||next===8;}
function maybeFile(root,rel){const f=repoFile(root,rel);return fs.existsSync(f)&&fs.statSync(f).isFile()?f:null;}
function maybeJson(root,rel){const f=maybeFile(root,rel);if(!f)return null;try{return readJson(f);}catch{return null;}}
function canonicalRelFor(campaignPath,phase){return path.posix.join(campaignPath,'derived/phase-'+phase,'PHASE_'+phaseNum(phase)+'_CANONICAL_DATA_v1.json');}
function canonicalFor(root,campaignPath,phase){return maybeJson(root,canonicalRelFor(campaignPath,phase));}
function uniqueExisting(root,rels){return [...new Set(rels.filter(Boolean))].filter(rel=>Boolean(maybeFile(root,rel)));}
function resolveInputsForTarget({root,campaignPath,target,immediate=[]}){
  const derived=(phase,name)=>path.posix.join(campaignPath,`derived/phase-${phase}/${name}`);
  const buildIdentity=path.posix.join(campaignPath,'evidence/build/BUILD_AND_SOURCE_IDENTITY_v1.json');
  const deploy=path.posix.join(campaignPath,'work/phase-06/LITE_DEPLOY_CONFIG_MATRIX.md');
  const targets=path.posix.join(campaignPath,'work/phase-06/LITE_TARGETED_TEST_MATRIX.md');
  const remediation=path.posix.join(campaignPath,'work/phase-09/PHASE9_REMEDIATION_DELTA_LEDGER.md');
  const finalIndex=path.posix.join(campaignPath,'work/phase-10/LITE_FINAL_EVIDENCE_INDEX.md');
  const p2=derived(2,'PHASE3_INPUT_v1.json');
  const p3=derived(3,'PHASE4_INPUT_v1.json');
  const p4=derived(4,'PHASE5_INPUT_v1.json');
  const p5=derived(5,'PHASE6_INPUT_v1.json');
  const p6=derived(6,'PHASE8_INPUT_v1.json');
  const p8Remediation=derived(8,'PHASE9_REMEDIATION_INPUT_v1.json');
  if(target===4) return uniqueExisting(root,[p2,p3]);
  if(target===5) return uniqueExisting(root,[p2,p3,p4]);
  if(target===6) return uniqueExisting(root,[p2,p3,p4,p5,buildIdentity,deploy,targets]);
  if(target===8) return uniqueExisting(root,[p2,p3,p4,p5,p6,buildIdentity,deploy,targets]);
  if(target===9) return uniqueExisting(root,[p8Remediation,remediation]);
  if(target===10) return uniqueExisting(root,[finalIndex]);
  return uniqueExisting(root,immediate);
}
function phaseOutput(canonical,step,field){return canonical?.actions?.[step]?.outputs?.[field];}
function remediationDeltaRows(campaignRoot,validatedFindings){
  const remediationRoot=path.join(campaignRoot,'remediation');
  const files=listFilesRecursive(remediationRoot);
  const changed=new Set(); const symbols=new Set(); const evidence=[];
  for(const file of files){
    const rel=path.relative(campaignRoot,file).split(path.sep).join('/'); evidence.push(rel);
    const ext=path.extname(file).toLowerCase();
    if(['.patch','.diff'].includes(ext)){
      const text=fs.readFileSync(file,'utf8');
      for(const line of text.split(/\r?\n/)){
        const m=line.match(/^\+\+\+\s+(?:b\/)?(.+)$/); if(m&&m[1]!=='/dev/null') changed.add(m[1]);
        if(/^[+-](?![+-])/.test(line)){
          const s=line.match(/\b(?:function|contract|library|interface|struct|modifier|event|error)\s+([A-Za-z_][A-Za-z0-9_]*)/);
          if(s) symbols.add(s[1]);
        }
      }
    }else changed.add(rel.replace(/^remediation\//,''));
  }
  const deltaText='files='+([...changed].join(', ')||'UNRESOLVED')+'; symbols='+([...symbols].join(', ')||'NOT_MACHINE_DERIVABLE_FROM_AVAILABLE_REMEDIATION_ARTIFACTS');
  const findingRows=(validatedFindings??[]).filter(f=>f&&typeof f==='object'&&!Array.isArray(f));
  return (findingRows.length?findingRows:[{findingTempKey:'REMEDIATION-DELTA'}]).map(f=>({
    findingId:f.findingTempKey??f.canonicalId??f.candidateKey??'REMEDIATION-DELTA',
    oldIdentityRef:'evidence/build/BUILD_AND_SOURCE_IDENTITY_v1.json',
    remediationIdentityRef:evidence.join(', ')||'NO_REMEDIATION_ARTIFACT',
    changedFilesAndSymbols:deltaText,
    rootCauseFix:'PENDING_PHASE9_INTERPRETATION',
    staleEvidenceInvalidated:'SEE_CONTROLLER_EVIDENCE_INVALIDATION_STATE',
    decisiveProofRerun:'PENDING_PHASE9',
    affectedSurfaces:[...changed].join(', ')||'UNRESOLVED',
    newEvidenceRefs:evidence.join(', ')||'NONE',
    residualRisk:'PENDING_PHASE9_INTERPRETATION',
    finalDisposition:'PENDING_PHASE9_INTERPRETATION'
  }));
}
function finalizeRemediationDeltaRows(deltaRows,canonical9){
  const surfaceRows=phaseOutput(canonical9,'step-1','changedSurfaceAssessments')??[];
  const dispositions=phaseOutput(canonical9,'step-2','remediationDispositions')??[];
  const byFinding=(rows)=>new Map(rows.map(r=>[String(r.findingKey??r.findingId??''),r]).filter(([k])=>k));
  const surfaces=byFinding(surfaceRows), remediations=byFinding(dispositions);
  return deltaRows.map(row=>{
    const key=String(row.findingId??'');
    const surface=surfaces.get(key)??{};
    const remediation=remediations.get(key)??{};
    const reruns=Array.isArray(remediation.rerunEvidenceRefs)?remediation.rerunEvidenceRefs.join(', '):(remediation.rerunEvidenceRefs??row.decisiveProofRerun);
    return {
      ...row,
      rootCauseFix:remediation.rootCauseFixed===undefined
        ? row.rootCauseFix
        : String(remediation.rootCauseFixed)+' — '+String(remediation.rationale??'NO_ADDITIONAL_RATIONALE'),
      decisiveProofRerun:reruns??row.decisiveProofRerun,
      affectedSurfaces:[
        surface.changedSurface,
        surface.affectedCallersOrState
      ].filter(Boolean).join(' / ')||row.affectedSurfaces,
      newEvidenceRefs:reruns??row.newEvidenceRefs,
      residualRisk:[
        surface.newRiskOrNone,
        remediation.regressionAssessment
      ].filter(Boolean).join(' / ')||row.residualRisk,
      finalDisposition:remediation.disposition??row.finalDisposition
    };
  });
}
function explicitNegativeValue(v){
  return ['NONE_IDENTIFIED','NOT_APPLICABLE','NOT_TRIGGERED','NO_CANDIDATE','NO_REMEDIATION','NO_ADDITIONAL_OBLIGATION','NO_CONTRADICTION'].includes(String(v??''));
}
function collectCarriedLimitations({root,campaignPath,maxPhase=9}){
  const rows=[];
  for(let phase=1;phase<=maxPhase;phase++){
    if(phase===7) continue;
    const canonical=canonicalFor(root,campaignPath,phase);
    if(!canonical) continue;
    for(const [stepKey,action] of Object.entries(canonical.actions??{})){
      for(const [fieldName,value] of Object.entries(action?.outputs??{})){
        if(!/(limitation|ambigu|unresolved|uncert)/i.test(fieldName)) continue;
        const values=Array.isArray(value)?value:[value];
        for(const item of values){
          if(item===undefined||item===null||explicitNegativeValue(item)) continue;
          rows.push(`Phase ${phase} ${stepKey}.${fieldName}: ${typeof item==='string'?item:JSON.stringify(item)}`);
        }
      }
    }
    for(const [fieldName,value] of Object.entries(canonical.automationOutputs??{})){
      if(!/(limitation|ambigu|unresolved|uncert)/i.test(fieldName)) continue;
      const values=Array.isArray(value)?value:[value];
      for(const item of values){
        if(item===undefined||item===null||explicitNegativeValue(item)) continue;
        rows.push(`Phase ${phase} automationOutputs.${fieldName}: ${typeof item==='string'?item:JSON.stringify(item)}`);
      }
    }
  }
  return [...new Set(rows)];
}
function importedFormalObligations(ledger){
  const out=[];let fallback=1;
  for(const entry of ledger?.controllerImports??[]){
    for(const record of entry?.records??[]){
      const values=Array.isArray(record?.value)?record.value:[record?.value];
      for(const item of values){
        if(!item||typeof item!=='object'||Array.isArray(item)) continue;
        if(item.requiredPhase===undefined||!item.requiredAction||!item.completionCondition) continue;
        const rawId=item.obligationId??item.canonicalId??item.tempKey??`AUTO-${String(fallback++).padStart(3,'0')}`;
        const importedId=String(rawId).startsWith('OBL-')
          ? String(rawId)
          : 'OBL-P'+String(entry.phase??'X')+'-'+String(rawId).replace(/[^A-Za-z0-9._-]+/g,'_');
        out.push({
          obligationId:importedId,
          status:item.status??'OPEN_IMPORTED',
          originatingEvidenceRefs:item.originatingEvidenceRefs??[entry.canonicalDataPath].filter(Boolean),
          statusReason:item.statusReason??`${record.path} imported after Phase ${entry.phase}`,
          requiredPhase:String(item.requiredPhase),
          requiredAction:item.requiredAction,
          completionCondition:item.completionCondition
        });
      }
    }
  }
  return out;
}
function finalIndexObligations(ledger){
  const normalized=(ledger?.obligations??[]).filter(o=>!['CLOSED','SATISFIED','NOT_APPLICABLE','SUPERSEDED'].includes(String(o.status??'OPEN').toUpperCase()));
  const imported=importedFormalObligations(ledger);
  const byId=new Map();
  for(const o of [...normalized,...imported]){
    const id=String(o.obligationId??'').trim(); if(!id) continue;
    if(!byId.has(id)||String(byId.get(id)?.status??'').startsWith('OPEN_IMPORTED')) byId.set(id,o);
  }
  return [...byId.values()];
}

function buildFinalIndexInput({root,campaignPath,directory,predecessor}){
  const p6=canonicalFor(root,campaignPath,6); const p8=canonicalFor(root,campaignPath,8); const p9=canonicalFor(root,campaignPath,9);
  const build=maybeJson(root,path.posix.join(campaignPath,'evidence/build/BUILD_AND_SOURCE_IDENTITY_v1.json'))??{};
  const ledger=maybeJson(root,path.posix.join(campaignPath,'controller/CARRIED_FORWARD_OBLIGATION_LEDGER_v1.json'))??{};
  const remediations=phaseOutput(p9,'step-2','remediationDispositions')??[];
  const candidateRows=(phaseOutput(p8,'step-2','candidateValidations')??[]).filter(v=>v&&typeof v==='object'&&!Array.isArray(v)).map(v=>({
    id:v.candidateKey,
    disposition:v.finalDisposition??v.outcome??'UNRESOLVED',
    severityOrStatus:v.severity??'UNRESOLVED',
    evidence:Array.isArray(v.evidenceRefs)?v.evidenceRefs.join(', '):v.evidenceRefs,
    remediationStatus:'NOT_APPLICABLE',
    residualLimitation:v.rationale??'SEE_ACCEPTED_PHASE8_DATA'
  }));
  const findingRows=(phaseOutput(p8,'step-2','validatedFindings')??[]).filter(f=>f&&typeof f==='object'&&!Array.isArray(f)).map(f=>{
    const id=f.canonicalId??f.findingTempKey??f.candidateKey;
    const remediation=remediations.find(r=>r.findingKey===id||r.findingKey===f.findingTempKey||r.findingKey===f.candidateKey);
    return {
      id,
      disposition:'VALIDATED_FINDING',
      severityOrStatus:f.severity??'UNRESOLVED',
      evidence:Array.isArray(f.proofEvidenceRefs)?f.proofEvidenceRefs.join(', '):f.proofEvidenceRefs,
      remediationStatus:remediation?.disposition??(p9?'UNRESOLVED':'SKIPPED_NO_REMEDIATION'),
      residualLimitation:remediation?.regressionAssessment??'SEE_ACCEPTED_PHASE_DATA'
    };
  });
  const findings=[...candidateRows,...findingRows];
  const obligations=finalIndexObligations(ledger).map(o=>({
    id:o.obligationId,
    disposition:o.status??'OPEN',
    severityOrStatus:'OBLIGATION',
    evidence:(o.originatingEvidenceRefs??[]).join(', '),
    remediationStatus:'NOT_APPLICABLE',
    residualLimitation:[o.statusReason,o.requiredPhase?('requiredPhase='+o.requiredPhase):null,o.requiredAction].filter(Boolean).join(' | ')||'OPEN'
  }));
  const limitations=collectCarriedLimitations({root,campaignPath,maxPhase:9});
  const omissions=phaseOutput(p6,'step-3','fullOnlyOmissions')??phaseOutput(p6,'step-4','fullOnlyOmissions')??[];
  return {
    identity:{
      campaignGeneration:directory.campaignId+'/'+directory.campaignGenerationId,
      skill:predecessor.authority?.homepagePath??'UNRESOLVED_AUTHORITY',
      source:[predecessor.source?.repository,predecessor.source?.commit,directory.sourceSha256].filter(Boolean).join('@'),
      build:JSON.stringify({compiler:build.configurationDetection?.compilerVersion??build.build?.compilerVersion??null,compilerOutputSha256:build.build?.compilerOutputSha256??null}),
      deployment:'work/phase-06/LITE_DEPLOY_CONFIG_MATRIX.md',
      remediation:p9?'work/phase-09/PHASE9_REMEDIATION_DELTA_LEDGER.md':'SKIPPED_NO_REMEDIATION'
    },
    milestones:[
      {milestone:'Phase 0–1',requiredEvidence:'admission, source fence, risk grade, Source Intelligence',reference:'receipts/PHASE_00_RECEIPT_v1.json + accepted Phase-1 canonical data',sourceIdentity:directory.sourceSha256,status:'COMPLETE',limitation:'SEE_REFERENCED_EVIDENCE'},
      {milestone:'Combined Phase 2–5',requiredEvidence:'specification, threats/domains, manual review, economic/math, reconciliation',reference:'derived/phase-2..5 canonical data',sourceIdentity:directory.sourceSha256,status:'COMPLETE',limitation:'SEE_ACCEPTED_PHASE_DATA'},
      {milestone:'Merged Lite Phase 6–7',requiredEvidence:'deploy/config, deterministic candidate simulation, targeted fuzz, interpretation',reference:'work/phase-06/LITE_DEPLOY_CONFIG_MATRIX.md + work/phase-06/LITE_TARGETED_TEST_MATRIX.md + accepted Phase-6 canonical data',sourceIdentity:directory.sourceSha256,status:'COMPLETE',limitation:(phaseOutput(p6,'step-3','typedExecutionLimitations')??phaseOutput(p6,'step-4','typedExecutionLimitations')??[]).join('; ')||'NONE_IDENTIFIED'},
      {milestone:'Combined Phase 8–10',requiredEvidence:'validation, remediation/skip, final reconciliation',reference:p9?'accepted Phase-8 and Phase-9 canonical data':'accepted Phase-8 canonical data + Phase-9 skip receipt',sourceIdentity:directory.sourceSha256,status:'READY_FOR_PHASE10',limitation:'SEE_FINDINGS_AND_OBLIGATIONS'}
    ],
    findings,obligations,limitations,omissions
  };
}


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

const packetFile=repoFile(root,assignment.packetPath);
const now=new Date().toISOString();
const existingPacket=fs.existsSync(packetFile)?readJson(packetFile):null;
const packet=buildControllerPacket({directory,assignment,existing:existingPacket,now});
let deficiencies=ensurePacketShape({packet,directory,assignment});
let form=null;
try{
  form=readJson(requiredFile(root,assignment.workFormPath,'phase work form'));

  // v10.3 stores the authoritative prefill digest outside the reviewer-editable
  // form. Older active assignments are migrated once from the pre-existing form
  // digest so in-flight v10.2 campaigns remain resumable.
  if(!assignment.controllerPrefillDigestSha256){
    const legacyDigest=form?.automationInputs?.controllerPrefillDigestSha256;
    if(typeof legacyDigest!=='string'||!/^[0-9a-f]{64}$/.test(legacyDigest)){
      deficiencies.push('Controller-owned assignment prefill digest is missing and no valid legacy form digest is available for one-time migration.');
    }else{
      assignment.controllerPrefillDigestSha256=legacyDigest;
      assignment.controllerPrefillDigestMigration='BOUND_FROM_LEGACY_FORM_DIGEST';
    }
  }

  deficiencies.push(...validateWorkForm(schema,form));
  deficiencies.push(...validatePhaseScaffold(sequence,form,assignment.controllerPrefillDigestSha256));

  if(sequence===9&&deficiencies.length===0){
    const collectionDeficiencies=populatePhase9RerunEvidenceRefs({root,campaignPath,form});
    deficiencies.push(...collectionDeficiencies);
    if(collectionDeficiencies.length===0){
      assignment.controllerPrefillDigestSha256=form.automationInputs.controllerPrefillDigestSha256;
      writeJson(repoFile(root,assignment.workFormPath),form);
      deficiencies.push(...validateWorkForm(schema,form));
      deficiencies.push(...validatePhaseScaffold(sequence,form,assignment.controllerPrefillDigestSha256));
    }
  }
}catch(e){deficiencies.push(String(e.message||e));}

if(sequence===5&&form&&deficiencies.length===0){
  const targets=form?.actions?.['step-3']?.outputs?.targetDesigns??[];
  for(const target of targets){
    if(!target||typeof target!=='object'||target.executionMethod==='NOT_APPLICABLE') continue;
    const resolved=resolveTargetExecutionRequestRef({root,campaignPath,target});
    if(resolved){
      target.executionRequestRef=resolved;
      target.automationResolvedExecutionRequest=true;
      target.automationOwnedFields=[...new Set([...(target.automationOwnedFields??[]),'executionRequestRef','automationResolvedExecutionRequest'])];
    }else{
      deficiencies.push('Phase 5 target '+String(target.candidateKey??'UNRESOLVED')+' has no deterministically resolvable execution request. Provide executionRequestRef only for this target or materialize the conventional request path.');
    }
  }
  if(!deficiencies.length){
    assignment.controllerPrefillDigestSha256=refreshControllerPrefillDigest(form);
    writeJson(repoFile(root,assignment.workFormPath),form);
    deficiencies.push(...validatePhaseScaffold(sequence,form,assignment.controllerPrefillDigestSha256));
  }
}

if(deficiencies.length){
  packet.status='REWORK_REQUIRED';
  packet.controllerValidation={status:'FAIL',validatedAt:now,deficiencies};
  directory.currentAssignment.status='REWORK_REQUIRED';directory.campaignStatus='ACTIVE';directory.updatedAt=now;
  writeJson(packetFile,packet);writeJson(directoryFile,directory);
  const feedback=feedbackText(sequence,deficiencies).replace('resubmit the same phase packet','repair the substantive fields and invoke controller validation again; the controller will rebuild the packet');
  process.stdout.write(JSON.stringify({status:'NEEDS_REWORK',campaignId:directory.campaignId,campaignName:directory.campaignName,phaseSequence:sequence,phaseId:'phase-'+sequence,reviewer:assignment.reviewer,feedbackText:feedback,feedbackB64:Buffer.from(feedback).toString('base64'),packetPath:assignment.packetPath,directoryPath:directoryRel})+'\n');
  process.exit(0);
}

const canonicalRel=path.posix.join(campaignPath,'derived/phase-'+sequence,'PHASE_'+phaseNum(sequence)+'_CANONICAL_DATA_v1.json');
const canonical={
  schemaVersion:'curveyield-lite-phase-canonical-data-v1',
  phase:sequence,
  campaignId:directory.campaignId,
  workSchemaPath:assignment.workSchemaPath,
  workFormPath:assignment.workFormPath,
  finalReportPath:assignment.finalReportPath,
  actions:structuredClone(form.actions),
  automationInputs:structuredClone(form.automationInputs??{}),
  automationOutputs:{},
  generatedAt:now
};
if(sequence===4) canonical.automationOutputs.phase4Coverage=phase4CoverageFromForm(form);
if(sequence===8){
  canonical.actions['step-2'].outputs.validatedFindings=materializeValidatedFindings(canonical.actions?.['step-2']?.outputs?.candidateValidations??[]);
  canonical.automationOutputs.validatedFindingsMaterialized=true;
}
if(sequence===10){
  const p6=canonicalFor(root,campaignPath,6);
  const ledger=maybeJson(root,path.posix.join(campaignPath,'controller/CARRIED_FORWARD_OBLIGATION_LEDGER_v1.json'))??{};
  const open=finalIndexObligations(ledger);
  const carriedLimitations=collectCarriedLimitations({root,campaignPath,maxPhase:9});
  const omissions=phaseOutput(p6,'step-3','fullOnlyOmissions')??[];
  canonical.automationOutputs.residualLimitations=[
    ...carriedLimitations,
    ...open.map(o=>[o.obligationId,o.statusReason,o.requiredAction].filter(Boolean).join(' | ')).filter(Boolean)
  ];
  if(!canonical.automationOutputs.residualLimitations.length) canonical.automationOutputs.residualLimitations=['NONE_IDENTIFIED'];
  canonical.automationOutputs.unresolvedSubstantiveQuestions=open.length?open.map(o=>o.obligationId??o.statusReason??'OPEN_OBLIGATION'):['NONE_IDENTIFIED'];
  canonical.automationOutputs.fullUpgradeRecommendations=omissions.length&&!(omissions.length===1&&omissions[0]==='NONE_IDENTIFIED')
    ? omissions.map(x=>'Execute Full-path delta for omitted Lite work: '+x)
    : ['NONE_IDENTIFIED'];
}

let reportText='';
if(schema.finalReport){
  reportText=renderControllerPhaseReport({schema,form,canonical});
  writeText(repoFile(root,assignment.finalReportPath),reportText);
  deficiencies.push(...validateFinalReport(schema,reportText));
}
if(deficiencies.length) throw new Error('controller-generated report validation failed: '+deficiencies.join('; '));

packet.controllerValidation={status:'PASS',validatedAt:now,deficiencies:[],controllerPassToken:'CONTROLLER_PHASE_PASS'};
const controls=syncControls({root,campaignPath,schema,canonical,canonicalRel,now});
writeJson(repoFile(root,canonicalRel),canonical);
const derivedRels=buildDerivedOutputs({root,campaignPath,schema,canonicalData:canonical,canonicalRel,now});
const boundaryArtifactRels=[];
let successorPrefillContext={};
if(sequence===5){
  const targetDesigns=phaseOutput(canonical,'step-3','targetDesigns')??[];
  const executionResults=await executePhase5TargetsV1({controllerRoot:root,campaignPath,targetDesigns});
  successorPrefillContext={targetDesigns,phase5ExecutionResults:executionResults};
  const targetMatrixRel=path.posix.join(campaignPath,'work/phase-06/LITE_TARGETED_TEST_MATRIX.md');
  fs.mkdirSync(path.dirname(repoFile(root,targetMatrixRel)),{recursive:true});
  fs.writeFileSync(repoFile(root,targetMatrixRel),renderTargetedTestMatrixV1({targetDesigns,executionResults}));
  boundaryArtifactRels.push(targetMatrixRel);
}
if(sequence===8&&hasRemediation(campaignRoot)){
  const validatedFindings=phaseOutput(canonical,'step-2','validatedFindings')??[];
  const deltaRows=remediationDeltaRows(campaignRoot,validatedFindings);
  successorPrefillContext={...successorPrefillContext,remediationDeltaRows:deltaRows};
  const ledgerRel=path.posix.join(campaignPath,'work/phase-09/PHASE9_REMEDIATION_DELTA_LEDGER.md');
  fs.mkdirSync(path.dirname(repoFile(root,ledgerRel)),{recursive:true});
  fs.writeFileSync(repoFile(root,ledgerRel),renderRemediationDeltaLedgerV1({validatedFindings,deltaRows,noRemediation:false}));
  boundaryArtifactRels.push(ledgerRel);
}
if(sequence===8&&!hasRemediation(campaignRoot)){
  const indexRel=path.posix.join(campaignPath,'work/phase-10/LITE_FINAL_EVIDENCE_INDEX.md');
  fs.mkdirSync(path.dirname(repoFile(root,indexRel)),{recursive:true});
  fs.writeFileSync(repoFile(root,indexRel),renderFinalEvidenceIndexV1(buildFinalIndexInput({root,campaignPath,directory,predecessor})));
  boundaryArtifactRels.push(indexRel);
}
if(sequence===9){
  const p8=canonicalFor(root,campaignPath,8);
  const validatedFindings=phaseOutput(p8,'step-2','validatedFindings')??[];
  const ledgerRel=path.posix.join(campaignPath,'work/phase-09/PHASE9_REMEDIATION_DELTA_LEDGER.md');
  const finalizedRows=finalizeRemediationDeltaRows(remediationDeltaRows(campaignRoot,validatedFindings),canonical);
  fs.mkdirSync(path.dirname(repoFile(root,ledgerRel)),{recursive:true});
  fs.writeFileSync(repoFile(root,ledgerRel),renderRemediationDeltaLedgerV1({validatedFindings,deltaRows:finalizedRows,noRemediation:false}));
  boundaryArtifactRels.push(ledgerRel);

  const indexRel=path.posix.join(campaignPath,'work/phase-10/LITE_FINAL_EVIDENCE_INDEX.md');
  fs.mkdirSync(path.dirname(repoFile(root,indexRel)),{recursive:true});
  fs.writeFileSync(repoFile(root,indexRel),renderFinalEvidenceIndexV1(buildFinalIndexInput({root,campaignPath,directory,predecessor})));
  boundaryArtifactRels.push(indexRel);
}

const receiptLibUrl=pathToFileURL(repoFile(root,'packages/controller-core/src/lite-phase-receipt-v1.mjs')).href;
const receiptLib=await import(receiptLibUrl);
const receiptRel=receiptLib.phaseReceiptPath(campaignPath,sequence,1);
const evidence=[receiptRef(root,campaignPath,assignment.workFormPath,'PHASE_WORK_FORM')];
if(assignment.finalReportPath) evidence.push(receiptRef(root,campaignPath,assignment.finalReportPath,'PHASE_FINAL_REPORT'));
evidence.push(receiptRef(root,campaignPath,canonicalRel,'PHASE_CANONICAL_DATA'));
for(const rel of derivedRels) evidence.push(receiptRef(root,campaignPath,rel,'DERIVED_DOWNSTREAM_DATA'));
for(const rel of boundaryArtifactRels) evidence.push(receiptRef(root,campaignPath,rel,'BOUNDARY_MACHINE_ARTIFACT'));

let nextSequence=sequence===10?null:sequence+1;
let fresh=false;let nextAssignment=null;let nextDerivedInputs=[];
let handoff={required:false,boundary:null,incomingReviewer:null,assignedWork:null,nextPhaseSequence:nextSequence,sameReviewer:true,status:'NOT_APPLICABLE'};
if(sequence===1){nextSequence=2;fresh=true;handoff={required:true,boundary:'P1_TO_P2',incomingReviewer:'reviewer-2',assignedWork:'Combined Lite Phases 2-5',nextPhaseSequence:2,sameReviewer:false,status:'SUCCESSOR_PENDING'};}
if(sequence===5){nextSequence=6;fresh=true;handoff={required:true,boundary:'P5_TO_P6',incomingReviewer:'reviewer-3L',assignedWork:'Merged Lite Phases 6-7',nextPhaseSequence:6,sameReviewer:false,status:'SUCCESSOR_PENDING'};}
if(sequence===6){nextSequence=8;}
if(sequence===8){nextSequence=hasRemediation(campaignRoot)?9:10;handoff={required:false,boundary:null,incomingReviewer:'reviewer-4',assignedWork:'Phase '+nextSequence,nextPhaseSequence:nextSequence,sameReviewer:true,status:'NOT_APPLICABLE'};}
if(sequence===9){nextSequence=10;}
if(sequence===10){handoff={required:false,boundary:null,incomingReviewer:null,assignedWork:null,nextPhaseSequence:null,sameReviewer:false,status:'NOT_APPLICABLE'};}
if(nextSequence!==null) nextDerivedInputs=resolveInputsForTarget({root,campaignPath,target:nextSequence,immediate:[...derivedRels,...boundaryArtifactRels]});

const ledgerAfter=maybeJson(root,controls.ledgerRel)??{};
const receipt=receiptLib.createLitePhaseReceiptV1({
  campaignId:directory.campaignId,campaignGenerationId:directory.campaignGenerationId,campaignName:directory.campaignName,
  workspacePath:campaignPath,campaignDirectoryEntryPath:directoryRel,sequence,executorType:'AI_REVIEWER',executorLineage:assignment.reviewer,
  authority:predecessor.authority,sourceSha256:directory.sourceSha256,source:predecessor.source,status:sequence===10?'COMPLETE':'SEALED',
  inputs:[{role:'PREDECESSOR_RECEIPT',path:assignment.predecessorReceiptPath},{role:'CONTROLLER_GENERATED_PHASE_WORK_PACKET',path:assignment.packetPath}],
  evidence,outputs:evidence,
  globalControls:{securityTraceabilityGraph:path.posix.relative(campaignPath,controls.graphRel),carriedForwardObligationLedger:path.posix.relative(campaignPath,controls.ledgerRel),evidenceInvalidationMatrix:path.posix.relative(campaignPath,controls.invalidRel),sourceIntelligenceBundle:predecessor.globalControls?.sourceIntelligenceBundle??null},
  obligations:receiptObligationSummary({ledger:ledgerAfter,canonical,form,sequence,now}),
  validation:{status:'PASS',validatedAt:now,failures:[]},handoff,now
});
receipt.sealedAt=now;receipt.updatedAt=now;
writeJson(repoFile(root,receiptRel),receipt);
packet.status='ACCEPTED';packet.controllerValidation.receiptPath=receiptRel;packet.controllerValidation.canonicalDataPath=canonicalRel;packet.controllerValidation.derivedOutputPaths=derivedRels;packet.controllerValidation.boundaryMachineArtifactPaths=boundaryArtifactRels;
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
  const markerEvidence=[receiptRef(root,campaignPath,form7Rel,'AUTOMATIC_PHASE7_WORK_FORM'),receiptRef(root,campaignPath,canonical7Rel,'AUTOMATIC_PHASE7_CANONICAL_DATA'),...derived7.map(x=>receiptRef(root,campaignPath,x,'DERIVED_DOWNSTREAM_DATA'))];
  const marker=receiptLib.createLitePhaseReceiptV1({campaignId:directory.campaignId,campaignGenerationId:directory.campaignGenerationId,campaignName:directory.campaignName,workspacePath:campaignPath,campaignDirectoryEntryPath:directoryRel,sequence:7,executorType:'GITHUB_ACTIONS',executorLineage:'phase7-automation',authority:predecessor.authority,sourceSha256:directory.sourceSha256,source:predecessor.source,status:'SEALED',inputs:[{role:'PREDECESSOR_RECEIPT',path:receiptRel}],evidence:markerEvidence,outputs:markerEvidence,globalControls:receipt.globalControls,validation:{status:'PASS',validatedAt:now,failures:[]},handoff:{required:true,boundary:'P67_TO_P8',incomingReviewer:'reviewer-4',assignedWork:'Combined Lite Phases 8-10',nextPhaseSequence:8,sameReviewer:false,status:'SUCCESSOR_PENDING'},now});
  marker.sealedAt=now;writeJson(repoFile(root,markerRel),marker);sealedReceiptRel=markerRel;fresh=true;nextSequence=8;nextDerivedInputs=resolveInputsForTarget({root,campaignPath,target:8,immediate:[...derivedRels,...derived7,...boundaryArtifactRels]});
}
if(sequence===8&&nextSequence===10){
  const skippedRel=receiptLib.phaseReceiptPath(campaignPath,9,1);
  const skipped=receiptLib.createLitePhaseReceiptV1({campaignId:directory.campaignId,campaignGenerationId:directory.campaignGenerationId,campaignName:directory.campaignName,workspacePath:campaignPath,campaignDirectoryEntryPath:directoryRel,sequence:9,executorType:'GITHUB_ACTIONS',executorLineage:'phase9-skip-automation',authority:predecessor.authority,sourceSha256:directory.sourceSha256,source:predecessor.source,status:'SKIPPED',inputs:[{role:'PREDECESSOR_RECEIPT',path:receiptRel}],outputs:[],automation:[{action:'SKIPPED_NO_REMEDIATION',status:'PASS',recordedAt:now}],globalControls:receipt.globalControls,validation:{status:'NOT_APPLICABLE',validatedAt:now,failures:[]},handoff:{required:false,boundary:null,incomingReviewer:'reviewer-4',assignedWork:'Phase 10',nextPhaseSequence:10,sameReviewer:true,status:'NOT_APPLICABLE'},now});
  skipped.sealedAt=now;writeJson(repoFile(root,skippedRel),skipped);sealedReceiptRel=skippedRel;
}
directory.lastSealedReceiptPath=sealedReceiptRel;
if(sequence===10){
  directory.campaignStatus='COMPLETE';directory.currentAssignment=null;directory.updatedAt=now;
}else{
  const nextReviewer=assignmentReviewer(nextSequence);
  const nextStatus=fresh||isFreshBoundary(nextSequence)?'WAITING_FOR_SUCCESSOR_AGENT':'ACTIVE';
  nextAssignment=preparePhaseWork({root,campaignPath,authorityRoot,sequence:nextSequence,reviewer:nextReviewer,predecessorReceiptPath:sealedReceiptRel,derivedInputPaths:nextDerivedInputs,status:nextStatus,prefillContext:successorPrefillContext});
  directory.currentAssignment=nextAssignment;directory.campaignStatus=nextStatus==='WAITING_FOR_SUCCESSOR_AGENT'?'WAITING_FOR_SUCCESSOR_AGENT':'ACTIVE';directory.updatedAt=now;
}
writeJson(directoryFile,directory);
const feedback='CONTROLLER_PHASE_PASS: Phase '+sequence+' validated and sealed.'+(nextAssignment?' Next authorized assignment: Phase '+nextAssignment.phaseSequence+' / '+nextAssignment.reviewer+'.':' Campaign complete.');
process.stdout.write(JSON.stringify({status:'PASS',controllerPassToken:'CONTROLLER_PHASE_PASS',campaignId:directory.campaignId,campaignName:directory.campaignName,phaseSequence:sequence,receiptPath:receiptRel,lastSealedReceiptPath:directory.lastSealedReceiptPath,freshSuccessorRequired:Boolean(nextAssignment&&nextAssignment.status==='WAITING_FOR_SUCCESSOR_AGENT'),sameReviewerAdvanced:Boolean(nextAssignment&&nextAssignment.status==='ACTIVE'),nextAssignment,feedbackText:feedback,feedbackB64:Buffer.from(feedback).toString('base64'),directoryPath:directoryRel})+'\n');
