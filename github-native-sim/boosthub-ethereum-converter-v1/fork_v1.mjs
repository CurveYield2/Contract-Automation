import fs from 'node:fs';
import assert from 'node:assert/strict';
import {Contract,ContractFactory,JsonRpcProvider,ZeroAddress} from 'ethers';
import {spawnSync} from 'node:child_process';
const url='http://127.0.0.1:8545';const provider=new JsonRpcProvider(url,1,{staticNetwork:true,batchMaxCount:1,cacheTimeout:-1});provider.pollingInterval=50;
assert.equal(await provider.send('eth_chainId',[]),'0x1');assert.match(await provider.send('web3_clientVersion',[]),/anvil/i);
const catalogue=JSON.parse(fs.readFileSync('live_catalog_v1.json'));const artifact=JSON.parse(fs.readFileSync('build_v1/BoostHubEthereumRewardConverter_v1.json'));
const signer=await provider.getSigner(0),caller=await signer.getAddress();const converter=await new ContractFactory(artifact.abi,artifact.bytecode,signer).deploy(100);await converter.waitForDeployment();const address=await converter.getAddress();
const erc=['function balanceOf(address) view returns(uint256)','function transfer(address,uint256) returns(bool)','function approve(address,uint256) returns(bool)','function allowance(address,address) view returns(uint256)','function symbol() view returns(string)','function decimals() view returns(uint8)'];
const tx=async p=>(await p).wait();
async function transferFromHolder(token,holder,amount){await provider.send('anvil_setBalance',[holder,'0x56BC75E2D63100000']);await provider.send('anvil_impersonateAccount',[holder]);const c=new Contract(token,erc,await provider.getSigner(holder));assert.ok(await c.balanceOf(holder)>=amount,'Fixture holder balance');await tx(c.transfer(caller,amount));await provider.send('anvil_stopImpersonatingAccount',[holder]);}
const CRV='0xD533a949740bb3306d119CC777fa900bA034cd52',CRVUSD='0xf939E0A03FB07F59A73314E73794Be0E57ac1b4E',WST='0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0',ST='0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84';
await transferFromHolder(CRV,'0xCA0253A98D16e9C1e3614caFDA19318EE69772D0',10n**18n);
await transferFromHolder(CRVUSD,'0x4eBdF703948ddCEA3B11f675B4D1Fba9d2414A14',10n**18n);
await transferFromHolder(ST,'0xDC24316b9AE028F1497c275EB9192a3Ea0f67022',2n*10n**18n);
await tx(new Contract(ST,erc,signer).approve(WST,2n*10n**18n));await tx(new Contract(WST,['function wrap(uint256) returns(uint256)'],signer).wrap(2n*10n**18n));
let snapshot=await provider.send('evm_snapshot',[]);const evidence={chainId:1,pin:catalogue.blockNumber,pinHash:catalogue.blockHash,newConverter:address,slippageBps:'100',routes:[],configuration:[],cases:[]};
async function restore(){await provider.send('evm_revert',[snapshot]);snapshot=await provider.send('evm_snapshot',[]);}
for(const [index,r] of catalogue.routes.entries()){
 const input=new Contract(r.from,erc,signer),output=new Contract(r.to,erc,signer);const old=new Contract(r.converter,['function previewConvert(address,address,uint256) view returns(uint256)'],provider);
 evidence.routes.push({...r,inputSymbol:await input.symbol(),outputSymbol:await output.symbol(),decimalsIn:await input.decimals(),decimalsOut:await output.decimals()});
 for(const amount of [10n**14n,10n**16n,10n**17n]){
  await restore();const q=await converter.previewConvert(r.from,r.to,amount),oldQ=await old.previewConvert(r.from,r.to,amount);assert.equal(q,oldQ,'Deployed quote compatibility');assert.ok(q>0n);assert.equal(await converter.getAmountOut(r.from,r.to,amount),q);
  const bps=index===3?25n:100n,minimum=q*(10000n-bps)/10000n;await tx(input.approve(address,amount));const beforeIn=await input.balanceOf(caller),beforeOut=await output.balanceOf(caller);
  let actual,guarded=false;
  try{actual=await converter.convert.staticCall(r.from,r.to,amount,minimum);}catch{guarded=true;}
  if(guarded){await assert.rejects(converter.convert(r.from,r.to,amount,minimum));assert.equal(await input.balanceOf(caller),beforeIn);evidence.cases.push({index,amount,q,minimum,status:'GUARD_REJECTED',quoteMatchesDeployed:true});}
  else {await tx(converter.convert(r.from,r.to,amount,minimum));assert.equal(beforeIn-await input.balanceOf(caller),amount);assert.equal(await output.balanceOf(caller)-beforeOut,actual);assert.ok(actual>=minimum);assert.equal(await output.balanceOf(address),0n);evidence.cases.push({index,amount,q,minimum,actual,status:'SWAPPED',quoteMatchesDeployed:true});}
 }
 await restore();const amount=10n**16n;await tx(input.approve(address,amount));const q=await converter.previewConvert(r.from,r.to,amount),beforeHighMinimum=await input.balanceOf(caller);await assert.rejects(converter.convert(r.from,r.to,amount,q*1000n));assert.equal(await input.balanceOf(caller),beforeHighMinimum);
 await restore();await tx(input.approve(address,amount));const floor=q*9900n/10000n;let automaticGuarded=false;try{await converter['swap(address,address,uint256)'].staticCall(r.from,r.to,amount);}catch{automaticGuarded=true;}
 if(automaticGuarded){await assert.rejects(converter['swap(address,address,uint256)'](r.from,r.to,amount));evidence.cases.push({index,amount,minimum:floor,status:'AUTOMATIC_GUARD_REJECTED'});}
 else{await tx(converter['swap(address,address,uint256)'](r.from,r.to,amount));evidence.cases.push({index,amount,minimum:floor,status:'AUTOMATIC_SWAP'});}
 console.log('Live route',index,'quote matched at three amounts');
}
await restore();const result=spawnSync(process.execPath,['--test','combined_routes_v1.test.mjs','release_requirement_v1.test.mjs'],{env:{...process.env,READ_RPC:url,CONVERTER:address},encoding:'utf8'});fs.mkdirSync('test_evidence_v1',{recursive:true});fs.writeFileSync('test_evidence_v1/combined_routes_green_v1.txt',result.stdout+result.stderr);process.stdout.write(result.stdout);assert.equal(result.status,0);
// Reconfigure each current-depositor strategy on the disposable fork using its ordinary owner API.
for(const row of [{address:'0x9cc6A64F7F08a901A4aaCAE133058f22D06291E6',pairs:[0,1]},{address:'0x612AC5298deC3CE06769a4478F44e24ea79856c1',pairs:[2]},{address:'0x2926dD048e1571DA8fc26BF6CB15cB9cA8135137',pairs:[3]}]){
 const abi=['function owner() view returns(address)','function addRewardRoute(address,address,uint256)','function applyRewardRoute(address)','function rewardRoute(address) view returns((address token,address converter,uint256 minAmount,bool enabled))'];const read=new Contract(row.address,abi,provider);const owner=await read.owner();await provider.send('anvil_setBalance',[owner,'0x56BC75E2D63100000']);await provider.send('anvil_impersonateAccount',[owner]);const strategy=new Contract(row.address,abi,await provider.getSigner(owner));
 for(const i of row.pairs){const r=catalogue.routes[i],before=await read.rewardRoute(r.from);await tx(strategy.addRewardRoute(r.from,address,before.minAmount));let after=await read.rewardRoute(r.from);let timelock=false;if(after.converter.toLowerCase()!==address.toLowerCase()){timelock=true;await provider.send('evm_increaseTime',[864001]);await provider.send('evm_mine',[]);await tx(strategy.applyRewardRoute(r.from));after=await read.rewardRoute(r.from);}assert.equal(after.converter.toLowerCase(),address.toLowerCase());assert.equal(after.minAmount,before.minAmount);evidence.configuration.push({strategy:row.address,token:r.from,converter:address,timelock,configured:true});}
 await provider.send('anvil_stopImpersonatingAccount',[owner]);
}
fs.writeFileSync('test_evidence_v1/live_fork_v1.json',JSON.stringify(evidence,(_,v)=>typeof v==='bigint'?v.toString():v,2));console.log('Fork swaps',evidence.cases.filter(c=>c.status==='SWAPPED').length,'guard rejects',evidence.cases.filter(c=>c.status==='GUARD_REJECTED').length,'configured routes',evidence.configuration.length);provider.destroy();
