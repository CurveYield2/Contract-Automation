import fs from 'node:fs';
import path from 'node:path';

// A v13 authority is not eligible for production until an independent private
// seed evaluation is recorded. This tiny release decision is not a reviewer
// work form and never includes the sealed answer-key manifest.
export const ADR_V13_RELEASE_RECEIPT_V1='process/qualification/adr-v13/QUALIFICATION_PASS_v1.json';
const sha=/^[0-9a-f]{64}$/;
export function verifyV13ReleaseV1({repoRoot,receipt=null}={}){
 const row=receipt??(()=>{
   if(!repoRoot)throw new Error('v13 qualification requires automation repository root');
   const file=path.join(repoRoot,...ADR_V13_RELEASE_RECEIPT_V1.split('/'));
   if(!fs.existsSync(file))throw new Error('V13_QUALIFICATION_REQUIRED: private seeded campaign is not independently qualified');
   return JSON.parse(fs.readFileSync(file,'utf8'));
 })();
 if(row?.schemaVersion!=='curveyield-adr-v13-qualification-pass-v1'||
    row?.status!=='QUALIFIED'||row?.seededDefects!==41||
    row?.baselineCaught!==14||row?.caught<30||row?.caught>41||
    row?.decoysFlagged!==0||row?.cleanControlCriticalHighFalsePositives!==0||
    typeof row?.independentRunId!=='string'||!row.independentRunId.trim()||
    !sha.test(row?.scoreSha256??'')||
    typeof row?.reviewedBy!=='string'||!row.reviewedBy.trim())
    throw new Error('V13_QUALIFICATION_REQUIRED: missing or failed independent 41-defect / zero-decoy release decision');
 return {status:'QUALIFIED',seededDefects:41,caught:row.caught,
   decoysFlagged:0,independentRunId:row.independentRunId,scoreSha256:row.scoreSha256};
}
