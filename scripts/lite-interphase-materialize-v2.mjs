import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const [rootArg, packetArg, stateArg, pointerArg] = process.argv.slice(2);
if (!rootArg || !packetArg || !stateArg || !pointerArg) throw Error('Usage: node lite-interphase-materialize-v2.mjs ROOT PACKET STATE POINTER');
const root = path.resolve(rootArg);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const fail = message => { throw Error(message); };
const safe = rel => {
  if (typeof rel !== 'string' || !rel || path.isAbsolute(rel) || rel.includes('\\') ||
      rel.split('/').some(x => !x || x === '.' || x === '..')) fail('Unsafe repository path: ' + rel);
  const absolute = path.resolve(root, rel);
  if (!absolute.startsWith(root + path.sep)) fail('Repository path escapes checkout: ' + rel);
  return absolute;
};
const bytes = rel => fs.readFileSync(safe(rel));
const json = rel => JSON.parse(bytes(rel).toString('utf8'));
const equal = (a,b,label) => { if (a !== b) fail(label + ' mismatch: ' + a + ' != ' + b); };
const shaFile = rel => hash(bytes(rel));
const campaignPath = packetArg.slice(0, packetArg.indexOf('/handoffs/'));
if (!campaignPath.startsWith('campaigns/') || !packetArg.includes('/handoffs/')) fail('Packet is outside a campaign handoff');
const campaignRel = rel => rel.startsWith('campaigns/') ? rel : campaignPath + '/' + rel;
const within = rel => { if (!rel.startsWith(campaignPath + '/')) fail('Cross-campaign reference: ' + rel); return rel; };
const verify = (rel, digest, label) => {
  within(rel);
  if (digest) equal(shaFile(rel), digest.replace(/^sha256:/,''), label);
  else bytes(rel);
  return {path:rel,sha256:shaFile(rel),role:label};
};
const packetBytes = bytes(packetArg);
const packet = JSON.parse(packetBytes.toString('utf8'));
const state = json(stateArg), pointer = json(pointerArg);
const handoff = json(packet.handoffPath);
const handoffDir = path.posix.dirname(packet.handoffPath);
const milestone = handoff.milestone?.id;
equal(packet.schemaVersion,'curveyield-lite-interphase-work-packet-v2','packet schema');
equal(packet.taskClass,'MECHANICAL_ONLY','packet class');
equal(packet.campaignId,state.campaignId,'packet campaign');
equal(packet.campaignId,handoff.campaign?.campaignId,'handoff campaign');
equal(packet.completedMilestoneId,milestone,'packet milestone');
equal(handoff.campaign?.campaignGenerationId,state.campaignGenerationId,'generation');
equal(handoff.campaign?.workspacePath,campaignPath,'workspace');
equal(handoff.campaign?.campaignType,'LITE','handoff mode');
equal(handoff.boundaryProfileId,'P0_TO_P1','boundary');
equal(state.phase?.id,'phase-1','phase');
equal(state.phase?.state,'WAITING_FOR_SUCCESSOR_AGENT','phase state');
equal(state.history?.at(-1)?.phase,0,'sealed phase');
equal(state.history?.at(-1)?.status,'SEALED','sealed status');
equal(state.phase0Retirement?.status,'PASS','retirement');
equal(state.successorHandoff?.validationStatus,'PASS','handoff validation');
equal(pointer.campaignId,state.campaignId,'pointer campaign');
equal(pointer.campaignGenerationId,state.campaignGenerationId,'pointer generation');
equal(pointer.sourceArchiveSha256,state.source?.sha256,'pointer source');
equal(pointer.status,'WAITING_FOR_SUCCESSOR_AGENT','pointer status');
for (const key of ['phase0CompletionValidationStatus','phase0AutomationValidationStatus','phase0RetirementGateStatus','successorHandoffValidationStatus']) equal(pointer[key],'PASS',key);
equal(state.successorHandoff?.handoffReference,packet.handoffPath,'state handoff path');
equal(state.successorHandoff?.handoffDigest,handoff.integrity?.digest,'handoff payload digest');
equal(handoff.source?.sourceIdentityDigest,state.source?.sha256,'source digest');
equal(handoff.authority?.liteSkillRepositoryPath,state.assuranceMode?.authority,'skill authority');
equal(packet.handoffPath,handoffDir + '/SUCCESSOR_HANDOFF.json','handoff file');
equal(shaFile(packet.handoffPath),state.history.at(-1).handoffSha256,'handoff bytes');
if (!Array.isArray(packet.workUnits) || packet.workUnits.length !== 10 ||
    !Array.isArray(packet.requiredOutputs) || packet.requiredOutputs.length !== 11) fail('Expected ten work units and final reconciliation');
const expectedIds = [
  'bootstrap-artifact-inventory','source-identity-reconciliation','skill-identity-reconciliation',
  'source-intelligence-index','automation-completion-index','bootstrap-digest-table',
  'global-control-reference-index','due-obligation-index','handoff-link-audit','phase1-input-manifest'
];
equal(JSON.stringify(packet.workUnits.map(x=>x.id)),JSON.stringify(expectedIds),'P0 work units');
const outputPaths = packet.workUnits.map(x=>x.outputPath);
outputPaths.push(packet.reconciliationOutputPath);
equal(JSON.stringify(packet.requiredOutputs.map(x=>x.path)),JSON.stringify(outputPaths),'required outputs');
if (new Set(outputPaths).size !== 11 || new Set(expectedIds).size !== 10) fail('Duplicate mechanical outputs');
for (const rel of outputPaths) {
  safe(rel);
  if (!rel.startsWith(handoffDir + '/MECHANICAL/') || !rel.endsWith('_v2.json')) fail('Unexpected output path: ' + rel);
}
const records = new Map();
const add = (rel,digest,role) => {
  rel = within(campaignRel(rel));
  const record = verify(rel,digest,role);
  const prev = records.get(rel);
  if (prev && prev.sha256 !== record.sha256) fail('Inconsistent digest for ' + rel);
  records.set(rel,record);
  return record;
};
const history = state.history.at(-1);
add(state.source.archivePath,state.source.sha256,'exact source archive');
add(packet.handoffPath,history.handoffSha256,'sealed successor handoff');
add(handoff.milestone.reportReference,handoff.milestone.reportDigest,'sealed Phase 0 report');
add(handoffDir + '/START_HERE_SUCCESSOR.md',null,'successor Start Here');
add(handoffDir + '/WAKE_UP_MESSAGE.md',history.wakeMessageSha256,'predecessor wake message');
const reportPath = campaignPath + '/controller/PHASE0_COMPLETION_REPORT_v1.json';
const phaseReport = json(reportPath);
equal(phaseReport.campaignGenerationId,state.campaignGenerationId,'completion report generation');
equal(phaseReport.sourceIdentityDigest,state.source.sha256,'completion report source');
equal(phaseReport.resultStatus,'SEALED','completion report status');
add(reportPath,null,'Phase 0 completion companion');
for (const entry of phaseReport.outputs ?? []) {
  if (!entry.reference || !entry.digest) fail('Unbound completion output');
  add(entry.reference,entry.digest,'Phase 0 companion output');
}
const automationPath = campaignPath + '/controller/PHASE0_AUTOMATION_COMPLETION_REPORT_v1.json';
const automation = json(automationPath);
equal(automation.campaignGenerationId,state.campaignGenerationId,'automation generation');
equal(automation.sourceIdentityDigest,state.source.sha256,'automation source');
equal(automation.qualification?.status,'PASS','qualification');
const actualRuns = new Set((automation.executions ?? []).filter(x=>x.status==='COMPLETED').map(x=>x.executionId));
for (const id of automation.requiredExecutionIds ?? []) if (!actualRuns.has(id)) fail('Incomplete required execution ' + id);
add(automationPath,null,'automation completion report');
const validationPaths = [history.completionValidationPath,history.automationValidationPath,history.retirementGatePath,history.handoffValidationPath];
for (const rel of validationPaths) add(rel,null,'accepted controller validation');
const qualification = json(history.automationValidationPath);
equal(qualification.status,'PASS','automation validation');
equal(qualification.validationDigest,history.automationValidationDigest,'automation validation digest');
equal(qualification.qualification?.qualifiedCommit,automation.qualification.qualifiedCommit,'qualified commit');
const globalControls = Object.entries(handoff.globalControls ?? {}).filter(([,v])=>v !== null);
const globals = globalControls.map(([name,v]) => {
  if (!v || typeof v.reference !== 'string' || !/^[0-9a-f]{64}$/.test(v.sha256)) fail('Malformed global control ' + name);
  return {name,...add(v.reference,v.sha256,'global control ' + name)};
});
const si = state.sourceIntelligence;
equal(si?.status,'ACCEPTED_PHASE0_SEALED','Source Intelligence status');
const siEntries = ['bundle','core','runtimeDeploymentOverlay','assuranceReadinessOverlay'].map(name=>{
  const obj=si[name], rel=campaignRel(obj?.path ?? '');
  if (!/^[0-9a-f]{64}$/.test(obj?.sha256 ?? '')) fail('Missing Source Intelligence digest ' + name);
  return {name,...add(rel,obj.sha256,'accepted Source Intelligence ' + name),revision:obj.revision};
});
const bundle = json(siEntries[0].path);
equal(bundle.identity?.campaignGenerationId,state.campaignGenerationId,'Source Intelligence bundle generation');
equal(bundle.identity?.sourceDigestSha256,state.source.sha256,'Source Intelligence bundle source');
equal(bundle.completion?.status,'COMPLETE','Source Intelligence bundle completion');
for (const [name,location] of [['core',bundle.core],['runtimeDeploymentOverlay',bundle.overlays?.runtimeDeployment],['assuranceReadinessOverlay',bundle.overlays?.assuranceReadiness]]) {
  const recorded = siEntries.find(x=>x.name===name);
  equal(campaignRel(location?.preservedSnapshotRef ?? ''),recorded.path,'accepted Source Intelligence snapshot');
  equal(location?.acceptedSha256,recorded.sha256,'accepted Source Intelligence sha');
  equal(location?.status,'ACCEPTED','accepted Source Intelligence status');
}
const buildPath = campaignPath + '/evidence/build/BUILD_AND_SOURCE_IDENTITY_v1.json';
const build = json(buildPath);
add(buildPath,null,'filed build identity');
const packagePath = campaignRel(state.skillAuthority?.current?.campaignPath ?? '');
const packageRecord=add(packagePath,state.skillAuthority?.current?.sha256,'campaign bound skill ZIP');
equal(state.skillAuthority.current.liteSkillPath,handoff.authority.liteSkillRepositoryPath.slice('CurveYield2/Contract-Automation/'.length),'Lite skill path');
const ledgerRecord=globals.find(x=>x.name==='carriedForwardObligationLedger');
if (!ledgerRecord) fail('Obligation ledger missing from handoff');
const ledger=json(ledgerRecord.path);
equal(ledger.campaignBinding?.campaignGenerationId,state.campaignGenerationId,'ledger generation');
const due = handoff.dueObligations ?? [];
if (!Array.isArray(due) || new Set(due.map(x=>x.obligationId)).size !== due.length) fail('Duplicate due obligation');
for (const entry of due) {
  const current=(ledger.obligations ?? []).find(x=>x.obligationId===entry.obligationId);
  if (!current) fail('Missing ledger obligation ' + entry.obligationId);
  for (const field of ['requiredPhase','requiredReviewer','status']) equal(entry[field],current[field],'due obligation ' + entry.obligationId + ' ' + field);
}
const sorted = list => [...list].sort((a,b)=>String(a.path??a.name??a.id).localeCompare(String(b.path??b.name??b.id)));
const inventory=sorted([...records.values()]);
const digestTable=inventory.map(x=>({path:x.path,sha256:x.sha256}));
const linkRefs=[
  {name:'successor-handoff',...records.get(packet.handoffPath)},
  {name:'start-here',...records.get(handoffDir+'/START_HERE_SUCCESSOR.md')},
  {name:'wake-up',...records.get(handoffDir+'/WAKE_UP_MESSAGE.md')},
  {name:'milestone-report',...records.get(handoff.milestone.reportReference)}
];
for (const key of ['campaignFolderUrl','campaignLink']) {
  const value=handoff.campaign[key];
  if (!value || !value.startsWith('https://github.com/CurveYield2/Audit-Controller/tree/')) fail('Malformed immutable campaign URL ' + key);
  linkRefs.push({name:key,url:value,format:'GITHUB_CAMPAIGN_TREE_URL'});
}
const unitData = {
  'bootstrap-artifact-inventory':{artifacts:inventory},
  'source-identity-reconciliation':{source:{archive:records.get(state.source.archivePath),sourceCommit:state.source.archiveCommit,gitBlobSha:state.source.archiveGitBlobSha},handoffSource:handoff.source,buildIdentity:build.identity ?? build.buildIdentity ?? build.sourceIdentity ?? build,sourceIntelligenceSourceDigest:bundle.identity.sourceDigestSha256},
  'skill-identity-reconciliation':{authority:state.skillAuthority.current,package:packageRecord,handoffAuthority:handoff.authority},
  'source-intelligence-index':{acceptedArtifacts:siEntries,bundleIdentity:bundle.identity},
  'automation-completion-index':{requiredExecutionIds:automation.requiredExecutionIds,executions:automation.executions,qualification:automation.qualification,validation:qualification,validationReferences:validationPaths.map(p=>records.get(p))},
  'bootstrap-digest-table':{digests:digestTable},
  'global-control-reference-index':{controls:globals},
  'due-obligation-index':{obligations:due,ledgerPath:ledgerRecord.path,ledgerSha256:ledgerRecord.sha256},
  'handoff-link-audit':{references:linkRefs},
  'phase1-input-manifest':{incomingReviewer:handoff.reviewers.incoming,assignment:handoff.assignment.assignedLitePhaseOrMilestone,artifacts:inventory,requiredEvidence:handoff.requiredEvidence,dueObligationIds:due.map(x=>x.obligationId),limitations:handoff.limitations}
};
const staged = [];
for (const unit of packet.workUnits) {
  const payload={schemaVersion:'curveyield-lite-mechanical-unit-v2',campaignId:state.campaignId,campaignGenerationId:state.campaignGenerationId,boundaryProfileId:handoff.boundaryProfileId,unitId:unit.id,handoffDigest:handoff.integrity.digest,verification:'PASS',...unitData[unit.id]};
  const text=JSON.stringify(payload,null,2)+'\n';
  staged.push({id:unit.id,path:unit.outputPath,content:Buffer.from(text),sha256:hash(text)});
}
const reconciliation={schemaVersion:'curveyield-lite-mechanical-reconciliation-v2',campaignId:state.campaignId,campaignGenerationId:state.campaignGenerationId,boundaryProfileId:handoff.boundaryProfileId,handoffDigest:handoff.integrity.digest,sourceSha256:state.source.sha256,workPacketSha256:hash(packetBytes),status:'PASS',workUnits:staged.map(x=>({id:x.id,path:x.path,sha256:x.sha256})),requiredOutputCount:packet.requiredOutputs.length};
const finalText=JSON.stringify(reconciliation,null,2)+'\n';
staged.push({path:packet.reconciliationOutputPath,content:Buffer.from(finalText),sha256:hash(finalText)});
const completionPath=handoffDir+'/MECHANICAL_WORK_COMPLETION_v2.json';
const receipt={schemaVersion:'curveyield-lite-interphase-completion-v2',status:'PASS',campaignId:state.campaignId,completedMilestoneId:milestone,handoffPath:packet.handoffPath,workPacketPath:packetArg,workPacketSha256:hash(packetBytes),workUnitReceipts:staged.slice(0,-1).map(x=>({id:x.id,outputPath:x.path,sha256:x.sha256})),outputs:staged.map(x=>({path:x.path,sha256:x.sha256})),completedAt:new Date().toISOString()};
for (const file of staged) {
  const target=safe(file.path);
  if (fs.existsSync(target) && !fs.readFileSync(target).equals(file.content)) fail('Refusing to overwrite existing mechanical evidence: '+file.path);
}
const receiptFile=safe(completionPath);
if (fs.existsSync(receiptFile)) {
  const existing=json(completionPath);
  const comparable={...existing,completedAt:receipt.completedAt};
  if (JSON.stringify(comparable)!==JSON.stringify(receipt)) fail('Existing completion receipt conflicts with generated outputs');
  console.log(JSON.stringify({status:'ALREADY_COMPLETE',completionPath,outputCount:staged.length}));
  process.exit(0);
}
for (const file of staged) {
  fs.mkdirSync(path.dirname(safe(file.path)),{recursive:true});
  fs.writeFileSync(safe(file.path),file.content,{flag:'wx'});
  equal(shaFile(file.path),file.sha256,'writeback '+file.path);
}
fs.writeFileSync(receiptFile,JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
for (const output of receipt.outputs) equal(shaFile(output.path),output.sha256,'receipt '+output.path);
console.log(JSON.stringify({status:'CREATED',completionPath,outputCount:staged.length,packetSha256:receipt.workPacketSha256}));
