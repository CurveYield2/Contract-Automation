import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

test('simulation testing fork prefers redirectable package deployment before parser fallback',()=>{
  const here=path.dirname(fileURLToPath(import.meta.url));
  const source=fs.readFileSync(path.resolve(here,'./engine-v1.mjs'),'utf8');
  assert.match(source,/GENERIC_NODE/);
  assert.ok(source.includes("process\\.env\\.(?:RPC_URL|ETH_RPC_URL|LOCALHOST_RPC_URL)"));
  assert.match(source,/PHASE0_LOCAL_CHAIN_ID:'1'/);
  assert.match(source,/SKIPPED_PACKAGE_DEPLOYMENT_SCRIPT_COMPLETE/);
  assert.match(source,/reportedPackageDeployments/);
  assert.match(source,/PACKAGE_DEPLOYMENT_REPORT/);
  assert.ok(source.includes("dry[-_ ]?run"));
});

test('simulation testing fork derives and verifies signer from its Anvil instance',()=>{
  const here=path.dirname(fileURLToPath(import.meta.url));
  const source=fs.readFileSync(path.resolve(here,'./engine-v1.mjs'),'utf8');
  assert.match(source,/Wallet\.createRandom\(\)/);
  assert.match(source,/--mnemonic',ephemeralMnemonic/);
  assert.match(source,/eth_accounts/);
  assert.match(source,/ANVIL_EPHEMERAL_SIGNER_MISMATCH/);
  assert.doesNotMatch(source,/ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80/);
});

test('simulation testing workflow is isolated from canonical Phase-0 workflow',()=>{
  const here=path.dirname(fileURLToPath(import.meta.url));
  const testingWorkflow=fs.readFileSync(path.resolve(here,'../../../../.github/workflows/lite-phase0-simulation-testing-v1.yml'),'utf8');
  const canonicalWorkflow=fs.readFileSync(path.resolve(here,'../../../../.github/workflows/lite-phase0-randomized-simulation-v1.yml'),'utf8');
  assert.match(testingWorkflow,/workflow_dispatch:/);
  assert.match(testingWorkflow,/phase0-simulation-testing-v1/);
  assert.doesNotMatch(canonicalWorkflow,/workflow_dispatch:/);
  assert.doesNotMatch(canonicalWorkflow,/simulation-testing/);
});


test('simulation testing installs staged package dependencies from package-lock without package scripts',()=>{
  const here=path.dirname(fileURLToPath(import.meta.url));
  const source=fs.readFileSync(path.resolve(here,'./engine-v1.mjs'),'utf8');
  assert.match(source,/installPackageRuntimeDependenciesV1/);
  assert.match(source,/package-lock\.json/);
  assert.match(source,/npm','ci','--ignore-scripts','--audit=false','--fund=false/);
  assert.match(source,/SIMULATION_TESTING_PACKAGE_DEPENDENCY_INSTALL_FAILED/);
});

test('gas overrides bind to consumed environment keys, including WEI suffix',()=>{
  const here=path.dirname(fileURLToPath(import.meta.url));
  const source=fs.readFileSync(path.resolve(here,'./engine-v1.mjs'),'utf8');
  const body=source.slice(source.indexOf('function canonicalEthereumExecutionOverrides'),source.indexOf('async function executeDeploymentScripts'));
  const overrides=new Function(body+';return canonicalEthereumExecutionOverrides;')();
  const result=overrides('const MAX_FEE_PER_GAS=envBigInt("MAX_FEE_PER_GAS_WEI",1); const MAX_PRIORITY_FEE_PER_GAS=envBigInt("MAX_PRIORITY_FEE_PER_GAS_WEI",2);');
  assert.deepEqual(result.env,{MAX_FEE_PER_GAS_WEI:'1000000000000',MAX_PRIORITY_FEE_PER_GAS_WEI:'1000000000'});
  assert.deepEqual(result.adaptations.map(x=>x.env),Object.keys(result.env));
  const legacy=overrides('const fee=process.env.MAX_FEE_PER_GAS; const tip=envBigInt("MAX_PRIORITY_FEE_PER_GAS",2);');
  assert.deepEqual(legacy.env,{MAX_FEE_PER_GAS:'1000000000000',MAX_PRIORITY_FEE_PER_GAS:'1000000000'});
  assert.deepEqual(overrides('const MAX_FEE_PER_GAS=1;').env,{});
});

test('summary telemetry projection preserves terminal status used by completeness gate',()=>{
  const here=path.dirname(fileURLToPath(import.meta.url));
  const source=fs.readFileSync(path.resolve(here,'./engine-v1.mjs'),'utf8');
  const prefix='telemetry:telemetry.map(x=>(';
  const start=source.indexOf(prefix)+prefix.length;
  const end=source.indexOf(')),deployment:',start);
  const project=new Function('x','return ('+source.slice(start,end)+')');
  assert.equal(project({runId:'shard',status:'PASS',calls:1200}).status,'PASS');
  assert.equal(project({runId:'shard',status:'FAILED',calls:1200}).status,'FAILED');
});

test('package deployment report wins over bytecode discovery at the same address',()=>{
  const here=path.dirname(fileURLToPath(import.meta.url));
  const source=fs.readFileSync(path.resolve(here,'./engine-v1.mjs'),'utf8');
  const merge=source.match(/for\(const row of \[\.\.\.[^\]]+\]\)deploymentRowsByAddress\.set\(String\(row\.address\)\.toLowerCase\(\),row\);/)[0];
  const reported={rows:[{address:'0xabc',contractName:'LinkedLibrary',mappingStatus:'PACKAGE_DEPLOYMENT_REPORT'}]};
  const discoveredScriptDeployments=[{address:'0xabc',contractName:null,mappingStatus:'UNMAPPED_CREATION'},{address:'0xdef',contractName:'Extra'}];
  const deploymentRowsByAddress=new Map();
  new Function('reported','discoveredScriptDeployments','deploymentRowsByAddress',merge)(reported,discoveredScriptDeployments,deploymentRowsByAddress);
  assert.equal(deploymentRowsByAddress.get('0xabc').contractName,'LinkedLibrary');
  assert.equal(deploymentRowsByAddress.get('0xdef').contractName,'Extra');
});
