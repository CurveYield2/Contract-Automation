import fs from 'node:fs/promises';
import path from 'node:path';
import {renderDeployConfigMatrixV1,renderTargetedTestMatrixV1} from '../packages/github-native-sim/src/lite-boundary-artifacts-v1.mjs';
const a={};for(let i=2;i<process.argv.length;i++){if(process.argv[i].startsWith('--'))a[process.argv[i].slice(2)]=process.argv[++i];}
for(const k of ['controller-root','campaign-path','simulation-output'])if(!a[k])throw new Error('missing --'+k);
const campaignRoot=path.join(path.resolve(a['controller-root']),...a['campaign-path'].split('/'));
const src=path.resolve(a['simulation-output']);
const raw=await fs.readFile(path.join(src,'PHASE0_DEPLOY_CONFIG_EXECUTION_v1.json'),'utf8');
const deploy=JSON.parse(raw);
if(deploy.schemaVersion!=='curveyield-lite-phase0-deploy-config-execution-v3'||!['PASS','NOT_APPLICABLE_NO_DEPLOYMENT_SCRIPT'].includes(deploy.status))throw new Error('Deployment evidence does not satisfy Phase-0 deploy/config-only gate');
const destination=path.join(campaignRoot,'evidence/phase0');
await fs.mkdir(destination,{recursive:true});
await fs.writeFile(path.join(destination,'PHASE0_DEPLOY_CONFIG_EXECUTION_v1.json'),raw);
const readiness=JSON.parse(await fs.readFile(path.join(campaignRoot,'evidence/readiness/PROJECT_READINESS_AUTOMATED_v1.json'),'utf8'));
const work=path.join(campaignRoot,'work/phase-06');await fs.mkdir(work,{recursive:true});
await fs.writeFile(path.join(work,'LITE_DEPLOY_CONFIG_MATRIX.md'),renderDeployConfigMatrixV1({readiness,execution:deploy}));
await fs.writeFile(path.join(work,'LITE_TARGETED_TEST_MATRIX.md'),renderTargetedTestMatrixV1({targetDesigns:[],executionResults:{},baselineRows:[]}));
for(const old of [
  'evidence/phase0/PHASE0_RANDOMIZED_SIMULATION_SUMMARY_v1.json',
  'evidence/phase0/PHASE0_TELEMETRY_ANALYSIS_v1.json',
  'evidence/phase0/PHASE0_TELEMETRY_ANALYSIS_v1.md',
  'evidence/phase0/simulations/PHASE0_SIMULATION_RUN_INDEX_v1.json',
  'derived/phase-0/PHASE5_SIMULATION_BASELINE_INPUT_v1.json',
  'derived/phase-0/PHASE6_SIMULATION_BASELINE_INPUT_v1.json'
])await fs.rm(path.join(campaignRoot,...old.split('/')),{force:true});
process.stdout.write(JSON.stringify({status:'PASS',deployment:'evidence/phase0/PHASE0_DEPLOY_CONFIG_EXECUTION_v1.json',baselineSimulationRequired:false})+'\n');
