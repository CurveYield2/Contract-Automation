import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {verifyV13ReleaseV1,ADR_V13_RELEASE_RECEIPT_V1} from '../src/adr-v13-release-gate-v1.mjs';

const qualified=()=>({schemaVersion:'curveyield-adr-v13-qualification-pass-v1',
 status:'QUALIFIED',seededDefects:41,baselineCaught:14,caught:30,
 decoysFlagged:0,cleanControlCriticalHighFalsePositives:0,
 independentRunId:'seeded-fixture-run-not-an-actual-release',
 reviewedBy:'fixture reviewer',scoreSha256:'a'.repeat(64)});
test('v13 release gate refuses missing live qualification file and false partial results',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'adr-v13-gate-'));
 try{
  assert.throws(()=>verifyV13ReleaseV1({repoRoot:root}),/V13_QUALIFICATION_REQUIRED/);
  assert.throws(()=>verifyV13ReleaseV1({receipt:{...qualified(),caught:29}}),/V13_QUALIFICATION_REQUIRED/);
  assert.throws(()=>verifyV13ReleaseV1({receipt:{...qualified(),decoysFlagged:1}}),/V13_QUALIFICATION_REQUIRED/);
  assert.throws(()=>verifyV13ReleaseV1({receipt:{...qualified(),cleanControlCriticalHighFalsePositives:1}}),/V13_QUALIFICATION_REQUIRED/);
  assert.throws(()=>verifyV13ReleaseV1({receipt:{...qualified(),scoreSha256:'missing'}}),/V13_QUALIFICATION_REQUIRED/);
  const file=path.join(root,ADR_V13_RELEASE_RECEIPT_V1);
  fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(file,JSON.stringify(qualified()));
  assert.equal(verifyV13ReleaseV1({repoRoot:root}).status,'QUALIFIED');
 }finally{fs.rmSync(root,{force:true,recursive:true});}
});
