import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import os from 'node:os';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import solc from 'solc';
import * as ethers from 'ethers';
import {buildCompiledArtifactErrorSelectorIndexV1,decodeTelemetryRevertReasonV1,topDecodedTelemetryRevertsV1,discoverValuePoolV1,fundActorsV1,PHASE0_MEDUSA_SENDERS_V1,weightedFixtureAddressSeedV1,chooseFixtureAmountV1,discoverCreatorCandidatesV1,buildCreatorArgumentsV1,executeCreatorSynthesisV1,bindCreatedContractV1,refreshCreatedAssociationsV1,discoverActivationCandidatesV1,buildActivationArgumentsV1,executeActivationSynthesisV1} from '../src/phase0-fixture-synthesis-v1.mjs';
import {renderMedusaRouterV2,buildMedusaConfigV2,targetObjects,augmentDelegateProxyContextsV2,resolveTelemetryCallerContextV2,pickFn,runTelemetry} from '../src/phase0-randomized-simulation-v1.mjs';

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
    sources:{'Stage2.sol':{content:`// SPDX-License-Identifier: UNLICENSED
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
  function create(address[] calldata tokens) external returns (address) {
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
}`}},
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
  assert.match(runner,/creatorRounds:stage2Rounds/);
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


function compileStage3Contracts(){
  const source=[
    '// SPDX-License-Identifier: UNLICENSED',
    'pragma solidity ^0.8.20;',
    '',
    'contract ActivationToken {',
    '  mapping(address => uint256) private balances;',
    '  mapping(address => mapping(address => uint256)) public allowance;',
    '  uint8 public constant decimals = 18;',
    '  uint256 public totalSupply = 1000000000 ether;',
    '  function balanceOf(address account) external view returns (uint256) { return balances[account]; }',
    '  function approve(address spender, uint256 amount) external returns (bool) { allowance[msg.sender][spender] = amount; return true; }',
    '}',
    '',
    'contract CreatedPool {',
    '  error UnauthorizedCaller();',
    '  address public owner;',
    '  address[] private listed;',
    '  bool public initialized;',
    '  uint256 public totalLiquidity;',
    '  constructor(address first, address second, address owner_) { owner=owner_; listed.push(first); listed.push(second); }',
    '  function tokens() external view returns (address[] memory) { return listed; }',
    '  function initialize(uint256[] calldata amounts, uint256 minOut, uint256 deadline, bool flag, bytes calldata extra) external {',
    '    if (msg.sender != owner) revert UnauthorizedCaller();',
    '    require(!initialized, "ALREADY");',
    '    require(amounts.length == listed.length, "AMOUNTS");',
    '    require(minOut == 0, "MIN");',
    '    require(deadline == type(uint256).max, "DEADLINE");',
    '    require(!flag && extra.length == 0, "FLAGS");',
    '    for (uint256 i=0;i<amounts.length;i++) totalLiquidity += amounts[i];',
    '    initialized = true;',
    '  }',
    '}',
    '',
    'contract ActivationRegistry {',
    '  mapping(address => bool) public active;',
    '  function activate(address pool, address[] calldata tokens, uint256[] calldata amounts, uint256 minOut, uint256 deadline) external {',
    '    require(tokens.length == amounts.length, "LENGTH");',
    '    require(minOut == 0, "MIN");',
    '    require(deadline == type(uint256).max, "DEADLINE");',
    '    active[pool] = true;',
    '  }',
    '}',
    '',
    'contract AlwaysRevertPool {',
    '  error NotInitialized(address dependency);',
    '  function initialize(address dependency) external { revert NotInitialized(dependency); }',
    '}',
    '',
    'interface InitializationState { function initialized() external view returns (bool); }',
    'contract SimpleInitializable {',
    '  bool public initialized;',
    '  function initialize() external { initialized = true; }',
    '}',
    'contract DependentPool {',
    '  error NotInitialized(address dependency);',
    '  bool public active;',
    '  function start(address dependency) external {',
    '    if (!InitializationState(dependency).initialized()) revert NotInitialized(dependency);',
    '    active = true;',
    '  }',
    '}'
  ].join('\n');
  const input={
    language:'Solidity',
    sources:{'Stage3.sol':{content:source}},
    settings:{outputSelection:{'*':{'*':['abi','evm.bytecode.object','evm.deployedBytecode.object','evm.deployedBytecode.linkReferences']}}}
  };
  const output=JSON.parse(solc.compile(JSON.stringify(input)));
  const failures=(output.errors??[]).filter(x=>x.severity==='error');
  assert.deepEqual(failures,[]);
  return output.contracts['Stage3.sol'];
}
function stage3MutableTarget(address,sourceName,contractName,artifact){
  const iface=new ethers.Interface(artifact.abi);
  const functions=iface.fragments
    .filter(fragment=>fragment.type==='function'&&!['view','pure'].includes(fragment.stateMutability))
    .map(fragment=>({fragment,signature:fragment.format('sighash'),accounting:false,semanticFamily:'OTHER'}));
  return{qualifiedName:sourceName+':'+contractName,address,artifact,functions};
}

test('Stage-3 re-harvests created associations and builds created-address, token-array, amount-array, min-out and deadline arguments',async()=>{
  const {child,provider}=await startLocalAnvil();
  try{
    const compiled=compileStage3Contracts();
    const token1=await deployArtifact(provider,compiled.ActivationToken);
    const token2=await deployArtifact(provider,compiled.ActivationToken);
    const accounts=await provider.send('eth_accounts',[]);
    const pool=await deployArtifact(provider,compiled.CreatedPool,[await token1.getAddress(),await token2.getAddress(),accounts[0]]);
    const registry=await deployArtifact(provider,compiled.ActivationRegistry);
    const artifacts=[
      normalizedTestArtifact('Stage3.sol','ActivationToken',compiled.ActivationToken),
      normalizedTestArtifact('Stage3.sol','CreatedPool',compiled.CreatedPool),
      normalizedTestArtifact('Stage3.sol','ActivationRegistry',compiled.ActivationRegistry)
    ];
    const poolArtifact=artifacts.find(x=>x.contractName==='CreatedPool');
    const registryArtifact=artifacts.find(x=>x.contractName==='ActivationRegistry');
    const targets=[
      stage3MutableTarget(await pool.getAddress(),'Stage3.sol','CreatedPool',poolArtifact),
      stage3MutableTarget(await registry.getAddress(),'Stage3.sol','ActivationRegistry',registryArtifact)
    ];
    const valuePool={addresses:[await pool.getAddress()],tokens:[],associations:{},privileged:[ethers.getAddress(accounts[0])],created:[await pool.getAddress()],receipts:[],gaps:[]};
    const harvest=await refreshCreatedAssociationsV1({
      provider,ethers,createdAddresses:valuePool.created,targets,
      bindings:[{address:await pool.getAddress(),qualifiedName:'Stage3.sol:CreatedPool'}],
      artifacts,valuePool
    });
    const associations=[...valuePool.associations[ethers.getAddress(await pool.getAddress())]];
    const token1Address=await token1.getAddress(),token2Address=await token2.getAddress();
    assert.ok(associations.some(x=>x.toLowerCase()===token1Address.toLowerCase()));
    assert.ok(associations.some(x=>x.toLowerCase()===token2Address.toLowerCase()));
    assert.equal(harvest.newTokens.length,2);
    const associationFunding=await fundActorsV1({
      provider,ethers,tokens:harvest.newTokens,holders:[accounts[0],accounts[1]],
      spenders:[await pool.getAddress(),await registry.getAddress()]
    });
    assert.equal(associationFunding.receiptCounts.gaps,0);

    const candidates=discoverActivationCandidatesV1({targets,createdAddress:await pool.getAddress()});
    assert.ok(candidates.some(x=>x.namedLocal&&x.selected.signature.startsWith('initialize(')));
    const external=candidates.find(x=>x.selected.signature.startsWith('activate('));
    assert.ok(external);
    const built=buildActivationArgumentsV1({ethers,candidate:external,attempt:0,actor:accounts[1],valuePool});
    assert.equal(String(built.args[0]).toLowerCase(),(await pool.getAddress()).toLowerCase());
    assert.equal(built.args[1].length,2);
    assert.deepEqual(built.args[2].map(String),[(10n**18n).toString(),(10n**18n).toString()]);
    assert.equal(BigInt(built.args[3]),0n);
    assert.equal(BigInt(built.args[4]),ethers.MaxUint256);
  }finally{
    await provider.destroy();
    child.kill('SIGTERM');
  }
});

test('Stage-3 initializes a created pool with associated-token amounts and privileged sender retry on local Anvil',async()=>{
  const {child,provider}=await startLocalAnvil();
  try{
    const compiled=compileStage3Contracts();
    const token1=await deployArtifact(provider,compiled.ActivationToken);
    const token2=await deployArtifact(provider,compiled.ActivationToken);
    const accounts=await provider.send('eth_accounts',[]);
    const pool=await deployArtifact(provider,compiled.CreatedPool,[await token1.getAddress(),await token2.getAddress(),accounts[0]]);
    const artifacts=[
      normalizedTestArtifact('Stage3.sol','ActivationToken',compiled.ActivationToken),
      normalizedTestArtifact('Stage3.sol','CreatedPool',compiled.CreatedPool)
    ];
    const poolArtifact=artifacts.find(x=>x.contractName==='CreatedPool');
    const target=stage3MutableTarget(await pool.getAddress(),'Stage3.sol','CreatedPool',poolArtifact);
    const valuePool={addresses:[await pool.getAddress()],tokens:[],associations:{},privileged:[ethers.getAddress(accounts[0])],created:[await pool.getAddress()],receipts:[],gaps:[]};
    const harvest=await refreshCreatedAssociationsV1({
      provider,ethers,createdAddresses:valuePool.created,targets:[target],
      bindings:[{address:await pool.getAddress(),qualifiedName:'Stage3.sol:CreatedPool'}],
      artifacts,valuePool
    });
    const associationFunding=await fundActorsV1({
      provider,ethers,tokens:harvest.newTokens,holders:[accounts[0],accounts[1]],
      spenders:[await pool.getAddress()]
    });
    assert.equal(associationFunding.receiptCounts.gaps,0);
    const result=await executeActivationSynthesisV1({
      provider,ethers,targets:[target],actors:[accounts[1]],valuePool,artifacts,
      createdAddresses:valuePool.created,maxAttemptsPerCreated:30
    });
    const init=result.activations.find(row=>row.function.startsWith('initialize('));
    assert.ok(init);
    assert.equal(init.sender.toLowerCase(),accounts[0].toLowerCase());
    assert.equal(await pool.initialized(),true);
    assert.equal((await pool.totalLiquidity()).toString(),(2n*10n**18n).toString());
  }finally{
    await provider.destroy();
    child.kill('SIGTERM');
  }
});

test('Stage-3 enforces the 30-attempt ceiling per created contract and preserves decoded dependency reverts',async()=>{
  const {child,provider}=await startLocalAnvil();
  try{
    const compiled=compileStage3Contracts();
    const reverter=await deployArtifact(provider,compiled.AlwaysRevertPool);
    const accounts=await provider.send('eth_accounts',[]);
    const artifact=normalizedTestArtifact('Stage3.sol','AlwaysRevertPool',compiled.AlwaysRevertPool);
    const target=stage3MutableTarget(await reverter.getAddress(),'Stage3.sol','AlwaysRevertPool',artifact);
    const valuePool={addresses:[await reverter.getAddress()],tokens:[],associations:{},privileged:[],created:[await reverter.getAddress()],receipts:[],gaps:[]};
    const result=await executeActivationSynthesisV1({
      provider,ethers,targets:[target],actors:[accounts[0]],valuePool,artifacts:[artifact],
      createdAddresses:valuePool.created,maxAttemptsPerCreated:30
    });
    assert.equal(result.activations.length,0);
    assert.equal(result.activationGaps.length,1);
    assert.equal(result.activationGaps[0].attemptCount,30);
    assert.equal(result.activationGaps[0].attempts.length,30);
    assert.ok(result.activationGaps[0].topDecodedRevertReasons.some(x=>x.reason==='NotInitialized(address)'&&x.count===30));
    assert.ok(result.activationGaps[0].attempts.every(x=>x.dependency===true));
  }finally{
    await provider.destroy();
    child.kill('SIGTERM');
  }
});

test('Stage-3 prioritizes a created dependency named by NotInitialized(address) before resuming the blocked object',async()=>{
  const {child,provider}=await startLocalAnvil();
  try{
    const compiled=compileStage3Contracts();
    const dependency=await deployArtifact(provider,compiled.SimpleInitializable);
    const blocked=await deployArtifact(provider,compiled.DependentPool);
    const accounts=await provider.send('eth_accounts',[]);
    const dependencyArtifact=normalizedTestArtifact('Stage3.sol','SimpleInitializable',compiled.SimpleInitializable);
    const blockedArtifact=normalizedTestArtifact('Stage3.sol','DependentPool',compiled.DependentPool);
    const dependencyAddress=await dependency.getAddress(),blockedAddress=await blocked.getAddress();
    const targets=[
      stage3MutableTarget(blockedAddress,'Stage3.sol','DependentPool',blockedArtifact),
      stage3MutableTarget(dependencyAddress,'Stage3.sol','SimpleInitializable',dependencyArtifact)
    ];
    const valuePool={
      addresses:[blockedAddress,dependencyAddress],tokens:[],
      associations:{[ethers.getAddress(blockedAddress)]:new Set([ethers.getAddress(dependencyAddress)]),[ethers.getAddress(dependencyAddress)]:new Set()},
      privileged:[],created:[blockedAddress,dependencyAddress],receipts:[],gaps:[]
    };
    const result=await executeActivationSynthesisV1({
      provider,ethers,targets,actors:[accounts[0]],valuePool,artifacts:[blockedArtifact,dependencyArtifact],
      createdAddresses:[blockedAddress,dependencyAddress],maxAttemptsPerCreated:30
    });
    assert.equal(await dependency.initialized(),true);
    assert.equal(await blocked.active(),true);
    const initIndex=result.activations.findIndex(row=>row.createdAddress.toLowerCase()===dependencyAddress.toLowerCase()&&row.function==='initialize()');
    const startIndex=result.activations.findIndex(row=>row.createdAddress.toLowerCase()===blockedAddress.toLowerCase()&&row.function==='start(address)');
    assert.ok(initIndex>=0&&startIndex>initIndex);
  }finally{
    await provider.destroy();
    child.kill('SIGTERM');
  }
});

test('Stage-3 runner executes association refresh and activation before the shared Medusa/telemetry baseline',()=>{
  const runner=fs.readFileSync(path.join(root,'packages/github-native-sim/src/phase0-randomized-simulation-v1.mjs'),'utf8');
  const harvestAt=runner.indexOf('refreshCreatedAssociationsV1({');
  const activationAt=runner.indexOf('executeActivationSynthesisV1({');
  const baselineAt=runner.indexOf('baselineSnapshot=await provider.send');
  assert.ok(harvestAt>0&&activationAt>harvestAt&&baselineAt>activationAt);
  assert.match(runner,/maxAttemptsPerCreated:30/);
  assert.match(runner,/activations:stage3Activation\.activations/);
  assert.match(runner,/activationGaps:stage3Activation\.activationGaps/);
  assert.match(runner,/associationTokenFunding/);
});


function compileStage4Contracts(){
  const source=[
    '// SPDX-License-Identifier: UNLICENSED',
    'pragma solidity ^0.8.20;',
    '',
    'contract VaultMarker {}',
    '',
    'contract CallbackOnly {',
    '  error SenderIsNotVault(address expected);',
    '  address public immutable vault;',
    '  uint256 public calls;',
    '  constructor(address vault_) { vault = vault_; }',
    '  function callback(uint256 value) external {',
    '    if (msg.sender != vault) revert SenderIsNotVault(vault);',
    '    calls += value + 1;',
    '  }',
    '}',
    '',
    'contract KnownCaller {',
    '  uint256 public pings;',
    '  function ping() external { pings++; }',
    '}',
    '',
    'contract AssociationGate {',
    '  error OnlyVault();',
    '  address public immutable allowed;',
    '  constructor(address allowed_) { allowed = allowed_; }',
    '  function callback() external { if (msg.sender != allowed) revert OnlyVault(); }',
    '}',
    '',
    'contract OwnerOnly {',
    '  error NotOwner();',
    '  address public owner;',
    '  uint256 public calls;',
    '  constructor(address owner_) { owner = owner_; }',
    '  function ownerOnly() external { if (msg.sender != owner) revert NotOwner(); calls++; }',
    '}',
    '',
    'contract UnresolvedGate {',
    '  error OnlyVault();',
    '  function callback() external { revert OnlyVault(); }',
    '}',
    '',
    'contract DelegateExtension {',
    '  error NotDelegateCall();',
    '  address private immutable SELF;',
    '  uint256 public counter;',
    '  constructor() { SELF = address(this); }',
    '  function doThing(uint256 value) external {',
    '    if (address(this) == SELF) revert NotDelegateCall();',
    '    counter += value + 1;',
    '  }',
    '}',
    '',
    'contract FallbackFacade {',
    '  address private immutable impl;',
    '  constructor(address impl_) { impl = impl_; }',
    '  fallback() external payable {',
    '    (bool ok,) = impl.delegatecall(msg.data);',
    '    require(ok, "DELEGATE_FAILED");',
    '  }',
    '}'
  ].join('\n');
  const input={
    language:'Solidity',
    sources:{'Stage4.sol':{content:source}},
    settings:{outputSelection:{'*':{'*':['abi','evm.bytecode.object','evm.deployedBytecode.object','evm.deployedBytecode.linkReferences']}}}
  };
  const output=JSON.parse(solc.compile(JSON.stringify(input)));
  const failures=(output.errors??[]).filter(row=>row.severity==='error');
  assert.deepEqual(failures,[]);
  return output.contracts['Stage4.sol'];
}
function stage4Artifact(name,compiled){
  return normalizedTestArtifact('Stage4.sol',name,compiled[name]);
}
function stage4Deployment(name,address){
  return{qualifiedName:'Stage4.sol:'+name,contractName:name,sourceName:'Stage4.sol',address};
}


test('Stage-4 resolves callback-only callers from a decoded address and remembers the sender',async()=>{
  const {child,provider}=await startLocalAnvil();
  try{
    const compiled=compileStage4Contracts(),vault=await deployArtifact(provider,compiled.VaultMarker);
    const callback=await deployArtifact(provider,compiled.CallbackOnly,[await vault.getAddress()]);
    const accounts=await provider.send('eth_accounts',[]);
    const artifact=stage4Artifact('CallbackOnly',compiled);
    const target=targetObjects(ethers,[artifact],[stage4Deployment('CallbackOnly',await callback.getAddress())],{})[0];
    const selected=target.functions.find(row=>row.signature==='callback(uint256)');
    const iface=new ethers.Interface(artifact.abi),callerState=new Map(),weights=new Map();
    const first=await resolveTelemetryCallerContextV2({
      provider,ethers,target,selected,iface,args:[1n],value:0n,defaultSender:accounts[1],
      targets:[target],valuePool:{associations:{},privileged:[]},callerState,weightMultipliers:weights
    });
    assert.equal(first.success,true);
    assert.equal(first.resolution,'IMPERSONATED_CALLER:'+ethers.getAddress(await vault.getAddress()));
    const second=await resolveTelemetryCallerContextV2({
      provider,ethers,target,selected,iface,args:[2n],value:0n,defaultSender:accounts[2],
      targets:[target],valuePool:{associations:{},privileged:[]},callerState,weightMultipliers:weights
    });
    assert.equal(second.success,true);
    assert.equal(second.reused,true);
    assert.equal(second.sender.toLowerCase(),(await vault.getAddress()).toLowerCase());
  }finally{
    await provider.destroy();
    child.kill('SIGTERM');
  }
});

test('Stage-4 uses a target association as callback caller when the revert has no address argument',async()=>{
  const {child,provider}=await startLocalAnvil();
  try{
    const compiled=compileStage4Contracts(),known=await deployArtifact(provider,compiled.KnownCaller);
    const gate=await deployArtifact(provider,compiled.AssociationGate,[await known.getAddress()]);
    const accounts=await provider.send('eth_accounts',[]);
    const artifacts=[stage4Artifact('KnownCaller',compiled),stage4Artifact('AssociationGate',compiled)];
    const deployed=[stage4Deployment('KnownCaller',await known.getAddress()),stage4Deployment('AssociationGate',await gate.getAddress())];
    const targets=targetObjects(ethers,artifacts,deployed,{});
    const target=targets.find(row=>row.qualifiedName==='Stage4.sol:AssociationGate');
    const selected=target.functions.find(row=>row.signature==='callback()'),iface=new ethers.Interface(target.artifact.abi);
    const knownAddress=ethers.getAddress(await known.getAddress()),gateAddress=ethers.getAddress(await gate.getAddress());
    const result=await resolveTelemetryCallerContextV2({
      provider,ethers,target,selected,iface,args:[],value:0n,defaultSender:accounts[1],targets,
      valuePool:{associations:{[knownAddress]:new Set([gateAddress])},privileged:[]},
      callerState:new Map(),weightMultipliers:new Map()
    });
    assert.equal(result.success,true);
    assert.equal(result.resolution,'IMPERSONATED_CALLER:'+knownAddress);
  }finally{
    await provider.destroy();
    child.kill('SIGTERM');
  }
});

test('Stage-4 retries auth-gated functions with privileged callers',async()=>{
  const {child,provider}=await startLocalAnvil();
  try{
    const compiled=compileStage4Contracts(),accounts=await provider.send('eth_accounts',[]);
    const ownerOnly=await deployArtifact(provider,compiled.OwnerOnly,[accounts[0]]);
    const artifact=stage4Artifact('OwnerOnly',compiled),target=targetObjects(ethers,[artifact],[stage4Deployment('OwnerOnly',await ownerOnly.getAddress())],{})[0];
    const selected=target.functions.find(row=>row.signature==='ownerOnly()'),iface=new ethers.Interface(artifact.abi);
    const result=await resolveTelemetryCallerContextV2({
      provider,ethers,target,selected,iface,args:[],value:0n,defaultSender:accounts[1],targets:[target],
      valuePool:{associations:{},privileged:[accounts[0]]},callerState:new Map(),weightMultipliers:new Map()
    });
    assert.equal(result.success,true);
    assert.equal(result.resolution,'PRIVILEGED:'+ethers.getAddress(accounts[0]));
  }finally{
    await provider.destroy();
    child.kill('SIGTERM');
  }
});

test('Stage-4 unresolved context is kept at ten-percent selection weight instead of excluded',async()=>{
  const {child,provider}=await startLocalAnvil();
  try{
    const compiled=compileStage4Contracts(),accounts=await provider.send('eth_accounts',[]);
    const gate=await deployArtifact(provider,compiled.UnresolvedGate);
    const artifact=stage4Artifact('UnresolvedGate',compiled),target=targetObjects(ethers,[artifact],[stage4Deployment('UnresolvedGate',await gate.getAddress())],{})[0];
    const selected=target.functions.find(row=>row.signature==='callback()'),iface=new ethers.Interface(artifact.abi),weights=new Map();
    const result=await resolveTelemetryCallerContextV2({
      provider,ethers,target,selected,iface,args:[],value:0n,defaultSender:accounts[1],targets:[target],
      valuePool:{associations:{},privileged:[]},callerState:new Map(),weightMultipliers:weights
    });
    const key=`${target.address.toLowerCase()}|${target.logicalQualifiedName??target.qualifiedName}|${selected.signature}`;
    assert.equal(result.success,false);
    assert.equal(result.resolution,'UNRESOLVED');
    assert.equal(weights.get(key),0.1);
    const picked=pickFn(target,()=>0,'OTHER_STATE_CHANGE',new Map(),new Set(),weights);
    assert.equal(picked.selectionKey,key);
    assert.equal(picked.selectionWeightMultiplier,0.1);
    assert.equal(picked.feedbackWeight,0.1);
  }finally{
    await provider.destroy();
    child.kill('SIGTERM');
  }
});


test('Stage-4 discovers a fallback-only facade by selector response and routes delegate-only calls through it',async()=>{
  const {child,provider}=await startLocalAnvil();
  try{
    const compiled=compileStage4Contracts(),extension=await deployArtifact(provider,compiled.DelegateExtension);
    const facade=await deployArtifact(provider,compiled.FallbackFacade,[await extension.getAddress()]);
    const accounts=await provider.send('eth_accounts',[]);
    const artifacts=[stage4Artifact('DelegateExtension',compiled),stage4Artifact('FallbackFacade',compiled)];
    const deployed=[stage4Deployment('DelegateExtension',await extension.getAddress()),stage4Deployment('FallbackFacade',await facade.getAddress())];
    const direct=targetObjects(ethers,artifacts,deployed,{});
    assert.equal(direct.some(row=>row.qualifiedName==='Stage4.sol:FallbackFacade'),false);
    const augmented=await augmentDelegateProxyContextsV2({provider,ethers,targets:direct,artifacts,deployed,sourceIntelligence:{},associations:{},probeSelectors:true});
    const facadeTarget=augmented.targets.find(row=>row.contextType==='FACADE'&&row.logicalQualifiedName==='Stage4.sol:DelegateExtension');
    assert.ok(facadeTarget);
    assert.equal(facadeTarget.address.toLowerCase(),(await facade.getAddress()).toLowerCase());
    assert.ok(augmented.contextEvidence.some(row=>row.discoveryBasis==='SELECTOR_ANSWERED_BY_FACADE'));

    const directTarget=augmented.targets.find(row=>(row.contextType??'DIRECT')==='DIRECT'&&row.qualifiedName==='Stage4.sol:DelegateExtension');
    const selected=directTarget.functions.find(row=>row.signature==='doThing(uint256)'),iface=new ethers.Interface(directTarget.artifact.abi);
    const resolved=await resolveTelemetryCallerContextV2({
      provider,ethers,target:directTarget,selected,iface,args:[1n],value:0n,defaultSender:accounts[0],targets:augmented.targets,
      valuePool:{associations:{},privileged:[]},callerState:new Map(),weightMultipliers:new Map()
    });
    assert.equal(resolved.success,true);
    assert.equal(resolved.resolution,'FACADE:'+ethers.getAddress(await facade.getAddress()));
    assert.equal(resolved.executionAddress.toLowerCase(),(await facade.getAddress()).toLowerCase());
  }finally{
    await provider.destroy();
    child.kill('SIGTERM');
  }
});

test('Stage-4 telemetry emits per-function callerResolution evidence and reuses a learned privileged caller',async()=>{
  const {child,provider}=await startLocalAnvil();
  const outRoot=fs.mkdtempSync(path.join(os.tmpdir(),'phase0-stage4-'));
  try{
    const compiled=compileStage4Contracts(),accounts=await provider.send('eth_accounts',[]);
    const ownerOnly=await deployArtifact(provider,compiled.OwnerOnly,[accounts[0]]);
    const artifact=stage4Artifact('OwnerOnly',compiled),targets=targetObjects(ethers,[artifact],[stage4Deployment('OwnerOnly',await ownerOnly.getAddress())],{});
    const baselineSnapshot=await provider.send('evm_snapshot',[]);
    const runs=await runTelemetry({
      provider,ethers,targets,actors:[accounts[1]],outRoot,baselineSnapshot,artifacts:[artifact],
      valuePool:{addresses:[await ownerOnly.getAddress()],tokens:[],associations:{},privileged:[accounts[0]],created:[]},
      telemetryRuns:1,callsPerRun:3,seedSalt:'stage4-owner-resolution'
    });
    assert.equal(runs.length,1);
    const row=runs[0].byFunction['Stage4.sol:OwnerOnly::ownerOnly()'];
    assert.ok(row);
    assert.equal(row.calls,3);
    assert.equal(row.callerResolution,'PRIVILEGED:'+ethers.getAddress(accounts[0]));
    assert.equal(runs[0].minedSuccess,3);
  }finally{
    fs.rmSync(outRoot,{recursive:true,force:true});
    await provider.destroy();
    child.kill('SIGTERM');
  }
});

test('Stage-4 runner prepares contexts before baseline and persists learned caller resolutions into fixture evidence',()=>{
  const runner=fs.readFileSync(path.join(root,'packages/github-native-sim/src/phase0-randomized-simulation-v1.mjs'),'utf8');
  const preparationAt=runner.indexOf('stage4ContextPreparation=');
  const baselineAt=runner.indexOf('baselineSnapshot=await provider.send');
  const telemetryAt=runner.indexOf('telemetry=await runTelemetry');
  const rewriteAt=runner.indexOf('fixtureEvidence.callerResolutions=callerResolutionEvidence');
  assert.ok(preparationAt>0&&baselineAt>preparationAt&&telemetryAt>baselineAt&&rewriteAt>telemetryAt);
  assert.match(runner,/STAGE_4_CONTEXT_CORRECT_CALLERS/);
  assert.match(runner,/contextCallerPreparation:stage4ContextPreparation/);
  assert.match(runner,/callerResolutions=callerResolutionEvidence/);
});
