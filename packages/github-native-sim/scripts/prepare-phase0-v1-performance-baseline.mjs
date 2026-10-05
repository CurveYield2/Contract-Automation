#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const file=path.resolve(process.argv[2]??'');
if(!file)throw new Error('baseline module path required');
let source=await fs.readFile(file,'utf8');
const start=source.indexOf('async function runTelemetry({provider,ethers,targets,actors,outRoot,baselineSnapshot}){');
const end=source.indexOf('\nfunction solidityType',start);
if(start<0||end<0)throw new Error('pinned v1 telemetry function boundary not found');
let block=source.slice(start,end);
block=block.replace(
  'async function runTelemetry({provider,ethers,targets,actors,outRoot,baselineSnapshot}){',
  "export async function runTelemetry({provider,ethers,targets,actors,outRoot,baselineSnapshot,telemetryRuns=1,callsPerRun=180,seedSalt='baseline-v1'}){"
);
block=block.replace('for(let run=1;run<=PHASE0_TELEMETRY_RUNS_V1;run++){','for(let run=1;run<=telemetryRuns;run++){');
block=block.replaceAll('PHASE0_TELEMETRY_CALLS_PER_RUN_V1','callsPerRun');
block=block.replace('seeded(\`\${runId}-phase0-v2\`)','seeded(seedSalt)');
if(!block.includes('export async function runTelemetry')||block.includes('PHASE0_TELEMETRY_CALLS_PER_RUN_V1'))throw new Error('pinned v1 telemetry patch incomplete');
source=source.slice(0,start)+block+source.slice(end);
await fs.writeFile(file,source);
process.stdout.write(JSON.stringify({status:'PASS',file})+'\n');
