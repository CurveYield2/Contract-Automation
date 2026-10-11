import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const script=fileURLToPath(new URL('../../../scripts/phase0-telemetry-analysis-v1.mjs',import.meta.url));
async function fixture(){
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'phase0-telemetry-analysis-v1-'));
  const shard=path.join(root,'runs','abi-telemetry-001');
  await fs.mkdir(shard,{recursive:true});
  return{root,shard};
}
async function analyze(root){
  const summary=path.join(root,'summary.md');
  execFileSync(process.execPath,[script,root],{env:{...process.env,GITHUB_STEP_SUMMARY:summary},encoding:'utf8'});
  return{json:JSON.parse(await fs.readFile(path.join(root,'PHASE0_TELEMETRY_ANALYSIS_v1.json'),'utf8')),markdown:await fs.readFile(summary,'utf8')};
}
test('Phase-0 telemetry analysis counts raw outcomes and decoded reverts',async()=>{
  const f=await fixture();
  try{
    const rows=[
      {target:{qualifiedName:'A:B'},functionSignature:'deposit(uint256)',semanticFamily:'ECONOMIC',executionOutcome:'MINED_SUCCESS',positiveTransition:true},
      {target:{qualifiedName:'A:B'},functionSignature:'withdraw(uint256)',semanticFamily:'ECONOMIC',executionOutcome:'SIMULATED_REJECTION',positiveTransition:false},
      {target:{qualifiedName:'A:C'},functionSignature:'repay(uint256)',semanticFamily:'ECONOMIC',executionOutcome:'SUBMISSION_INFRASTRUCTURE_ERROR',positiveTransition:false}
    ];
    await fs.writeFile(path.join(f.shard,'RAW_SIMULATION_TRANSCRIPT_v1.jsonl'),rows.map(x=>JSON.stringify(x)).join('\n')+'\n');
    await fs.writeFile(path.join(f.shard,'RUN_SUMMARY_v1.json'),JSON.stringify({calls:3,status:'PASS',observationFailures:2,decodedRevertReasons:[{kind:'CUSTOM_ERROR',reason:'UnauthorizedCaller()',count:1}],reconciliation:{status:'PASS'},resetEvidence:{sentinelMatch:true}}));
    const r=await analyze(f.root);
    assert.equal(r.json.totals.rawCalls,3);
    assert.equal(r.json.totals.minedSuccess,1);
    assert.equal(r.json.totals.simulatedRejection,1);
    assert.equal(r.json.totals.infrastructureErrors,1);
    assert.equal(r.json.totals.positiveTransitions,1);
    assert.equal(r.json.totals.observationFailures,2);
    assert.equal(r.json.topReverts[0].count,1);
    assert.match(r.markdown,/UnauthorizedCaller/);
    assert.ok(r.json.findings.some(x=>x.code==='MISSING_OR_UNSTARTED_SHARDS'));
    assert.ok(r.json.findings.some(x=>x.code==='INFRASTRUCTURE_OR_UNKNOWN_SUBMISSION_OUTCOMES'));
  }finally{await fs.rm(f.root,{recursive:true,force:true});}
});
test('Phase-0 telemetry analysis retains failure diagnostics with missing raw evidence',async()=>{
  const f=await fixture();
  try{
    await fs.writeFile(path.join(f.shard,'RUN_SUMMARY_v1.json'),JSON.stringify({calls:10,status:'INCOMPLETE',observationFailures:0}));
    const r=await analyze(f.root);
    assert.equal(r.json.totals.rawCalls,0);
    for(const code of ['MISSING_RAW_TRANSCRIPT','NO_RAW_ABI_TELEMETRY_YET','RAW_CALL_COUNT_MISMATCH','INCOMPLETE_SHARD']){
      assert.ok(r.json.findings.some(x=>x.code===code),code);
    }
  }finally{await fs.rm(f.root,{recursive:true,force:true});}
});
