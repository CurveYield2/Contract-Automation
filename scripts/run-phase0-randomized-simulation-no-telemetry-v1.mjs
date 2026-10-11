#!/usr/bin/env node
import path from 'node:path';
import {runPhase0RandomizedSimulationV1} from '../packages/github-native-sim/src/phase0-randomized-simulation-no-telemetry-v1.mjs';

function args(argv){
  const out={};
  for(let i=2;i<argv.length;i++){
    const k=argv[i];if(!k.startsWith('--'))continue;
    const v=argv[i+1];if(v===undefined||v.startsWith('--'))throw new Error('missing value for '+k);
    out[k.slice(2)]=v;i++;
  }
  return out;
}
const a=args(process.argv);
for(const k of ['controller-root','campaign-path','output'])if(!a[k])throw new Error('missing --'+k);
if(!a['fork-url'])throw new Error('missing --fork-url');
if(a['completed-stages-manifest']||a['telemetry-smoke-calls'])throw new Error('No Telemetry workflow does not accept legacy stage imports or telemetry budgets');
const result=await runPhase0RandomizedSimulationV1({
  controllerRoot:path.resolve(a['controller-root']),
  campaignPath:a['campaign-path'],
  outputRoot:path.resolve(a.output),
  forkUrl:a['fork-url']
});
process.stdout.write(JSON.stringify({
  status:result.summary?.status??'UNKNOWN',
  medusaStatus:result.summary?.medusa?.status??null,
  medusaObservedCalls:result.summary?.medusa?.observedCalls??0,
  deploymentStatus:result.deployEvidence?.status??null,
  code:result.summary?.code??null,
  message:result.summary?.message??null,
  targetEvmChainIds:result.summary?.targetEvmChainIds??result.runIndex?.targetEvmChainIds??[]
},null,2)+'\n');
