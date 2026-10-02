import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateBuildSbomV1, computeBuildSbomDigestV1, reconcileBuildSbomV1 } from '../src/sbom-v1.mjs';

async function fixture(sourceA='contract A {}', bytecode='0x6001', evmVersion='cancun') {
  const root = await mkdtemp(join(tmpdir(), 'v7-sbom-'));
  await mkdir(join(root,'contracts'), { recursive:true });
  await writeFile(join(root,'contracts','A.sol'), sourceA);
  await writeFile(join(root,'contracts','B.vy'), '@external\ndef f(): pass\n');
  await writeFile(join(root,'package-lock.json'), '{"lockfileVersion":3}\n');
  const request={ source:{ repository:'CurveYield2/example', commit:'a'.repeat(40), archivePath:null, archiveSha256:null, projectPath:'.' } };
  const build={ compilerDescriptors:[{ language:'solidity', version:'0.8.30' }], optimizer:{ enabled:true, runs:200 }, evmVersion, viaIR:false, artifacts:[{ sourceName:'contracts/A.sol', contractName:'A', bytecode, deployedBytecode:'0x6002' }] };
  return { root, request, build };
}

test('same accepted build produces stable digest independent of directory enumeration', async()=>{
  const a=await fixture(); const b=await fixture();
  const sa=await generateBuildSbomV1({ projectRoot:a.root, request:a.request, build:a.build });
  const sb=await generateBuildSbomV1({ projectRoot:b.root, request:b.request, build:b.build });
  assert.equal(sa.schemaVersion,'audit-v7-build-sbom-v1');
  assert.equal(sa.sbomDigest, computeBuildSbomDigestV1(sa));
  assert.equal(sa.sbomDigest, sb.sbomDigest);
  assert.deepEqual(sa.sourceFiles.map(x=>x.path), [...sa.sourceFiles.map(x=>x.path)].sort());
});

test('reconciliation identifies source, artifact and build identity changes', async()=>{
  const a=await fixture(); const b=await fixture('contract A { uint x; }','0x6003','prague');
  const prior=await generateBuildSbomV1({ projectRoot:a.root, request:a.request, build:a.build });
  const current=await generateBuildSbomV1({ projectRoot:b.root, request:b.request, build:b.build });
  const diff=reconcileBuildSbomV1({ prior, current });
  assert.equal(diff.status,'CHANGED');
  assert.deepEqual(diff.changedSourceFiles,['contracts/A.sol']);
  assert.deepEqual(diff.changedArtifacts,['contracts/A.sol:A']);
  assert.equal(diff.changedBuildIdentity,true);
  assert.notEqual(prior.sbomDigest,current.sbomDigest);
});
