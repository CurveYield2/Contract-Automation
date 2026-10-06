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
    if(typeof value==='string'&&/^0x[0-9a-fA-F]{8}/.test(value))return value;
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
    const error=row?.error??row?.stages?.RECEIPT?.error??row?.stages?.PREFLIGHT?.error??row?.stages?.PREFLIGHT?.callProbe?.error??null;
    const decoded=decodeTelemetryRevertReasonV1({ethers,error,selectorIndex});
    const key=JSON.stringify([decoded.kind,decoded.selector,decoded.reason]);
    const current=counts.get(key)??{...decoded,count:0};
    current.count++;
    counts.set(key,current);
  }
  return[...counts.values()].sort((a,b)=>b.count-a.count||String(a.reason).localeCompare(String(b.reason))).slice(0,limit);
}
