#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

function args(argv){
  const out={};
  for(let i=2;i<argv.length;i+=2){
    const k=argv[i],v=argv[i+1];
    if(!k?.startsWith('--')||v===undefined) throw new Error('arguments must be --key value');
    out[k.slice(2)]=v;
  }
  return out;
}
function read(file){return fs.readFileSync(file,'utf8');}
function json(file){return JSON.parse(read(file));}
function need(ok,msg){if(!ok) throw new Error(msg);}
function sameSet(a,b){return JSON.stringify([...a].sort())===JSON.stringify([...b].sort());}
function join(root,rel){return path.join(root,...String(rel).split('/'));}

const a=args(process.argv);
for(const k of ['controller-root','automation-root']) if(!a[k]) throw new Error('missing --'+k);
const controllerRoot=path.resolve(a['controller-root']);
const automationRoot=path.resolve(a['automation-root']);
const authorityParent=join(controllerRoot,'Audit Skill - Current Authority');
const packages=fs.readdirSync(authorityParent,{withFileTypes:true})
  .filter(e=>e.isDirectory()&&fs.existsSync(path.join(authorityParent,e.name,'SKILL.md')))
  .map(e=>path.join(authorityParent,e.name));
need(packages.length===1,'expected exactly one unpacked current Lite authority package');
const authorityRoot=packages[0];
const authorityRel=path.relative(controllerRoot,authorityRoot).split(path.sep).join('/');

const prefillSource=read(join(automationRoot,'scripts/lib/lite-phase-prefill-v1.mjs'));
const packetController=read(join(automationRoot,'scripts/lite-phase-packet-controller-v1.mjs'));
const boundaryWorkflow=read(join(automationRoot,'.github/workflows/lite-phase-work-packet-controller-v1.yml'));
const phase9ExecutionDispatch=read(join(automationRoot,'.github/workflows/lite-v7-execution-dispatch-v1.yml'));
const watchdog=read(join(automationRoot,'.github/workflows/browser-agent-watchdog.yml'));
const successorWake=read(join(automationRoot,'scripts/prepare-lite-assignment-successor-v2.mjs'));
const legacyReceiptController=read(join(automationRoot,'scripts/lite-phase-receipt-controller-v1.mjs'));
const boundaryArtifacts=read(join(automationRoot,'packages/github-native-sim/src/lite-boundary-artifacts-v1.mjs'));
const orchestrator=read(join(automationRoot,'.github/workflows/lite-audit-browser-orchestrator-v1.yml'));
const v26RequestConfig=read(join(automationRoot,'packages/github-native-sim/src/v26-request-config-v1.mjs'));
const phase6HarnessAuthoring=read(join(automationRoot,'packages/github-native-sim/src/phase6-harness-authoring-v1.mjs'));
const phase6CampaignController=read(join(automationRoot,'packages/github-native-sim/src/phase6-campaign-controller-v1.mjs'));
const foundryCoverage=read(join(automationRoot,'packages/github-native-sim/src/foundry-coverage-v1.mjs'));
const runJob=read(join(automationRoot,'packages/github-native-sim/src/run-job-file.mjs'));
const capabilityMap=read(path.join(authorityRoot,'shared/execution/CONTRACT_AUTOMATION_CAPABILITY_MAP.md'));
const technicalExecutionPlaybook=read(path.join(authorityRoot,'shared/execution/TECHNICAL_EXECUTION_REQUEST_PLAYBOOK.md'));

let stepCount=0;
const phaseSummaries=[];
for(let phase=1;phase<=10;phase++){
  const n=String(phase).padStart(2,'0');
  const phaseDir=path.join(authorityRoot,'phases','phase-'+phase);
  const contract=json(path.join(phaseDir,'PHASE_CONTRACT.json'));
  const schema=json(path.join(phaseDir,`PHASE_${n}_SCHEMA_v1.json`));
  const template=json(path.join(phaseDir,'resources',`PHASE_${n}_WORK_FORM_TEMPLATE_v1.json`));
  need(contract.phase?.sequence===phase,`phase ${phase}: contract sequence mismatch`);
  need(contract.phase?.id===`phase-${phase}`,`phase ${phase}: contract phase.id must match runtime assignment phaseId`);
  need(schema.phase===phase,`phase ${phase}: schema sequence mismatch`);
  need(template.phase===phase,`phase ${phase}: template sequence mismatch`);
  need(contract.workSchema===`phases/phase-${phase}/PHASE_${n}_SCHEMA_v1.json`,`phase ${phase}: contract workSchema mismatch`);
  need(contract.workForm===schema.workForm?.campaignPath,`phase ${phase}: work-form path mismatch`);
  need(schema.workForm?.template===`phases/phase-${phase}/resources/PHASE_${n}_WORK_FORM_TEMPLATE_v1.json`,`phase ${phase}: schema template path mismatch`);
  need((contract.finalReport??null)===(schema.finalReport?.campaignPath??null),`phase ${phase}: final-report path mismatch`);
  need((contract.submissionPolicy?.packetPath??null)===(schema.submission?.packetPath??null),`phase ${phase}: packet path mismatch`);

  const requiredArtifacts=new Set((contract.requiredOutputs??[]).filter(x=>x?.required===true).map(x=>x.artifact));
  need(requiredArtifacts.has(schema.workForm.campaignPath),`phase ${phase}: required outputs omit work form`);
  if(schema.finalReport?.campaignPath){
    need(requiredArtifacts.has(schema.finalReport.campaignPath),`phase ${phase}: required outputs omit final report`);
    const row=(contract.requiredOutputs??[]).find(x=>x.artifact===schema.finalReport.campaignPath);
    need(row?.producer==='CONTROLLER',`phase ${phase}: final report is not controller-owned`);
  }

  const schemaSteps=Object.entries(schema.actions??{});
  need((contract.steps??[]).length===schemaSteps.length,`phase ${phase}: contract/schema step count mismatch`);
  for(const [stepKey,action] of schemaSteps){
    stepCount++;
    const stepNumber=Number(stepKey.replace('step-',''));
    const c=(contract.steps??[]).find(x=>x.step===stepNumber);
    const t=template.actions?.[stepKey];
    need(Boolean(c),`phase ${phase} ${stepKey}: contract step missing`);
    need(Boolean(t),`phase ${phase} ${stepKey}: template step missing`);
    need(c.outputDestination?.document===schema.workForm.campaignPath,`phase ${phase} ${stepKey}: output document mismatch`);
    need(c.outputDestination?.section===action.section,`phase ${phase} ${stepKey}: contract/schema section mismatch`);
    need(t.section===action.section,`phase ${phase} ${stepKey}: template/schema section mismatch`);
    const schemaFields=(action.fields??[]).map(f=>f.name);
    const contractFields=c.outputDestination?.requiredFields??[];
    const templateFields=Object.keys(t.outputs??{});
    need(sameSet(schemaFields,contractFields),`phase ${phase} ${stepKey}: contract required fields mismatch`);
    need(sameSet(schemaFields,templateFields),`phase ${phase} ${stepKey}: template output fields mismatch`);
    need(c.outputDestination?.schema===`phases/phase-${phase}/PHASE_${n}_SCHEMA_v1.json#actions.${stepKey}`,`phase ${phase} ${stepKey}: schema pointer mismatch`);

    const declaredPrefills=new Set([
      ...(action.controllerPrefillFields??[]),
      ...(action.fields??[]).flatMap(f=>f.controllerPrefillFields??[]),
      ...(action.fields??[]).filter(f=>f.owner==='CONTROLLER_PREFILLED_READ_ONLY').map(f=>f.name)
    ]);
    for(const field of declaredPrefills){
      need(prefillSource.includes(field),`phase ${phase} ${stepKey}: controller-prefill field ${field} is not generated/protected by prefill automation`);
    }
  }

  for(const input of schema.controllerAutomationInputs??[]){
    need(typeof input.name==='string'&&input.name.length>0,`phase ${phase}: unnamed controllerAutomationInput`);
    need(prefillSource.includes(input.name),`phase ${phase}: controllerAutomationInput ${input.name} not produced by prefill automation`);
  }

  const contractDerived=contract.derivedOutputPolicy?.outputs??[];
  const schemaDerived=(schema.derivedOutputs??[]).map(x=>x.path);
  need(sameSet(contractDerived,schemaDerived),`phase ${phase}: contract/schema derived outputs mismatch`);
  need(packetController.includes('buildDerivedOutputs({root,campaignPath,schema,canonicalData:canonical'),`phase ${phase}: generic schema-driven derived-output generation is missing from boundary controller`);
  const expectedNextStates={
    1:['REWORK_REQUIRED','WAITING_FOR_SUCCESSOR_AGENT'],
    2:['REWORK_REQUIRED','ACTIVE'],
    3:['REWORK_REQUIRED','ACTIVE'],
    4:['REWORK_REQUIRED','ACTIVE'],
    5:['REWORK_REQUIRED','WAITING_FOR_SUCCESSOR_AGENT'],
    6:['REWORK_REQUIRED','WAITING_FOR_SUCCESSOR_AGENT'],
    7:['WAITING_FOR_SUCCESSOR_AGENT'],
    8:['REWORK_REQUIRED','ACTIVE'],
    9:['REWORK_REQUIRED','ACTIVE'],
    10:['REWORK_REQUIRED','COMPLETE']
  };
  need(sameSet(contract.allowedNextStates??[],expectedNextStates[phase]),`phase ${phase}: allowedNextStates do not match current assignment-v2 controller transitions`);
  phaseSummaries.push({phase,steps:schemaSteps.length,derivedOutputs:schemaDerived.length});
}

const phase0=json(path.join(authorityRoot,'phases/phase-0/PHASE_CONTRACT.json'));
const phase0Corpus=[
  read(join(automationRoot,'scripts/audit-source-initialization/run-v1.sh')),
  read(join(automationRoot,'scripts/audit-source-initialization/write-phase0-receipt-v1.py')),
  read(join(automationRoot,'scripts/lite-phase0-finalize-v1.mjs')),
  read(join(automationRoot,'packages/github-native-sim/src/lite-phase0-skill-outputs-v1.mjs')),
  read(join(automationRoot,'.github/workflows/lite-phase0-intelligence-v1.yml')),
  read(join(automationRoot,'.github/workflows/lite-phase0-randomized-simulation-v1.yml')),
  read(join(automationRoot,'packages/github-native-sim/src/phase0-randomized-simulation-v1.mjs')),
  read(join(automationRoot,'scripts/write-phase0-simulation-outputs-v1.mjs'))
].join('\n');
for(const row of phase0.requiredOutputs??[]){
  if(row?.required!==true) continue;
  need(phase0Corpus.includes(row.artifact),`phase 0 required output is not produced/consumed by current automation: ${row.artifact}`);
}
need(phase0.phase?.id==='phase-0','phase 0 contract phase.id must match runtime identity');
need(sameSet(phase0.allowedNextStates??[],['ACTIVE','WAITING_FOR_SUCCESSOR_AGENT']),'phase 0 allowedNextStates do not match bootstrap/finalizer routing');
need((phase0.steps??[]).length===9,'phase 0 contract must contain the nine current automated steps');
need(!String(phase0.steps?.find(x=>x.step===9)?.instruction??'').includes('creates the Phase-1 receipt'),'phase 0 step 9 still describes obsolete active Phase-1 receipt creation');
need(!/(?:set|write|transition(?:s)?\s+to|must\s+(?:enter|use)|requires?\s+(?:an?\s+)?)[^\n]{0,80}EVIDENCE_READY/i.test(String(phase0.receiptCompletionRule??'')),'phase 0 contract still requires obsolete intermediate EVIDENCE_READY state');
const phase0StartHere=read(path.join(authorityRoot,'phases/phase-0/START_HERE.md'));
need(!/set `?phase\.status`?=EVIDENCE_READY|set phase\.status=EVIDENCE_READY/i.test(phase0StartHere),'phase 0 START_HERE still instructs an EVIDENCE_READY state write');
const controllerGithubProtocol=read(path.join(authorityRoot,'shared/controller/AUDIT_CONTROLLER_AND_GITHUB_PROTOCOL.md'));
need(controllerGithubProtocol.includes('currentAssignment'),'controller/GitHub protocol does not route assignment-v2 reviewer work from currentAssignment');
need(!/read its `currentReceiptPath`[\s\S]{0,200}execute only the phase authorized by the receipt/i.test(controllerGithubProtocol),'controller/GitHub protocol still routes reviewer work from active receipts');
const schemaPolicy=read(path.join(authorityRoot,'shared/controller/LITE_PHASE_SCHEMA_POLICY.md'));

need(!/"auditControllerRef"\s*:\s*"main"/.test(schemaPolicy),'schema policy hardcodes auditControllerRef=main in reviewer validation request');

const phase0Simulation=read(join(automationRoot,'packages/github-native-sim/src/phase0-randomized-simulation-v1.mjs'));
const phase0SimulationWorkflow=read(join(automationRoot,'.github/workflows/lite-phase0-randomized-simulation-v1.yml'));
const phase0Projector=read(join(automationRoot,'scripts/write-phase0-simulation-outputs-v1.mjs'));
const phase0Bootstrap=read(join(automationRoot,'.github/workflows/lite-phase0-bootstrap-v1.yml'));
need(phase0Simulation.includes('PHASE0_MEDUSA_CALL_LIMIT_V1=125000'),'Phase 0 Medusa configured call limit is not 125000');
need(phase0Simulation.includes('PHASE0_MEDUSA_MIN_CALLS_V1=100001'),'Phase 0 Medusa >100K minimum is missing');
need(phase0Simulation.includes('PHASE0_ACCOUNTING_ACTION_WEIGHT_V1=0.80'),'Phase 0 accounting/state-changing action weight is not 80%');
need(phase0Simulation.includes('abiGenerated:true')&&phase0Simulation.includes('rawRandomBytes:false'),'Phase 0 randomized calls are not explicitly ABI-generated');
need(phase0Simulation.includes('buildBurstSchedule')&&phase0Simulation.includes('previous'),'Phase 0 telemetry lacks cross-contract burst interleaving');
need(phase0Simulation.includes('beforeAccounting')&&phase0Simulation.includes('afterAccounting')&&phase0Simulation.includes('accountingDeltas'),'Phase 0 raw telemetry lacks pre/post accounting evidence');
need(phase0Simulation.includes('RAW_SIMULATION_TRANSCRIPT_v1.jsonl'),'Phase 0 raw per-run transcript is missing');
need(phase0Simulation.includes('forkModeEnabled:true')&&phase0Simulation.includes('rpcUrl:anvilUrl'),'Medusa is not forked from the Anvil RPC state');
need(phase0Simulation.includes('ALL_EVM_PACKAGES_USE_CANONICAL_ETHEREUM_ANVIL_BASELINE'),'Phase 0 does not normalize all EVM packages onto the canonical Ethereum Anvil baseline');
need(!phase0Simulation.includes("if(targetChainIds.some(id=>id!==1))"),'Phase 0 still suppresses randomized execution for non-Ethereum EVM target chain IDs');
need(phase0Simulation.includes('DEPLOYMENT_SCRIPT_NOT_SAFELY_REDIRECTABLE'),'deployment-script adapter does not preserve typed unsafe-binding limitations');
need(phase0SimulationWorkflow.includes('SIM_ARCHIVE_PRIMARY_ETHEREUM_01'),'Phase 0 simulation workflow is not bound to the canonical Ethereum fork RPC');
need(phase0Bootstrap.includes('needs: randomized-simulation'),'Phase 0 finalization is not gated on randomized simulation');
need(phase0Projector.includes('PHASE5_SIMULATION_BASELINE_INPUT_v1.json')&&phase0Projector.includes('PHASE6_SIMULATION_BASELINE_INPUT_v1.json'),'Phase 0 simulation evidence is not projected into Phase 5 and 6 canonical inputs');
need(prefillSource.includes('phase0BaselineSimulation')&&prefillSource.includes('phase0BaselineTargetDispositions'),'Phase 5/6 controller prefill does not consume Phase 0 simulation inputs');
need(packetController.includes('baselineMatrixRows'),'Phase 5 boundary does not preserve Phase 0 baseline rows in the Phase 6 target matrix');

need(boundaryWorkflow.includes(".agent-upload/lite-phase-boundary/*.json"),'phase-boundary controller lacks an agent-operable request trigger');
need(boundaryWorkflow.includes('curveyield-lite-phase-boundary-request-v1'),'phase-boundary controller does not validate the request schema');
need(boundaryWorkflow.includes('Resolve canonical campaign routing'),'phase-boundary controller does not derive canonical campaign routing');
need(boundaryWorkflow.includes('--campaign-id'),'phase-boundary workflow does not bind campaign ID into controller validation');
need(packetController.includes("directory.campaignId!==expectedCampaignId"),'packet controller does not reject campaign-ID mismatch');
need(packetController.includes("directory.workspacePath!==campaignPath"),'packet controller does not reject campaign-path mismatch');

need(packetController.includes("const p7=derived(7,'PHASE8_MARKER_INPUT_v1.json')"),'Phase 7 marker output is not routed toward Phase 8');
need(/target===8[^\n]*\[[^\]]*p7/.test(packetController),'Phase 8 derived-input routing omits Phase 7 marker');
need(packetController.includes("const p8Final=derived(8,'PHASE10_INPUT_v1.json')"),'Phase 8 Phase10 view is not represented in routing');
need(packetController.includes("const p9Final=derived(9,'PHASE10_REMEDIATION_INPUT_v1.json')"),'Phase 9 Phase10 remediation view is not represented in routing');
need(/target===10[^\n]*\[[^\]]*p8Final[^\]]*p9Final[^\]]*finalIndex/.test(packetController),'Phase 10 routing omits produced Phase8/9 views or final index');

need(!/packet_status.*SUBMITTED[\s\S]{0,500}lite-phase-work-packet-controller-v1\.yml/.test(watchdog),'watchdog still contains circular SUBMITTED-packet validation dispatch');
need(successorWake.includes('.agent-upload/lite-phase-boundary/'),'fresh reviewer wake omits controller-validation request path');
need(successorWake.includes('curveyield-lite-phase-boundary-request-v1'),'fresh reviewer wake omits controller-validation request schema');
need(successorWake.includes("'audit-controller-ref'"),'fresh reviewer wake generator does not require exact Audit-Controller ref');
need(successorWake.includes("controllerRef=a['audit-controller-ref']"),'fresh reviewer wake generator does not bind URLs/request schema to exact Audit-Controller ref');
need(!successorWake.includes('auditControllerRef":"main'),'fresh reviewer wake hardcodes auditControllerRef=main');
need(orchestrator.includes('--audit-controller-ref "$AUDIT_CONTROLLER_REF"'),'Lite orchestrator does not pass exact Audit-Controller ref to successor wake generator');
need(legacyReceiptController.includes("legacy receipt controller is prohibited for current assignment-v2 Lite campaigns"),'legacy receipt controller is not fenced off from current assignment-v2 campaigns');
need(phase9ExecutionDispatch.includes(".agent-upload/lite-v7-execution/*.json"),'Phase 9 V7 execution lacks a connector-operable request-file trigger');
need(phase9ExecutionDispatch.includes('curveyield-lite-v7-execution-dispatch-v1'),'Phase 9 V7 execution trigger does not validate its dispatch schema');
need(phase9ExecutionDispatch.includes('.currentAssignment.phaseSequence')&&phase9ExecutionDispatch.includes('= "9"'),'Phase 9 V7 execution trigger does not bind dispatch to current Phase-9 assignment');
need(phase9ExecutionDispatch.includes('gh workflow run audit-controller-execution.yml'),'Phase 9 V7 execution trigger does not launch the qualified V7 execution lane');
need(phase9ExecutionDispatch.includes('controller_writeback_ref'),'Phase 9 V7 execution trigger does not bind durable evidence writeback');
const phase9StartHere=read(path.join(authorityRoot,'phases/phase-9/START_HERE.md'));
need(phase9StartHere.includes('curveyield-lite-v7-execution-dispatch-v1'),'Phase 9 instructions do not expose the connector-operable V7 execution dispatch');
need(schemaPolicy.includes('curveyield-lite-v7-execution-dispatch-v1'),'shared schema policy does not define the Phase-9 V7 execution dispatch contract');

const phase4Schema=json(path.join(authorityRoot,'phases','phase-4','PHASE_04_SCHEMA_v1.json'));
const phase4CoverageDecl=(phase4Schema.controllerGeneratedOutputs??[]).find(x=>x.path==='automationOutputs.phase4Coverage');
need(sameSet(phase4CoverageDecl?.consumers??[],['phase-5']),'Phase 4 coverage declares a downstream consumer that current routing does not supply');

const phase5Schema=json(path.join(authorityRoot,'phases','phase-5','PHASE_05_SCHEMA_v1.json'));
const reproductionAllowed=phase5Schema.actions?.['step-3']?.fields?.find(f=>f.name==='targetDesigns')?.itemFieldAllowedValues?.reproductionType??[];
need(sameSet(reproductionAllowed,['FOUNDRY_TEST','MEDUSA_PROPERTY','ANVIL_WORKFLOW','NOT_APPLICABLE']),'Phase 5 reproductionType values must match literal candidate-reproduction adapters');
for(const type of ['FOUNDRY_TEST','MEDUSA_PROPERTY','ANVIL_WORKFLOW']){
  need(v26RequestConfig.includes(type),'V26 request configuration does not literally support Phase 5 reproductionType '+type);
  need(boundaryArtifacts.includes(type),'Phase-5 boundary automation does not literally bind/execute reproductionType '+type);
}
need(runJob.includes("command: 'forge'")&&runJob.includes("'--fuzz-runs'"),'literal Foundry fuzz execution path missing');
need(runJob.includes('executeMedusa')&&runJob.includes('runMedusaAnalysis'),'literal Medusa execution path missing');
need(runJob.includes('executePhase7Simulation')&&runJob.includes("engine?.engine !== 'anvil'"),'literal Anvil lifecycle execution path missing');
for(const campaign of ['discovery','property','targeted']){
  need(phase6HarnessAuthoring.includes(campaign+':'),'Phase-6 harness initializer missing literal Medusa campaign '+campaign);
}
for(const skeleton of ['Phase6StatefulHandler_v2.sol.template','Phase6BoundaryFuzz_v2.t.sol.template','Phase6DifferentialFuzz_v2.t.sol.template','Phase6GhostModel_v2.sol.template']){
  need(phase6HarnessAuthoring.includes(skeleton),'Phase-6 harness bundle omits shipped Foundry capability '+skeleton);
}
for(const campaignClass of ['stateful','boundary-dictionary','multi-actor','ghost-reference','differential','deep-escalation']){
  need(phase6CampaignController.includes("'"+campaignClass+"'"),'Phase-6 campaign controller missing declared campaign class '+campaignClass);
}
need(foundryCoverage.includes("command:'forge'")&&foundryCoverage.includes("args:['coverage'"),'Foundry coverage execution path missing');

const capabilityExpectations=[
  ['Medusa fuzz/property execution','DIRECT'],
  ['Medusa discovery/property/targeted campaigns','HARNESS_BACKED'],
  ['Stateful invariant / multi-actor testing','HARNESS_BACKED'],
  ['Boundary/dictionary-directed fuzzing','HARNESS_BACKED'],
  ['Differential/reference testing','HARNESS_BACKED'],
  ['Ghost/reference-model testing','HARNESS_BACKED'],
  ['Corpus-driven Medusa testing','HARNESS_BACKED'],
  ['Foundry coverage and refinement','DIRECT'],
  ['Deep escalation','PLAN_ORCHESTRATED'],
  ['Broad/stateful random discovery','HARNESS_BACKED'],
  ['Chaos testing','NO_FIRST_CLASS_ADAPTER'],
  ['Mutation testing','NO_FIRST_CLASS_ADAPTER'],
  ['Exhaustive known-attack testing','NO_FIRST_CLASS_ADAPTER'],
  ['Coverage-guided closure','PLAN_ORCHESTRATED']
];
for(const [capability,status] of capabilityExpectations){
  need(capabilityMap.includes('| '+capability+' | '+status+' |'),'capability map support status mismatch for '+capability);
}
need(!/not valid Lite request types/i.test(technicalExecutionPlaybook),'technical execution playbook still contains a Lite execution-type prohibition');

const phase7Contract=json(path.join(authorityRoot,'phases/phase-7/PHASE_CONTRACT.json'));
need(phase7Contract.authorization?.controllerBoundCurrentPhaseRequired===false,'Phase 7 automation marker incorrectly requires Phase 7 to be the current assigned phase');
need(phase7Contract.authorization?.controllerBoundPredecessorPhase6Required===true,'Phase 7 automation marker is not explicitly bound to accepted Phase 6');
need(phase7Contract.submissionPolicy?.packetPath===null,'Phase 7 automation marker must not have a packet path');
need(phase7Contract.recoveryRoutes?.every(r=>!/reviewer repairs|resubmit/i.test(String(r.route??''))),'Phase 7 automation-only recovery still instructs reviewer rework');

const phase9Contract=json(path.join(authorityRoot,'phases/phase-9/PHASE_CONTRACT.json'));
need(phase9Contract.authorization?.entryCondition==='REMEDIATION_ARTIFACTS_EXIST','Phase 9 contract entry condition mismatch');
need((phase9Contract.requiredOutputs??[]).every(x=>x.condition==='REMEDIATION_ARTIFACTS_EXIST'),'Phase 9 reviewer outputs must be conditional on remediation artifacts');
need(phase9Contract.derivedOutputPolicy?.condition==='REMEDIATION_ARTIFACTS_EXIST','Phase 9 remediation-derived output must be conditional on execution');
need(phase9Contract.skipOutputs?.condition==='NO_REMEDIATION_ARTIFACTS','Phase 9 skip-output contract is missing');
need(phase9Contract.skipOutputs?.reviewerWorkFormRequired===false&&phase9Contract.skipOutputs?.finalReportRequired===false,'Phase 9 skip branch incorrectly requires reviewer outputs');
need(packetController.includes("status:'SKIPPED'")&&packetController.includes("action:'SKIPPED_NO_REMEDIATION'"),'Phase 9 no-remediation skip contract is not implemented by packet controller');

const prohibitedExecutionTerms=/Medusa|random discovery|stateful random|chaos|mutation|differential\/reference|differential testing|reference testing|corpus\/deep|corpus testing|deep testing|exhaustive known-attack|coverage-(?:closure|guided)/i;
const authorityProhibitionHits=[];
function isActiveProhibition(line){
  const lower=line.toLowerCase();
  if(/not prohibited|not forbidden|not disallowed|does not prohibit|is not a .*prohibition/.test(lower)) return false;
  return /\b(?:do not|must not|never|forbidden|disallowed|not allowed|not valid|may not|cannot|can't|not request|not execute|not run)\b/i.test(line)
    || (/\bprohibit(?:ed|s)?\b/i.test(line)&&!/\bnot prohibited\b/i.test(line));
}
function scanAuthority(dir){
  for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
    const file=path.join(dir,ent.name);
    if(ent.isDirectory()){scanAuthority(file);continue;}
    if(!ent.isFile()||!/\.(?:md|json|txt|ya?ml)$/i.test(ent.name)) continue;
    read(file).split(/\r?\n/).forEach((line,index)=>{
      if(prohibitedExecutionTerms.test(line)&&isActiveProhibition(line)){
        authorityProhibitionHits.push(path.relative(authorityRoot,file).split(path.sep).join('/')+':'+(index+1)+': '+line.trim());
      }
    });
  }
}
scanAuthority(authorityRoot);
need(authorityProhibitionHits.length===0,'Lite authority still contains execution prohibitions: '+authorityProhibitionHits.join(' | '));

process.stdout.write(JSON.stringify({
  status:'PASS',
  authorityRoot:authorityRel,
  phasesValidated:11,
  agentStepsValidated:stepCount,
  phaseSummaries,
  checks:[
    'runtime phase identity and assignment-v2 next-state alignment',
    'phase contract/schema/template field and section identity',
    'controller-prefill declarations versus automation production/protection',
    'derived-output declarations versus controller generation/routing',
    'Phase-0 required outputs/state transitions versus current automation producers/finalizer',
    'Phase-0 Anvil deployment simulation, universal EVM normalization, >100K Medusa baseline, ABI telemetry and raw transcript contract',
    'Phase-0 simulation projection into Phase 5 design and Phase 6 interpretation',
    'assignment-v2 campaign discovery versus shared controller protocol',
    'agent-operable controller-validation trigger and canonical routing',
    'assignment-v2/legacy-controller separation',
    'connector-operable Phase-9 rerun execution and durable evidence ingestion dispatch',
    'controller-generated output consumer declarations versus actual downstream routing',
    'literal Phase-5 adapter and harness capability alignment',
    'capability permission versus implementation-status accuracy',
    'exact Audit-Controller ref propagation into successor wakes',
    'automation-only Phase-7 transaction semantics',
    'conditional Phase-9 execute-versus-skip output contract',
    'full-authority scan for Lite execution capability prohibitions'
  ]
},null,2)+'\n');
