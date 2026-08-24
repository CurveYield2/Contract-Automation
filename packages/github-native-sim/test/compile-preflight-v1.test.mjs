import test from 'node:test';
import assert from 'node:assert/strict';
import {preflightCompileV1} from '../src/preflight/compile-v1.mjs';

const h='a'.repeat(64);
const ok={
  sourceSnapshotDigest:h,
  expectedSourceSnapshotDigest:h,
  projectRoot:'target',
  projectRootExists:true,
  buildSystem:'mixed-native',
  buildManifest:{status:'PASS',rootManifest:'foundry.toml',candidateManifests:['foundry.toml']},
  buildToolProbe:{status:'PASS',tool:'forge',expectedVersion:'1.7.1',observedVersion:'1.7.1',remappingsExitCode:0},
  languages:[
    {language:'solidity',requestedVersion:'0.8.28',installedVersion:'0.8.28'},
    {language:'vyper',requestedVersion:'0.3.10',installedVersion:'0.3.10'}
  ],
  expectedCompilerSettingsDigest:h,
  observedCompilerSettingsDigest:h,
  importGraph:{status:'PASS',imports:[],unresolvedImports:[],remappings:[]},
  expectedArtifacts:['A.sol:A'],
  missingArtifactSources:[]
};

test('mixed exact compiler matrix PASS',()=>assert.equal(preflightCompileV1(ok).status,'PREFLIGHT_PASS'));

test('wrong compiler version names exact mismatch',()=>{
  const r=preflightCompileV1({...ok,languages:[{language:'solidity',requestedVersion:'0.8.28',installedVersion:'0.8.30'}]});
  assert.equal(r.firstFailure,'COMPILE_COMPILER_VERSION_MISMATCH');
  assert.deepEqual(r.diagnostics[0].expected,[{language:'solidity',version:'0.8.28'}]);
});
