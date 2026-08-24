import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRegistriesV1,
  canonicalRegistryBytesV1,
  digestRegistryV1,
  validateRegistryGraphV1,
} from '../src/registry/build-v1.mjs';

const incident=(overrides={})=>({
  incidentId:'EXP-2026-0002',
  affectedChain:['Ethereum'],
  affectedProtocol:'Protocol B',
  attackPrimitives:['DONATION','ACCOUNTING_DESYNC'],
  generalizedPatternRefs:['PATTERN-0002'],
  proofStatusRef:'PROOF-0002',
  ...overrides,
});
const pattern=(overrides={})=>({
  patternId:'PATTERN-0002',
  rootCauseClass:['DONATION','ACCOUNTING_DESYNC'],
  historicalIncidentRefs:['EXP-2026-0002'],
  recipeRefs:['RECIPE-0002'],
  ...overrides,
});
const recipe=(overrides={})=>({
  recipeId:'RECIPE-0002',
  patternRefs:['PATTERN-0002'],
  targetTopologies:['ERC4626 / share vault'],
  executableRefs:['EXEC-0002'],
  proofStatusRef:'PROOF-0003',
  ...overrides,
});
const executable=(overrides={})=>({
  executableId:'EXEC-0002',
  incidentRefs:[],
  patternRefs:['PATTERN-0002'],
  recipeRefs:['RECIPE-0002'],
  proofStatusRef:'PROOF-0004',
  ...overrides,
});
const proof=(overrides={})=>({
  proofId:'PROOF-0002',
  knowledgeRef:'EXP-2026-0002',
  proofTier:'SCHEMA_VALID',
  status:'ACTIVE',
  ...overrides,
});

function corpus(){
  return {
    incidents:[incident(),incident({incidentId:'EXP-2026-0001',affectedChain:['Arbitrum'],affectedProtocol:'Protocol A',attackPrimitives:['REENTRANCY'],generalizedPatternRefs:[],proofStatusRef:'PROOF-0001'})],
    patterns:[pattern()],
    recipes:[recipe()],
    executables:[executable()],
    proofs:[
      proof({proofId:'PROOF-0001',knowledgeRef:'EXP-2026-0001',proofTier:'REFERENCE_ONLY',status:'REFERENCE_ONLY'}),
      proof(),
      proof({proofId:'PROOF-0003',knowledgeRef:'RECIPE-0002'}),
      proof({proofId:'PROOF-0004',knowledgeRef:'EXEC-0002'}),
    ],
    relationships:[{from:'EXP-2026-0002',type:'SAME_ROOT_CAUSE_AS',to:'EXP-2026-0001'}],
  };
}

test('same content set in different input order yields identical registry bytes and digests',()=>{
  const a=corpus();
  const b=structuredClone(a);
  for(const key of ['incidents','patterns','recipes','executables','proofs','relationships']) b[key].reverse();
  const first=buildRegistriesV1(a);
  const second=buildRegistriesV1(b);
  assert.deepEqual(first.registries,second.registries);
  assert.deepEqual(first.digests,second.digests);
  for(const [name,registry] of Object.entries(first.registries)){
    assert.equal(digestRegistryV1(registry),first.digests[name]);
    assert.equal(canonicalRegistryBytesV1(registry),canonicalRegistryBytesV1(second.registries[name]));
  }
});

test('registries and indexes are sorted and searchable by primitive, topology, chain, and proof tier',()=>{
  const {registries}=buildRegistriesV1(corpus());
  assert.deepEqual(registries.INCIDENT_REGISTRY_v1.records.map(x=>x.incidentId),['EXP-2026-0001','EXP-2026-0002']);
  assert.deepEqual(registries.BY_PRIMITIVE_v1.index.DONATION,['EXP-2026-0002','PATTERN-0002']);
  assert.deepEqual(registries.BY_PROTOCOL_TOPOLOGY_v1.index['erc4626 / share vault'],['RECIPE-0002']);
  assert.deepEqual(registries.BY_CHAIN_v1.index.ethereum,['EXP-2026-0002']);
  assert.deepEqual(registries.BY_PROOF_STATUS_v1.index.SCHEMA_VALID,['EXEC-0002','EXP-2026-0002','RECIPE-0002']);
});

test('duplicate stable IDs are rejected before registry generation',()=>{
  const input=corpus();
  input.incidents.push(structuredClone(input.incidents[0]));
  assert.throws(()=>buildRegistriesV1(input),/duplicate incidentId/i);
});

test('dangling cross-references and incident relationships fail closed',()=>{
  const danglingPattern=corpus();
  danglingPattern.incidents[0].generalizedPatternRefs=['PATTERN-9999'];
  assert.equal(validateRegistryGraphV1(danglingPattern).status,'FAIL');
  assert.throws(()=>buildRegistriesV1(danglingPattern),/dangling/i);

  const danglingRelationship=corpus();
  danglingRelationship.relationships=[{from:'EXP-2026-0002',type:'VARIANT_OF',to:'EXP-2026-9999'}];
  assert.equal(validateRegistryGraphV1(danglingRelationship).status,'FAIL');
});

test('empty corpus generation remains deterministic and produces empty canonical records and indexes',()=>{
  const input={incidents:[],patterns:[],recipes:[],executables:[],proofs:[],relationships:[]};
  const first=buildRegistriesV1(input);
  const second=buildRegistriesV1(structuredClone(input));
  assert.deepEqual(first,second);
  for(const [name,registry] of Object.entries(first.registries)){
    assert.equal(digestRegistryV1(registry),first.digests[name]);
    if(name.endsWith('_REGISTRY_v1')) assert.deepEqual(registry.records,[]);
    else assert.deepEqual(registry.index,{});
  }
});
