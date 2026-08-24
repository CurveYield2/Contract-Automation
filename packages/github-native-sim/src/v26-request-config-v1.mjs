const DIGEST=/^[0-9a-f]{64}$/;
const CAMPAIGN_CLASSES=new Set(['discovery','property','targeted','stateful','boundary-dictionary','multi-actor','ghost-reference','differential','deep-escalation']);
function obj(v,path){ if(!v||typeof v!=='object'||Array.isArray(v)) throw new Error(`${path} must be an object`); return v; }
function bool(v,path){ if(typeof v!=='boolean') throw new Error(`${path} must be boolean`); }
function digest(v,path){ if(typeof v!=='string'||!DIGEST.test(v)) throw new Error(`${path} must be a 64-hex digest`); }
function only(v,allowed,path){ for(const k of Object.keys(v)) if(!allowed.has(k)) throw new Error(`${path}.${k} is not allowed`); }

export function validateV26RequestConfigurationV1(v26,{phaseId}={}){
  if(v26===undefined) return undefined; obj(v26,'configuration.v26');
  only(v26,new Set(['phaseContractDigest','phase6CampaignPlan','foundryCoverageObligations','foundryRefinementRequired','sbomRequired','liveDeploymentAttestation','simulationLedgerRequired','reproduction']),'configuration.v26');
  if(v26.phaseContractDigest!==undefined) digest(v26.phaseContractDigest,'configuration.v26.phaseContractDigest');
  if(v26.sbomRequired!==undefined) bool(v26.sbomRequired,'configuration.v26.sbomRequired');
  if(v26.simulationLedgerRequired!==undefined) bool(v26.simulationLedgerRequired,'configuration.v26.simulationLedgerRequired');
  if(v26.foundryRefinementRequired!==undefined) bool(v26.foundryRefinementRequired,'configuration.v26.foundryRefinementRequired');
  if(v26.phase6CampaignPlan!==undefined){
    if(phaseId!=='build-and-test') throw new Error('configuration.v26.phase6CampaignPlan is Phase 6 only');
    obj(v26.phase6CampaignPlan,'configuration.v26.phase6CampaignPlan'); only(v26.phase6CampaignPlan,new Set(['sourceSnapshotDigest','harnessBundleDigest','requiredCampaignClasses','refinementRequired','deepEscalationRequired']),'configuration.v26.phase6CampaignPlan');
    digest(v26.phase6CampaignPlan.sourceSnapshotDigest,'configuration.v26.phase6CampaignPlan.sourceSnapshotDigest'); digest(v26.phase6CampaignPlan.harnessBundleDigest,'configuration.v26.phase6CampaignPlan.harnessBundleDigest');
    if(!Array.isArray(v26.phase6CampaignPlan.requiredCampaignClasses)||v26.phase6CampaignPlan.requiredCampaignClasses.some(x=>!CAMPAIGN_CLASSES.has(x))) throw new Error('configuration.v26.phase6CampaignPlan.requiredCampaignClasses invalid');
    bool(v26.phase6CampaignPlan.refinementRequired,'configuration.v26.phase6CampaignPlan.refinementRequired'); bool(v26.phase6CampaignPlan.deepEscalationRequired,'configuration.v26.phase6CampaignPlan.deepEscalationRequired');
  }
  if(v26.foundryCoverageObligations!==undefined){ if(!Array.isArray(v26.foundryCoverageObligations)) throw new Error('configuration.v26.foundryCoverageObligations must be an array'); for(const [i,o] of v26.foundryCoverageObligations.entries()){ obj(o,`configuration.v26.foundryCoverageObligations[${i}]`); if(!['FILE_PRESENT','FUNCTION_COVERED','MINIMUM_METRIC'].includes(o.type)) throw new Error('unsupported Foundry coverage obligation'); } }
  if(v26.liveDeploymentAttestation!==undefined){ if(phaseId!=='fork-simulation-lifecycle') throw new Error('live deployment attestation is Phase 7 only'); obj(v26.liveDeploymentAttestation,'configuration.v26.liveDeploymentAttestation'); if(v26.liveDeploymentAttestation.chain!=='ethereum') throw new Error('v26 live attestation currently supports ethereum only'); if(!Array.isArray(v26.liveDeploymentAttestation.deployments)||v26.liveDeploymentAttestation.deployments.length===0) throw new Error('live deployment attestation deployments required'); }
  if(v26.reproduction!==undefined){ obj(v26.reproduction,'configuration.v26.reproduction'); if(!['FOUNDRY_TEST','MEDUSA_PROPERTY','ANVIL_WORKFLOW'].includes(v26.reproduction.reproductionType)) throw new Error('unsupported reproductionType'); if(typeof v26.reproduction.candidateId!=='string'||!v26.reproduction.candidateId) throw new Error('candidateId is required'); obj(v26.reproduction.expectedObservation,'configuration.v26.reproduction.expectedObservation'); }
  return structuredClone(v26);
}
