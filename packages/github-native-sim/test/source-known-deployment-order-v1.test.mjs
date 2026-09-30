import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {deploySourceKnownPlanV1} from '../src/source-known-deployment-plan-v1.mjs';

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
