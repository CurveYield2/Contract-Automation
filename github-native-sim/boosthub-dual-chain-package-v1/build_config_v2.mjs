import fs from 'node:fs';
import path from 'node:path';
import {keccak256,ZeroAddress} from 'ethers';
import {FRAXTAL_URD} from './deployment/deploy_runner_v2.mjs';
const root=path.dirname(new URL(import.meta.url).pathname),release=path.join(root,'release_v3');
const snapshot=JSON.parse(fs.readFileSync(path.join(root,'evidence/live_stack_snapshot_v1.json')));
const config={version:'v2',deploymentId:'CurveYield.BoostHub.Stack.v3',deployer:ZeroAddress,chains:{}};
for(const [name,chainId]of [['ethereum',1],['fraxtal',252]]) {
  const live=snapshot[name];
  config.chains[name]={chainId,rpcUrl:name==='ethereum'?'https://eth.drpc.org':'https://rpc.frax.com',
    sourceHub:live.address,owner:live.reads.owner,vlBoost:name==='ethereum'?live.reads.vlBoost:ZeroAddress,
    rewardDistributor:name==='ethereum'?live.dependencyCode.stakeDaoClaimExecutor.reads.merkleStash:FRAXTAL_URD,
    claimMode:name==='ethereum'?'stash':'urd',maxFeePerGasGwei:name==='ethereum'?'10':'1',priorityFeePerGasGwei:name==='ethereum'?'0.05':'0.000001',confirmations:1,
    universalProxyCodeHash:keccak256(live.universalProxyCode),pools:live.pools.map(p=>{
      const reads=p.staking.reads,fee=p.poolFeeConfig,asset=p.poolInfo.asset;
      const external=[]; // Fresh deployments import Hub rewards; no legacy governance-token defaults.
      const hub=p.poolInfo.rewardTokens;
      const all=[asset,...hub.filter(t=>t.toLowerCase()!==asset.toLowerCase()),...external];
      return {pid:p.pid,asset,gauge:p.poolInfo.gauge,stakingAdmin:reads.admin,keeper:reads.keeper||reads.admin,
        stakingFeeReceiver:fee.platformFeeRecipient,platformFeeRecipient:fee.platformFeeRecipient,platformFeeBps:Number(fee.platformFeeBps),
        rewardSmoothingUnits:Number(reads.reward_smoothing_units||0),active:p.poolInfo.active,lockDepositor:p.poolDepositorLocked,
        checkpointSelector:p.poolCheckpointSelector,hubRewardTokens:hub,externalRewardTokens:external,
        disabledRewardTokens:(p.staking.rewardTokens||[]).filter(t=>t.reward_disabled===true&&all.some(a=>a.toLowerCase()===t.token.toLowerCase())).map(t=>t.token)};
    })};
}
fs.writeFileSync(path.join(release,'deployment/deployment_config_v2.json'),JSON.stringify(config,null,2)+'\n');
console.log('Operator configuration created; supply your EOA using -DeployerAddress before checking or deploying');
