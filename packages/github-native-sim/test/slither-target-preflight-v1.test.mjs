import test from 'node:test';
import assert from 'node:assert/strict';
import { runTargetSlitherPreflightV1 } from '../src/slither-target-preflight-v1.mjs';

function build(overrides={}) {
  return {
    status:'completed', system:'solc-standard-json', compilerVersion:'0.8.28',
    sourceInventory:['contracts/A.sol'],
    buildInfo:[],
    artifacts:[{sourceName:'contracts/A.sol',contractName:'A',bytecode:'0x6000',deployedBytecode:'0x6000'}],
    ...overrides,
  };
}

function commands({version='0.11.6',smokeExitCode=0,smokeStdout='{"success":true,"error":null,"results":{"printers":[]}}',smokeStderr=''}={}) {
  const calls=[];
  return {
    calls,
    runCommand:async ({command,args,cwd})=>{
      calls.push({command,args:[...args],cwd});
      assert.equal(command,'slither');
      if(args[0]==='--version') return {exitCode:0,stdout:version,stderr:''};
      return {exitCode:smokeExitCode,stdout:smokeStdout,stderr:smokeStderr};
    },
  };
}

test('Slither actual-target preflight binds to accepted build and proves the target build view',async()=>{
  const harness=commands();
  const receipt=await runTargetSlitherPreflightV1({projectRoot:'/tmp/slither-target',sourceCommit:'1'.repeat(40),build:build()}, {runCommand:harness.runCommand});
  assert.equal(receipt.status,'PREFLIGHT_PASS');
  assert.match(receipt.acceptedBuildDigest,/^[0-9a-f]{64}$/);
  assert.equal(receipt.targetSmoke.status,'PASS');
  assert.equal(receipt.targetSmoke.outputParseable,true);
  assert.deepEqual(harness.calls.map(x=>x.args[0]),['--version','.']);
});

test('Slither actual-target preflight blocks wrong pinned tool version before target analysis',async()=>{
  const harness=commands({version:'0.12.0'});
  const receipt=await runTargetSlitherPreflightV1({projectRoot:'/tmp/slither-target',sourceCommit:'1'.repeat(40),build:build()}, {runCommand:harness.runCommand});
  assert.equal(receipt.firstFailure,'SLITHER_VERSION_MISMATCH');
  assert.equal(harness.calls.length,1);
});

test('Slither actual-target preflight reports target build-view incompatibility with raw compiler diagnostic',async()=>{
  const harness=commands({smokeExitCode:1,smokeStdout:'',smokeStderr:'crytic-compile failed: Source @openzeppelin/contracts/access/Ownable.sol not found'});
  const receipt=await runTargetSlitherPreflightV1({projectRoot:'/tmp/slither-target',sourceCommit:'1'.repeat(40),build:build()}, {runCommand:harness.runCommand});
  assert.equal(receipt.firstFailure,'SLITHER_BUILD_VIEW_INCOMPATIBLE');
  const failure=receipt.diagnostics.find(x=>x.failureCode==='SLITHER_BUILD_VIEW_INCOMPATIBLE');
  assert.match(JSON.stringify(failure.observed),/@openzeppelin\/contracts\/access\/Ownable\.sol/);
  assert.match(failure.remediation,/accepted build|project|build view/i);
});

test('Slither actual-target preflight distinguishes unparseable smoke output from build-view failure',async()=>{
  const harness=commands({smokeExitCode:0,smokeStdout:'not-json',smokeStderr:''});
  const receipt=await runTargetSlitherPreflightV1({projectRoot:'/tmp/slither-target',sourceCommit:'1'.repeat(40),build:build()}, {runCommand:harness.runCommand});
  assert.equal(receipt.firstFailure,'SLITHER_SMOKE_OUTPUT_INCOMPATIBLE');
});

test('Slither preflight records no-Solidity applicability without invoking target smoke',async()=>{
  const harness=commands();
  const receipt=await runTargetSlitherPreflightV1({projectRoot:'/tmp/slither-target',sourceCommit:'1'.repeat(40),build:build({sourceInventory:['contracts/Vault.vy'],artifacts:[]})}, {runCommand:harness.runCommand});
  assert.equal(receipt.firstFailure,'SLITHER_NO_SOLIDITY_TARGETS');
  assert.equal(harness.calls.length,1);
  assert.equal(receipt.targetSmoke.status,'NOT_REQUIRED');
});
