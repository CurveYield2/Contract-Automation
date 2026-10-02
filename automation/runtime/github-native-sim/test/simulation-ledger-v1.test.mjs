import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSimulationLifecycleLedgerV1, computeSimulationLifecycleLedgerDigestV1 } from '../src/simulation-ledger-v1.mjs';

const request={ requestId:'dar-test', requestDigest:'a'.repeat(64), sourceIdentity:{repository:'CurveYield2/example',commit:'b'.repeat(40),sha256:'c'.repeat(64)}, configuration:{simulation:{recipeId:'deposit-withdraw-cycle-v1', workflow:{steps:[{action:'call',label:'deposit'},{action:'assertCall',label:'assert shares'},{action:'call',label:'withdraw'}]}}}};
const build={ sourceCommit:'b'.repeat(40) };
const simulation={ fork:{chain:'ethereum',chainId:1,blockNumber:123,blockHash:'0x'+'1'.repeat(64),engine:'anvil'}, steps:[{index:0,label:'deposit',status:'PASS',affectedContracts:['Vault']},{index:1,label:'assert shares',status:'PASS',affectedContracts:['Vault'],obligationsSatisfied:['REQ-1']},{index:2,label:'withdraw',status:'FAIL',affectedContracts:['Vault']}], segments:[{recipeId:'deposit-withdraw-cycle-v1',label:'user lifecycle',stepIndexes:[0,1,2]}] };

test('same request/result emits deterministic SIM ids and digest',()=>{
 const a=buildSimulationLifecycleLedgerV1({request,build,simulation,deploymentGasEvidence:null,attestation:null});
 const b=buildSimulationLifecycleLedgerV1({request,build,simulation,deploymentGasEvidence:null,attestation:null});
 assert.equal(a.simulations[0].simId,'SIM-001');
 assert.equal(a.ledgerDigest,b.ledgerDigest);
 assert.equal(a.ledgerDigest,computeSimulationLifecycleLedgerDigestV1(a));
});

test('failure is preserved and only explicit assertions satisfy obligations',()=>{
 const ledger=buildSimulationLifecycleLedgerV1({request,build,simulation,deploymentGasEvidence:null,attestation:null});
 assert.equal(ledger.simulations[0].status,'FAIL');
 assert.deepEqual(ledger.simulations[0].obligationsSatisfied,['REQ-1']);
 assert.equal(ledger.simulations[0].obligationsSatisfied.includes('funds are safe'),false);
});
