import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import solc from 'solc';
import * as ethers from 'ethers';
import {buildAccountingBaselineEvidenceV1} from '../src/phase0-randomized-simulation-v1.mjs';
import {discoverCreatorCandidatesV1,executeForkTokenAccountingWitnessV1} from '../src/phase0-fixture-synthesis-v1.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');

test('Phase 0 retains numerical project and token accounting values without counting them as transitions',()=>{
  const input={digestSha256:'abcdef',blockNumber:17,states:[{
    logicalQualifiedName:'Vault.sol:Vault',address:'0x0000000000000000000000000000000000000001',contextType:'DIRECT',
    observations:{
      views:{'totalAssets()':{ok:true,value:'123'},'totalSupply()':{ok:true,value:'88'},'broken()':{ok:false,error:'REVERT'}},
      related:{'0x0000000000000000000000000000000000000002':{address:'0x0000000000000000000000000000000000000002',balanceSender:{ok:true,value:'999'}}},
      native:{sender:'45'}
    }
  }]};
  const output=buildAccountingBaselineEvidenceV1(input);
  assert.equal(output.status,'BASELINE_ACCOUNTING_AVAILABLE');
  assert.equal(output.projectReadings,2);
  assert.equal(output.relatedTokenReadings,1);
  assert.equal(output.nativeReadings,1);
  assert.equal(output.failedAccountingReadings,1);
  assert.equal(output.successfulAccountingReadings,3);
  assert.equal(output.provesEconomicStateChange,false);
  assert.deepEqual(output.readings.filter(x=>x.scope==='PROJECT_ACCOUNTING_VIEW').map(x=>x.value),['123','88']);
});

test('Stage 2 no longer misclassifies grant, revoke or register configuration as created contracts',()=>{
  const address={baseType:'address',type:'address'};
  const funcs=['addGranter','addRevoker','registerPool','createPool'].map(name=>({
    signature:name+'(address)',
    fragment:{name,stateMutability:'nonpayable',inputs:[address],outputs:[]}
  }));
  const rows=discoverCreatorCandidatesV1({targets:[{address:'0x0000000000000000000000000000000000000001',qualifiedName:'T',functions:funcs}]});
  assert.deepEqual(rows.map(r=>r.selected.fragment.name),['createPool']);
});

async function port(){
  const s=net.createServer();
  await new Promise((resolve,reject)=>s.once('error',reject).listen(0,'127.0.0.1',resolve));
  const p=s.address().port;await new Promise(resolve=>s.close(resolve));return p;
}
test('Phase 0 real ERC20 accounting control verifies transfer deltas and reverts all fixture mutations',async()=>{
  const p=await port();
  const child=spawn(process.execPath,[path.join(root,'node_modules/@foundry-rs/anvil/bin.mjs'),'--host','127.0.0.1','--port',String(p),'--chain-id','31337','--silent'],{stdio:['ignore','ignore','pipe']});
  let stderr='';child.stderr.on('data',x=>{stderr+=String(x)});
  const provider=new ethers.JsonRpcProvider('http://127.0.0.1:'+p,31337,{staticNetwork:true,cacheTimeout:-1});
  try{
    let ready=false;for(let i=0;i<100;i++){try{await provider.getBlockNumber();ready=true;break}catch{await new Promise(r=>setTimeout(r,100))}}
    assert.ok(ready,'Anvil did not start: '+stderr);
    const source='pragma solidity ^0.8.20; contract TestToken { mapping(address=>uint256) public balanceOf; constructor(){balanceOf[msg.sender]=1000;} function transfer(address to,uint256 amount) external returns(bool){require(balanceOf[msg.sender]>=amount,"FUNDS");balanceOf[msg.sender]-=amount;balanceOf[to]+=amount;return true;} }';
    const compiled=JSON.parse(solc.compile(JSON.stringify({language:'Solidity',sources:{'TestToken.sol':{content:source}},settings:{outputSelection:{'*':{'*':['abi','evm.bytecode.object']}}}})));
    assert.deepEqual((compiled.errors??[]).filter(e=>e.severity==='error'),[]);
    const tokenData=compiled.contracts['TestToken.sol'].TestToken;
    const accounts=(await provider.send('eth_accounts',[])).slice(0,2);
    const token=await new ethers.ContractFactory(tokenData.abi,'0x'+tokenData.evm.bytecode.object,await provider.getSigner(0)).deploy();
    await token.waitForDeployment();
    const before=BigInt(await token.balanceOf(accounts[0]));
    const witness=await executeForkTokenAccountingWitnessV1({provider,ethers,actors:accounts,valuePool:{tokens:[{address:await token.getAddress(),fundedAmount:'1000'}]}});
    assert.equal(witness.status,'VERIFIED_FIXTURE_ACCOUNTING_TRANSITION');
    assert.equal(witness.verifiedTransitions,1);
    assert.equal(witness.countsAsProjectEconomicTransition,false);
    assert.equal(witness.attempts[0].delta.sender,'-1');
    assert.equal(witness.attempts[0].delta.receiver,'1');
    assert.equal(witness.attempts[0].snapshotRestored,true);
    assert.equal(await token.balanceOf(accounts[0]),before);
    assert.equal(await token.balanceOf(accounts[1]),0n);
  }finally{
    await provider.destroy();
    child.kill('SIGTERM');
  }
});
