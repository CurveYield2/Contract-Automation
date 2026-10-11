import test from 'node:test';
import assert from 'node:assert/strict';
import {discoverCreatorCandidatesV1,creatorAttemptBudgetV1,verifiedPredictedCurveYieldPoolV1} from '../src/phase0-fixture-synthesis-v1.mjs';

function candidateTarget(qualifiedName,methodNames){
  return {
    qualifiedName,address:'0x0000000000000000000000000000000000000001',
    functions:methodNames.map(name=>({
      signature:name+'(address)',
      fragment:{
        name,stateMutability:'nonpayable',
        inputs:[{type:'address',baseType:'address'}],
        outputs:[{type:'address',baseType:'address'}]
      }
    }))
  };
}

test('Stage 2 only creates Balancer pools through supported CurveYield wrapper entrypoints',()=>{
  const targets=[
    candidateTarget('@balancer-labs/v3-vault/contracts/BatchRouter.sol:BatchRouter',['querySwapExactIn','swapExactIn','querySwapExactOut','swapExactOut']),
    candidateTarget('@balancer-labs/v3-vault/contracts/Router.sol:Router',['initialize','addLiquidityUnbalanced']),
    candidateTarget('contracts/factories/CurveYieldWeightedPoolFactory.sol:CurveYieldWeightedPoolFactory',['create']),
    candidateTarget('contracts/CurveYieldPoolFactoryWrapper.sol:CurveYieldPoolFactoryWrapper',[
      'createWeightedPool','createStablePool','createStableSurgePool','createGyroECLPPool','createReClammPool'
    ])
  ];
  const candidates=discoverCreatorCandidatesV1({targets});
  assert.deepEqual(candidates.map(row=>row.selected.fragment.name).sort(),[
    'createWeightedPool','createStablePool','createStableSurgePool'
  ].sort());
  assert.ok(candidates.every(row=>row.target.qualifiedName.endsWith('CurveYieldPoolFactoryWrapper.sol:CurveYieldPoolFactoryWrapper')));
});

test('Balancer v3 wrapper uses at most two real token-pair attempts, not blind salt retries',()=>{
  assert.equal(creatorAttemptBudgetV1({isCurveYieldWrapper:true,maxAttemptsPerCandidate:24}),2);
  assert.equal(creatorAttemptBudgetV1({isCurveYieldWrapper:true,maxAttemptsPerCandidate:1}),1);
  assert.equal(creatorAttemptBudgetV1({isCurveYieldWrapper:false,maxAttemptsPerCandidate:24}),24);
});

test('CurveYield wrapper child discovery checks the predicted pool has real on-chain bytecode',async()=>{
  const expectedPool='0x0000000000000000000000000000000000000123';
  let observations=0;
  const ethers={getAddress:x=>x};
  const provider={getCode:async address=>{observations++;assert.equal(address,expectedPool);return '0x6001';}};
  assert.deepEqual(await verifiedPredictedCurveYieldPoolV1({provider,ethers,expectedPool}),[expectedPool]);
  assert.equal(observations,1);
  assert.deepEqual(await verifiedPredictedCurveYieldPoolV1({provider:{getCode:async()=> '0x'},ethers,expectedPool}),[]);
  assert.deepEqual(await verifiedPredictedCurveYieldPoolV1({provider,ethers,expectedPool:'not-an-address'}),[]);
});
