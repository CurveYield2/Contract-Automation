import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';

const MAX_SHARD=64*1024, MAX_INDEX=32*1024, TARGET_SHARD=58*1024;
const bytes=x=>Buffer.byteLength(JSON.stringify(x,null,2)+'\n');
const digest=x=>createHash('sha256').update(x).digest('hex');
const pretty=x=>JSON.stringify(x,null,2)+'\n';
const relfile=(root,rel)=> {
 if(typeof rel!=='string'||!rel||rel.startsWith('/')||rel.split('/').some(x=>x==='..'||x==='.'||!x))
   throw new Error('unsafe shard path');
 return path.join(root,...rel.split('/'));
};
const recordKey=(pathTokens,value,i)=>{
 const field=['contextId','candidateKey','tempKey','canonicalId','obligationId','findingTempKey','id','key']
   .find(k=>value&&typeof value==='object'&&!Array.isArray(value)&&typeof value[k]==='string'&&value[k].trim());
 return JSON.stringify(pathTokens)+':'+(field?field+'='+value[field]:String(i));
};
const clone=x=>structuredClone(x);

// Group large arrays into no more than 25 records and no more than 64 KiB per shard.
// Small editable arrays and scalar fields remain in the BASE shard.
export function shardWorkFormV1({root,formRel,phase,retireFull=true,force=false}){
 const full=relfile(root,formRel);
 const input=fs.readFileSync(full,'utf8');
 if(!force&&Buffer.byteLength(input)<=MAX_SHARD)return null;
 const original=JSON.parse(input),base=clone(original),arrays=[];
 const visit=(node,tokens)=>{
  if(Array.isArray(node)){
   if(node.length>25||bytes(node)>TARGET_SHARD){
    arrays.push({tokens,items:node});
    return [];
   }
   return node.map((v,i)=>visit(v,[...tokens,i]));
  }
  if(!node||typeof node!=='object')return node;
  return Object.fromEntries(Object.entries(node).map(([k,v])=>[k,visit(v,[...tokens,k])]));
 };
 const structure=visit(original,[]);
 const baseRel=path.posix.join(path.posix.dirname(formRel),'shards','BASE_v1.json');
 if(bytes(structure)>MAX_SHARD)throw new Error('work-form base shard exceeds 64 KiB; a large unshardable scalar/object is present');
 const dir=path.dirname(relfile(root,baseRel));
 fs.mkdirSync(dir,{recursive:true});
 const baseText=pretty(structure);
 fs.writeFileSync(relfile(root,baseRel),baseText);
 const shards=[],globalKeys=new Set();
 for(const {tokens,items} of arrays){
   let next=0;
   while(next<items.length){
     const start=next,entries=[];
     for(;next<items.length&&entries.length<25;next++){
       const key=recordKey(tokens,items[next],next);
       if(globalKeys.has(key))throw new Error('duplicate work-form record key '+key);
       const proposed={schemaVersion:'curveyield-work-shard-v1',arrayPath:tokens,startIndex:start,entries:[...entries,{key,value:items[next]}]};
       if(bytes(proposed)>MAX_SHARD){
         if(!entries.length)throw new Error('single work-form record exceeds 64 KiB: '+key);
         break;
       }
       entries.push({key,value:items[next]});globalKeys.add(key);
     }
     const shard={schemaVersion:'curveyield-work-shard-v1',arrayPath:tokens,startIndex:start,entries};
     const file='shard-'+String(shards.length+1).padStart(4,'0')+'_v1.json';
     const rel=path.posix.join(path.posix.dirname(baseRel),file),content=pretty(shard);
     if(Buffer.byteLength(content)>MAX_SHARD)throw new Error('oversized work shard');
     fs.writeFileSync(relfile(root,rel),content);
     shards.push({file,path:tokens,startIndex:start,recordKeys:entries.map(x=>x.key),
       sha256:digest(content),bytes:Buffer.byteLength(content)});
   }
 }
 const index={schemaVersion:'curveyield-work-shard-index-v1',phase,formRel,
   baseFile:'BASE_v1.json',baseSha256:digest(baseText),baseBytes:bytes(structure),
   originalSha256:digest(input),originalBytes:Buffer.byteLength(input),shards};
 const indexRel=path.posix.join(path.posix.dirname(baseRel),'INDEX_v1.json');
 if(bytes(index)>MAX_INDEX)throw new Error('work shard index exceeds 32 KiB');
 fs.writeFileSync(relfile(root,indexRel),pretty(index));
 if(retireFull)fs.unlinkSync(full);
 return {indexRel,shards:shards.length,recordCount:globalKeys.size};
}

export function restoreWorkShardsV1({root,indexRel,refreshDigests=false}){
 const indexFile=relfile(root,indexRel),index=JSON.parse(fs.readFileSync(indexFile,'utf8'));
 if(index.schemaVersion!=='curveyield-work-shard-index-v1')throw new Error('wrong work shard index schema');
 if(bytes(index)>MAX_INDEX)throw new Error('oversized work shard index');
 const parent=path.posix.dirname(indexRel);
 const baseRel=path.posix.join(parent,index.baseFile);
 const baseText=fs.readFileSync(relfile(root,baseRel),'utf8');
 if(Buffer.byteLength(baseText)>MAX_SHARD||digest(baseText)!==index.baseSha256)
   throw new Error('work shard base integrity mismatch');
 const full=JSON.parse(baseText),keys=new Set(),ranges=new Map();
 for(const spec of index.shards){
  if(!/^shard-[0-9]{4}_v1\.json$/.test(spec.file))throw new Error('unsafe shard filename');
  const body=fs.readFileSync(relfile(root,path.posix.join(parent,spec.file)),'utf8');
  if(Buffer.byteLength(body)>MAX_SHARD)throw new Error('work shard exceeds 64 KiB');
  const hash=digest(body);
  if(!refreshDigests&&hash!==spec.sha256)throw new Error('work shard digest mismatch: '+spec.file);
  const shard=JSON.parse(body);
  if(shard.schemaVersion!=='curveyield-work-shard-v1'||
    JSON.stringify(shard.arrayPath)!==JSON.stringify(spec.path)||
    shard.startIndex!==spec.startIndex||!Array.isArray(shard.entries)||
    shard.entries.length!==spec.recordKeys.length||shard.entries.length>25)
    throw new Error('work shard structure mismatch: '+spec.file);
  const arrayId=JSON.stringify(spec.path);
  let target=full;
  for(const token of spec.path){if(target===undefined||target===null)throw new Error('missing shard array');target=target[token];}
  if(!Array.isArray(target))throw new Error('shard target is not an array');
  const occupied=ranges.get(arrayId)??new Set();
  for(const [j,item] of shard.entries.entries()){
   const i=spec.startIndex+j,key=recordKey(spec.path,item.value,i);
   if(key!==item.key||key!==spec.recordKeys[j]||keys.has(key)||occupied.has(i))
     throw new Error('missing, duplicated or changed work record key: '+key);
   keys.add(key);occupied.add(i);target[i]=item.value;
  }
  ranges.set(arrayId,occupied);
  if(refreshDigests){spec.sha256=hash;spec.bytes=Buffer.byteLength(body);}
 }
 for(const [p,occupied] of ranges){
  let target=full;for(const token of JSON.parse(p))target=target[token];
  if(target.length!==occupied.size||[...target.keys()].some(i=>!occupied.has(i)))
    throw new Error('shard array missing or has duplicate record index '+p);
 }
 const result=pretty(full);
 if(!refreshDigests&&index.originalSha256!==digest(result))
   throw new Error('shard round-trip changed original form bytes');
 if(refreshDigests){
  index.originalSha256=digest(result);index.originalBytes=Buffer.byteLength(result);
  if(bytes(index)>MAX_INDEX)throw new Error('updated work shard index exceeds 32 KiB');
  fs.writeFileSync(indexFile,pretty(index));
 }
 return {formRel:index.formRel,content:result,recordCount:keys.size};
}

export function materializeShardedWorkFormV1({root,formRel,refreshDigests=true}){
 const indexRel=path.posix.join(path.posix.dirname(formRel),'shards','INDEX_v1.json');
 if(!fs.existsSync(relfile(root,indexRel)))return false;
 const {content}=restoreWorkShardsV1({root,indexRel,refreshDigests});
 fs.writeFileSync(relfile(root,formRel),content);
 return true;
}
