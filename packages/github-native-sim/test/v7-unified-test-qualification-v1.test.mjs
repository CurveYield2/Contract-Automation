import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
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
test('primary intelligence logs all stages with an external wall clock watchdog',()=>{
  const src=fs.readFileSync(path.join(root,'packages/github-native-sim/src/lite-phase0-intelligence-v1.mjs'),'utf8');
  const wf=fs.readFileSync(path.join(root,'.github/workflows/lite-phase0-intelligence-v1.yml'),'utf8');
  assert.match(wf,/timeout -s TERM -k 30s 3000s node scripts\/phase0-compile-watchdog-v1\.mjs primary -- node packages\/github-native-sim\/src\/lite-phase0-intelligence-v1\.mjs/);
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
});
