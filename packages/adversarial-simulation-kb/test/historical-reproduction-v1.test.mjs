import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildHistoricalReproductionPlanV1 } from '../src/historical/reproduction-v1.mjs';

const ROOT='packages/adversarial-simulation-kb';
const incident=JSON.parse(fs.readFileSync(`${ROOT}/incidents/EXP-2023-0001/incident.json`,'utf8'));

test('K13 historical plan binds the Euler incident to a pre-exploit archive identity without claiming proof',()=>{
  const plan=buildHistoricalReproductionPlanV1({incident});
  assert.deepEqual(plan.historicalAnchor,{
    chain:'ethereum',
    chainId:1,
    preExploitBlockNumber:16817995,
    representativeExploitBlock:16817996,
    representativeExploitTransaction:'0xc310a0affe2169d1f6feec1c63dbc7f7c62a887fa48795d327d4d2da2d6b111d',
  });
  assert.deepEqual(plan.archiveRequirement,{required:true,archiveRequired:true,rpcEnvVar:'SIM_ARCHIVE_PRIMARY_ETHEREUM_01'});
  assert.deepEqual(plan.codeIdentityTargets,['0x27182842e098f60e3d576794a5bffb0777e025d3']);
  assert.deepEqual(plan.requiredObservedEffects,['POST_DONATION_HEALTH_REDUCTION','ATTACKER_CONTROLLED_LIQUIDATION','NET_EXTRACTABLE_VALUE']);
  assert.equal(plan.proofClaimAllowed,false);
});
