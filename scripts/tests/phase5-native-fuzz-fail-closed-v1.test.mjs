import test from 'node:test';
import assert from 'node:assert/strict';
import {runNativeFuzzAnalysis,inspectForgeTestEvidenceV1} from '../../packages/github-native-sim/src/native-fuzz.mjs';

const input={sourceCommit:'a'.repeat(40),projectRoot:'/tmp/audit-only-no-execution',rawArtifactRef:'github-actions://example/runs/1/artifacts/forge',command:'forge',args:['test']};
const fake=(stdout,stderr='',exitCode=0)=>({runCommand:async()=>({stdout,stderr,exitCode})});
test('compiler errors with exit 0 are failures, never completed evidence',async()=>{
  const r=await runNativeFuzzAnalysis(input,fake('Unable to resolve imports: ReClammPool.sol\nCompiling 119 files with Solc 0.8.30','Error: Compiler run failed:\nParserError: Source not found',0));
  assert.equal(r.componentStatus,'FAILED');
  assert.equal(r.failureKind,'COMPILER_OUTPUT_FAILURE');
  assert.equal(r.testExecution.successful,false);
  assert.equal(r.testExecution.compilerFailure,true);
});
test('exit 0 with zero passing test results fails closed',async()=>{
  const r=await runNativeFuzzAnalysis(input,fake('Compiling 119 files with Solc 0.8.30','',0));
  assert.equal(r.componentStatus,'FAILED');assert.equal(r.failureKind,'NO_SUCCESSFUL_TEST_EXECUTION');
});
test('a real successful forge suite with executed tests passes',async()=>{
  const out='[PASS] testFuzz_P4Cand001_HealthyControl(uint96) (runs: 256)\nRan 1 test for Contract\nSuite result: ok. 1 passed; 0 failed; 0 skipped; finished in 1.1s';
  const r=await runNativeFuzzAnalysis(input,fake(out));
  assert.equal(r.componentStatus,'COMPLETED');assert.equal(r.testExecution.passed,1);
  assert.deepEqual(r.testExecution.selectedTests,['testFuzz_P4Cand001_HealthyControl']);
});
test('forge output with a failing suite cannot be rescued by exit 0',async()=>{
  const out='[FAIL] testFuzz_P4Cand002_Execute()\nSuite result: FAILED. 0 passed; 1 failed; 0 skipped;';
  const r=await runNativeFuzzAnalysis(input,fake(out));
  assert.equal(r.componentStatus,'FAILED');
});
test('missing suite summaries never count as successful even with PASS marker',()=>{
  assert.equal(inspectForgeTestEvidenceV1('forge',{stdout:'[PASS] testOne()',stderr:''}).successful,false);
});
