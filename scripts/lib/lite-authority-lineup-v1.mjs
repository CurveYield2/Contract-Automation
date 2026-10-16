import fs from 'node:fs';
import path from 'node:path';

// The bound, versioned skill manifest owns the v13 reviewer lineup.
// Frozen v12 audit campaigns preserve their historical caller identity.
export const isV13AuthorityV1=authorityRoot=>/Audit_Litemode_v13(?:\/|$)/.test(String(authorityRoot??''));

export function boundReviewerLineupV13({root,authorityRoot}={}){
 if(!isV13AuthorityV1(authorityRoot))return null;
 if(!root)throw new Error('v13 reviewer mapping requires bound Audit-Controller root');
 const manifest=JSON.parse(fs.readFileSync(path.join(root,...authorityRoot.split('/'),'MANIFEST.json'),'utf8'));
 const lineup=manifest.reviewerLineup;
 if(manifest.release!=='Audit_Litemode_v13'||lineup?.schemaVersion!=='curveyield-v13-reviewer-lineup-v1')
   throw new Error('v13 role authority manifest is missing or mismatched');
 for(let n=1;n<=10;n++)if(!/^reviewer-[1-4]$/.test(lineup.phaseReviewers?.[String(n)]??''))
   throw new Error('missing bound v13 reviewer for phase '+n);
 if(!Array.isArray(lineup.masterSegments)||lineup.masterSegments.length!==4||
   lineup.discoveryAttacker!=='reviewer-3'||lineup.testExecutor!=='test-executor')
   throw new Error('invalid bound v13 segment and executor identities');
 return lineup;
}
export function boundReviewerForPhaseV1({root,authorityRoot,phase}={}){
 if(isV13AuthorityV1(authorityRoot))
   return boundReviewerLineupV13({root,authorityRoot}).phaseReviewers[String(phase)];
 const n=Number(phase);
 if(n===1)return 'reviewer-1';
 if(n>=2&&n<=5)return 'reviewer-2';
 if(n===6||n===7)return 'reviewer-3L';
 if(n>=8&&n<=10)return 'reviewer-4';
 throw new Error('unknown phase reviewer '+phase);
}
