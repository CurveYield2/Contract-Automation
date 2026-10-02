import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCandidateReproductionV1, computeCandidateReproductionDigestV1 } from '../src/reproduction-v1.mjs';

const sourceIdentity={repository:'CurveYield2/example',commit:'a'.repeat(40),sha256:'b'.repeat(64)};
function raw(status, observedPredicate={matched:true}) { return { candidateId:'CAND-001', sourceIdentity, reproductionType:'ANVIL_WORKFLOW', engine:'anvil', status, evidenceReferences:['github-actions://evidence'], observedPredicate, rawArtifactRefs:['github-actions://raw'] }; }

for (const status of ['REPRODUCED','NOT_REPRODUCED','INCONCLUSIVE','EXECUTION_FAILED']) {
  test(`normalizes explicit ${status} source-bound terminal status`,()=>{
    const result=normalizeCandidateReproductionV1(raw(status));
    assert.equal(result.schemaVersion,'audit-v7-candidate-reproduction-v1');
    assert.equal(result.status,status);
    assert.equal(result.sourceIdentity.commit,sourceIdentity.commit);
    assert.equal(result.reproductionDigest,computeCandidateReproductionDigestV1(result));
    assert.equal(result.authoritativeFinding,false);
  });
}

test('rejects unsupported terminal status and stale source validation context',()=>{
 assert.throws(()=>normalizeCandidateReproductionV1(raw('FOUND')),/status/i);
 assert.throws(()=>normalizeCandidateReproductionV1(raw('REPRODUCED'),{expectedSourceIdentity:{...sourceIdentity,commit:'f'.repeat(40)}}),/source identity/i);
});
