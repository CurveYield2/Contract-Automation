import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {loadFrozenAuthorityRegistryV1,resolveFrozenAuthorityFileV1,authorityLinkPathV1} from '../src/adr-frozen-authority-v1.mjs';
import {requiredFile} from '../../../scripts/lib/lite-phase-work-v1.mjs';
import {masterReviewRequired} from '../../../scripts/lib/lite-master-review-v1.mjs';

const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
function fixture(){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'adr-frozen-'));
  const logicalRoot='Audit Skill - Current Authority/Audit_Litemode_v11';
  const frozenRoot='audit-process/v7/frozen-authorities/Audit_Litemode_v11';
  const folder=path.join(root,frozenRoot);
  fs.mkdirSync(path.join(folder,'phases/phase-1'),{recursive:true});
  const skill='Synthetic v11 authority\n',phase='{"phase":1}\n';
  fs.writeFileSync(path.join(folder,'SKILL.md'),skill);
  fs.writeFileSync(path.join(folder,'phases/phase-1/PHASE_01_SCHEMA_v1.json'),phase);
  const files=[['SKILL.md',skill],['phases/phase-1/PHASE_01_SCHEMA_v1.json',phase]].map(([p,c])=>({path:p,bytes:Buffer.byteLength(c),sha256:sha(c)}));
  const manifest=JSON.stringify({release:'Audit_Litemode_v11',entrypoint:'SKILL.md',files})+'\n';
  fs.writeFileSync(path.join(folder,'MANIFEST.json'),manifest);
  const entry={release:'Audit_Litemode_v11',logicalRoot,frozenRoot,skillSha256:sha(skill),manifestSha256:sha(manifest)};
  const registry=path.join(root,'audit-process/v7/frozen-authorities/FROZEN_AUTHORITY_REGISTRY_v1.json');
  fs.writeFileSync(registry,JSON.stringify({schemaVersion:'curveyield-frozen-authority-registry-v1',entries:[entry]})+'\n');
  return {root,logicalRoot,frozenRoot,folder,entry,registry};
}
test('v10.3 built-in fallback has exact accepted digests',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'adr-legacy-'));
  try{
    const entries=loadFrozenAuthorityRegistryV1(root).entries;
    assert.equal(entries.length,1);
    assert.equal(entries[0].release,'Audit_Litemode_v10.3');
    assert.equal(entries[0].skillSha256,'bdb90107ea50580e67be91440ce47087de570c4f54b8474c5a3eb852af95ea27');
    assert.equal(entries[0].manifestSha256,'846be5f90d6e00757b817b1218dfabeb2aa4dff6c92b8e9ff47335d2db83703a');
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('v11 logical files resolve to byte-verified frozen paths',()=>{
  const f=fixture();try{
    const rel=f.logicalRoot+'/phases/phase-1/PHASE_01_SCHEMA_v1.json';
    assert.equal(resolveFrozenAuthorityFileV1(f.root,rel),path.join(f.folder,'phases/phase-1/PHASE_01_SCHEMA_v1.json'));
    assert.equal(requiredFile(f.root,rel),path.join(f.folder,'phases/phase-1/PHASE_01_SCHEMA_v1.json'));
  }finally{fs.rmSync(f.root,{recursive:true,force:true});}
});
test('tampering frozen file or manifest fails closed',()=>{
  const f=fixture();try{
    const rel=f.logicalRoot+'/SKILL.md';
    fs.appendFileSync(path.join(f.folder,'SKILL.md'),'tampered');
    assert.throws(()=>resolveFrozenAuthorityFileV1(f.root,rel),/root hash mismatch/);
    fs.writeFileSync(path.join(f.folder,'SKILL.md'),'Synthetic v11 authority\n');
    fs.appendFileSync(path.join(f.folder,'MANIFEST.json'),' ');
    assert.throws(()=>resolveFrozenAuthorityFileV1(f.root,rel),/manifest digest mismatch/);
  }finally{fs.rmSync(f.root,{recursive:true,force:true});}
});
test('logical file takes precedence over frozen entry',()=>{
  const f=fixture();try{
    const rel=f.logicalRoot+'/SKILL.md',logical=path.join(f.root,rel);
    fs.mkdirSync(path.dirname(logical),{recursive:true});fs.writeFileSync(logical,'live');
    assert.equal(resolveFrozenAuthorityFileV1(f.root,rel),null);
    assert.equal(requiredFile(f.root,rel),logical);
    assert.equal(authorityLinkPathV1(f.root,rel),rel);
  }finally{fs.rmSync(f.root,{recursive:true,force:true});}
});
test('reviewer link maps missing logical paths only',()=>{
  const f=fixture();try{
    const p=f.logicalRoot+'/SKILL.md';
    assert.equal(authorityLinkPathV1(f.root,p),f.frozenRoot+'/SKILL.md');
    assert.equal(authorityLinkPathV1(f.root,'unrelated/other.md'),'unrelated/other.md');
    assert.equal(authorityLinkPathV1(f.root,null),null);
  }finally{fs.rmSync(f.root,{recursive:true,force:true});}
});
test('v11/v12 require valid master configuration; v10.3 remains optional',()=>{
  const good={masterReview:{chatUrl:'https://chatgpt.com/c/11111111-1111-4111-8111-111111111111',reasoning:'MAXIMUM',repairModel:'SOL',repairReasoning:'HIGH'}};
  for(const version of ['v11','v12']){
    assert.equal(masterReviewRequired(good,'Audit Skill - Current Authority/Audit_Litemode_'+version),true);
    assert.throws(()=>masterReviewRequired({},'Audit Skill - Current Authority/Audit_Litemode_'+version),/requires masterReview/);
  }
  assert.equal(masterReviewRequired({},'Audit Skill - Current Authority/Audit_Litemode_v10.3'),false);
});
