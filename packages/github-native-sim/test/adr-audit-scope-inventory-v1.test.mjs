import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {sourceTierV1,applyAuditScopeToInventoryV1,reviewInventoryRelV1,buildReviewInventoryV1,writeReviewInventoryOutputsV1} from '../src/adr-review-inventory-v1.mjs';
import {parseAuditScope} from '../src/phase0-audit-scope-v1.mjs';

const scope=parseAuditScope(JSON.stringify({schemaVersion:'curveyield-audit-scope-v1',inScopePaths:['upgrade/src/']}));

test('audit-scope.json decides scope; scripts, tests and nested lib/ never count as in scope', () => {
  assert.equal(sourceTierV1('upgrade/src/governance/Gate.sol',scope),'IN_SCOPE');
  assert.equal(sourceTierV1('ipor-fusion/contracts/vaults/PlasmaVault.sol',scope),'DEPENDENCY');
  assert.equal(sourceTierV1('deployed/phase1-controller/Controller.sol',scope),'DEPENDENCY');
  assert.equal(sourceTierV1('upgrade/internal/P5_01_DeployPol.s.sol',scope),'SCRIPT');
  assert.equal(sourceTierV1('ipor-fusion/lib/forge-std/src/Test.sol',null),'DEPENDENCY');
  assert.equal(sourceTierV1('ipor-fusion/contracts/vaults/PlasmaVault.sol',null),'IN_SCOPE');
  assert.equal(sourceTierV1('src/Foo.t.sol',scope),'TEST_OR_MOCK');
});

test('re-scoping keeps in-scope contexts and only inherited dependency entry points', () => {
  const ctx=(id,p,kind,extra={})=>({contextId:id,path:p,qualifiedContainer:p+':C',kind,visibility:'external',effectiveIn:[p+':C'],scopeTier:'IN_SCOPE',...extra});
  const inventory={schemaVersion:'curveyield-review-inventory-v1',payload:{
    sourceUnits:[{path:'upgrade/src/A.sol',astStatus:'AVAILABLE'},{path:'ipor-fusion/contracts/B.sol',astStatus:'AVAILABLE'},{path:'deployed/D.sol',astStatus:'MISSING'}],
    contexts:[ctx('CTX-A','upgrade/src/A.sol','FUNCTION'),
      ctx('CTX-B1','ipor-fusion/contracts/B.sol','FUNCTION',{effectiveIn:['ipor-fusion/contracts/B.sol:C','upgrade/src/A.sol:C']}),
      ctx('CTX-B2','ipor-fusion/contracts/B.sol','FUNCTION'),ctx('CTX-D','deployed/D.sol','FILE_FALLBACK')],
    triggers:{'CTX-A':['X'],'CTX-B2':['Y']},
    limitations:[{code:'INVENTORY_INCOMPLETE',path:'deployed/D.sol'},{code:'DEPENDENCY_TIER_BY_PATH',path:'*'}],complete:false,counts:{}}};
  const out=applyAuditScopeToInventoryV1({inventory,scope}).payload;
  assert.deepEqual(out.contexts.map(c=>[c.contextId,c.scopeTier]),[['CTX-A','IN_SCOPE'],['CTX-B1','INHERITED_DEPENDENCY']]);
  assert.deepEqual(Object.keys(out.triggers),['CTX-A']);
  assert.equal(out.complete,true);
  assert.equal(out.limitations[0].code,'SCOPE_FROM_AUDIT_SCOPE_FILE');
  assert.ok(!out.limitations.some(l=>l.code==='INVENTORY_INCOMPLETE'));
});

test('readers prefer a scope-corrected copy and leave the sealed file untouched', () => {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'scope-'));
  try{
    assert.equal(reviewInventoryRelV1(root,'campaigns/c','FLOW_PLAN_v1.json'),'campaigns/c/evidence/review-inventory/FLOW_PLAN_v1.json');
    fs.mkdirSync(path.join(root,'campaigns/c/evidence/review-inventory/scope-corrected'),{recursive:true});
    fs.writeFileSync(path.join(root,'campaigns/c/evidence/review-inventory/scope-corrected/FLOW_PLAN_v1.json'),'{}');
    assert.equal(reviewInventoryRelV1(root,'campaigns/c','FLOW_PLAN_v1.json'),'campaigns/c/evidence/review-inventory/scope-corrected/FLOW_PLAN_v1.json');
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('v13 reviews deploy scripts unless explicitly excluded, regardless of src-only scope',()=>{
 const policyScope=parseAuditScope(JSON.stringify({schemaVersion:'curveyield-audit-scope-v1',
  inScopePaths:['upgrade/src/'],excludedPaths:['upgrade/script/skip.s.sol']}));
 assert.equal(sourceTierV1('upgrade/script/deploy.s.sol',policyScope),'SCRIPT');
 assert.equal(sourceTierV1('upgrade/script/deploy.s.sol',policyScope,{includeScripts:true}),'IN_SCOPE');
 assert.equal(sourceTierV1('upgrade/script/skip.s.sol',policyScope,{includeScripts:true}),'SCRIPT');
 assert.equal(sourceTierV1('upgrade/src/Vault.sol',policyScope,{includeScripts:true}),'IN_SCOPE');
 assert.equal(sourceTierV1('vendor/script/thirdparty.s.sol',policyScope,{includeScripts:true}),'IN_SCOPE');
});
test('v13 adds text deploy/config scripts as residual review units while v12 does not',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'script-inventory-'));
 try{
  fs.mkdirSync(path.join(root,'upgrade/script'),{recursive:true});
  fs.writeFileSync(path.join(root,'upgrade/script/deploy.ts'),'const owner = "wrong";\n');
  fs.writeFileSync(path.join(root,'upgrade/script/skip.ts'),'const ignored = true;\n');
  fs.writeFileSync(path.join(root,'audit-scope.json'),JSON.stringify({schemaVersion:'curveyield-audit-scope-v1',
   inScopePaths:['upgrade/src/'],excludedPaths:['upgrade/script/skip.ts']}));
  const campaign={campaignId:'fixture',campaignGenerationId:'fixture-r1',sourceSha256:'a'.repeat(64)};
  const legacy=await buildReviewInventoryV1({projectRoot:root,build:{sourceAsts:{}},campaign});
  assert.ok(!legacy.payload.contexts.some(c=>c.path==='upgrade/script/deploy.ts'));
  const v13=await buildReviewInventoryV1({projectRoot:root,build:{sourceAsts:{}},
   campaign:{...campaign,detectionReviewPolicy:'correctness-verdict-v13'}});
  assert.equal(v13.payload.contexts.find(c=>c.path==='upgrade/script/deploy.ts').kind,'SCRIPT_FILE');
  assert.ok(!v13.payload.contexts.some(c=>c.path==='upgrade/script/skip.ts'));
  assert.equal(v13.payload.sourceUnits.find(s=>s.path==='upgrade/script/deploy.ts').scopeTier,'IN_SCOPE');
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('Phase-0 intelligence writer activates script units only under verified v13 review policy',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'phase0-script-policy-'));
 try{
  fs.mkdirSync(path.join(root,'upgrade/script'),{recursive:true});
  fs.writeFileSync(path.join(root,'upgrade/script/configure.ts'),'const requiredAdmin = "0x0";\n');
  fs.writeFileSync(path.join(root,'audit-scope.json'),JSON.stringify({
   schemaVersion:'curveyield-audit-scope-v1',inScopePaths:['upgrade/src/']}));
  const request={campaignId:'demo-r1',campaignGenerationId:'demo-r1-g1',
   source:{archiveSha256:'a'.repeat(64)}};
  const out=path.join(root,'out-policy');
  await writeReviewInventoryOutputsV1({projectRoot:root,outputDir:out,build:{sourceAsts:{}},
   request,policy:'audit-detection-rebuild-v1',reviewPolicy:'correctness-verdict-v13'});
  const written=JSON.parse(fs.readFileSync(path.join(out,'REVIEW_INVENTORY_v1.json'),'utf8'));
  assert.ok(written.payload.contexts.some(c=>c.path==='upgrade/script/configure.ts'&&c.kind==='SCRIPT_FILE'));
  const legacy=path.join(root,'out-legacy');
  await writeReviewInventoryOutputsV1({projectRoot:root,outputDir:legacy,build:{sourceAsts:{}},
   request,policy:'audit-detection-rebuild-v1'});
  const frozen=JSON.parse(fs.readFileSync(path.join(legacy,'REVIEW_INVENTORY_v1.json'),'utf8'));
  assert.ok(!frozen.payload.contexts.some(c=>c.path==='upgrade/script/configure.ts'));
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
