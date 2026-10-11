import test from 'node:test';
import assert from 'node:assert/strict';
import * as ethers from 'ethers';
import {augmentDelegateProxyContextsV2} from '../src/phase0-randomized-simulation-v1.mjs';

// Regression for the 300-call DEX v16 smoke: arbitrary associations must not
// mount Router/Authorizer/Vault ABIs on unrelated addresses (197 empty reverts).
test('Phase 0 does not invent proxy facades from contract associations or selector responses',async()=>{
  const specs=[
    ['contracts/PermanentLiquidityVaultV2.sol','PermanentLiquidityVaultV2'],
    ['@balancer-labs/v3-vault/contracts/Router.sol','Router'],
    ['@balancer-labs/v3-standalone-utils/contracts/BalancerContractRegistry.sol','BalancerContractRegistry'],
    ['@balancer-labs/v3-vault/contracts/TimelockAuthorizer.sol','TimelockAuthorizer'],
    ['contracts/UnrelatedController.sol','UnrelatedController'],
    ['contracts/UnrelatedLibrary.sol','UnrelatedLibrary']
  ];
  const artifacts=specs.map(([sourceName,contractName])=>({
    sourceName,contractName,abi:[{type:'function',name:'changeState',inputs:[],outputs:[],stateMutability:'nonpayable'}]
  }));
  const deployed=specs.map(([sourceName,contractName],i)=>({
    qualifiedName:`${sourceName}:${contractName}`,
    sourceName,contractName,
    address:ethers.getAddress('0x'+(i+1).toString(16).padStart(40,'0'))
  }));
  const targets=deployed.map((d,i)=>({...d,artifact:artifacts[i],functions:[],contextType:'DIRECT'}));
  const associations={
    [deployed[0].address]:[deployed[1].address],
    [deployed[2].address]:[deployed[3].address],
    [deployed[4].address]:[deployed[5].address]
  };
  const provider={async send(method){
    if(method==='eth_getStorageAt')return ethers.ZeroHash;
    if(method==='eth_accounts')return[deployed[0].address];
    throw new Error('unexpected RPC '+method);
  }};
  const result=await augmentDelegateProxyContextsV2({
    provider,ethers,targets,artifacts,deployed,associations,probeSelectors:true
  });
  assert.equal(result.targets.length,targets.length);
  assert.equal(result.contextEvidence.filter(x=>x.status==='READY').length,0);
  assert.equal(result.targets.filter(x=>x.contextType!=='DIRECT').length,0);
});
