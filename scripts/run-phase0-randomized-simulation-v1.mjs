#!/usr/bin/env node
import path from 'node:path';
import {runPhase0RandomizedSimulationV1} from '../packages/github-native-sim/src/phase0-randomized-simulation-v1.mjs';

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
for(const k of ['controller-root','campaign-path','output','fork-url'])if(!a[k])throw new Error('missing --'+k);
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
  telemetryRuns:result.summary?.telemetry?.length??0,
  deploymentStatus:result.deployEvidence?.status??null
},null,2)+'\n');
