import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { AUDIT_SCOPE_FILE, loadAuditScope, parseAuditScope, sourceIsInScope } from '../src/phase0-audit-scope-v1.mjs';

async function tempRoot(){return fs.mkdtemp(path.join(os.tmpdir(),'audit-scope-'));}

test('absent audit-scope.json keeps the historical contracts/ default',async()=>{
  const scope=await loadAuditScope(await tempRoot());
  assert.deepEqual(scope,{source:'default',inScopePaths:['contracts/']});
  assert.equal(sourceIsInScope('contracts/Vault.sol',scope),true);
  assert.equal(sourceIsInScope('upgrade/src/Vault.sol',scope),false);
  assert.equal(sourceIsInScope('@openzeppelin/contracts/token/ERC20/ERC20.sol',scope),false);
});

test('audit-scope.json selects exactly the declared in-scope paths',async()=>{
  const root=await tempRoot();
  await fs.writeFile(path.join(root,AUDIT_SCOPE_FILE),JSON.stringify({schemaVersion:'curveyield-audit-scope-v1',inScopePaths:['upgrade/src','./extra/One.sol']}));
  const scope=await loadAuditScope(root);
  assert.deepEqual(scope,{source:AUDIT_SCOPE_FILE,inScopePaths:['extra/One.sol','upgrade/src/']});
  assert.equal(sourceIsInScope('upgrade/src/router/Router.sol',scope),true);
  assert.equal(sourceIsInScope('upgrade/srcx/Other.sol',scope),false);
  assert.equal(sourceIsInScope('extra/One.sol',scope),true);
  assert.equal(sourceIsInScope('contracts/Vault.sol',scope),false);
  assert.equal(sourceIsInScope('ipor-fusion/contracts/vaults/PlasmaVault.sol',scope),false);
});

test('invalid audit-scope.json fails closed',()=>{
  assert.throws(()=>parseAuditScope('{'),/invalid JSON/);
  assert.throws(()=>parseAuditScope(JSON.stringify({schemaVersion:'x',inScopePaths:['a/']})),/schemaVersion/);
  assert.throws(()=>parseAuditScope(JSON.stringify({schemaVersion:'curveyield-audit-scope-v1',inScopePaths:[]})),/non-empty array/);
  assert.throws(()=>parseAuditScope(JSON.stringify({schemaVersion:'curveyield-audit-scope-v1',inScopePaths:['../x/']})),/unsafe/);
  assert.throws(()=>parseAuditScope(JSON.stringify({schemaVersion:'curveyield-audit-scope-v1',inScopePaths:['/abs/']})),/unsafe/);
});

test('Phase-0 Slither export marks dependencies through the audit scope',async()=>{
  const source=await fs.readFile(new URL('../src/lite-phase0-intelligence-v1.mjs',import.meta.url),'utf8');
  assert.match(source,/const scope=await loadAuditScope\(projectRoot\);/);
  assert.match(source,/is_dependency:sourceIsDependency\(sourceName,scope\)/);
  assert.match(source,/auditScope,/);
});
