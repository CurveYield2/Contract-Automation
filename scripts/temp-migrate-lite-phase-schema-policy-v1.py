#!/usr/bin/env python3
import json, hashlib, sys
from pathlib import Path

root=Path(sys.argv[1]).resolve()
packages=sorted(p for p in root.iterdir() if p.is_dir() and (p/'SKILL.md').is_file())
if len(packages)!=1:
    raise SystemExit('expected exactly one unpacked Lite authority package')
pkg=packages[0]

POLICY='''# Lite Structured Action Output and End-of-Phase Controller Policy

## Hard rules

1. Every **agent-executed** action MUST produce durable substantive audit data.
2. Every agent action MUST identify one reference form, one clearly named `Step X Input — ...` section, and one mapping inside the phase's single schema.
3. Every phase has exactly one schema: `PHASE_XX_SCHEMA_v1.json`. No per-step or per-form schemas are allowed.
4. Similar action steps SHOULD share one consolidated phase work form. Separate human-readable forms are allowed only when materially clearer, but the phase still has exactly one schema.
5. Agents record substantive audit work while performing each action. Agents do not perform controller bookkeeping while working.
6. There are no agent actions whose only purpose is reading, acknowledging, checking prior bookkeeping, updating a receipt, synchronizing controller state, routing, sealing, hashing, checkpointing, handoff preparation, or retirement. Such work belongs to automation and is not an agent action.
7. At phase end, the agent submits the completed phase work form(s) and substantive final report as one logical Phase Work Packet.
8. The controller validates the packet against the single phase schema before any bookkeeping occurs.
9. If any required document, Step X section, field, conditional field, or cross-reference is missing, the controller returns an exact deficiency list and the same agent repairs only those items.
10. No phase receipt, graph/ledger/invalidation synchronization, Campaign Directory advancement, successor routing, or other bookkeeping occurs until packet validation PASS.
11. After PASS, the controller performs all bookkeeping for that phase exactly once, creates/seals the receipt, packages canonical phase data into optimized downstream artifacts, updates routing, and authorizes continuation/retirement.
12. Later phases never check, validate, hash, checkpoint, or re-account for earlier-phase bookkeeping. They may consume earlier substantive evidence when needed for security reasoning.
13. A substantive fact is entered by an agent once. Later-phase copies are automation inputs, not agent re-entry fields.
14. Derived downstream artifacts are deterministic automation products and are never independent sources of truth.
15. Every required schema field must have a current-phase, downstream-phase, controller-validation, or final-report purpose. Dead fields are prohibited.
16. Blank required fields are prohibited. Use explicit negative values such as `NONE_IDENTIFIED`, `NOT_APPLICABLE`, `NO_CANDIDATE`, `NO_REMEDIATION`, `INSUFFICIENT_EVIDENCE`, or `UNRESOLVED`.

## Universal phase ending

The final report is substantive synthesis, not a bookkeeping artifact. After completing every schema-governed action and report section, submit the Phase Work Packet. Do not advance or retire until the controller returns `CONTROLLER_PHASE_PASS`. On validation failure, repair only the exact missing document/section/field and resubmit.

## Controller order

`packet submission → schema completeness validation → PASS → canonical data extraction → one bookkeeping transaction → derived downstream packaging → sealed phase receipt → next assignment`

If validation fails, bookkeeping does not start.
'''
(pkg/'shared/controller/LITE_PHASE_SCHEMA_POLICY.md').write_text(POLICY)

def F(name, typ='REQUIRED_ANALYSIS', consumers=None, allowed=None, item_fields=None):
    x={'name':name,'type':typ,'consumers':consumers or []}
    if allowed: x['allowed']=allowed
    if item_fields: x['itemRequiredFields']=item_fields
    return x

defs={
1:{'title':'Semantic Scope, Dependency/Standards Analysis & Security Risk Grade','reviewer':'reviewer-1','actions':[
('Assess admitted Phase-0 evidence for semantic use','Transform the admitted mechanical baseline into Phase-1-relevant observations without revalidating Phase-0 bookkeeping.',[
F('sourceIntelligenceUseAssessment'),F('relevantStructuralSurfaces','REQUIRED_LIST',['phase-2']),F('phase0LimitationsRelevantToPhase1','REQUIRED_LIST',['phase-2','phase-10']),F('unresolvedStructuralUncertainties','REQUIRED_LIST',['phase-2','phase-3']),F('targetedVerificationNeeds','REQUIRED_LIST',['phase-2'])]),
('Perform semantic specification and scope interpretation','Determine protected assets, meaningful authority, trust boundaries, state transitions, prohibited outcomes, requirements and ambiguity.',[
F('protectedAssets','REQUIRED_RECORD_LIST',['phase-2','phase-3','phase-10'],item_fields=['assetKey','description','securityImportance']),F('authorityActors','REQUIRED_RECORD_LIST',['phase-2','phase-3'],item_fields=['actorKey','authority','constraints']),F('trustBoundaries','REQUIRED_RECORD_LIST',['phase-3','phase-4'],item_fields=['boundaryKey','description','crossingConditions']),F('stateTransitions','REQUIRED_RECORD_LIST',['phase-2','phase-3'],item_fields=['transitionKey','preState','action','postState','securityRequirement']),F('prohibitedOutcomes','REQUIRED_LIST',['phase-2','phase-3','phase-8']),F('semanticRequirements','REQUIRED_RECORD_LIST',['phase-2'],item_fields=['requirementKey','statement','evidenceBasis']),F('ambiguities','REQUIRED_LIST',['phase-2','phase-10'])]),
('Analyze external dependency trust and failure semantics','Interpret dependency trust, authority, abnormal behavior and failure propagation using the Phase-0 structural inventory.',[
F('dependencyAssessments','REQUIRED_RECORD_LIST',['phase-3','phase-4','phase-5'],item_fields=['dependencyKey','identity','trustAssumptions','failureModes','authorityImplications','securitySignificance','laterEvidenceNeeds'])]),
('Determine standards applicability and conformance requirements','Interpret claimed standards/interfaces and define applicable requirements, deviations and later tests.',[
F('standardsAssessments','REQUIRED_RECORD_LIST',['phase-2','phase-4','phase-8'],item_fields=['standardKey','applicability','requirements','deviationsOrUncertainty','laterTests'])]),
('Analyze risk drivers','Analyze asset exposure, authority concentration, accounting/value-flow exposure, dependency exposure and credible loss paths.',[
F('riskDrivers','REQUIRED_RECORD_LIST',['phase-2','phase-10'],item_fields=['driverKey','category','evidence','riskContribution']),F('credibleLossPaths','REQUIRED_LIST',['phase-2','phase-3','phase-8']),F('riskAssumptions','REQUIRED_LIST',['phase-2','phase-3'])]),
('Set evidence-based security risk grade','Issue the Phase-1 risk grade and rationale from the substantive Phase-1 analysis.',[
F('riskGrade','REQUIRED_VALUE',['phase-2','phase-10']),F('riskRationale','REQUIRED_ANALYSIS',['phase-2','phase-10']),F('promotionTriggers','REQUIRED_LIST',['phase-2','phase-8']),F('phase1Limitations','REQUIRED_LIST',['phase-2','phase-10'])])
],'derived':[('derived/phase-1/PHASE2_INPUT_v1.json',['actions'])],'bookkeeping':{'graphRecordPaths':['actions.step-2.outputs.protectedAssets','actions.step-2.outputs.trustBoundaries','actions.step-3.outputs.dependencyAssessments'],'obligationRecordPaths':['actions.step-1.outputs.targetedVerificationNeeds'],'invalidationRecordPaths':['actions.step-1.outputs.unresolvedStructuralUncertainties']}},
2:{'title':'Lite Combined Phases 2-5 - Specification','reviewer':'reviewer-2','actions':[
('Assess inherited substantive evidence for property design','Identify predecessor facts, assumptions and unresolved questions that materially constrain Phase-2 properties.',[
F('relevantInheritedFacts','REQUIRED_LIST',['phase-3','phase-4']),F('inheritedAssumptions','REQUIRED_LIST',['phase-3']),F('unresolvedPropertyQuestions','REQUIRED_LIST',['phase-3','phase-4']),F('identityChangeObservations','REQUIRED_LIST',['controller'])]),
('Specify retained security requirements','Define the security requirements, negative requirements, units, bounds, rounding behavior and edge conditions that must hold.',[
F('requirements','REQUIRED_RECORD_LIST',['phase-3','phase-4','phase-6','phase-8'],item_fields=['tempKey','statement','actorOrAsset','preconditions','expectedInvariant','prohibitedOutcome','unitsBoundsRounding','evidenceBasis'])]),
('Design property validation routes','Define each property and the appropriate manual, targeted-fuzz and simulation routes without executing later-phase work.',[
F('propertyDesigns','REQUIRED_RECORD_LIST',['phase-3','phase-4','phase-6','phase-8'],item_fields=['tempKey','requirementTempKeys','propertyStatement','manualReviewRoute','targetedFuzzRoute','simulationRoute','materiality','unresolvedAssumptions'])])
],'derived':[('derived/phase-2/PHASE3_INPUT_v1.json',['actions.step-2.outputs.requirements','actions.step-3.outputs.propertyDesigns'])],'bookkeeping':{'graphRecordPaths':['actions.step-2.outputs.requirements','actions.step-3.outputs.propertyDesigns'],'obligationRecordPaths':['actions.step-3.outputs.propertyDesigns'],'invalidationRecordPaths':['actions.step-1.outputs.identityChangeObservations']}},
3:{'title':'Lite Combined Phases 2-5 - Threat and Domain Model','reviewer':'reviewer-2','actions':[
('Model architecture, trust and material attack hypotheses','Create the Phase-3 threat model and concrete attack hypotheses from inherited scope/properties.',[
F('architectureTrustModel','REQUIRED_ANALYSIS',['phase-4','phase-5']),F('authorityTransitions','REQUIRED_LIST',['phase-4']),F('upgradePaths','REQUIRED_LIST',['phase-4']),F('callbackSurfaces','REQUIRED_LIST',['phase-4']),F('attackHypotheses','REQUIRED_RECORD_LIST',['phase-4','phase-6','phase-8'],item_fields=['tempKey','targetPropertyTempKeys','prerequisites','attackSequence','successCondition','credibleImpact','sourceOrDependencyBasis'])]),
('Classify every specialist domain','Apply domain trigger facts and conservatively classify specialist-domain applicability.',[
F('domainAssessments','REQUIRED_RECORD_LIST',['phase-4','phase-6'],item_fields=['domainId','triggerFacts','classification','rationale','requiredPhase4Method'])]),
('Define specialist review and later-validation obligations','Translate triggered/uncertain domains and hypotheses into substantive review/validation obligations.',[
F('specialistObligations','REQUIRED_RECORD_LIST',['phase-4','phase-6'],item_fields=['tempKey','originFactKeys','requiredPhase','requiredAction','completionCondition','priority'])])
],'derived':[('derived/phase-3/PHASE4_INPUT_v1.json',['actions'])],'bookkeeping':{'graphRecordPaths':['actions.step-1.outputs.attackHypotheses','actions.step-2.outputs.domainAssessments'],'obligationRecordPaths':['actions.step-3.outputs.specialistObligations'],'invalidationRecordPaths':[]}},
4:{'title':'Lite Combined Phases 2-5 - Manual and Specialist Review','reviewer':'reviewer-2','actions':[
('Perform complete source-first manual review','Perform one principal semantic traversal and record source-anchored behavior/security conclusions across all required surfaces.',[
F('sourceReviewRecords','REQUIRED_RECORD_LIST',['phase-5','phase-6','phase-8'],item_fields=['recordKey','sourceAnchor','contractOrModule','functionOrSurface','observedBehavior','securityInterpretation','relatedRequirementKeys','relatedHypothesisKeys','disposition','candidateTempKeyOrNone','limitations'])]),
('Review material privileges and activated specialist domains','Apply privilege and triggered specialist methods at the relevant source anchors.',[
F('specialistReviewRecords','REQUIRED_RECORD_LIST',['phase-5','phase-6','phase-8'],item_fields=['recordKey','domainOrPrivilege','sourceAnchor','method','observation','securityInterpretation','disposition','candidateTempKeyOrNone'])]),
('Reconcile coverage and create material candidate records','Classify every material observation and produce candidate/limitation data later phases actually need.',[
F('coverageSummary','REQUIRED_ANALYSIS',['phase-5','phase-10']),F('unreviewedRequiredSurfaces','REQUIRED_LIST',['controller','phase-10']),F('typedLimitations','REQUIRED_LIST',['phase-5','phase-10']),F('candidateRecords','REQUIRED_RECORD_LIST',['phase-5','phase-6','phase-8'],item_fields=['tempKey','sourceAnchor','description','securityRationale','relatedRequirementKeys','relatedHypothesisKeys','recommendedValidationMethod','materialityBasis','evidenceRefs'])])
],'derived':[('derived/phase-4/PHASE5_INPUT_v1.json',['actions.step-1.outputs.sourceReviewRecords','actions.step-2.outputs.specialistReviewRecords','actions.step-3.outputs.candidateRecords','actions.step-3.outputs.typedLimitations']),('derived/phase-4/PHASE6_VALIDATION_TARGETS_v1.json',['actions.step-3.outputs.candidateRecords'])],'bookkeeping':{'graphRecordPaths':['actions.step-1.outputs.sourceReviewRecords','actions.step-2.outputs.specialistReviewRecords','actions.step-3.outputs.candidateRecords'],'obligationRecordPaths':['actions.step-3.outputs.candidateRecords'],'invalidationRecordPaths':['actions.step-3.outputs.typedLimitations']}},
5:{'title':'Lite Combined Phases 2-5 - Economic Review and Seal','reviewer':'reviewer-2','actions':[
('Complete economic and mathematical review','Analyze value flows, extraction, conservation, solvency, allocation, units, bounds, precision, rounding and time/rate behavior at relevant anchors.',[
F('economicReviewRecords','REQUIRED_RECORD_LIST',['phase-6','phase-8','phase-10'],item_fields=['recordKey','sourceAnchor','valueFlowOrFormula','unitsAndBounds','boundaryCases','roundingPrecision','incentiveExtractionAnalysis','solvencyOrConservationAnalysis','conclusion','relatedCandidateKeys'])]),
('Perform bounded contradiction and candidate reconciliation','Reconcile Phase-5 conclusions against prior properties, hypotheses and candidates without broad retracing.',[
F('reconciliationRecords','REQUIRED_RECORD_LIST',['phase-6','phase-8'],item_fields=['subjectKey','subjectType','priorConclusion','phase5Observation','disposition','rationale','sourceAnchor','downstreamValidationNeed']),F('newCandidateRecords','REQUIRED_RECORD_LIST',['phase-6','phase-8'],item_fields=['tempKey','sourceAnchor','description','securityRationale','recommendedValidationMethod','materialityBasis'])])
],'derived':[('derived/phase-5/PHASE6_INPUT_v1.json',['actions'])],'bookkeeping':{'graphRecordPaths':['actions.step-1.outputs.economicReviewRecords','actions.step-2.outputs.reconciliationRecords','actions.step-2.outputs.newCandidateRecords'],'obligationRecordPaths':['actions.step-2.outputs.reconciliationRecords','actions.step-2.outputs.newCandidateRecords'],'invalidationRecordPaths':[]}},
6:{'title':'Merged Lite Phases 6-7 - Execution and Interpretation','reviewer':'reviewer-3L','actions':[
('Interpret exact deployment and configuration execution','Consume machine execution evidence and assess deployment/configuration security significance, contradictions and limitations.',[
F('deploymentAssessments','REQUIRED_RECORD_LIST',['phase-8','phase-10'],item_fields=['componentOrAction','executionEvidenceRef','observedState','securityInterpretation','contradictionOrNone','limitationOrNone'])]),
('Define candidate-specific validation oracles and setups','For every material target, define the exact security oracle, prerequisites, variable bounds and safe environment reuse assumptions used by execution automation.',[
F('targetDesigns','REQUIRED_RECORD_LIST',['execution','phase-8'],item_fields=['candidateKey','setup','prerequisites','oracle','fuzzVariablesAndBounds','snapshotReuseSafety','expectedSecurityProperty'])]),
('Interpret deterministic simulation and targeted-fuzz results','Assess machine-produced traces/counterexamples/results and issue candidate-specific execution dispositions.',[
F('targetDispositions','REQUIRED_RECORD_LIST',['phase-8','phase-10'],item_fields=['candidateKey','executionEvidenceRefs','oracleOutcome','reproductionStatus','securityInterpretation','limitations','recommendedPhase8Disposition'])]),
('State merged Lite 6-7 conclusions and omissions','Synthesize execution conclusions, typed limitations and the fixed Full-only omissions without performing bookkeeping.',[
F('mergedExecutionConclusions','REQUIRED_ANALYSIS',['phase-8','phase-10']),F('typedExecutionLimitations','REQUIRED_LIST',['phase-8','phase-10']),F('fullOnlyOmissions','REQUIRED_LIST',['phase-10'])])
],'derived':[('derived/phase-6/PHASE8_INPUT_v1.json',['actions'])],'bookkeeping':{'graphRecordPaths':['actions.step-1.outputs.deploymentAssessments','actions.step-3.outputs.targetDispositions'],'obligationRecordPaths':['actions.step-3.outputs.targetDispositions'],'invalidationRecordPaths':['actions.step-1.outputs.deploymentAssessments']}},
7:{'title':'Lite Phase 7 Automatic Completion Marker','reviewer':'phase7-automation','automationOnly':True,'actions':[
('Create automatic Phase-7 completion marker','Record the deterministic transition facts produced from validated Phase-6 state.',[
F('predecessorPhase6Receipt','REQUIRED_REFERENCE',['phase-8']),F('phase6DerivedInput','REQUIRED_REFERENCE',['phase-8']),F('markerDisposition','REQUIRED_ENUM',['controller'],allowed=['SEALED_AUTOMATIC_MARKER']),F('successorPhase','REQUIRED_ENUM',['controller'],allowed=['8']),F('successorReviewer','REQUIRED_ENUM',['controller'],allowed=['reviewer-4'])])
],'derived':[('derived/phase-7/PHASE8_MARKER_INPUT_v1.json',['actions'])],'bookkeeping':{'graphRecordPaths':[],'obligationRecordPaths':[],'invalidationRecordPaths':[]}},
8:{'title':'Lite Combined Phases 8-10 - Candidate Validation','reviewer':'reviewer-4','actions':[
('Group candidates by genuinely shared validation premises','Identify only defensible candidate families/root causes so shared evidence can be reused without erasing candidate-specific facts.',[
F('candidateGroups','REQUIRED_RECORD_LIST',['phase-8','phase-10'],item_fields=['groupKey','candidateKeys','sharedRootCauseOrPremise','sharedEvidencePath','candidateSpecificDifferences'])]),
('Validate and calibrate every candidate','Establish reachability, prerequisites, violated property, impact, outcome, disposition and severity for every material candidate.',[
F('candidateValidations','REQUIRED_RECORD_LIST',['phase-9','phase-10'],item_fields=['candidateKey','reachability','prerequisites','propertyViolation','impact','outcome','severity','finalDisposition','rationale','evidenceRefs','duplicateOfOrNone']),F('validatedFindings','REQUIRED_RECORD_LIST',['phase-9','phase-10'],item_fields=['findingTempKey','candidateKey','title','rootCause','impact','severity','proofEvidenceRefs'])])
],'derived':[('derived/phase-8/PHASE9_REMEDIATION_INPUT_v1.json',['actions.step-2.outputs.validatedFindings']),('derived/phase-8/PHASE10_INPUT_v1.json',['actions'])],'bookkeeping':{'graphRecordPaths':['actions.step-1.outputs.candidateGroups','actions.step-2.outputs.candidateValidations','actions.step-2.outputs.validatedFindings'],'obligationRecordPaths':['actions.step-2.outputs.validatedFindings'],'invalidationRecordPaths':[]}},
9:{'title':'Lite Combined Phases 8-10 - Conditional Remediation','reviewer':'reviewer-4','conditionalAgentExecution':'REMEDIATION_ARTIFACTS_EXIST','actions':[
('Assess remediation delta and affected security surface','Interpret the machine-derived source/configuration delta and affected callers/state/privileges/accounting/integrations.',[
F('changedSurfaceAssessments','REQUIRED_RECORD_LIST',['phase-10'],item_fields=['findingKey','changedSurface','affectedCallersOrState','securitySignificance','requiredRegressionScope','newRiskOrNone'])]),
('Verify remediation effectiveness and regressions','Use decisive reruns plus changed-surface review to issue remediation dispositions and any new candidate.',[
F('remediationDispositions','REQUIRED_RECORD_LIST',['phase-10'],item_fields=['findingKey','rerunEvidenceRefs','rootCauseFixed','regressionAssessment','disposition','rationale','newCandidateOrNone'])])
],'derived':[('derived/phase-9/PHASE10_REMEDIATION_INPUT_v1.json',['actions'])],'bookkeeping':{'graphRecordPaths':['actions.step-1.outputs.changedSurfaceAssessments','actions.step-2.outputs.remediationDispositions'],'obligationRecordPaths':['actions.step-2.outputs.remediationDispositions'],'invalidationRecordPaths':['actions.step-1.outputs.changedSurfaceAssessments']}},
10:{'title':'Lite Combined Phases 8-10 - Concise Finalization','reviewer':'reviewer-4','actions':[
('Reconcile final findings, obligations and residual limitations','Synthesize the final security state from controller-generated evidence indexes without re-accounting predecessor bookkeeping.',[
F('findingDispositionSynthesis','REQUIRED_ANALYSIS',['final-report']),F('residualLimitations','REQUIRED_LIST',['final-report']),F('unresolvedSubstantiveQuestions','REQUIRED_LIST',['final-report']),F('residualRiskAssessment','REQUIRED_ANALYSIS',['final-report'])]),
('Evaluate Lite assurance claims and Full-only omissions','State what the Lite evidence supports, what Full-only work remains omitted, and the no-repeat Full-upgrade implications.',[
F('assuranceClaims','REQUIRED_LIST',['final-report']),F('fullOnlyOmissionsAssessment','REQUIRED_ANALYSIS',['final-report']),F('fullUpgradeRecommendations','REQUIRED_LIST',['final-report'])]),
('Issue the substantive Lite verdict and client-facing synthesis','Produce the final security verdict and rationale from the completed Lite evidence.',[
F('liteVerdict','REQUIRED_VALUE',['final-report']),F('verdictRationale','REQUIRED_ANALYSIS',['final-report']),F('clientFacingSummary','REQUIRED_ANALYSIS',['final-report'])])
],'derived':[('derived/phase-10/PHASE10_FINAL_CANONICAL_INPUT_v1.json',['actions'])],'bookkeeping':{'graphRecordPaths':['actions.step-2.outputs.assuranceClaims'],'obligationRecordPaths':[],'invalidationRecordPaths':[]}}
}

def placeholder(field):
    t=field['type']
    if t=='REQUIRED_LIST': return ['<REQUIRED_OR_EXPLICIT_NEGATIVE>']
    if t=='REQUIRED_RECORD_LIST': return [{k:'<REQUIRED>' for k in field.get('itemRequiredFields',[])}]
    if t=='REQUIRED_ENUM': return '<REQUIRED_ENUM: '+ ' | '.join(field.get('allowed',[])) + '>'
    return '<REQUIRED>'

for seq,d in defs.items():
    phase_dir=pkg/f'phases/phase-{seq}'
    res=phase_dir/'resources'; res.mkdir(parents=True,exist_ok=True)
    schema_rel=f'phases/phase-{seq}/PHASE_{seq:02d}_SCHEMA_v1.json'
    form_rel=f'work/phase-{seq:02d}/PHASE_{seq:02d}_WORK_FORM_v1.json'
    report_rel=None if d.get('automationOnly') else f'work/phase-{seq:02d}/PHASE_{seq:02d}_FINAL_REPORT_v1.md'
    schema={'schemaVersion':'curveyield-lite-phase-work-schema-v1','phase':seq,'title':d['title'],'executor':d['reviewer'],'automationOnly':bool(d.get('automationOnly',False)),'conditionalAgentExecution':d.get('conditionalAgentExecution'),'workForm':{'campaignPath':form_rel,'template':f'phases/phase-{seq}/resources/PHASE_{seq:02d}_WORK_FORM_TEMPLATE_v1.json'},'finalReport':None if report_rel is None else {'campaignPath':report_rel,'template':f'phases/phase-{seq}/resources/PHASE_{seq:02d}_FINAL_REPORT_TEMPLATE_v1.md','requiredSections':['Executive Conclusion','Material Results','Limitations','Unresolved Substantive Questions']},'actions':{},'derivedOutputs':[{'path':p,'selectors':sels} for p,sels in d['derived']],'bookkeepingMappings':d['bookkeeping'],'submission':{'packetPath':f'submissions/PHASE_{seq:02d}_WORK_PACKET_v1.json','requiredPacketStatus':'SUBMITTED','controllerPassToken':'CONTROLLER_PHASE_PASS','bookkeepingBeforeValidationPass':False}}
    form={'schemaVersion':'curveyield-lite-phase-work-form-v1','phase':seq,'actions':{}}
    steps=[]
    for idx,(title,instruction,fields) in enumerate(d['actions'],start=1):
        key=f'step-{idx}'; heading=f'Step {idx} Input — {title}'
        schema['actions'][key]={'title':title,'formPath':form_rel,'section':heading,'fields':fields}
        form['actions'][key]={'section':heading,'outputs':{f['name']:placeholder(f) for f in fields}}
        steps.append({'step':idx,'action':title,'instruction':instruction,'condition':'REMEDIATION_ARTIFACTS_EXIST' if seq==9 else None,'outputDestination':{'document':form_rel,'section':heading,'schema':schema_rel+'#actions.'+key,'requiredFields':[f['name'] for f in fields]},'resources':[f'./PHASE_{seq:02d}_SCHEMA_v1.json',f'./resources/PHASE_{seq:02d}_WORK_FORM_TEMPLATE_v1.json']})
    (phase_dir/f'PHASE_{seq:02d}_SCHEMA_v1.json').write_text(json.dumps(schema,indent=2)+'\n')
    (res/f'PHASE_{seq:02d}_WORK_FORM_TEMPLATE_v1.json').write_text(json.dumps(form,indent=2)+'\n')
    if report_rel:
        report=f'''# Phase {seq} Final Report\n\n> Governed by `PHASE_{seq:02d}_SCHEMA_v1.json`. This report is substantive synthesis only. Do not add hashes, receipt state, controller checkpoints, handoff data, or predecessor bookkeeping.\n\n## Executive Conclusion\n\n<REQUIRED>\n\n## Material Results\n\n<REQUIRED>\n\n## Limitations\n\n<REQUIRED_OR_EXPLICIT_NEGATIVE>\n\n## Unresolved Substantive Questions\n\n<REQUIRED_OR_EXPLICIT_NEGATIVE>\n'''
        (res/f'PHASE_{seq:02d}_FINAL_REPORT_TEMPLATE_v1.md').write_text(report)
    old=json.loads((phase_dir/'PHASE_CONTRACT.json').read_text())
    new={'schemaVersion':'audit-v7-phase-contract-v2','phase':old.get('phase',{'sequence':seq,'title':d['title']}),'authorization':old.get('authorization',{}),'inputs':old.get('inputs',{}),'workSchema':schema_rel,'workForm':form_rel,'finalReport':report_rel,'steps':steps,'requiredOutputs':[{'artifact':form_rel,'role':'PHASE_WORK_FORM','required':True}]+([] if report_rel is None else [{'artifact':report_rel,'role':'PHASE_FINAL_REPORT','required':True}]),'submissionPolicy':{'packetPath':f'submissions/PHASE_{seq:02d}_WORK_PACKET_v1.json','agentCreatesReceipt':False,'agentPerformsBookkeeping':False,'controllerValidatesSchemaBeforeBookkeeping':True,'controllerCreatesAndSealsReceiptAfterPass':True,'laterPhasesRecheckPriorBookkeeping':False,'advanceOrRetireOnlyAfter':'CONTROLLER_PHASE_PASS'},'derivedOutputPolicy':{'sourceOfTruth':'schema-governed phase work form','controllerGenerated':True,'outputs':[x[0] for x in d['derived']]},'globalControlCheckpoints':old.get('globalControlCheckpoints',{}),'sealingCriteria':['Every agent action required by this phase has complete schema-governed output data.','The substantive final report is complete when this phase has an agent executor.','The submitted Phase Work Packet passes deterministic schema validation.','Only after validation PASS does the controller perform bookkeeping, create/seal the phase receipt, generate derived outputs, and advance routing.'],'recoveryRoutes':[{'condition':'Packet validation reports missing documentation','route':'Keep the same reviewer/phase active. Return exact document/section/field deficiencies. Reviewer repairs only those fields and resubmits.'},{'condition':'Controller bookkeeping fails after packet PASS','route':'Automation repairs/retries bookkeeping. Do not wake the auditor for controller failures.'}],'allowedNextStates':old.get('allowedNextStates',[]),'universalRuleIds':old.get('universalRuleIds',[])}
    if seq==7:
        new['authorization'].update({'executorType':'GITHUB_ACTIONS_AUTOMATION','independentExecutionAuthorized':False,'reviewerExecutionAuthorized':False})
        new['submissionPolicy']['packetPath']=None
        new['submissionPolicy']['controllerValidatesSchemaBeforeBookkeeping']=False
        new['sealingCriteria']=['Automation fills the Phase-7 work form from sealed Phase-6 state and creates/seals the Phase-7 marker in the same controller transaction.','No AI reviewer executes or submits Phase 7.']
    if seq==9:
        new['submissionPolicy']['skipCondition']='NO_REMEDIATION_ARTIFACTS'
        new['submissionPolicy']['skipBehavior']='Controller creates/seals a SKIPPED Phase-9 receipt without agent execution or packet submission.'
    (phase_dir/'PHASE_CONTRACT.json').write_text(json.dumps(new,indent=2)+'\n')
    start=f'# Phase {seq} — {d["title"]}\n\n'
    if d.get('automationOnly'):
        start+='> **AUTOMATION-ONLY:** no AI reviewer executes this phase. The controller fills the schema-governed automation form and creates/seals the marker from validated Phase-6 state.\n\n'
    elif seq==9:
        start+='> **CONDITIONAL:** reviewer-4 executes this phase only when remediation artifacts exist. If none exist, automation records the Phase-9 skip and routes directly to Phase 10.\n\n'
    start+=f'## Required work system\n\n- Single phase schema: [`PHASE_{seq:02d}_SCHEMA_v1.json`](PHASE_{seq:02d}_SCHEMA_v1.json)\n- Work-form template: [`PHASE_{seq:02d}_WORK_FORM_TEMPLATE_v1.json`](resources/PHASE_{seq:02d}_WORK_FORM_TEMPLATE_v1.json)\n'
    if report_rel: start+=f'- Final-report template: [`PHASE_{seq:02d}_FINAL_REPORT_TEMPLATE_v1.md`](resources/PHASE_{seq:02d}_FINAL_REPORT_TEMPLATE_v1.md)\n'
    start+='\nEvery agent action below produces substantive output data. Fill the named Step X Input section while performing that action. Do not defer documentation until phase end and do not perform controller bookkeeping.\n\n'
    for step in steps:
        start+=f'## Step {step["step"]} — {step["action"]}\n\n{step["instruction"]}\n\nRecord the complete output now in campaign document `{form_rel}`, section **{step["outputDestination"]["section"]}**, governed by `PHASE_{seq:02d}_SCHEMA_v1.json#actions.step-{step["step"]}`. Complete every required field before continuing.\n\n'
    if d.get('automationOnly'):
        start+='## Completion\n\nThe controller fills/validates the automation form and seals the marker. No agent submission occurs.\n'
    else:
        start+=f'## Phase submission\n\nAfter every Step input and the substantive final report at `{report_rel}` are complete, submit `submissions/PHASE_{seq:02d}_WORK_PACKET_v1.json` to the automation system. Do not update receipts, graph/ledger/invalidation state, Campaign Directory routing, hashes, checkpoints, handoffs, or successor state. Wait for `CONTROLLER_PHASE_PASS`. If validation fails, repair only the exact missing document/section/field and resubmit.\n'
    (phase_dir/'START_HERE.md').write_text(start)

skill=pkg/'SKILL.md'; s=skill.read_text()
banner='''\n> **STRUCTURED ACTION OUTPUT POLICY:** Every Lite agent action produces schema-governed substantive data. Each phase has exactly one schema, every action names its reference-form section, and the controller performs all bookkeeping only after the complete Phase Work Packet passes validation. See [Lite Structured Action Output and End-of-Phase Controller Policy](shared/controller/LITE_PHASE_SCHEMA_POLICY.md).\n\n'''
if 'STRUCTURED ACTION OUTPUT POLICY' not in s:
    lines=s.splitlines(True); s=''.join(lines[:1])+banner+''.join(lines[1:])
skill.write_text(s)
receipt=pkg/'shared/controller/LITE_PHASE_RECEIPT_PROTOCOL.md'; r=receipt.read_text()
if '## End-of-phase-only receipt rule' not in r:
    r+='''\n\n## End-of-phase-only receipt rule\n\nFor agent-executed Phases 1–6 and 8–10, no active-phase receipt is created or maintained by the reviewer. The reviewer works only in schema-governed substantive forms and submits the Phase Work Packet. After packet validation PASS, the controller performs the one bookkeeping transaction and creates/seals the phase receipt. The Audit Campaign Directory carries the active assignment between seals. Later reviewers do not revalidate predecessor bookkeeping. Phase 7 remains automation-only, and Phase 9 may be automation-skipped when no remediation exists.\n'''
receipt.write_text(r)
mp=pkg/'MANIFEST.json'; manifest=json.loads(mp.read_text()); entries=[]
for p in sorted(x for x in pkg.rglob('*') if x.is_file() and x.name!='MANIFEST.json'):
    b=p.read_bytes(); entries.append({'path':p.relative_to(pkg).as_posix(),'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()})
manifest['files']=entries
manifest['actionOutputPolicy']='ONE_SCHEMA_PER_PHASE_ALL_AGENT_ACTIONS_DATA_PRODUCING_END_OF_PHASE_CONTROLLER_BOOKKEEPING'
mp.write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps({'status':'PASS','package':pkg.name,'files':len(entries),'phases':len(defs)}))
