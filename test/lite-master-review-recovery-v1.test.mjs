import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readSealedOriginal,masterWakeMessage} from '../scripts/lib/lite-master-review-v1.mjs';

function sealedForm(bytes){
  return {
    phase:1,
    path:'work/phase-01/PHASE_01_WORK_FORM_v1.json',
    gitBlobSha1:createHash('sha1').update('blob '+bytes.length + String.fromCharCode(0)).update(bytes).digest('hex'),
    sha256:createHash('sha256').update(bytes).digest('hex')
  };
}

function fixture(callback){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'cy-master-blob-'));
  const bin=path.join(root,'bin');
  fs.mkdirSync(bin);
  const gh=path.join(bin,'gh');
  fs.writeFileSync(gh,`#!/usr/bin/env node
const fs=require('node:fs');
fs.writeFileSync(process.env.MOCK_GH_ARGS_PATH,JSON.stringify({args:process.argv.slice(2),token:process.env.GH_TOKEN}));
process.stdout.write(fs.readFileSync(process.env.MOCK_GH_BLOB_PATH));
`);
  fs.chmodSync(gh,0o755);
  const backup={PATH:process.env.PATH,GH_TOKEN:process.env.GH_TOKEN,AUDIT_CONTROLLER_GITHUB_TOKEN:process.env.AUDIT_CONTROLLER_GITHUB_TOKEN,MOCK_GH_ARGS_PATH:process.env.MOCK_GH_ARGS_PATH,MOCK_GH_BLOB_PATH:process.env.MOCK_GH_BLOB_PATH};
  process.env.PATH=bin+path.delimiter+process.env.PATH;
  process.env.GH_TOKEN='invalid-generic-token';
  process.env.AUDIT_CONTROLLER_GITHUB_TOKEN='test-audit-controller-token';
  process.env.MOCK_GH_ARGS_PATH=path.join(root,'gh-call.json');
  process.env.MOCK_GH_BLOB_PATH=path.join(root,'gh-blob.json');
  try{return callback(root);}finally{
    for(const [key,value] of Object.entries(backup)){
      if(value===undefined)delete process.env[key];
      else process.env[key]=value;
    }
    fs.rmSync(root,{recursive:true,force:true});
  }
}
function setBlob(bytes,record,{sha=record.gitBlobSha1,encoding='base64'}={}){
  fs.writeFileSync(process.env.MOCK_GH_BLOB_PATH,JSON.stringify({
    sha,encoding,content:bytes.toString('base64')
  }));
}

test('fetches a sealed original through GitHub when the local partial clone lacks its blob',{concurrency:false},()=>{
  fixture(root=>{
    const bytes=Buffer.from('{"phase":1,"actions":{"step-1":{"outputs":{"finding":"sealed"}}}}\\n');
    const row=sealedForm(bytes);
    setBlob(bytes,row);
    const recovered=readSealedOriginal(root,row);
    assert.deepEqual(recovered,bytes);
    const call=JSON.parse(fs.readFileSync(process.env.MOCK_GH_ARGS_PATH,'utf8'));
    assert.deepEqual(call.args,['api','--method','GET','repos/CurveYield2/Audit-Controller/git/blobs/'+row.gitBlobSha1]);
    assert.equal(call.token,'test-audit-controller-token');
  });
});

test('rejects substituted GitHub blob even when API claims the requested identity',{concurrency:false},()=>{
  fixture(root=>{
    const original=Buffer.from('sealed source');
    const row=sealedForm(original);
    setBlob(Buffer.from('changed source'),row);
    assert.throws(()=>readSealedOriginal(root,row),/Git\\/SHA256 digest mismatch/);
  });
});

test('rejects GitHub blob metadata identity mismatch',{concurrency:false},()=>{
  fixture(root=>{
    const bytes=Buffer.from('sealed original');
    const row=sealedForm(bytes);
    setBlob(bytes,row,{sha:'f'.repeat(40)});
    assert.throws(()=>readSealedOriginal(root,row),/cannot recover sealed original/);
  });
});

test('recovers original locally before invoking the remote fallback',{concurrency:false},()=>{
  fixture(root=>{
    execFileSync('git',['-C',root,'init','-q']);
    const bytes=Buffer.from('unmodified sealed review\\n');
    const row=sealedForm(bytes);
    const disk=path.join(root,'form.json');
    fs.writeFileSync(disk,bytes);
    assert.equal(execFileSync('git',['-C',root,'hash-object','-w',disk],{encoding:'utf8'}).trim(),row.gitBlobSha1);
    assert.deepEqual(readSealedOriginal(root,row),bytes);
    assert.equal(fs.existsSync(process.env.MOCK_GH_ARGS_PATH),false);
  });
});

test('master wake references authority instead of duplicating the review manual',()=>{
  const message=masterWakeMessage({
    campaignId:'curveyield-dex-v16-source-r4',
    pending:{
      reviewerId:'reviewer-1',segmentPhases:[1],segmentId:'reviewer-1-phase-01',
      recordPath:'campaigns/CurveYield DEX v16 Source r4/work/master-review/reviewer-1-phase-01/MASTER_REVIEW_RECORD_v1.json'
    },
    authorityRoot:'Audit Skill - Current Authority/Audit_Litemode_v11'
  });
  assert.ok(message.length<650,'wake must remain much shorter than the prior instructions');
  assert.match(message,/MASTER_REVIEW_REQUIRED/);
  assert.match(message,/master-review\\/START_HERE\\.md/);
  assert.match(message,/MASTER_REVIEW_RECORD_v1\\.json/);
  assert.doesNotMatch(message,/Do not start new executions|schemaVersion|Step-by-step instructions/);
});
