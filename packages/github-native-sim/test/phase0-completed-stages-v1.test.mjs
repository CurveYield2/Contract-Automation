import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';

const moduleUrl=new URL('../src/phase0-completed-stages-v1.mjs',import.meta.url);
async function validator(){
  assert.ok(fs.existsSync(fileURLToPath(moduleUrl)),'universal completed-stage validator must exist');
  return (await import(moduleUrl)).validateCompletedPhase0StageV1;
}
function fixture(){
  return {
    stage:'MEDUSA',
    source:{campaignId:'synthetic',sourceSha256:'a'.repeat(64),qualifiedNames:['example/Counter.sol:Counter']},
    run:{id:12,status:'completed',conclusion:'success',head_sha:'b'.repeat(40),path:'.github/workflows/lite-phase0-randomized-simulation-v1.yml'},
    expected:{runId:12,headSha:'b'.repeat(40)},
    summary:{campaignId:'synthetic',status:'PASS',executionMode:'MEDUSA_ONLY',medusa:{status:'PASS',exitCode:0,observedCalls:100001,rawRandomBytes:false,accountingWrapperShare:0.8,targetContracts:[{qualifiedName:'example/Counter.sol:Counter',address:'0x'+'1'.repeat(40)}]},deployment:{status:'PASS',deployedContracts:[{qualifiedName:'example/Counter.sol:Counter',address:'0x'+'1'.repeat(40)}],coverage:{mutableTargets:1,sourcePlanUnresolved:0,sourceKnownMissingTargets:0}}},
    index:{sourceIdentity:{campaignId:'synthetic',sourceSha256:'a'.repeat(64)},executionNormalization:{policy:'ALL_EVM_PACKAGES_USE_CANONICAL_ETHEREUM_ANVIL_BASELINE'},fork:{engine:'anvil',chainId:1,baselineBlock:5,baselineBlockHash:'0x'+'c'.repeat(64)},policy:{realAbiCallsOnly:true,rawRandomBytes:false,accountingActionWeight:0.8,crossContractBursts:true}}
  };
}
test('completed Medusa evidence retains its original fork and run rather than claiming a rerun',async()=>{
  const validate=await validator(),f=fixture(),result=validate(f);
  assert.equal(result.workflowRunId,12);
  assert.deepEqual(result.fork,f.index.fork);
});
for(const [name,mutate] of [
  ['changed source',f=>f.index.sourceIdentity.sourceSha256='d'.repeat(64)],
  ['failed workflow',f=>f.run.conclusion='failure'],
  ['unexpected workflow commit',f=>f.run.head_sha='d'.repeat(40)],
  ['unbound fork',f=>delete f.index.fork.baselineBlockHash],
  ['incomplete deployment',f=>f.summary.deployment.coverage.sourcePlanUnresolved=1],
  ['unknown compiled target',f=>f.source.qualifiedNames=[]],
  ['too few observed calls',f=>f.summary.medusa.observedCalls=100000],
  ['random calldata policy',f=>f.index.policy.rawRandomBytes=true]
]){
  test('completed-stage reuse rejects '+name,async()=>{const validate=await validator(),f=fixture();mutate(f);assert.throws(()=>validate(f));});
}
test('telemetry reuse requires every completed shard, exact call count, and zero execution errors',async()=>{
  const validate=await validator(),f=fixture();f.stage='TELEMETRY';f.summary.executionMode='TELEMETRY_ONLY';
  f.summary.telemetry=Array.from({length:4},(_,i)=>({runId:'abi-telemetry-00'+(i+1),status:'PASS',calls:1200,errors:0,accountingFunctionCount:1,accountingActionShare:0.8}));
  assert.equal(validate(f).workflowRunId,12);
  f.summary.telemetry[3].calls=1199;assert.throws(()=>validate(f));
  f.summary.telemetry[3].calls=1200;f.summary.telemetry[0].errors=1;assert.throws(()=>validate(f));
});
