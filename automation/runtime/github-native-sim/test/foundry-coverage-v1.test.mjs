import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFoundryCoverageSummaryV1, evaluateFoundryCoverageObligationsV1, buildFoundryCampaignReceiptV1 } from '../src/foundry-coverage-v1.mjs';

const sample=`| File | % Lines | % Statements | % Branches | % Funcs |\n| contracts/Vault.sol | 90.00% (9/10) | 90.00% (9/10) | 80.00% (8/10) | 100.00% (2/2) |\n| Total | 90.00% (9/10) | 90.00% (9/10) | 80.00% (8/10) | 100.00% (2/2) |`;

test('parses Forge summary without fabricating unavailable categories',()=>{
  const metrics=parseFoundryCoverageSummaryV1(sample);
  assert.equal(metrics.totals.lines.percent,90);
  assert.equal(metrics.totals.branches.hit,8);
  assert.equal(metrics.files[0].path,'contracts/Vault.sol');
});

test('coverage obligations are explicit and no universal threshold is imposed',()=>{
  const metrics=parseFoundryCoverageSummaryV1(sample);
  const result=evaluateFoundryCoverageObligationsV1(metrics,[
    {type:'FILE_PRESENT',path:'contracts/Vault.sol'},
    {type:'MINIMUM_METRIC',metric:'branches',minimumPercent:85}
  ]);
  assert.equal(result.status,'FAIL');
  assert.equal(result.failures[0].type,'MINIMUM_METRIC');
});

test('refinement-required baseline receipt cannot satisfy completion and evidence is RPC-redacted',()=>{
  const baseline=buildFoundryCampaignReceiptV1({ runId:'F-1', runType:'baseline', refinementOf:null, basisEvidenceIds:[], harnessBundleDigest:'a'.repeat(64), configurationDigest:'b'.repeat(64), testResult:{status:'PASS'}, coverageResult:{schemaVersion:'audit-v7-foundry-coverage-v1',fork:{blockNumber:123,blockHash:'0x'+'1'.repeat(64),profile:'SIM_ARCHIVE_PRIMARY_ETHEREUM_01',rpcUrlExposed:false},totals:{},files:[],rawArtifactRef:'github-actions://coverage'} });
  assert.equal(baseline.refinementSatisfied,false);
  assert.equal(JSON.stringify(baseline).includes('https://secret-rpc.example'),false);
});
