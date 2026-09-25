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
        if (fLoc) sourceAnchors.push({anchorId:`ANCHOR-${pad(sourceAnchors.length+1,4)}`,sourceId,symbolId:id,startLine:fLoc.startLine,endLine:fLoc.endLine,sourceDigestSha256:source.sha256,basis:'SOLIDITY_AST_SRC'});
        for (const m of fn?.node?.modifiers??[]) privilegeCandidates.push({candidateId:`PRIV-${pad(privilegeCandidates.length+1,4)}`,contractId,functionId:id,candidateKind:'MODIFIER_INVOCATION',
          modifierOrGuard:modifierName(m),authorityExpression:modifierName(m),sourceLocation:loc(source,m.src)?.label??fLoc?.label??'UNSUPPORTED_AST_SOURCE_LOCATION',
          status:'CANDIDATE',confidenceClass:'SOURCE_SYNTAX_FACT',basis:'SOLIDITY_AST_MODIFIER_INVOCATION',securityInterpretation:'DEFER_TO_PHASE_3_AND_4'});
      } else if (abi.type==='event' || abi.type==='error') {
        eventsAndErrors.push({itemId:`EVERR-${pad(eventsAndErrors.length+1,4)}`,contractId,kind:abi.type.toUpperCase(),signatureOrName:signature(abi),
          sourceLocation:'ABI_ONLY_SOURCE_LOCATION_UNAVAILABLE',confidenceClass:'COMPILER_FACT',basis:'COMPILER_ABI'});
      }
    }
    for (const item of a.storageLayout?.storage??[]) {
      const node=Number.isInteger(item.astId)?ast.nodes.get(item.astId):null, sLoc=loc(byPath.get(node?.sourceName??a.sourceName),node?.node?.src);
      storageLayout.push({storageId:`STORE-${pad(storageLayout.length+1,4)}`,contractId,label:item.label??null,slot:String(item.slot??''),offset:String(item.offset??''),
        type:a.storageLayout?.types?.[item.type]?.label??item.type??null,sourceLocation:sLoc?.label??'UNSUPPORTED_AST_SOURCE_LOCATION',status:'CURRENT',confidenceClass:'COMPILER_FACT',basis:'COMPILER_STORAGE_LAYOUT'});
    }
  }

  for (const [qualifiedName,entry] of ast.contracts.entries()) {
    const derived=contractByQualified.get(qualifiedName); if (!derived) continue;
    for (const base of entry.node?.baseContracts??[]) {
      const baseId=base?.baseName?.referencedDeclaration, baseContractId=contractByAstId.get(baseId); if (!baseContractId) continue;
      inheritanceGraph.push({edgeId:`INHERIT-${pad(inheritanceGraph.length+1,4)}`,derivedContractId:derived,baseContractId,
        linearizedOrder:(entry.node.linearizedBaseContracts??[]).indexOf(baseId),sourceLocation:loc(entry.source,base.src)?.label??'UNSUPPORTED_AST_SOURCE_LOCATION',
        confidenceClass:'COMPILER_FACT',basis:'SOLIDITY_AST_BASE_CONTRACT'});
    }
  }

  const sourceIdentity={repository:request.source.repository,commit:request.source.commit,projectPath:request.source.projectPath,archivePath:request.source.archivePath??null,archiveSha256:request.source.archiveSha256??null,
    sourceTreeDigestSha256:digestCanonicalV1(sourceFiles.map(({path,language,sha256})=>({path,language,sha256})))};
  const buildCore={system:build.system??null,compilers:clone(request.configuration.compilers??[]),optimizer:clone(request.configuration.optimizer??null),evmVersion:request.configuration.evmVersion??null,
    viaIR:request.configuration.viaIR===true,sourceFiles:sourceFiles.map(({path,language,sha256})=>({path,language,sha256})),
    artifacts:compilerArtifacts.map(({qualifiedName,abiDigestSha256,creationBytecodeDigestSha256,deployedBytecodeDigestSha256})=>({qualifiedName,abiDigestSha256,creationBytecodeDigestSha256,deployedBytecodeDigestSha256}))};
  const sbom=await generateBuildSbomV1({projectRoot,request,build:{compilerDescriptors:clone(request.configuration.compilers??[]),optimizer:clone(request.configuration.optimizer??null),evmVersion:request.configuration.evmVersion??null,viaIR:request.configuration.viaIR===true,sourceCommit:request.source.commit,artifacts:clone(build.artifacts??[])}});
  const slither=analysis.slither??null, detectors=Array.isArray(slither?.detectors)?slither.detectors:[];
  const limitations=[];
  if (sourceFiles.some(x=>x.language==='SOLIDITY') && Object.keys(build.sourceAsts??{}).length===0) limitations.push({limitationId:'SI-TECH-LIM-001',category:'SOLIDITY_AST_UNAVAILABLE',
    affectedSections:['inheritanceGraph','sourceAnchors','privilegeCandidates'],reason:'The admitted Solidity build did not expose source ASTs.',downstreamRequiredAction:'Carry the limitation; do not fabricate AST-derived facts.'});
  if (sourceFiles.some(x=>x.language==='VYPER')) limitations.push({limitationId:`SI-TECH-LIM-${pad(limitations.length+1)}`,category:'VYPER_AST_STRUCTURAL_LIMITATION',
    affectedSections:['inheritanceGraph','callGraph','privilegeCandidates','externalInterfaces','valueFlowCandidates','sourceAnchors','storageLayout'],reason:'Pinned Vyper build exposes ABI/bytecode but not equivalent AST/storage layout.',
    downstreamRequiredAction:'Preserve Vyper compiler facts and require semantic raw-source review.'});
  limitations.push({limitationId:`SI-TECH-LIM-${pad(limitations.length+1)}`,category:'SEMANTIC_CALL_AND_VALUE_FLOW_DEFERRED',
    affectedSections:['callGraph','externalInterfaces','valueFlowCandidates','protocolTopology'],reason:'Stage C.4 emits build/ABI/AST structural facts; semantic call/value-flow/topology classification remains reviewer-owned.',
    downstreamRequiredAction:'Later Lite reviewers reuse this bundle and extend semantically without rebuilding the structural inventory.'});
  if (!slither || !['completed','completed_with_findings'].includes(slither.status)) limitations.push({limitationId:`SI-TECH-LIM-${pad(limitations.length+1)}`,category:'STATIC_RECON_LIMITATION',
    affectedSections:['staticRecon.slither'],reason:`Slither terminal status was ${slither?.status??'UNAVAILABLE'}.`,downstreamRequiredAction:'Carry exact analyzer limitation and raw evidence.'});

  const bundle={
    schemaVersion:'curveyield-v7-source-intelligence-technical-bundle-v1',artifactType:'SOURCE_INTELLIGENCE_TECHNICAL_BUNDLE',
    neutrality:{securityDisposition:'REVIEWER_REQUIRED',findingPromotion:'FORBIDDEN_BY_GENERATOR',statement:'Compiler/source/static facts and neutral candidates only; no finding, severity, exploitability, or trust conclusion.'},
    requestIdentity:{requestId:request.requestId,requestDigest:request.requestDigest,campaignId:request.campaignId,assignmentId:request.assignmentId,phaseId:request.phaseId,profileId:request.profileId},
    sourceIdentity,buildIdentity:{...buildCore,digestSha256:digestCanonicalV1(buildCore)},sourceFiles,compilerArtifacts,contracts,functions,storageLayout,inheritanceGraph,
    callGraph:[],privilegeCandidates,externalInterfaces:[],valueFlowCandidates:[],eventsAndErrors,sourceAnchors,
    securitySurfaces:[{surfaceId:'SURFACE-CALLABLE',surfaceClass:'CALLABLE_SURFACE',sourceIds:sourceFiles.map(x=>x.sourceId),contractIds:contracts.map(x=>x.contractId),functionIds:functions.map(x=>x.functionId),
      storageIds:storageLayout.map(x=>x.storageId),externalInterfaceIds:[],privilegeCandidateIds:privilegeCandidates.map(x=>x.candidateId),valueFlowCandidateIds:[],sourceAnchorIds:sourceAnchors.map(x=>x.anchorId),
      phase1Ownership:'STRUCTURAL_INVENTORY',laterPhaseTreatment:'REUSE_VERIFY_EXTEND_SEMANTICALLY',status:'CURRENT',basis:'ADMITTED_COMPILER_AND_AST_FACTS'}],
    protocolTopology:{upgradeabilityEdges:[],dependencyEdges:[],crossChainEdges:[],offchainAutomationEdges:[],topologyLimitations:['SEMANTIC_PROTOCOL_TOPOLOGY_REMAINS_REVIEWER_OWNED']},
    staticRecon:{slither:{status:slither?.status??'UNAVAILABLE',version:slither?.version??null,rawEvidenceRef:slither?.rawArtifactRef??null,candidateCount:detectors.length,
      candidateIndex:detectors.map((d,i)=>({candidateId:`SLITHER-${pad(i+1,4)}`,check:d?.check??d?.description??d?.impact??'UNNAMED_DETECTOR',confidence:d?.confidence??null,impact:d?.impact??null,status:'NEUTRAL_ANALYZER_CANDIDATE'})),
      limitation:slither&&['completed','completed_with_findings'].includes(slither.status)?null:`SLITHER_${String(slither?.status??'UNAVAILABLE').toUpperCase()}`},
      sbom:{status:'COMPLETED',digestSha256:sbom.sbomDigest,sourceFileCount:sbom.sourceFiles?.length??0,dependencyFileCount:sbom.dependencyFiles?.length??0,artifactCount:sbom.artifacts?.length??0}},
    limitations,completion:{status:'TECHNICAL_BUNDLE_COMPLETE_WITH_TYPED_LIMITATIONS',exactSourceBound:true,exactBuildBound:true,staticReconAttached:slither!==null,secondSourceCheckoutPerformed:false,secondBuildPerformed:false,
      canonicalSourceIntelligenceProjectionOwner:'AUDIT_CONTROLLER',semanticReviewRequired:true}
  };
  return {...bundle,technicalBundleDigest:digestCanonicalV1(bundle)};
}
