import test from 'node:test';
import assert from 'node:assert/strict';
import * as ethers from 'ethers';
import {isBalancerV3TargetV1,balancerV3ActionRequirementsV1,buildBalancerV3ActionV1,balancerV3BptTransferRecipeV1,choosePoolV1,bptWithdrawalAmountV1} from '../src/phase0-balancer-v3-planner-v1.mjs';
import {buildBalancerV3CreatorArgumentsV1} from '../src/phase0-fixture-synthesis-v1.mjs';

const vault={qualifiedName:'@balancer-labs/v3-vault/contracts/Vault.sol:Vault',contextType:'DIRECT'};
const extension={qualifiedName:'@balancer-labs/v3-vault/contracts/VaultExtension.sol:VaultExtension',contextType:'DIRECT'};
const router={qualifiedName:'@balancer-labs/v3-vault/contracts/Router.sol:Router'};
const usdc='0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const weth='0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
const pool='0x0000000000000000000000000000000000000123';
const actors=['0x0000000000000000000000000000000000001000'];
const values={tokens:[{address:usdc,decimals:6,fundedAmount:'1000000000'},{address:weth,decimals:18,fundedAmount:'100000000000000000000'}]};
test('Balancer v3 refuses direct Vault swap and VaultExtension delegate calls',()=>{
  assert.equal(isBalancerV3TargetV1(router),true);
  assert.equal(balancerV3ActionRequirementsV1(vault,{signature:'swap((address,address))'}).kind,'UNROUTABLE');
  assert.equal(balancerV3ActionRequirementsV1(extension,{signature:'registerPool(address)'}).kind,'UNROUTABLE');
});
test('Balancer v3 router initialization uses uninitialized registered pool and Vault token order',()=>{
  const selected={signature:'initialize(address,address[],uint256[],uint256,bool,bytes)'};
  const discovery={pools:[{address:pool,registered:true,initialized:false,tokens:[weth,usdc]}]};
  const plan=buildBalancerV3ActionV1({target:router,selected,discovery,valuePool:values,actors});
  assert.equal(plan.kind,'READY');
  assert.deepEqual(plan.args,[pool,[weth,usdc],[1000000000000000000n,1000000n],0n,false,'0x']);
  assert.equal(plan.basis,'VERIFIED_VAULT_POOL_STATE_ROUTER_ARGUMENTS');
});
test('Balancer v3 router cannot fabricate liquidity calls without initialized pools',()=>{
  const selected={signature:'addLiquidityUnbalanced(address,uint256[],uint256,bool,bytes)'};
  const plan=buildBalancerV3ActionV1({target:router,selected,discovery:{pools:[{address:pool,initialized:false,tokens:[usdc,weth]}]},valuePool:values,actors});
  assert.deepEqual({kind:plan.kind,reason:plan.reason},{kind:'BLOCKED',reason:'NO_INITIALIZED_BALANCER_POOL'});
});
test('Balancer v3 uses two sorted real tokens and valid normalized weights in factory create',()=>{
  const tokenConfig={baseType:'tuple',type:'tuple',components:[{type:'address',name:'token'},{type:'uint8',name:'tokenType'},{type:'address',name:'rateProvider'},{type:'bool',name:'paysYieldFees'}]};
  const candidate={target:{qualifiedName:'@balancer-labs/v3-pool-weighted/contracts/WeightedPoolFactory.sol:WeightedPoolFactory'},selected:{fragment:{name:'create',inputs:[{type:'string',name:'name'},{type:'string',name:'symbol'},{baseType:'array',type:'tuple[]',name:'tokens',arrayChildren:tokenConfig},{baseType:'array',type:'uint256[]',name:'normalizedWeights',arrayChildren:{type:'uint256'}},{baseType:'tuple',type:'tuple',name:'roleAccounts',components:[{type:'address'},{type:'address'},{type:'address'}]},{type:'uint256',name:'swapFeePercentage'},{type:'address',name:'poolHooksContract'},{type:'bool',name:'enableDonation'},{type:'bool',name:'disableUnbalancedLiquidity'},{type:'bytes32',name:'salt'}]}}};
  const action=buildBalancerV3CreatorArgumentsV1({ethers,candidate,actor:actors[0],valuePool:values});
  assert.equal(action.basis,'BALANCER_V3_FACTORY_SORTED_TOKEN_CONFIG_AND_VALID_WEIGHTS');
  assert.deepEqual(action.args[2].map(x=>x[0]),[usdc,weth]);
  assert.deepEqual(action.args[3],[500000000000000000n,500000000000000000n]);
  assert.equal(action.args[5],10000000000000000n);
  assert.equal(action.args[6],ethers.ZeroAddress);
});

test('Balancer economic router recipes cycle across all three verified pools',()=>{
  const pools=[0,1,2].map((i)=>({address:'0x'+String(400+i).padStart(40,'0'),poolType:['WEIGHTED','STABLE','STABLE_SURGE'][i],initialized:true,registered:true,tokens:[usdc,weth],bptHolders:[{actor:actors[0],amount:'2000000000000000000'}]}));
  const selected={signature:'swapSingleTokenExactOut(address,address,address,uint256,uint256,uint256,bool,bytes)'};
  const all=Array.from({length:9},(_,i)=>buildBalancerV3ActionV1({ethers,target:router,selected,discovery:{pools},valuePool:values,actors,poolSelectionIndex:i}));
  assert.ok(all.every(x=>x.kind==='READY'));
  assert.deepEqual(all.map(x=>x.pool),[...pools.map(x=>x.address),...pools.map(x=>x.address),...pools.map(x=>x.address)]);
  assert.equal(choosePoolV1(pools,true,4).poolType,'STABLE');
});

test('Balancer withdrawal uses current verified BPT balance and zero minimum output',()=>{
  const tokenPool={address:pool,initialized:true,registered:true,tokens:[usdc,weth],bptHolders:[{actor:actors[0],amount:'2000000000000000000'}]};
  const discovery={pools:[tokenPool]};
  for(const sig of ['removeLiquidityProportional(address,uint256,uint256[],bool,bytes)','removeLiquiditySingleTokenExactIn(address,uint256,address,uint256,bool,bytes)']){
    const action=buildBalancerV3ActionV1({ethers,target:router,selected:{signature:sig},discovery,valuePool:values,actors});
    assert.equal(action.kind,'READY');
    assert.equal(action.sender,actors[0]);
    assert.equal(action.args[1],20000000000000000n);
    assert.equal(action.bptInput,'20000000000000000');
    if(sig.startsWith('removeLiquiditySingle'))assert.equal(action.args[3],1n);
    else assert.deepEqual(action.args[2],[0n,0n]);
  }
  assert.equal(bptWithdrawalAmountV1('1'),0n);
  assert.equal(bptWithdrawalAmountV1('50'),1n);
  assert.equal(bptWithdrawalAmountV1('1000000'),10000n);
});

test('real Balancer BPT transfer recipes use funded holder and distinct recipient, not random actors',()=>{
  const tokenPool={address:pool,initialized:true,registered:true,tokens:[usdc,weth],bptHolders:[{actor:actors[0],amount:'1000000'}]};
  const fundedActors=[...actors,'0x0000000000000000000000000000000000002000','0x0000000000000000000000000000000000003000'];
  const base={target:{qualifiedName:'@balancer-labs/v3-pool-weighted/contracts/WeightedPool.sol:WeightedPool',address:pool},discovery:{pools:[tokenPool]},actors:fundedActors};
  const transfer=balancerV3BptTransferRecipeV1({...base,selected:{signature:'transfer(address,uint256)'}});
  assert.equal(transfer.kind,'READY');
  assert.equal(transfer.sender,actors[0]);
  assert.deepEqual(transfer.args,[fundedActors[1],10000n]);
  const transferFrom=balancerV3BptTransferRecipeV1({...base,selected:{signature:'transferFrom(address,address,uint256)'}});
  assert.equal(transferFrom.kind,'READY');
  assert.deepEqual(transferFrom.args,[actors[0],fundedActors[1],10000n]);
  assert.equal(transferFrom.spender,fundedActors[2]);
  assert.equal(transferFrom.transferFrom,true);
  assert.equal(balancerV3BptTransferRecipeV1({...base,selected:{signature:'incrementNonce()'}}),null);
  assert.equal(balancerV3BptTransferRecipeV1({...base,discovery:{pools:[{...tokenPool,bptHolders:[]}]},selected:{signature:'transfer(address,uint256)'}}).reason,'BALANCER_BPT_REQUIRES_VERIFIED_FUNDED_HOLDER');
});
