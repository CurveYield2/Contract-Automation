import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildExecutionArtifactBundleV2,
  validateExecutionInputJoinV2
} from '../src/phase0-execution-input-v2.mjs';

const sourceSha='a'.repeat(64);
const buildIdentity={
  status:'PASS',
  source:{archiveSha256Observed:sourceSha},
  build:{artifactCount:1,system:'solc-standard-json'},
  configurationDetection:{compilerVersion:'0.8.30',optimizer:{enabled:true,runs:200},evmVersion:'cancun',viaIR:false}
};
const request={
  requestId:'r1',campaignId:'c1',
  source:{repository:'CurveYield2/Audit-Controller',commit:'b'.repeat(40),archivePath:'campaigns/x/source/x.zip',archiveSha256:sourceSha,projectPath:'.'},
  configuration:{compilers:[{language:'solidity',version:'0.8.30'}],optimizer:{enabled:true,runs:200},evmVersion:'cancun',viaIR:false}
};
const build={
  status:'completed',system:'solc-standard-json',compilerVersion:'0.8.30',
  artifacts:[{
    sourceName:'src/X.sol',contractName:'X',
    abi:[{type:'function',name:'set',inputs:[{name:'x',type:'uint256'}],outputs:[],stateMutability:'nonpayable'}],
    bytecode:'0x6000',deployedBytecode:'0x6001',bytecodeSourceMap:'1:2:3',deployedBytecodeSourceMap:'4:5:6',
    linkReferences:{},deployedLinkReferences:{},methodIdentifiers:{'set(uint256)':'60fe47b1'},
    storageLayout:{storage:[],types:{}},metadata:'{}',gasEstimates:{}
  }],
  compilerProfiles:[],compilationUnits:[],sourceInventory:['src/X.sol']
};

test('A01 producer exports reusable exact compiler artifacts without asking the simulation stage to rebuild',()=>{
  const bundle=buildExecutionArtifactBundleV2({request,build});
  assert.equal(bundle.schemaVersion,'curveyield-phase0-execution-build-artifacts-v2');
  assert.equal(bundle.source.archiveSha256,sourceSha);
  assert.equal(bundle.artifacts.length,1);
  assert.equal(bundle.artifacts[0].qualifiedName,'src/X.sol:X');
  assert.deepEqual(bundle.artifacts[0].abi,build.artifacts[0].abi);
  assert.equal(bundle.artifacts[0].bytecodeSourceMap,'1:2:3');
  assert.equal(bundle.artifacts[0].deployedBytecodeSourceMap,'4:5:6');
  assert.match(bundle.artifactSetDigestSha256,/^[0-9a-f]{64}$/);
  assert.equal(bundle.reuseContract.secondBuildRequired,false);
});

test('A02/A03 shared execution join binds receipt, build, exported artifacts, SI, Slither and readiness to one exact source',()=>{
  const bundle=buildExecutionArtifactBundleV2({request,build});
  const sourceIntelligence={
    sourceIdentity:{archiveSha256:sourceSha},
    compilerArtifacts:[{qualifiedName:'src/X.sol:X',abiDigestSha256:bundle.artifacts[0].abiDigestSha256,creationBytecodeDigestSha256:bundle.artifacts[0].creationBytecodeDigestSha256,deployedBytecodeDigestSha256:bundle.artifacts[0].deployedBytecodeDigestSha256}],
    functions:[{functionId:'FUNC-0001',contractId:'CONTRACT-001',signature:'set(uint256)',stateMutability:'nonpayable'}]
  };
  const joined=validateExecutionInputJoinV2({
    receipt:{campaign:{campaignId:'c1'},source:{sha256:sourceSha}},
    buildIdentity,
    artifactBundle:bundle,
    sourceIntelligence,
    slither:{status:'completed',sourceCommit:'b'.repeat(40)},
    readiness:{source:{archiveSha256:sourceSha}}
  });
  assert.equal(joined.status,'PASS');
  assert.equal(joined.sourceSha256,sourceSha);
  assert.equal(joined.artifacts.length,1);
  assert.equal(joined.callableFunctions.length,1);
  assert.equal(joined.upstreamInputs.length,5);
  assert.equal(joined.executionPreparation.secondBuildPerformed,false);

  const bad=structuredClone(bundle);bad.source.archiveSha256='c'.repeat(64);
  assert.throws(()=>validateExecutionInputJoinV2({
    receipt:{campaign:{campaignId:'c1'},source:{sha256:sourceSha}},buildIdentity,artifactBundle:bad,sourceIntelligence,
    slither:{status:'completed'},readiness:{source:{archiveSha256:sourceSha}}
  }),/source identity mismatch/i);
});

test('A04 shared join rejects compiler inventory drift rather than silently dropping a callable',()=>{
  const bundle=buildExecutionArtifactBundleV2({request,build});
  const sourceIntelligence={
    sourceIdentity:{archiveSha256:sourceSha},
    compilerArtifacts:[{qualifiedName:'src/X.sol:X',abiDigestSha256:'f'.repeat(64),creationBytecodeDigestSha256:bundle.artifacts[0].creationBytecodeDigestSha256,deployedBytecodeDigestSha256:bundle.artifacts[0].deployedBytecodeDigestSha256}],
    functions:[{functionId:'FUNC-0001',contractId:'CONTRACT-001',signature:'set(uint256)',stateMutability:'nonpayable'}]
  };
  assert.throws(()=>validateExecutionInputJoinV2({
    receipt:{campaign:{campaignId:'c1'},source:{sha256:sourceSha}},buildIdentity,artifactBundle:bundle,sourceIntelligence,
    slither:{status:'completed'},readiness:{source:{archiveSha256:sourceSha}}
  }),/compiler artifact mismatch/i);
});
