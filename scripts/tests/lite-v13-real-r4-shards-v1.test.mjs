import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {secureShardWorkFormV13,secureRestoreWorkFormV13} from '../lib/lite-work-shards-v1.mjs';

const sourceRel='campaigns/cyavKATv25b r4/work/phase-05/PHASE_05_WORK_FORM_v1.json';
const sourceRoot=process.env.ADR_R4_CHECKOUT||'.ac-main';
const originalFile=path.join(sourceRoot,...sourceRel.split('/'));
const file=(root,rel)=>path.join(root,...rel.split('/'));
const load=(root,rel)=>JSON.parse(fs.readFileSync(file(root,rel),'utf8'));

test('real frozen r4 323-design form roundtrips through v13 shards without editing its campaign',()=>{
 assert.ok(fs.existsSync(originalFile),'real r4 source fixture missing: '+originalFile);
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'real-r4-v13-shards-'));
 try{
   const target=file(root,sourceRel);
   fs.mkdirSync(path.dirname(target),{recursive:true});
   fs.copyFileSync(originalFile,target);
   const original=load(root,sourceRel);
   const before=fs.readFileSync(originalFile,'utf8');
   const designs=original?.actions?.['step-3']?.outputs?.targetDesigns;
   assert.equal(designs?.length,323,'real r4 targetDesigns count unexpectedly changed');
   const res=secureShardWorkFormV13({root,formRel:sourceRel,phase:5});
   const output=JSON.parse(secureRestoreWorkFormV13({root,indexRel:res.indexRel}).content);
   assert.deepEqual(output,original);
   assert.equal(fs.readFileSync(originalFile,'utf8'),before,'frozen source file was mutated');
   const dir=path.posix.dirname(res.indexRel),index=load(root,res.indexRel);
   assert.ok(fs.statSync(file(root,res.indexRel)).size<=32768);
   const specs=index.pages.flatMap(page=>{
     assert.ok(fs.statSync(file(root,dir+'/'+page.file)).size<=32768);
     return load(root,dir+'/'+page.file).shards;
   });
   assert.ok(specs.some(s=>s.path.at(-1)==='targetDesigns'));
   for(const spec of specs)assert.ok(fs.statSync(file(root,dir+'/'+spec.file)).size<=65536);
   const victim=specs.find(s=>s.path.at(-1)==='targetDesigns'&&!s.append&&s.recordKeys.length);
   assert.ok(victim);
   const body=load(root,dir+'/'+victim.file);
   body.entries.splice(0,1);
   fs.writeFileSync(file(root,dir+'/'+victim.file),JSON.stringify(body,null,2)+'\n');
   assert.throws(()=>secureRestoreWorkFormV13({root,indexRel:res.indexRel}),
     /mandatory work records dropped|work record|v13/);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
