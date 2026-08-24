"use strict";
const fs=require("fs"),path=require("path"),{ethers}=require("ethers");
const ROOT=path.resolve(__dirname,"..");
function loadJson(p){return JSON.parse(fs.readFileSync(p,"utf8"));}
function jsonReplacer(_key,value){return typeof value==="bigint"?value.toString():value;}
function saveJson(p,v){fs.writeFileSync(p,JSON.stringify(v,jsonReplacer,2)+"\n");}
async function getContext(configPath,statePath){
  const config=loadJson(configPath);const rpc=process.env.RPC_URL;if(!rpc)throw new Error("RPC_URL is required");
  const provider=new ethers.JsonRpcProvider(rpc);let wallet;
  const impersonate=process.env.IMPERSONATE_DEPLOYER_ADDRESS;
  if(impersonate){
    const a=ethers.getAddress(impersonate);
    try{await provider.send("anvil_impersonateAccount",[a]);await provider.send("anvil_setBalance",[a,"0x3635C9ADC5DEA00000"]);}catch(_){await provider.send("hardhat_impersonateAccount",[a]);await provider.send("hardhat_setBalance",[a,"0x3635C9ADC5DEA00000"]);}
    wallet=await provider.getSigner(a);
  }else{
    const pk=process.env.DEPLOYER_PRIVATE_KEY;if(!pk)throw new Error("DEPLOYER_PRIVATE_KEY is required unless IMPERSONATE_DEPLOYER_ADDRESS is set for fork simulation");
    wallet=new ethers.Wallet(pk,provider);
  }
  const walletAddress=ethers.getAddress(await wallet.getAddress());
  const state=fs.existsSync(statePath)?loadJson(statePath):{version:"v3",network:config.network,contracts:{},transactions:{},checks:{}};
  return{config,provider,wallet,walletAddress,state,statePath};
}
async function codeExists(provider,address){return (await provider.getCode(address))!=="0x";}
function solArtifact(source,name){const p=path.join(ROOT,"artifacts-v3","contracts",source,`${name}.json`);if(!fs.existsSync(p))throw new Error(`missing Solidity artifact ${p}; build in approved environment first`);return loadJson(p);}
function vyperArtifact(name){const p=path.join(ROOT,"artifacts-vyper-v3",`${name}.json`);if(!fs.existsSync(p))throw new Error(`missing Vyper artifact ${p}; build in approved environment first`);return loadJson(p);}
async function deploy(ctx,key,artifact,args){if(ctx.state.contracts[key]?.address&&await codeExists(ctx.provider,ctx.state.contracts[key].address))return new ethers.Contract(ctx.state.contracts[key].address,artifact.abi,ctx.wallet);const f=new ethers.ContractFactory(artifact.abi,artifact.bytecode,ctx.wallet);const c=await f.deploy(...args);const receipt=await c.deploymentTransaction().wait();const address=ethers.getAddress(await c.getAddress());ctx.state.contracts[key]={address,constructorArgs:args.map(x=>Array.isArray(x)?x:String(x)),tx:receipt.hash,gasUsed:String(receipt.gasUsed)};ctx.state.transactions[`deploy:${key}`]=receipt.hash;saveJson(ctx.statePath,ctx.state);console.log(`deployed ${key}: ${address} gas=${receipt.gasUsed}`);return c;}
async function send(ctx,key,contract,fn,args=[]){const tx=await contract[fn](...args);const r=await tx.wait();ctx.state.transactions[key]=r.hash;ctx.state.checks.gas=ctx.state.checks.gas||{};ctx.state.checks.gas[key]=String(r.gasUsed);saveJson(ctx.statePath,ctx.state);console.log(`${key}: ${r.hash} gas=${r.gasUsed}`);return r;}
function pad8(values,zero=ethers.ZeroAddress){if(values.length>8)throw new Error("max 8 reward tokens");return [...values,...Array(8-values.length).fill(zero)];}
module.exports={ROOT,loadJson,saveJson,getContext,codeExists,solArtifact,vyperArtifact,deploy,send,pad8,ethers};
