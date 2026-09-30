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
