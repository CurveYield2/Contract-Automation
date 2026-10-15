import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {verifyV13ReleaseV1,ADR_V13_RELEASE_RECEIPT_V1,ADR_V13_RELEASE_SCORE_V1} from '../src/adr-v13-release-gate-v1.mjs';

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
  assert.throws(()=>verifyV13ReleaseV1({receipt:{...qualified(),caught:undefined}}),/V13_QUALIFICATION_REQUIRED/);
  assert.throws(()=>verifyV13ReleaseV1({receipt:{...qualified(),caught:'35'}}),/V13_QUALIFICATION_REQUIRED/);
  assert.throws(()=>verifyV13ReleaseV1({receipt:{...qualified(),caught:30.5}}),/V13_QUALIFICATION_REQUIRED/);
  assert.throws(()=>verifyV13ReleaseV1({receipt:{...qualified(),decoysFlagged:1}}),/V13_QUALIFICATION_REQUIRED/);
  assert.throws(()=>verifyV13ReleaseV1({receipt:{...qualified(),cleanControlCriticalHighFalsePositives:1}}),/V13_QUALIFICATION_REQUIRED/);
  assert.throws(()=>verifyV13ReleaseV1({receipt:{...qualified(),scoreSha256:'missing'}}),/V13_QUALIFICATION_REQUIRED/);
  const file=path.join(root,ADR_V13_RELEASE_RECEIPT_V1),
    scoreFile=path.join(root,ADR_V13_RELEASE_SCORE_V1);
  fs.mkdirSync(path.dirname(file),{recursive:true});
  const score={schemaVersion:'curveyield-seeded-detection-score-v1',
    defectCount:41,caught:30,decoysFlagged:0,
    cleanControlCriticalHighFalsePositiveCount:0,
    gate:{passed:true,requiredCaught:30,maxDecoys:0}};
  const bytes=JSON.stringify(score)+'\n',sha=createHash('sha256').update(bytes).digest('hex');
  fs.writeFileSync(file,JSON.stringify({...qualified(),scoreSha256:sha}));
  assert.throws(()=>verifyV13ReleaseV1({repoRoot:root}),/score evidence is missing/);
  fs.writeFileSync(scoreFile,bytes);
  assert.equal(verifyV13ReleaseV1({repoRoot:root}).status,'QUALIFIED');
  fs.writeFileSync(scoreFile,JSON.stringify({...score,caught:29})+'\n');
  assert.throws(()=>verifyV13ReleaseV1({repoRoot:root}),/score SHA-256/);
  fs.writeFileSync(scoreFile,bytes);
  fs.writeFileSync(file,JSON.stringify({...qualified(),scoreSha256:sha,caught:31}));
  assert.throws(()=>verifyV13ReleaseV1({repoRoot:root}),/score does not substantiate/);
 }finally{fs.rmSync(root,{force:true,recursive:true});}
});
