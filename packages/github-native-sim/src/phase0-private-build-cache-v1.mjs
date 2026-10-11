// Private exact-source compilation cache shared by primary and No Telemetry Phase 0.
// Compiled source/AST/bytecode MUST NOT be stored in this public repository's Actions cache.
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { buildExecutionArtifactBundleV2 } from './phase0-execution-input-v2.mjs';

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const MAX_BYTES = 60 * 1024 * 1024;
const PRIVATE_CACHE_ROOT = 'Phase0 Build Cache';
const PRIVATE_CACHE_REF = 'main';
const SHA = /^[0-9a-f]{64}$/;
const identityParts = [
  'HEAD:packages/runner/src',
  'HEAD:packages/github-native-sim/src/execution.mjs',
  'HEAD:packages/github-native-sim/src/phase0-execution-input-v2.mjs',
  'HEAD:package-lock.json',
  'HEAD:package.json'
];

export function privateBuildCacheIdentityV1({request,pseudo,projectRoot,toolIdentity}) {
  if (!SHA.test(request?.source?.archiveSha256??'')) throw new Error('build cache requires verified source digest');
  if (!/^[0-9a-f]{40}$/.test(request?.source?.commit??'')) throw new Error('build cache requires pinned source commit');
  if (!SHA.test(toolIdentity??'')) throw new Error('build cache requires pinned compiler tool identity');
  if (!pseudo?.source?.projectPath || !pseudo?.configuration?.compilers?.length) throw new Error('build cache requires detected compiler configuration');
  const exact = {
    schemaVersion:'curveyield-private-verified-compilation-cache-v1',
    sourceSha256:request.source.archiveSha256,
    sourceCommit:request.source.commit,
    sourceRepository:request.source.repository,
    sourceArchivePath:request.source.archivePath,
    campaignId:request.campaignId,
    campaignGenerationId:request.campaignGenerationId,
    projectPath:pseudo.source.projectPath,
    absoluteProjectRoot:projectRoot,
    compilationConfiguration:pseudo.configuration,
    toolIdentity,
    nodeMajor:process.versions.node.split('.')[0]
  };
  return {exact,key:digest(JSON.stringify(exact))};
}

export function currentBuildToolIdentityV1() {
  // Git tree/blob object identities incorporate the actual runner compiler implementation,
  // dependency lock and execution adapter, and remain stable across unrelated commits.
  const parts=identityParts.map(ref=>execFileSync('git',['rev-parse',ref],{encoding:'utf8'}).trim());
  if(parts.some(part=>!(/^[0-9a-f]{40}$/.test(part)))) throw new Error('unresolved build tool identity');
  return digest(JSON.stringify(parts));
}

function validateCache(cache,identity,pseudo) {
  if (cache?.schemaVersion!=='curveyield-private-verified-compilation-cache-v1' ||
      cache?.key!==identity.key ||
      JSON.stringify(cache.exact)!==JSON.stringify(identity.exact) ||
      cache?.build?.status!=='completed' ||
      !SHA.test(cache.buildSha256??'') ||
      digest(JSON.stringify(cache.build))!==cache.buildSha256) return false;
  try {
    const bundle=buildExecutionArtifactBundleV2({request:pseudo,build:cache.build});
    return bundle.artifacts.length>0 && bundle.buildIdentity.compilationUnits.length>0;
  } catch { return false; }
}

function privateContentUrl({request,key}) {
  const campaignPath=request.destination.campaignPath;
  if (!/^campaigns\/[A-Za-z0-9._ /-]+$/.test(campaignPath) || campaignPath.includes('..')) {
    throw new Error('build cache path must be within canonical private campaign');
  }
  // Source-derived artifacts stay in the PRIVATE Audit-Controller main branch.
  // They are deliberately outside executable controller folders and campaigns.
  const campaignId=String(request.campaignId??'');
  if(!/^[A-Za-z0-9._-]+$/.test(campaignId)||campaignId==='..')throw new Error('unsafe private build cache campaign ID');
  const rel=PRIVATE_CACHE_ROOT+'/'+campaignId+'/PHASE0_VERIFIED_COMPILATION_'+key+'.json.gz';
  return 'repos/CurveYield2/Audit-Controller/contents/'+rel.split('/').map(encodeURIComponent).join('/');
}

function ghEnv(token) {
  return {...process.env,GH_TOKEN:token,GITHUB_TOKEN:token};
}

async function tryLoad({url,ref,token,identity,pseudo}) {
  // Raw media mode works for content blobs above GitHub Contents API's 1MB JSON threshold.
  let raw=execFileSync('gh',['api','-H','Accept: application/vnd.github.raw+json',url+'?ref='+encodeURIComponent(ref)],{
    env:ghEnv(token),maxBuffer:MAX_BYTES,timeout:45000,stdio:['ignore','pipe','pipe']
  });
  // GitHub returns raw bytes with this media type; some API clients may
  // return the standard base64-encoded JSON Contents envelope for small blobs.
  if(raw[0]===0x7b){
    const envelope=JSON.parse(raw.toString('utf8'));
    if(envelope.encoding!=='base64'||!envelope.content)throw new Error('private build cache raw content unavailable');
    raw=Buffer.from(envelope.content,'base64');
  }
  if(raw.length>MAX_BYTES) throw new Error('private build cache too large');
  const cache=JSON.parse(gunzipSync(raw,{maxOutputLength:MAX_BYTES}).toString('utf8'));
  if(!validateCache(cache,identity,pseudo)) throw new Error('private compilation cache identity or artifact validation failed');
  return cache.build;
}

async function tryPublish({url,ref,token,identity,pseudo,build}) {
  const payload={schemaVersion:'curveyield-private-verified-compilation-cache-v1',
    key:identity.key,exact:identity.exact,buildSha256:digest(JSON.stringify(build)),build};
  if(!validateCache(payload,identity,pseudo)) throw new Error('compiled artifact cache validation failed');
  const gz=gzipSync(Buffer.from(JSON.stringify(payload)),{level:6});
  if(gz.length>MAX_BYTES/2) { console.log('[phase0-build-cache] compressed compilation exceeds private cache size cap; skip storing');return; }
  const body={message:'cache(phase0): retain exact private Solidity compiler output '+identity.key.slice(0,12),
    branch:ref,content:gz.toString('base64')};
  const tmp=process.env.RUNNER_TEMP ?? '/tmp';
  const file=tmp+'/phase0-private-build-cache-'+process.pid+'.json';
  await fs.writeFile(file,JSON.stringify(body),{mode:0o600});
  try {
    execFileSync('gh',['api','--method','PUT',url,'--input',file],{
      env:ghEnv(token),timeout:60000,maxBuffer:128*1024,stdio:['ignore','pipe','pipe']
    });
    console.log('[phase0-build-cache] compiled source stored in private Audit-Controller/main/'+PRIVATE_CACHE_ROOT+', key='+identity.key.slice(0,16));
  } finally { await fs.rm(file,{force:true}); }
}

export async function compileWithPrivateCacheV1({request,pseudo,projectRoot,compile,token=process.env.AUDIT_CONTROLLER_GITHUB_TOKEN,enabled=process.env.PHASE0_PRIVATE_BUILD_CACHE_ENABLED==='true'}) {
  if(!enabled || !token) {
    console.log('[phase0-build-cache] disabled (untrusted request or missing private credential); compiling');
    return compile();
  }
  let identity,url;
  try {
    identity=privateBuildCacheIdentityV1({request,pseudo,projectRoot,toolIdentity:currentBuildToolIdentityV1()});
    url=privateContentUrl({request,key:identity.key});
  } catch(error) {
    console.log('[phase0-build-cache] cannot establish exact provenance; compiling: '+String(error.message).slice(0,200));
    return compile();
  }
  try {
    const build=await tryLoad({url,ref:PRIVATE_CACHE_REF,token,identity,pseudo});
    console.log('[phase0-build-cache] verified private cache HIT, key='+identity.key.slice(0,16)+'; skipping Solidity recompilation');
    return build;
  } catch(error) {
    console.log('[phase0-build-cache] MISS or invalid, key='+identity.key.slice(0,16)+'; exact compilation required');
  }
  const build=await compile();
  try {await tryPublish({url,ref:PRIVATE_CACHE_REF,token,identity,pseudo,build});}
  catch(error){console.log('[phase0-build-cache] publish unavailable; compiled results retained for this run: '+String(error.message).slice(0,220));}
  return build;
}
