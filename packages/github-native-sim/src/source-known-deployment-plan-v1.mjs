import fs from 'node:fs/promises';
import path from 'node:path';

function normalizedAbi(abi){
  if(Array.isArray(abi))return abi;
  if(Array.isArray(abi?.abi))return abi.abi;
  if(abi&&typeof abi==='object'){
    const values=Object.values(abi);
    if(values.length&&values.every(x=>x&&typeof x==='object'&&typeof x.type==='string'))return values;
  }
  return[];
}
function artifactAccessor(artifacts=[]){
  const byName=new Map();
  for(const artifact of artifacts){
    if(!artifact?.contractName)continue;
    const rows=byName.get(artifact.contractName)??[];
    rows.push(artifact);byName.set(artifact.contractName,rows);
  }
  return{
    get(name){
      const rows=byName.get(name)??[];
      if(rows.length!==1)throw new Error('artifact name is missing or ambiguous: '+name);
      return rows[0];
    }
  };
}
function normalize(v){
  if(typeof v==='bigint')return v.toString();
  if(Array.isArray(v))return v.map(normalize);
  if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,normalize(x)]));
  return v;
}
function readQuoted(text,start){
  const quote=text[start];if(quote!=='"'&&quote!=="'")return null;
  let out='';
  for(let i=start+1;i<text.length;i++){
    const ch=text[i];
    if(ch==='\\'&&i+1<text.length){out+=text[i+1];i++;continue;}
    if(ch===quote)return{value:out,end:i+1};
    out+=ch;
  }
  return null;
}
function balanced(text,start,open,close){
  if(text[start]!==open)return null;
  let depth=0,quote=null,escaped=false;
  for(let i=start;i<text.length;i++){
    const ch=text[i];
    if(quote){
      if(escaped){escaped=false;continue;}
      if(ch==='\\'){escaped=true;continue;}
      if(ch===quote)quote=null;
      continue;
    }
    if(ch==='"'||ch==="'"){quote=ch;continue;}
    if(ch===open)depth++;
    else if(ch===close){depth--;if(depth===0)return{body:text.slice(start+1,i),end:i+1};}
  }
  return null;
}
function splitTopLevelCsv(text){
  const out=[];let start=0,round=0,square=0,curly=0,quote=null,escaped=false;
  for(let i=0;i<text.length;i++){
    const ch=text[i];
    if(quote){
      if(escaped){escaped=false;continue;}
      if(ch==='\\'){escaped=true;continue;}
      if(ch===quote)quote=null;
      continue;
    }
    if(ch==='"'||ch==="'"){quote=ch;continue;}
    if(ch==='(')round++;else if(ch===')')round--;
    else if(ch==='[')square++;else if(ch===']')square--;
    else if(ch==='{')curly++;else if(ch==='}')curly--;
    else if(ch===','&&round===0&&square===0&&curly===0){const part=text.slice(start,i).trim();if(part)out.push(part);start=i+1;}
  }
  const tail=text.slice(start).trim();if(tail)out.push(tail);return out;
}
export function extractSourceKnownDeployPlanV1(text){
  const rows=[];
  for(const match of String(text).matchAll(/\bawait\s+deploy\s*\(/g)){
    const index=match.index??0,prefix=String(text).slice(Math.max(0,index-160),index);
    const binding=prefix.match(/(?:const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*$/)?.[1]??null;
    let i=index+match[0].length;
    while(/\s/.test(text[i]??''))i++;
    const name=readQuoted(text,i);if(!name)continue;i=name.end;
    while(/\s/.test(text[i]??''))i++;
    if(text[i]!==',')continue;i++;
    while(/\s/.test(text[i]??''))i++;
    const args=balanced(text,i,'[',']');if(!args)continue;i=args.end;
    while(/\s/.test(text[i]??''))i++;
    let optionsText='';
    if(text[i]===','){
      i++;while(/\s/.test(text[i]??''))i++;
      if(text[i]==='{'){const options=balanced(text,i,'{','}');if(options)optionsText=options.body;}
    }
    rows.push({index,binding,contractName:name.value,argExpressions:splitTopLevelCsv(args.body),library:/\blibrary\s*:\s*true\b/.test(optionsText)});
  }
  return rows.sort((a,b)=>a.index-b.index);
}
function safeNumericExpression(expr){
  const text=String(expr).trim().replaceAll('_','');
  if(!text||/[A-MO-Za-mo-z_$.[\]{}'",?:]/.test(text))return null;
  if(!/^(?:\s|\d+n?|[()+\-*/%])+$/.test(text))return null;
  try{
    const value=Function('"use strict";return ('+text+');')();
    if(typeof value==='bigint')return value;
    if(typeof value==='number'&&Number.isFinite(value)&&Number.isInteger(value))return BigInt(value);
  }catch{}
  return null;
}
export function extractSourceKnownBindingsV1(text){
  const bindings=new Map(),source=String(text);
  for(const match of source.matchAll(/\bconst\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*envAddress\s*\(\s*["'][^"']+["']\s*,\s*["'](0x[a-fA-F0-9]{40})["']\s*\)/g))bindings.set(match[1],match[2]);
  for(const match of source.matchAll(/\bconst\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(?:Number\s*\(\s*)?envBigInt\s*\(/g)){
    const open=(match.index??0)+match[0].lastIndexOf('(');
    const call=balanced(source,open,'(',')');
    if(!call)continue;
    const args=splitTopLevelCsv(call.body);
    if(args.length<2)continue;
    const value=safeNumericExpression(args.slice(1).join(','));
    if(value!==null)bindings.set(match[1],value);
  }
  for(const match of source.matchAll(/\bconst\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*([0-9_n+\-*/%()\s]+)\s*;/g)){
    if(bindings.has(match[1]))continue;const value=safeNumericExpression(match[2]);if(value!==null)bindings.set(match[1],value);
  }
  return bindings;
}
function resolveExpression(expr,bindings,accountAddress){
  const text=String(expr).trim();
  if(text==='account.address')return{ok:true,value:accountAddress};
  if(/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(text)&&bindings.has(text))return{ok:true,value:bindings.get(text)};
  if((text.startsWith('"')&&text.endsWith('"'))||(text.startsWith("'")&&text.endsWith("'")))return{ok:true,value:text.slice(1,-1).replace(/\\(["'\\])/g,'$1')};
  const numeric=safeNumericExpression(text);if(numeric!==null)return{ok:true,value:numeric};
  if(text==='true'||text==='false')return{ok:true,value:text==='true'};
  if(text.startsWith('[')&&text.endsWith(']')){
    const values=[];
    for(const part of splitTopLevelCsv(text.slice(1,-1))){const resolved=resolveExpression(part,bindings,accountAddress);if(!resolved.ok)return resolved;values.push(resolved.value);}
    return{ok:true,value:values};
  }
  return{ok:false,expression:text};
}
function sourcePlanPaths(detected){
  const out=new Set();
  for(const item of [...(detected.hardhat??[]),...(detected.unsafeHardhat??[])])if(item.path)out.add(item.path);
  for(const item of detected.genericPackageScripts??[]){
    const match=String(item.command??'').match(/(?:^|\s)([A-Za-z0-9_./-]+\.(?:mjs|cjs|js|ts))(?:\s|$)/i);
    if(match)out.add(match[1]);
  }
  return[...out];
}
function linkedBytecode(artifact,libraries){
  let linked=String(artifact?.bytecode??'0x').replace(/^0x/,'');
  for(const libs of Object.values(artifact?.linkReferences??{})){
    for(const [libraryName,refs] of Object.entries(libs??{})){
      const address=libraries.get(libraryName);
      if(!address)throw new Error('missing linked library '+libraryName+' for '+artifact.contractName);
      const replacement=String(address).replace(/^0x/,'').toLowerCase();
      for(const ref of refs??[]){
        const start=Number(ref.start)*2,length=Number(ref.length)*2;
        linked=linked.slice(0,start)+replacement.padStart(length,'0')+linked.slice(start+length);
      }
    }
  }
  if(linked.includes('__$'))throw new Error('unlinked library placeholder remains for '+artifact.contractName);
  return'0x'+linked;
}
export async function deploySourceKnownPlanV1({projectRoot,provider,ethers,artifacts,detected}){
  const candidates=[];
  for(const rel of sourcePlanPaths(detected)){
    const abs=path.join(projectRoot,...rel.split('/'));let text='';
    try{text=await fs.readFile(abs,'utf8');}catch{continue;}
    const steps=extractSourceKnownDeployPlanV1(text);
    if(steps.length)candidates.push({rel,text,steps,score:steps.length*100+(/deploy/i.test(rel)?10:0)});
  }
  candidates.sort((a,b)=>b.score-a.score||a.rel.localeCompare(b.rel));
  if(!candidates.length)return{status:'NO_SOURCE_KNOWN_DEPLOYMENT_PLAN',planPath:null,planned:0,rows:[],attempts:[],limitations:[],unresolvedSteps:0};

  const chosen=candidates[0],accessor=artifactAccessor(artifacts),signer=await provider.getSigner(0),accountAddress=await signer.getAddress(),startNonce=await provider.getTransactionCount(accountAddress);
  const predictedByContract=new Map(chosen.steps.map((step,index)=>[step.contractName,ethers.getCreateAddress({from:accountAddress,nonce:startNonce+index})]));
  const bindings=extractSourceKnownBindingsV1(chosen.text);
  for(const match of chosen.text.matchAll(/\bconst\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*report\.predictedDeployments\.find\([\s\S]{0,240}?entry\.name\s*===\s*["']([^"']+)["'][\s\S]{0,240}?\)\.expectedAddress\s*;/g)){
    const predicted=predictedByContract.get(match[2]);if(predicted)bindings.set(match[1],predicted);
  }

  const rows=[],attempts=[],limitations=[],libraries=new Map();
  for(const [ordinal,step] of chosen.steps.entries()){
    let artifact;
    try{artifact=accessor.get(step.contractName);}catch(error){limitations.push({type:'SOURCE_PLAN_ARTIFACT_RESOLUTION_FAILED',contractName:step.contractName,message:String(error?.message??error)});continue;}
    const args=[];let unresolved=null;
    for(const expression of step.argExpressions){
      const resolved=resolveExpression(expression,bindings,accountAddress);
      if(!resolved.ok){unresolved=resolved.expression;break;}
      args.push(resolved.value);
    }
    if(unresolved!==null){limitations.push({type:'SOURCE_PLAN_CONSTRUCTOR_ARGUMENT_UNRESOLVED',contractName:step.contractName,expression:unresolved,planPath:chosen.rel});continue;}
    try{
      const factory=new ethers.ContractFactory(normalizedAbi(artifact.abi),linkedBytecode(artifact,libraries),signer);
      const contract=await factory.deploy(...args);
      await contract.waitForDeployment();
      const receipt=await contract.deploymentTransaction().wait(),address=await contract.getAddress();
      rows.push({address,transactionHash:receipt.hash,blockNumber:receipt.blockNumber,qualifiedName:artifact.sourceName+':'+artifact.contractName,contractName:artifact.contractName,sourceName:artifact.sourceName,mappingStatus:'SOURCE_KNOWN_DEPLOYMENT_PLAN_FALLBACK',planPath:chosen.rel,planOrdinal:ordinal,constructorArgs:normalize(args)});
      attempts.push({framework:'SOURCE_KNOWN_PLAN',path:chosen.rel,contractName:step.contractName,status:'PASS',address,transactionHash:receipt.hash});
      if(step.binding)bindings.set(step.binding,address);
      if(step.library)libraries.set(step.contractName,address);
    }catch(error){
      const message=String(error?.shortMessage??error?.message??error).slice(0,2000);
      attempts.push({framework:'SOURCE_KNOWN_PLAN',path:chosen.rel,contractName:step.contractName,status:'FAILED',message});
      limitations.push({type:'SOURCE_PLAN_DEPLOYMENT_FAILED',contractName:step.contractName,planPath:chosen.rel,message});
    }
  }
  const unresolvedSteps=chosen.steps.length-rows.length;
  return{status:unresolvedSteps===0?'PASS':'COMPLETE_WITH_FAILURES',planPath:chosen.rel,planned:chosen.steps.length,rows,attempts,limitations,unresolvedSteps};
}
