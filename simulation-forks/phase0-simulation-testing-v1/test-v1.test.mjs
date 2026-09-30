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
  const testingWorkflow=fs.readFileSync(path.resolve(here,'../../.github/workflows/lite-phase0-simulation-testing-v1.yml'),'utf8');
  const canonicalWorkflow=fs.readFileSync(path.resolve(here,'../../.github/workflows/lite-phase0-randomized-simulation-v1.yml'),'utf8');
  assert.match(testingWorkflow,/workflow_dispatch:/);
  assert.match(testingWorkflow,/phase0-simulation-testing-v1/);
  assert.doesNotMatch(canonicalWorkflow,/workflow_dispatch:/);
  assert.doesNotMatch(canonicalWorkflow,/simulation-testing/);
});
