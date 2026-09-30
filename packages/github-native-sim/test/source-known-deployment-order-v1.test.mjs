import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {deploySourceKnownPlanV1,extractNetworkAddressBindingsV1} from '../src/source-known-deployment-plan-v1.mjs';

function addressFor(n){
  return '0x'+BigInt(n+1).toString(16).padStart(40,'0');
}

test('source-known fallback honors authoritative deployment order and resolves ternary predicted deployment bindings',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'phase0-deploy-order-'));
  try{
    const script=`
      const predictedVault = report.deployments.Vault
        ? report.deployments.Vault.address
        : report.predictedDeployments.find((entry) => entry.name === "Vault").expectedAddress;
      if (DEPLOY_CRV_YIELD) {
        const token = await deploy("crvYIELD", ["x"]);
      }
      const protocolFeeController = await deploy("ProtocolFeeController", [predictedVault]);
      const vault = await deploy("Vault", []);
    `;
    await fs.writeFile(path.join(root,'deploy.mjs'),script);

    let deployed=0;
    class ContractFactory {
      constructor(){}
      async deploy(){
        const address=addressFor(100+deployed++);
        return{
          async waitForDeployment(){},
          deploymentTransaction(){return{async wait(){return{hash:'0x'+String(deployed).padStart(64,'0'),blockNumber:deployed};}};},
          async getAddress(){return address;}
        };
      }
    }
    const ethers={
      ContractFactory,
      getCreateAddress:({nonce})=>addressFor(Number(nonce))
    };
    const provider={
      async getSigner(){return{async getAddress(){return addressFor(999);}};},
      async getTransactionCount(){return 0;}
    };
    const artifacts=[
      {sourceName:'ProtocolFeeController.sol',contractName:'ProtocolFeeController',abi:[],bytecode:'0x6000',linkReferences:{}},
      {sourceName:'Vault.sol',contractName:'Vault',abi:[],bytecode:'0x6000',linkReferences:{}},
      {sourceName:'MintBurnTeamToken.sol',contractName:'crvYIELD',abi:[],bytecode:'0x6000',linkReferences:{}}
    ];
    const detected={
      foundry:[],hardhat:[],unsafeHardhat:[],
      genericPackageScripts:[{name:'deploy',command:'node deploy.mjs'}]
    };
    const result=await deploySourceKnownPlanV1({
      projectRoot:root,provider,ethers,artifacts,detected,
      deploymentOrder:['ProtocolFeeController','Vault']
    });
    assert.equal(result.planned,2);
    assert.deepEqual(result.rows.map(row=>row.contractName),['ProtocolFeeController','Vault']);
    assert.equal(result.rows[0].constructorArgs[0],addressFor(1));
    assert.equal(result.limitations.length,0);
  }finally{
    await fs.rm(root,{recursive:true,force:true});
  }
});


test('source-known resolver derives v16 networkAddress bindings from the deploy script default network',()=>{
  const deploy=`
    const NETWORK_NAME = argValue("--network") || process.env.CURVEYIELD_NETWORK || "base";
    const network = resolveNetwork(NETWORK_NAME);
    let DAO = networkAddress(network, "dao", "CURVEYIELD_DAO");
    let DEFAULT_PAYOUT_TOKEN = networkAddress(network, "defaultPayoutToken", "CURVEYIELD_DEFAULT_PAYOUT_TOKEN");
    const WETH = networkAddress(network, "weth", "WETH");
    const PERMIT2 = networkAddress(network, "permit2", "PERMIT2");
  `;
  const networks=`
    export const NETWORKS = {
      base: {
        name: 'Base',
        weth: '0x4200000000000000000000000000000000000006',
        permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
        dao: '0x7142b1Cc5F91A736A62e77581F406338328F05bC',
        defaultPayoutToken: '0xd7bb4c715d66a3ac3742ab9d2e2f5274da17ce22',
      },
      katana: {
        weth: '0x4200000000000000000000000000000000000006',
        dao: { create: 'aragon' },
      },
    };
  `;
  const bindings=extractNetworkAddressBindingsV1(deploy,networks);
  assert.equal(bindings.get('DAO'),'0x7142b1Cc5F91A736A62e77581F406338328F05bC');
  assert.equal(bindings.get('DEFAULT_PAYOUT_TOKEN'),'0xd7bb4c715d66a3ac3742ab9d2e2f5274da17ce22');
  assert.equal(bindings.get('WETH'),'0x4200000000000000000000000000000000000006');
  assert.equal(bindings.get('PERMIT2'),'0x000000000022D473030F116dDEE9F6B43aC78BA3');
});
