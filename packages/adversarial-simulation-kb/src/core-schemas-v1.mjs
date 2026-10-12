const ID_PATTERNS = Object.freeze([
  /^EXP-[0-9]{4}-[0-9]{4}$/,
  /^PATTERN-[0-9]{4}$/,
  /^RECIPE-[0-9]{4}$/,
  /^EXEC-[0-9]{4}$/,
  /^SOURCE-[0-9]{4}$/,
  /^PROOF-[0-9]{4}$/,
]);
const REF = Object.freeze({
  EXP:/^EXP-[0-9]{4}-[0-9]{4}$/, PATTERN:/^PATTERN-[0-9]{4}$/, RECIPE:/^RECIPE-[0-9]{4}$/,
  EXEC:/^EXEC-[0-9]{4}$/, SOURCE:/^SOURCE-[0-9]{4}$/, PROOF:/^PROOF-[0-9]{4}$/,
});
const PROOF_TIERS=new Set(['REFERENCE_ONLY','SCHEMA_VALID','COMPILES','CONTROLLED_REPRODUCTION','HISTORICAL_REPRODUCTION','GENERALIZED_VARIANT_PROVEN','QUALIFIED']);
const INCIDENT_STATUS=new Set(['VERIFIED','PARTIALLY_VERIFIED','DISPUTED','REFERENCE_ONLY']);
const BACKEND=new Set(['medusa','foundry','anvil']);
const SUPPORT=new Set(['SUPPORTED','ADAPTATION_REQUIRED','UNSUPPORTED']);
const EXECUTION_MODE=new Set(['CONTROLLED','HISTORICAL']);
const KNOWLEDGE_KIND=new Set(['incident','pattern','recipe']);
const SHA40=/^[0-9a-f]{40}$/; const SHA64=/^[0-9a-f]{64}$/;

export const CORE_REQUIRED_FIELDS_V1=Object.freeze({
  incident:Object.freeze(['schemaVersion','incidentId','revision','title','incidentDate','affectedProtocol','affectedChain','affectedContracts','lossEstimate','sourceType','incidentStatus','rootCauseSummary','attackSummary','preconditions','attackSteps','violatedProperties','affectedPatterns','attackPrimitives','applicabilitySignals','nonApplicabilitySignals','falsePositiveGuards','requiredCapabilities','runtimeRequirements','references','reproductionRefs','generalizedPatternRefs','proofStatusRef','limitations']),
  pattern:Object.freeze(['schemaVersion','patternId','revision','name','description','rootCauseClass','structuralPreconditions','runtimePreconditions','attackerCapabilities','attackSequenceAbstract','expectedSecurityPropertyViolation','sourceIntelligenceSignals','runtimeOverlaySignals','nonApplicabilitySignals','falsePositiveGuards','adaptationRules','recommendedBackends','historicalIncidentRefs','recipeRefs','limitations']),
  recipe:Object.freeze(['schemaVersion','recipeId','revision','patternRefs','targetTopologies','requiredTargetBindings','setupSteps','attackSteps','observations','assertions','adaptationInputs','backendSupport','executableRefs','proofStatusRef']),
  executable:Object.freeze(['schemaVersion','executableId','revision','incidentRefs','patternRefs','recipeRefs','knowledgeBindings','backend','toolVersion','language','sourceFiles','executionMode','expectedSetup','requiredRpcForkState','requiredBlockIdentity','requiredImpersonation','requiredTokenBalances','expectedResult','expectedEvidence','proofStatusRef','lastQualification']),
  proof:Object.freeze(['schemaVersion','proofId','knowledgeRef','proofTier','status','claim','evidenceRefs','artifactDigests','runIds','qualifiedAtCommit','limitations']),
});

export function validateStableIdV1(id){
  const ok=typeof id==='string'&&ID_PATTERNS.some((re)=>re.test(id));
  return {status:ok?'PASS':'FAIL',id,reason:ok?null:'INVALID_STABLE_ID'};
}
export function validateRevisionSequenceV1(entries=[]){
  const errors=[]; const last=new Map();
  for(const entry of entries){
    if(validateStableIdV1(entry?.id).status!=='PASS'||!Number.isInteger(entry?.revision)||entry.revision<1){errors.push({code:'INVALID_REVISION_ENTRY',entry});continue;}
    const previous=last.get(entry.id);
    if(previous!==undefined&&entry.revision<=previous)errors.push({code:'ID_REUSE_OR_REVISION_REGRESSION',id:entry.id,previous,revision:entry.revision});
    last.set(entry.id,entry.revision);
  }
  return {status:errors.length?'FAIL':'PASS',errors};
}
function allArray(record,fields,errors){for(const f of fields)if(!Array.isArray(record[f]))errors.push({code:'ARRAY_REQUIRED',field:f});}
function refs(values,re,field,errors){if(Array.isArray(values))for(const v of values)if(typeof v!=='string'||!re.test(v))errors.push({code:'BAD_REFERENCE_CLASS',field,value:v});}
function nonempty(v){return typeof v==='string'&&v.trim().length>0;}
function revision(record,errors){if(!Number.isInteger(record.revision)||record.revision<1)errors.push({code:'REVISION'});}

export function validateCoreRecordV1(kind,record){
  const errors=[]; const required=CORE_REQUIRED_FIELDS_V1[kind];
  if(!required)return{status:'FAIL',errors:[{code:'UNKNOWN_KIND',kind}]};
  if(!record||typeof record!=='object'||Array.isArray(record))return{status:'FAIL',errors:[{code:'RECORD_OBJECT_REQUIRED'}]};
  for(const field of required)if(!Object.hasOwn(record,field))errors.push({code:'REQUIRED_FIELD_MISSING',field});
  if(errors.length)return{status:'FAIL',errors};
  if(kind==='incident'){
    if(record.schemaVersion!=='adversarial-kb-incident-v1')errors.push({code:'SCHEMA_VERSION'});
    if(!REF.EXP.test(record.incidentId))errors.push({code:'INCIDENT_ID'});
    revision(record,errors);
    if(!INCIDENT_STATUS.has(record.incidentStatus)||record.sourceType!=='HISTORICAL_EXPLOIT')errors.push({code:'INCIDENT_STATUS'});
    allArray(record,['affectedChain','affectedContracts','preconditions','attackSteps','violatedProperties','affectedPatterns','attackPrimitives','applicabilitySignals','nonApplicabilitySignals','falsePositiveGuards','requiredCapabilities','runtimeRequirements','references','reproductionRefs','generalizedPatternRefs','limitations'],errors);
    refs(record.affectedPatterns,REF.PATTERN,'affectedPatterns',errors); refs(record.references,REF.SOURCE,'references',errors); refs(record.reproductionRefs,REF.EXEC,'reproductionRefs',errors); refs(record.generalizedPatternRefs,REF.PATTERN,'generalizedPatternRefs',errors); if(!REF.PROOF.test(record.proofStatusRef))errors.push({code:'PROOF_REF'});
    for(const f of ['title','incidentDate','affectedProtocol','rootCauseSummary','attackSummary'])if(!nonempty(record[f]))errors.push({code:'TEXT_REQUIRED',field:f});
  }else if(kind==='pattern'){
    if(record.schemaVersion!=='adversarial-kb-pattern-v1'||!REF.PATTERN.test(record.patternId))errors.push({code:'PATTERN_ID_OR_SCHEMA'});
    revision(record,errors);
    allArray(record,['rootCauseClass','structuralPreconditions','runtimePreconditions','attackerCapabilities','attackSequenceAbstract','expectedSecurityPropertyViolation','sourceIntelligenceSignals','runtimeOverlaySignals','nonApplicabilitySignals','falsePositiveGuards','adaptationRules','recommendedBackends','historicalIncidentRefs','recipeRefs','limitations'],errors);
    if(!Array.isArray(record.falsePositiveGuards)||record.falsePositiveGuards.length<1)errors.push({code:'FALSE_POSITIVE_GUARD_REQUIRED'});
    if(!Array.isArray(record.rootCauseClass)||record.rootCauseClass.length<1)errors.push({code:'ROOT_CAUSE_REQUIRED'});
    for(const b of record.recommendedBackends??[])if(!BACKEND.has(b))errors.push({code:'BACKEND',value:b}); refs(record.historicalIncidentRefs,REF.EXP,'historicalIncidentRefs',errors); refs(record.recipeRefs,REF.RECIPE,'recipeRefs',errors);
  }else if(kind==='recipe'){
    if(record.schemaVersion!=='adversarial-kb-recipe-v1'||!REF.RECIPE.test(record.recipeId))errors.push({code:'RECIPE_ID_OR_SCHEMA'});
    revision(record,errors);
    allArray(record,['patternRefs','targetTopologies','requiredTargetBindings','setupSteps','attackSteps','observations','assertions','adaptationInputs','executableRefs'],errors); refs(record.patternRefs,REF.PATTERN,'patternRefs',errors); refs(record.executableRefs,REF.EXEC,'executableRefs',errors); if(!REF.PROOF.test(record.proofStatusRef))errors.push({code:'PROOF_REF'});
    for(const b of ['medusa','foundry','anvil'])if(!SUPPORT.has(record.backendSupport?.[b]))errors.push({code:'BACKEND_SUPPORT',backend:b});
  }else if(kind==='executable'){
    if(record.schemaVersion!=='adversarial-kb-executable-v1'||!REF.EXEC.test(record.executableId))errors.push({code:'EXECUTABLE_ID_OR_SCHEMA'});
    revision(record,errors);
    allArray(record,['incidentRefs','patternRefs','recipeRefs','knowledgeBindings','sourceFiles','expectedSetup','requiredImpersonation','requiredTokenBalances','expectedEvidence'],errors); refs(record.incidentRefs,REF.EXP,'incidentRefs',errors); refs(record.patternRefs,REF.PATTERN,'patternRefs',errors); refs(record.recipeRefs,REF.RECIPE,'recipeRefs',errors); if(!REF.PROOF.test(record.proofStatusRef))errors.push({code:'PROOF_REF'});
    if(!BACKEND.has(record.backend))errors.push({code:'BACKEND'}); if(!nonempty(record.toolVersion)||/^(latest|\*|\^|>=|<=)/i.test(record.toolVersion))errors.push({code:'PINNED_TOOL_VERSION_REQUIRED'});
    if(!nonempty(record.language))errors.push({code:'LANGUAGE'}); for(const f of record.sourceFiles??[])if(!nonempty(f?.path)||!SHA64.test(f?.digest??''))errors.push({code:'SOURCE_FILE_IDENTITY'});
    if(!EXECUTION_MODE.has(record.executionMode))errors.push({code:'EXECUTION_MODE'});
    for(const binding of record.knowledgeBindings??[]){
      if(!binding||typeof binding!=='object'||Array.isArray(binding)||!KNOWLEDGE_KIND.has(binding.kind)||!nonempty(binding.id)||!Number.isInteger(binding.revision)||binding.revision<1||!SHA64.test(binding.digest??''))errors.push({code:'KNOWLEDGE_BINDING'});
    }
    if(record.lastQualification!==null&&(!record.lastQualification||typeof record.lastQualification!=='object'||Array.isArray(record.lastQualification)||!SHA40.test(record.lastQualification.commit??'')||!nonempty(record.lastQualification.runId)))errors.push({code:'LAST_QUALIFICATION'});
  }else if(kind==='proof'){
    if(record.schemaVersion!=='adversarial-kb-proof-v1'||!REF.PROOF.test(record.proofId))errors.push({code:'PROOF_ID_OR_SCHEMA'}); if(!PROOF_TIERS.has(record.proofTier))errors.push({code:'PROOF_TIER'}); if(!ID_PATTERNS.slice(0,4).some((re)=>re.test(record.knowledgeRef)))errors.push({code:'KNOWLEDGE_REF'}); if(!SHA40.test(record.qualifiedAtCommit??''))errors.push({code:'QUALIFIED_COMMIT'}); allArray(record,['evidenceRefs','artifactDigests','runIds','limitations'],errors); for(const d of record.artifactDigests??[])if(!SHA64.test(d))errors.push({code:'ARTIFACT_DIGEST'}); if(!nonempty(record.claim))errors.push({code:'CLAIM'});
  }
  return {status:errors.length?'FAIL':'PASS',errors};
}
