import path from 'node:path';
import {runPhase0RandomizedSimulationV1} from '../packages/github-native-sim/src/phase0-randomized-simulation-v1.mjs';
const a={};for(let i=2;i<process.argv.length;i++){if(process.argv[i].startsWith('--'))a[process.argv[i].slice(2)]=process.argv[++i];}
for(const k of ['controller-root','campaign-path','output','fork-url'])if(!a[k])throw new Error('missing --'+k);
const {deployEvidence}=await runPhase0RandomizedSimulationV1({controllerRoot:path.resolve(a['controller-root']),campaignPath:a['campaign-path'],outputRoot:path.resolve(a.output),forkUrl:a['fork-url'],deploymentOnly:true});
process.stdout.write(JSON.stringify({status:deployEvidence?.status??'BLOCKED',executionMode:deployEvidence?.executionMode??null,attempts:deployEvidence?.attempts?.length??0})+'\n');
