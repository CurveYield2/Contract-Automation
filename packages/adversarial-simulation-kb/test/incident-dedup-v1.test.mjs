import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildIncidentDedupKeyV1,
  compareIncidentsForDedupV1,
  deduplicateIncidentCandidatesV1,
} from '../src/incidents/deduplicate-v1.mjs';
import {
  INCIDENT_RELATIONSHIP_TYPES_V1,
  validateIncidentRelationshipsV1,
} from '../src/incidents/relationships-v1.mjs';

const TX_A='0x'+'aa'.repeat(32);
const TX_B='0x'+'bb'.repeat(32);
const CONTRACT_A='0x'+'11'.repeat(20);

function incident(overrides={}) {
  return {
    incidentId:'EXP-2026-0001',
    affectedChain:['Ethereum'],
    affectedProtocol:' Example Protocol ',
    incidentDate:'2026-05-01',
    affectedContracts:[CONTRACT_A.toUpperCase()],
    transactionHashes:[TX_A.toUpperCase()],
    rootCauseFingerprint:' balance-derived share rate | donation ',
    references:['SOURCE-0001'],
    ...overrides,
  };
}

test('K05 normalizes chain/protocol/date/transaction/address/root-cause keys deterministically',()=>{
  const key=buildIncidentDedupKeyV1(incident());
  assert.deepEqual(key.chains,['ethereum']);
  assert.equal(key.protocol,'example protocol');
  assert.equal(key.incidentDate,'2026-05-01');
  assert.deepEqual(key.transactionHashes,[TX_A]);
  assert.deepEqual(key.primaryAffectedContracts,[CONTRACT_A]);
  assert.equal(key.rootCauseFingerprint,'balance-derived share rate|donation');
});

test('exact transaction duplicates collapse to one incident while preserving all references',()=>{
  const a=incident({references:['SOURCE-0001','SOURCE-0002']});
  const b=incident({incidentId:'EXP-2026-0099',affectedProtocol:'EXAMPLE PROTOCOL',references:['SOURCE-0003'],transactionHashes:[TX_A]});
  const comparison=compareIncidentsForDedupV1(a,b);
  assert.equal(comparison.classification,'SAME_INCIDENT');
  assert.equal(comparison.reason,'EXACT_TRANSACTION_MATCH');

  const result=deduplicateIncidentCandidatesV1([a,b]);
  assert.equal(result.incidents.length,1);
  assert.deepEqual(result.incidents[0].references,['SOURCE-0001','SOURCE-0002','SOURCE-0003']);
  assert.deepEqual(result.mergedIncidentIds,['EXP-2026-0099']);
});

test('probable duplicate fingerprint requires contextual agreement and never collapses a distinct transaction variant',()=>{
  const base=incident({transactionHashes:[]});
  const probable=incident({incidentId:'EXP-2026-0002',transactionHashes:[],affectedContracts:[CONTRACT_A.toLowerCase()]});
  const variant=incident({incidentId:'EXP-2026-0003',transactionHashes:[TX_B],rootCauseFingerprint:'balance-derived share rate | donation'});

  assert.equal(compareIncidentsForDedupV1(base,probable).classification,'PROBABLE_SAME_INCIDENT');
  assert.equal(compareIncidentsForDedupV1(base,variant).classification,'VARIANT_OR_RELATED');
  const result=deduplicateIncidentCandidatesV1([base,variant]);
  assert.equal(result.incidents.length,2);
});

test('incident-family relationship types are exact, directed where applicable, and reject dangling/self links',()=>{
  assert.deepEqual([...INCIDENT_RELATIONSHIP_TYPES_V1].sort(),[
    'DISPUTED_WITH','FORK_OF_PROTOCOL_INCIDENT','INSPIRED_BY','REPLAY_OF','SAME_ROOT_CAUSE_AS','SUPERSEDES','VARIANT_OF',
  ].sort());
  const known=new Set(['EXP-2026-0001','EXP-2026-0002','EXP-2026-0003']);
  const relationships=[
    {from:'EXP-2026-0002',type:'VARIANT_OF',to:'EXP-2026-0001'},
    {from:'EXP-2026-0003',type:'SAME_ROOT_CAUSE_AS',to:'EXP-2026-0001'},
    {from:'EXP-2026-0001',type:'DISPUTED_WITH',to:'EXP-2026-0003'},
  ];
  assert.equal(validateIncidentRelationshipsV1(relationships,known).status,'PASS');
  assert.equal(validateIncidentRelationshipsV1([{from:'EXP-2026-0001',type:'VARIANT_OF',to:'EXP-2026-0001'}],known).status,'FAIL');
  assert.equal(validateIncidentRelationshipsV1([{from:'EXP-2026-0001',type:'UNKNOWN',to:'EXP-2026-0002'}],known).status,'FAIL');
  assert.equal(validateIncidentRelationshipsV1([{from:'EXP-2026-0001',type:'REPLAY_OF',to:'EXP-2026-9999'}],known).status,'FAIL');
});

test('same incident and exploit variant remain distinct concepts',()=>{
  const original=incident();
  const same=incident({incidentId:'EXP-2026-0042',references:['SOURCE-0042']});
  const variant=incident({incidentId:'EXP-2026-0043',transactionHashes:[TX_B],incidentDate:'2026-05-02'});
  assert.equal(compareIncidentsForDedupV1(original,same).classification,'SAME_INCIDENT');
  assert.equal(compareIncidentsForDedupV1(original,variant).classification,'VARIANT_OR_RELATED');
});
