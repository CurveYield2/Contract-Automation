import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const watchdog = fs.readFileSync(path.join(root, '.github/workflows/browser-agent-watchdog.yml'), 'utf8');
const wake = fs.readFileSync(path.join(root, '.github/workflows/browser-agent-wake.yml'), 'utf8');

test('watchdog uses the existing workflow as a five-minute scheduled sweep', () => {
  assert.match(watchdog, /schedule:\s*\n\s*- cron: '2-59\/5 \* \* \* \*'/);
  assert.match(watchdog, /Discover active watchdog targets/);
  assert.match(watchdog, /process\/browser-agent-watchdog\/active/);
  assert.match(watchdog, /matrix:\s*\n\s*wake_id:\s*\$\{\{ fromJSON\(needs\.discover\.outputs\.targets\) \}\}/);
  assert.match(watchdog, /max-parallel:\s*4/);
  assert.match(watchdog, /group:\s*browser-agent-watchdog-\$\{\{ matrix\.wake_id \}\}/);
});

test('watchdog no longer holds a runner open between observations', () => {
  assert.match(watchdog, /timeout-minutes:\s*15/);
  assert.match(watchdog, /for cycle in 1; do/);
  assert.doesNotMatch(watchdog, /seq 1 46/);
  assert.doesNotMatch(watchdog, /sleep 300/);
  assert.doesNotMatch(watchdog, /Four-hour watchdog segment/);
  assert.doesNotMatch(watchdog, /gh workflow run browser-agent-watchdog\.yml/);
});

test('wake still triggers an immediate first watchdog sweep', () => {
  assert.match(wake, /Arm immediate watchdog observation/);
  assert.match(wake, /gh workflow run browser-agent-watchdog\.yml/);
});

test('scheduled sweep preserves canonical gate and successor behavior', () => {
  assert.match(watchdog, /CANONICAL_GATE_STATE_/);
  assert.match(watchdog, /LITE_INTERPHASE_COMPLETE_SUCCESSOR_DISPATCHED_/);
  assert.match(watchdog, /launch_lite_successor/);
  assert.match(watchdog, /verify_lite_interphase_completion/);
  assert.match(watchdog, /Set up isolated browser-agent runtime/);
});

test('no parallel watchdog workflow is introduced', () => {
  const workflows = fs.readdirSync(path.join(root, '.github/workflows'));
  assert.equal(
    workflows.some((name) => /watchdog-sweep|scheduled-watchdog|browser-agent-monitor/i.test(name)),
    false
  );
});


test('terminal watchdog state retention is bounded without touching active state or registrations', () => {
  assert.match(watchdog, /prune_completed_states\(\)/);
  assert.match(watchdog, /WATCHDOG_COMPLETED_RETENTION_MAX:-100/);
  assert.match(watchdog, /status=="COMPLETED_CANONICAL_GATE"/);
  assert.match(watchdog, /process\/browser-agent-watchdog\/active\/\$file_name/);
  assert.match(watchdog, /--method DELETE "\$completed_dir_api\/\$file_name"/);
  assert.match(watchdog, /prune_completed_states\s*\n\s*\}/);
  assert.doesNotMatch(watchdog, /DELETE[^\n]*process\/browser-agent-wake\/registrations/);
});


test('watchdog workflow contains one complete sweep body and no duplicated corrupt tail', () => {
  const lines = watchdog.split(/\r?\n/);
  assert.equal(lines.some((line) => line.startsWith('\\t')), false, 'literal \\t must never escape the run block');
  assert.equal(lines.some((line) => /^\t/.test(line)), false, 'YAML indentation must never use tab characters');
  assert.equal((watchdog.match(/launch_lite_successor\(\) \{/g) ?? []).length, 1);
  assert.equal((watchdog.match(/Watchdog sweep complete; active state remains for the next scheduled sweep\./g) ?? []).length, 1);
});
