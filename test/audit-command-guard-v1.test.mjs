// Smoke test for scripts/audit-command-guard-v1.py (moved from the retired
// Lite Master Targeted Tests Regression workflow): clean exit, failure
// propagation, output-inactivity timeout (125) and wall timeout (124).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const guard = path.resolve('scripts/audit-command-guard-v1.py');
function run(label, wall, idle, code) {
  const log = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'guard-')), `${label}.log`);
  const r = spawnSync('python3', [guard, '--wall', String(wall), '--idle', String(idle), '--log', log, '--label', label, '--', 'python3', '-u', '-c', code], { encoding: 'utf8', timeout: 30000 });
  return { status: r.status, log: fs.existsSync(log) ? fs.readFileSync(log, 'utf8') : '' };
}

test('guard passes clean exits and propagates failures', () => {
  const pass = run('pass', 10, 5, "print('pass')");
  assert.equal(pass.status, 0);
  assert.match(pass.log, /pass/);
  assert.equal(run('exit', 10, 5, 'import sys; sys.exit(17)').status, 17);
});

test('guard kills on output inactivity and on wall timeout', () => {
  const idle = run('idle', 10, 2, "import time; print('started'); time.sleep(30)");
  assert.equal(idle.status, 125);
  assert.match(idle.log, /output inactivity/);
  const wall = run('wall', 3, 2, "import time; [(print('alive', flush=True), time.sleep(.25)) for _ in range(100)]");
  assert.equal(wall.status, 124);
  assert.match(wall.log, /wall timeout/);
});
