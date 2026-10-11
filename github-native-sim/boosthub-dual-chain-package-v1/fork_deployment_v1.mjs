// GitHub-only deployment acceptance tests. Never send test-account transactions to a public RPC.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {Wallet,JsonRpcProvider,FetchRequest,Contract,ZeroAddress} from 'ethers';
import {preflight,predictAddresses,deployAndConfigure,verifyStack,validateConfig} from './deployment/deploy_runner_v1.mjs';
const root=path.dirname(new URL(import.meta.url).pathname),release=path.join(root,'release_v2');
const original=JSON.parse(fs.readFileSync(path.join(release,'deployment/deployment_config_v1.json')));
const snapshot=JSON.parse(fs.readFileSync(path.join(root,'evidence/live_stack_snapshot_v1.json')));
const artifacts={};for(const k of ['factory','hub','helper','helperFraxtal','staking'])artifacts[k]=JSON.parse(fs.readFileSync(path.join(release,'artifacts_v1',k+'_v1.json')));
const config=structuredClone(original);
// Public Anvil fixture key; it is only accepted after the loopback guard below.
const testKey='0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
config.deployer=new Wallet(testKey).address;
for(const n of Object.values(config.chains)){n.owner=config.deployer;n.priorityFeePerGasGwei='0';n.maxFeePerGasGwei='100';for(const p of n.pools){p.stakingAdmin=config.deployer;p.keeper=config.deployer;}}
validateConfig(config);
const predicted=predictAddresses(artifacts,config.deployer,config.deploymentId,3),results=[];
for(const [name,port]of [['ethereum',8545],['fraxtal',8546]]) {
  const n=config.chains[name],url='http://127.0.0.1:'+port;
  assert.equal(new URL(url).hostname,'127.0.0.1','Fixture signing is limited to loopback Anvil');
  const log=fs.openSync(path.join(root,'evidence/anvil_'+name+'_v1.log'),'w');
  const child=spawn('anvil',['--host','127.0.0.1','--port',String(port),'--chain-id',String(n.chainId),'--fork-url',n.rpcUrl,'--fork-block-number',String(snapshot[name].blockNumber),'--no-rate-limit','--silent'],{stdio:['ignore',log,log]});
  const req=new FetchRequest(url);req.timeout=1000;
  const provider=new JsonRpcProvider(req,n.chainId,{staticNetwork:true,batchMaxCount:1,cacheTimeout:-1});provider.pollingInterval=100;
  try {
    let ready=false;
    for(let i=0;i<60;i++){try{if(await provider.send('web3_clientVersion',[])){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}
    assert.ok(ready,'Fork Anvil did not become ready: '+name);
    assert.match(await provider.send('web3_clientVersion',[]),/anvil/i);
    await preflight(provider,n,predicted);
    const state={version:'v1',steps:{}};
    const ctx={name,provider,network:n,deployer:config.deployer,deploymentId:config.deploymentId,
      signer:new Wallet(testKey,provider),state,save:()=>fs.writeFileSync(path.join(root,'evidence/fork_state_'+name+'_v1.json'),JSON.stringify(state,(_,v)=>typeof v==='bigint'?v.toString():v,2)),confirmations:1,timeoutMs:120000};
    await deployAndConfigure(ctx,artifacts,predicted);
    assert.equal(state.status,'CONFIGURED_AND_VERIFIED');
    const count=Object.keys(state.steps).length,nonce=await provider.getTransactionCount(config.deployer);
    await deployAndConfigure(ctx,artifacts,predicted);await verifyStack(ctx,artifacts,predicted);
    assert.equal(Object.keys(state.steps).length,count,'Idempotent rerun added steps');
    assert.equal(await provider.getTransactionCount(config.deployer),nonce,'Idempotent rerun submitted a transaction');
    const hub=new Contract(predicted.hub,artifacts.hub.abi,provider),sys=await hub.systemInfo();
    if(name==='fraxtal') {
      assert.equal(sys.vlBoost,ZeroAddress);assert.equal(sys.vlsdtDelegated,0n);
      const checkpoint=await hub.checkpoint.staticCall([]);assert.equal(checkpoint,true);
      const helper=new Contract(predicted.helper,artifacts.helperFraxtal.abi,provider);
      assert.equal(await helper.VERSION(),5n);assert.equal(await helper.urd(),n.rewardDistributor);
    }
    results.push({chain:name,chainId:n.chainId,forkBlock:snapshot[name].blockNumber,hub:predicted.hub,helper:predicted.helper,pools:n.pools.length,transactions:count,status:state.status,idempotentRerun:true});
  }finally{provider.destroy();child.kill('SIGTERM');fs.closeSync(log);}
}
fs.writeFileSync(path.join(root,'evidence/fork_deployment_results_v1.json'),JSON.stringify({version:'v1',testScope:'Fresh release deployments onto local Anvil forks; no public-chain transactions',results},null,2));
console.log('Fork deployment/configuration and idempotent rerun passed for both selected helpers');
