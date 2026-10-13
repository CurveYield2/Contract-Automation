import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  AUDIT_DEPLOYMENT_FILE, assertPhase0ForkIdentity, assertSafeFoundryConfig, loadDeploymentProfile,
  parseDeploymentProfile, phase0ForkChainForProfile, resolvePhase0ForkUrl
} from '../src/phase0-deployment-profile-v1.mjs';
import { assertDeployGateEvidenceV2 } from '../../../scripts/lib/phase0-deploy-gate-v2.mjs';

const DEPLOYER='0x11b78837cadC8E894F1c6e13fA9f3A085a75FA35';
const base={schemaVersion:'curveyield-audit-deployment-v1',chain:'katana',deployer:DEPLOYER};
const parse=value=>parseDeploymentProfile(JSON.stringify(value));

async function write(root,rel,text){const file=path.join(root,...rel.split('/'));await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,text);}

test('absent audit-deployment.json keeps the historical Ethereum lane',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'deploy-profile-'));
  assert.equal(await loadDeploymentProfile(root),null);
  assert.equal(phase0ForkChainForProfile(null).chainId,1);
  assert.equal(resolvePhase0ForkUrl({profile:null,forkUrl:'eth-url'}),'eth-url');
});

test('Foundry and Hardhat profiles parse; invalid profiles fail closed',()=>{
  const foundry=parse({...base,foundryRoot:'upgrade',scripts:['script/DeployAll.s.sol:DeployAll',{entry:'script/Configure.s.sol:Configure',env:{QUEST_DETACH_INSTALL:'true'}}]});
  assert.equal(foundry.mode,'FOUNDRY');
  assert.deepEqual(foundry.scripts.map(x=>x.entry),['script/DeployAll.s.sol:DeployAll','script/Configure.s.sol:Configure']);
  const hardhat=parse({...base,hardhat:{root:'upgrade',script:'scripts/deploy.cjs'}});
  assert.deepEqual(hardhat.hardhat,{root:'upgrade',script:'scripts/deploy.cjs',network:'localhost',timeoutSeconds:1800});
  assert.equal(hardhat.chainId,747474);
  for(const [label,value,pattern] of [
    ['schema',{...base,schemaVersion:'x',scripts:['a.s.sol:A']},/schemaVersion/],
    ['chain',{...base,chain:'polygon',scripts:['a.s.sol:A']},/unsupported chain/],
    ['deployer',{...base,deployer:'0x12',scripts:['a.s.sol:A']},/deployer/],
    ['both',{...base,scripts:['a.s.sol:A'],hardhat:{script:'d.cjs'}},/either hardhat or scripts/],
    ['entry',{...base,scripts:['a.sol']},/\.s\.sol/],
    ['escape',{...base,foundryRoot:'../x',scripts:['a.s.sol:A']},/unsafe/],
    ['rpc-env',{...base,scripts:[{entry:'a.s.sol:A',env:{KATANA_RPC_URL:'http://x'}}]},/not allowed/],
    ['key-env',{...base,scripts:[{entry:'a.s.sol:A',env:{PRIVATE_KEY:'1'}}]},/not allowed/],
    ['foundry-env',{...base,scripts:[{entry:'a.s.sol:A',env:{FOUNDRY_FFI:'true'}}]},/not allowed/],
    ['hardhat-script',{...base,hardhat:{script:'deploy.sh'}},/\.js/],
    ['hardhat-network',{...base,hardhat:{script:'d.cjs',network:'katana --verbose'}},/network/]
  ])assert.throws(()=>parse(value),pattern,label);
});

test('Foundry config with ffi or out-of-tree fs_permissions is refused',()=>{
  assert.throws(()=>assertSafeFoundryConfig('[profile.default]\nffi = true\n'),/ffi/);
  assert.throws(()=>assertSafeFoundryConfig('fs_permissions = [{ access = "read", path = "/" }]'),/escapes/);
  assert.throws(()=>assertSafeFoundryConfig('fs_permissions = [{ access = "read", path = "../x" }]'),/escapes/);
  assert.equal(assertSafeFoundryConfig('# ffi = true\nfs_permissions = [{ access = "read", path = "./" }, { access = "read-write", path = "./deployments" }]'),true);
});

test('loadDeploymentProfile binds the declared files and their digests',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'deploy-profile-'));
  await write(root,'upgrade/foundry.toml','[profile.default]\nsrc="src"\n');
  await write(root,'upgrade/hardhat.config.cjs','module.exports={};');
  await write(root,'upgrade/package.json','{}');
  await write(root,'upgrade/package-lock.json','{}');
  await write(root,'upgrade/scripts/deploy.cjs','// deploy');
  await write(root,AUDIT_DEPLOYMENT_FILE,JSON.stringify({...base,hardhat:{root:'upgrade',script:'scripts/deploy.cjs'}}));
  const profile=await loadDeploymentProfile(root);
  assert.equal(profile.hardhat.config,'hardhat.config.cjs');
  assert.match(profile.hardhat.scriptSha256,/^[0-9a-f]{64}$/);
  assert.match(profile.fileSha256,/^[0-9a-f]{64}$/);
  await write(root,'upgrade/foundry.toml','ffi = true\n');
  await assert.rejects(loadDeploymentProfile(root),/ffi/);
  await write(root,'upgrade/foundry.toml','src="src"\n');
  await fs.rm(path.join(root,'upgrade/package-lock.json'));
  await assert.rejects(loadDeploymentProfile(root),/package-lock/);
  await write(root,AUDIT_DEPLOYMENT_FILE,JSON.stringify({...base,foundryRoot:'upgrade',scripts:['script/Missing.s.sol:Missing']}));
  await assert.rejects(loadDeploymentProfile(root),/missing/);
});

test('a Katana profile requires its own RPC secret',()=>{
  const profile=parse({...base,hardhat:{script:'d.cjs'}});
  assert.equal(resolvePhase0ForkUrl({profile,forkUrl:'eth',forkUrls:{katana:'kat'}}),'kat');
  assert.throws(()=>resolvePhase0ForkUrl({profile,forkUrl:'eth',forkUrls:{}}),/RPC_KATANA secret is missing/);
});

function passingEvidence(fork,deploymentProfile){
  const row={scriptKey:'HARDHAT_PROFILE:upgrade/scripts/deploy.cjs',framework:'HARDHAT_PROFILE',path:'upgrade/scripts/deploy.cjs',disposition:'EXECUTED_PASS'};
  return{schemaVersion:'curveyield-lite-phase0-deploy-config-execution-v3',executionMode:'ANVIL_FORK_PACKAGE_DEPLOY_CONFIG_ONLY',status:'PASS',fork,deploymentProfile,
    scriptDispositions:[row],attempts:[{framework:'HARDHAT_PROFILE',path:'upgrade/scripts/deploy.cjs',status:'PASS',exitCode:0}],deployedContracts:[{address:'0x1'}],gaps:[],limitations:[],
    coverage:{detectedScripts:1,executedScripts:1,passedScripts:1,failedOrUnsupportedScripts:0,excludedScripts:0}};
}

test('deploy gate accepts Ethereum or a profile-bound Katana fork only',()=>{
  const katanaFork={engine:'anvil',source:'RPC_KATANA',chain:'katana',chainId:747474,upstreamChainId:747474,identityNormalized:true};
  const katanaProfile={chain:'katana',chainId:747474};
  assert.equal(assertDeployGateEvidenceV2(passingEvidence(katanaFork,katanaProfile)),true);
  assert.equal(assertDeployGateEvidenceV2(passingEvidence({engine:'anvil',chain:'ethereum',chainId:1,identityNormalized:true},null)),true);
  for(const [label,fork,profile] of [
    ['no-profile',katanaFork,null],
    ['upstream-mismatch',{...katanaFork,upstreamChainId:1},katanaProfile],
    ['profile-mismatch',katanaFork,{chain:'ethereum',chainId:1}],
    ['unknown-chain',{...katanaFork,chainId:137},{chain:'katana',chainId:137}],
    ['not-normalized',{...katanaFork,identityNormalized:false},katanaProfile]
  ])assert.throws(()=>assertPhase0ForkIdentity({fork,deploymentProfile:profile}),/fork/i,label);
});
