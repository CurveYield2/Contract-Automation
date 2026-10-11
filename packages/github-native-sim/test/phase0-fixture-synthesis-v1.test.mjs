import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import solc from 'solc';
import * as ethers from 'ethers';
import {buildCompiledArtifactErrorSelectorIndexV1,decodeTelemetryRevertReasonV1,topDecodedTelemetryRevertsV1,discoverValuePoolV1,fundActorsV1,PHASE0_MEDUSA_SENDERS_V1,weightedFixtureAddressSeedV1,chooseFixtureAmountV1,discoverCreatorCandidatesV1,buildCreatorArgumentsV1,executeCreatorSynthesisV1,bindCreatedContractV1} from '../src/phase0-fixture-synthesis-v1.mjs';
import {renderMedusaRouterV2,buildMedusaConfigV2} from '../src/phase0-randomized-simulation-v1.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');

async function freePort(){
  const server=net.createServer();
  await new Promise((resolve,reject)=>server.once('error',reject).listen(0,'127.0.0.1',resolve));
  const port=server.address().port;
  await new Promise(resolve=>server.close(resolve));
  return port;
}

async function startLocalAnvil(){
  const port=await freePort();
  const bin=path.join(root,'node_modules/@foundry-rs/anvil/bin.mjs');
  const child=spawn(process.execPath,[bin,'--host','127.0.0.1','--port',String(port),'--chain-id','31337','--auto-impersonate','--silent'],{stdio:['ignore','ignore','pipe']});
  let stderr='';child.stderr.on('data',x=>{stderr+=String(x);});
  const provider=new ethers.JsonRpcProvider(`http://127.0.0.1:${port}`,31337,{staticNetwork:true,cacheTimeout:-1});
  const deadline=Date.now()+10000;
  while(Date.now()<deadline){
    if(child.exitCode!==null)throw new Error('anvil exited before readiness: '+stderr);
    try{await provider.getBlockNumber();return{child,provider};}catch{}
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  child.kill('SIGKILL');
  throw new Error('anvil readiness timeout: '+stderr);
}

function compileSmokeContract(){
  const input={
    language:'Solidity',
    sources:{'Smoke.sol':{content:`// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;
contract Reverter {
  error SmokeCustom(uint256 code);
  function custom() external pure { revert SmokeCustom(7); }
  function stringy() external pure { revert("SMOKE_STRING"); }
}`}},
    settings:{outputSelection:{'*':{'*':['abi','evm.bytecode.object']}}}
  };
  const output=JSON.parse(solc.compile(JSON.stringify(input)));
  const failures=(output.errors??[]).filter(x=>x.severity==='error');
  assert.deepEqual(failures,[]);
  return output.contracts['Smoke.sol'].Reverter;
}

test('Stage-0 decoder resolves custom errors from compiled artifact ABIs and preserves string revert text on local Anvil',async()=>{
  const {child,provider}=await startLocalAnvil();
  try{
    const compiled=compileSmokeContract();
    const signer=await provider.getSigner(0);
    const factory=new ethers.ContractFactory(compiled.abi,'0x'+compiled.evm.bytecode.object,signer);
    const contract=await factory.deploy();
    await contract.waitForDeployment();
    const artifacts=[{sourceName:'Smoke.sol',contractName:'Reverter',abi:compiled.abi}];
    const selectorIndex=buildCompiledArtifactErrorSelectorIndexV1({ethers,artifacts});

    const customError=await contract.custom.staticCall().then(()=>null,error=>error);
    assert.ok(customError);
    assert.equal(decodeTelemetryRevertReasonV1({ethers,error:customError,selectorIndex}).reason,'SmokeCustom(uint256)');

    const stringError=await contract.stringy.staticCall().then(()=>null,error=>error);
    assert.ok(stringError);
    assert.equal(decodeTelemetryRevertReasonV1({ethers,error:stringError,selectorIndex}).reason,'SMOKE_STRING');

    const table=topDecodedTelemetryRevertsV1({
      ethers,artifacts,
      rows:[
        {executionOutcome:'SIMULATED_REJECTION',error:customError},
        {executionOutcome:'SIMULATED_REJECTION',error:customError},
        {executionOutcome:'SIMULATED_REJECTION',error:stringError}
      ]
    });
    assert.deepEqual(table.map(x=>[x.reason,x.count]),[['SmokeCustom(uint256)',2],['SMOKE_STRING',1]]);
  }finally{
    await provider.destroy();
    child.kill('SIGTERM');
  }
});

test('Stage-0 smoke wiring exposes independent telemetry and Medusa budgets and the required report fields',()=>{
  const runner=fs.readFileSync(path.join(root,'packages/github-native-sim/src/phase0-randomized-simulation-v1.mjs'),'utf8');
  const cli=fs.readFileSync(path.join(root,'scripts/run-phase0-randomized-simulation-v1.mjs'),'utf8');
  const workflow=fs.readFileSync(path.join(root,'.github/workflows/lite-phase0-simulation-testing-v1.yml'),'utf8');
  assert.match(cli,/telemetry-smoke-calls/);
  assert.match(runner,/telemetrySmokeCalls/);
  assert.match(runner,/telemetryRuns:1,callsPerRun:telemetrySmokeCalls/);
  assert.match(workflow,/telemetry_calls:/);
  for(const field of ['minedSuccess','minedRevert','simulatedRejection','positiveTransitions','positiveEconomicTransitions','accountingActionShare','observationReads']){
    assert.match(workflow,new RegExp(field));
  }
  assert.match(workflow,/decodedRevertReasons/);
  assert.match(workflow,/PHASE0_FIXTURE_SYNTHESIS_v1\.json/);
});


function compileStage1Contracts(){
  const input={
    language:'Solidity',
    sources:{'Stage1.sol':{content:`// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

contract SlotToken {
  uint256 private marker = 11;
  mapping(address => uint256) private balances;
  mapping(address => mapping(address => uint256)) public allowance;
  uint8 public constant decimals = 18;
  uint256 public totalSupply = 1000000000 ether;
  function balanceOf(address account) external view returns (uint256) { return balances[account]; }
  function approve(address spender, uint256 amount) external returns (bool) {
    allowance[msg.sender][spender] = amount;
    return true;
  }
}

contract VyperShapeToken {
  mapping(address => mapping(address => uint256)) public allowance;
  uint256 public totalSupply = 1000000000000;
  function decimals() external pure returns (uint8) { return 6; }
  function balanceOf(address account) external view returns (uint256 value) {
    assembly {
      mstore(0x00, 7)
      mstore(0x20, account)
      value := sload(keccak256(0x00, 0x40))
    }
  }
  function approve(address spender, uint256 amount) external returns (bool) {
    allowance[msg.sender][spender] = amount;
    return true;
  }
}

contract Registry {
  struct Pair { address first; address second; }
  address public owner;
  address public primaryToken;
  address[] private listed;
  Pair private configuredPair;
  constructor(address first, address second) {
    owner = msg.sender;
    primaryToken = first;
    listed.push(first);
    listed.push(second);
    configuredPair = Pair(first, second);
  }
  function tokens() external view returns (address[] memory) { return listed; }
  function pair() external view returns (Pair memory) { return configuredPair; }
}`}},
    settings:{outputSelection:{'*':{'*':['abi','evm.bytecode.object']}}}
  };
  const output=JSON.parse(solc.compile(JSON.stringify(input)));
  const failures=(output.errors??[]).filter(x=>x.severity==='error');
  assert.deepEqual(failures,[]);
  return output.contracts['Stage1.sol'];
}

async function deployArtifact(provider,artifact,args=[]){
  const signer=await provider.getSigner(0);
  const factory=new ethers.ContractFactory(artifact.abi,'0x'+artifact.evm.bytecode.object,signer);
  const contract=await factory.deploy(...args);
  await contract.waitForDeployment();
  return contract;
}

test('Stage-1 discovers associations and privileged actors, funds Solidity and Vyper-layout balances, and records approvals on local Anvil',async()=>{
  const {child,provider}=await startLocalAnvil();
  try{
    const compiled=compileStage1Contracts();
    const slotToken=await deployArtifact(provider,compiled.SlotToken);
    const vyperToken=await deployArtifact(provider,compiled.VyperShapeToken);
    const registry=await deployArtifact(provider,compiled.Registry,[await slotToken.getAddress(),await vyperToken.getAddress()]);
    const accounts=await provider.send('eth_accounts',[]);
    const targets=[
      {qualifiedName:'Stage1.sol:SlotToken',address:await slotToken.getAddress(),artifact:{abi:compiled.SlotToken.abi}},
      {qualifiedName:'Stage1.sol:VyperShapeToken',address:await vyperToken.getAddress(),artifact:{abi:compiled.VyperShapeToken.abi}},
      {qualifiedName:'Stage1.sol:Registry',address:await registry.getAddress(),artifact:{abi:compiled.Registry.abi}}
    ];

    const pool=await discoverValuePoolV1({provider,ethers,targets,actors:accounts.slice(0,2)});
    const slotTokenAddress=ethers.getAddress(await slotToken.getAddress());
    const vyperTokenAddress=ethers.getAddress(await vyperToken.getAddress());
    const registryAddress=ethers.getAddress(await registry.getAddress());
    assert.ok(pool.tokens.some(x=>x.address===slotTokenAddress&&x.decimals===18));
    assert.ok(pool.tokens.some(x=>x.address===vyperTokenAddress&&x.decimals===6));
    assert.ok(pool.privileged.includes(ethers.getAddress(accounts[0])));
    assert.ok(pool.associations[registryAddress] instanceof Set);
    assert.ok(pool.associations[registryAddress].has(slotTokenAddress));
    assert.ok(pool.associations[registryAddress].has(vyperTokenAddress));

    const holders=[accounts[0],PHASE0_MEDUSA_SENDERS_V1[0]];
    const funding=await fundActorsV1({provider,ethers,tokens:pool.tokens,holders,spenders:[registryAddress]});
    const slotRow=funding.slotResults.find(x=>x.token===slotTokenAddress);
    const vyperRow=funding.slotResults.find(x=>x.token===vyperTokenAddress);
    assert.equal(slotRow.status,'FOUND');
    assert.equal(slotRow.layout,'SOLIDITY');
    assert.equal(vyperRow.status,'FOUND');
    assert.equal(vyperRow.layout,'VYPER');
    assert.equal(funding.receiptCounts.erc20Approvals,holders.length*pool.tokens.length);
    assert.equal(funding.receiptCounts.gaps,0);

    for(const holder of holders){
      assert.equal((await slotToken.balanceOf(holder)).toString(),slotRow.fundedAmount);
      assert.equal((await vyperToken.balanceOf(holder)).toString(),vyperRow.fundedAmount);
      assert.equal((await slotToken.allowance(holder,registryAddress)).toString(),ethers.MaxUint256.toString());
      assert.equal((await vyperToken.allowance(holder,registryAddress)).toString(),ethers.MaxUint256.toString());
      assert.equal((await provider.getBalance(holder)).toString(),(10n**24n).toString());
    }
  }finally{
    await provider.destroy();
    child.kill('SIGTERM');
  }
});

test('Stage-1 address seeding keeps the required weighted buckets and amount candidates are bounded by funded balances',()=>{
  const created='0x00000000000000000000000000000000000000c1';
  const token='0x00000000000000000000000000000000000000c2';
  const associated='0x00000000000000000000000000000000000000c3';
  const target='0x00000000000000000000000000000000000000c4';
  const actor='0x00000000000000000000000000000000000000c5';
  const pool={
    created:[created],
    tokens:[{address:token,decimals:6,fundedAmount:'1000000000000'}],
    associations:{[target]:new Set([associated])},
    privileged:[actor],
    addresses:[created,token,associated,target,actor]
  };
  const seeded=weightedFixtureAddressSeedV1({valuePool:pool,actors:[actor],targets:[target],chosenAddresses:[target]});
  const count=value=>seeded.filter(x=>x.toLowerCase()===value.toLowerCase()).length;
  assert.equal(seeded.length,100);
  assert.equal(count(created),35);
  assert.equal(count(token),25);
  assert.equal(count(associated),15);
  assert.equal(count(target),15);
  assert.equal(count(actor),10);

  const seq=[0,0.4,0.9];let i=0;
  const amounts=[
    chooseFixtureAmountV1({rng:()=>seq[i++%seq.length],param:{type:'uint256'},valuePool:pool,chosenAddresses:[token]}),
    chooseFixtureAmountV1({rng:()=>seq[i++%seq.length],param:{type:'uint256'},valuePool:pool,chosenAddresses:[token]}),
    chooseFixtureAmountV1({rng:()=>seq[i++%seq.length],param:{type:'uint256'},valuePool:pool,chosenAddresses:[token]})
  ];
  assert.ok(amounts.includes('1'));
  assert.ok(amounts.includes('1000000'));
  assert.ok(amounts.every(x=>BigInt(x)<=1000000000000n));
  assert.equal(chooseFixtureAmountV1({rng:()=>0,param:{type:'uint32'},valuePool:pool,chosenAddresses:[token]}),null);
  assert.equal(chooseFixtureAmountV1({rng:()=>0,param:{type:'uint256',name:'deadline'},valuePool:pool,chosenAddresses:[token]}),null);
  assert.equal(chooseFixtureAmountV1({rng:()=>0,param:{type:'uint256',name:'poolIndex'},valuePool:pool,chosenAddresses:[token]}),null);
  assert.notEqual(chooseFixtureAmountV1({rng:()=>0,param:{type:'uint256',name:'amountIn'},valuePool:pool,chosenAddresses:[token]}),null);
});

test('Stage-1 Medusa router embeds value-pool address constants without targeting the seed helper',()=>{
  const abi=['function act(address,uint256)'];
  const iface=new ethers.Interface(abi),fragment=iface.getFunction('act');
  const target={
    qualifiedName:'Generic.sol:Target',
    logicalQualifiedName:'Generic.sol:Target',
    address:'0x0000000000000000000000000000000000000011',
    artifact:{abi},
    functions:[{fragment,signature:'act(address,uint256)',semanticFamily:'OTHER',accounting:false}]
  };
  const seed='0x0000000000000000000000000000000000000022';
  const router=renderMedusaRouterV2(ethers,[target],{addresses:[seed]});
  assert.match(router.source,/function p0_seed_addresses\(\)/);
  assert.match(router.source,/0x0000000000000000000000000000000000000022/i);
  const cfg=buildMedusaConfigV2({anvilUrl:'http://127.0.0.1:1',blockNumber:1,routerRows:router.rows,checked:false,callLimit:10});
  assert.ok(cfg.fuzzing.testing.targetFunctionSignatures.every(x=>!x.includes('p0_seed_addresses')));
});


function compileStage2Contracts(){
  const input={
    language:'Solidity',
    sources:{'Stage2.sol':{content:\`// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

contract GenericToken {
  mapping(address => uint256) private balances;
  mapping(address => mapping(address => uint256)) public allowance;
  uint8 public constant decimals = 18;
  uint256 public totalSupply = 1000000000 ether;
  function balanceOf(address account) external view returns (uint256) { return balances[account]; }
  function approve(address spender, uint256 amount) external returns (bool) {
    allowance[msg.sender][spender] = amount;
    return true;
  }
}

contract GenericChild {
  address public first;
  address public second;
  constructor(address first_, address second_) {
    first = first_;
    second = second_;
  }
}

contract AlwaysRevertCreator {
  error Nope();
  function create(address[] calldata tokens) external pure returns (address) {
    if (tokens.length >= 0) revert Nope();
    return address(0);
  }
}

contract GenericFactory {
  error UnauthorizedCaller();
  address public owner;
  event Created(address indexed child, address indexed first, address second);
  constructor() { owner = msg.sender; }

  function create(
    address[] calldata tokens,
    uint256[] calldata weights,
    uint256 fee,
    address hook,
    string calldata label,
    bytes32 salt,
    bytes calldata extra
  ) external returns (address child) {
    if (msg.sender != owner) revert UnauthorizedCaller();
    require(tokens.length >= 2, "TOKENS");
    require(weights.length == tokens.length, "WEIGHTS");
    require(bytes(label).length > 0, "LABEL");
    require(extra.length == 0, "EXTRA");
    require(fee <= 1e17, "FEE");
    if (hook != address(0) && salt == bytes32(0)) revert("HOOK_SALT");
    child = address(new GenericChild(tokens[0], tokens[1]));
    emit Created(child, tokens[0], tokens[1]);
  }
}\`}},
    settings:{outputSelection:{'*':{'*':['abi','evm.bytecode.object','evm.deployedBytecode.object','evm.deployedBytecode.linkReferences']}}}
  };
  const output=JSON.parse(solc.compile(JSON.stringify(input)));
  const failures=(output.errors??[]).filter(x=>x.severity==='error');
  assert.deepEqual(failures,[]);
  return output.contracts['Stage2.sol'];
}
function normalizedTestArtifact(sourceName,contractName,artifact){
  return{
    sourceName,contractName,abi:artifact.abi,
    bytecode:'0x'+artifact.evm.bytecode.object,
    deployedBytecode:'0x'+artifact.evm.deployedBytecode.object,
    deployedLinkReferences:artifact.evm.deployedBytecode.linkReferences??{}
  };
}
function stage2Target(address,artifact){
  const iface=new ethers.Interface(artifact.abi);
  const fragment=iface.getFunction('create(address[],uint256[],uint256,address,string,bytes32,bytes)');
  return{
    qualifiedName:'Stage2.sol:GenericFactory',
    address,
    artifact,
    functions:[{fragment,signature:fragment.format('sighash'),accounting:false,semanticFamily:'OTHER'}]
  };
}

test('Stage-2 creator candidate discovery and structured arguments cover token arrays, parallel arrays, and bounded fee values',()=>{
  const compiled=compileStage2Contracts();
  const target=stage2Target('0x0000000000000000000000000000000000000100',{abi:compiled.GenericFactory.abi});
  const candidates=discoverCreatorCandidatesV1({targets:[target]});
  assert.equal(candidates.length,1);
  const tokenA='0x0000000000000000000000000000000000000001';
  const tokenB='0x0000000000000000000000000000000000000002';
  const pool={
    tokens:[
      {address:tokenB,decimals:18,fundedAmount:'1000000000000000000000000'},
      {address:tokenA,decimals:18,fundedAmount:'1000000000000000000000000'}
    ],
    addresses:[tokenA,tokenB],created:[],privileged:[],associations:{}
  };
  const built=buildCreatorArgumentsV1({
    ethers,candidate:candidates[0],attempt:0,
    actor:'0x00000000000000000000000000000000000000aa',
    valuePool:pool,targets:[target]
  });
  assert.deepEqual(built.args[0],[ethers.getAddress(tokenA),ethers.getAddress(tokenB)]);
  assert.equal(built.args[1].length,built.args[0].length);
  assert.equal(built.args[1].reduce((a,b)=>a+BigInt(b),0n),10n**18n);
  assert.ok(BigInt(built.args[2])<=10n**17n);
  assert.equal(built.args[4],'P0');
  assert.equal(built.args[6],'0x');
});

test('Stage-2 executes a creator through privileged retry, detects the child, and binds it by runtime bytecode on local Anvil',async()=>{
  const {child,provider}=await startLocalAnvil();
  try{
    const compiled=compileStage2Contracts();
    const token1=await deployArtifact(provider,compiled.GenericToken);
    const token2=await deployArtifact(provider,compiled.GenericToken);
    const factory=await deployArtifact(provider,compiled.GenericFactory);
    const accounts=await provider.send('eth_accounts',[]);
    const artifacts=[
      normalizedTestArtifact('Stage2.sol','GenericToken',compiled.GenericToken),
      normalizedTestArtifact('Stage2.sol','GenericChild',compiled.GenericChild),
      normalizedTestArtifact('Stage2.sol','GenericFactory',compiled.GenericFactory)
    ];
    const factoryArtifact=artifacts.find(x=>x.contractName==='GenericFactory');
    const target=stage2Target(await factory.getAddress(),factoryArtifact);
    const pool={
      addresses:[await factory.getAddress(),await token1.getAddress(),await token2.getAddress()],
      tokens:[
        {address:await token1.getAddress(),decimals:18,fundedAmount:(10n**24n).toString()},
        {address:await token2.getAddress(),decimals:18,fundedAmount:(10n**24n).toString()}
      ],
      associations:{},privileged:[ethers.getAddress(accounts[0])],created:[],receipts:[],gaps:[]
    };
    const result=await executeCreatorSynthesisV1({
      provider,ethers,targets:[target],actors:[accounts[1]],valuePool:pool,artifacts,
      maxAttemptsPerCandidate:24,maxSuccessesPerCandidate:1,maxCreatedContracts:3
    });
    assert.equal(result.candidates,1);
    assert.equal(result.creations.length,1);
    assert.equal(result.creations[0].sender.toLowerCase(),accounts[0].toLowerCase());
    assert.ok(result.creationGaps[0].topDecodedRevertReasons.some(x=>x.reason==='UnauthorizedCaller()'));
    assert.equal(result.createdDeployments.length,1);
    assert.equal(result.createdDeployments[0].qualifiedName,'Stage2.sol:GenericChild');
    assert.equal(result.createdDeployments[0].mappingStatus,'MATCHED_RUNTIME_BYTECODE');
    assert.equal(pool.created.length,1);
    assert.ok(result.creations[0].createdAddresses.includes(pool.created[0]));

    const rebound=await bindCreatedContractV1({provider,ethers,address:pool.created[0],artifacts,probeHolder:accounts[0]});
    assert.equal(rebound.deployment.qualifiedName,'Stage2.sol:GenericChild');
  }finally{
    await provider.destroy();
    child.kill('SIGTERM');
  }
});

test('Stage-2 runner executes creator synthesis before the shared Medusa/telemetry baseline and carries created targets forward',()=>{
  const runner=fs.readFileSync(path.join(root,'packages/github-native-sim/src/phase0-randomized-simulation-v1.mjs'),'utf8');
  const creatorAt=runner.indexOf('executeCreatorSynthesisV1({');
  const baselineAt=runner.indexOf('baselineSnapshot=await provider.send');
  assert.ok(creatorAt>0&&baselineAt>creatorAt);
  assert.match(runner,/maxAttemptsPerCandidate:24,maxSuccessesPerCandidate:3/);
  assert.match(runner,/20-\(valuePool\.created\?\.length\?\?0\)/);
  assert.match(runner,/targets\.push\(target\)/);
  assert.match(runner,/STAGE_2_CREATOR_DISCOVERY_AND_EXECUTION/);
  assert.match(runner,/createdSpenderApprovals/);
  assert.match(runner,/createdTokenFunding/);
});


test('Stage-2 enforces the 24-attempt ceiling and retains decoded attempt evidence for a creator that never succeeds',async()=>{
  const {child,provider}=await startLocalAnvil();
  try{
    const compiled=compileStage2Contracts();
    const token1=await deployArtifact(provider,compiled.GenericToken);
    const token2=await deployArtifact(provider,compiled.GenericToken);
    const reverter=await deployArtifact(provider,compiled.AlwaysRevertCreator);
    const accounts=await provider.send('eth_accounts',[]);
    const artifact=normalizedTestArtifact('Stage2.sol','AlwaysRevertCreator',compiled.AlwaysRevertCreator);
    const iface=new ethers.Interface(artifact.abi),fragment=iface.getFunction('create(address[])');
    const target={
      qualifiedName:'Stage2.sol:AlwaysRevertCreator',address:await reverter.getAddress(),artifact,
      functions:[{fragment,signature:fragment.format('sighash'),accounting:false,semanticFamily:'OTHER'}]
    };
    const pool={
      addresses:[await reverter.getAddress(),await token1.getAddress(),await token2.getAddress()],
      tokens:[
        {address:await token1.getAddress(),decimals:18,fundedAmount:(10n**24n).toString()},
        {address:await token2.getAddress(),decimals:18,fundedAmount:(10n**24n).toString()}
      ],
      associations:{},privileged:[],created:[],receipts:[],gaps:[]
    };
    const result=await executeCreatorSynthesisV1({
      provider,ethers,targets:[target],actors:[accounts[0]],valuePool:pool,artifacts:[artifact],
      maxAttemptsPerCandidate:24,maxSuccessesPerCandidate:3,maxCreatedContracts:20
    });
    assert.equal(result.creations.length,0);
    assert.equal(result.creationGaps.length,1);
    assert.equal(result.creationGaps[0].attemptCount,24);
    assert.equal(result.creationGaps[0].attempts.length,24);
    assert.equal(result.creationGaps[0].successes,0);
    assert.ok(result.creationGaps[0].topDecodedRevertReasons.some(x=>x.reason==='Nope()'&&x.count===24));
  }finally{
    await provider.destroy();
    child.kill('SIGTERM');
  }
});
