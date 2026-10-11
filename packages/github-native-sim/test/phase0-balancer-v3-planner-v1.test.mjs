import test from 'node:test';
import assert from 'node:assert/strict';
import * as ethers from 'ethers';
import {isBalancerV3TargetV1,balancerV3ActionRequirementsV1,buildBalancerV3ActionV1} from '../src/phase0-balancer-v3-planner-v1.mjs';
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
