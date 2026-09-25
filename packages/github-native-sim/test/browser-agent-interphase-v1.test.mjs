import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');
const wakePath = path.join(repoRoot, '.github/workflows/browser-agent-wake.yml');
const watchdogPath = path.join(repoRoot, '.github/workflows/browser-agent-watchdog.yml');

test('interphase mechanical work reuses the existing wake/watchdog workflows', () => {
  const workflows = fs.readdirSync(path.join(repoRoot, '.github/workflows'));
  assert.equal(workflows.some((name) => /interphase/i.test(name)), false, 'must not create a parallel interphase workflow');

  const wake = fs.readFileSync(wakePath, 'utf8');
  const watchdog = fs.readFileSync(watchdogPath, 'utf8');
  assert.match(wake, /worker_role:/);
  assert.match(wake, /options: \[reviewer, interphase_mechanical\]/);
  assert.match(watchdog, /MECHANICAL_WORK_PACKET_v1\.json/);
  assert.match(watchdog, /MECHANICAL_WORK_COMPLETION_v1\.json/);
});

test('grunt fresh chats do not replace the campaign reviewer chat registration', () => {
  const wake = fs.readFileSync(wakePath, 'utf8');
  assert.match(
    wake,
    /if:\s*\$\{\{ inputs\.mode == 'create_fresh' && inputs\.worker_role == 'reviewer' \}\}/
  );
  assert.match(wake, /workerRole:\$workerRole/);
});

test('mechanical completion is bound to exact work packet and required output bytes', () => {
  const watchdog = fs.readFileSync(watchdogPath, 'utf8');
  assert.match(watchdog, /curveyield-lite-interphase-work-packet-v1/);
  assert.match(watchdog, /curveyield-lite-interphase-completion-v1/);
  assert.match(watchdog, /\.taskClass=="MECHANICAL_ONLY"/);
  assert.match(watchdog, /\.workPacketSha256==\$packetSha/);
  assert.match(watchdog, /required_total/);
  assert.match(watchdog, /observed_total/);
  assert.match(watchdog, /MECHANICAL\//);
  assert.match(watchdog, /\[ "\$required" = "\$observed" \]/);
  assert.match(watchdog, /sha256sum \/tmp\/lite-interphase-output\.bin/);
  assert.match(watchdog, /\[ "\$observed_sha" = "\$expected_sha" \]/);
});

test('successor launch is gated behind optional mechanical completion', () => {
  const watchdog = fs.readFileSync(watchdogPath, 'utf8');
  assert.match(watchdog, /worker_role" = "interphase_mechanical"/);
  assert.match(watchdog, /verify_lite_interphase_completion/);
  assert.match(watchdog, /return 4/);
  assert.match(watchdog, /LITE_INTERPHASE_DISPATCHED_/);
  assert.match(watchdog, /LITE_INTERPHASE_COMPLETE_SUCCESSOR_DISPATCHED_/);
});

test('interphase work packet and completion schemas are strict machine contracts', () => {
  const packet = JSON.parse(fs.readFileSync(
    path.join(repoRoot, 'protocol/schemas/curveyield-lite-interphase-work-packet-v1.schema.json'),
    'utf8'
  ));
  const completion = JSON.parse(fs.readFileSync(
    path.join(repoRoot, 'protocol/schemas/curveyield-lite-interphase-completion-v1.schema.json'),
    'utf8'
  ));
  assert.equal(packet.additionalProperties, false);
  assert.equal(completion.additionalProperties, false);
  assert.equal(packet.properties.schemaVersion.const, 'curveyield-lite-interphase-work-packet-v1');
  assert.equal(completion.properties.schemaVersion.const, 'curveyield-lite-interphase-completion-v1');
  assert.ok(packet.required.includes('taskClass'));
  assert.equal(packet.properties.taskClass.const, 'MECHANICAL_ONLY');
  assert.ok(packet.required.includes('requiredOutputs'));
  assert.ok(completion.required.includes('workPacketSha256'));
  assert.ok(completion.required.includes('outputs'));
});


test('mechanical wake payload is encoded from the generated packet file', () => {
  const watchdog = fs.readFileSync(watchdogPath, 'utf8');
  assert.match(watchdog, /mechanical_b64="\$\(base64 -w0 \/tmp\/lite-interphase-wake\.txt\)"/);
  assert.doesNotMatch(watchdog, /mechanical_b64="\$\(printf '%s' "\$mechanical_message" \| base64 -w0\)"/);
});
