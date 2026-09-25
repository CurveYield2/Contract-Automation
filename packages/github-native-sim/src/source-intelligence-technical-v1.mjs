import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { digestCanonicalV1 } from './canonical-json-v1.mjs';
import { generateBuildSbomV1 } from './sbom-v1.mjs';

const SKIP = new Set(['.git','node_modules','artifacts','cache','out','dist','build','.audit-hermetic-build','.deep-assurance-work','.deep-assurance-work-v2']);
const sha256 = (v) => createHash('sha256').update(v).digest('hex');
const clone = (v) => v === undefined ? undefined : structuredClone(v);
const pad = (n,w=3) => String(n).padStart(w,'0');

function abiType(input) {
  const type = String(input?.type ?? '');
  if (!type.startsWith('tuple')) return type;
  return `(${(input?.components ?? []).map(abiType).join(',')})${type.slice(5)}`;
}
function signature(entry) { return `${entry.name}(${(entry.inputs ?? []).map(abiType).join(',')})`; }
function language(pathName, artifact = {}) {
  if (artifact.language) return String(artifact.language).toUpperCase();
  return String(pathName).toLowerCase().endsWith('.vy') ? 'VYPER' : 'SOLIDITY';
}
function bytecodeDigest(value) {
  const hex = String(value ?? '').replace(/^0x/,'');
  return sha256(hex && /^[0-9a-fA-F]+$/.test(hex) && hex.length % 2 === 0 ? Buffer.from(hex,'hex') : Buffer.from(String(value ?? '')));
}
function loc(source, src) {
  if (!source || typeof src !== 'string') return null;
  const [a,b] = src.split(':').map(Number);
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0) return null;
  const bytes = Buffer.from(source.content,'utf8');
  const start = Math.min(a,bytes.length), end = Math.min(a+b,bytes.length);
  const startLine = bytes.subarray(0,start).toString('utf8').split('\n').length;
  const endLine = bytes.subarray(0,end).toString('utf8').split('\n').length;
  return {label:`${source.path}:${startLine}-${endLine}`,startLine,endLine};
}
function walk(value, visit, ctx={}) {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) { for (const item of value) walk(item,visit,ctx); return; }
  let next = ctx;
  if (value.nodeType) {
    next = {...ctx};
    if (value.nodeType === 'ContractDefinition') next.contract = value;
    if (value.nodeType === 'FunctionDefinition') next.fn = value;
    visit(value,next);
  }
  for (const [key,child] of Object.entries(value)) {
    if (['scope','referencedDeclaration','linearizedBaseContracts'].includes(key)) continue;
    if (child && typeof child === 'object') walk(child,visit,next);
  }
}
async function sources(projectRoot) {
  const out=[];
  async function scan(dir) {
    for (const e of await fs.readdir(dir,{withFileTypes:true})) {
      if (SKIP.has(e.name) || e.name.startsWith('artifacts')) continue;
      const full=path.join(dir,e.name);
      if (e.isDirectory()) await scan(full);
      else if (e.isFile() && (e.name.endsWith('.sol') || e.name.endsWith('.vy'))) {
        const bytes=await fs.readFile(full);
        out.push({path:path.relative(projectRoot,full).split(path.sep).join('/'),language:e.name.endsWith('.vy')?'VYPER':'SOLIDITY',sha256:sha256(bytes),bytes:bytes.length,content:bytes.toString('utf8')});
      }
    }
  }
  await scan(projectRoot);
  out.sort((a,b)=>a.path.localeCompare(b.path));
  return out.map((x,i)=>({...x,sourceId:`SRC-${pad(i+1)}`}));
}
function astIndex(sourceAsts, byPath) {
  const nodes=new Map(), contracts=new Map(), functions=new Map();
  for (const [sourceName,ast] of Object.entries(sourceAsts ?? {}).sort(([a],[b])=>a.localeCompare(b))) {
    const source=byPath.get(sourceName);
    walk(ast,(node,ctx)=>{
      if (Number.isInteger(node.id)) nodes.set(node.id,{node,sourceName,source});
      if (node.nodeType==='ContractDefinition') contracts.set(`${sourceName}:${node.name}`,{node,sourceName,source});
      if (node.nodeType==='FunctionDefinition' && ctx.contract) {
        const key=`${sourceName}:${ctx.contract.name}`;
        const list=functions.get(key)??[]; list.push({node,sourceName,source}); functions.set(key,list);
      }
    });
  }
  return {nodes,contracts,functions};
}
function modifierName(m) { return m?.modifierName?.name ?? m?.modifierName?.namePath ?? m?.modifierName?.memberName ?? 'UNKNOWN_MODIFIER'; }

export async function generateSourceIntelligenceTechnicalBundleV1({projectRoot,request,build,analysis={}}={}) {
  if (!projectRoot || !request?.source || !request?.configuration) throw new TypeError('projectRoot and request are required');
  if (!build || build.status !== 'completed') throw new Error('accepted completed build is required');

  const raw=await sources(projectRoot);
  if (!raw.length) throw new Error('no admitted Solidity/Vyper source files found');
  const byPath=new Map(raw.map(x=>[x.path,x]));
  const sourceFiles=raw.map(({content,...x})=>({...x,scopeStatus:'IN_SCOPE_ADMITTED_SOURCE',basis:'EXACT_ADMITTED_CHECKOUT_OR_ARCHIVE'}));
  const ast=astIndex(build.sourceAsts ?? {},byPath);
  const artifacts=[...(build.artifacts??[])].sort((a,b)=>`${a.sourceName}:${a.contractName}`.localeCompare(`${b.sourceName}:${b.contractName}`));

  const compilerArtifacts=[],contracts=[],functions=[],storageLayout=[],inheritanceGraph=[],privilegeCandidates=[],eventsAndErrors=[],sourceAnchors=[];
  const contractByAstId=new Map(), contractByQualified=new Map();

  for (const [i,a] of artifacts.entries()) {
    const qualifiedName=`${a.sourceName}:${a.contractName}`, artifactId=`ART-${pad(i+1)}`;
    const source=byPath.get(a.sourceName), sourceId=source?.sourceId??null, lang=language(a.sourceName,a);
    compilerArtifacts.push({
      artifactId,qualifiedName,sourceId,language:lang,abiDigestSha256:digestCanonicalV1(a.abi??[]),
      creationBytecodeDigestSha256:bytecodeDigest(a.bytecode),deployedBytecodeDigestSha256:bytecodeDigest(a.deployedBytecode),
      storageLayoutAvailable:a.storageLayout?'YES':'NO',metadataAvailable:a.metadata!=null,methodIdentifiers:clone(a.methodIdentifiers??{}),
      preliminaryDeploymentGasEstimate:{acceptanceClass:'PRELIMINARY_NOT_PHASE7_ACCEPTED',estimate:a.gasEstimates?.creation?.totalCost??null},
      basis:'ADMITTED_COMPILER_OUTPUT'
    });
    const astContract=ast.contracts.get(qualifiedName), contractId=`CONTRACT-${pad(i+1)}`;
    contractByQualified.set(qualifiedName,contractId);
    if (Number.isInteger(astContract?.node?.id)) contractByAstId.set(astContract.node.id,contractId);
    const cLoc=loc(source,astContract?.node?.src);
    contracts.push({contractId,qualifiedName,sourceId,language:lang,contractKind:astContract?.node?.contractKind??(lang==='VYPER'?'contract':'UNKNOWN'),
      deployability:(astContract?.node?.abstract===true||['interface','library'].includes(astContract?.node?.contractKind))?'NOT_DIRECTLY_DEPLOYABLE':(String(a.bytecode??'0x')==='0x'?'NO_CREATION_BYTECODE':'DEPLOYABLE'),
      artifactId,sourceLocation:cLoc?.label??'UNSUPPORTED_AST_SOURCE_LOCATION',confidenceClass:'COMPILER_FACT',basis:cLoc?'SOLIDITY_AST_AND_COMPILER_ARTIFACT':'COMPILER_ARTIFACT'});
    if (cLoc) sourceAnchors.push({anchorId:`ANCHOR-${pad(sourceAnchors.length+1,4)}`,sourceId,symbolId:contractId,startLine:cLoc.startLine,endLine:cLoc.endLine,sourceDigestSha256:source.sha256,basis:'SOLIDITY_AST_SRC'});

    const astFns=ast.functions.get(qualifiedName)??[];
    for (const abi of a.abi??[]) {
      if (abi.type==='function') {
        const sig=signature(abi), selector=a.methodIdentifiers?.[sig]??null;
        const fn=astFns.find(x=>selector&&x.node?.functionSelector===selector) ?? astFns.find(x=>x.node?.name===abi.name&&(x.node?.parameters?.parameters?.length??-1)===(abi.inputs??[]).length);
        const id=`FUNC-${pad(functions.length+1,4)}`, fLoc=loc(source,fn?.node?.src);
        const modifiers=(fn?.node?.modifiers??[]).map(modifierName);
        functions.push({functionId:id,contractId,signature:sig,selector:selector?`0x${selector.replace(/^0x/,'')}`:null,visibility:fn?.node?.visibility??'PUBLIC_OR_EXTERNAL_ABI',
          stateMutability:abi.stateMutability??fn?.node?.stateMutability??null,payable:(abi.stateMutability??fn?.node?.stateMutability)==='payable',modifiers,
          sourceLocation:fLoc?.label??'UNSUPPORTED_AST_SOURCE_LOCATION',confidenceClass:'COMPILER_FACT',basis:fLoc?'ABI_METHOD_IDENTIFIERS_AND_SOLIDITY_AST':'ABI_AND_METHOD_IDENTIFIERS'});
