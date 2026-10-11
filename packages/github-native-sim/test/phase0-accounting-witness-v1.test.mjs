import test from 'node:test';
import assert from 'node:assert/strict';
import {accountingWitnessPlanV1,snapshot} from '../src/phase0-randomized-simulation-v1.mjs';

const sender='0x0000000000000000000000000000000000000001';
const vault='0x0000000000000000000000000000000000000002';
const pool='0x0000000000000000000000000000000000000003';
const tokenA='0x0000000000000000000000000000000000000004';
const tokenB='0x0000000000000000000000000000000000000005';
const router='0x0000000000000000000000000000000000000006';
const targets=Array.from({length:30},(_,i)=>({address:'0x'+String(100+i).padStart(40,'0')}));
const ctx={protocol:'BALANCER_V3',poolAddress:pool,vaultAddress:vault,tokens:[tokenA,tokenB]};
const target={address:router,artifact:{abi:[]},accountingContext:ctx,recipeRuntime:{}};
const plan={zero:[],address:[],addressPair:[]};
const ethers={
  Contract:class {
    constructor(address){this.address=address.toLowerCase();}
    getFunction(signature){
      return{staticCall:async (...args)=>{
        reads.push({address:this.address,signature,args});
        if(signature==='balanceOf(address)')return args[0]?.toLowerCase()===vault.toLowerCase()?10000n:1000n;
        if(signature==='totalSupply()')return 100000n;
        if(signature==='allowance(address,address)')return 9000n;
        throw Error('Unexpected read '+signature);
      }};
    }
  }
};
let reads=[];
const provider={
  getBalance:async()=>{throw Error('Native ETH sweep is forbidden for ERC20-only Balancer actions');}
};

test('swap witness reads only trader and Vault balances for the actual registered input/output tokens',async()=>{
  reads=[];
  const witness=accountingWitnessPlanV1({
    target,selected:{signature:'swapSingleTokenExactIn(address,address,address,uint256,uint256,uint256,bool,bytes)'},
    protocolPlan:{kind:'READY',pool},qualifiedAction:{args:[pool,tokenB,tokenA,1n,0n,1n,false,'0x']},value:0n
  });
  assert.equal(witness.mode,'BALANCER_V3');
  assert.equal(witness.operation,'SWAP');
  assert.equal(witness.includeBpt,false);
  assert.deepEqual(witness.tokens,[tokenB.toLowerCase(),tokenA.toLowerCase()]);
  const snapshotValue=await snapshot({provider,ethers,target,sender,plan,systemTargets:targets,witness});
  assert.deepEqual(Object.keys(snapshotValue.related).sort(),[tokenA.toLowerCase(),tokenB.toLowerCase()].sort());
  assert.equal(Object.keys(snapshotValue.systemNative).length,0);
  assert.equal(Object.keys(snapshotValue.native).length,0);
  assert.equal(reads.length,4);
  assert.ok(reads.every(x=>x.signature==='balanceOf(address)'));
  assert.equal(reads.filter(x=>x.args[0]?.toLowerCase()===vault.toLowerCase()).length,2);
});

test('liquidity withdrawal witness captures exact token balances and user BPT balance + total supply',async()=>{
  reads=[];
  const witness=accountingWitnessPlanV1({
    target,selected:{signature:'removeLiquidityProportional(address,uint256,uint256[],bool,bytes)'},
    protocolPlan:{kind:'READY',pool},qualifiedAction:{args:[pool,100n,[0n,0n],false,'0x']}
  });
  assert.equal(witness.mode,'BALANCER_V3');
  assert.equal(witness.operation,'REMOVE_LIQUIDITY');
  assert.equal(witness.includeBpt,true);
  const result=await snapshot({provider,ethers,target,sender,plan,systemTargets:targets,witness});
  assert.equal(Object.keys(result.related).length,3);
  assert.deepEqual(Object.keys(result.related[pool.toLowerCase()]).sort(),['address','balanceSender','totalSupply'].sort());
  assert.equal(reads.length,6);
  assert.equal(reads.filter(x=>x.signature==='totalSupply()').length,1);
  assert.equal(Object.keys(result.systemNative).length,0);
});

test('fallback baseline observes local native balances, never unrelated deployed contract sweep',async()=>{
  let count=0;
  const nativeProvider={getBalance:async()=>{count++;return 1000n;}};
  const baseline=await snapshot({provider:nativeProvider,ethers,target:{address:router,artifact:{abi:[]},recipeRuntime:{}},sender,plan,systemTargets:targets});
  assert.equal(count,2);
  assert.deepEqual(Object.keys(baseline.native).sort(),['sender','target']);
  assert.deepEqual(baseline.systemNative,{});
});

test('generic transaction witness excludes native and allowance calls unless relevant',()=>{
  const transfer=accountingWitnessPlanV1({target:{},selected:{signature:'transfer(address,uint256)'},value:0n});
  assert.equal(transfer.mode,'TARGET_LOCAL');
  assert.equal(transfer.includeNative,false);
  assert.equal(transfer.includeAllowance,false);
  const approval=accountingWitnessPlanV1({target:{},selected:{signature:'approve(address,uint256)'},value:0n});
  assert.equal(approval.includeAllowance,true);
  assert.equal(accountingWitnessPlanV1({target:{},selected:{signature:'sendNative(address,uint256)'},value:0n}).includeNative,true);
});
