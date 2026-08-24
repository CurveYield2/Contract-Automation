import { createHash } from 'node:crypto';
import { canonicalDigest } from './preflight/common-v1.mjs';
import { preflightSlitherV1 } from './preflight/slither-v1.mjs';
import { runProcess } from './execution.mjs';
import { V7_POLICY } from './v7-policy.mjs';

const BUILD_VIEW_FAILURE = /(?:crytic-compile|compil(?:e|ation)|unable to resolve imports|source\s+.+not found|parsererror|solc|hardhat|foundry)/i;

function sha256(value){return createHash('sha256').update(String(value??'')).digest('hex');}
function versionFromOutput(value){return String(value??'').match(/\b(\d+\.\d+\.\d+)\b/)?.[1]??null;}
function safeRaw(result={}){return{exitCode:Number.isInteger(result?.exitCode)?result.exitCode:-1,stdout:String(result?.stdout??''),stderr:String(result?.stderr??'')};}
async function safeCommand(runCommand,input){
  try{return safeRaw(await runCommand(input));}
  catch(error){return{exitCode:-1,stdout:'',stderr:error?.message??String(error),threw:true};}
}
function parseJsonObject(value){try{const parsed=JSON.parse(String(value??''));return parsed&&typeof parsed==='object'&&!Array.isArray(parsed)?parsed:null;}catch{return null;}}
function buildIdentity(build={}){
  return {
    status:build.status??null,
    system:build.system??null,
    compilerVersion:build.compilerVersion??null,
    sourceInventory:[...(build.sourceInventory??[])].sort(),
    buildInfo:(build.buildInfo??[]).map(x=>({path:x?.path??null,sha256:x?.sha256??null,solcVersion:x?.solcVersion??null,optimizerRuns:x?.optimizerRuns??null})).sort((a,b)=>String(a.path).localeCompare(String(b.path))),
    artifacts:(build.artifacts??[]).filter(Boolean).map(x=>({sourceName:x.sourceName??null,contractName:x.contractName??null,bytecodeSha256:sha256(x.bytecode??''),deployedBytecodeSha256:sha256(x.deployedBytecode??'')})).sort((a,b)=>`${a.sourceName}:${a.contractName}`.localeCompare(`${b.sourceName}:${b.contractName}`)),
  };
}

export function acceptedBuildDigestV1(build={}){return canonicalDigest(buildIdentity(build));}

export async function runTargetSlitherPreflightV1({projectRoot,sourceCommit,build,expectedAcceptedBuildDigest=null}={}, {runCommand=runProcess}={}) {
  if(typeof projectRoot!=='string'||projectRoot.length===0) throw new Error('Slither target preflight requires projectRoot');
  if(!build||typeof build!=='object') throw new Error('Slither target preflight requires accepted build evidence');
  const acceptedBuildDigest=acceptedBuildDigestV1(build);
  const soliditySources=[...(build.sourceInventory??[])].filter(x=>String(x).endsWith('.sol'));
  const versionRaw=await safeCommand(runCommand,{command:'slither',args:['--version'],cwd:projectRoot});
  const observedVersion=versionRaw.exitCode===0?versionFromOutput(`${versionRaw.stdout}\n${versionRaw.stderr}`):null;

  let smoke={status:'NOT_REQUIRED',exitCode:null,outputParseable:null,success:null,stdout:'',stderr:'',command:['slither','.','--print','contract-summary','--json','-']};
  let buildViewCompatible=true;
  if(build.status==='completed'&&soliditySources.length>0&&observedVersion===V7_POLICY.tools.slither){
    const raw=await safeCommand(runCommand,{command:'slither',args:['.','--print','contract-summary','--json','-'],cwd:projectRoot});
    const parsed=parseJsonObject(raw.stdout);
    const outputParseable=Boolean(parsed);
    const success=parsed?.success===true;
    const rawText=`${raw.stdout}\n${raw.stderr}`;
    buildViewCompatible=!BUILD_VIEW_FAILURE.test(rawText);
    const smokeStatus=success?'PASS':(raw.exitCode===0&&!outputParseable?'OUTPUT_INCOMPATIBLE':'FAIL');
    smoke={status:smokeStatus,exitCode:raw.exitCode,outputParseable,success,stdout:raw.stdout.slice(0,4000),stderr:raw.stderr.slice(0,4000),command:['slither','.','--print','contract-summary','--json','-']};
  }

  const receipt=preflightSlitherV1({
    acceptedBuildDigest,
    ...(expectedAcceptedBuildDigest?{expectedAcceptedBuildDigest}:{}),
    acceptedBuildStatus:build.status==='completed'?'PASS':'FAIL',
    observedVersion,
    soliditySourceCount:soliditySources.length,
    buildViewCompatible,
    buildViewEvidence:{compatible:buildViewCompatible,system:build.system??null,compilerVersion:build.compilerVersion??null,smokeExitCode:smoke.exitCode,stderr:smoke.stderr},
    targetSmokeStatus:smoke.status,
    targetSmokeEvidence:smoke,
    smokeOutputParseable:smoke.outputParseable,
    normalizedResultAuthoritative:false,
    repository:'CurveYield2/Contract-Automation',
    ref:sourceCommit??null,
    expectedOutputs:['slither-target-preflight-receipt'],
  });

  return {
    ...receipt,
    acceptedBuildDigest,
    acceptedBuildIdentity:buildIdentity(build),
    targetSmoke:smoke,
    sourceInventory:{soliditySources,soliditySourceCount:soliditySources.length},
    toolProbe:{expectedVersion:V7_POLICY.tools.slither,observedVersion,exitCode:versionRaw.exitCode,stdout:versionRaw.stdout.slice(0,1000),stderr:versionRaw.stderr.slice(0,1000)},
  };
}
