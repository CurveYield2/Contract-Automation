const MODULE_SPEC = [
  ['Development Recovery System',5],['Existing Harness/Simulation/Failure Corpus Inventory',6],['Stable IDs and Core Schemas',8],
  ['Attack Primitive Taxonomy',5],['Source/Reference Registry + Confidence',5],['Incident Deduplication and Relationship Model',5],
  ['Deterministic Registries and Index Generator',5],['First Verified Incident Record',7],['Root-Cause Fingerprint + First Abstract Pattern',7],
  ['First Recipe',7],['Proof Model / Qualification State Machine',5],['Backend-Neutral Executable Contract',5],['Foundry Vertical-Slice Reproduction',7],
  ['Historical Reproduction Path',7],['Generalized Second-Fixture Proof',5],['Deterministic Applicability Matcher',7],['Campaign Adaptation Artifact',6],
  ['Six-Layer Phase Plan / Queue Integration',7],['Campaign Invalidation Integration',6],['Medusa Template Integration',7],['Anvil Template Integration',7],
  ['Failure-Doctor Integration',6],['Ingestion Helpers',6],['Seed Corpus Expansion',13],['Coverage Accounting',5],['Static Enforcement / Active Registry Gate',7],
  ['Full Vertical-Slice Qualification',13],['Scalable Corpus Ingestion Begins',8],['Accounting Action/Invariant Registries',5],['Accounting Motif + Sequence Mutation Library',6],
  ['Campaign Accounting-Chaos Adapter',7],['Randomized Accounting Campaign Executor Integration',7],['Attacker Net-Value / Accounting Delta Evidence',6],
  ['Harness Mutation Class Registry',6],['Dual-Engine Attack Coverage Adapter',6],['Accounting Campaign Coverage / Diversity Export',6],['v3 Adversarial Dynamic-Assurance Qualification',9],
];
export const DEVELOPMENT_PLAN_V3 = Object.freeze(Object.fromEntries(MODULE_SPEC.map(([name,maxStep],i)=>[
  `K${String(i).padStart(2,'0')}`, Object.freeze({name,maxStep})
])));

export const REQUIRED_RECOVERY_FILES_V1 = Object.freeze([
  'docs/development-state/RECOVERY_START_HERE_v1.md',
  'docs/development-state/DEVELOPMENT_RECOVERY_STATE_v1.json',
  'docs/development-state/CURRENT_STATUS_v1.md',
  'docs/development-state/DECISION_LOG_v1.md',
  'docs/development-state/TEST_AND_PROOF_INDEX_v1.json',
]);

const OVERALL = new Set(['NOT_STARTED','IN_PROGRESS','BLOCKED','QUALIFICATION','COMPLETE']);
const STEP = new Set(['READY','IN_PROGRESS','PASS','FAIL_DIAGNOSIS_REQUIRED','BLOCKED','SUPERSEDED']);
const SHA40 = /^[0-9a-f]{40}$/;
const TERMINAL_EXTERNAL = new Set(['PASS','FAIL','FAILED','CANCELLED','ERROR','COMPLETE','COMPLETED','SUCCESS']);
function push(errors, condition, code, detail=null) { if (!condition) errors.push({code,detail}); }
function nonEmpty(value) { return typeof value === 'string' && value.trim().length > 0; }
function stepBelongs(moduleId, stepId) {
  const module=DEVELOPMENT_PLAN_V3[moduleId];
  const m=/^(K\d{2})-S(\d{2})$/.exec(stepId??'');
  return Boolean(module && m && m[1]===moduleId && Number(m[2])>=1 && Number(m[2])<=module.maxStep);
}

export function validateRequiredRecoveryFilesV1(paths=[]) {
  const seen=new Set(paths); const missing=REQUIRED_RECOVERY_FILES_V1.filter((path)=>!seen.has(path));
  return {status:missing.length===0?'PASS':'FAIL',missing};
}

export function validateDevelopmentRecoveryStateV1(state) {
  const errors=[];
  push(errors,state&&typeof state==='object'&&!Array.isArray(state),'STATE_OBJECT_REQUIRED');
  if(!state||typeof state!=='object'||Array.isArray(state)) return {status:'FAIL',errors};
  push(errors,state.schemaVersion==='curve-yield-development-recovery-v1','SCHEMA_VERSION');
  push(errors,state.projectId==='HISTORICAL_EXPLOIT_ADVERSARIAL_SIMULATION_KB','PROJECT_ID');
  push(errors,state.planVersion==='v3','PLAN_VERSION');
  push(errors,state.repository==='CurveYield2/Contract-Automation','REPOSITORY');
  push(errors,nonEmpty(state.branch),'BRANCH');
  push(errors,OVERALL.has(state.overallStatus),'OVERALL_STATUS',state.overallStatus);
  push(errors,STEP.has(state.currentStepStatus),'CURRENT_STEP_STATUS',state.currentStepStatus);
  push(errors,SHA40.test(state.baselineMainSha??''),'BASELINE_SHA');
  if(state.overallStatus!=='NOT_STARTED') push(errors,SHA40.test(state.lastKnownGoodCommit??''),'LAST_KNOWN_GOOD_COMMIT');
  push(errors,SHA40.test(state.currentCommit??''),'CURRENT_COMMIT');
  push(errors,Boolean(DEVELOPMENT_PLAN_V3[state.currentModuleId]),'CURRENT_MODULE_UNKNOWN',state.currentModuleId);
  push(errors,stepBelongs(state.currentModuleId,state.currentStepId),'CURRENT_STEP_NOT_IN_MODULE',state.currentStepId);
  if(state.overallStatus==='IN_PROGRESS') push(errors,nonEmpty(state.nextExactAction),'NEXT_EXACT_ACTION_REQUIRED');
  for(const field of ['openBlockers','knownFailures','modifiedPaths','decisions']) push(errors,Array.isArray(state[field]),`ARRAY_REQUIRED:${field}`);
  for(const field of ['moduleStates','testSummary','proofSummary']) push(errors,state[field]&&typeof state[field]==='object'&&!Array.isArray(state[field]),`OBJECT_REQUIRED:${field}`);
  push(errors,nonEmpty(state.lastUpdatedAt)&&!Number.isNaN(Date.parse(state.lastUpdatedAt)),'LAST_UPDATED_AT');
  for(const [moduleId,moduleState] of Object.entries(state.moduleStates??{})) {
    push(errors,Boolean(DEVELOPMENT_PLAN_V3[moduleId]),'MODULE_STATE_UNKNOWN',moduleId);
    if(moduleState?.status==='COMPLETE') push(errors,moduleState.hardGate==='PASS','COMPLETE_MODULE_WITHOUT_HARD_GATE_PASS',moduleId);
    for(const [stepId,stepState] of Object.entries(moduleState?.steps??{})) {
      push(errors,stepBelongs(moduleId,stepId),'MODULE_STEP_UNKNOWN',`${moduleId}:${stepId}`);
      push(errors,STEP.has(stepState),'MODULE_STEP_STATE_INVALID',`${stepId}:${stepState}`);
    }
  }
  if(state.activeExternalRun) {
    push(errors,typeof state.activeExternalRun==='object'&&!Array.isArray(state.activeExternalRun),'ACTIVE_EXTERNAL_RUN_OBJECT');
    const status=String(state.activeExternalRun?.status??'').toUpperCase();
    push(errors,!TERMINAL_EXTERNAL.has(status),'TERMINAL_EXTERNAL_RUN_STILL_ACTIVE',status);
  }
  return {status:errors.length===0?'PASS':'FAIL',errors};
}

export function renderCurrentStatusV1(state) {
  const validation=validateDevelopmentRecoveryStateV1(state);
  if(validation.status!=='PASS') throw new Error(`Cannot render invalid recovery state: ${JSON.stringify(validation.errors)}`);
  const module=DEVELOPMENT_PLAN_V3[state.currentModuleId];
  const blockers=(state.openBlockers.length?state.openBlockers.map((x)=>`- ${typeof x==='string'?x:JSON.stringify(x)}`):['- None']).join('\n');
  return `# Historical Exploit + Adversarial Simulation KB — Current Status v1\n\nGenerated from \`DEVELOPMENT_RECOVERY_STATE_v1.json\`. Do not edit this projection independently.\n\n- Repository: \`${state.repository}\`\n- Branch: \`${state.branch}\`\n- Pull request: ${state.pullRequest??'not opened yet'}\n- Baseline main SHA: \`${state.baselineMainSha}\`\n- Last known good commit: \`${state.lastKnownGoodCommit}\`\n- Overall status: **${state.overallStatus}**\n- Current module: **${state.currentModuleId} — ${module.name}**\n- Current step: **${state.currentStepId} / ${state.currentStepStatus}**\n- Last completed step: ${state.lastCompletedStepId??'none'}\n\n## Next exact action\n\n${state.nextExactAction}\n\n## Open blockers\n\n${blockers}\n`;
}
