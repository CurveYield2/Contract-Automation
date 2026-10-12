import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validateCoreRecordV1 } from '../src/core-schemas-v1.mjs';
import {
  digestKnowledgeRecordV1,
  validateExecutableContractV1,
} from '../src/executables/contract-v1.mjs';

const ROOT='packages/adversarial-simulation-kb';
function json(path){ return JSON.parse(fs.readFileSync(path,'utf8')); }

const incident=json(`${ROOT}/incidents/EXP-2023-0001/incident.json`);
const pattern=json(`${ROOT}/patterns/PATTERN-0001/pattern.json`);
const recipe=json(`${ROOT}/recipes/RECIPE-0001/recipe.json`);
const knowledgeRecords=[incident,pattern,recipe];
const SHA40='9db631e93f562a67b0fedb13840ce74c80e2f3dc';

function fixture(){
  return {
    schemaVersion:'adversarial-kb-executable-v1',
    executableId:'EXEC-0001',
    revision:1,
    incidentRefs:[incident.incidentId],
    patternRefs:[pattern.patternId],
    recipeRefs:[recipe.recipeId],
    knowledgeBindings:[
      {kind:'incident',id:incident.incidentId,revision:incident.revision,digest:digestKnowledgeRecordV1(incident)},
      {kind:'pattern',id:pattern.patternId,revision:pattern.revision,digest:digestKnowledgeRecordV1(pattern)},
      {kind:'recipe',id:recipe.recipeId,revision:recipe.revision,digest:digestKnowledgeRecordV1(recipe)},
    ],
    backend:'foundry',
    toolVersion:'forge-1.3.1',
    language:'solidity',
    sourceFiles:[{path:'test/ControlledReproduction.t.sol',digest:'a'.repeat(64)}],
    executionMode:'CONTROLLED',
    expectedSetup:[{kind:'POSITION_SETUP'},{kind:'BASELINE_OBSERVATION'}],
    requiredRpcForkState:{required:false,chain:null,archiveRequired:false,rpcEnvVar:null},
    requiredBlockIdentity:null,
    requiredImpersonation:[],
    requiredTokenBalances:[],
    expectedResult:{kind:'CONTROLLED_REPRODUCTION',effect:'POST_ACTION_SOLVENCY_VIOLATION'},
    expectedEvidence:[{kind:'STATE_DELTA',required:true},{kind:'ATTACKER_NET_VALUE',required:true}],
    proofStatusRef:'PROOF-0003',
    lastQualification:null,
  };
}

test('K11 pattern and recipe records expose explicit revisions before executables may bind them',()=>{
  assert.equal(Number.isInteger(incident.revision),true);
  assert.equal(Number.isInteger(pattern.revision),true);
  assert.equal(Number.isInteger(recipe.revision),true);
  assert.equal(validateCoreRecordV1('pattern',pattern).status,'PASS');
  assert.equal(validateCoreRecordV1('recipe',recipe).status,'PASS');
});

test('K11 backend-neutral executable contract validates exact tool/file/effect/evidence and knowledge revision bindings',()=>{
  const executable=fixture();
  assert.equal(validateCoreRecordV1('executable',executable).status,'PASS');
  const result=validateExecutableContractV1(executable,{knowledgeRecords});
  assert.equal(result.status,'PASS',JSON.stringify(result.errors));
  assert.equal(result.mode,'CONTROLLED');
  assert.deepEqual(result.boundKnowledge,[incident.incidentId,pattern.patternId,recipe.recipeId]);
});

test('K11 knowledge binding fails closed on stale revision or content digest',()=>{
  const staleRevision=fixture();
  staleRevision.knowledgeBindings.find(x=>x.kind==='recipe').revision+=1;
  assert.equal(validateExecutableContractV1(staleRevision,{knowledgeRecords}).status,'FAIL');

  const staleDigest=fixture();
  staleDigest.knowledgeBindings.find(x=>x.kind==='pattern').digest='b'.repeat(64);
  assert.equal(validateExecutableContractV1(staleDigest,{knowledgeRecords}).status,'FAIL');
});

test('K11 historical and controlled execution modes have distinct fork/block obligations',()=>{
  const controlled=fixture();
  assert.equal(validateExecutableContractV1(controlled,{knowledgeRecords}).status,'PASS');

  const historical=fixture();
  historical.executionMode='HISTORICAL';
  historical.requiredRpcForkState={required:true,chain:'ethereum',archiveRequired:true,rpcEnvVar:'SIM_ARCHIVE_PRIMARY_ETHEREUM_01'};
  historical.requiredBlockIdentity={blockNumber:16817995,blockHash:`0x${'c'.repeat(64)}`};
  assert.equal(validateExecutableContractV1(historical,{knowledgeRecords}).status,'PASS');

  const missingBlock=structuredClone(historical);
  missingBlock.requiredBlockIdentity=null;
  assert.equal(validateExecutableContractV1(missingBlock,{knowledgeRecords}).status,'FAIL');

  const currentStateMasqueradingHistorical=structuredClone(historical);
  currentStateMasqueradingHistorical.requiredRpcForkState.archiveRequired=false;
  assert.equal(validateExecutableContractV1(currentStateMasqueradingHistorical,{knowledgeRecords}).status,'FAIL');
});

test('K11 rejects secret RPC/private-key material and arbitrary shell escape fields recursively',()=>{
  for(const mutation of [
    executable=>{ executable.requiredRpcForkState.rpcUrl='https://secret-rpc.example'; },
    executable=>{ executable.expectedSetup.push({kind:'ATTACKER_SETUP',privateKey:'0xdeadbeef'}); },
    executable=>{ executable.expectedSetup.push({kind:'ATTACKER_SETUP',mnemonic:'twelve secret words'}); },
    executable=>{ executable.expectedSetup.push({kind:'ATTACKER_SETUP',shell:'bash'}); },
    executable=>{ executable.expectedSetup.push({kind:'ATTACKER_SETUP',command:'curl example.com'}); },
  ]){
    const executable=fixture(); mutation(executable);
    assert.equal(validateExecutableContractV1(executable,{knowledgeRecords}).status,'FAIL');
  }
});

test('K11 no prior qualification may be represented truthfully with null lastQualification',()=>{
  const executable=fixture();
  assert.equal(executable.lastQualification,null);
  assert.equal(validateCoreRecordV1('executable',executable).status,'PASS');
  const falselyQualified=fixture();
  falselyQualified.lastQualification={commit:SHA40,runId:''};
  assert.equal(validateCoreRecordV1('executable',falselyQualified).status,'FAIL');
});
