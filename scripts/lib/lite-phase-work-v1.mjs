import fs from 'node:fs';
import path from 'node:path';

export const EXPLICIT_NEGATIVES=new Set(['NONE_IDENTIFIED','NOT_APPLICABLE','NOT_TRIGGERED','NO_CANDIDATE','NO_REMEDIATION','INSUFFICIENT_EVIDENCE','UNRESOLVED','NO_ADDITIONAL_OBLIGATION','NO_CONTRADICTION']);

export function readJson(file){return JSON.parse(fs.readFileSync(file,'utf8'));}
export function writeJson(file,value){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n');}
export function writeText(file,value){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,value);}
export function safeRel(rel,label='path'){if(typeof rel!=='string'||!rel||rel.startsWith('/')||rel.split('/').includes('..')) throw new Error('unsafe '+label+': '+rel);return rel;}
export function repoFile(root,rel){return path.join(root,...safeRel(rel).split('/'));}
export function requiredFile(root,rel,label='file'){const f=repoFile(root,rel);if(!fs.existsSync(f)||!fs.statSync(f).isFile()) throw new Error('missing '+label+': '+rel);return f;}
export function authorityRootFromReceipt(receipt){const home=receipt?.authority?.homepagePath;if(typeof home!=='string'||!home.endsWith('/SKILL.md')) throw new Error('receipt authority.homepagePath missing');return path.posix.dirname(home);}
export function phaseSchemaRepoPath(authorityRoot,sequence){return path.posix.join(authorityRoot,'phases/phase-'+sequence,'PHASE_'+String(sequence).padStart(2,'0')+'_SCHEMA_v1.json');}
export function loadPhaseSchema(root,authorityRoot,sequence){const rel=phaseSchemaRepoPath(authorityRoot,sequence);const schema=readJson(requiredFile(root,rel,'phase schema'));if(schema.schemaVersion!=='curveyield-lite-phase-work-schema-v1'||schema.phase!==sequence) throw new Error('phase schema identity mismatch: '+rel);return {schema,rel};}
export function fullCampaignPath(campaignPath,rel){return path.posix.join(campaignPath,safeRel(rel));}
export function isPlaceholder(v){return typeof v==='string'&&(/^\s*$/.test(v)||/^<REQUIRED/.test(v)||v==='<fill>'||v==='TODO');}
function validateScalar(v,pathName,def){
  if(isPlaceholder(v)||v===null||v===undefined) return [pathName+' is missing'];
  if(def.type==='REQUIRED_ENUM'&&!def.allowed?.includes(String(v))) return [pathName+' must be one of: '+(def.allowed??[]).join(', ')];
  return [];
}
export function validateWorkForm(schema,form){
  const deficiencies=[];
  if(form?.schemaVersion!=='curveyield-lite-phase-work-form-v1') deficiencies.push('work form schemaVersion mismatch');
  if(form?.phase!==schema.phase) deficiencies.push('work form phase mismatch');
  for(const [stepKey,action] of Object.entries(schema.actions??{})){
    const row=form?.actions?.[stepKey];
    if(!row){deficiencies.push('actions.'+stepKey+' section is missing');continue;}
    if(row.section!==action.section) deficiencies.push('actions.'+stepKey+'.section must equal "'+action.section+'"');
    for(const field of action.fields??[]){
      const p='actions.'+stepKey+'.outputs.'+field.name;
      const v=row?.outputs?.[field.name];
      if(field.type==='REQUIRED_LIST'){
        if(!Array.isArray(v)||v.length===0) deficiencies.push(p+' must be a non-empty list');
        else for(let i=0;i<v.length;i++) if(isPlaceholder(v[i])) deficiencies.push(p+'['+i+'] is missing');
      }else if(field.type==='REQUIRED_RECORD_LIST'){
        if(!Array.isArray(v)||v.length===0) deficiencies.push(p+' must be a non-empty record list or explicit negative sentinel');
        else if(v.length===1&&typeof v[0]==='string'&&EXPLICIT_NEGATIVES.has(v[0])){}
        else for(let i=0;i<v.length;i++){
          const item=v[i];
          if(!item||typeof item!=='object'||Array.isArray(item)){deficiencies.push(p+'['+i+'] must be an object or explicit negative sentinel');continue;}
          for(const k of field.itemRequiredFields??[]) if(isPlaceholder(item[k])||item[k]===null||item[k]===undefined) deficiencies.push(p+'['+i+'].'+k+' is missing');
        }
      }else deficiencies.push(...validateScalar(v,p,field));
    }
  }
  return deficiencies;
}
export function validateFinalReport(schema,text){
  const deficiencies=[];const report=schema.finalReport;if(!report) return deficiencies;
  const lines=String(text??'').split(/\\r?\\n/);
  const headings=[];
  for(let i=0;i<lines.length;i++) if(lines[i].startsWith('## ')) headings.push({name:lines[i].slice(3).trim(),line:i});
  for(const heading of report.requiredSections??[]){
    const idx=headings.findIndex(x=>x.name===heading);
    if(idx<0){deficiencies.push('finalReport section missing: '+heading);continue;}
    const start=headings[idx].line+1;
    const end=idx+1<headings.length?headings[idx+1].line:lines.length;
    const body=lines.slice(start,end).join('\\n').trim();
    if(!body||/^<REQUIRED/.test(body)) deficiencies.push('finalReport section incomplete: '+heading);
  }
  return deficiencies;
}
export function getByPath(obj,dot){let cur=obj;for(const part of String(dot).split('.')){if(cur==null) return undefined;cur=cur[part];}return cur;}
export function setByPath(obj,dot,value){const parts=String(dot).split('.');let cur=obj;for(let i=0;i<parts.length-1;i++){cur[parts[i]]??={};cur=cur[parts[i]];}cur[parts.at(-1)]=value;}
export function buildDerivedOutputs({root,campaignPath,schema,canonicalData,canonicalRel,now}){
  const out=[];
  for(const spec of schema.derivedOutputs??[]){
    const data={};
    for(const selector of spec.selectors??[]) setByPath(data,selector,getByPath(canonicalData,selector));
    const rel=fullCampaignPath(campaignPath,spec.path);
    writeJson(repoFile(root,rel),{schemaVersion:'curveyield-lite-derived-phase-data-v1',phase:schema.phase,sourceCanonicalData:canonicalRel,generatedAt:now,data});
    out.push(rel);
  }
  return out;
}
export function preparePhaseWork({root,campaignPath,authorityRoot,sequence,reviewer,predecessorReceiptPath,derivedInputPaths=[],status='ACTIVE'}){
  const loaded=loadPhaseSchema(root,authorityRoot,sequence);const schema=loaded.schema;const schemaRel=loaded.rel;
  const formRel=fullCampaignPath(campaignPath,schema.workForm.campaignPath);
  const formTemplateRel=path.posix.join(authorityRoot,schema.workForm.template);
  const form=readJson(requiredFile(root,formTemplateRel,'work-form template'));
  form.automationInputs={predecessorReceiptPath,derivedInputPaths:[...derivedInputPaths]};
  writeJson(repoFile(root,formRel),form);
  let reportRel=null;
  if(schema.finalReport){
    reportRel=fullCampaignPath(campaignPath,schema.finalReport.campaignPath);
    const reportTemplateRel=path.posix.join(authorityRoot,schema.finalReport.template);
    writeText(repoFile(root,reportRel),fs.readFileSync(requiredFile(root,reportTemplateRel,'final-report template'),'utf8'));
  }
  return {phaseSequence:sequence,phaseId:'phase-'+sequence,reviewer,status,workSchemaPath:schemaRel,workFormPath:formRel,finalReportPath:reportRel,packetPath:fullCampaignPath(campaignPath,schema.submission.packetPath),predecessorReceiptPath,derivedInputPaths:[...derivedInputPaths]};
}
export function ensurePacketShape({packet,directory,assignment}){
  const deficiencies=[];
  if(packet?.schemaVersion!=='curveyield-lite-phase-work-packet-v1') deficiencies.push('packet.schemaVersion must be curveyield-lite-phase-work-packet-v1');
  if(packet?.campaignId!==directory.campaignId) deficiencies.push('packet.campaignId mismatch');
  if(packet?.phaseSequence!==assignment.phaseSequence) deficiencies.push('packet.phaseSequence mismatch');
  if(packet?.status!=='SUBMITTED') deficiencies.push('packet.status must be SUBMITTED');
  if(packet?.workFormPath!==assignment.workFormPath) deficiencies.push('packet.workFormPath mismatch');
  if(packet?.finalReportPath!==(assignment.finalReportPath??null)) deficiencies.push('packet.finalReportPath mismatch');
  if(!Number.isInteger(packet?.submissionAttempt)||packet.submissionAttempt<1) deficiencies.push('packet.submissionAttempt must be integer >=1');
  if(typeof packet?.submittedAt!=='string'||!packet.submittedAt) deficiencies.push('packet.submittedAt required');
  return deficiencies;
}
