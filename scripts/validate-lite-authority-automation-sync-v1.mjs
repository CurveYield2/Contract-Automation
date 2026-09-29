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
const watchdog=read(join(automationRoot,'.github/workflows/browser-agent-watchdog.yml'));
const successorWake=read(join(automationRoot,'scripts/prepare-lite-assignment-successor-v2.mjs'));
const legacyReceiptController=read(join(automationRoot,'scripts/lite-phase-receipt-controller-v1.mjs'));
const boundaryArtifacts=read(join(automationRoot,'packages/github-native-sim/src/lite-boundary-artifacts-v1.mjs'));
const capabilityMap=read(path.join(authorityRoot,'shared/execution/CONTRACT_AUTOMATION_CAPABILITY_MAP.md'));

let stepCount=0;
const phaseSummaries=[];
for(let phase=1;phase<=10;phase++){
  const n=String(phase).padStart(2,'0');
  const phaseDir=path.join(authorityRoot,'phases','phase-'+phase);
  const contract=json(path.join(phaseDir,'PHASE_CONTRACT.json'));
  const schema=json(path.join(phaseDir,`PHASE_${n}_SCHEMA_v1.json`));
  const template=json(path.join(phaseDir,'resources',`PHASE_${n}_WORK_FORM_TEMPLATE_v1.json`));
  need(contract.phase?.sequence===phase,`phase ${phase}: contract sequence mismatch`);
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
  phaseSummaries.push({phase,steps:schemaSteps.length,derivedOutputs:schemaDerived.length});
}

const phase0=json(path.join(authorityRoot,'phases/phase-0/PHASE_CONTRACT.json'));
const phase0Corpus=[
  read(join(automationRoot,'scripts/audit-source-initialization/run-v1.sh')),
  read(join(automationRoot,'scripts/audit-source-initialization/write-phase0-receipt-v1.py')),
  read(join(automationRoot,'scripts/lite-phase0-finalize-v1.mjs')),
  read(join(automationRoot,'packages/github-native-sim/src/lite-phase0-skill-outputs-v1.mjs')),
  read(join(automationRoot,'.github/workflows/lite-phase0-intelligence-v1.yml'))
].join('\n');
for(const row of phase0.requiredOutputs??[]){
  if(row?.required!==true) continue;
  need(phase0Corpus.includes(row.artifact),`phase 0 required output is not produced/consumed by current automation: ${row.artifact}`);
}
need(!String(phase0.steps?.find(x=>x.step===8)?.instruction??'').includes('creates the Phase-1 receipt'),'phase 0 step 8 still describes obsolete active Phase-1 receipt creation');

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
need(legacyReceiptController.includes("legacy receipt controller is prohibited for current assignment-v2 Lite campaigns"),'legacy receipt controller is not fenced off from current assignment-v2 campaigns');

const phase5Schema=json(path.join(authorityRoot,'phases','phase-5','PHASE_05_SCHEMA_v1.json'));
const phase5Text=JSON.stringify(phase5Schema);
if(phase5Text.includes('MEDUSA_PROPERTY')){
  need(boundaryArtifacts.includes('MEDUSA_PROPERTY'),'authority allows MEDUSA_PROPERTY but boundary automation does not support it');
}
const permittedLiteCapabilities=[
  'Medusa fuzz/property execution',
  'Broad/stateful random discovery',
  'Chaos testing',
  'Mutation testing',
  'Differential/reference testing',
  'Corpus/deep testing',
  'Exhaustive known-attack testing',
  'Coverage-closure testing'
];
for(const capability of permittedLiteCapabilities){
  need(capabilityMap.includes('| '+capability+' |'),'capability map must explicitly include permitted Lite capability: '+capability);
}
const prohibitedCapabilityLine=capabilityMap.split(/\r?\n/).find(line=>
  /^(?:Do not|Never|Must not|Forbidden|Prohibited)/i.test(line.trim()) &&
  /Medusa|random discovery|chaos|mutation|differential|corpus|exhaustive known-attack|coverage-closure/i.test(line)
);
need(!prohibitedCapabilityLine,'capability map contains a Lite execution prohibition: '+prohibitedCapabilityLine);

const prohibitedExecutionTerms=/Medusa|random discovery|stateful random|chaos|mutation|differential\/reference|differential testing|reference testing|corpus\/deep|corpus testing|deep testing|exhaustive known-attack|coverage-closure/i;
const prohibitionLanguage=/\b(?:do not|must not|never|forbid(?:den|s)?|prohibit(?:ed|s)?|disallow(?:ed|s)?|not request|not execute|not run)\b/i;
const authorityProhibitionHits=[];
function scanAuthority(dir){
  for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
    const file=path.join(dir,ent.name);
    if(ent.isDirectory()){scanAuthority(file);continue;}
    if(!ent.isFile()||!/\.(?:md|json|txt|ya?ml)$/i.test(ent.name)) continue;
    read(file).split(/\r?\n/).forEach((line,index)=>{
      if(prohibitedExecutionTerms.test(line)&&prohibitionLanguage.test(line)){
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
    'phase contract/schema/template field and section identity',
    'controller-prefill declarations versus automation production/protection',
    'derived-output declarations versus controller generation/routing',
    'Phase-0 required outputs versus current automation producers/consumers',
    'agent-operable controller-validation trigger and canonical routing',
    'assignment-v2/legacy-controller separation',
    'retained targeted execution capability alignment'
  ]
},null,2)+'\n');
