import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const workflow=readFileSync(new URL('../../../.github/workflows/lite-phase0-simulation-testing-v1.yml',import.meta.url),'utf8');

test('Phase-0 smoke invokes bounded forked package deployment only',()=>{
 assert.match(workflow,/timeout-minutes: 50/);
 assert.match(workflow,/timeout -s TERM -k 30s 2400s node scripts\/run-phase0-fork-deploy-config-v1\.mjs/);
 assert.match(workflow,/set -euo pipefail/);
 assert.doesNotMatch(workflow,/medusa_calls|telemetry_calls|run-phase0-randomized-simulation-v1\.mjs/);
});

test('Phase-0 smoke retains native script diagnostics and fails on incomplete configuration',()=>{
 assert.match(workflow,/Retain full smoke evidence on success or failure/);
 assert.match(workflow,/PHASE0_DEPLOY_CONFIG_EXECUTION_v1\.json/);
 assert.match(workflow,/all\(\.scriptDispositions\[\]; \.disposition=="EXECUTED_PASS"\)/);
 assert.match(workflow,/all\(\.attempts\[\]; \.status=="PASS" and \.exitCode==0\)/);
});
