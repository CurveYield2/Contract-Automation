// Protocol-aware Phase 0 actions for Balancer v3. No Uniswap-style pair assumptions.
import {buildBalancerV3CreatorArgumentsV1} from './phase0-fixture-synthesis-v1.mjs';
// All addresses and token orders are validated against the deployed Vault.
const ADDRESS_RE=/^0x[0-9a-fA-F]{40}$/;
const BALANCER_RE=/@balancer-labs\/v3-|balancer\/v3|balancer-v3/i;
const VIEW_ABI=[
  'function isPoolRegistered(address) view returns (bool)',
  'function isPoolInitialized(address) view returns (bool)',
  'function getPoolTokens(address) view returns (address[])',
  'function getVaultExtension() view returns (address)'
];
function nameOf(target){return String(target?.logicalQualifiedName??target?.qualifiedName??'');}
function lower(x){return String(x??'').toLowerCase();}
function addresses(ethers,rows){
  const out=new Map();
  for(const row of rows){try{const a=ethers.getAddress(String(row));out.set(a.toLowerCase(),a);}catch{}}
  return [...out.values()];
}
export function isBalancerV3TargetV1(target){
  return BALANCER_RE.test(nameOf(target));
}
export function balancerV3ActionRequirementsV1(target,selected){
  if(!isBalancerV3TargetV1(target))return{kind:'GENERIC'};
  const name=nameOf(target),signature=String(selected?.signature??'');
  if(/(?:RouterHooks|CompositeLiquidityRouterHooks|BufferRouterHooks)\.sol:/.test(name)||/^(?:[A-Za-z0-9_]*Hook|query[A-Z][^(]*)\(/.test(signature)){
    return{kind:'UNROUTABLE',reason:'BALANCER_V3_HOOK_REQUIRES_VAULT_UNLOCK_CALLBACK'};
  }
  if(/ProtocolFeeController\.sol:/.test(name)&&/^registerPool\(/.test(signature)){
    return{kind:'UNROUTABLE',reason:'BALANCER_V3_REGISTER_POOL_MUST_BE_CALLED_BY_VAULT'};
  }
  if(/Pool.*Factory|WeightedPool8020Factory/.test(name)&&/^create\(/.test(signature)){
    return{kind:'FACTORY_CREATE'};
  }
  if(/(?:VaultExtension|VaultAdmin)\.sol:/.test(name)&&(target.contextType??'DIRECT')==='DIRECT'){
    return{kind:'UNROUTABLE',reason:'BALANCER_V3_REQUIRES_REAL_VAULT_DELEGATE_CONTEXT'};
  }
  if(/\/Vault\.sol:Vault$/.test(name)&&/^(?:addLiquidity|removeLiquidity|swap|initialize|registerPool)\(/.test(signature)){
    return{kind:'UNROUTABLE',reason:'BALANCER_V3_VAULT_INTERNAL_REQUIRES_ROUTER_OR_FACTORY'};
  }
  if(/(?:Router|LiquidityRouter)(?:\.sol:|$)/.test(name)&&/^(?:initialize|addLiquidity|removeLiquidity|swap)/.test(signature)){
    return{kind:'ROUTER_POOL_STATE_REQUIRED'};
  }
  return{kind:'GENERIC'};
}

export async function discoverBalancerV3PoolsV1({provider,ethers,targets=[],valuePool={},actors=[]}={}){
  const systemTargets=targets.filter(isBalancerV3TargetV1);
  const evidence={
    schemaVersion:'curveyield-phase0-balancer-v3-call-context-v1',
    protocol:'BALANCER_V3_VAULT_UNLOCK_ROUTER_EXECUTION',
    active:systemTargets.length>0,
    status:'NOT_APPLICABLE',vaults:[],pools:[],
    limitations:[],
    candidateCount:0
  };
  if(!systemTargets.length)return evidence;
  // Only the main Vault owns registration state. A standalone VaultExtension or
  // ProtocolFeeController is never a substitute for it.
  const vaults=systemTargets.filter(t=>/\/Vault\.sol:Vault$/.test(nameOf(t))&&(t.contextType??'DIRECT')==='DIRECT');
  const factoryPools=[];
  const factories=systemTargets.filter(t=>
    /Factory/.test(nameOf(t))&&
    (t.contextType??'DIRECT')==='DIRECT'&&
    (t.artifact?.abi??[]).some(f=>f?.name==='getPools'&&f?.type==='function')
  );
  for(const factory of factories.slice(0,8)){
    try{
      const c=new ethers.Contract(factory.address,['function getPools() view returns (address[])'],provider);
      const poolList=await c.getPools();
      if(Array.isArray(poolList))factoryPools.push(...poolList.slice(0,50));
    }catch(error){
      evidence.limitations.push({type:'FACTORY_POOL_ENUMERATION_FAILED',factory:factory.address,message:String(error?.shortMessage??error?.message??error).slice(0,300)});
    }
  }
  const registeredCandidates=addresses(ethers,[
    ...factoryPools,
    ...(valuePool.created??[]),
    ...targets.filter(t=>/Pool(?:\.sol:|$)/.test(nameOf(t))&&!/Factory|Router|Controller|Vault/.test(nameOf(t))).map(t=>t.address),
    ...(valuePool.pools??[]),
    ...Object.keys(valuePool.associations??{})
  ]).slice(0,120);
  evidence.candidateCount=registeredCandidates.length;
  for(const vault of vaults.slice(0,3)){
    const entry={address:vault.address,verified:false,extension:null};
    evidence.vaults.push(entry);
    try{
      const contract=new ethers.Contract(vault.address,VIEW_ABI,provider);
      entry.extension=await contract.getVaultExtension();
      if(!ADDRESS_RE.test(String(entry.extension))||await provider.getCode(entry.extension)==='0x')throw Error('unlinked VaultExtension');
      entry.verified=true;
      for(const pool of registeredCandidates){
        let registered=false;
        try{registered=await contract.isPoolRegistered(pool);}catch{}
        if(!registered)continue;
        const initialized=await contract.isPoolInitialized(pool).catch(()=>false);
        const tokens=addresses(ethers,await contract.getPoolTokens(pool).catch(()=>[]));
        if(tokens.length<2){evidence.limitations.push({type:'REGISTERED_POOL_TOKENS_UNAVAILABLE',vault:vault.address,pool});continue;}
        const bptHolders=[];
        if(initialized){
          const bpt=new ethers.Contract(pool,['function balanceOf(address) view returns (uint256)'],provider);
          for(const actor of actors.slice(0,8)){
            const amount=await bpt.balanceOf(actor).catch(()=>0n);
            if(BigInt(amount)>0n)bptHolders.push({actor,amount:BigInt(amount).toString()});
          }
        }
        evidence.pools.push({address:pool,vault:vault.address,registered:true,initialized,tokens,tokenOrder:'VAULT_GET_POOL_TOKENS',bptHolders});
      }
    }catch(error){
      entry.error=String(error?.shortMessage??error?.message??error).slice(0,500);
      evidence.limitations.push({type:'VAULT_CONTEXT_NOT_VERIFIED',vault:vault.address,message:entry.error});
    }
  }
  evidence.status=!evidence.vaults.some(v=>v.verified)?'NO_VERIFIED_VAULT':!evidence.pools.length?'NO_REGISTERED_POOLS':evidence.pools.some(p=>p.initialized)?'INITIALIZED_POOL_AVAILABLE':'REGISTERED_POOLS_REQUIRE_INITIALIZATION';
  return evidence;
}
function ethersMaxUint256V1(){return(1n<<256n)-1n;}
function amountForTokenV1(token,valuePool){
  const row=(valuePool?.tokens??[]).find(t=>lower(t.address??t)===lower(token));
  const decimals=Number(row?.decimals??18),units=10n**BigInt(Number.isInteger(decimals)&&decimals>=0&&decimals<=24?decimals:18);
  const funded=BigInt(row?.fundedAmount??'0');
  if(funded<=0n)return null;
  return funded<units?funded:units;
}
function choosePoolV1(pools,initialized){
  return pools.find(p=>p.initialized===initialized&&Array.isArray(p.tokens)&&p.tokens.length>=2)??null;
}
export function buildBalancerV3ActionV1({ethers,target,selected,discovery,valuePool={},actors=[]}={}){
  const requirement=balancerV3ActionRequirementsV1(target,selected);
  if(requirement.kind==='GENERIC')return{kind:'GENERIC'};
  if(requirement.kind==='UNROUTABLE')return{kind:'BLOCKED',reason:requirement.reason};
  if(requirement.kind==='FACTORY_CREATE'){
    const built=buildBalancerV3CreatorArgumentsV1({ethers,candidate:{target,selected},attempt:0,actor:actors[0],valuePool});
    if(!built)return{kind:'BLOCKED',reason:'BALANCER_V3_FACTORY_NEEDS_FUNDED_SORTED_TOKENS_AND_KNOWN_ABI'};
    return{kind:'READY',sender:actors[0],args:built.args,value:0n,pool:null,protocol:'BALANCER_V3',basis:built.basis,createsPool:true};
  }
  const signature=String(selected.signature??'');
  const isInit=signature==='initialize(address,address[],uint256[],uint256,bool,bytes)';
  const isUnbalanced=signature==='addLiquidityUnbalanced(address,uint256[],uint256,bool,bytes)';
  const isProportional=signature==='addLiquidityProportional(address,uint256[],uint256,bool,bytes)';
  const isSwapIn=signature==='swapSingleTokenExactIn(address,address,address,uint256,uint256,uint256,bool,bytes)';
  const isSwapOut=signature==='swapSingleTokenExactOut(address,address,address,uint256,uint256,uint256,bool,bytes)';
  const isRemove=signature==='removeLiquidityProportional(address,uint256,uint256[],bool,bytes)';
  const isRemoveSingle=signature==='removeLiquiditySingleTokenExactIn(address,uint256,address,uint256,bool,bytes)';
  if(!isInit&&!isUnbalanced&&!isProportional&&!isSwapIn&&!isSwapOut&&!isRemove&&!isRemoveSingle){
    return{kind:'BLOCKED',reason:'BALANCER_V3_NEEDS_PROTOCOL_RECIPE_FOR_SIGNATURE',signature};
  }
  const pool=choosePoolV1(discovery?.pools??[],!isInit);
  if(!pool)return{kind:'BLOCKED',reason:isInit?'NO_REGISTERED_UNINITIALIZED_POOL':'NO_INITIALIZED_BALANCER_POOL'};
  const amounts=pool.tokens.map(token=>amountForTokenV1(token,valuePool));
  if(amounts.some(amount=>amount===null||amount===0n))return{kind:'BLOCKED',reason:'POOL_TOKEN_NOT_FUNDED',pool:pool.address};
  if(!actors.length)return{kind:'BLOCKED',reason:'NO_FUNDED_ACTORS'};
  const bpt=(pool.bptHolders??[]).find(row=>BigInt(row.amount??'0')>0n);
  if((isRemove||isRemoveSingle)&&!bpt)return{kind:'BLOCKED',reason:'NO_FUNDED_BALANCER_POOL_SHARE_HOLDER',pool:pool.address};
  // Router unlocks Vault and settles internal transient token deltas atomically.
  // Amounts follow the Vault's registered token order.
  const amountIn=amounts[0],amountOut=amounts[1];
  const args=isInit?[pool.address,pool.tokens,amounts,0n,false,'0x']
    :isUnbalanced?[pool.address,amounts,0n,false,'0x']
    :isProportional?[pool.address,amounts,1n,false,'0x']
    :isSwapIn?[pool.address,pool.tokens[0],pool.tokens[1],amountIn,1n,ethersMaxUint256V1(),false,'0x']
    :isSwapOut?[pool.address,pool.tokens[0],pool.tokens[1],amountOut,amountIn,ethersMaxUint256V1(),false,'0x']
    :isRemove?[pool.address,1n,pool.tokens.map(()=>0n),false,'0x']
    :[pool.address,1n,pool.tokens[0],1n,false,'0x'];
  return{kind:'READY',sender:(isRemove||isRemoveSingle)?bpt.actor:actors[0],args,value:0n,pool:pool.address,protocol:'BALANCER_V3',basis:'VERIFIED_VAULT_POOL_STATE_ROUTER_ARGUMENTS',poolInitialized:pool.initialized};
}
