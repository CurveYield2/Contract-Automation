import fs from 'node:fs/promises';
import path from 'node:path';
import { canonicalDigest } from './preflight/common-v1.mjs';
import { preflightCompileV1 } from './preflight/compile-v1.mjs';
import { digestDirectory } from './phase6-staged-snapshot-v1.mjs';
import { runProcess } from './execution.mjs';

const HARDHAT_CONFIGS = ['hardhat.config.js','hardhat.config.cjs','hardhat.config.mjs','hardhat.config.ts'];
const LOCKFILES = ['package-lock.json','npm-shrinkwrap.json'];
const SKIP_DIRS = new Set(['.git','node_modules','out','cache','artifacts','dist','build']);
const IMPORT_RE = /\bimport\s+(?:[^'";]*?\s+from\s+)?["']([^"']+)["']\s*;/g;
const DECLARATION_RE = /\b(?:(?:abstract)\s+)?(?:contract|library|interface)\s+([A-Za-z_][A-Za-z0-9_]*)\b/g;

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
function packageName(specifier){
  const parts=String(specifier).split('/').filter(Boolean);
  if(parts[0]?.startsWith('@')) return parts.length>=2?`${parts[0]}/${parts[1]}`:parts[0];
  return parts[0]??null;
}
async function readPackageJson(root){
  try { return JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8')); }
  catch { return null; }
}
function dependencyNames(pkg){return new Set(Object.keys({...pkg?.dependencies,...pkg?.devDependencies,...pkg?.peerDependencies,...pkg?.optionalDependencies}));}
async function resolveImport(root,record,remappings,{buildSystem,sourceFiles,declaredDependencies}){
  const spec=record.specifier;
  if(sourceFiles.has(spec)) return {resolved:true,candidate:spec,resolutionKind:'staged-source'};
  if(spec.startsWith('.')){
    const candidate=path.resolve(root,path.dirname(record.source),spec);
    return {resolved:await exists(candidate),candidate:path.relative(root,candidate).split(path.sep).join('/'),resolutionKind:'relative-source'};
  }
  const sorted=[...remappings].sort((a,b)=>b.prefix.length-a.prefix.length);
  const mapping=sorted.find(r=>spec.startsWith(r.prefix));
  if(mapping){
    const candidate=path.resolve(root,mapping.target,spec.slice(mapping.prefix.length));
    return {resolved:await exists(candidate),candidate:path.relative(root,candidate).split(path.sep).join('/'),remapping:`${mapping.prefix}=${mapping.target}`,resolutionKind:'foundry-remapping'};
  }
  if(buildSystem==='hardhat-native' || buildSystem==='mixed-native'){
    const dependency=packageName(spec);
    const declared=Boolean(dependency&&declaredDependencies.has(dependency));
    const npmCandidate=path.resolve(root,'node_modules',spec);
    return {resolved:declared||await exists(npmCandidate),candidate:path.relative(root,npmCandidate).split(path.sep).join('/'),dependency,dependencyDeclared:declared,resolutionKind:declared?'locked-package-declaration':'node-modules'};
  }
  return {resolved:false,candidate:spec,resolutionKind:'no-admitted-resolution'};
}
function requestedVersion(requested,language){return requested.find(x=>x?.language===language)?.version??null;}
function versionFromOutput(output){return String(output??'').match(/\b(\d+\.\d+\.\d+)\b/)?.[1]??null;}
async function safeCommand(runCommand,input){
  try {
    const result=await runCommand(input);
    return {exitCode:Number.isInteger(result?.exitCode)?result.exitCode:-1,stdout:String(result?.stdout??''),stderr:String(result?.stderr??''),threw:false};
  } catch(error) {
    return {exitCode:-1,stdout:'',stderr:error?.message??String(error),threw:true};
  }
}
function deriveExpectedArtifacts(solidityFiles,contents,vyperFiles){
  const artifacts=[];
  for(const file of solidityFiles){
    const text=contents.get(file)??''; DECLARATION_RE.lastIndex=0; let match;
    while((match=DECLARATION_RE.exec(text))) artifacts.push(`${file}:${match[1]}`);
  }
  for(const file of vyperFiles){
    const name=path.basename(file,'.vy');
    if(name) artifacts.push(`${file}:${name}`);
  }
  return [...new Set(artifacts)].sort();
}

export async function runTargetCompilePreflightV1({projectRoot,sourceSnapshotDigest=null,expectedSourceSnapshotDigest=null,requestedCompilers=[],optimizer=null,evmVersion=null,viaIR=false,expectedArtifacts=[]}={}, {runCommand=runProcess}={}) {
  if(typeof projectRoot!=='string'||projectRoot.length===0) throw new Error('Compile target preflight requires projectRoot');
  if(typeof runCommand!=='function') throw new Error('Compile target preflight requires runCommand');
  const observedSnapshot=await digestDirectory(projectRoot);
  const expectedSnapshot=expectedSourceSnapshotDigest??sourceSnapshotDigest??observedSnapshot.digestSha256;
  const files=await walk(projectRoot);
  const nestedManifests=files.filter(f=>f==='foundry.toml'||f.endsWith('/foundry.toml')||HARDHAT_CONFIGS.some(n=>f===n||f.endsWith(`/${n}`)));
  const hardhatConfig=await firstPresent(projectRoot,HARDHAT_CONFIGS);
  const foundryPresent=await exists(path.join(projectRoot,'foundry.toml'));
  const packageJson=await exists(path.join(projectRoot,'package.json'));
  const lockfile=await firstPresent(projectRoot,LOCKFILES);
  const packageData=packageJson?await readPackageJson(projectRoot):null;
  const declaredDependencies=dependencyNames(packageData);
  const solidityFiles=files.filter(f=>f.endsWith('.sol'));
  const vyperFiles=files.filter(f=>f.endsWith('.vy'));
  const rootManifest=hardhatConfig??(foundryPresent?'foundry.toml':null);
  const nestedBuildRootMismatch=!rootManifest&&nestedManifests.length>0;
  let buildSystem=hardhatConfig?'hardhat-native':foundryPresent?'foundry-native':'solc-standard-json';
  if(vyperFiles.length>0&&solidityFiles.length>0) buildSystem='mixed-native';
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
    const version=await safeCommand(runCommand,{command:'forge',args:['--version'],cwd:projectRoot});
    const remap=await safeCommand(runCommand,{command:'forge',args:['remappings'],cwd:projectRoot});
    remappingStrings.push(...parseForgeRemappings(remap.stdout));
    buildToolProbe={status:version.exitCode===0&&versionFromOutput(version.stdout)==='1.7.1'&&remap.exitCode===0?'PASS':'FAIL',tool:'forge',expectedVersion:'1.7.1',observedVersion:versionFromOutput(version.stdout),versionExitCode:version.exitCode,remappingsExitCode:remap.exitCode,stderr:[version.stderr,remap.stderr].filter(Boolean).join('\n')||null};
  } else if(hardhatConfig){
    buildToolProbe={status:packageJson&&Boolean(lockfile)?'PASS':'FAIL',tool:'hardhat',packageJson,lockfile,dependencyCount:declaredDependencies.size};
  }

  const contents=new Map();
  for(const file of solidityFiles) contents.set(file,await fs.readFile(path.join(projectRoot,file),'utf8'));
  const imports=importRecords(solidityFiles,contents);
  const remappings=[...new Map(remappingStrings.map(normalizeRemapping).filter(Boolean).map(r=>[`${r.prefix}=${r.target}`,r])).values()];
  const sourceFiles=new Set(files);
  const resolvedImports=[];
  for(const record of imports){const resolution=await resolveImport(projectRoot,record,remappings,{buildSystem,sourceFiles,declaredDependencies});resolvedImports.push({...record,...resolution});}
  const unresolvedImports=resolvedImports.filter(x=>!x.resolved);

  const languages=[];
  const requestedSolc=requestedVersion(requestedCompilers,'solidity');
  if(solidityFiles.length>0) languages.push({language:'solidity',requestedVersion:requestedSolc,installedVersion:manifestSettings.solcVersion});
  const requestedVyper=requestedVersion(requestedCompilers,'vyper');
  if(vyperFiles.length>0){
    let observed=null,probeStatus='FAIL',probeExitCode=-1,probeError=null;
    if(requestedVyper){const v=await safeCommand(runCommand,{command:'vyper',args:['--version'],cwd:projectRoot});observed=versionFromOutput(v.stdout);probeExitCode=v.exitCode;probeError=v.stderr||null;probeStatus=v.exitCode===0&&observed===requestedVyper?'PASS':'FAIL';}
    languages.push({language:'vyper',requestedVersion:requestedVyper,installedVersion:observed,probeStatus,probeExitCode,probeError});
  }

  const expectedSettings={optimizer,evmVersion,viaIR,solcVersion:requestedSolc};
  const observedSettings={optimizer:foundryPresent?{enabled:manifestSettings.optimizerEnabled,runs:manifestSettings.optimizerRuns}:optimizer,evmVersion:manifestSettings.evmVersion,viaIR:manifestSettings.viaIR,solcVersion:manifestSettings.solcVersion};
  const derivedArtifacts=deriveExpectedArtifacts(solidityFiles,contents,vyperFiles);
  const artifactInventory=Array.isArray(expectedArtifacts)&&expectedArtifacts.length>0?[...expectedArtifacts]:derivedArtifacts;
  const artifactSources=artifactInventory.map(x=>String(x).split(':')[0]);
  const missingArtifactSources=artifactSources.filter(source=>!files.includes(source));
  const rootManifestRequired=(foundryPresent||Boolean(hardhatConfig)||nestedManifests.length>0);

  const receipt=preflightCompileV1({
    sourceSnapshotDigest:observedSnapshot.digestSha256, expectedSourceSnapshotDigest:expectedSnapshot,
    projectRoot,projectRootExists:true,buildSystem,languages,
    buildManifest:{status:nestedBuildRootMismatch?'FAIL':'PASS',rootManifest:rootManifest??(rootManifestRequired?null:'intentional-solc-standard-json-root'),candidateManifests:nestedManifests,hardhatConfig,foundryPresent,packageJson,lockfile},
    buildToolProbe,
    importGraph:{status:unresolvedImports.length===0?'PASS':'FAIL',imports:resolvedImports,unresolvedImports,remappings:remappings.map(r=>`${r.prefix}=${r.target}`)},
    expectedCompilerSettingsDigest:canonicalDigest(expectedSettings),observedCompilerSettingsDigest:canonicalDigest(observedSettings),expectedSettings,observedSettings,
    expectedArtifacts:artifactInventory,missingArtifactSources,
  });
  return {
    ...receipt,
    snapshotBinding:{mode:expectedSourceSnapshotDigest||sourceSnapshotDigest?'EXPECTED_DIGEST':'EXACT_STAGED_OBSERVATION',expectedDigestSha256:expectedSnapshot,observedDigestSha256:observedSnapshot.digestSha256,fileCount:observedSnapshot.fileCount,totalBytes:observedSnapshot.totalBytes},
    buildView:{system:buildSystem,manifest:rootManifest,candidateManifests:nestedManifests,packageJson,lockfile,buildToolProbe,declaredDependencies:[...declaredDependencies].sort()},
    importGraph:{imports:resolvedImports,unresolvedImports,remappings:remappings.map(r=>`${r.prefix}=${r.target}`)},
    languageInventory:{solidity:solidityFiles,vyper:vyperFiles},
    artifactInventory:{source:'request-or-derived',expectedArtifacts:artifactInventory,derivedArtifacts,missingArtifactSources}
  };
}
