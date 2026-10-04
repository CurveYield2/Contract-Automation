#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {
  readJson,writeJson,writeText,repoFile,requiredFile,authorityRootFromReceipt,loadPhaseSchema,
  validateWorkForm,validateFinalReport,ensurePacketShape,buildDerivedOutputs,preparePhaseWork,getByPath
} from './lib/lite-phase-work-v1.mjs';
import {
  executePhase5TargetsV1,renderTargetedTestMatrixV1,renderRemediationDeltaLedgerV1,renderFinalEvidenceIndexV1,
  validateTargetExecutionRequestBindingV1
} from '../packages/github-native-sim/src/lite-boundary-artifacts-v1.mjs';
import {
  buildControllerPacket,renderControllerPhaseReport,validatePhaseScaffold,
  phase4CoverageFromForm,materializeValidatedFindings,resolveTargetExecutionRequestRef,
  populatePhase9RerunEvidenceRefs,refreshControllerPrefillDigest,
  normalizeFormalObligationsIntoLedger,applyObligationDispositionsToLedger
} from './lib/lite-phase-prefill-v1.mjs';
import {MASTER_REVIEW_SEGMENTS_V1,masterReviewRequired,stageMasterReview,processMasterReviewSubmission,masterWakeMessage,childRepairWakeMessage,admitSealedPhaseRework,collectSegmentArtifacts} from './lib/lite-master-review-v1.mjs';

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
        const sourceRecordPath='actions.'+stepKey+'.outputs.'+fieldName+'['+i+']';
        const prior=(graph.nodes??[]).find(n=>n.originPhase===phase&&n.sourceRecordPath===sourceRecordPath&&n.nodeType===family);
        if(!item.canonicalId&&prior)item.canonicalId=prior.nodeId;
        if(!item.canonicalId) item.canonicalId=nextId(graph,family);
        if(!(graph.nodes??[]).some(n=>n.nodeId===item.canonicalId)) graph.nodes.push({nodeId:item.canonicalId,nodeType:family,originPhase:phase,sourceRecordPath});
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
function syncControls({root,campaignPath,schema,canonical,canonicalRel,now,replacePhase=false}){
  const controlDir=path.posix.join(campaignPath,'controller');
  const graphRel=path.posix.join(controlDir,'SECURITY_TRACEABILITY_GRAPH_v1.json');
  const ledgerRel=path.posix.join(controlDir,'CARRIED_FORWARD_OBLIGATION_LEDGER_v1.json');
  const invalidRel=path.posix.join(controlDir,'EVIDENCE_INVALIDATION_MATRIX_v1.json');
  const graph=readJson(requiredFile(root,graphRel,'traceability graph'));
  const ledger=readJson(requiredFile(root,ledgerRel,'obligation ledger'));
  const invalid=readJson(requiredFile(root,invalidRel,'invalidation matrix'));
  assignCanonicalIds(canonical,graph,schema.phase);
  graph.controllerImports??=[]; ledger.controllerImports??=[]; invalid.controllerImports??=[];
  if(replacePhase){
    graph.controllerImports=graph.controllerImports.filter(x=>x?.phase!==schema.phase);
    ledger.controllerImports=ledger.controllerImports.filter(x=>x?.phase!==schema.phase);
    invalid.controllerImports=invalid.controllerImports.filter(x=>x?.phase!==schema.phase);
  }
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
  const p7=derived(7,'PHASE8_MARKER_INPUT_v1.json');
  const p8Remediation=derived(8,'PHASE9_REMEDIATION_INPUT_v1.json');
  const p8Final=derived(8,'PHASE10_INPUT_v1.json');
  const p9Final=derived(9,'PHASE10_REMEDIATION_INPUT_v1.json');
  if(target===4) return uniqueExisting(root,[p2,p3]);
  if(target===5) return uniqueExisting(root,[p2,p3,p4]);
  if(target===6) return uniqueExisting(root,[p2,p3,p4,p5,buildIdentity,deploy,targets]);
  if(target===8) return uniqueExisting(root,[p2,p3,p4,p5,p6,p7,buildIdentity,deploy,targets]);
  if(target===9) return uniqueExisting(root,[p8Remediation,remediation]);
  if(target===10) return uniqueExisting(root,[p8Final,p9Final,finalIndex]);
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


function latestPhaseReceiptInfo(root,campaignPath,sequence){
  const dir=repoFile(root,path.posix.join(campaignPath,'receipts'));
  const rx=new RegExp('^PHASE_'+phaseNum(sequence)+'_RECEIPT_v([0-9]+)\\.json$');
  const rows=fs.readdirSync(dir).map(name=>({name,match:name.match(rx)})).filter(x=>x.match)
    .map(x=>({revision:Number(x.match[1]),rel:path.posix.join(campaignPath,'receipts',x.name)}))
    .sort((a,b)=>b.revision-a.revision);
  if(!rows.length)throw new Error('master repair refresh cannot find sealed Phase '+sequence+' receipt');
  return rows[0];
}
function revisionedArtifactPath(rel,revision){
  if(!rel)return null;
  if(/_v[0-9]+(?=\.[^.]+$)/.test(rel))return rel.replace(/_v[0-9]+(?=\.[^.]+$)/,'_v'+revision);
  return rel.replace(/(?=\.[^.]+$)/,'_v'+revision);
}
function reviewerForPhase(sequence){
  if(sequence===1)return 'reviewer-1';
  if(sequence>=2&&sequence<=5)return 'reviewer-2';
  if(sequence===6)return 'reviewer-3L';
  return 'reviewer-4';
}
function overlayReviewerOutputs(schema,fresh,saved){
  for(const [stepKey,action] of Object.entries(schema.actions??{})){
    for(const field of action.fields??[]){
      if(saved?.actions?.[stepKey]?.outputs&&Object.hasOwn(saved.actions[stepKey].outputs,field.name)){
        fresh.actions??={};fresh.actions[stepKey]??={};fresh.actions[stepKey].outputs??={};
        fresh.actions[stepKey].outputs[field.name]=structuredClone(saved.actions[stepKey].outputs[field.name]);
      }
    }
  }
  return fresh;
}
function copyAuthorityForShadow(root,shadowRoot,authorityRoot){
  const logical=repoFile(root,authorityRoot);
  if(fs.existsSync(logical)){
    fs.mkdirSync(path.dirname(repoFile(shadowRoot,authorityRoot)),{recursive:true});
    fs.cpSync(logical,repoFile(shadowRoot,authorityRoot),{recursive:true});
    return;
  }
  const frozen='audit-process/v7/frozen-authorities/Audit_Litemode_v10.3';
  if(authorityRoot!=='Audit Skill - Current Authority/Audit_Litemode_v10.3'||!fs.existsSync(repoFile(root,frozen)))throw new Error('master repair refresh cannot materialize bound authority '+authorityRoot);
  fs.mkdirSync(path.dirname(repoFile(shadowRoot,frozen)),{recursive:true});
  fs.cpSync(repoFile(root,frozen),repoFile(shadowRoot,frozen),{recursive:true});
}
function applyMasterRepairRefresh({root,campaignPath,directoryRel,directory,authorityRoot,result,now}){
  const segment=MASTER_REVIEW_SEGMENTS_V1.find(x=>x.segmentId===result.pending.segmentId);
  if(!segment)throw new Error('master repair refresh segment is unsupported');
  const affected=result.affectedPhases??[];
  if(!affected.length)throw new Error('master repair refresh has no affected phases');
  const earliest=Math.min(...affected);
  const originalForms=new Map();
  const phaseRows=new Map();
  for(const phase of segment.phases){
    const row=(result.form.reviewedArtifacts??[]).find(x=>x.phase===phase&&x.kind==='WORK_FORM');
    if(row){
      phaseRows.set(phase,row);
      originalForms.set(phase,readJson(requiredFile(root,path.posix.join(campaignPath,row.path),'accepted Phase '+phase+' work form')));
    }
  }
  const refreshPhases=segment.phases.filter(phase=>phase>=earliest&&phase!==7&&phaseRows.has(phase));
  if(!refreshPhases.length)throw new Error('master repair refresh has no reviewer-owned phase to regenerate');
  const shadowRoot=fs.mkdtempSync(path.join(os.tmpdir(),'lite-master-repair-'));
  try{
    fs.mkdirSync(path.dirname(repoFile(shadowRoot,campaignPath)),{recursive:true});
    fs.cpSync(repoFile(root,campaignPath),repoFile(shadowRoot,campaignPath),{recursive:true});
    fs.mkdirSync(path.dirname(repoFile(shadowRoot,directoryRel)),{recursive:true});
    fs.copyFileSync(repoFile(root,directoryRel),repoFile(shadowRoot,directoryRel));
    copyAuthorityForShadow(root,shadowRoot,authorityRoot);
    const receiptLibRel='packages/controller-core/src/lite-phase-receipt-v1.mjs';
    fs.mkdirSync(path.dirname(repoFile(shadowRoot,receiptLibRel)),{recursive:true});
    fs.copyFileSync(requiredFile(root,receiptLibRel,'lite receipt library'),repoFile(shadowRoot,receiptLibRel));

    let shadowDirectory=readJson(repoFile(shadowRoot,directoryRel));
    for(let index=0;index<refreshPhases.length;index++){
      const phase=refreshPhases[index];
      const loaded=loadPhaseSchema(shadowRoot,authorityRoot,phase);
      const schema=loaded.schema;
      const row=phaseRows.get(phase);
      const formRel=path.posix.join(campaignPath,row.path);
      let form;
      let predecessorReceiptPath;
      let derivedInputPaths;
      if(index===0){
        form=structuredClone(originalForms.get(phase));
        const oldReceipt=readJson(requiredFile(shadowRoot,latestPhaseReceiptInfo(shadowRoot,campaignPath,phase).rel,'sealed Phase '+phase+' receipt'));
        predecessorReceiptPath=(oldReceipt.inputs??[]).find(x=>x?.role==='PREDECESSOR_RECEIPT')?.path;
        derivedInputPaths=form.automationInputs?.derivedInputPaths??[];
      }else{
        const generated=shadowDirectory.currentAssignment;
        if(generated?.phaseSequence!==phase)throw new Error('master repair refresh dependency chain did not prepare Phase '+phase);
        predecessorReceiptPath=generated.predecessorReceiptPath;
        derivedInputPaths=generated.derivedInputPaths??[];
        const fresh=readJson(requiredFile(shadowRoot,generated.workFormPath,'refreshed Phase '+phase+' scaffold'));
        form=overlayReviewerOutputs(schema,fresh,originalForms.get(phase));
      }
      if(!predecessorReceiptPath)throw new Error('master repair refresh lacks predecessor receipt for Phase '+phase);
      form.automationInputs={...(form.automationInputs??{}),predecessorReceiptPath,derivedInputPaths:[...derivedInputPaths]};
      const prefillDigest=refreshControllerPrefillDigest(form);
      writeJson(repoFile(shadowRoot,formRel),form);
      const revision=latestPhaseReceiptInfo(shadowRoot,campaignPath,phase).revision+1;
      shadowDirectory.currentAssignment={
        phaseSequence:phase,
        phaseId:'phase-'+phase,
        phaseRevision:revision,
        reviewer:reviewerForPhase(phase),
        status:'ACTIVE',
        workSchemaPath:loaded.rel,
        workFormPath:formRel,
        finalReportPath:schema.finalReport?revisionedArtifactPath(path.posix.join(campaignPath,schema.finalReport.campaignPath),revision):null,
        packetPath:revisionedArtifactPath(path.posix.join(campaignPath,schema.submission.packetPath),revision),
        predecessorReceiptPath,
        derivedInputPaths:[...derivedInputPaths],
        controllerPrefillDigestSha256:prefillDigest,
        masterRepairRefreshSha256:result.pending.repairSpecSha256
      };
      shadowDirectory.campaignStatus='MASTER_REVIEW_REWORK_REQUIRED';
      shadowDirectory.updatedAt=now;
      writeJson(repoFile(shadowRoot,directoryRel),shadowDirectory);
      const output=execFileSync(process.execPath,[
        process.argv[1],
        '--controller-root',shadowRoot,
        '--campaign-id',directory.campaignId,
        '--campaign-path',campaignPath,
        '--campaign-directory-path',directoryRel,
        '--phase-sequence',String(phase),
        '--master-repair-refresh-sha',result.pending.repairSpecSha256
      ],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
      const parsed=JSON.parse(output.trim());
      if(parsed.status!=='PASS'||parsed.masterRepairRefresh!==true)throw new Error('controller dependent refresh failed for Phase '+phase+': '+String(parsed.feedbackText??parsed.status));
      shadowDirectory=readJson(repoFile(shadowRoot,directoryRel));
    }
    const refreshedDirectory=readJson(repoFile(shadowRoot,directoryRel));
    const postRepairArtifacts=collectSegmentArtifacts({root:shadowRoot,campaignPath,segment,directory:refreshedDirectory,expectedAuthority:{homepagePath:result.form.bindings.authority.homepagePath,liteSkillSha256:result.form.bindings.authority.sha256}});
    fs.cpSync(repoFile(shadowRoot,campaignPath),repoFile(root,campaignPath),{recursive:true,force:true});
    const masterForm=readJson(requiredFile(root,result.pending.workFormPath,'master review work form'));
    masterForm.bindings={...masterForm.bindings,repairChildSha256:createHash('sha256').update(JSON.stringify(result.form.childRepair)).digest('hex')};
    masterForm.postRepair={
      schemaVersion:'curveyield-lite-master-repair-refresh-v1',
      scopeId:result.pending.repairScopeId,
      repairSpecSha256:result.pending.repairSpecSha256,
      refreshedPhases:refreshPhases,
      artifacts:postRepairArtifacts,
      manifestSha256:createHash('sha256').update(JSON.stringify(postRepairArtifacts)).digest('hex'),
      refreshedAt:now
    };
    masterForm.updatedAt=now;
    writeJson(repoFile(root,result.pending.workFormPath),masterForm);
    return {
      refreshedPhases:refreshPhases,
      postRepairArtifacts,
      postRepairManifestSha256:masterForm.postRepair.manifestSha256,
      bindingsSha256:createHash('sha256').update(JSON.stringify(masterForm.bindings)).digest('hex'),
      lastSealedReceiptPath:refreshedDirectory.lastSealedReceiptPath,
      nextAssignment:refreshedDirectory.currentAssignment,
      campaignStatus:refreshedDirectory.campaignStatus
    };
  }finally{
    fs.rmSync(shadowRoot,{recursive:true,force:true});
  }
}


const a=parse(process.argv);
const reviewKind=a['review-kind']??'phase';
const masterRepairRefreshSha=a['master-repair-refresh-sha']??null;
if(masterRepairRefreshSha&&reviewKind!=='phase')throw new Error('master-repair-refresh-sha is internal to phase refresh');
for(const k of ['controller-root','campaign-id','campaign-path','campaign-directory-path']) if(a[k]===undefined) throw new Error('missing --'+k);
if(['phase','sealed-rework'].includes(reviewKind)&&a['phase-sequence']===undefined) throw new Error('missing --phase-sequence');
if(reviewKind==='sealed-rework'&&!a['rework-request-path']) throw new Error('missing --rework-request-path');
if(!['phase','master','sealed-rework'].includes(reviewKind)) throw new Error('review-kind must be phase, master, or sealed-rework');
const root=path.resolve(a['controller-root']);
const expectedCampaignId=a['campaign-id'];
const campaignPath=a['campaign-path']; const campaignRoot=repoFile(root,campaignPath);
const sequence=reviewKind==='master'?null:Number(a['phase-sequence']);
const directoryRel=a['campaign-directory-path']; const directoryFile=requiredFile(root,directoryRel,'campaign directory entry');
const directory=readJson(directoryFile);
const now=new Date().toISOString();
if(directory.schemaVersion!=='curveyield-audit-campaign-directory-entry-v2') throw new Error('packet controller requires Audit Campaign Directory v2');
if(directory.campaignId!==expectedCampaignId) throw new Error('campaign-id does not match Audit Campaign Directory');
if(directory.workspacePath!==campaignPath) throw new Error('campaign-path does not match Audit Campaign Directory workspacePath');
if(masterRepairRefreshSha){
  if(directory.pendingMasterReview?.status!=='MASTER_REVIEW_REWORK_REQUIRED'||directory.pendingMasterReview?.repairSpecSha256!==masterRepairRefreshSha)throw new Error('master repair refresh is not bound to the pending repair specification');
  if(directory.currentAssignment?.masterRepairRefreshSha256!==masterRepairRefreshSha)throw new Error('master repair refresh assignment binding mismatch');
}
if(reviewKind==='master'){
  const pending=directory.pendingMasterReview;
  if(!pending) throw new Error('campaign has no pending master review');
  const lastReceipt=readJson(requiredFile(root,pending.lastSealedReceiptPath??directory.lastSealedReceiptPath,'last sealed receipt'));
  const masterAuthorityRoot=authorityRootFromReceipt(lastReceipt);
  const result=processMasterReviewSubmission({root,campaignPath,directory,authorityRoot:masterAuthorityRoot,segmentId:a['segment-id']??null,now});
  if(result.status==='MASTER_REVIEW_HELD'){
    const feedback='MASTER_REVIEW_HELD: '+result.failures.join('; ')+'. No campaign state or reviewed artifact was changed.';
    process.stdout.write(JSON.stringify({status:result.status,campaignId:directory.campaignId,campaignName:directory.campaignName,segmentId:pending.segmentId,masterChatUrl:directory.masterReview?.chatUrl??null,freshSuccessorRequired:false,sameReviewerAdvanced:false,nextAssignment:null,feedbackText:feedback,feedbackB64:Buffer.from(feedback).toString('base64'),directoryPath:directoryRel})+'\n');
    process.exit(0);
  }
  if(result.status==='MASTER_REVIEW_INVALID'){
    const feedback=['Master-review submission is invalid. Repair only the exact items below.','',...result.failures.map(x=>'- '+x),'','Do not advance or complete the campaign.'].join('\n');
    process.stdout.write(JSON.stringify({status:result.status,campaignId:directory.campaignId,campaignName:directory.campaignName,segmentId:pending.segmentId,masterChatUrl:directory.masterReview?.chatUrl??null,feedbackText:feedback,feedbackB64:Buffer.from(feedback).toString('base64'),directoryPath:directoryRel})+'\n');
    process.exit(0);
  }
  if(result.status==='MASTER_REVIEW_REWORK_REQUIRED'){
    writeJson(directoryFile,directory);
    const feedback=childRepairWakeMessage({campaignId:directory.campaignId,pending,repairSpec:result.repairSpec});
    process.stdout.write(JSON.stringify({status:result.status,campaignId:directory.campaignId,campaignName:directory.campaignName,segmentId:pending.segmentId,masterChatUrl:directory.masterReview.chatUrl,repairModel:'SOL',repairReasoning:'HIGH',repairSpec:result.repairSpec,feedbackText:feedback,feedbackB64:Buffer.from(feedback).toString('base64'),directoryPath:directoryRel})+'\n');
    process.exit(0);
  }
  if(result.status==='MASTER_REPAIR_READY_FOR_REFRESH'){
    const refresh=applyMasterRepairRefresh({root,campaignPath,directoryRel,directory,authorityRoot:masterAuthorityRoot,result,now});
    pending.status='WAITING_FOR_MASTER_REVIEW';
    pending.lastSealedReceiptPath=refresh.lastSealedReceiptPath;
    directory.lastSealedReceiptPath=refresh.lastSealedReceiptPath;
    pending.postRepairManifestSha256=refresh.postRepairManifestSha256;
    pending.bindingsSha256=refresh.bindingsSha256;
    pending.updatedAt=now;
    directory.currentAssignment=null;
    directory.campaignStatus='WAITING_FOR_MASTER_REVIEW';
    directory.updatedAt=now;
    writeJson(directoryFile,directory);
    const feedback='MASTER_REPAIR_READY_FOR_VERIFICATION: controller refreshed Phases '+refresh.refreshedPhases.join(', ')+'. The same persistent Maximum master must verify the exact postRepair manifest before ACCEPT.';
    process.stdout.write(JSON.stringify({status:'MASTER_REPAIR_READY_FOR_VERIFICATION',campaignId:directory.campaignId,campaignName:directory.campaignName,segmentId:pending.segmentId,masterChatUrl:directory.masterReview.chatUrl,masterReasoning:'MAXIMUM',workFormPath:pending.workFormPath,postRepairManifestSha256:pending.postRepairManifestSha256,freshSuccessorRequired:false,sameReviewerAdvanced:false,nextAssignment:null,feedbackText:feedback,feedbackB64:Buffer.from(feedback).toString('base64'),directoryPath:directoryRel})+'\n');
    process.exit(0);
  }
  const plan=result.successorPlan??{};
  let nextAssignment=null;
  if(plan.nextPhaseSequence===null||plan.nextPhaseSequence===undefined){
    directory.campaignStatus='COMPLETE';directory.currentAssignment=null;
  }else{
    nextAssignment=preparePhaseWork({root,campaignPath,authorityRoot:masterAuthorityRoot,sequence:plan.nextPhaseSequence,reviewer:assignmentReviewer(plan.nextPhaseSequence),predecessorReceiptPath:pending.lastSealedReceiptPath,derivedInputPaths:plan.derivedInputPaths??[],status:'WAITING_FOR_SUCCESSOR_AGENT',prefillContext:plan.prefillContext??{}});
    directory.currentAssignment=nextAssignment;directory.campaignStatus='WAITING_FOR_SUCCESSOR_AGENT';
  }
  const acceptedSegment=pending.segmentId;
  directory.lastSealedReceiptPath=pending.lastSealedReceiptPath;
  directory.lastAcceptedMasterReview={segmentId:acceptedSegment,workFormPath:pending.workFormPath,manifestSha256:pending.manifestSha256,...(pending.postRepairManifestSha256?{postRepairManifestSha256:pending.postRepairManifestSha256}:{}),acceptedAt:now,masterChatUrl:directory.masterReview.chatUrl};
  delete directory.pendingMasterReview;directory.updatedAt=now;writeJson(directoryFile,directory);
  const feedback='MASTER_REVIEW_ACCEPTED: '+acceptedSegment+' accepted.'+(nextAssignment?' Successor Phase '+nextAssignment.phaseSequence+' may now be launched.':' Campaign is now COMPLETE.');
  process.stdout.write(JSON.stringify({status:'PASS',masterReviewAccepted:true,campaignId:directory.campaignId,campaignName:directory.campaignName,segmentId:acceptedSegment,freshSuccessorRequired:Boolean(nextAssignment),sameReviewerAdvanced:false,nextAssignment,feedbackText:feedback,feedbackB64:Buffer.from(feedback).toString('base64'),directoryPath:directoryRel})+'\n');
  process.exit(0);
}
let sealedRework=null;
if(reviewKind==='phase'&&!masterRepairRefreshSha&&['STOPPED_BY_HUMAN','BLOCKED'].includes(String(directory.campaignStatus??'')))throw new Error('campaign is held by explicit human status '+directory.campaignStatus);
if(reviewKind==='sealed-rework'){
  sealedRework=admitSealedPhaseRework({root,campaignPath,directory,requestPath:a['rework-request-path'],now});
  const deliveryHoldRel=path.posix.join(campaignPath,'controller/SUCCESSOR_DELIVERY_HOLD_v1.json');
  writeJson(repoFile(root,deliveryHoldRel),{
    schemaVersion:'curveyield-lite-successor-delivery-hold-v1',
    campaignId:directory.campaignId,
    campaignGenerationId:directory.campaignGenerationId,
    sourceSha256:directory.sourceSha256,
    scopeId:sealedRework.request.humanAuthorization.scopeId,
    requestPath:a['rework-request-path'],
    status:'ACTIVE',
    reason:'HUMAN_AUTHORIZED_SEALED_REWORK_BRANCH_QUALIFICATION',
    createdAt:now,
    releaseRequiresExplicitHumanAuthorization:true
  });
  directory.currentAssignment=sealedRework.assignment;directory.campaignStatus='ACTIVE';directory.updatedAt=now;
}
const assignment=directory.currentAssignment;
if(!assignment||assignment.phaseSequence!==sequence) throw new Error('current assignment does not match submitted phase');
const predecessor=readJson(requiredFile(root,assignment.predecessorReceiptPath,'predecessor sealed receipt'));
const authorityRoot=authorityRootFromReceipt(predecessor);
const loaded=loadPhaseSchema(root,authorityRoot,sequence); const schema=loaded.schema;
const gatedMasterReview=masterReviewRequired(directory,authorityRoot)&&!masterRepairRefreshSha;
if(assignment.workSchemaPath!==loaded.rel) throw new Error('assignment workSchemaPath mismatch');

const packetFile=repoFile(root,assignment.packetPath);
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
    if(!target||typeof target!=='object') continue;
    const method=String(target.executionMethod??'').toUpperCase();
    if(method==='NOT_APPLICABLE'){
      target.executionRequestRef='NOT_APPLICABLE';
      target.automationResolvedExecutionRequest=false;
      target.requestBindingStatus='NOT_APPLICABLE';
      target.requestBindingEvidenceRef='NOT_APPLICABLE';
      target.automationOwnedFields=[...new Set([
        ...(target.automationOwnedFields??[]),
        'executionRequestRef','automationResolvedExecutionRequest','requestBindingStatus','requestBindingEvidenceRef'
      ])];
      continue;
    }
    const explicitBeforeResolve=typeof target.executionRequestRef==='string'
      && !target.executionRequestRef.startsWith('<')
      && target.executionRequestRef!=='NOT_APPLICABLE';
    const resolved=resolveTargetExecutionRequestRef({root,campaignPath,target});
    if(!resolved){
      deficiencies.push('Phase 5 target '+String(target.candidateKey??'UNRESOLVED')+' has no deterministically resolvable execution request. Materialize the exact trusted V7 request at a conventional campaign request path or provide a campaign-relative executionRequestRef only for this target.');
      continue;
    }
    target.executionRequestRef=resolved;
    target.automationResolvedExecutionRequest=!explicitBeforeResolve;

    const binding=validateTargetExecutionRequestBindingV1({
      controllerRoot:root,
      campaignPath,
      target,
      expectedCampaignId:directory.campaignId,
      expectedSourceSha256:directory.sourceSha256
    });
    target.requestBindingStatus=binding.status;
    target.requestBindingEvidenceRef=binding.requestRef??resolved;
    target.automationOwnedFields=[...new Set([
      ...(target.automationOwnedFields??[]),
      'executionRequestRef','automationResolvedExecutionRequest','requestBindingStatus','requestBindingEvidenceRef'
    ])];
    if(!String(binding.status).startsWith('PASS_')){
      deficiencies.push(
        'Phase 5 target '+String(target.candidateKey??'UNRESOLVED')+
        ' execution request is not structurally bound to the accepted target/source: '+
        String(binding.status)+' — '+(binding.reasons??[]).join('; ')
      );
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
const controls=syncControls({root,campaignPath,schema,canonical,canonicalRel,now,replacePhase:Boolean(masterRepairRefreshSha)});
if(sealedRework){
  const invalid=readJson(requiredFile(root,controls.invalidRel,'evidence invalidation matrix'));
  const events=invalid.events??(invalid.events=[]);
  if(events.some(x=>x?.eventId==='INV-P1-REWORK-002'||x?.id==='INV-P1-REWORK-002'))throw new Error('INV-P1-REWORK-002 already exists');
  events.push({eventId:'INV-P1-REWORK-002',ruleId:'EIM-013',status:'RESOLVED_BY_PHASE_1_REVISION_3',priorState:'SEALED_REVISION_2',fromRevision:2,toRevision:3,sourceSha256:directory.sourceSha256,scopeId:sealedRework.request.humanAuthorization.scopeId,authorizationRecordPath:sealedRework.request.humanAuthorization.recordPath,qualityReviewPath:sealedRework.request.qualityReview.path,resolutionReceiptPath:'PENDING_PHASE_1_REVISION_3_RECEIPT',resolvedAt:now});
  writeJson(repoFile(root,controls.invalidRel),invalid);
}
writeJson(repoFile(root,canonicalRel),canonical);
const derivedRels=buildDerivedOutputs({root,campaignPath,schema,canonicalData:canonical,canonicalRel,now});
const boundaryArtifactRels=[];
let successorPrefillContext={};
if(sequence===5){
  const targetDesigns=phaseOutput(canonical,'step-3','targetDesigns')??[];
  const executionResults=await executePhase5TargetsV1({
    controllerRoot:root,
    campaignPath,
    targetDesigns,
    expectedCampaignId:directory.campaignId,
    expectedSourceSha256:directory.sourceSha256
  });
  successorPrefillContext={targetDesigns,phase5ExecutionResults:executionResults};
  const targetMatrixRel=path.posix.join(campaignPath,'work/phase-06/LITE_TARGETED_TEST_MATRIX.md');
  const phase0Baseline=
    readJsonIf(repoFile(root,path.posix.join(campaignPath,'derived/phase-0-rebind/PHASE6_SIMULATION_BASELINE_INPUT_v1.json'))) ??
    readJsonIf(repoFile(root,path.posix.join(campaignPath,'derived/phase-0/PHASE6_SIMULATION_BASELINE_INPUT_v1.json'))) ??
    {};
  const baselineRows=phase0Baseline.baselineMatrixRows??[];
  fs.mkdirSync(path.dirname(repoFile(root,targetMatrixRel)),{recursive:true});
  fs.writeFileSync(repoFile(root,targetMatrixRel),renderTargetedTestMatrixV1({targetDesigns,executionResults,baselineRows}));
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
const phaseRevision=Number(assignment.phaseRevision??1);
if(!Number.isInteger(phaseRevision)||phaseRevision<1) throw new Error('assignment.phaseRevision must be an integer >= 1 when present');
const receiptRel=receiptLib.phaseReceiptPath(campaignPath,sequence,phaseRevision);
const evidence=[receiptRef(root,campaignPath,assignment.workFormPath,'PHASE_WORK_FORM')];
if(sealedRework){
  evidence.push(receiptRef(root,campaignPath,sealedRework.request.priorReceipt.path,'PRIOR_PHASE_REVISION'));
  evidence.push(receiptRef(root,campaignPath,sealedRework.request.qualityReview.path,'HUMAN_QUALITY_REVIEW'));
  evidence.push(receiptRef(root,campaignPath,sealedRework.request.humanAuthorization.recordPath,'HUMAN_REWORK_AUTHORIZATION'));
}
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
  workspacePath:campaignPath,campaignDirectoryEntryPath:directoryRel,sequence,revision:phaseRevision,executorType:'AI_REVIEWER',executorLineage:assignment.reviewer,
  authority:predecessor.authority,sourceSha256:directory.sourceSha256,source:predecessor.source,status:sequence===10&&!gatedMasterReview?'COMPLETE':'SEALED',
  inputs:[{role:'PREDECESSOR_RECEIPT',path:assignment.predecessorReceiptPath},{role:'CONTROLLER_GENERATED_PHASE_WORK_PACKET',path:assignment.packetPath}],
  evidence,outputs:evidence,
  globalControls:{securityTraceabilityGraph:path.posix.relative(campaignPath,controls.graphRel),carriedForwardObligationLedger:path.posix.relative(campaignPath,controls.ledgerRel),evidenceInvalidationMatrix:path.posix.relative(campaignPath,controls.invalidRel),sourceIntelligenceBundle:predecessor.globalControls?.sourceIntelligenceBundle??null},
  obligations:receiptObligationSummary({ledger:ledgerAfter,canonical,form,sequence,now}),
  validation:{status:'PASS',validatedAt:now,failures:[]},handoff,now
});
receipt.sealedAt=now;receipt.updatedAt=now;
if(masterRepairRefreshSha)receipt.masterRepair={schemaVersion:'curveyield-lite-master-repair-receipt-v1',scopeId:directory.pendingMasterReview.repairScopeId,repairSpecSha256:masterRepairRefreshSha,priorRevision:phaseRevision-1,controllerDependentRefresh:true};
if(sealedRework){
  receipt.rework={schemaVersion:'curveyield-lite-sealed-phase-rework-v1',fromRevision:2,toRevision:3,scopeId:sealedRework.request.humanAuthorization.scopeId,requestPath:a['rework-request-path'],qualityReviewPath:sealedRework.request.qualityReview.path,evidenceInvalidationEvent:'INV-P1-REWORK-002',evidenceInvalidationRule:'EIM-013',successorDeliveryHeld:true};
  const invalid=readJson(requiredFile(root,controls.invalidRel,'evidence invalidation matrix'));
  const events=invalid.events??invalid.invalidationEvents??[];
  const event=events.find(x=>x?.eventId==='INV-P1-REWORK-002'||x?.id==='INV-P1-REWORK-002');
  if(event)event.resolutionReceiptPath=receiptRel;
  writeJson(repoFile(root,controls.invalidRel),invalid);
}
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
  const markerRevision=masterRepairRefreshSha?phaseRevision:1;
  const markerRel=receiptLib.phaseReceiptPath(campaignPath,7,markerRevision);
  const markerEvidence=[receiptRef(root,campaignPath,form7Rel,'AUTOMATIC_PHASE7_WORK_FORM'),receiptRef(root,campaignPath,canonical7Rel,'AUTOMATIC_PHASE7_CANONICAL_DATA'),...derived7.map(x=>receiptRef(root,campaignPath,x,'DERIVED_DOWNSTREAM_DATA'))];
  const markerHandoff=gatedMasterReview?{required:true,boundary:'MASTER_REVIEW_SEGMENT_06_07',incomingReviewer:'master-reviewer',assignedWork:'Review reviewer-3L segment Phases 6-7',nextPhaseSequence:8,sameReviewer:false,status:'MASTER_REVIEW_PENDING'}:{required:true,boundary:'P67_TO_P8',incomingReviewer:'reviewer-4',assignedWork:'Combined Lite Phases 8-10',nextPhaseSequence:8,sameReviewer:false,status:'SUCCESSOR_PENDING'};
  const marker=receiptLib.createLitePhaseReceiptV1({campaignId:directory.campaignId,campaignGenerationId:directory.campaignGenerationId,campaignName:directory.campaignName,workspacePath:campaignPath,campaignDirectoryEntryPath:directoryRel,sequence:7,executorType:'GITHUB_ACTIONS',executorLineage:'phase7-automation',revision:markerRevision,authority:predecessor.authority,sourceSha256:directory.sourceSha256,source:predecessor.source,status:'SEALED',inputs:[{role:'PREDECESSOR_RECEIPT',path:receiptRel}],evidence:markerEvidence,outputs:markerEvidence,globalControls:receipt.globalControls,validation:{status:'PASS',validatedAt:now,failures:[]},handoff:markerHandoff,now});
  marker.sealedAt=now;if(masterRepairRefreshSha)marker.masterRepair={schemaVersion:'curveyield-lite-master-repair-receipt-v1',scopeId:directory.pendingMasterReview.repairScopeId,repairSpecSha256:masterRepairRefreshSha,priorRevision:markerRevision-1,controllerDependentRefresh:true};writeJson(repoFile(root,markerRel),marker);sealedReceiptRel=markerRel;fresh=true;nextSequence=8;nextDerivedInputs=resolveInputsForTarget({root,campaignPath,target:8,immediate:[...derivedRels,...derived7,...boundaryArtifactRels]});
}
if(sequence===8&&nextSequence===10){
  const skippedRevision=masterRepairRefreshSha?phaseRevision:1;
  const skippedRel=receiptLib.phaseReceiptPath(campaignPath,9,skippedRevision);
  const skipped=receiptLib.createLitePhaseReceiptV1({campaignId:directory.campaignId,campaignGenerationId:directory.campaignGenerationId,campaignName:directory.campaignName,workspacePath:campaignPath,campaignDirectoryEntryPath:directoryRel,sequence:9,revision:skippedRevision,executorType:'GITHUB_ACTIONS',executorLineage:'phase9-skip-automation',authority:predecessor.authority,sourceSha256:directory.sourceSha256,source:predecessor.source,status:'SKIPPED',inputs:[{role:'PREDECESSOR_RECEIPT',path:receiptRel}],outputs:[],automation:[{action:'SKIPPED_NO_REMEDIATION',status:'PASS',recordedAt:now}],globalControls:receipt.globalControls,validation:{status:'NOT_APPLICABLE',validatedAt:now,failures:[]},handoff:{required:false,boundary:null,incomingReviewer:'reviewer-4',assignedWork:'Phase 10',nextPhaseSequence:10,sameReviewer:true,status:'NOT_APPLICABLE'},now});
  skipped.sealedAt=now;if(masterRepairRefreshSha)skipped.masterRepair={schemaVersion:'curveyield-lite-master-repair-receipt-v1',scopeId:directory.pendingMasterReview.repairScopeId,repairSpecSha256:masterRepairRefreshSha,priorRevision:skippedRevision-1,controllerDependentRefresh:true};writeJson(repoFile(root,skippedRel),skipped);sealedReceiptRel=skippedRel;
}
directory.lastSealedReceiptPath=sealedReceiptRel;
const masterBoundary=sequence===1?1:sequence===5?5:sequence===6?7:sequence===10?10:null;
if(gatedMasterReview&&masterBoundary!==null){
  const staged=stageMasterReview({root,campaignPath,directory,predecessor,authorityRoot,boundaryPhase:masterBoundary,lastSealedReceiptPath:sealedReceiptRel,nextSequence,nextDerivedInputPaths:nextDerivedInputs,successorPrefillContext,now});
  writeJson(directoryFile,directory);
  const feedback=masterWakeMessage({campaignId:directory.campaignId,pending:staged.pending});
  process.stdout.write(JSON.stringify({status:'WAITING_FOR_MASTER_REVIEW',controllerPassToken:'CONTROLLER_PHASE_PASS',campaignId:directory.campaignId,campaignName:directory.campaignName,phaseSequence:sequence,segmentId:staged.segment.segmentId,masterReviewRequired:true,masterChatUrl:directory.masterReview.chatUrl,masterReasoning:'MAXIMUM',workFormPath:staged.pending.workFormPath,receiptPath:receiptRel,lastSealedReceiptPath:directory.lastSealedReceiptPath,freshSuccessorRequired:false,sameReviewerAdvanced:false,nextAssignment:null,feedbackText:feedback,feedbackB64:Buffer.from(feedback).toString('base64'),directoryPath:directoryRel})+'\n');
  process.exit(0);
}
if(sequence===10){directory.campaignStatus='COMPLETE';directory.currentAssignment=null;directory.updatedAt=now;}
else{
  const nextReviewer=assignmentReviewer(nextSequence);
  const nextStatus=fresh||isFreshBoundary(nextSequence)?'WAITING_FOR_SUCCESSOR_AGENT':'ACTIVE';
  nextAssignment=preparePhaseWork({root,campaignPath,authorityRoot,sequence:nextSequence,reviewer:nextReviewer,predecessorReceiptPath:sealedReceiptRel,derivedInputPaths:nextDerivedInputs,status:nextStatus,prefillContext:successorPrefillContext});
  directory.currentAssignment=nextAssignment;directory.campaignStatus=nextStatus==='WAITING_FOR_SUCCESSOR_AGENT'?'WAITING_FOR_SUCCESSOR_AGENT':'ACTIVE';directory.updatedAt=now;
}
writeJson(directoryFile,directory);
const feedback='CONTROLLER_PHASE_PASS: Phase '+sequence+' validated and sealed.'+(nextAssignment?' Next authorized assignment: Phase '+nextAssignment.phaseSequence+' / '+nextAssignment.reviewer+'.':' Campaign complete.');
process.stdout.write(JSON.stringify({status:'PASS',controllerPassToken:'CONTROLLER_PHASE_PASS',sealedRework:Boolean(sealedRework),masterRepairRefresh:Boolean(masterRepairRefreshSha),campaignId:directory.campaignId,campaignName:directory.campaignName,phaseSequence:sequence,receiptPath:receiptRel,lastSealedReceiptPath:directory.lastSealedReceiptPath,freshSuccessorRequired:Boolean(nextAssignment&&nextAssignment.status==='WAITING_FOR_SUCCESSOR_AGENT'),sameReviewerAdvanced:Boolean(nextAssignment&&nextAssignment.status==='ACTIVE'),nextAssignment,feedbackText:feedback,feedbackB64:Buffer.from(feedback).toString('base64'),directoryPath:directoryRel})+'\n');
