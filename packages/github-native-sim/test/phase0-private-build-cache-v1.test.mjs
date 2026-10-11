import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {privateBuildCacheIdentityV1,compileWithPrivateCacheV1} from '../src/phase0-private-build-cache-v1.mjs';

const sourceSha='a'.repeat(64),sourceCommit='b'.repeat(40),toolIdentity='c'.repeat(64);
const request={
  source:{repository:'CurveYield2/Audit-Controller',commit:sourceCommit,archivePath:'campaigns/example/source/source.zip',archiveSha256:sourceSha},
  destination:{repository:'CurveYield2/Audit-Controller',ref:'main',campaignPath:'campaigns/example'},
  campaignId:'example',campaignGenerationId:'generation-1'
};
const pseudo={source:{projectPath:'contracts',archiveSha256:sourceSha},
  configuration:{compilers:[{language:'solidity',version:'0.8.28'}],optimizer:{enabled:true,runs:200},evmVersion:'cancun',viaIR:false}};

test('private build cache key pins exact source, profile, runner tools and project root',()=>{
  const a=privateBuildCacheIdentityV1({request,pseudo,projectRoot:'/runner/source',toolIdentity});
  const same=privateBuildCacheIdentityV1({request,pseudo,projectRoot:'/runner/source',toolIdentity});
  assert.equal(a.key,same.key);
  assert.equal(a.key.length,64);
  assert.notEqual(a.key,privateBuildCacheIdentityV1({request:{...request,source:{...request.source,archiveSha256:'d'.repeat(64)}},pseudo,projectRoot:'/runner/source',toolIdentity}).key);
  assert.notEqual(a.key,privateBuildCacheIdentityV1({request,pseudo:{...pseudo,configuration:{...pseudo.configuration,viaIR:true}},projectRoot:'/runner/source',toolIdentity}).key);
  assert.notEqual(a.key,privateBuildCacheIdentityV1({request,pseudo,projectRoot:'/runner/source',toolIdentity:'d'.repeat(64)}).key);
  assert.notEqual(a.key,privateBuildCacheIdentityV1({request,pseudo,projectRoot:'/other/runner',toolIdentity}).key);
});

test('refuses missing exact source or build tool identity',()=>{
  assert.throws(()=>privateBuildCacheIdentityV1({request:{...request,source:{...request.source,archiveSha256:'unknown'}},pseudo,projectRoot:'/runner',toolIdentity}),/verified source digest/);
  assert.throws(()=>privateBuildCacheIdentityV1({request,pseudo,projectRoot:'/runner',toolIdentity:'unknown'}),/pinned compiler tool identity/);
});

test('untrusted or credential-less requests always execute the original compiler',async()=>{
  let builds=0;
  const compile=async()=>{builds++;return{status:'completed',artifacts:[]};};
  await compileWithPrivateCacheV1({request,pseudo,projectRoot:'/runner',enabled:false,token:'dummy',compile});
  await compileWithPrivateCacheV1({request,pseudo,projectRoot:'/runner',enabled:true,token:'',compile});
  assert.equal(builds,2);
});

test('primary and No Telemetry only use private cache through exact intelligence stage',()=>{
  for(const name of ['lite-phase0-intelligence-v1.mjs','lite-phase0-intelligence-no-telemetry-v1.mjs']){
    const engine=fs.readFileSync(new URL('../src/'+name,import.meta.url),'utf8');
    assert.match(engine,/compileWithPrivateCacheV1\(/);
  }
  for(const name of ['lite-phase0-intelligence-v1.yml','lite-phase0-intelligence-no-telemetry-v1.yml']){
    const workflow=fs.readFileSync(new URL('../../../.github/workflows/'+name,import.meta.url),'utf8');
    assert.match(workflow,/PHASE0_PRIVATE_BUILD_CACHE_ENABLED/);
    assert.doesNotMatch(workflow,/actions\/cache.*PHASE0_VERIFIED_COMPILATION/);
  }
});

test('V7 exact reuse requires matching immutable runner, private controller and proven successful run',()=>{
  const workflow=fs.readFileSync(new URL('../../../.github/workflows/v7-execution-infrastructure-qualification.yml',import.meta.url),'utf8');
  assert.match(workflow,/qualifiedCommit==\$runner/);
  assert.match(workflow,/controllerQualification\.controllerCommit==\$controller/);
  assert.match(workflow,/\.status=="completed" and \.conclusion=="success" and \.head_sha==\$sha/);
  assert.match(workflow,/V7_QUALIFICATION_LANE=REUSE_EXACT/);
  assert.match(workflow,/V7_QUALIFICATION_LANE != 'REUSE_EXACT'/);
  assert.match(workflow,/V7_QUALIFICATION_LANE == 'FULL'/);
});
