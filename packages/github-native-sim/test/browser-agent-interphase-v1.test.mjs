import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyV7QualificationChanges } from '../../../scripts/classify-v7-qualification-change.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');
const wakePath = path.join(repoRoot, '.github/workflows/browser-agent-wake.yml');
const watchdogPath = path.join(repoRoot, '.github/workflows/browser-agent-watchdog.yml');

test('interphase mechanical work reuses the existing wake/watchdog workflows', () => {
  const workflows = fs.readdirSync(path.join(repoRoot, '.github/workflows'));
  assert.equal(workflows.some((name) => /interphase/i.test(name)), false, 'must not create a parallel interphase workflow');
  const wake = fs.readFileSync(wakePath, 'utf8');
  const watchdog = fs.readFileSync(watchdogPath, 'utf8');
  assert.match(wake, /options: \[resume_existing\]/);
  assert.match(watchdog, /MECHANICAL_WORK_PACKET_v2\.json/);
  assert.match(watchdog, /MECHANICAL_WORK_COMPLETION_v2\.json/);
  assert.match(watchdog, /Legacy create-fresh Lite successor launcher is retired/);
});

test('interphase mechanical wakes never replace the campaign reviewer chat registration', () => {
  const wake = fs.readFileSync(wakePath, 'utf8');
  assert.doesNotMatch(wake, /Persist fresh-chat URL into campaign registration/);
  assert.match(wake, /Persist existing-chat reviewer wake into campaign registration/);
  const registrationBlock = wake
    .split('      - name: Persist existing-chat reviewer wake into campaign registration')[1]
    .split('      - name: Activate prepared Lite receipt successor')[0];
  assert.match(registrationBlock, /steps\.deliver\.outputs\.ok == 'true'/);
  assert.match(registrationBlock, /inputs\.mode == 'resume_existing'/);
  assert.match(registrationBlock, /inputs\.worker_role == 'reviewer'/);
  assert.match(wake, /workerRole:\$workerRole/);
});

test('mechanical completion is bound to exact work packet and required output bytes', () => {
  const watchdog = fs.readFileSync(watchdogPath, 'utf8');
  assert.match(watchdog, /curveyield-lite-interphase-work-packet-v2/);
  assert.match(watchdog, /curveyield-lite-interphase-completion-v2/);
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
  assert.match(watchdog, /verify_lite_interphase_completion\(\)/);
  const start = watchdog.indexOf('launch_lite_successor() {');
  const end = watchdog.indexOf('\n          if ! fetch_state; then', start);
  const launch = watchdog.slice(start, end);
  assert.match(launch, /Legacy create-fresh Lite successor launcher is retired/);
  assert.match(launch, /return 2/);
  assert.doesNotMatch(launch, /gh workflow run browser-agent-wake\.yml/);
});

test('interphase work packet and completion schemas are strict machine contracts', () => {
  const packet = JSON.parse(fs.readFileSync(
    path.join(repoRoot, 'protocol/schemas/curveyield-lite-interphase-work-packet-v2.schema.json'),
    'utf8'
  ));
  const completion = JSON.parse(fs.readFileSync(
    path.join(repoRoot, 'protocol/schemas/curveyield-lite-interphase-completion-v2.schema.json'),
    'utf8'
  ));
  assert.equal(packet.additionalProperties, false);
  assert.equal(completion.additionalProperties, false);
  assert.equal(packet.properties.schemaVersion.const, 'curveyield-lite-interphase-work-packet-v2');
  assert.equal(completion.properties.schemaVersion.const, 'curveyield-lite-interphase-completion-v2');
  assert.ok(packet.required.includes('taskClass'));
  assert.equal(packet.properties.taskClass.const, 'MECHANICAL_ONLY');
  assert.ok(packet.required.includes('requiredOutputs'));
  assert.ok(completion.required.includes('workPacketSha256'));
  assert.ok(completion.required.includes('outputs'));
});


test('mechanical wake payload is encoded from the generated packet file', () => {
  const watchdog = fs.readFileSync(watchdogPath, 'utf8');
  const start = watchdog.indexOf('launch_lite_successor() {');
  const end = watchdog.indexOf('\n          if ! fetch_state; then', start);
  const launch = watchdog.slice(start, end);
  assert.doesNotMatch(launch, /mechanical_b64|lite-interphase-wake\.txt|browser-agent-wake\.yml/);
  assert.match(launch, /pre-created reviewer chats and the Phase-1 fixed X11 sender/);
});

test('watchdog state builder binds every jq variable it references', () => {
  const wake = fs.readFileSync(wakePath, 'utf8');
  const builder = wake.split('      - name: Create watchdog state')[1]
    .split('      - name: Persist watchdog state')[0];
  const bound = new Set([...builder.matchAll(/--arg(?:json)?\s+(\w+)\s/g)].map((match) => match[1]));
  const filter = builder.slice(builder.indexOf("            '{"), builder.indexOf("}' >"));
  const used = new Set([...filter.matchAll(/\$(\w+)/g)].map((match) => match[1]));
  assert.deepEqual([...used].filter((name) => !bound.has(name)), []);
  for (const field of ['workerRole', 'gateInterphaseHandoffPath', 'gateInterphaseWorkPacketPath',
    'gateInterphaseCompletionPath', 'gateInterphaseWorkPacketSha256']) {
    assert.ok(bound.has(field), field);
  }
});

test('mechanical watchdog rejects a changed packet, missing output, or mismatched count', () => {
  const watchdog = fs.readFileSync(watchdogPath, 'utf8');
  assert.match(watchdog, /workPacketSha256 \/\/ empty/);
  assert.match(watchdog, /\[ "\$packet_sha" = "\$\(jq -r/);
  assert.match(watchdog, /\.requiredOutputs\|type=="array" and length>=11/);
  assert.match(watchdog, /\[ "\$observed_total" = "\$\(jq/);
  assert.match(watchdog, /\[ "\$required" = "\$observed" \]/);
});


test('v2 requires a real extended mechanical batch rather than a trivial one-file task', () => {
  const packet = JSON.parse(fs.readFileSync(
    path.join(repoRoot, 'protocol/schemas/curveyield-lite-interphase-work-packet-v2.schema.json'),
    'utf8'
  ));
  const completion = JSON.parse(fs.readFileSync(
    path.join(repoRoot, 'protocol/schemas/curveyield-lite-interphase-completion-v2.schema.json'),
    'utf8'
  ));
  assert.equal(packet.properties.workUnits.minItems, 10);
  assert.equal(packet.properties.requiredOutputs.minItems, 11);
  assert.equal(completion.properties.workUnitReceipts.minItems, 10);
  assert.equal(completion.properties.outputs.minItems, 11);
  const watchdog = fs.readFileSync(watchdogPath, 'utf8');
  assert.match(watchdog, /unit_total/);
  assert.match(watchdog, /\[ "\$unit_total" -ge 10 \]/);
  assert.match(watchdog, /reconciliationOutputPath/);
  assert.match(watchdog, /launch_lite_successor\(\) \{[\s\S]*Legacy create-fresh Lite successor launcher is retired/);
});

test('qualification classifier keeps docs and watchdog runtime state in control-light lane', () => {
  const result = classifyV7QualificationChanges([
    'docs/TRACE_PR_LIFECYCLE_BOUNDARY_v1.md',
    'process/browser-agent-watchdog/active/watchdog-sweep-smoke-v4.json',
    'process/browser-agent-watchdog/completed/example.json',
    'scripts/classify-v7-qualification-change.mjs',
  ]);
  assert.equal(result.lane, 'CONTROL_LIGHT');
  assert.equal(result.escalatedPaths, undefined);
});
