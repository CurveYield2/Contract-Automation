#!/usr/bin/env node
"use strict";
const path=require("path");
const {ROOT,saveJson,getContext,codeExists,solArtifact,vyperArtifact,deploy,send,pad8,ethers}=require("./lib-v3");

const LABELS=["sdCRV","sdFXN","sdYB"];
const VAULT_LABELS=["sdCRV","sdFXN"];
const ZERO_SELECTOR=ethers.ZeroHash.slice(0,10);
const BOOSTHUB_ABI=[
  "function owner() view returns(address)",
  "function poolInfo(uint256) view returns(tuple(address asset,address gauge,bool active,uint256 totalStaked,address[] rewardTokens))",
  "function isRewardToken(uint256,address) view returns(bool)",
  "function poolDepositor(uint256) view returns(address)",
  "function poolDepositorLocked(uint256) view returns(bool)",
  "function poolRetentionFeeBps(uint256) view returns(uint16)",
  "function poolCheckpointSelector(uint256) view returns(bytes4)",
  "function setPoolRuntimeConfigs(uint256[] pids,uint16[] retentionFeeBps,address[] depositors,bytes4[] checkpointSelectors)"
];
const TEMPLATE_GENERIC=["function tokenIn() view returns(address)","function tokenOut() view returns(address)","function router() view returns(address)","function route() view returns(address[9])","function swapParams() view returns(uint256[3][4])"];
const TEMPLATE_WST=["function wstEth() view returns(address)","function stEth() view returns(address)","function tokenOut() view returns(address)","function router() view returns(address)","function route() view returns(address[9])","function swapParams() view returns(uint256[3][4])"];
const COINS_ABI=["function coins(uint256) view returns(address)"];

function lower(label){return label.toLowerCase();}
function same(a,b){return ethers.getAddress(a)===ethers.getAddress(b);}
function requiredState(ctx,key){const a=ctx.state.contracts[key]?.address;if(!a)throw new Error(`missing deployment state contract ${key}`);return ethers.getAddress(a);}
function converterAddress(map,key){const a=map[key];if(!a)throw new Error(`unknown converter key ${key}`);return ethers.getAddress(a);}
function rewardConverters(p,map){return pad8(p.rewardConverterKeys.map(k=>converterAddress(map,k)));}
function routeConverters(p,map){return p.strategyRouteConverterKeys.map(k=>converterAddress(map,k));}

async function preflight(ctx){
  if((await ctx.provider.getNetwork()).chainId!==1n)throw new Error("Ethereum mainnet chainId 1 required");
  if(!await codeExists(ctx.provider,ctx.config.boostHub))throw new Error("BoostHub has no code");
  const hub=new ethers.Contract(ctx.config.boostHub,BOOSTHUB_ABI,ctx.wallet);
  const hubOwner=ethers.getAddress(await hub.owner());
  if(hubOwner!==ctx.walletAddress)throw new Error(`ABORT BEFORE DEPLOYMENT: signer ${ctx.walletAddress} is not current BoostHub owner ${hubOwner}`);
  const pre={boostHubOwner:hubOwner,pools:{}};
  for(const label of LABELS){
    const p=ctx.config.pools[label],info=await hub.poolInfo(p.pid);
    if(!same(info.asset,p.asset))throw new Error(`${label} BoostHub PID asset mismatch`);
    if(!info.active)throw new Error(`${label} BoostHub pool inactive`);
    for(const token of p.rewardTokens)if(!(await hub.isRewardToken(p.pid,token)))throw new Error(`${label} reward token not registered in BoostHub: ${token}`);
    const locked=await hub.poolDepositorLocked(p.pid);if(locked)throw new Error(`ABORT BEFORE DEPLOYMENT: ${label} PID ${p.pid} depositor is permanently locked`);
    pre.pools[label]={pid:p.pid,depositor:ethers.getAddress(await hub.poolDepositor(p.pid)),locked:false,retentionFeeBps:Number(await hub.poolRetentionFeeBps(p.pid)),checkpointSelector:await hub.poolCheckpointSelector(p.pid)};
  }
  for(const [name,address] of Object.entries(ctx.config.converterTemplates))if(!await codeExists(ctx.provider,address))throw new Error(`converter template ${name} has no code: ${address}`);
  const sc=ctx.config.sdYbConverter;for(const a of [sc.crvUsdYbPool,sc.ybSdYbPool])if(!await codeExists(ctx.provider,a))throw new Error(`sdYB Curve pool has no code: ${a}`);
  const p1=new ethers.Contract(sc.crvUsdYbPool,COINS_ABI,ctx.wallet),p2=new ethers.Contract(sc.ybSdYbPool,COINS_ABI,ctx.wallet);
  if(!same(await p1.coins(0),sc.crvUSD)||!same(await p1.coins(1),sc.yb))throw new Error("crvUSD/YB pool coin ordering mismatch");
  if(!same(await p2.coins(0),sc.yb)||!same(await p2.coins(1),sc.sdYB))throw new Error("YB/sdYB pool coin ordering mismatch");
  ctx.state.checks.preflight=pre;ctx.state.phase="preflight-passed";saveJson(ctx.statePath,ctx.state);return hub;
}

async function deployConverters(ctx){
  const genericA=solArtifact("boosthub/converters/CurveRouterRewardConverter-v1.sol","CurveRouterRewardConverter");
  const crvUsdA=solArtifact("boosthub/converters/CysdCrvCrvUsdRewardConverterV1-flattened-v3.sol","CysdCrvCrvUsdRewardConverterV1");
  const wstA=solArtifact("boosthub/converters/WstEthCurveRouterRewardConverter-v1.sol","WstEthCurveRouterRewardConverter");
  const sdYbA=solArtifact("boosthub/converters/SdYbRewardConverter-v1.sol","SdYbRewardConverter");
  const crvTemplate=new ethers.Contract(ctx.config.converterTemplates.crvToSdCrv,TEMPLATE_GENERIC,ctx.wallet);
  const crvRoute=Array.from(await crvTemplate.route());
  const crvSwapParams=Array.from(await crvTemplate.swapParams(),row=>Array.from(row));
  const crvArgs=[await crvTemplate.tokenIn(),await crvTemplate.tokenOut(),await crvTemplate.router(),crvRoute,crvSwapParams];
  if(!same(crvArgs[0],ctx.config.pools.sdCRV.strategyRouteTokens[0])||!same(crvArgs[1],ctx.config.pools.sdCRV.asset))throw new Error("CRV->sdCRV converter template token mismatch");
  const crv=await deploy(ctx,"crvToSdCrvConverter",genericA,crvArgs);
  const crvUsd=await deploy(ctx,"crvUsdToSdCrvConverter",crvUsdA,[]);
  const wstTemplate=new ethers.Contract(ctx.config.converterTemplates.wstEthToSdFxn,TEMPLATE_WST,ctx.wallet);
  const wstRoute=Array.from(await wstTemplate.route());
  const wstSwapParams=Array.from(await wstTemplate.swapParams(),row=>Array.from(row));
  const wstArgs=[await wstTemplate.wstEth(),await wstTemplate.stEth(),await wstTemplate.tokenOut(),await wstTemplate.router(),wstRoute,wstSwapParams];
  if(!same(wstArgs[0],ctx.config.pools.sdFXN.strategyRouteTokens[0])||!same(wstArgs[2],ctx.config.pools.sdFXN.asset))throw new Error("wstETH->sdFXN converter template token mismatch");
  const wst=await deploy(ctx,"wstEthToSdFxnConverter",wstA,wstArgs);
  const sc=ctx.config.sdYbConverter;
  const sdYb=await deploy(ctx,"crvUsdToSdYbConverter",sdYbA,[sc.crvUSD,sc.yb,sc.sdYB,sc.crvUsdYbPool,sc.ybSdYbPool]);
  return {
    DEPLOYED_CRV_TO_SDCRV:await crv.getAddress(),
    DEPLOYED_CRVUSD_TO_SDCRV:await crvUsd.getAddress(),
    DEPLOYED_WSTETH_TO_SDFXN:await wst.getAddress(),
    DEPLOYED_CRVUSD_TO_SDYB:await sdYb.getAddress()
  };
}

async function deployStaking(ctx,label,governanceToken,converterMap){
  const p=ctx.config.pools[label],key=lower(label),stakingA=vyperArtifact("BoostHubStaking-v17");
  const staking=await deploy(ctx,`${key}Staking`,stakingA,[p.asset,await governanceToken.getAddress(),ctx.config.boostHub,p.pid,ctx.walletAddress,pad8(p.rewardTokens),rewardConverters(p,converterMap),p.withdrawFeeBps,p.performanceFeeBps,p.performanceFeeReceiver,p.yieldBoostFeeBps,p.rewardSmoothingUnits,p.activationDurationUnits,p.keeper]);
  if(p.performanceFeeStaked&&!(await staking.performance_fee_staked()))await send(ctx,`configure:${key}:performanceFeeStaked`,staking,"set_performance_fee_staked",[true]);
  return staking;
}

async function deployVaultStrategyGauge(ctx,label,governanceToken,staking,converterMap){
  const p=ctx.config.pools[label],key=lower(label);
  const vaultA=solArtifact("CurveYieldVault.sol","CurveYieldVault"),strategyA=solArtifact("boosthub/CurveYieldStakingStrategyV2.sol","CurveYieldStakingStrategyV2"),gaugeA=vyperArtifact("CurveYieldGauge-v1");
  const vault=await deploy(ctx,`${key}Vault`,vaultA,[p.vaultName,p.vaultSymbol,ctx.walletAddress,ctx.config.vaultFeeReceiver,p.vaultDecimals]);
  const strategy=await deploy(ctx,`${key}Strategy`,strategyA,[p.asset,await vault.getAddress(),await staking.getAddress(),ctx.walletAddress,p.strategyRouteTokens,routeConverters(p,converterMap),p.strategyRouteMinAmounts]);
  if((await strategy.cyGov())===ethers.ZeroAddress)await send(ctx,`configure:${key}:setCyGov`,strategy,"setCyGov",[await governanceToken.getAddress()]);
  if((await vault.configurator())!==ethers.ZeroAddress)await send(ctx,`configure:${key}:vault.setStrategy`,vault,"setStrategy",[await strategy.getAddress()]);
  const gauge=await deploy(ctx,`${key}Gauge`,gaugeA,[await vault.getAddress(),ctx.walletAddress]);
  const rd=await gauge.reward_data(await governanceToken.getAddress());
  if(ethers.getAddress(rd.distributor)===ethers.ZeroAddress)await send(ctx,`configure:${key}:gauge.addCyGov`,gauge,"add_reward",[await governanceToken.getAddress(),await strategy.getAddress()]);
  else if(!same(rd.distributor,await strategy.getAddress()))throw new Error(`${label} gauge cyGOV distributor mismatch`);
  if((await strategy.cyGovChildGauge())===ethers.ZeroAddress)await send(ctx,`configure:${key}:setCyGovChildGauge`,strategy,"setCyGovChildGauge",[await gauge.getAddress()]);
  else if(!same(await strategy.cyGovChildGauge(),await gauge.getAddress()))throw new Error(`${label} Strategy bound to unexpected gauge`);
  return {vault,strategy,gauge};
}

async function whitelistCyGov(ctx,governanceToken,entries){for(const [key,address] of entries){if(!(await governanceToken.transferWhitelist(address)))await send(ctx,`cygovWhitelist:${key}`,governanceToken,"setTransferWhitelist",[address,true]);}}
async function containsReward(staking,token){const n=Number(await staking.reward_count());for(let i=0;i<n;i++)if(same(await staking.reward_tokens(i),token))return true;return false;}
async function configureCyGovStaking(ctx,governanceToken,stakings){const cyGov=await governanceToken.getAddress();for(const [label,staking] of Object.entries(stakings)){if(!await containsReward(staking,cyGov))await send(ctx,`staking:${label}:addCyGovExternalReward`,staking,"add_external_reward",[cyGov]);if(await staking.reward_from_boosthub(cyGov))throw new Error(`${label}: cyGOV incorrectly marked BoostHub-native`);}}
async function fundCyGov(ctx,governanceToken,stakings){const cyGov=await governanceToken.getAddress();let total=0n;for(const label of LABELS)total+=BigInt(ctx.config.cyGovRewardFunding?.[label]||"0");if((await governanceToken.balanceOf(ctx.walletAddress))<total)throw new Error("insufficient cyGOV for configured external reward funding");for(const label of LABELS){const amount=BigInt(ctx.config.cyGovRewardFunding?.[label]||"0");if(amount===0n)continue;const staking=stakings[label];await send(ctx,`cygov:${label}:approve`,governanceToken,"approve",[await staking.getAddress(),amount]);await send(ctx,`cygov:${label}:fund`,staking,"deposit_reward_token",[cyGov,amount]);await send(ctx,`cygov:${label}:clearApproval`,governanceToken,"approve",[await staking.getAddress(),0]);}}

async function cutoverBoostHub(ctx,hub,stakings){
  const pre=ctx.state.checks.preflight.pools,pids=[],fees=[],depositors=[],selectors=[];
  for(const label of LABELS){const p=ctx.config.pools[label];if(await hub.poolDepositorLocked(p.pid))throw new Error(`${label}: depositor became locked before cutover`);pids.push(p.pid);fees.push(pre[label].retentionFeeBps);depositors.push(await stakings[label].getAddress());selectors.push(ZERO_SELECTOR);}
  await send(ctx,"boostHub:setPoolRuntimeConfigs:threePools",hub,"setPoolRuntimeConfigs",[pids,fees,depositors,selectors]);
  for(const label of LABELS){const p=ctx.config.pools[label],expected=await stakings[label].getAddress();if(!same(await hub.poolDepositor(p.pid),expected))throw new Error(`${label}: BoostHub depositor replacement failed`);if(await hub.poolDepositorLocked(p.pid))throw new Error(`${label}: NEW STAKING CONTRACT WAS PERMANENTLY LOCKED`);if(Number(await hub.poolRetentionFeeBps(p.pid))!==pre[label].retentionFeeBps)throw new Error(`${label}: active retention fee changed during depositor cutover`);if((await hub.poolCheckpointSelector(p.pid)).toLowerCase()!==pre[label].checkpointSelector.toLowerCase())throw new Error(`${label}: checkpoint selector changed during depositor cutover`);}
  ctx.state.checks.boostHubCutover={method:"setPoolRuntimeConfigs",checkpointSelectorsArgument:[ZERO_SELECTOR,ZERO_SELECTOR,ZERO_SELECTOR],lockFunctionCalled:false,postCutoverUnlocked:true};ctx.state.phase="boosthub-depositors-switched-unlocked";saveJson(ctx.statePath,ctx.state);
}

async function proposeHandoffs(ctx,governanceToken,stakings,stacks){
  const target=ethers.getAddress(ctx.config.finalAdmin);
  const ownables=[["governanceToken",governanceToken],["sdcrvStrategy",stacks.sdCRV.strategy],["sdfxnStrategy",stacks.sdFXN.strategy]];
  for(const [key,c] of ownables){if(same(await c.owner(),target))continue;if(!same(await c.owner(),ctx.walletAddress))throw new Error(`${key}: deployer no longer owner`);if(!same(await c.pendingOwner(),target))await send(ctx,`handoff:${key}`,c,"transferOwnership",[target]);}
  for(const label of LABELS){const c=stakings[label];if(same(await c.admin(),target))continue;if(!same(await c.admin(),ctx.walletAddress))throw new Error(`${label}: deployer no longer staking admin`);if(!same(await c.future_admin(),target))await send(ctx,`handoff:${label}:staking`,c,"commit_transfer_ownership",[target]);}
  for(const label of VAULT_LABELS){const g=stacks[label].gauge;if(!same(await g.manager(),target))await send(ctx,`handoff:${label}:gaugeManager`,g,"set_gauge_manager",[target]);}
  ctx.state.phase=target===ctx.walletAddress?"deployment-complete":"admin-handoff-proposed";saveJson(ctx.statePath,ctx.state);
}

async function acceptHandoffs(ctx){
  const me=ctx.walletAddress,target=ethers.getAddress(ctx.config.finalAdmin);if(me!==target)throw new Error("accept mode signer must equal finalAdmin");
  const ownableA=["function owner() view returns(address)","function pendingOwner() view returns(address)","function acceptOwnership()"];
  for(const key of ["governanceToken","sdcrvStrategy","sdfxnStrategy"]){const c=new ethers.Contract(requiredState(ctx,key),ownableA,ctx.wallet);if(!same(await c.owner(),me)&&same(await c.pendingOwner(),me))await send(ctx,`handoff:accept:${key}`,c,"acceptOwnership",[]);}
  const stakingA=vyperArtifact("BoostHubStaking-v17");for(const label of LABELS){const c=new ethers.Contract(requiredState(ctx,`${lower(label)}Staking`),stakingA.abi,ctx.wallet);if(!same(await c.admin(),me)&&same(await c.future_admin(),me))await send(ctx,`handoff:accept:${label}:staking`,c,"accept_transfer_ownership",[]);}
  ctx.state.phase="deployment-complete";saveJson(ctx.statePath,ctx.state);
}

async function verify(ctx){
  const hub=new ethers.Contract(ctx.config.boostHub,BOOSTHUB_ABI,ctx.wallet),cyGov=requiredState(ctx,"governanceToken");
  if(ctx.state.contracts.sdybVault||ctx.state.contracts.sdybStrategy||ctx.state.contracts.sdybGauge)throw new Error("sdYB Vault/Strategy/Gauge must not exist in v3 deployment");
  for(const label of LABELS){const p=ctx.config.pools[label],sAddr=requiredState(ctx,`${lower(label)}Staking`),sA=vyperArtifact("BoostHubStaking-v17"),s=new ethers.Contract(sAddr,sA.abi,ctx.wallet);if(!same(await s.lp_token(),p.asset)||!same(await s.governance_token(),cyGov)||!same(await s.boost_hub(),ctx.config.boostHub)||Number(await s.pid())!==p.pid)throw new Error(`${label}: staking binding invalid`);if(await hub.poolDepositorLocked(p.pid))throw new Error(`${label}: BoostHub depositor unexpectedly locked`);if(!same(await hub.poolDepositor(p.pid),sAddr))throw new Error(`${label}: BoostHub depositor mismatch`);}
  for(const label of VAULT_LABELS){const key=lower(label),vAddr=requiredState(ctx,`${key}Vault`),stAddr=requiredState(ctx,`${key}Strategy`),gAddr=requiredState(ctx,`${key}Gauge`),vA=solArtifact("CurveYieldVault.sol","CurveYieldVault"),stA=solArtifact("boosthub/CurveYieldStakingStrategyV2.sol","CurveYieldStakingStrategyV2"),gA=vyperArtifact("CurveYieldGauge-v1"),v=new ethers.Contract(vAddr,vA.abi,ctx.wallet),st=new ethers.Contract(stAddr,stA.abi,ctx.wallet),g=new ethers.Contract(gAddr,gA.abi,ctx.wallet);if(!same(await v.strategy(),stAddr)||await v.configurator()!==ethers.ZeroAddress)throw new Error(`${label}: Vault binding invalid`);if(!same(await st.vault(),vAddr)||!same(await st.staking(),requiredState(ctx,`${key}Staking`))||!same(await st.cyGov(),cyGov)||!same(await st.cyGovChildGauge(),gAddr))throw new Error(`${label}: Strategy binding invalid`);if(!same(await g.lp_token(),vAddr))throw new Error(`${label}: Gauge want/lp token is not Vault receipt token`);const rd=await g.reward_data(cyGov);if(!same(rd.distributor,stAddr))throw new Error(`${label}: Gauge cyGOV distributor invalid`);}
  ctx.state.phase="verified";ctx.state.checks.finalVerification={passed:true,sdYbVaultStrategyGaugeAbsent:true,boostHubDepositorsUnlocked:true};saveJson(ctx.statePath,ctx.state);console.log(JSON.stringify(ctx.state.checks.finalVerification,null,2));
}

async function deployAll(ctx){
  const hub=await preflight(ctx);
  const tokenA=solArtifact("CurveYieldGovernanceToken.sol","CurveYieldGovernanceToken");
  const governanceToken=await deploy(ctx,"governanceToken",tokenA,[ctx.walletAddress,ctx.config.governanceToken.name,ctx.config.governanceToken.symbol]);
  const converterMap=await deployConverters(ctx);ctx.state.checks.converterMap=Object.fromEntries(Object.entries(converterMap).map(([k,v])=>[k,ethers.getAddress(v)]));saveJson(ctx.statePath,ctx.state);
  const stakings={};for(const label of LABELS)stakings[label]=await deployStaking(ctx,label,governanceToken,converterMap);
  const stacks={};for(const label of VAULT_LABELS)stacks[label]=await deployVaultStrategyGauge(ctx,label,governanceToken,stakings[label],converterMap);
  await whitelistCyGov(ctx,governanceToken,[
    ["sdCRV:staking",await stakings.sdCRV.getAddress()],["sdCRV:strategy",await stacks.sdCRV.strategy.getAddress()],["sdCRV:gauge",await stacks.sdCRV.gauge.getAddress()],
    ["sdFXN:staking",await stakings.sdFXN.getAddress()],["sdFXN:strategy",await stacks.sdFXN.strategy.getAddress()],["sdFXN:gauge",await stacks.sdFXN.gauge.getAddress()],
    ["sdYB:staking",await stakings.sdYB.getAddress()]
  ]);
  await configureCyGovStaking(ctx,governanceToken,stakings);await fundCyGov(ctx,governanceToken,stakings);
  await cutoverBoostHub(ctx,hub,stakings);await proposeHandoffs(ctx,governanceToken,stakings,stacks);await verify(ctx);
  console.log(`deployment/configuration complete through ${ctx.state.phase}; state=${ctx.statePath}`);
}

async function main(){const mode=process.argv[2]||"deploy";const configPath=path.resolve(process.argv[3]||path.join(ROOT,"config-production-v3.json")),statePath=path.resolve(process.env.STATE_FILE||path.join(ROOT,"deployment-state-v3.json"));const ctx=await getContext(configPath,statePath);if(mode==="deploy")await deployAll(ctx);else if(mode==="accept"){await acceptHandoffs(ctx);await verify(ctx);}else if(mode==="verify")await verify(ctx);else throw new Error(`unknown mode ${mode}`);}
main().catch(e=>{console.error(e);process.exitCode=1;});
