import { digestCanonicalV1 } from './canonical-json-v1.mjs';
import { generateBuildSbomV1 } from './sbom-v1.mjs';
import { createPhase6CampaignPlanV1, recordPhase6CampaignV1, evaluatePhase6CampaignPlanV1 } from './phase6-campaign-controller-v1.mjs';
import { runFoundryCoverageV1, evaluateFoundryCoverageObligationsV1, buildFoundryCampaignReceiptV1 } from './foundry-coverage-v1.mjs';

export function stripV26RequestExtensionV1(request){
  const legacy=structuredClone(request);
  if(legacy.configuration) delete legacy.configuration.v26;
  return legacy;
}

function medusaTerminal(component){
  if(component?.failureKind==='PROPERTY_FALSIFICATION') return 'PROPERTY_FALSIFICATION';
  if(component?.failureKind==='NO_TESTS_DISCOVERED') return 'NO_TESTS_DISCOVERED';
  if(component?.componentStatus==='COMPLETED') return 'COMPLETED';
  if(component?.componentStatus==='COMPLETED_WITH_FAILURES') return 'COMPLETED_WITH_FAILURES';
  return 'FAILED';
}
function metric(component,name){
  const campaign=component?.campaign??{};
  const status=campaign.metricAvailability?.[name]??(campaign[name]&&Object.keys(campaign[name]).length?'PRESENT':'UNAVAILABLE_FROM_OUTPUT_MODE');
  return {status,data:status==='PRESENT'?structuredClone(campaign[name]??{}):null};
}
function normalizedBuild(request,build){
  return {compilerDescriptors:structuredClone(request.configuration?.compilers??[]),optimizer:structuredClone(request.configuration?.optimizer??null),evmVersion:request.configuration?.evmVersion??null,viaIR:request.configuration?.viaIR===true,sourceCommit:request.source?.commit??null,artifacts:structuredClone(build?.artifacts??[])};
}

export async function enrichPhase6V26EvidenceV1({request,result,projectRoot,mutableRpcRuntime,environment=process.env,runCommand}={}){
  const v26=request?.configuration?.v26;
  if(!v26) return result;
  let enriched={...result};
  if(v26.sbomRequired===true){
    enriched.sbom=await generateBuildSbomV1({projectRoot,request,build:normalizedBuild(request,result?.build)});
  }
  if(v26.phase6CampaignPlan){
    const spec=v26.phase6CampaignPlan;
    let plan=createPhase6CampaignPlanV1(spec);
    const medusa=result?.analysis?.medusa;
    if(medusa){
      plan=recordPhase6CampaignV1(plan,{
        campaignId:`${request.requestId}:${spec.activeCampaignClass}:r${spec.runOrdinal}`,
        campaignClass:spec.activeCampaignClass,
        engine:'medusa',
        harnessBundleDigest:spec.harnessBundleDigest,
        sourceSnapshotDigest:spec.sourceSnapshotDigest,
        rpcBlock:medusa.fork?.blockNumber??mutableRpcRuntime?.blockNumber??null,
        rpcBlockHash:medusa.fork?.blockHash??mutableRpcRuntime?.blockHash??null,
        runOrdinal:spec.runOrdinal,
        refinementOf:spec.refinementOf??null,
        configurationDigest:spec.configurationDigest,
        terminalStatus:medusaTerminal(medusa),
        propertyCount:medusa.campaign?.properties?.length??0,
        falsifiedPropertyCount:medusa.campaign?.falsifiedProperties??0,
        corpus:metric(medusa,'corpus'),coverage:metric(medusa,'coverage'),statistics:metric(medusa,'statistics'),
        rawArtifactRef:medusa.rawArtifactRef??null
      });
    }
    const evaluation=evaluatePhase6CampaignPlanV1(plan);
    enriched.phase6CampaignEvidence={schemaVersion:'audit-v7-phase6-campaign-evidence-v1',sourceSnapshotDigest:spec.sourceSnapshotDigest,harnessBundleDigest:spec.harnessBundleDigest,campaigns:plan.campaigns,evaluation};
    enriched.phase6CampaignEvidence.evidenceDigest=digestCanonicalV1(enriched.phase6CampaignEvidence);
  }
  const coverageRequested=(v26.foundryCoverageObligations?.length??0)>0||v26.foundryRefinementRequired===true;
  if(coverageRequested){
    if(!mutableRpcRuntime?.url) throw new Error('v26 Foundry coverage requires the existing passing Phase 6 mutable RPC runtime');
    const coverage=await runFoundryCoverageV1({projectRoot,sourceCommit:request.source.commit,rpcUrl:mutableRpcRuntime.url,blockNumber:mutableRpcRuntime.blockNumber,blockHash:mutableRpcRuntime.blockHash,rpcProfile:mutableRpcRuntime.profile,environment,rawArtifactRef:`github-actions://${process.env.GITHUB_REPOSITORY??'CurveYield2/Contract-Automation'}/runs/${process.env.GITHUB_RUN_ID??'recovery'}/artifacts/v7-execution/foundry-coverage/raw.txt`,...(runCommand?{runCommand}:{})});
    const obligations=evaluateFoundryCoverageObligationsV1(coverage,v26.foundryCoverageObligations??[]);
    const runType=v26.foundryRunType??'baseline';
    const receipt=buildFoundryCampaignReceiptV1({runId:`${request.requestId}:foundry:${runType}`,runType,refinementOf:v26.foundryRefinementOf??null,basisEvidenceIds:v26.foundryBasisEvidenceIds??[],harnessBundleDigest:v26.phase6CampaignPlan?.harnessBundleDigest??digestCanonicalV1(request.configuration?.harness??{}),configurationDigest:v26.phase6CampaignPlan?.configurationDigest??digestCanonicalV1({analysis:request.configuration?.analysis??{},coverage:v26.foundryCoverageObligations??[]}),testResult:result?.analysis?.nativeFuzz??{status:'NOT_EXECUTED'},coverageResult:coverage},{refinementRequired:v26.foundryRefinementRequired===true});
    enriched.foundryCoverage={...coverage,obligationEvaluation:obligations,campaignReceipt:receipt};
    enriched.foundryCoverage.coverageDigest=digestCanonicalV1(enriched.foundryCoverage);
  }
  return enriched;
}
