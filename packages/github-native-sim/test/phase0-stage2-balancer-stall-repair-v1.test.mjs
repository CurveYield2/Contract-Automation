import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {normalizeEvidenceValueV1} from '../src/phase0-fixture-synthesis-v1.mjs';

test('pool creator nested tuple arrays serialize exactly without mutating caller inputs',()=>{
  const input=['Phase0 Weighted','P0BPT',[['0xabc',0,'0x000',false],['0xdef',0,'0x000',false]],[500000000000000000n,500000000000000000n],['0xaaa','0xaaa'],10000000000000000n];
  const args=[input,['0x111','0x111','0x222','0x000','0x333','0x444',[0,0,0]]];
  const out=normalizeEvidenceValueV1(args);
  assert.equal(out[0][3][0],'500000000000000000');
  assert.equal(out[0][5],'10000000000000000');
  assert.equal(typeof args[0][3][0],'bigint');
  assert.equal(out[1][6].length,3);
});
test('malformed recursive creator evidence fails immediately and never blocks fixture synthesis',()=>{
  const cycle={};cycle.next=cycle;
  assert.throws(()=>normalizeEvidenceValueV1(cycle),/cyclic creator evidence argument/);
  let deep={a:'ok'};for(let i=0;i<40;i++)deep={child:deep};
  assert.throws(()=>normalizeEvidenceValueV1(deep),/bounded serializer limits/);
});
test('No Telemetry Stage 2 skips only known Balancer BPT pool spender approvals while retaining actual token/router funding',()=>{
  const s=fs.readFileSync('packages/github-native-sim/src/phase0-randomized-simulation-no-telemetry-v1.mjs','utf8');
  assert.match(s,/const balancerPoolChildren=new Set/);
  assert.match(s,/CURVEYIELD_WRAPPER_ALLOWLIST\|BALANCER_V3_FACTORY/);
  assert.match(s,/const approvalSpenders=createdAddresses.filter/);
  assert.match(s,/approveFixtureSpendersV1\(\{provider,ethers,tokens:existingTokens,holders:stage2Holders,spenders:approvalSpenders\}\)/);
  assert.match(s,/spenders:\[\.\.\.targets.map\(x=>x.address\),\.\.\.createdAddresses\]/);
  assert.match(s,/BALANCER_V3_POOLS_ARE_NOT_TOKEN_SPENDERS/);
  assert.match(s,/END Stage 2 creator round/);
  assert.match(s,/START Stage 2 created BPT\/token funding/);
});
test('creator checkpoint includes evidence serialization and completed creator records',()=>{
  const s=fs.readFileSync('packages/github-native-sim/src/phase0-fixture-synthesis-v1.mjs','utf8');
  assert.match(s,/CHECKPOINT bound_children=/);
  assert.match(s,/CHECKPOINT creator_evidence_serialized/);
  assert.match(s,/CHECKPOINT creation_recorded/);
  assert.match(s,/Stage2 creator \$\{candidateIndex\+1\}\/\$\{candidates.length\} complete successes=/);
});
