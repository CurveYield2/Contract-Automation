import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  validateReferenceV1,
  validateSourceRegistryV1,
  validateIncidentReferenceBasisV1,
  collectSourceConflictsV1,
} from '../src/references/validate-v1.mjs';

const makeSource=(overrides={})=>({
  schemaVersion:'adversarial-kb-reference-v1',
  sourceId:'SOURCE-0001',
  revision:1,
  title:'Primary onchain exploit transaction',
  referenceType:'ONCHAIN_TRANSACTION',
  confidence:'PRIMARY_ONCHAIN',
  url:'https://etherscan.io/tx/0x'+'11'.repeat(32),
  chain:'ethereum',
  transactionHash:'0x'+'11'.repeat(32),
  contractAddress:null,
  publisher:'Ethereum',
  publishedAt:'2026-01-01T00:00:00Z',
  claims:[],
  contradicts:[],
  limitations:[],
  status:'ACTIVE',
  ...overrides,
});

test('reference and empty source registry fixtures validate structurally',()=>{
  const source=makeSource();
  assert.equal(validateReferenceV1(source).status,'PASS');
  const registry=JSON.parse(fs.readFileSync('packages/adversarial-simulation-kb/registry/SOURCE_REGISTRY_v1.json','utf8'));
  assert.equal(validateSourceRegistryV1(registry).status,'PASS');

  assert.equal(validateReferenceV1(makeSource({url:'javascript:alert(1)'})).status,'FAIL');
  assert.equal(validateReferenceV1(makeSource({transactionHash:'0x1234'})).status,'FAIL');
  assert.equal(validateReferenceV1(makeSource({referenceType:'VERIFIED_CONTRACT_SOURCE',transactionHash:null,contractAddress:'0x1234'})).status,'FAIL');
});

test('VERIFIED incidents require resolved primary evidence and reject unreferenced verification',()=>{
  const primary=makeSource();
  const secondary=makeSource({sourceId:'SOURCE-0002',referenceType:'INDEPENDENT_TECHNICAL_ANALYSIS',confidence:'SECONDARY_TECHNICAL',transactionHash:null,url:'https://example.com/analysis'});
  const sources=new Map([[primary.sourceId,primary],[secondary.sourceId,secondary]]);

  assert.equal(validateIncidentReferenceBasisV1({incidentStatus:'VERIFIED',references:[]},sources).status,'FAIL');
  assert.equal(validateIncidentReferenceBasisV1({incidentStatus:'VERIFIED',references:[secondary.sourceId]},sources).status,'FAIL');
  assert.equal(validateIncidentReferenceBasisV1({incidentStatus:'VERIFIED',references:[primary.sourceId]},sources).status,'PASS');
  assert.equal(validateIncidentReferenceBasisV1({incidentStatus:'VERIFIED',references:['SOURCE-9999']},sources).status,'FAIL');
});

test('REFERENCE_ONLY incidents may honestly rely on secondary material',()=>{
  const secondary=makeSource({sourceId:'SOURCE-0002',referenceType:'INDEPENDENT_TECHNICAL_ANALYSIS',confidence:'SECONDARY_TECHNICAL',transactionHash:null,url:'https://example.com/analysis',status:'REFERENCE_ONLY'});
  const sources=new Map([[secondary.sourceId,secondary]]);
  const result=validateIncidentReferenceBasisV1({incidentStatus:'REFERENCE_ONLY',references:[secondary.sourceId]},sources);
  assert.equal(result.status,'PASS',JSON.stringify(result.errors));
});

test('conflicting sources remain explicitly linked and registry rejects dangling contradiction IDs',()=>{
  const a=makeSource({sourceId:'SOURCE-0001',contradicts:['SOURCE-0002']});
  const b=makeSource({sourceId:'SOURCE-0002',referenceType:'INDEPENDENT_TECHNICAL_ANALYSIS',confidence:'SECONDARY_TECHNICAL',transactionHash:null,url:'https://example.com/dispute',contradicts:['SOURCE-0001'],status:'DISPUTED'});
  const registry={schemaVersion:'adversarial-kb-source-registry-v1',revision:1,sources:[a,b]};
  const valid=validateSourceRegistryV1(registry);
  assert.equal(valid.status,'PASS',JSON.stringify(valid.errors));
  assert.deepEqual(valid.conflicts,[{left:'SOURCE-0001',right:'SOURCE-0002'}]);
  assert.deepEqual(collectSourceConflictsV1([a,b]),[{left:'SOURCE-0001',right:'SOURCE-0002'}]);

  const dangling=structuredClone(registry);
  dangling.sources[0].contradicts=['SOURCE-9999'];
  assert.equal(validateSourceRegistryV1(dangling).status,'FAIL');
});
