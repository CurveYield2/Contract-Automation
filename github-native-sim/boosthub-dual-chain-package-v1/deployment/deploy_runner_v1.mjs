import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { AbiCoder, Contract, ContractFactory, FetchRequest, JsonRpcProvider, Wallet, ZeroAddress,
  concat, getAddress, getCreate2Address, getCreateAddress, id, keccak256, parseUnits, toUtf8Bytes } from 'ethers';

export const UNIVERSAL_PROXY = '0x4e59b44847b379578588920ca78fbf26c0b4956c';
export const FRAXTAL_URD = '0xAeB87C92b2E7d3b21fA046Ae1E51E0ebF11A41Af';
export const FRAXTAL_SDFXS = '0x1AEe2382e05Dc68BDfC472F1E46d570feCca5814';
const PROXY_CREATION = '0x67363d3d37363d34f03d5260086018f3';
const coder = AbiCoder.defaultAbiCoder();
const eq = (a,b) => String(a).toLowerCase() === String(b).toLowerCase();
const requireThat = (b,m) => { if(!b) throw new Error(m); };
const json = x => JSON.stringify(x,(_,v)=>typeof v==='bigint'?v.toString():v,2);
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export function parseJson(text) { return JSON.parse(String(text).replace(/^\uFEFF/,'')); }
function address(a,label) { try { const v=getAddress(a);requireThat(v!==ZeroAddress,label+' cannot be zero');return v; } catch {throw new Error(label+' must be a nonzero EVM address');} }

export function validateConfig(c) {
  requireThat(c.version==='v1','Configuration version must be v1');
  address(c.deployer,'deployer');
  requireThat(typeof c.deploymentId==='string'&&c.deploymentId.length>0,'deploymentId is required');
  requireThat(c.chains&&Object.keys(c.chains).length>0,'At least one chain must be configured');
  for(const name of Object.keys(c.chains)) {
    const expected={ethereum:1,fraxtal:252}[name];requireThat(expected,'Unsupported chain');
    const n=c.chains[name];requireThat(n?.chainId===expected,name+' chainId is incorrect');
    for(const k of ['owner','rewardDistributor']) address(n[k],name+'.'+k);
    if(name==='fraxtal') {
      requireThat(eq(n.vlBoost,ZeroAddress),'Fraxtal has no vlBoost; set its address to zero');
      requireThat(eq(n.rewardDistributor,FRAXTAL_URD),'Fraxtal helper v5 uses the approved Stake DAO URD');
      requireThat(n.claimMode==='urd','Fraxtal requires the URD helper');
    }else {
      requireThat(n.claimMode==='stash','Ethereum requires the MultiMerkleStash helper');
      if(!eq(n.vlBoost,ZeroAddress))address(n.vlBoost,name+'.vlBoost');
    }
    requireThat(Array.isArray(n.pools)&&n.pools.length>0,name+' pools are required');
    requireThat(parseUnits(n.maxFeePerGasGwei,'gwei')>0n,name+' max gas fee must be positive');
    requireThat(parseUnits(n.priorityFeePerGasGwei,'gwei')>=0n,name+' priority fee must be nonnegative');
    requireThat(parseUnits(n.priorityFeePerGasGwei,'gwei')<=parseUnits(n.maxFeePerGasGwei,'gwei'),name+' priority exceeds maximum fee');
    const gauges=new Set();
    n.pools.forEach((p,i)=>{
      requireThat(p.pid===i,name+' PIDs must preserve live order');
      for(const k of ['asset','gauge','stakingAdmin','keeper','stakingFeeReceiver','platformFeeRecipient'])address(p[k],name+'.pool['+i+'].'+k);
      requireThat(!gauges.has(p.gauge.toLowerCase()),'Duplicate gauge');gauges.add(p.gauge.toLowerCase());
      requireThat(Number.isInteger(p.platformFeeBps)&&p.platformFeeBps>=0&&p.platformFeeBps<=2000,'Platform fee out of range');
      requireThat(Number.isInteger(p.rewardSmoothingUnits)&&p.rewardSmoothingUnits>=0&&p.rewardSmoothingUnits<=300,'Reward smoothing out of range');
      requireThat(typeof p.active==='boolean'&&typeof p.lockDepositor==='boolean','Pool activity/lock must be boolean');
      requireThat(p.active||!p.lockDepositor,'An inactive depositor cannot be permanently locked');
      requireThat(/^0x[0-9a-fA-F]{8}$/.test(p.checkpointSelector),'Checkpoint selector must be bytes4');
      for(const list of [p.hubRewardTokens,p.externalRewardTokens,p.disabledRewardTokens]) {
        requireThat(Array.isArray(list),'Reward lists are required');list.forEach(a=>address(a,'reward token'));
        requireThat(new Set(list.map(a=>a.toLowerCase())).size===list.length,'Duplicate reward token');
      }
      requireThat(p.hubRewardTokens.length<=8,'Hub supports at most eight rewards');
      const rewards=[p.asset,...p.hubRewardTokens.filter(a=>!eq(a,p.asset)),...p.externalRewardTokens];
      requireThat(rewards.length<=8&&new Set(rewards.map(a=>a.toLowerCase())).size===rewards.length,'Staking supports eight unique rewards including its principal token');
      p.disabledRewardTokens.forEach(a=>requireThat(rewards.some(t=>eq(t,a)),'Disabled reward is unregistered'));
    });
    if(name==='fraxtal')requireThat(eq(n.pools[0].asset,FRAXTAL_SDFXS)&&n.pools[0].hubRewardTokens.some(t=>eq(t,FRAXTAL_SDFXS)),'Fraxtal helper v5 requires sdFXS as registered PID-0 asset/reward');
  }
  return c;
}

export function predictAddresses(artifacts,deployer,deploymentId,count) {
  const factorySalt=id('CurveYield.BoostHubDeploymentFactory.v1');
  const factory=getCreate2Address(UNIVERSAL_PROXY,factorySalt,keccak256(artifacts.factory.bytecode));
  const get=(label)=>{
    const salt=id(deploymentId+'/'+label);
    const scoped=keccak256(coder.encode(['address','bytes32'],[deployer,salt]));
    const proxy=getCreate2Address(factory,scoped,keccak256(PROXY_CREATION));
    return getCreateAddress({from:proxy,nonce:1});
  };
  return {factory,factorySalt,hub:get('hub'),helper:get('helper'),staking:Array.from({length:count},(_,i)=>get('staking/'+i))};
}

export async function submitStep(ctx,label,transaction) {
  let step=ctx.state.steps[label];
  if(step?.status==='confirmed') {
    const receipt=await ctx.provider.getTransactionReceipt(step.hash);
    requireThat(receipt&&receipt.status===1,'Recorded transaction is absent/reverted: '+label);
    return receipt;
  }
  if(!step) {
    requireThat(ctx.signer,'A signing key is required for '+label);
    const populated=await ctx.signer.populateTransaction(transaction);
    const raw=await ctx.signer.signTransaction(populated);
    step=ctx.state.steps[label]={hash:keccak256(raw),raw,nonce:populated.nonce,status:'pending'};
    ctx.save(); // Save before the first network submission; a retry must use identical signed bytes.
  }
  let receipt=await ctx.provider.getTransactionReceipt(step.hash);
  if(!receipt) {
    const pending=await ctx.provider.getTransaction(step.hash);
    if(!pending) {
      try {await ctx.provider.broadcastTransaction(step.raw);}catch(e){
        const found=await ctx.provider.getTransactionReceipt(step.hash)||await ctx.provider.getTransaction(step.hash);
        if(!found)throw e;
      }
    }
    receipt=await ctx.provider.waitForTransaction(step.hash,ctx.confirmations,ctx.timeoutMs);
  }
  requireThat(receipt,'Receipt timeout for '+label+'; rerun the same command and keep its state file');
  requireThat(receipt.status===1,'Transaction reverted: '+label+' '+step.hash);
  step.status='confirmed';step.blockNumber=receipt.blockNumber;step.gasUsed=receipt.gasUsed.toString();
  delete step.raw;ctx.save();return receipt;
}

function codeMatches(artifact,actual) {
  if(!actual||actual==='0x')return false;
  let a=actual.slice(2).toLowerCase(),b=artifact.deployedBytecode.slice(2).toLowerCase();
  if(a.length!==b.length)return false;
  for(const refs of Object.values(artifact.immutableReferences||{}))for(const {start,length}of refs){
    a=a.slice(0,start*2)+'0'.repeat(length*2)+a.slice((start+length)*2);
    b=b.slice(0,start*2)+'0'.repeat(length*2)+b.slice((start+length)*2);
  }
  return a===b;
}

function loadArtifacts(root) {
  const manifest=parseJson(fs.readFileSync(path.join(root,'package_manifest_v1.json'),'utf8'));
  for(const [relative,digest] of Object.entries(manifest.sha256)) {
    const full=path.resolve(root,relative);requireThat(full.startsWith(root+path.sep),'Invalid manifest path');
    requireThat(sha256(fs.readFileSync(full))===digest,'Package integrity mismatch: '+relative);
  }
  const result={};for(const key of ['factory','hub','helper','helperFraxtal','staking']) result[key]=parseJson(fs.readFileSync(path.join(root,'artifacts_v1',key+'_v1.json'),'utf8'));
  return result;
}

export async function preflight(provider,network,prediction) {
  requireThat(Number(await provider.send('eth_chainId',[]))===network.chainId,'RPC connected to the wrong chain');
  const proxyCode=await provider.getCode(UNIVERSAL_PROXY);
  requireThat(proxyCode!=='0x'&&keccak256(proxyCode)===network.universalProxyCodeHash,'Canonical deterministic deployment proxy is missing or has different code');
  const dependencies=[['rewardDistributor',network.rewardDistributor]];
  if(!eq(network.vlBoost,ZeroAddress))dependencies.push(['vlBoost',network.vlBoost]);
  for(const [label,a]of dependencies) {
    requireThat(await provider.getCode(a)!=='0x',label+' has no contract code on chain '+network.chainId+'; configure a real dependency before deployment');
  }
  if(!eq(network.vlBoost,ZeroAddress)) {
    const vl=new Contract(network.vlBoost,['function delegatedIn(address) view returns(uint256)'],provider);await vl.delegatedIn(prediction.hub);
  }
  const stash=network.claimMode==='stash'?new Contract(network.rewardDistributor,['function merkleRoot(address) view returns(bytes32)','function update(address) view returns(uint256)'],provider):null;
  if(network.claimMode==='urd') {
    const urd=new Contract(network.rewardDistributor,['function root() view returns(bytes32)','function claimed(address,address) view returns(uint256)','function recipients(address) view returns(address)'],provider);
    await urd.root();await urd.claimed(prediction.hub,FRAXTAL_SDFXS);
    const recipient=await urd.recipients(prediction.hub);requireThat(eq(recipient,ZeroAddress)||eq(recipient,prediction.hub),'URD recipient would redirect rewards away from the new Hub');
  }
  for(const p of network.pools) {
    const gauge=new Contract(p.gauge,['function staking_token() view returns(address)'],provider);
    requireThat(eq(await gauge.staking_token(),p.asset),'Gauge asset does not match pool '+p.pid);
    const asset=new Contract(p.asset,['function totalSupply() view returns(uint256)'],provider);await asset.totalSupply();
    for(const token of [...p.hubRewardTokens,...p.externalRewardTokens]) requireThat(await provider.getCode(token)!=='0x','Reward token has no code: '+token);
    if(stash&&p.hubRewardTokens.length){await stash.merkleRoot(p.hubRewardTokens[0]);await stash.update(p.hubRewardTokens[0]);}
    requireThat(!eq(p.stakingFeeReceiver,prediction.hub)&&!eq(p.stakingFeeReceiver,network.sourceHub),'Staking admin fees must have an external receiver; the revised Hub has no retained-token recovery');
  }
}

async function transaction(ctx,label,request) {
  if(ctx.state.steps[label])return submitStep(ctx,label,request);
  const block=await ctx.provider.getBlock('latest');
  const cap=parseUnits(ctx.network.maxFeePerGasGwei,'gwei'),tip=parseUnits(ctx.network.priorityFeePerGasGwei,'gwei');
  requireThat(block.baseFeePerGas!==null,'EIP-1559 base fee unavailable');
  requireThat(block.baseFeePerGas+tip<=cap,'Current base fee plus priority exceeds the configured gas cap');
  const maxFee=block.baseFeePerGas*2n+tip<cap?block.baseFeePerGas*2n+tip:cap;
  const estimate=await ctx.provider.estimateGas({...request,from:ctx.signer.address});
  const gasLimit=estimate*120n/100n+10000n;
  requireThat(gasLimit<block.gasLimit,'Transaction exceeds block gas limit');
  requireThat(await ctx.provider.getBalance(ctx.signer.address)>=gasLimit*maxFee,'Insufficient native balance for '+label);
  console.log(ctx.name+': '+label);
  const receipt=await submitStep(ctx,label,{...request,type:2,maxFeePerGas:maxFee,maxPriorityFeePerGas:tip,gasLimit,chainId:ctx.network.chainId});
  console.log('  confirmed '+receipt.hash+'; gas '+receipt.gasUsed);return receipt;
}

export async function deployAndConfigure(ctx,artifacts,prediction) {
  const {provider,network:n,deployer,deploymentId}=ctx;
  for(const [label,step]of Object.entries(ctx.state.steps))if(step.status==='pending')await submitStep(ctx,label,{});
  const factory=new Contract(prediction.factory,artifacts.factory.abi,ctx.signer);
  const existingFactory=await provider.getCode(prediction.factory);
  if(existingFactory==='0x') await transaction(ctx,'factory',{to:UNIVERSAL_PROXY,data:concat([prediction.factorySalt,artifacts.factory.bytecode]),value:0});
  requireThat(codeMatches(artifacts.factory,await provider.getCode(prediction.factory)),'Unexpected CREATE3 factory runtime');
  async function deploy(label,artifact,args,expected) {
    const code=await provider.getCode(expected);
    if(code==='0x') {
      const creation=await new ContractFactory(artifact.abi,artifact.bytecode).getDeployTransaction(...args);
      await transaction(ctx,'deploy/'+label,await factory.deploy.populateTransaction(id(deploymentId+'/'+label),creation.data));
    }
    requireThat(codeMatches(artifact,await provider.getCode(expected)),'Unexpected deployed runtime: '+label);
    return new Contract(expected,artifact.abi,ctx.signer);
  }
  const helperArtifact=n.claimMode==='urd'?artifacts.helperFraxtal:artifacts.helper;
  const helperArgs=n.claimMode==='urd'?[deployer]:[deployer,n.rewardDistributor];
  const helper=await deploy('helper',helperArtifact,helperArgs,prediction.helper);
  const hub=await deploy('hub',artifacts.hub,[deployer,n.vlBoost,prediction.helper],prediction.hub);
  requireThat(eq(await helper.configurator(),deployer)&&eq(n.claimMode==='urd'?await helper.urd():await helper.merkleStash(),n.rewardDistributor),'Helper constructor differs from this release');
  let bound=await helper.boostHub();
  if(eq(bound,ZeroAddress))await transaction(ctx,'bind/helper',await helper.setBoostHub.populateTransaction(prediction.hub));
  requireThat(eq(await helper.boostHub(),prediction.hub),'Helper is bound to a different Hub');
  const sys=await hub.systemInfo();
  requireThat(eq(sys.vlBoost,n.vlBoost)&&eq(sys.stakeDaoClaimExecutor,prediction.helper),'Hub constructor differs from this release');
  requireThat(Number(sys.poolCount)<=n.pools.length,'Existing deployment contains unexpected pools');
  for(const p of n.pools) {
    const count=Number((await hub.systemInfo()).poolCount);
    if(count===p.pid)await transaction(ctx,'pool/'+p.pid,await hub.addPoolsBatch.populateTransaction([p.asset],[p.gauge],[p.hubRewardTokens]));
    const info=await hub.poolInfo(p.pid);
    requireThat(eq(info.asset,p.asset)&&eq(info.gauge,p.gauge),'Existing pool differs from configuration');
    requireThat(json(info.rewardTokens.map(a=>a.toLowerCase()))===json(p.hubRewardTokens.map(a=>a.toLowerCase())),'Existing Hub reward list differs');
    const rewardArgs=p.hubRewardTokens.filter(t=>!eq(t,p.asset));while(rewardArgs.length<8)rewardArgs.push(ZeroAddress);
    const staking=await deploy('staking/'+p.pid,artifacts.staking,[p.asset,prediction.hub,p.pid,deployer,rewardArgs,p.stakingFeeReceiver,p.rewardSmoothingUnits,p.keeper],prediction.staking[p.pid]);
    requireThat(eq(await staking.lp_token(),p.asset)&&eq(await staking.boost_hub(),prediction.hub)&&Number(await staking.pid())===p.pid,'Staking constructor differs');
    for(const token of p.externalRewardTokens) {
      const tokens=[];for(let i=0;i<Number(await staking.reward_count());i++)tokens.push(await staking.reward_tokens(i));
      if(!tokens.some(t=>eq(t,token)))await transaction(ctx,'external/'+p.pid+'/'+token,await staking.add_external_reward.populateTransaction(token));
    }
    for(const token of p.disabledRewardTokens)if(!await staking.reward_disabled(token))await transaction(ctx,'disable/'+p.pid+'/'+token,await staking.disable_reward.populateTransaction(token));
    const allowance=await new Contract(p.asset,['function allowance(address,address) view returns(uint256)'],provider).allowance(prediction.staking[p.pid],prediction.hub);
    requireThat(allowance>0n,'Principal approval to Hub failed for pool '+p.pid);
  }
  let needsConfig=false;
  for(const p of n.pools) {
    const q=await hub.poolInfo(p.pid);
    if(!eq(q.depositor,prediction.staking[p.pid])||q.depositorLocked!==p.lockDepositor||q.active!==p.active||!q.feeConfigSet||Number(q.platformFeeBps)!==p.platformFeeBps||!eq(q.platformFeeRecipient,p.platformFeeRecipient)||!eq(q.checkpointSelector,p.checkpointSelector))needsConfig=true;
  }
  if(needsConfig&&!ctx.state.steps['configure/pools'])await transaction(ctx,'configure/pools',await hub.setDepositors.populateTransaction(
    n.pools.map(p=>p.pid),prediction.staking.slice(0,n.pools.length),n.pools.map(p=>p.lockDepositor),n.pools.map(p=>p.checkpointSelector),
    n.pools.map(p=>[p.platformFeeBps,p.platformFeeRecipient]),n.pools.map(p=>p.active)));
  const pending=await hub.pendingTransactions();
  if(pending.feeChanges.length) {
    const now=BigInt((await provider.getBlock('latest')).timestamp);
    requireThat(pending.feeChanges.every(f=>f.readyAt<=now),'Fee timelock is still active; rerun after its readyAt timestamp');
    await transaction(ctx,'configure/executeFees',await hub.executeTransactions.populateTransaction());
  }
  for(const p of n.pools) {
    const staking=new Contract(prediction.staking[p.pid],artifacts.staking.abi,ctx.signer);
    if(!eq(await staking.admin(),p.stakingAdmin)&&!eq(await staking.future_admin(),p.stakingAdmin)) await transaction(ctx,'roles/staking/'+p.pid,await staking.commit_transfer_ownership.populateTransaction(p.stakingAdmin));
  }
  if(!eq(await hub.owner(),n.owner)&&!eq((await hub.pendingTransactions()).pendingOwner,n.owner)) await transaction(ctx,'roles/hub',await hub.transferOwnership.populateTransaction(n.owner));
  return verifyStack(ctx,artifacts,prediction);
}

export async function verifyStack(ctx,artifacts,prediction) {
  const {provider,network:n}=ctx;const pendingRoles=[];
  const helperArtifact=n.claimMode==='urd'?artifacts.helperFraxtal:artifacts.helper;
  for(const [artifact,a,label]of [[artifacts.factory,prediction.factory,'factory'],[helperArtifact,prediction.helper,'helper'],[artifacts.hub,prediction.hub,'hub']])requireThat(codeMatches(artifact,await provider.getCode(a)),'Runtime mismatch: '+label);
  const hub=new Contract(prediction.hub,artifacts.hub.abi,provider),helper=new Contract(prediction.helper,helperArtifact.abi,provider);
  requireThat(eq(await helper.boostHub(),prediction.hub)&&eq(n.claimMode==='urd'?await helper.urd():await helper.merkleStash(),n.rewardDistributor)&&eq(await helper.configurator(),ctx.deployer),'Helper configuration mismatch');
  const system=await hub.systemInfo();requireThat(eq(system.vlBoost,n.vlBoost)&&eq(system.stakeDaoClaimExecutor,prediction.helper)&&Number(system.poolCount)===n.pools.length,'Hub system configuration mismatch');
  if(!eq(await hub.owner(),n.owner)) {
    requireThat(eq((await hub.pendingTransactions()).pendingOwner,n.owner),'Final Hub owner is not queued');
    pendingRoles.push({address:prediction.hub,role:'Hub owner',receiver:n.owner,data:hub.interface.encodeFunctionData('executeTransactions')});
  }
  for(const p of n.pools) {
    const q=await hub.poolInfo(p.pid);requireThat(eq(q.asset,p.asset)&&eq(q.gauge,p.gauge)&&eq(q.depositor,prediction.staking[p.pid])&&q.depositorLocked===p.lockDepositor&&q.active===p.active&&q.feeConfigSet&&Number(q.platformFeeBps)===p.platformFeeBps&&eq(q.platformFeeRecipient,p.platformFeeRecipient)&&eq(q.checkpointSelector,p.checkpointSelector),'Hub pool configuration mismatch: '+p.pid);
    requireThat(json(q.rewardTokens.map(a=>a.toLowerCase()))===json(p.hubRewardTokens.map(a=>a.toLowerCase())),'Hub reward token mismatch');
    requireThat(codeMatches(artifacts.staking,await provider.getCode(prediction.staking[p.pid])),'Staking runtime mismatch: '+p.pid);
    const s=new Contract(prediction.staking[p.pid],artifacts.staking.abi,provider);
    requireThat(eq(await s.lp_token(),p.asset)&&eq(await s.boost_hub(),prediction.hub)&&Number(await s.pid())===p.pid&&eq(await s.keeper(),p.keeper)&&eq(await s.fee_receiver(),p.stakingFeeReceiver)&&Number(await s.reward_smoothing_units())===p.rewardSmoothingUnits,'Staking configuration mismatch: '+p.pid);
    const expected=[p.asset,...p.hubRewardTokens.filter(t=>!eq(t,p.asset)),...p.externalRewardTokens];
    requireThat(Number(await s.reward_count())===expected.length,'Staking reward count mismatch');
    for(let i=0;i<expected.length;i++) {
      const token=await s.reward_tokens(i);requireThat(eq(token,expected[i]),'Staking reward order mismatch');
      requireThat(await s.reward_from_boosthub(token)===p.hubRewardTokens.some(t=>eq(t,token)),'Staking reward source mismatch');
      requireThat(await s.reward_disabled(token)===p.disabledRewardTokens.some(t=>eq(t,token)),'Staking disabled-reward mismatch');
    }
    if(!eq(await s.admin(),p.stakingAdmin)) {
      requireThat(eq(await s.future_admin(),p.stakingAdmin),'Final staking admin is not queued');
      pendingRoles.push({address:prediction.staking[p.pid],role:'Staking admin',receiver:p.stakingAdmin,data:s.interface.encodeFunctionData('accept_transfer_ownership')});
    }
  }
  ctx.state.pendingRoles=pendingRoles;ctx.state.status=pendingRoles.length?'ROLE_ACCEPTANCE_REQUIRED':'CONFIGURED_AND_VERIFIED';ctx.state.addresses=prediction;ctx.save();
  console.log(ctx.name+': '+ctx.state.status);return ctx.state;
}

async function acceptRoles(ctx,artifacts,prediction) {
  const hub=new Contract(prediction.hub,artifacts.hub.abi,ctx.signer);
  if(!eq(await hub.owner(),ctx.network.owner)&&eq(ctx.signer.address,ctx.network.owner)) await transaction(ctx,'accept/hub',await hub.executeTransactions.populateTransaction());
  for(const p of ctx.network.pools)if(eq(ctx.signer.address,p.stakingAdmin)) {
    const s=new Contract(prediction.staking[p.pid],artifacts.staking.abi,ctx.signer);
    if(!eq(await s.admin(),p.stakingAdmin))await transaction(ctx,'accept/staking/'+p.pid,await s.accept_transfer_ownership.populateTransaction());
  }
  return verifyStack(ctx,artifacts,prediction);
}

export async function main(payload) {
  const root=path.resolve(payload.packageRoot||path.join(path.dirname(payload.configPath),'..'));
  const artifacts=loadArtifacts(root);
  const config=parseJson(fs.readFileSync(payload.configPath,'utf8'));
  if(payload.deployerAddress)config.deployer=payload.deployerAddress;
  if(payload.deploymentId)config.deploymentId=payload.deploymentId;
  for(const [name,overrides]of Object.entries(payload.dependencyOverrides||{})) Object.assign(config.chains[name],overrides);
  validateConfig(config);
  const prediction=predictAddresses(artifacts,config.deployer,config.deploymentId,Math.max(...Object.values(config.chains).map(n=>n.pools.length)));
  console.log('New BoostHub: '+prediction.hub+'\nClaim helper: '+prediction.helper+'\nDeployment factory: '+prediction.factory);
  const mode=payload.mode||'Check';requireThat(['Check','Deploy','Verify','AcceptRoles'].includes(mode),'Unknown mode');
  let key=payload.privateKey,signer;
  if(['Deploy','AcceptRoles'].includes(mode)) {
    requireThat(typeof key==='string'&&/^(0x)?[0-9a-fA-F]{64}$/.test(key),'A valid private key is required');
    try{signer=new Wallet(key.startsWith('0x')?key:'0x'+key);}catch{throw new Error('Invalid signing key');}
    if(mode==='Deploy')requireThat(eq(signer.address,config.deployer),'Signing account does not match configured deployer');
  }
  delete payload.privateKey;key=undefined;
  const selection=payload.chain==='Both'?['ethereum','fraxtal']:[(payload.chain||'ethereum').toLowerCase()];
  requireThat(selection.every(n=>n in config.chains),'Invalid chain selection');
  const contexts=[];
  const providers=[];
  try {
  for(const name of selection) {
    const network=config.chains[name],url=payload.rpcUrls?.[name]||network.rpcUrl;
    requireThat(/^https?:\/\//.test(url),'RPC URL is required for '+name);
    const request=new FetchRequest(url);request.timeout=30000;
    const provider=new JsonRpcProvider(request,network.chainId,{staticNetwork:true,batchMaxCount:1,cacheTimeout:-1});provider.pollingInterval=1000;
    providers.push(provider);
    await preflight(provider,network,prediction);
    const stateDir=path.resolve(payload.stateDirectory);fs.mkdirSync(stateDir,{recursive:true});
    const statePath=path.join(stateDir,'deployment_'+name+'_v1.json');
    const configDigest=sha256(json({deployer:config.deployer,deploymentId:config.deploymentId,network:{...network,rpcUrl:undefined},artifacts:Object.fromEntries(Object.entries(artifacts).map(([k,a])=>[k,sha256(json(a))]))}));
    const state=fs.existsSync(statePath)?parseJson(fs.readFileSync(statePath,'utf8')):{version:'v1',chainId:network.chainId,configDigest,steps:{},status:'INITIALIZED'};
    requireThat(state.configDigest===configDigest,'State belongs to different configuration/artifacts; restore its exact inputs');
    const ctx={name,provider,network,state,deployer:config.deployer,deploymentId:config.deploymentId,
      signer:signer?.connect(provider),confirmations:network.confirmations||1,timeoutMs:600000,
      save:()=>{const temp=statePath+'.tmp';fs.writeFileSync(temp,json(state));fs.renameSync(temp,statePath);}};
    contexts.push(ctx);
  }
    for(const ctx of contexts) {
      if(mode==='Check'){console.log(ctx.name+': preflight passed; '+ctx.network.pools.length+' pools');continue;}
      if(mode==='Deploy')await deployAndConfigure(ctx,artifacts,prediction);
      if(mode==='Verify')await verifyStack(ctx,artifacts,prediction);
      if(mode==='AcceptRoles')await acceptRoles(ctx,artifacts,prediction);
    }
  }finally{for(const provider of providers)provider.destroy();}
}

if(process.env.BOOSTHUB_EXECUTE==='1') {
  let payload;
  try { payload=parseJson(fs.readFileSync(0,'utf8')); }
  catch { console.error('Stopped: invalid input JSON; rerun through the PowerShell wrapper.');process.exitCode=1; }
  if(payload)main(payload).catch(e=>{
    const message=String(e.shortMessage||e.reason||e.message||e.code||'Unknown error').replace(/https?:\/\/[^\s"']+/g,'[RPC endpoint]');
    console.error('Stopped: '+message);process.exitCode=1;
  });
}
