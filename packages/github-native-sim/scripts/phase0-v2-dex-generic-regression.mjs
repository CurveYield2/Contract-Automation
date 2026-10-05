#!/usr/bin/env node
import fs from 'node:fs/promises';
import fss from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import * as ethers from 'ethers';
import {stageExactArchiveSource,runProcess} from '../src/execution.mjs';
import {buildProject} from '../../runner/src/build-dispatch.mjs';
import {buildExecutionArtifactBundleV2,validateExecutionInputJoinV2} from '../src/phase0-execution-input-v2.mjs';
import {generateTypedValueV2} from '../src/phase0-execution-contract-v2.mjs';
import {medusaWrappers,targetObjects} from '../src/phase0-randomized-simulation-v1.mjs';

const controllerRoot=path.resolve(process.argv[2]??'');
const outRoot=path.resolve(process.argv[3]??'.audit-evidence/phase0-v2-dex-regression');
const pinnedEvidenceCommit='78943917711d0c56ebedd2ddc4ec267d1b1efc89';
const campaignRel='campaigns/CurveYield DEX v16 Source r3';
const campaignRoot=path.join(controllerRoot,...campaignRel.split('/'));
const assertThat=(v,m)=>{if(!v)throw new Error('PHASE0_V2_DEX_REGRESSION: '+m);};
const read=async rel=>JSON.parse(await fs.readFile(path.join(campaignRoot,...rel.split('/')),'utf8'));
const sha256=value=>createHash('sha256').update(value).digest('hex');

await fs.rm(outRoot,{recursive:true,force:true});await fs.mkdir(outRoot,{recursive:true});
const observedCommit=execFileSync('git',['-C',controllerRoot,'rev-parse','HEAD'],{encoding:'utf8'}).trim();
assertThat(observedCommit===pinnedEvidenceCommit,'controller regression checkout is not the pinned reviewed evidence commit');

const receipt=await read('receipts/PHASE_00_RECEIPT_v1.json');
const legacyBuild=await read('evidence/build/BUILD_AND_SOURCE_IDENTITY_v1.json');
const sourceIntelligence=await read('evidence/source-intelligence/SOURCE_INTELLIGENCE_AUTOMATED_v1.json');
const slither=await read('evidence/static-analysis/SLITHER_v1.json');
const readiness=await read('evidence/readiness/PROJECT_READINESS_AUTOMATED_v1.json');
const legacyPhase0=await read('evidence/phase0/PHASE0_RANDOMIZED_SIMULATION_SUMMARY_v1.json');
const deployEvidence=await read('evidence/phase0/PHASE0_DEPLOY_CONFIG_EXECUTION_v1.json');

const staged=await stageExactArchiveSource({
  checkoutRoot:controllerRoot,
  workspaceRoot:path.join(outRoot,'workspace'),
  archivePath:receipt.source.archivePath,
  archiveSha256:receipt.source.sha256,
  projectPath:legacyBuild.discovery.projectPath
});
const install=await runProcess({command:'timeout',args:['300s','npm','ci','--ignore-scripts','--audit=false','--fund=false'],cwd:staged.projectRoot,env:process.env});
assertThat(install.exitCode===0,'locked DEX qualification dependency install failed');

const requestIdentityBody={
  campaignId:receipt.campaign.campaignId,
  campaignGenerationId:receipt.campaign.campaignGenerationId,
  sourceSha256:receipt.source.sha256,
  sourceCommit:receipt.source.archiveCommit,
  projectPath:legacyBuild.discovery.projectPath,
  configuration:legacyBuild.configurationDetection
};
const request={
  requestId:'phase0-v2-dex-r3-regression',
  requestDigest:sha256(Buffer.from(JSON.stringify(requestIdentityBody))),
  campaignId:receipt.campaign.campaignId,
  campaignGenerationId:receipt.campaign.campaignGenerationId,
  assignmentId:'phase0-v2-regression',
  phaseId:'phase-0',
  profileId:'github-native-compile-v2',
  source:{
    repository:'CurveYield2/Audit-Controller',
    commit:receipt.source.archiveCommit,
    projectPath:legacyBuild.discovery.projectPath,
    archivePath:receipt.source.archivePath,
    archiveSha256:receipt.source.sha256
  },
  configuration:{
    compilers:[{language:'solidity',version:legacyBuild.configurationDetection.compilerVersion}],
    optimizer:legacyBuild.configurationDetection.optimizer,
    evmVersion:legacyBuild.configurationDetection.evmVersion,
    viaIR:legacyBuild.configurationDetection.viaIR
  }
};
const build=await buildProject({projectRoot:staged.projectRoot,request});
assertThat(build.status==='completed','regenerated DEX executable build did not complete');
const artifactBundle=buildExecutionArtifactBundleV2({request,build});
const isolatedBuildIdentity=structuredClone(legacyBuild);
isolatedBuildIdentity.campaignId=receipt.campaign.campaignId;
isolatedBuildIdentity.campaignGenerationId=receipt.campaign.campaignGenerationId;
isolatedBuildIdentity.build={
  ...legacyBuild.build,
  status:'completed',
  system:build.system,
  compilerVersion:build.compilerVersion,
  compilerVersions:build.compilerVersions??[],
  compilerProfiles:build.compilerProfiles??[],
  compilationUnitCount:build.compilationUnits?.length??0,
  compilationUnits:artifactBundle.buildIdentity.compilationUnits,
  artifactCount:build.artifacts?.length??0,
  buildConfigurationDigestSha256:artifactBundle.buildConfigurationDigestSha256
};
const joined=validateExecutionInputJoinV2({receipt,buildIdentity:isolatedBuildIdentity,artifactBundle,sourceIntelligence,slither,readiness});
assertThat(joined.status==='PASS'&&joined.executionPreparation.secondBuildPerformed===false,'DEX shared execution inputs did not bind cleanly');

const legacyRows=[],legacyRunSummaries=[];
for(let i=1;i<=4;i++){
  const id='abi-telemetry-'+String(i).padStart(3,'0');
  const runDir=path.join(campaignRoot,'evidence/phase0/simulations/runs',id);
  const summary=JSON.parse(await fs.readFile(path.join(runDir,'RUN_SUMMARY_v1.json'),'utf8'));legacyRunSummaries.push(summary);
  const text=await fs.readFile(path.join(runDir,'RAW_SIMULATION_TRANSCRIPT_v1.jsonl'),'utf8');
  for(const line of text.trim().split(/\r?\n/).filter(Boolean))legacyRows.push(JSON.parse(line));
}
assertThat(legacyRows.length===4800,'legacy DEX raw attempt count changed');
const classification={minedSuccess:0,minedRevert:0,preflightOrSubmissionRejection:0,argumentGenerationLimitation:0,otherError:0,unknown:0};
const successfulRows=[];
for(const row of legacyRows){
  if(row.transaction){
    if(Number(row.transaction.status)===1){classification.minedSuccess++;successfulRows.push(row);}
    else if(Number(row.transaction.status)===0)classification.minedRevert++;
    else classification.unknown++;
  }else if(row.error?.name==='ABI_ARGUMENT_GENERATION_LIMITATION')classification.argumentGenerationLimitation++;
  else if(row.error)classification.preflightOrSubmissionRejection++;
  else classification.unknown++;
}
assertThat(classification.minedSuccess===133,'legacy DEX mined-success interpretation changed');
assertThat(classification.preflightOrSubmissionRejection===4667,'legacy DEX rejection interpretation changed');
assertThat(classification.minedRevert===0,'legacy DEX rejected rows were incorrectly promoted to mined reverts');
assertThat(classification.argumentGenerationLimitation===0&&classification.otherError===0&&classification.unknown===0,'legacy DEX terminal partition is not exact');

const legacySuccessFamilies={ownershipRequest:0,hookCall:0,emptyMulticall:0,other:0};
for(const row of successfulRows){
  const sig=String(row.functionSignature??'');
  if(/owner|ownership/i.test(sig))legacySuccessFamilies.ownershipRequest++;
  else if(/hook/i.test(sig))legacySuccessFamilies.hookCall++;
  else if(/multicall/i.test(sig)&&Array.isArray(row.decodedInputs?.[0])&&row.decodedInputs[0].length===0)legacySuccessFamilies.emptyMulticall++;
  else legacySuccessFamilies.other++;
}
assertThat(legacySuccessFamilies.ownershipRequest===119&&legacySuccessFamilies.hookCall===10&&legacySuccessFamilies.emptyMulticall===4&&legacySuccessFamilies.other===0,'legacy DEX successful-row interpretation changed');

const legacyMedusa=legacyPhase0.medusa??{};
assertThat(Number(legacyMedusa.observedCalls)===138521,'legacy DEX Medusa call count changed');
const legacyPropertyAssurance=false;

const tupleTargets=[],tupleRows=[];
let addressCounter=1;
for(const artifact of artifactBundle.artifacts??[]){
  const iface=new ethers.Interface(artifact.abi);
  const functions=[];
  for(const fragment of iface.fragments.filter(x=>x.type==='function')){
    const hasTuple=(fragment.inputs??[]).some(param=>param.baseType==='tuple'||(param.baseType==='array'&&param.arrayChildren?.baseType==='tuple'));
    if(!hasTuple)continue;
    const signature=fragment.format('sighash');
    const rng=(()=>{let n=0;return()=>((++n%97)+1)/100;})();
    const generated=(fragment.inputs??[]).map(param=>generateTypedValueV2(param,rng,{addresses:['0x0000000000000000000000000000000000000001','0x0000000000000000000000000000000000000002']}));
    assertThat(generated.every(x=>!x.limitation),'current recursive ABI generator rejected a DEX tuple input '+artifact.qualifiedName+' '+signature);
    functions.push({fragment,signature,accounting:false,semanticFamily:'UNKNOWN',semanticBasis:'DEX_GENERIC_REGRESSION'});
    tupleRows.push({qualifiedName:artifact.qualifiedName,signature});
  }
  if(functions.length)tupleTargets.push({qualifiedName:artifact.qualifiedName,address:'0x'+String(addressCounter++).padStart(40,'0'),artifact,functions,recipe:{status:'ORACLE_GAP'}});
}
assertThat(tupleRows.length>0,'unchanged DEX packet exposed no tuple-input functions for regression');
const tuplePlan=medusaWrappers(ethers,tupleTargets);
const routed=new Set(tuplePlan.rows.map(x=>x.target.qualifiedName+'::'+x.selected.signature));
for(const row of tupleRows)assertThat(routed.has(row.qualifiedName+'::'+row.signature),'current Medusa router still omits supported tuple input '+row.qualifiedName+' '+row.signature);

const genericTargets=targetObjects(ethers,artifactBundle.artifacts,deployEvidence.deployedContracts??[],sourceIntelligence);
const semanticGaps=genericTargets.filter(t=>t.recipe?.status==='ORACLE_GAP').map(t=>({qualifiedName:t.qualifiedName,address:t.address,contextType:t.contextType??'DIRECT',reason:t.recipe?.reason??'NO_TRUSTED_SEMANTIC_RECIPE'}));
assertThat(semanticGaps.length>0,'DEX regression unexpectedly invented semantic recipes for every target');
for(const target of genericTargets.filter(t=>t.recipe?.status==='ORACLE_GAP')){
  assertThat(target.functions.every(fn=>fn.semanticFamily!=='ECONOMIC'),'DEX oracle-gap target was promoted to ECONOMIC by name');
}

const attempts=deployEvidence.attempts??[];
const gaps=deployEvidence.gaps??[];
assertThat(attempts.some(x=>x.status==='PASS'),'sealed DEX deployment evidence lost successful script variant');
assertThat(attempts.some(x=>x.status==='FAILED')||gaps.length>0,'sealed DEX deployment evidence lost failed/unsupported variant');

const result={
  schemaVersion:'curveyield-phase0-v2-dex-generic-regression-v1',
  status:'PASS',
  source:{controllerEvidenceCommit:pinnedEvidenceCommit,archiveCommit:receipt.source.archiveCommit,archivePath:receipt.source.archivePath,archiveSha256:receipt.source.sha256,observedArchiveSha256:staged.archiveSha256},
  build:{system:build.system,artifactCount:artifactBundle.artifacts.length,compilationUnitCount:artifactBundle.buildIdentity.compilationUnits.length,artifactSetDigestSha256:artifactBundle.artifactSetDigestSha256,buildConfigurationDigestSha256:artifactBundle.buildConfigurationDigestSha256,sharedInputJoinStatus:joined.status},
  legacyInterpretation:{attempts:legacyRows.length,...classification,successFamilies:legacySuccessFamilies,medusaObservedCalls:legacyMedusa.observedCalls,legacyPropertyAssurance},
  genericRegression:{tupleFunctionCount:tupleRows.length,tupleFunctionsRouted:tupleRows.length,semanticGapCount:semanticGaps.length,semanticGaps,qualifiedGenericRecipeCount:genericTargets.filter(t=>t.recipe?.status==='QUALIFIED').length,deploymentPassVariants:attempts.filter(x=>x.status==='PASS').length,deploymentFailedVariants:attempts.filter(x=>x.status==='FAILED').length,deploymentGapCount:gaps.length},
  limitations:[
    {type:'PROTOCOL_SPECIFIC_SEMANTICS_NOT_GENERICALLY_QUALIFIED',disposition:'TYPED_ORACLE_REACHABILITY_GAPS',count:semanticGaps.length},
    {type:'LEGACY_MEDUSA_NO_TARGET_PROPERTY_ASSURANCE',observedCalls:legacyMedusa.observedCalls}
  ],
  campaignMutation:false,
  productionSpecialCasesAdded:false,
  workflowRunId:process.env.GITHUB_RUN_ID??null,
  qualifiedCommit:process.env.GITHUB_SHA??null
};
await fs.writeFile(path.join(outRoot,'PHASE0_V2_DEX_GENERIC_REGRESSION_v1.json'),JSON.stringify(result,null,2)+'\n');
process.stdout.write(JSON.stringify({status:'PASS',legacyAttempts:legacyRows.length,legacyMinedSuccess:classification.minedSuccess,legacyRejections:classification.preflightOrSubmissionRejection,tupleFunctionsRouted:tupleRows.length,semanticGaps:semanticGaps.length},null,2)+'\n');
