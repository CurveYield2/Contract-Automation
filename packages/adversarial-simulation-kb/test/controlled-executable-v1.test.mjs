import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { validateCoreRecordV1 } from '../src/core-schemas-v1.mjs';
import { digestKnowledgeRecordV1, validateExecutableContractV1 } from '../src/executables/contract-v1.mjs';
import { buildRegistriesV1 } from '../src/registry/build-v1.mjs';

const ROOT='packages/adversarial-simulation-kb';
const GREEN_SOURCE_COMMIT='295975e5d5b984c787bf1b42c6d113f494d3b719';
const GREEN_RUN_ID='32708603994';
const GREEN_CONTROLLER_ARTIFACT='8458feed625a435ae4b46cb456e8f0fc47f80787bcd16296317df692239138b1';
const GREEN_ZIP_DIGEST='d8c9a0d29c6205219d7b6c8ab49203a0defc89cb85b797038ad1a508668325a5';
const GREEN_SNAPSHOT_DIGEST='2f4a1c689c110ac6058a2e50c2c807d02b87f6123e3a2ccac50938d5cc2536ac';
const GREEN_BLOCK_NUMBER=25823897;
const GREEN_BLOCK_HASH='0x5aeaef9d22a9bd16c8ff81eff4003837d88d05f4722962a80b3065fc4bda5004';
const FIXTURE_ROOT=`${ROOT}/fixtures/pattern-0001-controlled-v1`;

function json(path){ return JSON.parse(fs.readFileSync(path,'utf8')); }
function sha256File(path){ return createHash('sha256').update(fs.readFileSync(path)).digest('hex'); }

const pattern=json(`${ROOT}/patterns/PATTERN-0001/pattern.json`);
const recipe=json(`${ROOT}/recipes/RECIPE-0001/recipe.json`);
const incident=json(`${ROOT}/incidents/EXP-2023-0001/incident.json`);
const incidentProof=json(`${ROOT}/incidents/EXP-2023-0001/proof.json`);
const recipeProof=json(`${ROOT}/recipes/RECIPE-0001/proof.json`);

function executable(){ return json(`${ROOT}/executables/EXEC-0001/executable.json`); }
function executableProof(){ return json(`${ROOT}/executables/EXEC-0001/proof.json`); }

test('K12 EXEC-0001 is a CONTROLLED Foundry reproduction bound to exact pattern, recipe, source, and GREEN run',()=>{
  const exec=executable();
  assert.equal(validateCoreRecordV1('executable',exec).status,'PASS');
  const contract=validateExecutableContractV1(exec,{knowledgeRecords:[pattern,recipe]});
  assert.equal(contract.status,'PASS',JSON.stringify(contract.errors));
  assert.equal(exec.executableId,'EXEC-0001');
  assert.equal(exec.executionMode,'CONTROLLED');
  assert.deepEqual(exec.incidentRefs,[]);
  assert.deepEqual(exec.patternRefs,['PATTERN-0001']);
  assert.deepEqual(exec.recipeRefs,['RECIPE-0001']);
  assert.deepEqual(exec.knowledgeBindings,[
    {kind:'pattern',id:'PATTERN-0001',revision:pattern.revision,digest:digestKnowledgeRecordV1(pattern)},
    {kind:'recipe',id:'RECIPE-0001',revision:recipe.revision,digest:digestKnowledgeRecordV1(recipe)},
  ]);
  assert.equal(exec.backend,'foundry');
  assert.equal(exec.toolVersion,'forge-1.7.1');
  assert.equal(exec.language,'solidity');
  assert.deepEqual(exec.sourceFiles,[
    {path:'foundry.toml',digest:sha256File(`${FIXTURE_ROOT}/foundry.toml`)},
    {path:'src/ControlledLendingFixture.sol',digest:sha256File(`${FIXTURE_ROOT}/src/ControlledLendingFixture.sol`)},
    {path:'test/Pattern0001ControlledReproduction.t.sol',digest:sha256File(`${FIXTURE_ROOT}/test/Pattern0001ControlledReproduction.t.sol`)},
  ]);
  assert.deepEqual(exec.requiredRpcForkState,{required:false,chain:null,archiveRequired:false,rpcEnvVar:null});
  assert.equal(exec.requiredBlockIdentity,null);
  assert.deepEqual(exec.lastQualification,{commit:GREEN_SOURCE_COMMIT,runId:GREEN_RUN_ID});
});

test('K12 controlled result records normalized state/economic deltas without claiming historical reproduction',()=>{
  const exec=executable();
  assert.deepEqual(exec.expectedResult,{
    kind:'CONTROLLED_REPRODUCTION',
    effect:'POST_ACTION_SOLVENCY_VIOLATION_WITH_PROFITABLE_ATTACKER_CONTROLLED_LIQUIDATION',
    initialHealthBps:20000,
    postReductionHealthBps:14000,
    minimumHealthBps:15000,
    initialAttackerNetValue:100,
    finalAttackerNetValue:110,
    initialProtocolLiquidity:1000,
    finalProtocolLiquidity:890,
  });
  assert.ok(exec.expectedEvidence.some(item=>item.kind==='FOUNDRY_ASSERTION'&&item.required===true));
  assert.ok(exec.expectedEvidence.some(item=>item.kind==='STATE_DELTA'&&item.required===true));
  assert.ok(exec.expectedEvidence.some(item=>item.kind==='ATTACKER_NET_VALUE'&&item.required===true));
  assert.ok(exec.expectedEvidence.some(item=>item.kind==='PROTOCOL_LIQUIDITY_DELTA'&&item.required===true));
  assert.equal(exec.proofStatusRef,'PROOF-0003');
  assert.doesNotMatch(JSON.stringify(exec),/HISTORICAL_REPRODUCTION/);
});

test('K12 PROOF-0003 advances only EXEC-0001 to CONTROLLED_REPRODUCTION and binds authoritative GREEN evidence',()=>{
  const proof=executableProof();
  assert.equal(validateCoreRecordV1('proof',proof).status,'PASS');
  assert.equal(proof.proofId,'PROOF-0003');
  assert.equal(proof.knowledgeRef,'EXEC-0001');
  assert.equal(proof.proofTier,'CONTROLLED_REPRODUCTION');
  assert.equal(proof.status,'ACTIVE');
  assert.deepEqual(proof.runIds,[GREEN_RUN_ID]);
  assert.equal(proof.qualifiedAtCommit,GREEN_SOURCE_COMMIT);
  assert.ok(proof.artifactDigests.includes(GREEN_CONTROLLER_ARTIFACT));
  assert.ok(proof.artifactDigests.includes(GREEN_ZIP_DIGEST));
  assert.ok(proof.artifactDigests.includes(GREEN_SNAPSHOT_DIGEST));
  assert.match(proof.claim,/controlled/i);
  assert.match(proof.limitations.join(' '),/not.*historical|historical.*not/i);
  assert.equal(incidentProof.proofTier,'SCHEMA_VALID');
  assert.equal(recipeProof.proofTier,'SCHEMA_VALID');
});

test('K12 checked-in registries deterministically include EXEC-0001 and PROOF-0003 without changing incident/recipe proof tiers',()=>{
  const exec=executable();
  const proof=executableProof();
  const generated=buildRegistriesV1({
    incidents:[incident], patterns:[pattern], recipes:[recipe], executables:[exec],
    proofs:[incidentProof,recipeProof,proof], relationships:[],
  }).registries;
  for(const name of Object.keys(generated)) assert.deepEqual(json(`${ROOT}/registry/${name}.json`),generated[name],name);
});

test('K12 recorded GREEN execution identity is exact and does not convert runner fork identity into a historical block requirement',()=>{
  const exec=executable();
  assert.equal(exec.requiredBlockIdentity,null);
  assert.equal(GREEN_BLOCK_NUMBER,25823897);
  assert.equal(GREEN_BLOCK_HASH,'0x5aeaef9d22a9bd16c8ff81eff4003837d88d05f4722962a80b3065fc4bda5004');
  assert.equal(GREEN_SNAPSHOT_DIGEST,'2f4a1c689c110ac6058a2e50c2c807d02b87f6123e3a2ccac50938d5cc2536ac');
});
