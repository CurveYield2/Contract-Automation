const ADDRESS=/^0x[0-9a-fA-F]{40}$/;
const TX=/^0x[0-9a-fA-F]{64}$/;

function requireObject(value,label){
  if(!value||typeof value!=='object'||Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value;
}

function runtimeAnchor(incident){
  const requirement=(incident.runtimeRequirements??[]).find((value)=>value&&typeof value==='object'&&value.chain==='ethereum');
  if(!requirement||!Number.isInteger(requirement.representativeExploitBlock)||!TX.test(requirement.representativeExploitTransaction??'')) {
    throw new Error('Incident requires an Ethereum representative exploit block and transaction');
  }
  if(requirement.representativeExploitBlock<1) throw new Error('Representative exploit block must have a preceding historical block');
  return requirement;
}

export function buildHistoricalReproductionPlanV1({incident}={}){
  requireObject(incident,'incident');
  if(incident.incidentId!=='EXP-2023-0001') throw new Error('Historical plan currently requires EXP-2023-0001');
  const anchor=runtimeAnchor(incident);
  const targets=(incident.affectedContracts??[]).map((address)=>String(address).toLowerCase());
  if(targets.length===0||targets.some((address)=>!ADDRESS.test(address))) throw new Error('Incident requires valid affected-contract anchors');
  return {
    historicalAnchor:{
      chain:'ethereum',
      chainId:1,
      preExploitBlockNumber:anchor.representativeExploitBlock-1,
      representativeExploitBlock:anchor.representativeExploitBlock,
      representativeExploitTransaction:anchor.representativeExploitTransaction.toLowerCase(),
    },
    archiveRequirement:{required:true,archiveRequired:true,rpcEnvVar:'SIM_ARCHIVE_PRIMARY_ETHEREUM_01'},
    codeIdentityTargets:targets,
    requiredObservedEffects:['POST_DONATION_HEALTH_REDUCTION','ATTACKER_CONTROLLED_LIQUIDATION','NET_EXTRACTABLE_VALUE'],
    proofClaimAllowed:false,
  };
}
