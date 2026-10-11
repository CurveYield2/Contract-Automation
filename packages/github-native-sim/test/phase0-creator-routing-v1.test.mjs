import test from 'node:test';
import assert from 'node:assert/strict';
import {discoverCreatorCandidatesV1} from '../src/phase0-fixture-synthesis-v1.mjs';

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
  assert.deepEqual(candidates.map(row=>row.selected.fragment.name),[
    'createWeightedPool','createStablePool','createStableSurgePool'
  ]);
  assert.ok(candidates.every(row=>row.target.qualifiedName.endsWith('CurveYieldPoolFactoryWrapper.sol:CurveYieldPoolFactoryWrapper')));
});
