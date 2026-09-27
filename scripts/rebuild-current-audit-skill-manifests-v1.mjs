#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const packageRoot = path.resolve('Audit Skill - Current Authority/Audit_V7_independent_Review_skill_v38');
const liteRoot = path.join(packageRoot, 'optional-modes/lite-pathway');

function sha256(file) {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}
function listFiles(root, excludedAbsolute) {
  const out=[];
  function walk(dir) {
    for (const ent of fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))) {
      const abs=path.join(dir,ent.name);
      if(ent.isDirectory()) walk(abs);
      else if(ent.isFile() && path.resolve(abs)!==path.resolve(excludedAbsolute)) out.push(abs);
    }
  }
  walk(root);
  return out;
}
function fileEntry(abs) {
  const rel=path.relative(packageRoot,abs).split(path.sep).join('/');
  const st=fs.statSync(abs);
  return {path:rel,bytes:st.size,sha256:sha256(abs)};
}
function rebuildManifest(manifestPath, scanRoot) {
  const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
  manifest.files=listFiles(scanRoot,manifestPath).map(fileEntry);
  fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');
  return {manifest:path.relative(packageRoot,manifestPath).split(path.sep).join('/'),fileCount:manifest.files.length,sha256:sha256(manifestPath)};
}

// Nested Lite manifest must be regenerated first because the root manifest records its bytes/hash.
const liteResult=rebuildManifest(path.join(liteRoot,'MANIFEST.json'),liteRoot);
const rootResult=rebuildManifest(path.join(packageRoot,'MANIFEST.json'),packageRoot);

process.stdout.write(JSON.stringify({status:'PASS',lite:liteResult,root:rootResult},null,2)+'\n');
