import test from 'node:test';
import assert from 'node:assert/strict';
import {generateV7ExecutionRequestV1} from '../../../scripts/lib/lite-phase5-request-generation-v1.mjs';
import {validateDeepAssuranceRequestWithV26V1} from '../src/schema-v26.mjs';
const digest='a'.repeat(64);
const source={sha256:digest,archiveRepository:'CurveYield2/Audit-Controller',
 archiveCommit:'1'.repeat(40),archivePath:'campaigns/demo r1/source/source.zip',
 extractedContentPath:'campaigns/demo r1/source'};
const target=()=>({candidateKey:'C-005',executionMethod:'V7_REQUEST',reproductionType:'FOUNDRY_TEST',
 setup:'Deploy authorized fixture',prerequisites:['valid fork','owner signer'],
 transactionSequence:['nonowner attack','owner control'],
 oracle:'Nonowner call must revert and owner call must succeed',
 fuzzVariablesAndBounds:'Caller roles and amount boundaries',
 snapshotReuseSafety:'Restore same pinned state before each run',
 expectedSecurityProperty:'No access to roles without authorization',
 expectedMachineObservation:{componentStatus:'COMPLETED'},
 executionBlueprint:{
  projectPath:'campaigns/demo r1/source',
  configuration:{compilers:[{language:'solidity',version:'0.8.28'}],
    timeoutMinutes:20,
    harness:{kind:'runner-owned-audit-overlay-v1',bundleId:'fixture-phase5'},
    analysis:{medusa:{version:'1.5.1'},nativeFuzz:{enabled:true,fuzzRuns:100000}}}
 }});
test('D-T1 missing oracle yields exact per-field rework and no machine request',()=>{
 const invalid=target();delete invalid.oracle;
 const x=generateV7ExecutionRequestV1({campaignId:'demo-r1',sourceSha256:digest,phase0Source:source,target:invalid});
 assert.equal(x.status,'REWORK_REQUIRED');
 assert.ok(x.missing.some(v=>v.field==='oracle'));
 assert.equal(x.request,undefined);
});
test('source-bound executable design yields valid typed V7 request',()=>{
 const x=generateV7ExecutionRequestV1({campaignId:'demo-r1',sourceSha256:digest,phase0Source:source,target:target()});
 assert.equal(x.status,'GENERATED',JSON.stringify(x.missing));
 assert.equal(x.request.configuration.v26.reproduction.candidateId,'C-005');
 assert.equal(x.request.source.archiveSha256,digest);
 assert.deepEqual(validateDeepAssuranceRequestWithV26V1(x.request),x.request);
 assert.deepEqual(generateV7ExecutionRequestV1({campaignId:'demo-r1',sourceSha256:digest,phase0Source:source,target:target()}).request,x.request);
});
test('must not invent build identity, override frozen source, or fabricate expected observations',()=>{
 const t=target();t.executionBlueprint.projectPath='different/repo';t.expectedMachineObservation={whatever:true};
 const x=generateV7ExecutionRequestV1({campaignId:'demo-r1',sourceSha256:digest,phase0Source:source,target:t});
 assert.equal(x.status,'REWORK_REQUIRED');
 assert.ok(x.missing.some(v=>v.field==='executionBlueprint.projectPath'));
});
