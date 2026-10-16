import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  secureShardWorkFormV13,secureRestoreWorkFormV13,
  shardWorkFormV1,materializeShardedWorkFormV1
} from '../lib/lite-work-shards-v1.mjs';

const campaign='campaigns/test-r1';
const formRel=campaign+'/work/phase-05/PHASE_05_WORK_FORM_v1.json';
const p=(root,rel)=>path.join(root,...rel.split('/'));
const write=(root,rel,data)=>{
 fs.mkdirSync(path.dirname(p(root,rel)),{recursive:true});
 fs.writeFileSync(p(root,rel),JSON.stringify(data,null,2)+'\n');
};
const read=(root,rel)=>JSON.parse(fs.readFileSync(p(root,rel),'utf8'));
const scenario=(records=323)=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'v13-shard-'));
 const source={schemaVersion:'curveyield-lite-phase-work-form-v1',phase:5,
  automationInputs:{controllerPrefillDigestSha256:'a'.repeat(64)},
  actions:{
   'step-1':{section:'scope',outputs:{newCandidateRecords:[],reason:'Reviewer supplies context'}},
   'step-3':{section:'execution',outputs:{targetDesigns:Array.from({length:records},(_,i)=>({
     candidateKey:'C-'+String(i).padStart(5,'0'),expectedSecurityProperty:'bounded',
     transactionSequence:'transfer',oracle:'balance must be bounded'
   }))}}
  }
 };
 write(root,formRel,source);
 const result=secureShardWorkFormV13({root,formRel,phase:5});
 return {root,source,result,workDir:path.posix.dirname(result.indexRel)};
};
const specs=s=>{
 const index=read(s.root,s.result.indexRel);
 return index.pages.flatMap(v=>read(s.root,s.workDir+'/'+v.file).shards);
};
const restore=s=>JSON.parse(secureRestoreWorkFormV13({root:s.root,indexRel:s.result.indexRel}).content);
const exercise=(name,mutator)=>{
 test(name,()=>{
   const s=scenario();
   try{mutator(s);assert.throws(()=>restore(s),/v13|ENOENT|Unexpected token|JSON/);}
   finally{fs.rmSync(s.root,{recursive:true,force:true});}
 });
};

test('v13 real-size form roundtrips through locked base, editable shards and paged index',()=>{
 const s=scenario();
 try{
   const index=read(s.root,s.result.indexRel);
   assert.ok(index.pages.length>0);
   assert.deepEqual(restore(s),s.source);
   assert.ok(!fs.existsSync(p(s.root,formRel)));
   assert.ok(fs.statSync(p(s.root,s.result.indexRel)).size<=32768);
   for(const page of index.pages)assert.ok(fs.statSync(p(s.root,s.workDir+'/'+page.file)).size<=32768);
   for(const spec of specs(s))assert.ok(fs.statSync(p(s.root,s.workDir+'/'+spec.file)).size<=65536);
 }finally{fs.rmSync(s.root,{recursive:true,force:true});}
});
test('v13 allows append only through the controller-preauthorized append slot',()=>{
 const s=scenario();
 try{
   const slot=specs(s).find(x=>x.append&&x.path.at(-1)==='newCandidateRecords');
   assert.ok(slot);
   const body=read(s.root,s.workDir+'/'+slot.file);
   body.entries.push({key:JSON.stringify(slot.path)+':APPEND-0001',value:{candidateKey:'NEW-1'}});
   write(s.root,s.workDir+'/'+slot.file,body);
   assert.equal(restore(s).actions['step-1'].outputs.newCandidateRecords[0].candidateKey,'NEW-1');
   assert.equal(materializeShardedWorkFormV1({root:s.root,formRel,refreshDigests:true}),true);
   assert.equal(read(s.root,formRel).actions['step-1'].outputs.newCandidateRecords.length,1);
   const resh=shardWorkFormV1({root:s.root,formRel,phase:5,retireFull:true,force:true});
   assert.ok(resh);
   assert.equal(restore(s).actions['step-1'].outputs.newCandidateRecords[0].candidateKey,'NEW-1');
 }finally{fs.rmSync(s.root,{recursive:true,force:true});}
});
exercise('v13 rejects an appended duplicate candidate identity across indexed shards',s=>{
 const slot=specs(s).find(x=>x.append&&x.path.at(-1)==='targetDesigns');
 const body=read(s.root,s.workDir+'/'+slot.file);
 body.entries.push({key:JSON.stringify(slot.path)+':APPEND-0001',value:{candidateKey:'C-00000'}});
 write(s.root,s.workDir+'/'+slot.file,body);
});
exercise('v13 rejects deletion of a complete targetDesigns shard',s=>{
 const x=specs(s).find(x=>x.path.at(-1)==='targetDesigns'&&!x.append);
 fs.unlinkSync(p(s.root,s.workDir+'/'+x.file));
});
exercise('v13 rejects missing mandatory record and changed record count',s=>{
 const x=specs(s).find(x=>x.path.at(-1)==='targetDesigns'&&!x.append);
 const body=read(s.root,s.workDir+'/'+x.file);body.entries.pop();write(s.root,s.workDir+'/'+x.file,body);
});
exercise('v13 rejects renamed candidateKey even if shard entry key is changed',s=>{
 const x=specs(s).find(x=>x.path.at(-1)==='targetDesigns'&&!x.append);
 const body=read(s.root,s.workDir+'/'+x.file);body.entries[0].value.candidateKey='HACKED';
 body.entries[0].key=JSON.stringify(x.path)+':candidateKey=HACKED';write(s.root,s.workDir+'/'+x.file,body);
});
exercise('v13 rejects altered agent index',s=>{
 const index=read(s.root,s.result.indexRel);index.pages.pop();write(s.root,s.result.indexRel,index);
});
exercise('v13 rejects altered index page',s=>{
 const index=read(s.root,s.result.indexRel),rel=s.workDir+'/'+index.pages[0].file;
 const page=read(s.root,rel);page.shards.pop();write(s.root,rel,page);
});
exercise('v13 rejects agent-added unindexed shard',s=>{
 write(s.root,s.workDir+'/shard-9999_v1.json',{entries:[]});
});
exercise('v13 rejects duplicate mandatory record key',s=>{
 const x=specs(s).find(x=>x.path.at(-1)==='targetDesigns'&&!x.append);
 const body=read(s.root,s.workDir+'/'+x.file);body.entries[1].key=body.entries[0].key;write(s.root,s.workDir+'/'+x.file,body);
});
exercise('v13 rejects changing controller-owned base fields',s=>{
 const base=read(s.root,s.workDir+'/BASE_v1.json');base.automationInputs.controllerPrefillDigestSha256='b'.repeat(64);
 write(s.root,s.workDir+'/BASE_v1.json',base);
});
test('v13 root index remains <32 KiB at ten times the real r4 record count',()=>{
 const s=scenario(3230);
 try{
   const index=read(s.root,s.result.indexRel);
   assert.ok(index.pages.length>10);
   assert.ok(fs.statSync(p(s.root,s.result.indexRel)).size<=32768);
   assert.equal(restore(s).actions['step-3'].outputs.targetDesigns.length,3230);
 }finally{fs.rmSync(s.root,{recursive:true,force:true});}
});
test('frozen v12 small work forms are left unsharded',()=>{
 const s=scenario(1);
 try{
   // Construct a truly separate legacy source rather than convert v13 state.
   const oldRel=campaign+'/work/phase-06/PHASE_06_WORK_FORM_v1.json';
   write(s.root,oldRel,{phase:6,actions:{'step-1':{outputs:{rows:[]}}}});
   assert.equal(shardWorkFormV1({root:s.root,formRel:oldRel,phase:6}),null);
   assert.ok(fs.existsSync(p(s.root,oldRel)));
 }finally{fs.rmSync(s.root,{recursive:true,force:true});}
});
