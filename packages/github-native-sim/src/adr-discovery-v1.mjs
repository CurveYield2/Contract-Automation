import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {classesForTriggersV1,loadTaxonomyV1} from './adr-taxonomy-v1.mjs';
import {buildCoverageMatrixV1} from './adr-coverage-matrix-v1.mjs';
import {validateFlowReviewSubmissionV1,validateAttackSubmissionV1,feedbackTextV1,parseAnchorV1} from './adr-discovery-validators-v1.mjs';
import {repoFile,readJson,writeJson} from '../../../scripts/lib/lite-phase-work-v1.mjs';

const pathJoin=(campaign,relative)=>path.posix.join(campaign,'work/phase-04/discovery',relative);
const asset=(campaign,name)=>path.posix.join(campaign,'evidence/review-inventory',name);
const known=(root,rel)=>{const file=repoFile(root,rel);return fs.existsSync(file)?readJson(file):null;};
const hex=bytes=>createHash('sha256').update(bytes).digest('hex');
const arr=x=>Array.isArray(x)?x:[];
const sort=(a,b)=>String(a).localeCompare(String(b));
const head=(directory,now,schemaVersion,payload)=>({schemaVersion,campaignId:directory.campaignId,
 campaignGenerationId:directory.campaignGenerationId,sourceSha256:directory.sourceSha256,
 taxonomyVersion:'curveyield-defect-taxonomy-v1',detectionPolicy:'audit-detection-rebuild-v1',generatedAt:now,payload});
const unitSort=(a,b)=>'FRX'.indexOf(a.unitId[0])-'FRX'.indexOf(b.unitId[0])||sort(a.unitId,b.unitId);
function getInputs({root,campaignPath,automationRoot}){
 return {inventory:known(root,asset(campaignPath,'REVIEW_INVENTORY_v1.json')),
  plan:known(root,asset(campaignPath,'FLOW_PLAN_v1.json')),
  facts:known(root,asset(campaignPath,'SYSTEM_FACTS_v1.json')),
  taxonomy:loadTaxonomyV1(automationRoot)};
}
const unitList=(plan)=>[...arr(plan?.payload?.reviewUnits),...arr(plan?.payload?.attackUnits)].sort(unitSort);
const resolveUnit=(plan,unitId)=>unitList(plan).find(x=>x.unitId===unitId);
const contextAnchor=(c)=>c?c.path+':L'+c.lineStart+'-L'+c.lineEnd:'NO_SOURCE_ANCHOR';
function contextFor(inventory,id){return arr(inventory?.payload?.contexts).find(c=>c.contextId===id);}
function normalizeAccepted(state){return state?.payload??state;}
const packetRel=(campaign,unit)=>pathJoin(campaign,unit+'/ASSIGNMENT_PACKET_v1.json');
const submissionRel=(campaign,unit)=>pathJoin(campaign,unit+'/SUBMISSION_v1.json');
const stateRel=(campaign)=>pathJoin(campaign,'DISCOVERY_STATE_v1.json');
const stubObligations=(directory,now)=>head(directory,now,'curveyield-baseline-obligations-v1',{obligations:[],testGroups:[]});

export function buildUnitPacketV1({root,campaignPath,directory,authorityRoot,automationRoot,unitId,state,now}){
 const {inventory,plan,facts,taxonomy}=getInputs({root,campaignPath,automationRoot}),unit=resolveUnit(plan,unitId);
 if(!unit)throw new Error('unknown discovery unit '+unitId);
 const role=unit.role==='ATTACK'?'ATTACK':'FLOW_REVIEW',primary=arr(unit.primaryContextIds);
 const contextIds=role==='ATTACK'?arr(inventory?.payload?.contexts).filter(c=>unit.contracts?.some(n=>c.qualifiedContainer===n||c.effectiveIn?.includes(n))).map(c=>c.contextId):primary;
 const requiredClasses=Object.fromEntries(contextIds.sort().map(id=>[id,classesForTriggersV1(taxonomy,inventory?.payload?.triggers?.[id]??[])]));
 const instructionsPath=path.posix.join(authorityRoot,'discovery',role==='ATTACK'?'ATTACKER_START_HERE.md':'FLOW_REVIEW_START_HERE.md');
 const flows=arr(plan?.payload?.flows).filter(f=>arr(unit.flowIds).includes(f.flowId));
 const questions=arr(plan?.payload?.integrationQuestions).filter(q=>arr(unit.integrationQuestionIds).includes(q.obligationId));
 const packet=head(directory,now,'curveyield-discovery-assignment-packet-v1',{
  unitId,role,chatKey:role==='ATTACK'?'reviewer-3L':'reviewer-2',instructionsPath,
  submissionPath:submissionRel(campaignPath,unitId),boundaryRequestPath:'process/agent-upload/lite-phase-boundary/',
  sourceRoot:campaignPath+'/source',sourceInventoryPath:asset(campaignPath,'REVIEW_INVENTORY_v1.json'),
  flowPlanPath:asset(campaignPath,'FLOW_PLAN_v1.json'),
  systemFactsPath:asset(campaignPath,'SYSTEM_FACTS_v1.json'),
  primaryContexts:role==='ATTACK'?[]:primary.map(id=>contextFor(inventory,id)).filter(Boolean).map(c=>({...c,requiredClasses:requiredClasses[id]})),
  primaryContextIds:primary,readContextIds:role==='ATTACK'?contextIds:arr(unit.readContextIds),
  requiredClasses,flows,flowIds:arr(unit.flowIds),integrationQuestions:questions,
  integrationQuestionIds:arr(unit.integrationQuestionIds),
  ...(role==='ATTACK'?{contracts:unit.contracts}:{}),
  ...(role==='ATTACK'?{systemFacts:{
   guardTable:arr(facts?.payload?.guardTable).filter(x=>unit.contracts?.includes(x.contract)),
   siblingGroups:arr(facts?.payload?.siblingGroups).filter(x=>x.members?.some(m=>unit.contracts?.includes(m.contract))),
   crossContractEdges:arr(facts?.payload?.crossContractEdges).filter(x=>unit.contracts?.includes(x.fromContract)),
   valueFlows:arr(facts?.payload?.valueFlows).filter(x=>unit.contracts?.includes(x.contract))
  }}:{})
 });
 writeJson(repoFile(root,packetRel(campaignPath,unitId)),packet);
 return packet;
}

export function discoveryWakeMessageV1({directory,auditControllerRef,packetPath,submissionPath,instructionsPath,boundaryRequestPath,unitId,role,attempt,feedbackText=null}){
 const base='https://github.com/CurveYield2/Audit-Controller/blob/'+encodeURIComponent(auditControllerRef??'main')+'/';
 const link=(p)=>base+p.split('/').map(encodeURIComponent).join('/');
 const lines=[role==='ATTACK'?'You are the attacker reviewer. Campaign '+directory.campaignId:'You are reviewer-2. Campaign '+directory.campaignId,
  'Use the GitHub connector app for every repository read and write.',
  'Instructions: '+link(instructionsPath),'Assignment packet: '+link(packetPath),'Submission path: '+link(submissionPath)];
 if(feedbackText)lines.push('Controller feedback: '+feedbackText);
 lines.push('Boundary request location: '+(boundaryRequestPath??'process/agent-upload/lite-phase-boundary/'));
 lines.push('Exact boundary request JSON: '+JSON.stringify({schemaVersion:'curveyield-lite-phase-boundary-request-v1',
  campaignId:directory.campaignId,reviewKind:'discovery',unitId,auditControllerRef:auditControllerRef??'main',attempt}));
 lines.push('If no controller response arrives within 30 minutes of pushing the request, push the same request again with attempt increased by 1.');
 if(role==='ATTACK')lines.push("You may read any source file. Do not open work/phase-03/, work/phase-04/ work forms, or any other unit's folder under work/phase-04/discovery/.");
 return lines.join('\n\n');
}
function wakeFor({directory,unitId,state,packet,campaignPath,auditControllerRef='main',feedbackText=null}){
 const role=packet.payload.role,attempt=(state.payload.units[unitId]?.attempts??0)+1;
 const message=discoveryWakeMessageV1({directory,auditControllerRef,packetPath:packetRel(campaignPath,unitId),
  submissionPath:submissionRel(campaignPath,unitId),instructionsPath:packet.payload.instructionsPath,
  boundaryRequestPath:packet.payload.boundaryRequestPath,unitId,role,attempt,feedbackText});
 return {chatKey:role==='ATTACK'?'reviewer-3L':'reviewer-2',
  wakeId:directory.campaignId+'-discovery-'+unitId+'-a'+attempt,
  phaseId:'phase-4',milestoneId:'DISCOVERY_'+unitId,messageB64:Buffer.from(message).toString('base64')};
}
export function startDiscoveryV1({root,campaignPath,directory,authorityRoot,automationRoot,now,auditControllerRef='main'}){
 const plan=known(root,asset(campaignPath,'FLOW_PLAN_v1.json'));
 const units=unitList(plan),order=units.map(x=>x.unitId);
 const missing=!plan||!units.length;
 const state=head(directory,now,'curveyield-discovery-state-v1',{
  status:missing?'COMPLETE':'RUNNING',order,activeUnitId:missing?null:order[0],
  units:Object.fromEntries(units.map(x=>[x.unitId,{role:x.role,chatKey:x.role==='ATTACK'?'reviewer-3L':'reviewer-2',
   status:'PENDING',attempts:0,lastValidatedSubmissionSha:null,lastErrors:[],acceptedSubmissionSha:null}])),
  gaps:missing?[{code:'INVENTORY_INCOMPLETE',detail:'No flow plan'}]:structuredClone(arr(plan.payload.gaps))
 });
 writeJson(repoFile(root,stateRel(campaignPath)),state);
 if(missing)return {completeImmediately:true,state,statePath:stateRel(campaignPath),wake:null};
 const packet=buildUnitPacketV1({root,campaignPath,directory,authorityRoot,automationRoot,unitId:order[0],state,now});
 state.payload.units[order[0]].status='ACTIVE';
 writeJson(repoFile(root,stateRel(campaignPath)),state);
 return {completeImmediately:false,state,statePath:stateRel(campaignPath),wake:wakeFor({directory,unitId:order[0],state,packet,campaignPath,auditControllerRef})};
}
export function buildDiscoverySummaryV1({state,inventory,plan,acceptedSubmissions,taxonomy,now}){
 const rows=arr(acceptedSubmissions),checks=new Map(),candidates=[],paths=[],answers=[],na=[];
 for(const {unitId,submission} of rows){
  const isAttacker=unitId.startsWith('X-');
  if(isAttacker){paths.push(...arr(submission?.attackPaths));answers.push(...arr(submission?.integrationAnswers));continue;}
  candidates.push(...arr(submission?.candidates));
  for(const row of arr(submission?.rows)){
   const classMap=checks.get(row.contextId)??{};
   for(const check of arr(row?.checks)){
    classMap[check.classId]=check.assessment;
    if(check.assessment==='NOT_APPLICABLE')na.push({contextId:row.contextId,classId:check.classId,evidence:check.evidence,anchors:check.anchors});
    if(check.candidate)candidates.push({...check.candidate,contextIds:[row.contextId],classId:check.classId});
   }
   checks.set(row.contextId,classMap);
  }
 }
 const items=[],contradictions=[];
 const add=(origin,contextIds,anchor,reviewerFinding,attackerFinding)=>{
  const first=contextFor(inventory,contextIds?.[0]);
  items.push({recordKey:'DISC-'+String(items.length+1).padStart(4,'0'),origin,contextIds:[...new Set(contextIds??[])].sort(),
   sourceAnchor:anchor??contextAnchor(first),
   reviewerFinding:String(reviewerFinding??'NO_SUBMISSION').slice(0,600),
   attackerFinding:String(attackerFinding??'NO_SUBMISSION').slice(0,600)});
 };
 for(const candidate of candidates)add('REVIEWER_CANDIDATE',arr(candidate?.contextIds),candidate?.anchors?.[0]??candidate?.sourceAnchor,
  candidate?.description??candidate?.title,'NO_SUBMISSION');
 for(const [id,found] of [...checks.entries()].sort(([a],[b])=>sort(a,b)))
  for(const [classId,status] of Object.entries(found).sort(([a],[b])=>sort(a,b)))if(status==='UNRESOLVED')
   add('REVIEWER_UNRESOLVED',[id],null,'Unresolved '+classId,'NO_SUBMISSION');
 const relevant=paths.filter(p=>['VIABLE','UNCERTAIN'].includes(p?.result));
 for(const attack of relevant)add('ATTACK_FINDING',arr(attack.contextIds),attack?.anchors?.[0],'NO_SUBMISSION',attack?.candidate?.description??attack?.goal);
 for(const attack of relevant){
  const classId=attack?.candidate?.classId??attack?.classId;
  for(const anchor of arr(attack?.anchors)){
   const where=arr(inventory?.payload?.contexts).filter(c=>{
    const parsed=parseAnchorV1(anchor,inventory);
    return parsed&&c.path===parsed.path&&parsed.lineStart<=c.lineEnd&&parsed.lineEnd>=c.lineStart;
   });
   for(const c of where)if(checks.get(c.contextId)?.[classId]==='SUPPORTED'){
    contradictions.push({contextId:c.contextId,classId});
    add('ATTACK_CONTRADICTS_REVIEW',[c.contextId],anchor,'SUPPORTED '+classId,attack?.candidate?.description??attack?.goal);
   }
  }
 }
 for(const answer of answers.filter(a=>['CONCERN','UNRESOLVED'].includes(a?.assessment)))
  add('INTEGRATION_CONCERN',arr(answer.contextIds),answer?.anchors?.[0],'NO_SUBMISSION',answer?.reasoning);
 const gaps=structuredClone(arr(normalizeAccepted(state)?.gaps));
 for(const gap of gaps)add('COVERAGE_GAP',gap.contextId?[gap.contextId]:arr(gap.contextIds),null,'Gap '+gap.code,'NO_SUBMISSION');
 const discoveryState={reviewChecks:Object.fromEntries([...checks.entries()]),gaps,attackContradictions:contradictions};
 const coverage=buildCoverageMatrixV1({inventory,taxonomy,discoveryState});
 return head(state,now??state.generatedAt,'curveyield-discovery-summary-v1',{
  reconciliationItems:items,notApplicableClaims:na.sort((a,b)=>sort(a.contextId,b.contextId)||sort(a.classId,b.classId)),
  attackPaths:paths,perContext:Object.fromEntries([...checks.entries()].sort(([a],[b])=>sort(a,b))),
  gaps,coverage});
}
export function completeDiscoveryV1({root,campaignPath,directory,authorityRoot,automationRoot,state,now}){
 state??=known(root,stateRel(campaignPath));
 state.payload.status='COMPLETE';state.payload.activeUnitId=null;
 writeJson(repoFile(root,stateRel(campaignPath)),state);
 const inputs=getInputs({root,campaignPath,automationRoot});
 const inventory=inputs.inventory??head(directory,now,'curveyield-review-inventory-v1',{contexts:[],triggers:{},limitations:[],complete:false});
 const acceptedSubmissions=[];
 for(const id of state.payload.order){
  const row=known(root,pathJoin(campaignPath,id+'/ACCEPTED_SUBMISSION_v1.json'));
  if(row)acceptedSubmissions.push({unitId:id,submission:row});
 }
 const summary=buildDiscoverySummaryV1({state,inventory,plan:inputs.plan,acceptedSubmissions,taxonomy:inputs.taxonomy,now});
 writeJson(repoFile(root,pathJoin(campaignPath,'DISCOVERY_SUMMARY_v1.json')),summary);
 const stub=stubObligations(directory,now);
 writeJson(repoFile(root,path.posix.join(campaignPath,'work/phase-06/BASELINE_OBLIGATIONS_v1.json')),stub);
 const message='CONTROLLER: Phase 4 discovery is complete. Phase 4 is now ACTIVE for reviewer-2. Follow phases/phase-4/START_HERE.md of the bound authority: Step 1 reconciles every record prefilled from work/phase-04/discovery/DISCOVERY_SUMMARY_v1.json, then complete Steps 2 and 3 and invoke controller validation as usual.';
 return {status:'DISCOVERY_COMPLETE',feedbackText:message,wake:{chatKey:'reviewer-2',
  wakeId:directory.campaignId+'-discovery-complete',phaseId:'phase-4',
  milestoneId:'PHASE_4_WORK_PACKET',messageB64:Buffer.from(message).toString('base64')},summary};
}
export function advanceDiscoveryV1({root,campaignPath,directory,authorityRoot,automationRoot,unitId,now,auditControllerRef='main'}){
 const state=known(root,stateRel(campaignPath));
 if(!state)throw new Error('discovery state missing');
 const active=state.payload.activeUnitId;
 if(unitId!==active)return {status:'DISCOVERY_STALE_REQUEST',
  feedbackText:'Unit '+unitId+' is not active; active is '+active+'. No action taken.',wake:null};
 const info=state.payload.units[unitId],relative=submissionRel(campaignPath,unitId),file=repoFile(root,relative);
 if(!fs.existsSync(file))return {status:'DISCOVERY_REWORK',
  feedbackText:'Submission file not found at '+relative+'. Write it, then push the boundary request again.',wake:null};
 const bytes=fs.readFileSync(file),sha=hex(bytes);
 if(sha===info.lastValidatedSubmissionSha)return {status:'DISCOVERY_REWORK',
  feedbackText:feedbackTextV1({errors:info.lastErrors},{attempt:info.attempts,maxAttempts:3,submissionPath:relative,unitId}),wake:null};
 const packet=known(root,packetRel(campaignPath,unitId)),inventory=getInputs({root,campaignPath,automationRoot}).inventory;
 let result;
 try {
  const submission=JSON.parse(bytes.toString('utf8'));
  result=info.role==='ATTACK'?validateAttackSubmissionV1({packet:packet.payload,submission,inventory}):
    validateFlowReviewSubmissionV1({packet:packet.payload,submission,inventory});
 }catch(error){result={ok:false,errors:[{code:'SUBMISSION_SCHEMA',path:'$',message:String(error.message).slice(0,1000)}],value:null};}
 info.lastValidatedSubmissionSha=sha;info.lastErrors=result.errors;
 if(result.ok){
  fs.mkdirSync(path.dirname(repoFile(root,pathJoin(campaignPath,unitId+'/ACCEPTED_SUBMISSION_v1.json'))),{recursive:true});
  fs.writeFileSync(repoFile(root,pathJoin(campaignPath,unitId+'/ACCEPTED_SUBMISSION_v1.json')),bytes);
  info.status='ACCEPTED';info.acceptedSubmissionSha=sha;
 } else {
  info.attempts++;
  if(info.attempts<3){
   writeJson(repoFile(root,stateRel(campaignPath)),state);
   const feedback=feedbackTextV1(result,{attempt:info.attempts,maxAttempts:3,submissionPath:relative,unitId});
   return {status:'DISCOVERY_REWORK',feedbackText:feedback,
    wake:wakeFor({directory,unitId,state,packet,campaignPath,auditControllerRef,feedbackText:feedback})};
  }
  info.status='GAP_RECORDED';
  const affected=info.role==='ATTACK'?arr(packet.payload.flowIds):arr(packet.payload.primaryContextIds);
  for(const id of affected)state.payload.gaps.push({code:'VALIDATION_ATTEMPTS_EXHAUSTED',
   ...(info.role==='ATTACK'?{flowId:id}:{contextId:id}),unitId});
 }
 const index=state.payload.order.indexOf(unitId);
 const next=state.payload.order[index+1];
 if(next){
  state.payload.activeUnitId=next;state.payload.units[next].status='ACTIVE';
  const following=buildUnitPacketV1({root,campaignPath,directory,authorityRoot,automationRoot,unitId:next,state,now});
  writeJson(repoFile(root,stateRel(campaignPath)),state);
  return {status:'DISCOVERY_NEXT',feedbackText:result.ok?'Accepted '+unitId:'Validation attempts exhausted for '+unitId,
   wake:wakeFor({directory,unitId:next,state,packet:following,campaignPath,auditControllerRef})};
 }
 return completeDiscoveryV1({root,campaignPath,directory,authorityRoot,automationRoot,state,now});
}
