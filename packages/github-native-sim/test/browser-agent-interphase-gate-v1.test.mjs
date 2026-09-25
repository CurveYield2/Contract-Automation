import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const workflow = fs.readFileSync(path.join(root, '.github/workflows/browser-agent-watchdog.yml'), 'utf8');
const functions = workflow.slice(workflow.indexOf('          safe_repo_path() {'), workflow.indexOf('          if ! fetch_state; then'));
const handoff = 'campaigns/synthetic/handoffs/P0_TO_P1/START_HERE.md';
const dir = path.posix.dirname(handoff);
const packetPath = dir + '/MECHANICAL_WORK_PACKET_v1.json';
const completionPath = dir + '/MECHANICAL_WORK_COMPLETION_v1.json';
const outputPath = dir + '/MECHANICAL/INDEX_v1.json';
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

function exercise(mutate = () => {}, launch = false) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'lite-interphase-'));
  try {
    const output = '{"indexed":true}\n';
    const packet = {
      schemaVersion: 'curveyield-lite-interphase-work-packet-v1',
      taskClass: 'MECHANICAL_ONLY', campaignId: 'synthetic',
      completedMilestoneId: 'P0_BOOTSTRAP', handoffPath: handoff,
      instructions: 'Index the synthetic evidence bytes.',
      requiredOutputs: [{ path: outputPath }]
    };
    const files = { output };
    mutate(packet, files);
    const packetBytes = JSON.stringify(packet);
    const receipt = {
      schemaVersion: 'curveyield-lite-interphase-completion-v1',
      status: 'PASS', campaignId: 'synthetic',
      completedMilestoneId: 'P0_BOOTSTRAP', handoffPath: handoff,
      workPacketPath: packetPath, workPacketSha256: sha(packetBytes),
      outputs: [{ path: outputPath, sha256: sha(output) }],
      completedAt: '2026-09-25T00:00:00Z'
    };
    if (files.receipt) Object.assign(receipt, files.receipt);
    const named = { packet: packetBytes, receipt: JSON.stringify(receipt),
      output: files.output ?? output,
      pointer: JSON.stringify({
        completedMilestone: { id: 'P0_BOOTSTRAP', status: 'SEALED' },
        nextMilestone: { id: 'P1', state: 'READY', phaseRange: ['1'] },
        authoritativeHandoff: handoff
      }), wake: 'Synthetic successor instructions\n' };
    for (const [name, value] of Object.entries(named)) fs.writeFileSync(path.join(temp, name), value);
    fs.writeFileSync(path.join(temp, 'state'), JSON.stringify({
      gate: { interphase: { workPacketSha256: files.pinnedSha ?? sha(packetBytes) } }
    }));
    const script = String.raw`
set -euo pipefail
gh() {
  if [ "$1" = api ]; then
    case "$2" in
      *MECHANICAL_WORK_PACKET_v1.json*) base64 -w0 "$FIXTURE_DIR/packet";;
      *MECHANICAL_WORK_COMPLETION_v1.json*) [ "$MISSING_RECEIPT" = no ] && base64 -w0 "$FIXTURE_DIR/receipt" || return 1;;
      *MECHANICAL/INDEX_v1.json*) [ "$MISSING_OUTPUT" = no ] && base64 -w0 "$FIXTURE_DIR/output" || return 1;;
      *pointer.json*) base64 -w0 "$FIXTURE_DIR/pointer";;
      *WAKE_UP_MESSAGE.md*) base64 -w0 "$FIXTURE_DIR/wake";;
      *) return 1;;
    esac
  elif [ "$1" = workflow ]; then
    printf '%s\n' "$*" >> "$FIXTURE_DIR/dispatch"
  fi
}
campaign_id=synthetic
worker_role=interphase_mechanical
gate_interphase_work_packet_path="$PACKET_PATH"
gate_interphase_completion_path="$COMPLETION_PATH"
gate_interphase_handoff_path="$HANDOFF_PATH"
AUDIT_CONTROLLER_GITHUB_TOKEN=synthetic
GITHUB_REPOSITORY=CurveYield2/Contract-Automation
GITHUB_RUN_ID=123
cycle=1
gate_path=campaigns/synthetic/state.json
gate_expected_phase=phase-0
cp "$FIXTURE_DIR/state" /tmp/watchdog-state.json
`;
    const command = script + functions + (launch === 'mechanical'
      ? String.raw`
if launch_lite_successor campaigns/synthetic/pointer.json P0_BOOTSTRAP CurveYield2/Audit-Controller main; then
  exit 42
else
  [ "$?" -eq 4 ]
fi
`
      : launch ? String.raw`
if verify_lite_interphase_completion "$PACKET_PATH" "$COMPLETION_PATH" "$HANDOFF_PATH" P0_BOOTSTRAP CurveYield2/Audit-Controller main; then
  launch_lite_successor campaigns/synthetic/pointer.json P0_BOOTSTRAP CurveYield2/Audit-Controller main
else
  exit 41
fi
`
      : String.raw`
verify_lite_interphase_completion "$PACKET_PATH" "$COMPLETION_PATH" "$HANDOFF_PATH" P0_BOOTSTRAP CurveYield2/Audit-Controller main
`);
    const result = spawnSync('bash', ['-c', command], { encoding: 'utf8', env: {
      ...process.env, FIXTURE_DIR: temp, PACKET_PATH: packetPath,
      COMPLETION_PATH: completionPath, HANDOFF_PATH: handoff,
      MISSING_OUTPUT: files.missingOutput ? 'yes' : 'no',
      MISSING_RECEIPT: files.missingReceipt ? 'yes' : 'no'
    } });
    return { result, dispatched: fs.existsSync(path.join(temp, 'dispatch'))
      ? fs.readFileSync(path.join(temp, 'dispatch'), 'utf8') : '' };
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
}

test('sealed P0 synthetic packet validates and dispatches one successor', () => {
  const { result, dispatched } = exercise(() => {}, true);
  assert.equal(result.status, 0, result.stderr);
  assert.match(dispatched, /browser-agent-wake.yml/);
  assert.match(dispatched, /phase_id=phase-1/);
});

test('interphase gate fails closed across packet and receipt mutations', () => {
  const cases = [
    (p) => { p.taskClass = 'SEMANTIC'; },
    (p) => { p.schemaVersion = 'invalid'; },
    (p) => { p.unexpectedApproval = true; },
    (p) => { p.requiredOutputs[0].securityDisposition = 'APPROVED'; },
    (p, f) => { f.receipt = { semanticApproval: true }; },
    (p, f) => { f.receipt = { outputs: [{ path: outputPath, sha256: sha('{"indexed":true}\n'), semanticApproval: true }] }; },
    (p, f) => { f.receipt = { handoffPath: 'other' }; },
    (p) => { p.requiredOutputs = []; },
    (p, f) => { f.pinnedSha = '0'.repeat(64); },
    (p, f) => { f.missingOutput = true; },
    (p, f) => { f.receipt = { workPacketSha256: '0'.repeat(64) }; },
    (p, f) => { f.receipt = { outputs: [{ path: outputPath, sha256: '0'.repeat(64) }] }; },
    (p, f) => { f.receipt = { outputs: [] }; },
    (p, f) => { f.receipt = { outputs: [{ path: outputPath, sha256: sha('{"indexed":true}\n') }, { path: outputPath, sha256: sha('{"indexed":true}\n') }] }; },
    (p, f) => { f.receipt = { campaignId: 'other' }; },
    (p, f) => { f.receipt = { status: 'INCOMPLETE' }; },
    (p) => { p.requiredOutputs = [{ path: dir + '/OTHER.json' }]; }
  ];
  for (const mutate of cases) {
    const { result, dispatched } = exercise(mutate, true);
    assert.notEqual(result.status, 0, mutate.toString());
    assert.equal(dispatched, '', mutate.toString());
  }
});

test('sealed P0 dispatches a bounded mechanical wake before a receipt exists', () => {
  const { result, dispatched } = exercise((packet, files) => {
    files.missingReceipt = true;
  }, 'mechanical');
  assert.equal(result.status, 0, result.stderr);
  assert.match(dispatched, /worker_role=interphase_mechanical/);
  assert.doesNotMatch(dispatched, /phase_id=phase-1/);
  const encoded = dispatched.match(/wake_message_b64=([A-Za-z0-9+/=]+)/)?.[1];
  assert.ok(encoded, dispatched);
  const message = Buffer.from(encoded, 'base64').toString('utf8');
  assert.match(message, /repository=CurveYield2\/Audit-Controller/);
  assert.match(message, /work_packet_sha256=[a-f0-9]{64}/);
  assert.match(message, /required_outputs:[\s\S]*MECHANICAL\/INDEX_v1\.json/);
  assert.match(message, /do_not_repeat=/);
  assert.match(message, /prohibited_semantic_work=/);
  assert.match(message, /Do not make, promote, reject, grade, or remediate security findings/);
  assert.match(message, /Index the synthetic evidence bytes/);
});
