import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const workflows=[
  '.github/workflows/v7-execution-infrastructure-qualification.yml',
  '.github/workflows/v7-execution-infrastructure-qualification-no-telemetry-v1.yml'
];
const workflow=(file)=>fs.readFileSync(path.join(root,file),'utf8');
const step=(source,name)=>{
  const token='- name: '+name;
  const start=source.indexOf(token);
  assert.ok(start>=0,'required step absent: '+name);
  const next=source.indexOf('\n      - name:',start+token.length);
  return source.slice(start,next<0?undefined:next);
};
test('root test command discovers every V7 and Anvil test once',()=>{
  const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
  assert.equal(pkg.scripts?.test,'node --test');
  const dirs=[
    ['packages/github-native-sim/test',n=>n.endsWith('.test.mjs')],
    ['packages/runner/test',n=>/^anvil-.*\.test\.mjs$/.test(n)],
    ['packages/runner/test',n=>n==='full-simulation-anvil-only-v1.test.mjs']
  ];
  for(const [dir,pattern] of dirs){
    assert.ok(fs.readdirSync(path.join(root,dir)).some(pattern),'missing test discovery group: '+dir);
  }
});
for(const p of workflows){
  test(p+' runs exactly one full Node suite and preserves all gates',()=>{
    const s=workflow(p);
    const block=step(s,'Full repository Node test suite');
    assert.match(block,/if: env\.V7_QUALIFICATION_LANE == 'FULL'/);
    assert.match(block,/npm test/);
    assert.match(block,/packages\/github-native-sim\/test/);
    assert.match(block,/packages\/runner\/test/);
    assert.match(block,/full-simulation-anvil-only-v1\.test\.mjs/);
    assert.equal(s.split('- name: Full repository Node test suite').length-1,1);
    assert.doesNotMatch(s,/- name: V7 request and execution contract qualification/);
    assert.doesNotMatch(s,/- name: Anvil-only runner qualification/);
    for(const name of ['Install and verify canonical V7 toolchain','Verify canonical runner manifest','Repository static checks','Live trusted-main Phase 6 and Phase 7 mutable-Anvil qualification']){
      assert.match(step(s,name),/V7_QUALIFICATION_LANE == 'FULL'/);
    }
    assert.match(s,/testMatrix:\{githubNative:'PASS',anvilRunner:'PASS',fullNodeSuite:'PASS',staticChecks:'PASS',toolchainVerification:'PASS'\}/);
    assert.match(s,/phase6MutableRpcPass/);
    assert.match(s,/phase7PreflightPass/);
    assert.match(s,/status:Object\.values\(checks\)\.every\(Boolean\)\?'PASS':'FAIL'/);
    assert.match(s,/testMatrix:qualification\.testMatrix/);
  });
}
test('primary intelligence logs all stages with an external wall clock watchdog',()=>{
  const src=fs.readFileSync(path.join(root,'packages/github-native-sim/src/lite-phase0-intelligence-v1.mjs'),'utf8');
  const wf=workflow('.github/workflows/lite-phase0-intelligence-v1.yml');
  assert.match(wf,/timeout -s TERM -k 30s 1500s node packages\/github-native-sim\/src\/lite-phase0-intelligence-v1\.mjs/);
  for(const stage of [
    'exact-source-checkout','extract-verified-archive','detect-project-root','detect-build-config',
    'compile-exact-build','slither-static-analysis','generate-sbom','generate-source-intelligence',
    'scan-project-readiness','execute-local-deployment-inventory','write-machine-evidence'
  ])assert.ok(src.includes("withProgressStage('"+stage+"'"),'missing stage '+stage);
  assert.match(src,/PHASE0_LOG_PREFIX.*phase0-intelligence-primary/);
  assert.match(src,/elapsed_seconds/);
  assert.match(src,/setInterval/);
  assert.match(src,/clearInterval\(heartbeat\)/);
  assert.match(src,/compileWithPrivateCacheV1/);
  const lite=workflow('.github/workflows/lite-phase0-intelligence-no-telemetry-v1.yml');
  assert.match(lite,/timeout -s TERM -k 30s 900s node/);
});
