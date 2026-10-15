import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {verifyV13ReleaseV1,publicV13QualificationScoreV1,ADR_V13_RELEASE_RECEIPT_V1,ADR_V13_RELEASE_SCORE_V1} from '../src/adr-v13-release-gate-v1.mjs';
import {preparePublicV13ScoreV1} from '../../../scripts/adr-v13-public-score-v1.mjs';

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

test('private seeded truth labels never enter the count-only public release artifact',()=>{
 const privateScore={
   schemaVersion:'curveyield-seeded-detection-score-v1',defectCount:41,caught:30,
   decoysFlagged:0,cleanControlCriticalHighFalsePositiveCount:0,
   criticalHighMisses:[{caseId:'HIDDEN-CASE-001'}],
   byContract:{'SECRET_CONTRACT__DO_NOT_PUBLISH':{caught:30,missed:11}},
   byClassId:{'SECRET_CLASS__DO_NOT_PUBLISH':{caught:30,missed:11}},
   leakStageCounts:{'SECRET_STAGE__DO_NOT_PUBLISH':11},
   gate:{passed:true,requiredCaught:30,maxDecoys:0,
     activation:'ELIGIBLE_FOR_HUMAN_QUALIFICATION_REVIEW'}
 };
 const cleaned=publicV13QualificationScoreV1(privateScore);
 const json=JSON.stringify(cleaned);
 for(const token of ['HIDDEN-CASE-001','SECRET_CONTRACT','SECRET_CLASS','SECRET_STAGE'])
   assert.ok(!json.includes(token),'sensitive seeded information must not reach release artifact');
 assert.deepEqual(Object.keys(cleaned).sort(),[
   'caught','cleanControlCriticalHighFalsePositiveCount','decoysFlagged','defectCount','gate','schemaVersion'].sort());
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'adr-public-'));
 try{
  const privateFile=path.join(root,'sealed.json');
  const publicFile=path.join(root,'QUALIFICATION_SCORE_v1.json');
  fs.writeFileSync(privateFile,JSON.stringify(privateScore));
  const result=preparePublicV13ScoreV1(privateFile,publicFile);
  assert.deepEqual(result,cleaned);
  assert.deepEqual(JSON.parse(fs.readFileSync(publicFile,'utf8')),cleaned);
  const invalid={...privateScore,caught:29};
  fs.writeFileSync(privateFile,JSON.stringify(invalid));
  assert.throws(()=>preparePublicV13ScoreV1(privateFile,publicFile),/private report fails release thresholds/);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
