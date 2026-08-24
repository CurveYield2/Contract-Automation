import fs from 'node:fs/promises';
import path from 'node:path';
import { canonicalDigest } from './preflight/common-v1.mjs';
import { preflightCompileV1 } from './preflight/compile-v1.mjs';
import { digestDirectory } from './phase6-staged-snapshot-v1.mjs';

const HARDHAT_CONFIGS = ['hardhat.config.js','hardhat.config.cjs','hardhat.config.mjs','hardhat.config.ts'];
const LOCKFILES = ['package-lock.json','npm-shrinkwrap.json'];
const SKIP_DIRS = new Set(['.git','node_modules','out','cache','artifacts','dist','build']);
const IMPORT_RE = /\bimport\s+(?:[^'";]*?\s+from\s+)?["']([^"']+)["']\s*;/g;

async function exists(file) { try { return (await fs.stat(file)).isFile(); } catch { return false; } }
async function walk(root, current=root, out=[]) {
  for (const entry of await fs.readdir(current,{withFileTypes:true})) {
    if (entry.isDirectory() && SKIP_DIRS.has(entry.name)) continue;
    const absolute=path.join(current,entry.name);
    if (entry.isDirectory()) await walk(root,absolute,out);
    else if (entry.isFile()) out.push(path.relative(root,absolute).split(path.sep).join('/'));
  }
  return out;
}
async function firstPresent(root,names){for(const n of names) if(await exists(path.join(root,n))) return n; return null;}
function parseFoundryScalar(text,key){const m=text.match(new RegExp(`^\\s*${key}\\s*=\\s*["']?([^"'\\n#]+)["']?`,`m`));return m?.[1]?.trim()??null;}
function parseFoundryRemappings(text){
  const block=text.match(/remappings\s*=\s*\[([\s\S]*?)\]/m)?.[1]??'';
  return [...block.matchAll(/["']([^"']+=[^"']+)["']/g)].map(m=>m[1]);
}
function parseForgeRemappings(text){return String(text??'').split(/\r?\n/).map(x=>x.trim()).filter(x=>x.includes('='));}
function normalizeRemapping(value){const i=value.indexOf('=');if(i<1)return null;return{prefix:value.slice(0,i),target:value.slice(i+1)};}
function importRecords(files,contents){
  const out=[];
  for(const file of files.filter(f=>f.endsWith('.sol'))){
    const text=contents.get(file)??''; IMPORT_RE.lastIndex=0; let match;
    while((match=IMPORT_RE.exec(text))) out.push({source:file,specifier:match[1]});
  }
  return out;
}
async function resolveImport(root,record,remappings){
  const spec=record.specifier;
  if(spec.startsWith('.')){
    const candidate=path.resolve(root,path.dirname(record.source),spec);
    return {resolved:await exists(candidate),candidate:path.relative(root,candidate).split(path.sep).join('/')};
  }
  const sorted=[...remappings].sort((a,b)=>b.prefix.length-a.prefix.length);
  const mapping=sorted.find(r=>spec.startsWith(r.prefix));
  if(mapping){
    const candidate=path.resolve(root,mapping.target,spec.slice(mapping.prefix.length));
    return {resolved:await exists(candidate),candidate:path.relative(root,candidate).split(path.sep).join('/'),remapping:`${mapping.prefix}=${mapping.target}`};
  }
  const npmCandidate=path.resolve(root,'node_modules',spec);
  return {resolved:await exists(npmCandidate),candidate:path.relative(root,npmCandidate).split(path.sep).join('/')};
}
function requestedVersion(requested,language){return requested.find(x=>x?.language===language)?.version??null;}
function versionFromOutput(output){return String(output??'').match(/\b(\d+\.\d+\.\d+)\b/)?.[1]??null;}

export async function runTargetCompilePreflightV1({projectRoot,sourceSnapshotDigest,expectedSourceSnapshotDigest=sourceSnapshotDigest,requestedCompilers=[],optimizer=null,evmVersion=null,viaIR=false,expectedArtifacts=[]}={}, {runCommand}={}) {
  if(typeof projectRoot!=='string'||projectRoot.length===0) throw new Error('Compile target preflight requires projectRoot');
  if(typeof runCommand!=='function') throw new Error('Compile target preflight requires runCommand');
  const observedSnapshot=await digestDirectory(projectRoot);
  const files=await walk(projectRoot);
  const nestedManifests=files.filter(f=>f==='foundry.toml'||f.endsWith('/foundry.toml')||HARDHAT_CONFIGS.some(n=>f===n||f.endsWith(`/${n}`)));
  const hardhatConfig=await firstPresent(projectRoot,HARDHAT_CONFIGS);
  const foundryPresent=await exists(path.join(projectRoot,'foundry.toml'));
  const packageJson=await exists(path.join(projectRoot,'package.json'));
  const lockfile=await firstPresent(projectRoot,LOCKFILES);
  const solidityFiles=files.filter(f=>f.endsWith('.sol'));
  const vyperFiles=files.filter(f=>f.endsWith('.vy'));
  const rootManifest=hardhatConfig??(foundryPresent?'foundry.toml':null);
  const nestedBuildRootMismatch=!rootManifest&&nestedManifests.length>0;
  let buildSystem=hardhatConfig?'hardhat-native':foundryPresent?'foundry-native':'solc-standard-json';
  if(vyperFiles.length>0&&solidityFiles.length>0) buildSystem=hardhatConfig?'mixed-native':foundryPresent?'mixed-native':'mixed-native';
  else if(vyperFiles.length>0&&solidityFiles.length===0) buildSystem='vyper-native';

  let manifestSettings={optimizer,evmVersion,viaIR,solcVersion:requestedVersion(requestedCompilers,'solidity')};
  let remappingStrings=[];
  let buildToolProbe={status:'PASS',tool:buildSystem};
  if(foundryPresent){
    const text=await fs.readFile(path.join(projectRoot,'foundry.toml'),'utf8');
    remappingStrings.push(...parseFoundryRemappings(text));
    manifestSettings={
      optimizerRuns:Number(parseFoundryScalar(text,'optimizer_runs')??optimizer?.runs??0),
      optimizerEnabled:(parseFoundryScalar(text,'optimizer')??String(optimizer?.enabled??true))!=='false',
      evmVersion:parseFoundryScalar(text,'evm_version')??evmVersion,
      viaIR:(parseFoundryScalar(text,'via_ir')??String(viaIR))==='true',
      solcVersion:parseFoundryScalar(text,'solc_version')??requestedVersion(requestedCompilers,'solidity'),
    };
    const version=await runCommand({command:'forge',args:['--version'],cwd:projectRoot});
    const remap=await runCommand({command:'forge',args:['remappings'],cwd:projectRoot});
    remappingStrings.push(...parseForgeRemappings(remap.stdout));
    buildToolProbe={status:version.exitCode===0&&versionFromOutput(version.stdout)==='1.7.1'&&remap.exitCode===0?'PASS':'FAIL',tool:'forge',expectedVersion:'1.7.1',observedVersion:versionFromOutput(version.stdout),remappingsExitCode:remap.exitCode};
  } else if(hardhatConfig){
    buildToolProbe={status:packageJson&&Boolean(lockfile)?'PASS':'FAIL',tool:'hardhat',packageJson,lockfile};
  }

  const contents=new Map();
  for(const file of solidityFiles) contents.set(file,await fs.readFile(path.join(projectRoot,file),'utf8'));
  const imports=importRecords(solidityFiles,contents);
  const remappings=[...new Map(remappingStrings.map(normalizeRemapping).filter(Boolean).map(r=>[`${r.prefix}=${r.target}`,r])).values()];
  const resolvedImports=[];
  for(const record of imports){const resolution=await resolveImport(projectRoot,record,remappings);resolvedImports.push({...record,...resolution});}
  const unresolvedImports=resolvedImports.filter(x=>!x.resolved);

  const languages=[];
  const requestedSolc=requestedVersion(requestedCompilers,'solidity');
  if(solidityFiles.length>0) languages.push({language:'solidity',requestedVersion:requestedSolc,installedVersion:manifestSettings.solcVersion});
  const requestedVyper=requestedVersion(requestedCompilers,'vyper');
  if(vyperFiles.length>0){
    let observed=null,probeStatus='FAIL';
    if(requestedVyper){const v=await runCommand({command:'vyper',args:['--version'],cwd:projectRoot});observed=versionFromOutput(v.stdout);probeStatus=v.exitCode===0&&observed===requestedVyper?'PASS':'FAIL';}
    languages.push({language:'vyper',requestedVersion:requestedVyper,installedVersion:observed,probeStatus});
  }

  const expectedSettings={optimizer,evmVersion,viaIR,solcVersion:requestedSolc};
  const observedSettings={optimizer:foundryPresent?{enabled:manifestSettings.optimizerEnabled,runs:manifestSettings.optimizerRuns}:optimizer,evmVersion:manifestSettings.evmVersion,viaIR:manifestSettings.viaIR,solcVersion:manifestSettings.solcVersion};
  const artifactSources=expectedArtifacts.map(x=>String(x).split(':')[0]);
  const missingArtifactSources=artifactSources.filter(source=>!files.includes(source));

  const receipt=preflightCompileV1({
    sourceSnapshotDigest:observedSnapshot.digestSha256, expectedSourceSnapshotDigest,
    projectRoot,projectRootExists:true,buildSystem,languages,
    buildManifest:{status:nestedBuildRootMismatch?'FAIL':'PASS',rootManifest,candidateManifests:nestedManifests,hardhatConfig,foundryPresent,packageJson,lockfile},
    buildToolProbe,
    importGraph:{status:unresolvedImports.length===0?'PASS':'FAIL',imports:resolvedImports,unresolvedImports,remappings:remappings.map(r=>`${r.prefix}=${r.target}`)},
    expectedCompilerSettingsDigest:canonicalDigest(expectedSettings),observedCompilerSettingsDigest:canonicalDigest(observedSettings),expectedSettings,observedSettings,
    expectedArtifacts,missingArtifactSources,
  });
  return {...receipt,buildView:{system:buildSystem,manifest:rootManifest,candidateManifests:nestedManifests,packageJson,lockfile,buildToolProbe},importGraph:{imports:resolvedImports,unresolvedImports,remappings:remappings.map(r=>`${r.prefix}=${r.target}`)},languageInventory:{solidity:solidityFiles,vyper:vyperFiles}};
}
