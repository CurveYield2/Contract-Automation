import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import solc from 'solc';
import * as ethers from 'ethers';
import {buildCompiledArtifactErrorSelectorIndexV1,decodeTelemetryRevertReasonV1,topDecodedTelemetryRevertsV1} from '../src/phase0-fixture-synthesis-v1.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');

async function freePort(){
  const server=net.createServer();
  await new Promise((resolve,reject)=>server.once('error',reject).listen(0,'127.0.0.1',resolve));
  const port=server.address().port;
  await new Promise(resolve=>server.close(resolve));
  return port;
}

async function startLocalAnvil(){
  const port=await freePort();
  const bin=path.join(root,'node_modules/@foundry-rs/anvil/bin.mjs');
  const child=spawn(process.execPath,[bin,'--host','127.0.0.1','--port',String(port),'--chain-id','31337','--silent'],{stdio:['ignore','ignore','pipe']});
  let stderr='';child.stderr.on('data',x=>{stderr+=String(x);});
  const provider=new ethers.JsonRpcProvider(`http://127.0.0.1:${port}`,31337,{staticNetwork:true});
  const deadline=Date.now()+10000;
  while(Date.now()<deadline){
    if(child.exitCode!==null)throw new Error('anvil exited before readiness: '+stderr);
    try{await provider.getBlockNumber();return{child,provider};}catch{}
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  child.kill('SIGKILL');
  throw new Error('anvil readiness timeout: '+stderr);
}

function compileSmokeContract(){
  const input={
    language:'Solidity',
    sources:{'Smoke.sol':{content:`// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;
contract Reverter {
  error SmokeCustom(uint256 code);
  function custom() external pure { revert SmokeCustom(7); }
  function stringy() external pure { revert("SMOKE_STRING"); }
}`}},
    settings:{outputSelection:{'*':{'*':['abi','evm.bytecode.object']}}}
  };
  const output=JSON.parse(solc.compile(JSON.stringify(input)));
  const failures=(output.errors??[]).filter(x=>x.severity==='error');
  assert.deepEqual(failures,[]);
  return output.contracts['Smoke.sol'].Reverter;
}

test('Stage-0 decoder resolves custom errors from compiled artifact ABIs and preserves string revert text on local Anvil',async()=>{
  const {child,provider}=await startLocalAnvil();
  try{
    const compiled=compileSmokeContract();
    const signer=await provider.getSigner(0);
    const factory=new ethers.ContractFactory(compiled.abi,'0x'+compiled.evm.bytecode.object,signer);
    const contract=await factory.deploy();
    await contract.waitForDeployment();
    const artifacts=[{sourceName:'Smoke.sol',contractName:'Reverter',abi:compiled.abi}];
    const selectorIndex=buildCompiledArtifactErrorSelectorIndexV1({ethers,artifacts});

    const customError=await contract.custom.staticCall().then(()=>null,error=>error);
    assert.ok(customError);
    assert.equal(decodeTelemetryRevertReasonV1({ethers,error:customError,selectorIndex}).reason,'SmokeCustom(uint256)');

    const stringError=await contract.stringy.staticCall().then(()=>null,error=>error);
    assert.ok(stringError);
    assert.equal(decodeTelemetryRevertReasonV1({ethers,error:stringError,selectorIndex}).reason,'SMOKE_STRING');

    const table=topDecodedTelemetryRevertsV1({
      ethers,artifacts,
      rows:[
        {executionOutcome:'SIMULATED_REJECTION',error:customError},
        {executionOutcome:'SIMULATED_REJECTION',error:customError},
        {executionOutcome:'SIMULATED_REJECTION',error:stringError}
      ]
    });
    assert.deepEqual(table.map(x=>[x.reason,x.count]),[['SmokeCustom(uint256)',2],['SMOKE_STRING',1]]);
  }finally{
    await provider.destroy();
    child.kill('SIGTERM');
  }
});

test('Stage-0 smoke wiring exposes independent telemetry and Medusa budgets and the required report fields',()=>{
  const runner=fs.readFileSync(path.join(root,'packages/github-native-sim/src/phase0-randomized-simulation-v1.mjs'),'utf8');
  const cli=fs.readFileSync(path.join(root,'scripts/run-phase0-randomized-simulation-v1.mjs'),'utf8');
  const workflow=fs.readFileSync(path.join(root,'.github/workflows/lite-phase0-simulation-testing-v1.yml'),'utf8');
  assert.match(cli,/telemetry-smoke-calls/);
  assert.match(runner,/telemetrySmokeCalls/);
  assert.match(runner,/telemetryRuns:1,callsPerRun:telemetrySmokeCalls/);
  assert.match(workflow,/telemetry_calls:/);
  for(const field of ['minedSuccess','minedRevert','simulatedRejection','positiveTransitions','positiveEconomicTransitions','accountingActionShare','observationReads']){
    assert.match(workflow,new RegExp(field));
  }
  assert.match(workflow,/decodedRevertReasons/);
  assert.match(workflow,/PHASE0_FIXTURE_SYNTHESIS_v1\.json/);
});
