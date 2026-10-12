import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';

const MAX_GIT_RECORD_BYTES=48*1024*1024;
const CHUNK_BYTES=32*1024*1024;
const MAX_FULL_BYTES=750*1024*1024;
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
function selected(o,keys){
  if(!o||typeof o!=='object')return null;
  return Object.fromEntries(keys.filter(k=>o[k]!==undefined).map(k=>[k,o[k]]));
}
function compactComponent(c){
  if(!c||typeof c!=='object')return c??null;
  const kept=selected(c,[
    'backend','status','terminal','componentStatus','continuationDisposition',
    'failureKind','reason','preflightDetermined','toolInvoked','rawArtifactRef',
    'sourceCommit','projectRoot','forkEvidence','reproduction'
  ]);
  if(c.rawOutput)kept.rawOutput={
    exitCode:c.rawOutput.exitCode??null,
    stdoutTail:String(c.rawOutput.stdout??'').slice(-2400),
    stderrTail:String(c.rawOutput.stderr??'').slice(-2400)
  };
  return kept;
}
export function compactV7EvidenceV1(result,manifest){
  const build=result.build&&typeof result.build==='object'?
    {...selected(result.build,['status','compiler','compilerVersion','optimizer','viaIR','evmVersion','sourceCommit','buildDigest','sourceSha256']),
      artifactCount:Array.isArray(result.build.artifacts)?result.build.artifacts.length:null,
      fullBuildStoredInBundle:true}:null;
  const analysis=Object.fromEntries(Object.entries(result.analysis??{}).map(([name,c])=>[name,compactComponent(c)]));
  const summary={
    ...selected(result,['schemaVersion','requestId','requestDigest','profileId','source','status','blocking',
      'disposition','owner','nextAction','retryFrom','recoveryCommand',
      'startedAt','finishedAt','error','analysisComponentFailureCount',
      'failedStepCount','continuityDisposition']),
    preflight:result.preflight??null,build,analysis,
    simulation:result.simulation?{
      status:result.simulation.status??null,
      steps:Array.isArray(result.simulation.steps)?
        result.simulation.steps.map(s=>selected(s,['label','status','error','txHash'])):[]}:null,
    reproduction:result.reproduction??null,
    failedSteps:Array.isArray(result.failedSteps)?
      result.failedSteps.map(e=>selected(e,['component','name','step','kind','failureKind','error','message'])):[],
    fullRawEvidenceV1:manifest
  };
  return summary;
}
export function persistGitSafeV7ResultV1(evidenceRoot,result){
  const raw=Buffer.from(JSON.stringify(result,null,2)+'\n','utf8');
  if(raw.length>MAX_FULL_BYTES)throw new Error('V7 raw result exceeds maximum evidence-bundle size');
  const originalSha256=sha256(raw);
  if(raw.length<=MAX_GIT_RECORD_BYTES){
    fs.writeFileSync(path.join(evidenceRoot,'raw-result.json'),raw);
    return {record:result,originalSha256,bundle:null};
  }
  const gzip=gzipSync(raw,{level:6});
  const parts=[];
  for(let offset=0;offset<gzip.length;offset+=CHUNK_BYTES){
    const part=gzip.subarray(offset,Math.min(gzip.length,offset+CHUNK_BYTES));
    const name='raw-full-'+String(parts.length+1).padStart(4,'0')+'.gzpart';
    fs.writeFileSync(path.join(evidenceRoot,name),part);
    parts.push({name,sha256:sha256(part),bytes:part.length});
  }
  const manifest={
    schemaVersion:'curveyield-v7-git-safe-evidence-v1',
    compression:'gzip',
    originalSha256,originalBytes:raw.length,
    compressedSha256:sha256(gzip),compressedBytes:gzip.length,
    chunks:parts
  };
  const record=compactV7EvidenceV1(JSON.parse(raw.toString('utf8')),manifest);
  const summary=Buffer.from(JSON.stringify(record,null,2)+'\n');
  if(summary.length>MAX_GIT_RECORD_BYTES)throw new Error('V7 compact evidence summary exceeds Git file budget');
  fs.writeFileSync(path.join(evidenceRoot,'raw-result.json'),summary);
  return {record,originalSha256,bundle:manifest};
}
export function validateGitSafeV7EvidenceV1(evidenceDirectory,record){
  const manifest=record?.fullRawEvidenceV1;
  if(!manifest)return [];
  const fail=(x)=>['invalid complete raw evidence bundle: '+x];
  if(manifest.schemaVersion!=='curveyield-v7-git-safe-evidence-v1'||manifest.compression!=='gzip')
    return fail('unsupported manifest');
  if(!Array.isArray(manifest.chunks)||manifest.chunks.length<1||manifest.chunks.length>64)
    return fail('invalid chunk inventory');
  if(!Number.isSafeInteger(manifest.originalBytes)||manifest.originalBytes<1||manifest.originalBytes>MAX_FULL_BYTES)
    return fail('invalid original length');
  try{
    const chunks=[];
    for(let index=0;index<manifest.chunks.length;index++){
      const item=manifest.chunks[index];
      const name='raw-full-'+String(index+1).padStart(4,'0')+'.gzpart';
      if(item?.name!==name||!Number.isSafeInteger(item.bytes)||item.bytes<1||item.bytes>CHUNK_BYTES)
        return fail('invalid chunk metadata');
      const bytes=fs.readFileSync(path.join(evidenceDirectory,name));
      if(bytes.length!==item.bytes||sha256(bytes)!==item.sha256)return fail('chunk checksum mismatch: '+name);
      chunks.push(bytes);
    }
    const zipped=Buffer.concat(chunks);
    if(zipped.length!==manifest.compressedBytes||sha256(zipped)!==manifest.compressedSha256)
      return fail('compressed digest mismatch');
    const full=gunzipSync(zipped,{maxOutputLength:MAX_FULL_BYTES});
    if(full.length!==manifest.originalBytes||sha256(full)!==manifest.originalSha256)
      return fail('original SHA-256 mismatch');
    const raw=JSON.parse(full.toString('utf8'));
    const reproduced=compactV7EvidenceV1(raw,manifest);
    if(JSON.stringify(reproduced)!==JSON.stringify(record))
      return fail('compacted machine result differs from archived full raw result');
    return [];
  }catch(error){return fail('archive unreadable: '+String(error?.message??error));}
}
