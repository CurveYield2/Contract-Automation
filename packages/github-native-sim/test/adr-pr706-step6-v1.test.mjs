import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {isLiteralConstantV13} from '../src/adr-discovery-validators-v1.mjs';
import {sourceBoundAutoAdjudicationsV13} from '../src/adr-private-source-match-v1.mjs';
import {independentSpecItemsV13} from '../src/adr-independent-spec-v1.mjs';
import {extractCampaignFindingsV13} from '../../../scripts/adr-v13-findings-from-campaign-v1.mjs';
import {scanV13AnswerKeyLeakV1} from '../../../scripts/adr-v13-private-leak-check-v1.mjs';
import {reviewUnitCommitIntervalsV1} from '../../../scripts/adr-v13-unit-depth-review-v1.mjs';
const campaign='campaigns/v13-fixture r1';
const rootFile=(root,rel)=>path.join(root,...rel.split('/'));
function put(root,rel,content){
 const dest=rootFile(root,rel);
 fs.mkdirSync(path.dirname(dest),{recursive:true});
 fs.writeFileSync(dest,typeof content==='string'?content:JSON.stringify(content,null,2)+'\n');
}
function fixture(fn){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'pr706-step6-'));
 try{return fn(root);}finally{fs.rmSync(root,{recursive:true,force:true});}
}
test('v13 trivial shortcuts permit anchored literal constants only, never getters, immutables or state initializers',()=>{
 const c={kind:'CONSTANT',declaredValue:'3600',lineStart:11,lineEnd:11};
 assert.equal(isLiteralConstantV13(c),true);
 for(const kind of ['GENERATED_GETTER','IMMUTABLE','STATE_INITIALIZER','FUNCTION'])
  assert.equal(isLiteralConstantV13({...c,kind}),false,kind);
 for(const val of ['readOwner()','_owner','msg.sender','42 + offset','UNINITIALIZED'])
  assert.equal(isLiteralConstantV13({...c,declaredValue:val}),false,val);
 assert.equal(isLiteralConstantV13({...c,lineStart:0}),false);
});
test('v13 packet extracts actual independent rule evidence and distinguishes observed storage constants',()=>fixture(root=>{
 const source=campaign+'/source';
 put(root,source+'/contracts/Vault.sol',[
  'contract Vault {','  // setFee must only be allowed to owner',
  '  function setFee(uint256 bps) external {','    fee = bps;','  }','}'].join('\n'));
 put(root,source+'/README.md','The setFee function must not exceed maximum annual rate.\n');
 const ctx={kind:'FUNCTION',contextId:'CTX-A',path:'contracts/Vault.sol',
  canonicalSignature:'setFee(uint256)',lineStart:3,lineEnd:5,qualifiedContainer:'contracts/Vault.sol:Vault'};
 const out=independentSpecItemsV13({root,campaignPath:campaign,context:ctx,otherContexts:[
  {contextId:'CTX-B',kind:'CONSTANT',qualifiedContainer:'contracts/Other.sol:Other',
    canonicalSignature:'MAX_FEE',declaredValue:'5000',path:'contracts/Other.sol',lineStart:4}
 ]});
 assert.ok(out.documentationItems.some(x=>x.type==='SOURCE_COMMENT'));
 assert.ok(out.documentationItems.some(x=>x.type==='README_OR_DOC'));
 assert.ok(out.referenceConstants.every(x=>x.note.includes('not an independent specification')));
 assert.equal(out.missingSource,false);
}));
test('private source-bound scorer ignores reviewer truth labels, rejects wrong source/class and isolates ambiguous cases',()=>{
 const truth=[
  {caseId:'CASE-A',kind:'defect',classId:'ACCESS_CONTROL',contract:'contracts/Vault.sol:Vault',
   anchors:['contracts/Vault.sol:L11-L15']},
  {caseId:'CASE-B',kind:'defect',classId:'ACCOUNTING_MATH',contract:'contracts/Vault.sol:Vault',
   anchors:['contracts/Vault.sol:L20-L23']}
 ];
 const mk=(id,cls,anchor,caseRefs=['CASE-B'])=>({findingId:id,classId:cls,
  contract:'contracts/Vault.sol:Vault',anchors:[anchor],severity:'HIGH',caseRefs});
 const result=sourceBoundAutoAdjudicationsV13({truth,findings:[
  mk('A','ACCESS_CONTROL','contracts/Vault.sol:L12-L13'),
  mk('B','ACCESS_CONTROL','contracts/Vault.sol:L20-L21'),
  mk('C','ACCESS_CONTROL','contracts/Other.sol:L12-L13')
 ]});
 assert.deepEqual(result.adjudications.map(x=>[x.findingId,x.caseId]),[['A','CASE-A']]);
 assert.deepEqual(result.findings.map(x=>x.caseRefs),[['CASE-A'],[],[]]);
 assert.equal(result.matchedCount,1);
 assert.throws(()=>sourceBoundAutoAdjudicationsV13({truth:[{...truth[0],anchors:[]}],findings:[]}),
  /source path, ranges/);
 const duplicated=[truth[0],{...truth[0],caseId:'CASE-D'}];
 const unclear=sourceBoundAutoAdjudicationsV13({truth:duplicated,findings:[
  mk('D','ACCESS_CONTROL','contracts/Vault.sol:L13')]});
 assert.equal(unclear.matchedCount,0);
 assert.equal(unclear.ambiguous.length,1);
});
test('private real-campaign projection uses accepted candidate evidence and invents no seeded case IDs',()=>fixture(root=>{
 const inv={campaignId:'v13-fixture-r1',sourceSha256:'a'.repeat(64),payload:{
  contexts:[{contextId:'CTX-A',path:'contracts/Vault.sol',
   qualifiedContainer:'contracts/Vault.sol:Vault'}]}};
 put(root,campaign+'/evidence/review-inventory/REVIEW_INVENTORY_v1.json',inv);
 put(root,campaign+'/work/phase-04/discovery/F-001/ACCEPTED_SUBMISSION_v1.json',{
  rows:[{contextId:'CTX-A',candidate:{classId:'ACCESS_CONTROL',severity:'HIGH',
   title:'Unauthorized setter',description:'Missing caller guard',
   anchors:['contracts/Vault.sol:L12-L13']}}]});
 const x=extractCampaignFindingsV13({controllerRoot:root,campaignPath:campaign});
 assert.equal(x.findings.length,1);
 assert.equal(x.findings[0].classId,'ACCESS_CONTROL');
 assert.deepEqual(x.findings[0].caseRefs,[]);
 assert.equal(x.findings[0].contract,'contracts/Vault.sol:Vault');
}));
test('private answer-key leak scan finds hidden markers without returning case IDs or paths',()=>fixture(root=>{
 put(root,'reviewable/WAKE_v1.md','General assignment and source anchors only');
 const manifest={schemaVersion:'curveyield-private-seeded-truth-v1',cases:[
  {caseId:'SENSITIVE-CASE-0001',kind:'defect',classId:'A'}]};
 const safe=scanV13AnswerKeyLeakV1({manifest,roots:[rootFile(root,'reviewable')]});
 assert.equal(safe.safeToPublish,true);
 put(root,'reviewable/ASSIGNMENT_v1.json','{"token":"SENSITIVE-CASE-0001"}');
 const leaked=scanV13AnswerKeyLeakV1({manifest,roots:[rootFile(root,'reviewable')]});
 assert.equal(leaked.safeToPublish,false);
 assert.equal(leaked.leakingFileCount,1);
 assert.ok(!JSON.stringify(leaked).includes('SENSITIVE-CASE-0001'));
}));
test('v13 independent unit clock uses exact per-unit Git commits, not shared window openedAt',()=>fixture(root=>{
 const base=campaign+'/work/phase-04/discovery/F-001/';
 put(root,base+'ASSIGNMENT_PACKET_v1.json',{openedAt:'2026-01-01'});
 put(root,base+'ACCEPTED_SUBMISSION_v1.json',{acceptedAt:'2026-12-31'});
 const clock=(_r,rel)=>rel.endsWith('/ASSIGNMENT_PACKET_v1.json')?
  {epoch:1000,commit:'a'.repeat(40)}:{epoch:1040,commit:'b'.repeat(40)};
 const out=reviewUnitCommitIntervalsV1({root,campaignPath:campaign,clock});
 assert.equal(out.units[0].elapsedSeconds,40);
 assert.equal(out.units[0].status,'DEPTH_SPOTCHECK_REQUIRED');
 assert.equal(out.masterReviewRequired,true);
 assert.equal(out.qualification,'UNQUALIFIED');
}));
