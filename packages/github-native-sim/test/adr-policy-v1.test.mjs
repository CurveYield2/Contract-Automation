import {test} from 'node:test';
import assert from 'node:assert/strict';
import {detectionPolicyForAuthorityV1, authorityRootFromHomepageV1} from '../src/adr-policy-v1.mjs';

const authorityRoot='Audit Skill - Current Authority/Audit_Litemode_v12';
const invoke = (manifest) => detectionPolicyForAuthorityV1({
  repoRoot:'/',
  authorityRoot,
  readJsonIfExists:(path)=> {
    assert.equal(path,authorityRoot+'/MANIFEST.json');
    return manifest;
  }
});

test('explicit bound v12 detectionPolicy opts in',()=>{
  assert.equal(invoke({detectionPolicy:'audit-detection-rebuild-v1'}),'audit-detection-rebuild-v1');
});
test('legacy authorities remain on the old path',()=>{
  assert.equal(invoke({schemaVersion:'legacy'}),null);
});
test('missing authority manifest does not opt in',()=>{
  assert.equal(invoke(null),null);
});
test('homepage resolution requires SKILL.md',()=>{
  assert.equal(authorityRootFromHomepageV1(authorityRoot+'/SKILL.md'),authorityRoot);
  assert.throws(()=>authorityRootFromHomepageV1(authorityRoot+'/README.md'));
});
