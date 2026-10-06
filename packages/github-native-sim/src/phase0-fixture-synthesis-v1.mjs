function abiRowsV1(abi){
  if(Array.isArray(abi))return abi;
  if(Array.isArray(abi?.abi))return abi.abi;
  if(abi&&typeof abi==='object')return Object.values(abi).filter(x=>x&&typeof x==='object'&&typeof x.type==='string');
  return[];
}

function revertDataV1(error){
  for(const value of [
    error?.data,
    error?.error?.data,
    error?.info?.error?.data,
    error?.stages?.RECEIPT?.error?.data,
    error?.stages?.PREFLIGHT?.error?.data,
    error?.stages?.PREFLIGHT?.callProbe?.error?.data
  ]){
    const candidate=typeof value==='string'?value:(typeof value?.data==='string'?value.data:null);
    if(candidate&&/^0x[0-9a-fA-F]{8}/.test(candidate))return candidate;
  }
  return null;
}

export function buildCompiledArtifactErrorSelectorIndexV1({ethers,artifacts=[]}){
  const bySelector=new Map();
  for(const artifact of artifacts){
    let iface;
    try{iface=new ethers.Interface(abiRowsV1(artifact?.abi));}catch{continue;}
    for(const fragment of iface.fragments.filter(x=>x?.type==='error')){
      let signature;
      try{signature=fragment.format('sighash');}catch{continue;}
      const selector=ethers.id(signature).slice(0,10).toLowerCase();
      const rows=bySelector.get(selector)??[];
      if(!rows.some(x=>x.signature===signature)){
        rows.push({
          name:fragment.name,
          signature,
          qualifiedName:artifact?.sourceName&&artifact?.contractName?artifact.sourceName+':'+artifact.contractName:(artifact?.contractName??null)
        });
        bySelector.set(selector,rows);
      }
    }
  }
  return bySelector;
}

export function decodeTelemetryRevertReasonV1({ethers,error,selectorIndex}){
  const data=revertDataV1(error);
  const selector=typeof data==='string'?data.slice(0,10).toLowerCase():null;
  if(selector&&selectorIndex?.has(selector)){
    const matches=selectorIndex.get(selector);
    return{kind:'CUSTOM_ERROR',selector,reason:matches.map(x=>x.signature).join(' | ')};
  }
  if(selector==='0x08c379a0'){
    try{
      const [reason]=ethers.AbiCoder.defaultAbiCoder().decode(['string'],'0x'+data.slice(10));
      return{kind:'STRING_REVERT',selector,reason:String(reason)};
    }catch{}
  }
  if(selector==='0x4e487b71'){
    try{
      const [code]=ethers.AbiCoder.defaultAbiCoder().decode(['uint256'],'0x'+data.slice(10));
      return{kind:'PANIC',selector,reason:`Panic(0x${BigInt(code).toString(16)})`};
    }catch{}
  }
  if(error?.decodedCustomError?.signature){
    return{kind:'CUSTOM_ERROR',selector,reason:String(error.decodedCustomError.signature)};
  }
  if(typeof error?.reason==='string'&&error.reason.trim()){
    return{kind:'STRING_REVERT',selector,reason:error.reason};
  }
  const short=String(error?.shortMessage??'');
  const quoted=short.match(/execution reverted:\s*["']([^"']+)["']/i);
  if(quoted)return{kind:'STRING_REVERT',selector,reason:quoted[1]};
  return{kind:'UNKNOWN_REVERT',selector,reason:selector??'UNKNOWN_REVERT'};
}

export function topDecodedTelemetryRevertsV1({ethers,artifacts=[],rows=[],limit=15}){
  const selectorIndex=buildCompiledArtifactErrorSelectorIndexV1({ethers,artifacts});
  const counts=new Map();
  for(const row of rows){
    if(!['SIMULATED_REJECTION','MINED_REVERT'].includes(row?.executionOutcome))continue;
    const candidates=[
      row?.error,
      row?.stages?.RECEIPT?.error,
      row?.stages?.PREFLIGHT?.error,
      row?.stages?.PREFLIGHT?.callProbe?.error
    ].filter(Boolean);
    let decoded=decodeTelemetryRevertReasonV1({ethers,error:candidates[0]??null,selectorIndex});
    for(const candidate of candidates.slice(1)){
      if(decoded.kind!=='UNKNOWN_REVERT')break;
      decoded=decodeTelemetryRevertReasonV1({ethers,error:candidate,selectorIndex});
    }
    const key=JSON.stringify([decoded.kind,decoded.selector,decoded.reason]);
    const current=counts.get(key)??{...decoded,count:0};
    current.count++;
    counts.set(key,current);
  }
  return[...counts.values()].sort((a,b)=>b.count-a.count||String(a.reason).localeCompare(String(b.reason))).slice(0,limit);
}


export const PHASE0_CANONICAL_MAINNET_TOKENS_V1=Object.freeze([
  {symbol:'WETH',address:'0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'},
  {symbol:'USDC',address:'0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'},
  {symbol:'USDT',address:'0xdac17f958d2ee523a2206206994597c13d831ec7'},
  {symbol:'DAI',address:'0x6b175474e89094c44da98b954eedeac495271d0f'},
  {symbol:'WBTC',address:'0x2260fac5e5542a773aa44fbcfedf7c193bc2c599'},
  {symbol:'wstETH',address:'0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0'}
]);
export const PHASE0_PERMIT2_ADDRESS_V1='0x000000000022d473030f116ddee9f6b43ac78ba3';
export const PHASE0_MEDUSA_SENDERS_V1=Object.freeze([
  '0x0000000000000000000000000000000000010000',
  '0x0000000000000000000000000000000000020000',
  '0x0000000000000000000000000000000000030000',
  '0x0000000000000000000000000000000000040000'
]);

const ERC20_VIEW_ABI_V1=[
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)'
];
const ERC20_APPROVE_ABI_V1=[
  'function approve(address,uint256) returns (bool)',
  'function allowance(address,address) view returns (uint256)'
];
const PERMIT2_APPROVE_ABI_V1=[
  'function approve(address token,address spender,uint160 amount,uint48 expiration)'
];
const PRIVILEGED_VIEW_TERMS_V1=['owner','admin','governance','authority','authorizer','pendingowner','guardian','manager'];

function normalizedAddressV1(ethers,value){
  try{return ethers.getAddress(String(value));}catch{return null;}
}
function outputContainsAddressV1(param){
  if(!param)return false;
  if(param.baseType==='array')return outputContainsAddressV1(param.arrayChildren);
  if(param.baseType==='tuple')return (param.components??[]).some(outputContainsAddressV1);
  return String(param.type??'')==='address';
}
function collectAddressesV1(ethers,value,out=new Set()){
  if(typeof value==='string'){
    const address=normalizedAddressV1(ethers,value);
    if(address)out.add(address);
    return out;
  }
  if(Array.isArray(value)){
    for(const child of value)collectAddressesV1(ethers,child,out);
    return out;
  }
  if(value&&typeof value==='object'){
    for(const child of Object.values(value))collectAddressesV1(ethers,child,out);
  }
  return out;
}
function isPrivilegedViewNameV1(name){
  const n=String(name??'').toLowerCase().replace(/[^a-z0-9]/g,'');
  return PRIVILEGED_VIEW_TERMS_V1.some(term=>n===term||n.startsWith(term)||n.endsWith(term));
}
async function callNoArgV1(contract,fragment){
  return contract.getFunction(fragment.format('sighash')).staticCall();
}
async function probeErc20ShapeV1({provider,ethers,address,probeHolder}){
  const c=new ethers.Contract(address,ERC20_VIEW_ABI_V1,provider);
  const [decimals,totalSupply,balance]=await Promise.all([
    c.getFunction('decimals()').staticCall(),
    c.getFunction('totalSupply()').staticCall(),
    c.getFunction('balanceOf(address)').staticCall(probeHolder)
  ]);
  const d=Number(decimals);
  if(!Number.isInteger(d)||d<0||d>255)throw new Error('ERC20 decimals() returned an invalid value');
  return{decimals:d,totalSupply:BigInt(totalSupply).toString(),probeBalance:BigInt(balance).toString()};
}

export async function discoverValuePoolV1({provider,ethers,targets=[],actors=[]}){
  const addressSet=new Set(),tokens=[],tokenByAddress=new Map(),associations={},privileged=new Set(),receipts=[],gaps=[];
  for(const actor of actors){
    const address=normalizedAddressV1(ethers,actor);
    if(address)addressSet.add(address);
  }
  const deployer=normalizedAddressV1(ethers,actors[0]);
  if(deployer)privileged.add(deployer);
  for(const target of targets){
    const targetAddress=normalizedAddressV1(ethers,target?.address);
    if(!targetAddress)continue;
    addressSet.add(targetAddress);
    const related=associations[targetAddress]??new Set();
    associations[targetAddress]=related;
    let iface,contract;
    try{
      iface=new ethers.Interface(abiRowsV1(target?.artifact?.abi));
      contract=new ethers.Contract(targetAddress,abiRowsV1(target?.artifact?.abi),provider);
    }catch(error){
      gaps.push({type:'ASSOCIATION_ABI_UNAVAILABLE',target:targetAddress,message:String(error?.message??error).slice(0,800)});
      continue;
    }
    for(const fragment of iface.fragments.filter(x=>x?.type==='function'&&['view','pure'].includes(x.stateMutability)&&x.inputs.length===0&&(x.outputs??[]).some(outputContainsAddressV1))){
      try{
        const value=await callNoArgV1(contract,fragment);
        const found=collectAddressesV1(ethers,value);
        for(const address of found){related.add(address);addressSet.add(address);}
        if(isPrivilegedViewNameV1(fragment.name))for(const address of found)privileged.add(address);
        receipts.push({kind:'ASSOCIATION_VIEW',target:targetAddress,function:fragment.format('sighash'),addresses:[...found],status:'PASS'});
      }catch(error){
        gaps.push({type:'ASSOCIATION_VIEW_REVERTED',target:targetAddress,function:fragment.format('sighash'),message:String(error?.shortMessage??error?.message??error).slice(0,800)});
      }
    }
  }
  for(const row of PHASE0_CANONICAL_MAINNET_TOKENS_V1){
    const address=ethers.getAddress(row.address);
    let code='0x';
    try{code=await provider.getCode(address);}catch(error){
      gaps.push({type:'CANONICAL_TOKEN_CODE_READ_FAILED',symbol:row.symbol,address,message:String(error?.message??error).slice(0,800)});
      continue;
    }
    receipts.push({kind:'CANONICAL_TOKEN_CODE_PROBE',symbol:row.symbol,address,codePresent:Boolean(code&&code!=='0x'),status:'PASS'});
    if(!code||code==='0x')continue;
    let shape=null;
    try{shape=await probeErc20ShapeV1({provider,ethers,address,probeHolder:deployer??ethers.ZeroAddress});receipts.push({kind:'CANONICAL_TOKEN_ERC20_PROBE',symbol:row.symbol,address,decimals:shape.decimals,totalSupply:shape.totalSupply,status:'PASS'});}
    catch(error){gaps.push({type:'CANONICAL_TOKEN_METADATA_READ_FAILED',symbol:row.symbol,address,message:String(error?.shortMessage??error?.message??error).slice(0,800)});}
    const token={symbol:row.symbol,address,source:'CANONICAL_MAINNET',decimals:shape?.decimals??null,totalSupply:shape?.totalSupply??null};
    tokens.push(token);tokenByAddress.set(address.toLowerCase(),token);addressSet.add(address);
  }
  for(const target of targets){
    const address=normalizedAddressV1(ethers,target?.address);
    if(!address||tokenByAddress.has(address.toLowerCase()))continue;
    try{
      const shape=await probeErc20ShapeV1({provider,ethers,address,probeHolder:deployer??ethers.ZeroAddress});
      const token={symbol:null,address,source:'DISCOVERED_ERC20_SHAPE',qualifiedName:target?.qualifiedName??null,decimals:shape.decimals,totalSupply:shape.totalSupply};
      tokens.push(token);tokenByAddress.set(address.toLowerCase(),token);addressSet.add(address);
      receipts.push({kind:'TARGET_ERC20_SHAPE_PROBE',address,qualifiedName:target?.qualifiedName??null,decimals:shape.decimals,totalSupply:shape.totalSupply,status:'PASS'});
    }catch{}
  }
  for(const address of privileged)addressSet.add(address);
  return{
    addresses:[...addressSet],
    tokens,
    associations,
    privileged:[...privileged],
    created:[],
    receipts,
    gaps
  };
}

function storageKeyV1(ethers,holder,slot,layout){
  const holderWord=ethers.zeroPadValue(holder,32);
  const slotWord=ethers.toBeHex(BigInt(slot),32);
  return ethers.keccak256(layout==='VYPER'?ethers.concat([slotWord,holderWord]):ethers.concat([holderWord,slotWord]));
}
async function storageAtV1(provider,address,key){
  return provider.send('eth_getStorageAt',[address,key,'latest']);
}
async function setStorageAtV1(provider,address,key,value){
  return provider.send('anvil_setStorageAt',[address,key,ethersWordV1(value)]);
}
function ethersWordV1(value){
  const v=BigInt(value);
  if(v<0n||v>((1n<<256n)-1n))throw new Error('storage value outside uint256');
  return '0x'+v.toString(16).padStart(64,'0');
}
async function balanceOfV1({provider,ethers,token,holder}){
  const c=new ethers.Contract(token,ERC20_VIEW_ABI_V1,provider);
  return BigInt(await c.getFunction('balanceOf(address)').staticCall(holder));
}
async function findBalanceSlotV1({provider,ethers,token,holder}){
  const before=await balanceOfV1({provider,ethers,token,holder});
  const probe=before===0x13579bdf2468acen?0x2468ace13579bdfn:0x13579bdf2468acen;
  for(let slot=0;slot<=50;slot++){
    for(const layout of ['SOLIDITY','VYPER']){
      const key=storageKeyV1(ethers,holder,slot,layout);
      let original;
      try{
        original=await storageAtV1(provider,token,key);
        await provider.send('anvil_setStorageAt',[token,key,ethersWordV1(probe)]);
        const observed=await balanceOfV1({provider,ethers,token,holder});
        await provider.send('anvil_setStorageAt',[token,key,original]);
        if(observed===probe)return{status:'FOUND',slot,layout,key};
      }catch(error){
        if(original!==undefined)await provider.send('anvil_setStorageAt',[token,key,original]).catch(()=>{});
      }
    }
  }
  return{status:'NOT_FOUND'};
}
function uniqueAddressesV1(ethers,values=[]){
  const out=[],seen=new Set();
  for(const value of values){
    const address=normalizedAddressV1(ethers,value);
    if(!address)continue;
    const key=address.toLowerCase();if(seen.has(key))continue;seen.add(key);out.push(address);
  }
  return out;
}
function receiptRowV1(kind,receipt,extra={}){
  return{kind,...extra,transactionHash:receipt?.hash??null,blockNumber:receipt?.blockNumber??null,status:Number(receipt?.status??0),gasUsed:receipt?.gasUsed?.toString?.()??null};
}
async function sendEncodedV1({provider,ethers,from,to,iface,signature,args,gasLimit=300000n}){
  const signer=await provider.getSigner(from);
  const tx=await signer.sendTransaction({to,data:iface.encodeFunctionData(signature,args),gasLimit});
  const receipt=await tx.wait();
  if(Number(receipt?.status)!==1)throw new Error('transaction receipt status is not successful');
  return receipt;
}
async function mapLimitV1(items,limit,worker){
  const out=new Array(items.length);let next=0;
  async function lane(){
    while(true){
      const i=next++;if(i>=items.length)return;
      out[i]=await worker(items[i],i);
    }
  }
  await Promise.all(Array.from({length:Math.min(limit,items.length)},lane));
  return out;
}

export async function fundActorsV1({provider,ethers,tokens=[],holders=[],spenders=[]}){
  const holderAddresses=uniqueAddressesV1(ethers,holders),spenderAddresses=uniqueAddressesV1(ethers,spenders);
  const gaps=[],rpcMutations=[],transactionReceipts=[],slotResults=[];
  const ethBalance=10n**24n,erc20Iface=new ethers.Interface(ERC20_APPROVE_ABI_V1),permit2Iface=new ethers.Interface(PERMIT2_APPROVE_ABI_V1);
  for(const holder of holderAddresses){
    try{
      await provider.send('anvil_setBalance',[holder,ethers.toQuantity(ethBalance)]);
      rpcMutations.push({kind:'ETH_BALANCE_SET',holder,amountWei:ethBalance.toString(),status:'PASS'});
    }catch(error){gaps.push({type:'ETH_BALANCE_FUNDING_FAILED',holder,message:String(error?.message??error).slice(0,800)});}
  }
  for(const tokenRecord of tokens){
    const token=normalizedAddressV1(ethers,tokenRecord?.address??tokenRecord);
    if(!token)continue;
    let decimals=Number(tokenRecord?.decimals);
    if(!Number.isInteger(decimals)||decimals<0||decimals>70){
      try{decimals=(await probeErc20ShapeV1({provider,ethers,address:token,probeHolder:holderAddresses[0]??ethers.ZeroAddress})).decimals;}
      catch(error){
        const gap={type:'TOKEN_METADATA_UNAVAILABLE',token,message:String(error?.shortMessage??error?.message??error).slice(0,800)};
        gaps.push(gap);slotResults.push({token,status:'TOKEN_BALANCE_SLOT_NOT_FOUND',reason:gap.type});continue;
      }
    }
    const amount=1000000n*(10n**BigInt(decimals));
    const probeHolder=holderAddresses[0]??ethers.ZeroAddress;
    const slot=await findBalanceSlotV1({provider,ethers,token,holder:probeHolder});
    if(slot.status!=='FOUND'){
      const gap={type:'TOKEN_BALANCE_SLOT_NOT_FOUND',token,attemptedSlots:'0-50',layouts:['SOLIDITY','VYPER']};
      gaps.push(gap);slotResults.push({token,status:'TOKEN_BALANCE_SLOT_NOT_FOUND',decimals});continue;
    }
    let writes=0,verified=0;
    for(const holder of holderAddresses){
      const key=storageKeyV1(ethers,holder,slot.slot,slot.layout);
      try{
        await provider.send('anvil_setStorageAt',[token,key,ethersWordV1(amount)]);writes++;
        const observed=await balanceOfV1({provider,ethers,token,holder});
        if(observed!==amount)throw new Error(`balanceOf verification mismatch: expected ${amount} observed ${observed}`);
        verified++;
        rpcMutations.push({kind:'TOKEN_BALANCE_SET',token,holder,slot:slot.slot,layout:slot.layout,storageKey:key,amount:amount.toString(),status:'PASS'});
      }catch(error){gaps.push({type:'TOKEN_BALANCE_WRITE_VERIFICATION_FAILED',token,holder,slot:slot.slot,layout:slot.layout,message:String(error?.message??error).slice(0,800)});}
    }
    tokenRecord.decimals=decimals;tokenRecord.fundedAmount=amount.toString();tokenRecord.balanceSlot=slot.slot;tokenRecord.balanceLayout=slot.layout;
    slotResults.push({token,status:'FOUND',slot:slot.slot,layout:slot.layout,decimals,fundedAmount:amount.toString(),holdersWritten:writes,holdersVerified:verified});
  }

  await mapLimitV1(holderAddresses,6,async holder=>{
    for(const tokenRecord of tokens){
      const token=normalizedAddressV1(ethers,tokenRecord?.address??tokenRecord);if(!token)continue;
      for(const spender of spenderAddresses){
        try{
          const receipt=await sendEncodedV1({provider,ethers,from:holder,to:token,iface:erc20Iface,signature:'approve(address,uint256)',args:[spender,ethers.MaxUint256]});
          transactionReceipts.push(receiptRowV1('ERC20_APPROVAL',receipt,{token,holder,spender,amount:ethers.MaxUint256.toString()}));
        }catch(error){gaps.push({type:'ERC20_APPROVAL_FAILED',token,holder,spender,message:String(error?.shortMessage??error?.message??error).slice(0,1000)});}
      }
    }
  });

  let permit2={address:ethers.getAddress(PHASE0_PERMIT2_ADDRESS_V1),codePresent:false,status:'SKIPPED_NO_CODE'};
  try{
    const code=await provider.getCode(permit2.address);
    permit2.codePresent=Boolean(code&&code!=='0x');
    if(permit2.codePresent){
      permit2.status='PASS';
      await mapLimitV1(holderAddresses,6,async holder=>{
        for(const tokenRecord of tokens){
          const token=normalizedAddressV1(ethers,tokenRecord?.address??tokenRecord);if(!token)continue;
          try{
            const receipt=await sendEncodedV1({provider,ethers,from:holder,to:token,iface:erc20Iface,signature:'approve(address,uint256)',args:[permit2.address,ethers.MaxUint256]});
            transactionReceipts.push(receiptRowV1('ERC20_APPROVAL_TO_PERMIT2',receipt,{token,holder,spender:permit2.address,amount:ethers.MaxUint256.toString()}));
          }catch(error){
            gaps.push({type:'PERMIT2_TOKEN_APPROVAL_FAILED',token,holder,spender:permit2.address,message:String(error?.shortMessage??error?.message??error).slice(0,1000)});continue;
          }
          for(const spender of spenderAddresses){
            try{
              const receipt=await sendEncodedV1({provider,ethers,from:holder,to:permit2.address,iface:permit2Iface,signature:'approve(address,address,uint160,uint48)',args:[token,spender,(1n<<160n)-1n,(1n<<48n)-1n]});
              transactionReceipts.push(receiptRowV1('PERMIT2_ALLOWANCE',receipt,{token,holder,spender,amount:((1n<<160n)-1n).toString(),expiration:((1n<<48n)-1n).toString()}));
            }catch(error){gaps.push({type:'PERMIT2_ALLOWANCE_FAILED',token,holder,spender,message:String(error?.shortMessage??error?.message??error).slice(0,1000)});}
          }
        }
      });
    }
  }catch(error){permit2={...permit2,status:'CODE_READ_FAILED'};gaps.push({type:'PERMIT2_CODE_READ_FAILED',address:permit2.address,message:String(error?.message??error).slice(0,800)});}

  // Approval transactions consume native gas; restore the specified fixture ETH balance as the final actor state.
  for(const holder of holderAddresses){
    try{
      await provider.send('anvil_setBalance',[holder,ethers.toQuantity(ethBalance)]);
      rpcMutations.push({kind:'ETH_BALANCE_RESET_AFTER_APPROVALS',holder,amountWei:ethBalance.toString(),status:'PASS'});
    }catch(error){gaps.push({type:'ETH_BALANCE_FINAL_RESET_FAILED',holder,message:String(error?.message??error).slice(0,800)});}
  }
  transactionReceipts.sort((a,b)=>(a.blockNumber??0)-(b.blockNumber??0)||String(a.transactionHash).localeCompare(String(b.transactionHash)));
  const receiptCounts={
    ethBalanceWrites:rpcMutations.filter(x=>x.kind==='ETH_BALANCE_SET'||x.kind==='ETH_BALANCE_RESET_AFTER_APPROVALS').length,
    tokenBalanceWrites:rpcMutations.filter(x=>x.kind==='TOKEN_BALANCE_SET').length,
    erc20Approvals:transactionReceipts.filter(x=>x.kind==='ERC20_APPROVAL').length,
    permit2TokenApprovals:transactionReceipts.filter(x=>x.kind==='ERC20_APPROVAL_TO_PERMIT2').length,
    permit2Allowances:transactionReceipts.filter(x=>x.kind==='PERMIT2_ALLOWANCE').length,
    transactionReceipts:transactionReceipts.length,
    gaps:gaps.length
  };
  return{holders:holderAddresses,spenders:spenderAddresses,slotResults,rpcMutations,transactionReceipts,receiptCounts,permit2,gaps};
}

function associationValuesV1(valuePool,address){
  const needle=String(address).toLowerCase(),out=[];
  for(const [key,value] of Object.entries(valuePool?.associations??{})){
    const rows=value instanceof Set?[...value]:Array.isArray(value)?value:[];
    if(key.toLowerCase()===needle)out.push(...rows);
    if(rows.some(x=>String(x).toLowerCase()===needle))out.push(key);
  }
  return uniqueStringsV1(out);
}
function bucketFillV1(out,values,weight){
  if(!values.length)return;
  for(let i=0;i<weight;i++)out.push(values[i%values.length]);
}
export function weightedFixtureAddressSeedV1({valuePool={},actors=[],targets=[],chosenAddresses=[]}={}){
  const created=uniqueStringsV1(valuePool.created??[]);
  const tokens=uniqueStringsV1((valuePool.tokens??[]).map(x=>x?.address??x));
  const associated=uniqueStringsV1(chosenAddresses.flatMap(address=>associationValuesV1(valuePool,address)));
  const targetRows=uniqueStringsV1(targets);
  const actorPrivileged=uniqueStringsV1([...(actors??[]),...(valuePool.privileged??[])]);
  const out=[];
  bucketFillV1(out,created,35);
  bucketFillV1(out,tokens,25);
  bucketFillV1(out,associated,15);
  bucketFillV1(out,targetRows,15);
  bucketFillV1(out,actorPrivileged,10);
  return out.length?out:uniqueStringsV1([...(valuePool.addresses??[]),...targetRows,...actorPrivileged]);
}
function uniqueStringsV1(values=[]){
  const out=[],seen=new Set();
  for(const value of values){
    if(typeof value!=='string'||!/^0x[0-9a-fA-F]{40}$/.test(value))continue;
    const key=value.toLowerCase();if(seen.has(key))continue;seen.add(key);out.push(value);
  }
  return out;
}
export function chooseFixtureAddressV1({rng=Math.random,valuePool={},actors=[],targets=[],chosenAddresses=[]}={}){
  const weighted=weightedFixtureAddressSeedV1({valuePool,actors,targets,chosenAddresses});
  if(!weighted.length)return null;
  return weighted[Math.min(weighted.length-1,Math.floor(rng()*weighted.length))];
}
export function chooseFixtureAmountV1({rng=Math.random,param,valuePool={},chosenAddresses=[]}={}){
  const m=String(param?.type??'').match(/^uint(\d+)?$/);
  if(!m)return null;
  const bits=Number(m[1]??256);if(bits<64)return null;
  const tokens=(valuePool.tokens??[]).filter(x=>Number.isInteger(Number(x?.decimals))&&x?.fundedAmount!=null&&BigInt(x.fundedAmount)>0n);
  if(!tokens.length)return null;
  const chosenToken=tokens.find(token=>chosenAddresses.some(address=>String(address).toLowerCase()===String(token.address).toLowerCase()))??tokens[Math.min(tokens.length-1,Math.floor(rng()*tokens.length))];
  const decimals=Number(chosenToken.decimals),funded=BigInt(chosenToken.fundedAmount),max=(1n<<BigInt(bits))-1n;
  const cap=v=>v>funded?funded:(v>max?max:v);
  const candidates=[1n,10n**BigInt(decimals),10n**BigInt(decimals+3)].map(cap).filter(x=>x>=0n);
  const unique=[...new Set(candidates.map(String))].map(BigInt);
  return unique[Math.min(unique.length-1,Math.floor(rng()*unique.length))].toString();
}
export function recordChosenAddressesV1(value,chosenAddresses=[]){
  if(typeof value==='string'&&/^0x[0-9a-fA-F]{40}$/.test(value)){chosenAddresses.push(value);return chosenAddresses;}
  if(Array.isArray(value))for(const child of value)recordChosenAddressesV1(child,chosenAddresses);
  return chosenAddresses;
}
export function serializeValuePoolV1(valuePool={}){
  const associations={};
  for(const [address,values] of Object.entries(valuePool.associations??{}))associations[address]=[...(values instanceof Set?values:values??[])];
  return{
    addresses:[...(valuePool.addresses??[])],
    tokens:(valuePool.tokens??[]).map(x=>({...x})),
    associations,
    privileged:[...(valuePool.privileged??[])],
    created:[...(valuePool.created??[])],
    receipts:[...(valuePool.receipts??[])],
    gaps:[...(valuePool.gaps??[])]
  };
}
