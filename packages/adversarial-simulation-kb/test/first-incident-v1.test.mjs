import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validateCoreRecordV1 } from '../src/core-schemas-v1.mjs';
import { validateIncidentReferenceBasisV1, validateSourceRegistryV1 } from '../src/references/validate-v1.mjs';
import { validatePrimitiveTagsV1 } from '../src/taxonomy/validate-v1.mjs';
import { buildRegistriesV1 } from '../src/registry/build-v1.mjs';

const ROOT='packages/adversarial-simulation-kb';
const INCIDENT_DIR=`${ROOT}/incidents/EXP-2023-0001`;
function json(path){ return JSON.parse(fs.readFileSync(path,'utf8')); }

test('K07 Euler incident is a strict source-bound VERIFIED historical incident',()=>{
  const incident=json(`${INCIDENT_DIR}/incident.json`);
  const references=json(`${INCIDENT_DIR}/references.json`);
  const sourceRegistry=json(`${ROOT}/registry/SOURCE_REGISTRY_v1.json`);
  const sourceMap=new Map(sourceRegistry.sources.map(source=>[source.sourceId,source]));

  assert.equal(validateCoreRecordV1('incident',incident).status,'PASS');
  assert.equal(incident.incidentId,'EXP-2023-0001');
  assert.equal(incident.incidentStatus,'VERIFIED');
  assert.equal(incident.affectedProtocol,'Euler V1');
  assert.deepEqual(incident.affectedChain,['ethereum']);
  assert.ok(incident.affectedContracts.includes('0x27182842E098f60e3D576794A5bFFb0777E025d3'));
  assert.deepEqual(references.sourceIds,incident.references);
  assert.equal(validateSourceRegistryV1(sourceRegistry).status,'PASS');
  assert.equal(validateIncidentReferenceBasisV1({incidentStatus:incident.incidentStatus,references:incident.references},sourceMap).status,'PASS');
});

test('K07 incident primitives are canonical and its representative transaction identity is explicitly preserved',()=>{
  const incident=json(`${INCIDENT_DIR}/incident.json`);
  const references=json(`${INCIDENT_DIR}/references.json`);
  assert.equal(validatePrimitiveTagsV1(incident.attackPrimitives).status,'PASS');
  assert.ok(incident.attackPrimitives.includes('DONATION'));
  assert.ok(incident.attackPrimitives.includes('SOLVENCY_BYPASS'));
  assert.ok(incident.attackPrimitives.includes('FLASH_LIQUIDITY'));
  assert.equal(references.representativeExploitTransaction.chain,'ethereum');
  assert.equal(references.representativeExploitTransaction.blockNumber,16817996);
  assert.equal(references.representativeExploitTransaction.transactionHash,'0xc310a0affe2169d1f6feec1c63dbc7f7c62a887fa48795d327d4d2da2d6b111d');
});

test('K07 record states the multi-transaction scope limitation instead of treating one DAI transaction as the entire incident',()=>{
  const incident=json(`${INCIDENT_DIR}/incident.json`);
  assert.ok(incident.limitations.some(item=>typeof item==='string'&&item.includes('representative DAI exploit transaction')));
  assert.ok(incident.limitations.some(item=>typeof item==='string'&&item.includes('multiple exploit transactions')));
});

test('K07 proof is truthful SCHEMA_VALID evidence and generated registries match the checked-in incident corpus',()=>{
  const incident=json(`${INCIDENT_DIR}/incident.json`);
  const proof=json(`${INCIDENT_DIR}/proof.json`);
  assert.equal(validateCoreRecordV1('proof',proof).status,'PASS');
  assert.equal(proof.knowledgeRef,incident.incidentId);
  assert.equal(proof.proofTier,'SCHEMA_VALID');
  assert.notEqual(proof.proofTier,'HISTORICAL_REPRODUCTION');
  assert.ok(proof.limitations.some(item=>typeof item==='string'&&item.includes('historical reproduction')));

  const generated=buildRegistriesV1({incidents:[incident],patterns:[],recipes:[],executables:[],proofs:[proof],relationships:[]}).registries;
  for(const name of Object.keys(generated)){
    assert.deepEqual(json(`${ROOT}/registry/${name}.json`),generated[name],name);
  }
});
