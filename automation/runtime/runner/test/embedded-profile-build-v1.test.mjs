import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {detectEmbeddedProfileBuild} from '../src/embedded-profile-build-v1.mjs';

test('embedded profile build detection requires the package compiler contract and lockfile',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'embedded-profile-build-'));
  try{
    await fs.mkdir(path.join(root,'tooling','lib'),{recursive:true});
    await fs.writeFile(path.join(root,'tooling','lib','compileSolc.mjs'),'export const COMPILER_PROFILES = {};\n');
    await fs.writeFile(path.join(root,'tooling','lib','deploymentSet.mjs'),'export const COMPILE_GROUPS = [];\n');
    await fs.writeFile(path.join(root,'package.json'),'{}\n');
    await fs.writeFile(path.join(root,'package-lock.json'),'{}\n');
    assert.equal((await detectEmbeddedProfileBuild(root)).system,'embedded-profile-native');
    await fs.rm(path.join(root,'tooling','lib','deploymentSet.mjs'));
    assert.equal((await detectEmbeddedProfileBuild(root)).system,null);
  }finally{
    await fs.rm(root,{recursive:true,force:true});
  }
});

test('build dispatch prefers embedded profile compiler contract over generic Hardhat classification',()=>{
  const here=path.dirname(fileURLToPath(import.meta.url));
  return fs.readFile(path.resolve(here,'../src/build-dispatch.mjs'),'utf8').then(source=>{
    const embedded=source.indexOf("embedded.system === 'embedded-profile-native'");
    const hardhat=source.indexOf("detected.system === 'hardhat-native'");
    assert.ok(embedded>=0);
    assert.ok(hardhat>embedded);
    assert.match(source,/compileRepoEmbeddedProfiles/);
  });
});

test('embedded profile adapter preserves compilation units, exact settings and compiler-specific artifacts',()=>{
  const here=path.dirname(fileURLToPath(import.meta.url));
  return fs.readFile(path.resolve(here,'../src/embedded-profile-build-v1.mjs'),'utf8').then(source=>{
    assert.match(source,/compileDeploymentSet/);
    assert.match(source,/COMPILER_PROFILES/);
    assert.match(source,/profile\.solc/);
    assert.match(source,/compilationUnitId/);
    assert.match(source,/storageLayout/);
    assert.match(source,/evm\.bytecode\.linkReferences/);
    assert.match(source,/compilerProfiles/);
    assert.match(source,/system:'embedded-profile-native'/);
  });
});
