import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {writeAllSyncV1} from '../lib/lite-sync-stdout-v1.mjs';

const campaign='campaigns/cyavKATv25b r4';
const root=process.env.AC_R4_ROOT;
const digest=b=>createHash('sha256').update(b).digest('hex');

test('real frozen r4 323-design Phase5 message expands beyond 5MB and roundtrips byte-identically', {skip:!root},()=>{
 const file=path.join(root,campaign,'work/phase-05/PHASE_05_WORK_FORM_v1.json');
 const original=fs.readFileSync(file);
 const obj=JSON.parse(original.toString());
 assert.equal(obj.actions['step-3'].outputs.targetDesigns.length,323);
 const perBlock=Buffer.byteLength(JSON.stringify(obj.actions['step-3'].outputs.targetDesigns));
 const repeats=Math.ceil((6*1024*1024)/perBlock);
 const response=JSON.stringify({status:'NEEDS_REWORK',realCampaign:'cyavkatv25b-r4',
  diagnostics:Array.from({length:repeats},()=>obj.actions['step-3'].outputs.targetDesigns)});
 assert.ok(Buffer.byteLength(response)>5*1024*1024);
 let segments=[],pos=0,calls=0;
 const total=writeAllSyncV1(1,response,{writer:(_fd,bytes,offset,length)=>{
  if(++calls%17===0){let err=new Error('EAGAIN');err.code='EAGAIN';throw err;}
  const take=Math.min(length,12133);segments.push(Buffer.from(bytes.subarray(offset,offset+take)));return take;
 }});
 const joined=Buffer.concat(segments);
 assert.equal(total,joined.length);
 assert.equal(digest(joined),digest(Buffer.from(response)));
 assert.equal(JSON.parse(joined.toString()).diagnostics.length,repeats);
 assert.equal(digest(fs.readFileSync(file)),digest(original),'no frozen r4 file changed');
 console.log('R4_REAL_5MB_STDOUT bytes='+total+' calls='+calls+' SHA256='+digest(joined));
});
