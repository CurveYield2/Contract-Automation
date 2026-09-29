import fs from 'node:fs';
import path from 'node:path';
import { runProcess } from './execution.mjs';

function md(value){
  if(value===null||value===undefined||value==='') return '—';
  const s=typeof value==='string'?value:JSON.stringify(value);
  return s.replace(/\|/g,'\\|').replace(/\r?\n/g,' ');
}
function arr(v){return Array.isArray(v)?v:[];}
function safePart(v){return String(v??'target').replace(/[^A-Za-z0-9._-]+/g,'_').slice(0,120)||'target';}
function safeRel(v){
  if(typeof v!=='string'||!v||v.startsWith('/')||v.includes('\\')||v.split('/').some(p=>!p||p==='.'||p==='..')) return null;
  return v;
}
function stableJson(value){
  if(Array.isArray(value)) return '['+value.map(stableJson).join(',')+']';
  if(value&&typeof value==='object'){
    return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stableJson(value[k])).join(',')+'}';
  }
  return JSON.stringify(value);
}

export function validateTargetExecutionRequestBindingV1({controllerRoot,campaignPath,target,expectedCampaignId=null,expectedSourceSha256=null}={}){
  const key=String(target?.candidateKey??'').trim();
  const method=String(target?.executionMethod??'').toUpperCase();
  if(method==='NOT_APPLICABLE'){
    const ok=String(target?.reproductionType??'').toUpperCase()==='NOT_APPLICABLE';
    return {
      status:ok?'NOT_APPLICABLE':'FAIL_TARGET_NOT_APPLICABLE_MISMATCH',
      requestRef:'NOT_APPLICABLE',
      reasons:ok?[]:['executionMethod NOT_APPLICABLE requires reproductionType NOT_APPLICABLE']
    };
  }
  const rel=safeRel(target?.executionRequestRef);
  if(!rel) return {status:'FAIL_INVALID_EXECUTION_REQUEST_REF',requestRef:null,reasons:['executionRequestRef is missing or unsafe']};
  const requestAbs=path.join(controllerRoot,...campaignPath.split('/'),...rel.split('/'));
  if(!fs.existsSync(requestAbs)) return {status:'FAIL_MISSING_EXECUTION_REQUEST',requestRef:rel,reasons:['execution request file does not exist']};
  let request;
  try{request=JSON.parse(fs.readFileSync(requestAbs,'utf8'));}catch(error){
    return {status:'FAIL_INVALID_EXECUTION_REQUEST_JSON',requestRef:rel,reasons:[String(error?.message??error)]};
  }
  const reasons=[];
  if(expectedCampaignId&&request.campaignId!==expectedCampaignId) reasons.push('campaignId mismatch');
  if(expectedSourceSha256){
    if(!request?.source?.archiveSha256) reasons.push('request source.archiveSha256 missing');
    else if(request.source.archiveSha256!==expectedSourceSha256) reasons.push('source archive SHA-256 mismatch');
  }
  const reproduction=request?.configuration?.v26?.reproduction;
  if(!reproduction) reasons.push('configuration.v26.reproduction missing');
  else{
    if(reproduction.candidateId!==key) reasons.push('reproduction candidateId mismatch');
    if(String(reproduction.reproductionType??'')!==String(target?.reproductionType??'')) reasons.push('reproductionType mismatch');
    if(stableJson(reproduction.expectedObservation)!==stableJson(target?.expectedMachineObservation)) reasons.push('expected machine observation mismatch');
    const type=String(reproduction.reproductionType??'');
    if(['FOUNDRY_TEST','MEDUSA_PROPERTY'].includes(type)&&request.phaseId!=='build-and-test') reasons.push('Foundry/Medusa reproduction must use build-and-test');
    if(type==='ANVIL_WORKFLOW'&&request.phaseId!=='fork-simulation-lifecycle') reasons.push('Anvil reproduction must use fork-simulation-lifecycle');
  }
  const harness=request?.configuration?.harness;
  return {
    status:reasons.length?'FAIL_STRUCTURAL_REQUEST_TARGET_BINDING':'PASS_STRUCTURAL_BINDING_REQUIRES_PHASE6_SEMANTIC_HARNESS_REVIEW',
    requestRef:rel,
    reasons,
    candidateId:reproduction?.candidateId??null,
    reproductionType:reproduction?.reproductionType??null,
    harnessBundleId:harness?.bundleId??null,
    harnessRecipeId:harness?.recipeId??null
  };
}
function statusText(r){
  if(!r) return 'BLOCKED_NO_MACHINE_RESULT';
  if(r.status) return String(r.status);
  if(r.rawResult?.reproduction?.status) return String(r.rawResult.reproduction.status);
  if(r.rawResult?.disposition) return String(r.rawResult.disposition);
  return 'COMPLETED_UNCLASSIFIED';
}
function deterministicSummary(r){
  const x=r?.rawResult??{};
  if(x.reproduction) return x.reproduction.status??'REPRODUCTION_RECORDED';
  if(x.simulation?.steps) return `${x.simulation.steps.length} simulation step(s)`;
  if(x.status) return x.status;
  return r?.status??'NO_DETERMINISTIC_RESULT';
}
function fuzzSummary(r){
  const x=r?.rawResult??{};
  const native=x.analysis?.nativeFuzz;
  if(native) return native.componentStatus??native.status??'RECORDED';
  const medusa=x.analysis?.medusa;
  if(medusa) return medusa.componentStatus??medusa.status??'RECORDED';
  return 'NOT_EXECUTED_OR_NOT_APPLICABLE';
}

export function renderDeployConfigMatrixV1({readiness={},execution={}}={}){
  const dep=readiness.deploymentAndConfiguration??{};
  const attempts=arr(execution.attempts);
  const rows=[];
  let order=1;
  for(const a of attempts){
    rows.push(`| ${order++} | ${md(a.script??a.action??'source-known setup')} | ${md(a.constructorOrInitializer??'SOURCE_DEFINED')} | ${md(a.dependenciesOrAddresses??'SEE_SOURCE_SETUP')} | ${md(a.rolesOrGovernance??'SEE_SOURCE_SETUP')} | ${md(a.approvalsOrConfiguration??'SEE_SOURCE_SETUP')} | ${md(a.postStateAssertion??a.resultSummary??'SEE_MACHINE_EVIDENCE')} | ${md(a.evidenceRef)} | ${md(a.status??(a.exitCode===0?'PASS':'BLOCKED'))} |`);
  }
  if(!rows.length){
    for(const file of arr(dep.deploymentFiles)){
      rows.push(`| ${order++} | Source-known deployment/configuration surface: ${md(file)} | SOURCE_DEFINED | SEE_SOURCE | SEE_SOURCE | SEE_SOURCE | No admitted deterministic local execution path was machine-resolvable | evidence/readiness/PROJECT_READINESS_AUTOMATED_v1.json | BLOCKED_NO_ADMITTED_LOCAL_EXECUTION |`);
    }
  }
  if(!rows.length) rows.push('| 1 | No source-known deployment/configuration action discovered | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE | No deployment/configuration surface discovered by Phase-0 automation | evidence/readiness/PROJECT_READINESS_AUTOMATED_v1.json | NOT_APPLICABLE |');

  const usability=attempts.length
    ? attempts.map((a,i)=>`| P0-U-${String(i+1).padStart(3,'0')} | ${md(a.usabilityCheck??a.script??'source-known local setup')} | clean Phase-0 machine environment | ${md(a.script??a.action)} | exit 0 / source-defined assertions pass | ${md(a.resultSummary??`exit ${a.exitCode??'unknown'}`)} | ${md(a.evidenceRef)} | ${md(a.status??(a.exitCode===0?'PASS':'BLOCKED'))} |`).join('\n')
    :'| P0-U-001 | Source-known local deployment/configuration usability | clean Phase-0 machine environment | No admitted deterministic local command discovered | Machine-executable setup present | No executable setup available | evidence/readiness/PROJECT_READINESS_AUTOMATED_v1.json | BLOCKED |';

  const gaps=[];
  for(const f of arr(execution.gaps)) gaps.push(`| ${md(f.id??`P0-GAP-${gaps.length+1}`)} | ${md(f.value??f.reason)} | ${md(f.recoveryAttempt??'AUTOMATED_DISCOVERY_COMPLETE')} | ${md(f.securityEffect??'REQUIRES_PHASE6_INTERPRETATION')} | ${md(f.candidateOrObligation??'PENDING_PHASE6_INTERPRETATION')} | ${md(f.disposition??'BLOCKED')} |`);
  if(!gaps.length && attempts.some(a=>(a.status??'')!=='PASS')) gaps.push('| P0-GAP-001 | One or more source-known setup attempts did not pass | Phase-0 automation attempted every admitted local setup command | REQUIRES_PHASE6_INTERPRETATION | PENDING_PHASE6_INTERPRETATION | BLOCKED |');
  if(!gaps.length) gaps.push('| NONE | NONE_IDENTIFIED | NOT_APPLICABLE | NONE_IDENTIFIED | NONE_IDENTIFIED | PASS |');

  return `# Lite Deployment and Configuration Matrix

> **CONTROLLER-POPULATED:** Generated from Phase-0 boundary machine execution. The Phase-6 reviewer consumes this evidence and records only semantic security interpretation in the Phase-6 work form. Do not duplicate campaign or controller metadata here.

## Required sequence

| Order | Component/action | Constructor or initializer | Dependencies/addresses | Roles/ownership/governance | Approvals/configuration | Post-state assertion | Evidence | Status |
|---:|---|---|---|---|---|---|---|---|
${rows.join('\n')}

## Usability checks

| Check ID | Required normal operation | Starting state | Transaction sequence | Expected result | Actual result | Evidence | Status |
|---|---|---|---|---|---|---|---|
${usability}

## Configuration gaps and limitations

| Gap ID | Missing/uncertain value | Recovery attempted | Security effect | Related candidate / security question | Disposition |
|---|---|---|---|---|---|
${gaps.join('\n')}

Completion requires every material deploy/config action to be present or explicitly blocked with evidence.
`;
}

export function renderTargetedTestMatrixV1({targetDesigns=[],executionResults={}}={}){
  const rows=[];
  for(const [i,t] of arr(targetDesigns).entries()){
    if(!t||typeof t!=='object') continue;
    const key=t.candidateKey??`TARGET-${i+1}`;
    const r=executionResults[key]??null;
    rows.push(`| ${md(key)} | ${md([key,t.expectedSecurityProperty].filter(Boolean).join(' — '))} | ${md([t.setup,t.prerequisites].filter(Boolean).join(' / '))} | ${md(t.transactionSequence)} | ${md(t.expectedSecurityProperty)} | ${md(t.oracle)} | ${md(r?.requestBindingStatus??t.requestBindingStatus??'UNVERIFIED')} | ${md(deterministicSummary(r))} | ${md(t.fuzzVariablesAndBounds)} | ${md(`deterministic=${deterministicSummary(r)}; targetedFuzz=${fuzzSummary(r)}; status=${statusText(r)}`)} | ${md(r?.evidenceRef??'NO_MACHINE_EVIDENCE')} |`);
  }
  if(!rows.length) rows.push('| NO_TARGET | NO_CANDIDATE | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE | NO_CANDIDATE | NO_MACHINE_EVIDENCE |');
  return `# Lite Candidate Target Matrix

> **CONTROLLER-POPULATED:** Seeded from accepted Phase-2–5 canonical data and finalized from Phase-5 boundary machine execution. The Phase-6 reviewer consumes the completed matrix and records only semantic interpretation/disposition in the Phase-6 work form. Do not duplicate campaign identity or controller bookkeeping here.

| Target ID | Candidate / property / hypothesis | Exact setup and attacker/actor | AI-guided attacker/exploit sequence | Expected secure outcome | Exploit/failure oracle | Request/target structural binding | Attacker/exploit simulation result | AI-guided targeted fuzz variables/bounds | Result | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|
${rows.join('\n')}

Rules:

- Include every material candidate and every due retained execution obligation from accepted Phase-2–5 canonical data.
- AI-guided targeted fuzzing varies only reviewer-selected candidate-relevant inputs and boundaries.
- A target cannot be closed merely because one happy-path case passed.
`;
}

export async function executePhase5TargetsV1({controllerRoot,campaignPath,targetDesigns=[],expectedCampaignId=null,expectedSourceSha256=null}={}){
  const campaignRoot=path.join(controllerRoot,...campaignPath.split('/'));
  const executionResults={};
  for(const t of arr(targetDesigns)){
    const key=String(t?.candidateKey??'').trim();
    if(!key) continue;
    const method=String(t.executionMethod??'').toUpperCase();
    if(method==='NOT_APPLICABLE'){
      executionResults[key]={status:'NOT_APPLICABLE',evidenceRef:'NO_MACHINE_EVIDENCE_REQUIRED'};
      continue;
    }
    if(method!=='V7_REQUEST'){
      executionResults[key]={status:'BLOCKED_UNSUPPORTED_EXECUTION_METHOD',evidenceRef:'NO_MACHINE_EVIDENCE'};
      continue;
    }
    const binding=validateTargetExecutionRequestBindingV1({
      controllerRoot,campaignPath,target:t,expectedCampaignId,expectedSourceSha256
    });
    if(!String(binding.status).startsWith('PASS_')){
      executionResults[key]={
        status:'BLOCKED_REQUEST_TARGET_BINDING_MISMATCH',
        requestBindingStatus:binding.status,
        requestBindingReasons:binding.reasons,
        requestBindingEvidenceRef:binding.requestRef??'NO_REQUEST',
        evidenceRef:binding.requestRef??'NO_MACHINE_EVIDENCE'
      };
      continue;
    }
    const rel=binding.requestRef;
    const requestAbs=path.join(campaignRoot,...rel.split('/'));
    const evRel=path.posix.join(campaignPath,'evidence/phase5-boundary',safePart(key));
    const evAbs=path.join(controllerRoot,...evRel.split('/'));
    const workspace=path.join(process.cwd(),'.audit-work','phase5-boundary',safePart(key));
    const result=await runProcess({
      command:process.execPath,
      args:['packages/github-native-sim/src/v7-cli.mjs','execute','--request',requestAbs,'--evidence-dir',evAbs,'--workspace',workspace],
      cwd:process.cwd(),
      env:process.env
    });
    const rawPath=path.join(evAbs,'raw-result.json');
    let rawResult=null;
    try{rawResult=JSON.parse(fs.readFileSync(rawPath,'utf8'));}catch{}
    executionResults[key]={
      status:result.exitCode===0?'PASS':(rawResult?.blocking?'BLOCKED':'INCONCLUSIVE'),
      exitCode:result.exitCode,
      evidenceRef:path.posix.join(evRel,'raw-result.json'),
      requestBindingStatus:binding.status,
      requestBindingEvidenceRef:binding.requestRef,
      requestBindingReasons:binding.reasons,
      rawResult,
      stdout:String(result.stdout??'').slice(-12000),
      stderr:String(result.stderr??'').slice(-12000)
    };
  }
  return executionResults;
}

export function renderRemediationDeltaLedgerV1({validatedFindings=[],deltaRows=[],noRemediation=false}={}){
  const rows=[];
  for(const d of arr(deltaRows)){
    rows.push(`| ${md(d.findingId)} | ${md(d.oldIdentityRef)} | ${md(d.remediationIdentityRef)} | ${md(d.changedFilesAndSymbols)} | ${md(d.rootCauseFix??'PENDING_PHASE9_INTERPRETATION')} | ${md(d.staleEvidenceInvalidated)} | ${md(d.decisiveProofRerun??'PENDING_PHASE9')} | ${md(d.affectedSurfaces)} | ${md(d.newEvidenceRefs)} | ${md(d.residualRisk??'PENDING_PHASE9_INTERPRETATION')} | ${md(d.finalDisposition??'PENDING_PHASE9_INTERPRETATION')} |`);
  }
  if(!rows.length&&!noRemediation){
    for(const f of arr(validatedFindings)){
      rows.push(`| ${md(f.findingTempKey??f.canonicalId??f.candidateKey)} | SEE_CANONICAL_PRE_REMEDIATION_IDENTITY | REMEDIATION_ARTIFACT_PRESENT_DELTA_UNRESOLVED | MACHINE_DELTA_UNAVAILABLE | PENDING_PHASE9_INTERPRETATION | INSUFFICIENT_EVIDENCE | PENDING_PHASE9 | UNRESOLVED | NO_NEW_EVIDENCE | UNRESOLVED | UNRESOLVED |`);
    }
  }
  if(!rows.length) rows.push('| NONE | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE |');

  return `# Phase 9 Remediation Delta Ledger

> **CONTROLLER-POPULATED:** Generated at the Phase-8 boundary when remediation artifacts exist, using exact machine-derived pre/post-remediation comparison and accepted Phase-8 findings. The Phase-9 reviewer consumes this ledger and records semantic remediation assessment in the Phase-9 work form.

| Finding ID | Old identity | Remediation identity | Changed files/symbols | Root-cause fix | Stale evidence invalidated | Decisive proof rerun | Directly affected surfaces reviewed | New evidence identities | Residual risk | Final disposition |
|---|---|---|---|---|---|---|---|---|---|---|
${rows.join('\n')}

## No-remediation path
- \`SKIPPED_NO_REMEDIATION\`: ${noRemediation?'YES':'NO'}
- Evidence-bound reason: ${noRemediation?'No remediation artifacts exist in canonical campaign state.':'Remediation artifacts detected; see rows above.'}
- Findings still open and their dispositions: ${noRemediation?md(arr(validatedFindings).map(f=>f.findingTempKey??f.canonicalId??f.candidateKey)):'SEE_PHASE8_ACCEPTED_FINDINGS'}

## Release-delta reconciliation
- Unrelated changes detected: PENDING_MACHINE_DELTA_OR_NONE
- Source-bound evidence requiring broader invalidation/re-execution: SEE_CONTROLLER_EVIDENCE_INVALIDATION_STATE
- New candidate issues introduced by remediation: PENDING_PHASE9_INTERPRETATION
`;
}

export function renderFinalEvidenceIndexV1({identity={},milestones=[],findings=[],obligations=[],limitations=[],omissions=[]}={}){
  const milestoneRows=arr(milestones).map(m=>`| ${md(m.milestone)} | ${md(m.requiredEvidence)} | ${md(m.reference)} | ${md(m.sourceIdentity)} | ${md(m.status)} | ${md(m.limitation)} |`);
  const findingRows=[
    ...arr(findings).map(f=>`| ${md(f.id)} | ${md(f.disposition)} | ${md(f.severityOrStatus)} | ${md(f.evidence)} | ${md(f.remediationStatus)} | ${md(f.residualLimitation)} |`),
    ...arr(obligations).map(o=>`| ${md(o.id)} | ${md(o.disposition)} | ${md(o.severityOrStatus)} | ${md(o.evidence)} | ${md(o.remediationStatus)} | ${md(o.residualLimitation)} |`)
  ];
  if(!milestoneRows.length) milestoneRows.push('| NONE | NONE_IDENTIFIED | NONE_IDENTIFIED | NONE_IDENTIFIED | UNRESOLVED | NONE_IDENTIFIED |');
  if(!findingRows.length) findingRows.push('| NONE | NONE_IDENTIFIED | NONE_IDENTIFIED | NONE_IDENTIFIED | NOT_APPLICABLE | NONE_IDENTIFIED |');
  const limitationText=arr(limitations).length?arr(limitations).map(x=>`- ${md(x)}`).join('\n'):'- NONE_IDENTIFIED';
  const omissionText=arr(omissions).length?arr(omissions).map(x=>`- ${md(x)}`).join('\n'):'- NONE_IDENTIFIED';

  return `# Lite Final Evidence Index

> **CONTROLLER-GENERATED FINAL SUMMARY:** This file is the intentional summary exception to the no-duplication rule. The controller populates it from canonical campaign state, accepted phase data and machine evidence before Phase 10 begins. The Phase-10 reviewer consumes it as the final evidence/navigation view and does not repeat predecessor bookkeeping.

## Exact identities

- Campaign/generation: ${md(identity.campaignGeneration)}
- Lite skill ZIP identity/digest: ${md(identity.skill)}
- Source ZIP/repository/commit/digest: ${md(identity.source)}
- Dependency lock/toolchain/build artifact identity: ${md(identity.build)}
- Deployment/configuration simulation identity: ${md(identity.deployment)}
- Remediation identity or \`SKIPPED_NO_REMEDIATION\`: ${md(identity.remediation??'SKIPPED_NO_REMEDIATION')}

## Milestone evidence

| Milestone | Required evidence | Exact reference/digest | Source identity | Status | Limitation |
|---|---|---|---|---|---|
${milestoneRows.join('\n')}

## Findings and obligations

| ID | Final disposition | Severity/status | Decisive evidence | Remediation status | Residual limitation |
|---|---|---|---|---|---|
${findingRows.join('\n')}

## Carried limitations and unresolved questions

${limitationText}

## Full-only omitted work

${omissionText}

Omission is never evidence of safety.
`;
}
