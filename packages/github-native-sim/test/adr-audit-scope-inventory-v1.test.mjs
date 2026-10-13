import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {sourceTierV1,applyAuditScopeToInventoryV1,reviewInventoryRelV1} from '../src/adr-review-inventory-v1.mjs';
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
