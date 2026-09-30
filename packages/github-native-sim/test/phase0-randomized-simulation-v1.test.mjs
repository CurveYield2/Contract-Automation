import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildBurstSchedule,medusaWrappers,phase0DiscoveredTargetChainIdsV1,PHASE0_ACCOUNTING_ACTION_WEIGHT_V1} from '../src/phase0-randomized-simulation-v1.mjs';
import {extractSourceKnownDeployPlanV1,extractSourceKnownBindingsV1,extractSourceKnownCompileGroupsV1} from '../src/source-known-deployment-plan-v1.mjs';

function rngSeq(values){let i=0;return()=>values[(i++)%values.length];}
function fn(accounting,name='f'){
  return {accounting,fragment:{inputs:[],format(){return name;}},signature:name};
}

test('Phase-0 burst schedule assigns exactly 80 percent accounting actions when both classes exist',()=>{
  const targets=[
    {qualifiedName:'A',functions:[fn(true,'deposit()'),fn(false,'pause()')]},
    {qualifiedName:'B',functions:[fn(true,'withdraw()'),fn(false,'setFee()')]},
    {qualifiedName:'C',functions:[fn(true,'stake()'),fn(false,'setAdmin()')]}
  ];
  const schedule=buildBurstSchedule(targets,1000,rngSeq([0.11,0.83,0.27,0.66,0.42,0.94,0.31]));
  const accounting=schedule.filter(x=>x.actionClass==='ACCOUNTING_STATE_CHANGE').reduce((n,x)=>n+x.count,0);
  const other=schedule.filter(x=>x.actionClass==='OTHER_STATE_CHANGE').reduce((n,x)=>n+x.count,0);
  assert.equal(accounting,Math.round(1000*PHASE0_ACCOUNTING_ACTION_WEIGHT_V1));
  assert.equal(other,1000-accounting);
  assert.equal(accounting+other,1000);
});

test('Phase-0 burst schedule revisits contracts instead of exhausting one contract at a time',()=>{
  const targets=[
    {qualifiedName:'A',functions:[fn(true,'deposit()'),fn(false,'pause()')]},
    {qualifiedName:'B',functions:[fn(true,'withdraw()'),fn(false,'setFee()')]},
    {qualifiedName:'C',functions:[fn(true,'stake()'),fn(false,'setAdmin()')]}
  ];
  const schedule=buildBurstSchedule(targets,1200,rngSeq([0.02,0.74,0.38,0.91,0.16,0.55,0.81,0.24]));
  assert.ok(schedule.length>3);
  for(let i=1;i<schedule.length;i++) assert.notEqual(schedule[i].targetIndex,schedule[i-1].targetIndex);
  const seen=new Map();
  schedule.forEach((x,i)=>{const list=seen.get(x.targetIndex)??[];list.push(i);seen.set(x.targetIndex,list);});
  assert.ok([...seen.values()].some(xs=>xs.length>1),'at least one contract should be revisited in a later burst');
});

test('Phase-0 burst schedule terminates and uses available mutable actions when no accounting mutator exists',()=>{
  const targets=[
    {qualifiedName:'A',functions:[fn(false,'pause()')]},
    {qualifiedName:'B',functions:[fn(false,'setFee()')]}
  ];
  const schedule=buildBurstSchedule(targets,250,rngSeq([0.1,0.7,0.3,0.9]));
  const total=schedule.reduce((n,x)=>n+x.count,0);
  assert.equal(total,250);
  assert.ok(schedule.every(x=>x.actionClass==='OTHER_STATE_CHANGE'));
});

test('Medusa wrapper population gives accounting actions at least 80 percent target-function weight when both classes exist',()=>{
  const fakeEthers={};
  const targets=[
    {qualifiedName:'A',address:'0x0000000000000000000000000000000000000001',functions:[fn(true,'deposit()'),fn(false,'pause()')]},
    {qualifiedName:'B',address:'0x0000000000000000000000000000000000000002',functions:[fn(true,'withdraw()'),fn(false,'setFee()')]},
    {qualifiedName:'C',address:'0x0000000000000000000000000000000000000003',functions:[fn(true,'stake()'),fn(false,'setAdmin()')]}
  ];
  const plan=medusaWrappers(fakeEthers,targets);
  assert.ok(plan.rows.length>0);
  assert.ok(plan.accountingWrapperShare>=0.8);
});


test('Phase-0 chain admission reads discovered target chain IDs from readiness',()=>{
  const readiness={deploymentAndConfiguration:{discoveredChainIds:[
    {chainId:8453,path:'deploy.mjs',line:1},
    {chainId:8453,path:'hardhat.config.cjs',line:2}
  ]}};
  assert.deepEqual(phase0DiscoveredTargetChainIdsV1(readiness),[8453]);
  assert.deepEqual(phase0DiscoveredTargetChainIdsV1({}),[]);
});


test('Phase-0 canonical Ethereum baseline uses the qualified RPC identity proxy instead of rejecting virtualized upstream chain IDs',()=>{
  const here=path.dirname(fileURLToPath(import.meta.url));
  const source=fs.readFileSync(path.resolve(here,'../src/phase0-randomized-simulation-v1.mjs'),'utf8');
  assert.match(source,/startRpcIdentityProxy/);
  assert.match(source,/upstreamUrl:forkUrl,chainId:1/);
  assert.match(source,/--fork-url',identityProxy\.url/);
  assert.doesNotMatch(source,/if\(upstreamChainId!==1\)/);
  assert.match(source,/identityNormalized:anvil\.identityNormalized===true/);
});


test('Phase-0 artifact ABI normalization accepts array, nested abi array, and numeric-key object forms',async()=>{
  const sourcePath=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../src/phase0-randomized-simulation-v1.mjs');
  const source=fs.readFileSync(sourcePath,'utf8');
  assert.match(source,/function normalizedAbi\(abi\)/);
  assert.match(source,/Array\.isArray\(abi\)/);
  assert.match(source,/Array\.isArray\(abi\?\.abi\)/);
  assert.match(source,/Object\.values\(abi\)/);
  assert.doesNotMatch(source,/new ethers\.Interface\(a\.abi\?\?\[\]\)/);
});


test('Phase-0 source-known adapter extracts constructor-bearing deployment order without executing the source script',()=>{
  const source=[
    'const DAO = envAddress("DAO", "0x1111111111111111111111111111111111111111");',
    'const PAUSE = Number(envBigInt("PAUSE", 365n * 24n * 60n * 60n));',
    'const first = await deploy("First", [account.address]);',
    'const second = await deploy("Second", [first, DAO, PAUSE, "Phase0"]);',
    'await deploy("QueryLibrary", [], { library: true });'
  ].join('\n');
  const plan=extractSourceKnownDeployPlanV1(source);
  assert.equal(plan.length,3);
  assert.deepEqual(plan.map(x=>[x.binding,x.contractName,x.library]),[
    ['first','First',false],
    ['second','Second',false],
    [null,'QueryLibrary',true]
  ]);
  assert.deepEqual(plan[1].argExpressions,['first','DAO','PAUSE','"Phase0"']);
  const bindings=extractSourceKnownBindingsV1(source);
  assert.equal(bindings.get('DAO'),'0x1111111111111111111111111111111111111111');
  assert.equal(bindings.get('PAUSE'),31536000n);
});

test('Phase-0 fallback consumes source-known deployment plans and no longer caps zero-arg coverage at eight contracts',()=>{
  const here=path.dirname(fileURLToPath(import.meta.url));
  const source=fs.readFileSync(path.resolve(here,'../src/phase0-randomized-simulation-v1.mjs'),'utf8');
  assert.match(source,/deploySourceKnownPlanV1/);
  assert.match(source,/sourcePlanUnresolved/);
  assert.doesNotMatch(source,/slice\(0,max\)/);
  assert.doesNotMatch(source,/max=8/);
});

test('compiler artifacts preserve library link references required by constructor graph fallback',()=>{
  const here=path.dirname(fileURLToPath(import.meta.url));
  const source=fs.readFileSync(path.resolve(here,'../../runner/src/compiler.mjs'),'utf8');
  assert.match(source,/evm\.bytecode\.linkReferences/);
  assert.match(source,/linkReferences:\s*artifact\?\.evm\?\.bytecode\?\.linkReferences/);
});


test('Phase-0 source-known compile groups preserve deployment entries separately from requested contract names',()=>{
  const source=`
    const coreEntries = [
      "contracts/Foo.sol",
      "../../vendor/pkg/contracts/Vault.sol",
      "contracts/UnusedButRequiredSource.sol",
    ];
    const hooksEntries = ["contracts/Hook.sol"];
    function compileAll() {
      const groups = [
        [coreEntries, ["Foo", "Vault"]],
        [hooksEntries, ["Hook"]],
      ];
      return groups;
    }
  `;
  const groups=extractSourceKnownCompileGroupsV1(source);
  assert.equal(groups.length,2);
  assert.deepEqual(groups[0].entryFiles,[
    'contracts/Foo.sol',
    '../../vendor/pkg/contracts/Vault.sol',
    'contracts/UnusedButRequiredSource.sol'
  ]);
  assert.deepEqual(groups[0].contractNames,['Foo','Vault']);
  assert.deepEqual(groups[1].entryFiles,['contracts/Hook.sol']);
  assert.deepEqual(groups[1].contractNames,['Hook']);
});

test('Phase-0 randomized simulation compiles declared deployment-entry artifacts before starting Anvil',()=>{
  const here=path.dirname(fileURLToPath(import.meta.url));
  const source=fs.readFileSync(path.resolve(here,'../src/phase0-randomized-simulation-v1.mjs'),'utf8');
  const compileAt=source.indexOf('compileSourceKnownDeploymentArtifactsV1');
  const anvilAt=source.indexOf('anvil=await startAnvil');
  assert.ok(compileAt>=0);
  assert.ok(anvilAt>compileAt);
  assert.match(source,/sourceKnownCompiledTargets/);
  assert.match(source,/sourceKnownMissingTargets/);
});


test('Phase-0 canonicalizes enum ABI parameters before ethers Interface parsing',()=>{
  const here=path.dirname(fileURLToPath(import.meta.url));
  const source=fs.readFileSync(path.resolve(here,'../src/phase0-randomized-simulation-v1.mjs'),'utf8');
  assert.match(source,/internalBase\.startsWith\('enum '\)/);
  assert.match(source,/next\.type=\`uint8\$\{arraySuffix\}\`/);
  assert.match(source,/rows\.map\(canonicalAbiFragment\)/);
});

test('Phase-0 Medusa execution emits a heartbeat at least every five minutes',()=>{
  const here=path.dirname(fileURLToPath(import.meta.url));
  const source=fs.readFileSync(path.resolve(here,'../src/phase0-randomized-simulation-v1.mjs'),'utf8');
  assert.match(source,/progress heartbeat every 300s/);
  assert.match(source,/setInterval\([\s\S]*?,300000\)/);
  assert.match(source,/\[phase0-medusa\] heartbeat:/);
  assert.match(source,/clearInterval\(heartbeat\)/);
});


test('Phase-0 telemetry emits five-minute progress heartbeats with live call counters',()=>{
  const here=path.dirname(fileURLToPath(import.meta.url));
  const source=fs.readFileSync(path.resolve(here,'../src/phase0-randomized-simulation-v1.mjs'),'utf8');
  assert.match(source,/\[phase0-telemetry\].*heartbeat every 300s/);
  assert.match(source,/\[phase0-telemetry\] heartbeat: run=/);
  assert.match(source,/calls=\$\{stats\.calls\}\/\$\{PHASE0_TELEMETRY_CALLS_PER_RUN_V1\}/);
  assert.match(source,/clearInterval\(telemetryHeartbeat\)/);
});


test('Phase-0 source-known bindings parse multiline envAddress defaults with trailing commas',()=>{
  const source=`
    const DAO = envAddress(
      "CURVEYIELD_DAO",
      "0x7142b1Cc5F91A736A62e77581F406338328F05bC",
    );
  `;
  const bindings=extractSourceKnownBindingsV1(source);
  assert.equal(bindings.get('DAO'),'0x7142b1Cc5F91A736A62e77581F406338328F05bC');
});

test('Phase-0 continues Medusa and telemetry on every executable deployed subset even when deployment graph is incomplete',()=>{
  const here=path.dirname(fileURLToPath(import.meta.url));
  const source=fs.readFileSync(path.resolve(here,'../src/phase0-randomized-simulation-v1.mjs'),'utf8');
  assert.match(source,/continuing all executable randomized stages on the successfully deployed target subset/);
  assert.match(source,/if\(targets\.length\)[\s\S]*?runMedusa/);
  assert.match(source,/if\(targets\.length\)[\s\S]*?runTelemetry/);
  assert.match(source,/MEDUSA_EXECUTION_FAILURE/);
  assert.match(source,/ABI_TELEMETRY_EXECUTION_FAILURE/);
  assert.doesNotMatch(source,/BLOCKED_INCOMPLETE_DEPLOYMENT/);
});

test('Phase-0 rebind workflow assesses completeness non-fatally and enforces only after evidence publication',()=>{
  const here=path.dirname(fileURLToPath(import.meta.url));
  const workflow=fs.readFileSync(path.resolve(here,'../../../.github/workflows/lite-phase0-simulation-rebind-v1.yml'),'utf8');
  const assess=workflow.indexOf('Assess corrected simulation completeness without stopping remaining work');
  const write=workflow.indexOf('Write supplemental rebind evidence without touching sealed Phase-0 outputs');
  const publish=workflow.indexOf('Publish supplemental evidence');
  const enforce=workflow.indexOf('Enforce rebind completion after all executable stages');
  assert.ok(assess>=0);
  assert.ok(write>assess);
  assert.ok(publish>write);
  assert.ok(enforce>publish);
  assert.match(workflow,/echo "complete=\$complete" >> "\$GITHUB_OUTPUT"/);
});


test('Phase-0 randomized simulation reuses exact embedded-profile build artifacts instead of recompiling with one flattened profile',()=>{
  const here=path.dirname(fileURLToPath(import.meta.url));
  const source=fs.readFileSync(path.resolve(here,'../src/phase0-randomized-simulation-v1.mjs'),'utf8');
  assert.match(source,/build\.system==='embedded-profile-native'/);
  assert.match(source,/EXACT_EMBEDDED_PROFILE_BUILD_FROM_PHASE0_BUILD_DISPATCH/);
  assert.match(source,/compilerProfiles:build\.compilerProfiles/);
  assert.match(source,/artifacts:build\.artifacts/);
});


test('Phase-0 prefers a directly redirectable package deployment script before parser fallback', async () => {
  const here=path.dirname(fileURLToPath(import.meta.url));
  const source=fs.readFileSync(path.resolve(here,'../src/phase0-randomized-simulation-v1.mjs'),'utf8');
  assert.match(source,/GENERIC_NODE/);
  assert.match(source,/process\.env\.\(\?:RPC_URL\|ETH_RPC_URL\|LOCALHOST_RPC_URL\)/);
  assert.match(source,/PHASE0_LOCAL_CHAIN_ID:'1'/);
  assert.match(source,/SKIPPED_PACKAGE_DEPLOYMENT_SCRIPT_COMPLETE/);
  assert.match(source,/reportedPackageDeployments/);
  assert.match(source,/PACKAGE_DEPLOYMENT_REPORT/);
  assert.match(source,/dry\[-_ \]\?run/);
});

test('Phase-0 derives and verifies the signer from the Anvil instance instead of embedding a fixed key', async () => {
  const here=path.dirname(fileURLToPath(import.meta.url));
  const source=fs.readFileSync(path.resolve(here,'../src/phase0-randomized-simulation-v1.mjs'),'utf8');
  assert.match(source,/Wallet\.createRandom\(\)/);
  assert.match(source,/--mnemonic',ephemeralMnemonic/);
  assert.match(source,/eth_accounts/);
  assert.match(source,/ANVIL_EPHEMERAL_SIGNER_MISMATCH/);
  assert.doesNotMatch(source,/ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80/);
});

test('original randomized-simulation workflow remains callable and is directly dispatchable', async () => {
  const here=path.dirname(fileURLToPath(import.meta.url));
  const workflow=fs.readFileSync(path.resolve(here,'../../../.github/workflows/lite-phase0-randomized-simulation-v1.yml'),'utf8');
  assert.match(workflow,/workflow_call:/);
  assert.match(workflow,/workflow_dispatch:/);
  assert.match(workflow,/campaign_id:/);
  assert.match(workflow,/campaign_path:/);
});
