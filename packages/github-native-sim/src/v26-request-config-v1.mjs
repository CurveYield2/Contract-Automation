const DIGEST=/^[0-9a-f]{64}$/;
const CAMPAIGN_CLASSES=new Set(['discovery','property','targeted','stateful','boundary-dictionary','multi-actor','ghost-reference','differential','deep-escalation']);
function obj(v,path){ if(!v||typeof v!=='object'||Array.isArray(v)) throw new Error(`${path} must be an object`); return v; }
function bool(v,path){ if(typeof v!=='boolean') throw new Error(`${path} must be boolean`); }
function digest(v,path){ if(typeof v!=='string'||!DIGEST.test(v)) throw new Error(`${path} must be a 64-hex digest`); }
function string(v,path){ if(typeof v!=='string'||!v.trim()) throw new Error(`${path} must be a non-empty string`); }
function only(v,allowed,path){ for(const k of Object.keys(v)) if(!allowed.has(k)) throw new Error(`${path}.${k} is not allowed`); }

export function validateV26RequestConfigurationV1(v26,{phaseId}={}){
  if(v26===undefined) return undefined; obj(v26,'configuration.v26');
  only(v26,new Set(['phaseContractDigest','phase6CampaignPlan','foundryCoverageObligations','foundryRefinementRequired','foundryRunType','foundryRefinementOf','foundryBasisEvidenceIds','sbomRequired','liveDeploymentAttestation','simulationLedgerRequired','reproduction']),'configuration.v26');
  if(v26.phaseContractDigest!==undefined) digest(v26.phaseContractDigest,'configuration.v26.phaseContractDigest');
  if(v26.sbomRequired!==undefined) bool(v26.sbomRequired,'configuration.v26.sbomRequired');
  if(v26.simulationLedgerRequired!==undefined) bool(v26.simulationLedgerRequired,'configuration.v26.simulationLedgerRequired');
  if(v26.foundryRefinementRequired!==undefined) bool(v26.foundryRefinementRequired,'configuration.v26.foundryRefinementRequired');
  if(v26.foundryRunType!==undefined&&!['baseline','refinement'].includes(v26.foundryRunType)) throw new Error('configuration.v26.foundryRunType must be baseline or refinement');
  if(v26.foundryRefinementOf!==undefined&&v26.foundryRefinementOf!==null) string(v26.foundryRefinementOf,'configuration.v26.foundryRefinementOf');
  if(v26.foundryBasisEvidenceIds!==undefined&&(!Array.isArray(v26.foundryBasisEvidenceIds)||v26.foundryBasisEvidenceIds.some(x=>typeof x!=='string'||!x))) throw new Error('configuration.v26.foundryBasisEvidenceIds must contain non-empty strings');
  if(v26.foundryRunType==='refinement'&&!v26.foundryRefinementOf) throw new Error('Foundry refinement run requires foundryRefinementOf');
  if(v26.phase6CampaignPlan!==undefined){
    if(phaseId!=='build-and-test') throw new Error('configuration.v26.phase6CampaignPlan is Phase 6 only');
    obj(v26.phase6CampaignPlan,'configuration.v26.phase6CampaignPlan'); only(v26.phase6CampaignPlan,new Set(['sourceSnapshotDigest','harnessBundleDigest','requiredCampaignClasses','refinementRequired','deepEscalationRequired','activeCampaignClass','runOrdinal','refinementOf','configurationDigest']),'configuration.v26.phase6CampaignPlan');
    digest(v26.phase6CampaignPlan.sourceSnapshotDigest,'configuration.v26.phase6CampaignPlan.sourceSnapshotDigest'); digest(v26.phase6CampaignPlan.harnessBundleDigest,'configuration.v26.phase6CampaignPlan.harnessBundleDigest');
    if(!Array.isArray(v26.phase6CampaignPlan.requiredCampaignClasses)||v26.phase6CampaignPlan.requiredCampaignClasses.some(x=>!CAMPAIGN_CLASSES.has(x))) throw new Error('configuration.v26.phase6CampaignPlan.requiredCampaignClasses invalid');
    bool(v26.phase6CampaignPlan.refinementRequired,'configuration.v26.phase6CampaignPlan.refinementRequired'); bool(v26.phase6CampaignPlan.deepEscalationRequired,'configuration.v26.phase6CampaignPlan.deepEscalationRequired');
    if(!CAMPAIGN_CLASSES.has(v26.phase6CampaignPlan.activeCampaignClass)) throw new Error('configuration.v26.phase6CampaignPlan.activeCampaignClass invalid');
    if(!v26.phase6CampaignPlan.requiredCampaignClasses.includes(v26.phase6CampaignPlan.activeCampaignClass)) throw new Error('activeCampaignClass must be required by the campaign plan');
    if(!Number.isInteger(v26.phase6CampaignPlan.runOrdinal)||v26.phase6CampaignPlan.runOrdinal<1) throw new Error('configuration.v26.phase6CampaignPlan.runOrdinal must be positive integer');
    if(v26.phase6CampaignPlan.refinementOf!==undefined&&v26.phase6CampaignPlan.refinementOf!==null) string(v26.phase6CampaignPlan.refinementOf,'configuration.v26.phase6CampaignPlan.refinementOf');
    digest(v26.phase6CampaignPlan.configurationDigest,'configuration.v26.phase6CampaignPlan.configurationDigest');
    if(v26.phase6CampaignPlan.runOrdinal>1&&!v26.phase6CampaignPlan.refinementOf) throw new Error('Phase 6 campaign rerun requires refinementOf');
  }
  if(v26.foundryCoverageObligations!==undefined){ if(!Array.isArray(v26.foundryCoverageObligations)) throw new Error('configuration.v26.foundryCoverageObligations must be an array'); for(const [i,o] of v26.foundryCoverageObligations.entries()){ obj(o,`configuration.v26.foundryCoverageObligations[${i}]`); if(!['FILE_PRESENT','FUNCTION_COVERED','MINIMUM_METRIC'].includes(o.type)) throw new Error('unsupported Foundry coverage obligation'); } }
  if(v26.liveDeploymentAttestation!==undefined){ if(phaseId!=='fork-simulation-lifecycle') throw new Error('live deployment attestation is Phase 7 only'); obj(v26.liveDeploymentAttestation,'configuration.v26.liveDeploymentAttestation'); if(v26.liveDeploymentAttestation.chain!=='ethereum') throw new Error('v26 live attestation currently supports ethereum only'); if(!Array.isArray(v26.liveDeploymentAttestation.deployments)||v26.liveDeploymentAttestation.deployments.length===0) throw new Error('live deployment attestation deployments required'); }
  if(v26.reproduction!==undefined){ obj(v26.reproduction,'configuration.v26.reproduction'); if(!['FOUNDRY_TEST','MEDUSA_PROPERTY','ANVIL_WORKFLOW'].includes(v26.reproduction.reproductionType)) throw new Error('unsupported reproductionType'); if(typeof v26.reproduction.candidateId!=='string'||!v26.reproduction.candidateId) throw new Error('candidateId is required'); obj(v26.reproduction.expectedObservation,'configuration.v26.reproduction.expectedObservation'); }
  return structuredClone(v26);
}
