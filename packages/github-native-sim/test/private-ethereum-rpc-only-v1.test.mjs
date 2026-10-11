import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const sources=[
  '.github/workflows',
  'packages',
  'scripts',
  'process',
  'protocol'
];
function allFiles(dir){
  return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{
    const file=path.join(dir,entry.name);
    return entry.isDirectory()?allFiles(file):[file];
  });
}
test('Ethereum execution sources contain no public RPC URLs',()=>{
  const bad=[];
  const banned=/eth\.drpc\.org|ethereum-rpc\.publicnode\.com|eth\.llamarpc\.com|1rpc\.io\/eth|rpc\.ankr\.com\/eth/i;
  for(const sub of sources)for(const file of allFiles(path.join(root,sub))){
    if(!/\.(yml|yaml|mjs|js|ts|sh)$/.test(file))continue;
    const txt=fs.readFileSync(file,'utf8');
    if(banned.test(txt))bad.push(path.relative(root,file));
  }
  assert.deepEqual(bad,[],'remove public Ethereum RPC fallbacks');
});
test('canonical Phase 0, qualification and execution workflows use the private secret',()=>{
  for(const name of [
    'lite-phase0-randomized-simulation-v1.yml',
    'lite-phase0-simulation-rebind-v1.yml',
    'lite-phase0-simulation-testing-v1.yml',
    'audit-controller-execution.yml',
    'v7-execution-infrastructure-qualification.yml'
  ]){
    const content=fs.readFileSync(path.join(root,'.github/workflows',name),'utf8');
    const secretName=['lite-phase0-randomized-simulation-v1.yml','v7-execution-infrastructure-qualification.yml'].includes(name)?'RPC_ETHEREUM':'ETHEREUM_RPC';
    assert.ok(content.includes('ETHEREUM_FORK_RPC_URL: 
  }
});
test('Phase 6 and Phase 7 have no implicit public or legacy RPC fallback',()=>{
  for(const name of ['phase6-mutable-rpc-v1.mjs','phase7-fork-preflight-v1.mjs','run-job-file.mjs']){
    const content=fs.readFileSync(path.join(root,'packages/github-native-sim/src',name),'utf8');
    assert.doesNotMatch(content,/DEFAULT_ETHEREUM_FORK_RPC_URL|LEGACY_ETHEREUM_FORK_RPC_ENV|LEGACY_PHASE6_MUTABLE_RPC_ENV|LEGACY_ETHEREUM_ARCHIVE_RPC_ENV/);
  }
});
+'{{ secrets.'+secretName+' }}'),name);
  }
});
test('Phase 6 and Phase 7 have no implicit public or legacy RPC fallback',()=>{
  for(const name of ['phase6-mutable-rpc-v1.mjs','phase7-fork-preflight-v1.mjs','run-job-file.mjs']){
    const content=fs.readFileSync(path.join(root,'packages/github-native-sim/src',name),'utf8');
    assert.doesNotMatch(content,/DEFAULT_ETHEREUM_FORK_RPC_URL|LEGACY_ETHEREUM_FORK_RPC_ENV|LEGACY_PHASE6_MUTABLE_RPC_ENV|LEGACY_ETHEREUM_ARCHIVE_RPC_ENV/);
  }
});
