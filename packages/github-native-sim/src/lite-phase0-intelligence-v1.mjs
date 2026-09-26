#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import unzipper from 'unzipper';
import { checkoutExactSource, runProcess } from './execution.mjs';
import { buildProject } from '../../runner/src/build-dispatch.mjs';
import { runSlitherAnalysis } from './analysis.mjs';
import { generateBuildSbomV1 } from './sbom-v1.mjs';
import { generateSourceIntelligenceTechnicalBundleV1 } from './source-intelligence-technical-v1.mjs';

function parseArgs(argv){const o={};for(let i=0;i<argv.length;i++){const t=argv[i];if(!t.startsWith('--'))continue;const k=t.slice(2);const n=argv[i+1];if(n!==undefined&&!n.startsWith('--')){o[k]=n;i++;}else o[k]=true;}return o;}
function sha256(bytes){return createHash('sha256').update(bytes).digest('hex');}
function safeRel(v,label){if(typeof v!=='string'||!v||v.startsWith('/')||v.includes('\\')||v.split('/').some(p=>!p||p==='.'||p==='..'))throw new Error(`${label} must be a safe repository-relative path`);return v;}
function cleanText(v){return String(v??'').replace(/\u001b\[[0-9;]*m/g,'');}
async function exists(file){try{return(await fs.stat(file)).isFile();}catch{return false;}}
async function isDir(file){try{return(await fs.stat(file)).isDirectory();}catch{return false;}}
function archiveEntryIsSymlink(entry){const attrs=Number(entry?.vars?.externalFileAttributes??0);const unix=(attrs>>>16)&0xffff;return(unix&0o170000)===0o120000;}
function archiveRel(p){const n=String(p??'').replaceAll('\\','/');const dir=n.endsWith('/');const t=dir?n.slice(0,-1):n;if(!t||t.startsWith('/')||/^[A-Za-z]:\//.test(t))throw new Error(`unsafe archive entry ${p}`);const parts=t.split('/');if(parts.some(x=>!x||x==='.'||x==='..'))throw new Error(`unsafe archive entry ${p}`);return{relative:parts.join('/'),dir};}

async function extractArchive(zipPath, out){
  const opened=await unzipper.Open.file(zipPath);
  await fs.rm(out,{recursive:true,force:true});
  await fs.mkdir(out,{recursive:true});
  let bytes=0;
  for(const entry of opened.files){
    if(archiveEntryIsSymlink(entry))throw new Error(`symlink archive entry forbidden: ${entry.path}`);
    const p=archiveRel(entry.path); const dest=path.join(out,...p.relative.split('/'));
    if(p.dir||entry.type==='Directory'){await fs.mkdir(dest,{recursive:true});continue;}
    const data=await entry.buffer(); bytes+=data.length;
    if(bytes>250*1024*1024)throw new Error('archive extracted bytes exceed safety cap');
    await fs.mkdir(path.dirname(dest),{recursive:true}); await fs.writeFile(dest,data);
  }
  return{entryCount:opened.files.length,extractedBytes:bytes};
}

async function walk(root){
  const files=[];
  async function rec(dir){
    for(const e of await fs.readdir(dir,{withFileTypes:true})){
      if(['node_modules','.git','artifacts','cache','out','dist','build'].includes(e.name))continue;
      const abs=path.join(dir,e.name);
      const rel=path.relative(root,abs).split(path.sep).join('/');
      if(rel.split('/').some(x=>x.toUpperCase()==='ARCHIVE DO NOT USE'))continue;
      if(e.isDirectory())await rec(abs); else if(e.isFile())files.push(rel);
    }
  }
  await rec(root); return files.sort();
}

async function detectProjectRoot(extractRoot){
  const files=await walk(extractRoot);
  const candidates=new Set();
  for(const f of files){
    if(/(^|\/)package\.json$/.test(f)||/(^|\/)package-lock\.json$/.test(f)||/(^|\/)hardhat\.config\.(?:js|cjs|mjs|ts)$/.test(f)){
      candidates.add(path.posix.dirname(f));
    }
    const m=f.match(/^(.*?)(?:\/contracts\/|\/src\/).+\.sol$/);
    if(m)candidates.add(m[1]||'.');
  }
  const scored=[];
  for(const rel0 of candidates){
    const rel=rel0==='.'?'':rel0;
    if(rel.toUpperCase().includes('ARCHIVE DO NOT USE'))continue;
    const prefix=rel?rel+'/':'';
    const child=files.filter(f=>f.startsWith(prefix));
    const sol=child.filter(f=>f.endsWith('.sol')).length;
    if(sol===0)continue;
    const names=new Set(child.filter(f=>!f.slice(prefix.length).includes('/')).map(f=>f.slice(prefix.length)));
    const hasPkg=names.has('package.json');
    const hasLock=names.has('package-lock.json');
    const hasHardhat=[...names].some(n=>/^hardhat\.config\.(js|cjs|mjs|ts)$/.test(n));
    const hasContracts=child.some(f=>f.startsWith(prefix+'contracts/'));
    const hasTooling=child.some(f=>f.startsWith(prefix+'tooling/'));
    const hasVendor=child.some(f=>f.startsWith(prefix+'vendor/'));
    const depth=rel?rel.split('/').length:0;
    const score=(hasPkg?120:0)+(hasLock?110:0)+(hasContracts?100:0)+(hasHardhat?70:0)+(hasTooling?60:0)+(hasVendor?40:0)+Math.min(sol,80)-depth;
    scored.push({relativePath:rel||'.',score,solidityFiles:sol,hasPkg,hasLock,hasHardhat,hasContracts,hasTooling,hasVendor});
  }
  scored.sort((a,b)=>b.score-a.score||b.solidityFiles-a.solidityFiles||a.relativePath.localeCompare(b.relativePath));
  if(!scored.length)throw new Error('unable to detect Solidity project root from archive');
  const winner=scored[0];
  if(scored[1]&&winner.score===scored[1].score&&winner.solidityFiles===scored[1].solidityFiles)throw new Error(`ambiguous project root: ${winner.relativePath} vs ${scored[1].relativePath}`);
  const absolute=winner.relativePath==='.'?extractRoot:path.join(extractRoot,...winner.relativePath.split('/'));
  return{absolute,relativePath:winner.relativePath,candidates:scored.slice(0,10)};
}

async function readMaybe(file){try{return await fs.readFile(file,'utf8');}catch{return'';}}
function exactSemver(v){const m=String(v??'').match(/(?:^|[^0-9])(\d+\.\d+\.\d+)(?:[^0-9]|$)/);return m?.[1]??null;}
async function detectBuildConfig(projectRoot){
  const evidence=[];
  let pkg={},lock={};
  const pkgPath=path.join(projectRoot,'package.json'), lockPath=path.join(projectRoot,'package-lock.json');
  if(await exists(pkgPath)){pkg=JSON.parse(await fs.readFile(pkgPath,'utf8'));evidence.push('package.json');}
  if(await exists(lockPath)){lock=JSON.parse(await fs.readFile(lockPath,'utf8'));evidence.push('package-lock.json');}
  const configNames=(await fs.readdir(projectRoot)).filter(n=>/^hardhat\.config\.(js|cjs|mjs|ts)$/.test(n));
  const texts=[];
  for(const n of configNames){texts.push({path:n,text:await readMaybe(path.join(projectRoot,n))});evidence.push(n);}
  for(const rel of ['tooling/lib/compileSolc.mjs','tooling/lib/compileSolc.js','tooling/scripts/curveYieldDexBytecodeSize.mjs']){
    const abs=path.join(projectRoot,...rel.split('/')); if(await exists(abs)){texts.push({path:rel,text:await readMaybe(abs)});evidence.push(rel);}
  }
  const candidates=[];
  for(const t of texts){
    for(const [re,priority,label] of [
      [/solidity\s*:\s*['"](\d+\.\d+\.\d+)['"]/g,120,'explicit solidity version'],
      [/SOLC_VERSION\s*=\s*['"](\d+\.\d+\.\d+)['"]/g,120,'explicit SOLC_VERSION'],
      [/version\s*:\s*['"](\d+\.\d+\.\d+)['"]/g,100,'version field']
    ]){
      for(const m of t.text.matchAll(re))candidates.push({version:m[1],basis:t.path,label,priority});
    }
  }
  const pkgSolc=pkg?.devDependencies?.solc??pkg?.dependencies?.solc;
  if(exactSemver(pkgSolc))candidates.push({version:exactSemver(pkgSolc),basis:'package.json solc',label:'declared solc dependency',priority:80});
  const lockSolc=lock?.packages?.['node_modules/solc']?.version;
  if(exactSemver(lockSolc))candidates.push({version:exactSemver(lockSolc),basis:'package-lock node_modules/solc',label:'locked solc package',priority:60});
  candidates.sort((a,b)=>b.priority-a.priority||a.basis.localeCompare(b.basis));
  if(!candidates.length)throw new Error('unable to detect exact Solidity compiler version from source package');
  const topPriority=candidates[0].priority;
  const topVersions=[...new Set(candidates.filter(x=>x.priority===topPriority).map(x=>x.version))];
  if(topVersions.length>1)throw new Error(`conflicting explicit Solidity compiler versions: ${topVersions.join(', ')}`);
  const compiler=candidates[0];
  const allText=texts.map(x=>x.text).join('\n');
  const opt=allText.match(/optimizer\s*:\s*\{[\s\S]{0,240}?enabled\s*:\s*(true|false)[\s\S]{0,240}?runs\s*:\s*(\d+)/);
  const runs=opt?Number(opt[2]):200; const enabled=opt?opt[1]==='true':true;
  const via=allText.match(/viaIR\s*:\s*(true|false)/);
  const evm=allText.match(/evmVersion\s*:\s*['"]([^'"]+)['"]/);
  return{compilerVersion:compiler.version,compilerCandidates:candidates,optimizer:{enabled,runs},viaIR:via?via[1]==='true':false,evmVersion:evm?.[1]??null,evidence};
}

function slitherSucceeded(r){return r&&['completed','completed_with_findings'].includes(r.status)&&r.componentStatus==='COMPLETED';}
function parseSlitherJson(text){
  try{const p=JSON.parse(String(text??''));const d=Array.isArray(p?.results?.detectors)?p.results.detectors:[];return{success:p?.success===true,detectors:d};}catch{return null;}
}
async function slitherRepair({projectRoot,build,sourceCommit}){
  const attempts=[];
  const primary=await runSlitherAnalysis({projectRoot,version:'0.11.6',sourceCommit,rawArtifactRef:'github-actions://lite-phase0/slither',standardJsonPath:build?.slitherStandardJsonPath??null});
  attempts.push({strategy:'runner-standard-json',result:primary});
  if(slitherSucceeded(primary))return{...primary,repairAttempts:attempts};

  const commands=[];
  if(build?.slitherStandardJsonPath)commands.push({strategy:'standard-json-direct',args:[build.slitherStandardJsonPath,'--solc-standard-json','--json','-']});
  const hardhat=await isDir(path.join(projectRoot,'node_modules'))&&((await fs.readdir(projectRoot)).some(n=>/^hardhat\.config\./.test(n)));
  if(hardhat)commands.push({strategy:'hardhat-project',args:['.','--compile-force-framework','hardhat','--json','-']});
  commands.push({strategy:'project-auto',args:['.','--json','-']});

  for(const c of commands){
    const raw=await runProcess({command:'slither',args:c.args,cwd:projectRoot});
    const parsed=parseSlitherJson(raw.stdout);
    const success=raw.exitCode===0&&parsed?.success===true;
    const result={strategy:c.strategy,exitCode:raw.exitCode,stdout:cleanText(raw.stdout),stderr:cleanText(raw.stderr),parsedSuccess:parsed?.success??false,findingCount:parsed?.detectors?.length??0};
    attempts.push(result);
    if(success){
      return{backend:'slither',version:'0.11.6',sourceCommit,rawArtifactRef:'github-actions://lite-phase0/slither',status:(parsed.detectors.length?'completed_with_findings':'completed'),terminal:true,componentStatus:'COMPLETED',continuationDisposition:'COMPLETE_EVIDENCE',authoritativeFinding:false,findingCount:parsed.detectors.length,detectors:parsed.detectors,repairAttempts:attempts};
    }
  }
  const error=new Error('Slither failed after all admitted repair strategies');
  error.code='slither_unrepaired';
  error.attempts=attempts;
  throw error;
}

async function main(){
  const args=parseArgs(process.argv.slice(2));
  if(!args.request||!args.output)throw new Error('usage: --request <request.json> --output <dir>');
  const request=JSON.parse(await fs.readFile(path.resolve(args.request),'utf8'));
  if(request.schemaVersion!=='curveyield-lite-phase0-intelligence-request-v1')throw new Error('request schema mismatch');
  safeRel(request.source.archivePath,'source.archivePath'); safeRel(request.destination.campaignPath,'destination.campaignPath');
  if(!/^[0-9a-f]{40}$/.test(request.source.commit))throw new Error('source.commit must be 40 hex');
  if(!/^[0-9a-f]{64}$/.test(request.source.archiveSha256))throw new Error('archive SHA-256 invalid');
  if(!/^[A-Za-z0-9._/-]+$/.test(request.destination.ref))throw new Error('destination ref invalid');

  const out=path.resolve(args.output), work=path.join(out,'work'); await fs.rm(out,{recursive:true,force:true}); await fs.mkdir(work,{recursive:true});
  const checkoutRoot=path.join(work,'source-repo');
  const checkout=await checkoutExactSource({repository:request.source.repository,commit:request.source.commit,destination:checkoutRoot},{environment:process.env});
  const archiveAbs=path.join(checkoutRoot,...request.source.archivePath.split('/'));
  const archiveBytes=await fs.readFile(archiveAbs); const observed=sha256(archiveBytes);
  if(observed!==request.source.archiveSha256)throw new Error(`source archive SHA mismatch expected ${request.source.archiveSha256} observed ${observed}`);
  const extractionRoot=path.join(work,'archive'); const extraction=await extractArchive(archiveAbs,extractionRoot);
  const detected=await detectProjectRoot(extractionRoot); const cfg=await detectBuildConfig(detected.absolute);

  const pseudo={
    requestId:request.requestId,requestDigest:request.requestDigest??sha256(Buffer.from(JSON.stringify(request))),
    campaignId:request.campaignId,assignmentId:'phase0-intelligence',phaseId:'phase-0',profileId:'github-native-compile-v2',
    source:{repository:request.source.repository,commit:request.source.commit,projectPath:detected.relativePath,archivePath:request.source.archivePath,archiveSha256:request.source.archiveSha256},
    configuration:{compilers:[{language:'solidity',version:cfg.compilerVersion}],analysis:{slither:{version:'0.11.6'}},optimizer:cfg.optimizer,evmVersion:cfg.evmVersion,viaIR:cfg.viaIR}
  };

  const build=await buildProject({projectRoot:detected.absolute,request:pseudo});
  const slither=await slitherRepair({projectRoot:detected.absolute,build,sourceCommit:request.source.commit});
  const sbom=await generateBuildSbomV1({projectRoot:detected.absolute,request:pseudo,build});
  const sourceIntelligence=await generateSourceIntelligenceTechnicalBundleV1({projectRoot:detected.absolute,request:pseudo,build,analysis:{slither}});

  if(!slitherSucceeded(slither))throw new Error('Slither terminal result is not successful');
  if(sourceIntelligence?.completion?.semanticReviewRequired!==true)throw new Error('Source Intelligence completion contract mismatch');

  const buildIdentity={
    schemaVersion:'curveyield-lite-phase0-build-source-identity-v1',
    requestId:request.requestId,campaignId:request.campaignId,
    source:{...request.source,checkoutCommit:checkout.commit,archiveSha256Observed:observed},
    discovery:{projectPath:detected.relativePath,topCandidates:detected.candidates,archiveEntryCount:extraction.entryCount,archiveExtractedBytes:extraction.extractedBytes},
    configurationDetection:cfg,
    build:{status:build.status,system:build.system,compilerVersion:build.compilerVersion,sourceInventoryFiles:build.sourceInventoryFiles??0,artifactCount:build.artifacts?.length??0,compilerInputSha256:build.compilerInputSha256??null,compilerOutputSha256:build.compilerOutputSha256??null,stagingManifestSha256:build.stagingManifestSha256??null,diagnosticCount:build.compilerDiagnostics?.length??0,slitherStandardJsonPath:build.slitherStandardJsonPath??null,vendorRootAdapter:build.vendorRootAdapter??null},
    status:'PASS'
  };

  const files=[
    ['BUILD_AND_SOURCE_IDENTITY_v1.json',buildIdentity],
    ['SBOM_v1.json',sbom],
    ['SLITHER_v1.json',slither],
    ['SOURCE_INTELLIGENCE_AUTOMATED_v1.json',sourceIntelligence]
  ];
  for(const [name,obj] of files)await fs.writeFile(path.join(out,name),JSON.stringify(obj,null,2)+'\n');
  process.stdout.write(JSON.stringify({status:'PASS',projectPath:detected.relativePath,compiler:cfg,build:{system:build.system,sourceFiles:build.sourceInventoryFiles,artifacts:build.artifacts?.length??0},slither:{status:slither.status,findings:slither.findingCount??0,repairs:slither.repairAttempts?.length??0},sourceIntelligence:{contracts:sourceIntelligence.contracts?.length??0,functions:sourceIntelligence.functions?.length??0,storage:sourceIntelligence.storageLayout?.length??0},outputs:files.map(([name])=>name)},null,2)+'\n');
}

main().catch(error=>{console.error(JSON.stringify({status:'FAIL',message:error?.message??String(error),code:error?.code??null,attempts:error?.attempts??null},null,2));process.exitCode=1;});
