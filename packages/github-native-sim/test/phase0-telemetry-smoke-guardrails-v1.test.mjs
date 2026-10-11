import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const workflow=readFileSync(new URL('../../../.github/workflows/lite-phase0-simulation-testing-v1.yml',import.meta.url),'utf8');

test('Phase-0 telemetry smoke has a bounded execution deadline and preserves its exit status',()=>{
  assert.match(workflow,/timeout-minutes: 20/);
  assert.match(workflow,/timeout -s TERM -k 30s 900s node/);
  assert.match(workflow,/2>&1 \| tee \.phase0-smoke-run\.log/);
  assert.match(workflow,/set -euo pipefail/);
  assert.doesNotMatch(workflow,/timeout-minutes: 90/);
});

test('Phase-0 telemetry smoke retains partial diagnostics on failures and reads the correct fixture path',()=>{
  assert.match(workflow,/fixture=\.phase0-medusa-smoke\/runs\/PHASE0_FIXTURE_SYNTHESIS_v1\.json/);
  assert.match(workflow,/name: Retain smoke diagnostics and raw telemetry\n\s+if: \$\{\{ always\(\) \}\}/);
  assert.match(workflow,/\.phase0-medusa-smoke\/runs\/\*\*\/RAW_SIMULATION_TRANSCRIPT_v1\.jsonl/);
  assert.match(workflow,/\.phase0-smoke-run\.log/);
  assert.match(workflow,/Last stage progress markers/);
});

test('Phase-0 smoke rejects a 300-call PASS without Stage-5 accounting observation evidence',()=>{
  assert.match(workflow,/fixtureSynthesis\.stage=="STAGE_5_ACCOUNTING_READS_ONLY"/);
  assert.match(workflow,/accountingObservationPolicy\.policy=="PREFLIGHT_PASS_AND_ECONOMIC_OR_CREATED_TOKEN_CONTEXT_ONLY"/);
  assert.match(workflow,/accountingObservationCalls\|tonumber\)\+\(\.telemetry\[0\]\.skippedObservationCalls\|tonumber/);
});
