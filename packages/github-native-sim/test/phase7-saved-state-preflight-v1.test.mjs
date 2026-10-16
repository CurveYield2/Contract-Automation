import test from 'node:test';
import assert from 'node:assert/strict';
import {runPhase7ForkPreflightV1} from '../src/phase7-fork-preflight-v1.mjs';
import {runPhase7ForkPreflightV2} from '../src/phase7-fork-preflight-v2.mjs';

const expectedBlock=25819000;
const request=()=>({
  requestId:'dar-'+'c'.repeat(32),
  profileId:'github-native-simulate-v2',phaseId:'fork-simulation-lifecycle',
  source:{commit:'a'.repeat(40)},
  configuration:{evmVersion:'cancun',simulation:{chain:'ethereum',block:expectedBlock,
    workflow:{steps:[{action:'snapshot',alias:'baseline',label:'saved deployment baseline'}]}}}
});
const savedEnv={V7_PHASE0_FORK_STATE_PATH:'/tmp/trusted-stage.json',
  V7_PHASE0_FORK_FINAL_BLOCK:String(expectedBlock)};
function makeEngine({chainId='0x1',block=expectedBlock}={}){
  return {engine:'anvil',provider:{
    async send(method){
      if(method==='eth_chainId')return chainId;
      if(method==='eth_blockNumber')return '0x'+block.toString(16);
      if(method==='anvil_impersonateAccount'||method==='anvil_stopImpersonatingAccount')return true;
      if(method==='evm_setAccountBalance')return true;
      throw Error('unexpected RPC '+method);
    },
    async getBlock(n){return{number:n,hash:'0x'+'ab'.repeat(32)};},
    async getBalance(){return 10n**18n;},
    async getCode(){return '0x6000';}
  },close:async()=>{}};
}
test('saved state preflight uses no remote RPC, binds pinned block and still checks impersonation',async()=>{
 let calls=0;
 const pre=await runPhase7ForkPreflightV1({
  request:request(),environment:savedEnv,
  startEngine:async args=>{
    calls++;assert.equal(args.forkUrl,null);
    assert.equal(args.loadStatePath,savedEnv.V7_PHASE0_FORK_STATE_PATH);
    return makeEngine();
  },
  probeUpstreamIdentity:async()=>{throw Error('saved state must not invoke archive RPC');}
 });
 assert.equal(calls,1);
 assert.equal(pre.status,'PASS',JSON.stringify(pre));
 assert.equal(pre.checks.snapshotBinding.status,'PASS');
 assert.equal(pre.checks.pinnedBlockState.status,'PASS');
 assert.equal(pre.checks.impersonationBalanceControl.status,'PASS');
 assert.equal(pre.checks.targetCode.status,'UNAVAILABLE');
});
test('saved state never silently downgrades wrong pinned block or wrong chain',async()=>{
 let calls=0;
 const startEngine=async()=>{calls++;return makeEngine({chainId:'0x2'});};
 const r={...request(),configuration:{...request().configuration,
  simulation:{...request().configuration.simulation,block:expectedBlock+1}}};
 const mismatch=await runPhase7ForkPreflightV1({request:r,environment:savedEnv,startEngine});
 assert.equal(mismatch.status,'FAIL');
 assert.equal(mismatch.failureKind,'PHASE0_SAVED_STATE_MISMATCH');
 assert.equal(calls,0);
 const wrongChain=await runPhase7ForkPreflightV1({request:request(),environment:savedEnv,startEngine});
 assert.equal(wrongChain.status,'FAIL');
 assert.equal(wrongChain.checks.chainIdentity.status,'FAIL');
});

test('v26 snapshot recipe accepts literal deployed target but refuses missing state or wrong mode',async()=>{
 const r=request();
 r.configuration.harness={recipeId:'phase0-snapshot-targeted-v1'};
 r.configuration.simulation.workflow={steps:[
   {action:'snapshot',alias:'baseline',label:'pin persisted Phase 0 baseline'},
   {action:'staticCall',target:'0x000000000000000000000000000000000000bEEF',
    function:'owner() view returns (address)',args:[],label:'check deployed owner'}
 ]};
 const options={request:r,environment:savedEnv,startEngine:async()=>makeEngine()};
 const pass=await runPhase7ForkPreflightV2(options);
 assert.equal(pass.status,'PASS',JSON.stringify(pass));
 assert.equal(pass.checks.targetCode.status,'PASS');
 assert.equal(pass.checks.lifecycleRecipe.status,'PASS');
 const missing=await runPhase7ForkPreflightV2({...options,environment:{}});
 assert.equal(missing.failureKind,'PHASE0_SNAPSHOT_RECIPE_UNBOUND');
 const wrong=structuredClone(r);wrong.configuration.harness.recipeId='external-readiness-v1';
 const rejected=await runPhase7ForkPreflightV2({...options,request:wrong});
 assert.equal(rejected.failureKind,'SNAPSHOT_RECIPE_MISMATCH');
 const noTarget=structuredClone(r);
 noTarget.configuration.simulation.workflow.steps.pop();
 const rejectedTarget=await runPhase7ForkPreflightV2({...options,request:noTarget});
 assert.equal(rejectedTarget.failureKind,'PHASE0_SNAPSHOT_RECIPE_UNBOUND');
});
