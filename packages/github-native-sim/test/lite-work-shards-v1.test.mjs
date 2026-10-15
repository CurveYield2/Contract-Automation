import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {shardWorkFormV1,restoreWorkShardsV1,materializeShardedWorkFormV1}
  from '../../../scripts/lib/lite-work-shards-v1.mjs';
const fixture=()=> {
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'lite-shards-'));
 const formRel='campaigns/test r1/work/phase-05/PHASE_05_WORK_FORM_v1.json';
 fs.mkdirSync(path.dirname(path.join(root,formRel)),{recursive:true});
 const form={schemaVersion:'curveyield-lite-phase-work-form-v1',phase:5,
   actions:{'step-3':{outputs:{targetDesigns:Array.from({length:323},(_,i)=>({
     candidateKey:'CAND-'+String(i).padStart(3,'0'),
     intent:'intent-'.repeat(250),oracle:'oracle-'+i
   }))}}},automationInputs:{controllerPrefillDigestSha256:'a'.repeat(64)}};
 const original=JSON.stringify(form,null,2)+'\n';
 fs.writeFileSync(path.join(root,formRel),original);
 return {root,formRel,original};
};
test('1 MB Phase-5 form round trips exactly through bounded shards',()=>{
 const x=fixture();
 try{
  assert.ok(Buffer.byteLength(x.original)>1024*1024/2);
  const done=shardWorkFormV1({root:x.root,formRel:x.formRel,phase:5});
  assert.ok(done.shards>1);
  assert.ok(!fs.existsSync(path.join(x.root,x.formRel)));
  assert.ok(fs.statSync(path.join(x.root,done.indexRel)).size<=32*1024);
  const index=JSON.parse(fs.readFileSync(path.join(x.root,done.indexRel),'utf8'));
  for(const shard of index.shards)assert.ok(fs.statSync(path.join(x.root,path.dirname(done.indexRel),shard.file)).size<=64*1024);
  assert.equal(restoreWorkShardsV1({root:x.root,indexRel:done.indexRel}).content,x.original);
  assert.equal(materializeShardedWorkFormV1({root:x.root,formRel:x.formRel,refreshDigests:false}),true);
  assert.equal(fs.readFileSync(path.join(x.root,x.formRel),'utf8'),x.original);
 }finally{fs.rmSync(x.root,{recursive:true,force:true});}
});
test('edited values update digest; missing and duplicated record keys fail closed',()=>{
 const x=fixture();
 try{
  const done=shardWorkFormV1({root:x.root,formRel:x.formRel,phase:5});
  const index=JSON.parse(fs.readFileSync(path.join(x.root,done.indexRel),'utf8'));
  const file=path.join(x.root,path.dirname(done.indexRel),index.shards[0].file);
  let shard=JSON.parse(fs.readFileSync(file,'utf8'));
  shard.entries[0].value.oracle='new observation';
  fs.writeFileSync(file,JSON.stringify(shard,null,2)+'\n');
  assert.throws(()=>restoreWorkShardsV1({root:x.root,indexRel:done.indexRel}),/digest mismatch/);
  assert.match(restoreWorkShardsV1({root:x.root,indexRel:done.indexRel,refreshDigests:true}).content,/new observation/);
  shard=JSON.parse(fs.readFileSync(file,'utf8'));
  shard.entries[1].key=shard.entries[0].key;
  fs.writeFileSync(file,JSON.stringify(shard,null,2)+'\n');
  assert.throws(()=>restoreWorkShardsV1({root:x.root,indexRel:done.indexRel,refreshDigests:true}),/duplicated or changed work record key/);
  shard.entries.pop();
  fs.writeFileSync(file,JSON.stringify(shard,null,2)+'\n');
  assert.throws(()=>restoreWorkShardsV1({root:x.root,indexRel:done.indexRel,refreshDigests:true}),/structure mismatch/);
 }finally{fs.rmSync(x.root,{recursive:true,force:true});}
});
