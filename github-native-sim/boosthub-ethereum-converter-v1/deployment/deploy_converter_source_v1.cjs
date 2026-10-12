// Bundled on GitHub; users run the resulting .cjs with Node.js 22 and PowerShell.
const fs=require('node:fs');const path=require('node:path');const crypto=require('node:crypto');
const {JsonRpcProvider,Wallet,ContractFactory,Contract,Interface,keccak256}=require('ethers');
const args=process.argv.slice(2);function option(name,fallback){const i=args.indexOf(name);return i<0?fallback:args[i+1];}
if(args.includes('--help')){console.log('Usage: Deploy-Converter_v1.ps1 -RpcUrl <Ethereum RPC> [-SlippageBps 100] [-StateFile <path>] [-Broadcast]');console.log('Default: read-only deployment simulation. Broadcast requires PRIVATE_KEY in the process environment.');process.exit(0);}
function mask(code,refs){let h=code.toLowerCase().slice(2);for(const ranges of Object.values(refs||{}))for(const {start,length} of ranges)h=h.slice(0,start*2)+'0'.repeat(length*2)+h.slice((start+length)*2);return h;}
async function main(){
 const artifactPath=path.resolve(__dirname,'../artifacts_v1/BoostHubEthereumRewardConverter_v1.json');const artifactBytes=fs.readFileSync(artifactPath),artifact=JSON.parse(artifactBytes);
 const artifactSha256=crypto.createHash('sha256').update(artifactBytes).digest('hex');
 const rpc=option('--rpc');if(!rpc)throw Error('Provide an Ethereum RPC URL');const bps=Number(option('--slippage-bps','100'));if(!Number.isInteger(bps)||bps<0||bps>400)throw Error('SlippageBps must be an integer from 0 to 400');
 const provider=new JsonRpcProvider(rpc,1,{staticNetwork:true,batchMaxCount:1});
 try {
  if(Number(await provider.send('eth_chainId',[]))!==1)throw Error('Ethereum mainnet chain ID 1 is required');
  const catalogue=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../Ethereum_Route_Inventory_v1.json')));const block=await provider.getBlock('latest');
  const dependencies=new Set(catalogue.routes.flatMap(r=>[r.from,r.to,...r.pools,r.router].filter(x=>x&&x!=='0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE')));
  for(const a of dependencies)if(await provider.getCode(a,block.number)==='0x')throw Error('Required deployed dependency has no code: '+a);
  const broadcast=args.includes('--broadcast');const statePath=path.resolve(option('--state-file','Converter_Deployment_State_v1.json'));
  let saved=fs.existsSync(statePath)?JSON.parse(fs.readFileSync(statePath)):null;
  if(saved&&(saved.chainId!==1||saved.slippageBps!==bps||saved.artifactSha256!==artifactSha256))throw Error('State file belongs to another artifact or slippage configuration');
  const signer=broadcast?new Wallet(process.env.PRIVATE_KEY||'',provider):null;
  const factory=new ContractFactory(artifact.abi,artifact.bytecode,signer||provider);const deploy=await factory.getDeployTransaction(bps);
  const simulated=await provider.call({...deploy,from:signer?await signer.getAddress():'0x000000000000000000000000000000000000dEaD'});
  if(mask(simulated,artifact.immutableReferences)!==mask(artifact.deployedBytecode,artifact.immutableReferences))throw Error('Simulated deployment runtime differs from the release artifact');
  let address=saved?.address;
  const persist=s=>{fs.mkdirSync(path.dirname(statePath),{recursive:true});const temporary=statePath+'.tmp';fs.writeFileSync(temporary,JSON.stringify(s,null,2));fs.renameSync(temporary,statePath);};
  if(broadcast&&!address){
   if(saved?.transactionHash){const receipt=await provider.waitForTransaction(saved.transactionHash,1,60000);if(!receipt)throw Error('Recorded deployment is still pending; rerun with the same state file');if(receipt.status!==1)throw Error('Recorded deployment reverted');address=receipt.contractAddress;}
   else{
    const deployed=await factory.deploy(bps);const transaction=deployed.deploymentTransaction();saved={chainId:1,slippageBps:bps,artifactSha256,transactionHash:transaction.hash};persist(saved);console.log('Deployment submitted:',transaction.hash);
    const receipt=await transaction.wait();if(receipt.status!==1)throw Error('Deployment reverted');address=await deployed.getAddress();
   }
   saved={...saved,address};persist(saved);
  }
  if(address){const code=await provider.getCode(address);if(mask(code,artifact.immutableReferences)!==mask(artifact.deployedBytecode,artifact.immutableReferences))throw Error('Saved address contains a different converter');const c=new Contract(address,artifact.abi,provider);if(await c.slippageBps()!==BigInt(bps)||await c.routeCount()!==4n)throw Error('Deployed converter configuration mismatch');}
  const report={chainId:1,blockNumber:block.number,blockHash:block.hash,broadcast,slippageBps:bps,artifactSha256,simulatedRuntimeHash:keccak256(simulated),converter:address||null,status:address?'DEPLOYED_AND_VERIFIED':'SIMULATED_ONLY',configuration:[]};
  const converterAddress=address||'0x0000000000000000000000000000000000000001';
  const strategyAbi=new Interface(['function addRewardRoute(address,address,uint256)','function applyRewardRoute(address)','function rewardRoute(address) view returns((address token,address converter,uint256 minAmount,bool enabled))']);
  for(const consumer of catalogue.consumers.filter(c=>c.kind==='strategy'&&c.currentHubDepositor)){
   const c=new Contract(consumer.address,strategyAbi,provider);const live=await c.rewardRoute(consumer.token,{blockTag:block.number});
   report.configuration.push({consumer:consumer.address,method:'addRewardRoute',token:consumer.token,oldConverter:live.converter,newConverter:address||'REPLACE_WITH_DEPLOYED_CONVERTER',minAmount:live.minAmount.toString(),data:address?strategyAbi.encodeFunctionData('addRewardRoute',[consumer.token,converterAddress,live.minAmount]):null,requiresDelayedApply:consumer.pid===2,applyData:consumer.pid===2?strategyAbi.encodeFunctionData('applyRewardRoute',[consumer.token]):null});
  }
  const stakingAbi=new Interface(['function set_reward_converter(address,address)']);
  for(const consumer of catalogue.consumers.filter(c=>c.kind==='staking'))report.configuration.push({consumer:consumer.address,method:'set_reward_converter',token:consumer.token,newConverter:address||'REPLACE_WITH_DEPLOYED_CONVERTER',data:address?stakingAbi.encodeFunctionData('set_reward_converter',[consumer.token,converterAddress]):null,legacyStakingOnly:true});
  const reportPath=path.resolve(option('--report','Converter_Deployment_Plan_v1.json'));fs.writeFileSync(reportPath,JSON.stringify(report,null,2));console.log(report.status, address||'');console.log('Configuration plan:',reportPath);console.log('The runner does not send configuration transactions.');
 } finally {provider.destroy();}
}
main().catch(e=>{console.error(e.shortMessage||e.message||'Deployment failed');process.exitCode=1;});
