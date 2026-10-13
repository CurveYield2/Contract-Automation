import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const watchdog = fs.readFileSync(path.join(root, '.github/workflows/browser-agent-watchdog.yml'), 'utf8');
const wake = fs.readFileSync(path.join(root, '.github/workflows/browser-agent-wake.yml'), 'utf8');
const orchestrator = fs.readFileSync(path.join(root, '.github/workflows/lite-audit-browser-orchestrator-v1.yml'), 'utf8');

test('watchdog uses a five-minute scheduled sweep but serializes all browser ownership', () => {
  assert.match(watchdog, /schedule:\s*\n\s*- cron: '2-59\/5 \* \* \* \*'/);
  assert.match(watchdog, /Discover active watchdog targets/);
  assert.match(watchdog, /process\/browser-agent-watchdog\/active/);
  assert.match(watchdog, /max-parallel:\s*1/);
  assert.match(watchdog, /group:\s*chatgpt-shared-browser-session-v1/);
  assert.match(watchdog, /cancel-in-progress:\s*false/);
  assert.match(wake, /group:\s*chatgpt-shared-browser-session-v1/);
});

test('watchdog never machine-reads ChatGPT and only pokes after the elapsed-time gate', () => {
  assert.match(watchdog, /pokeIntervalMinutes \/\/ 20/);
  assert.match(watchdog, /WAITING_NO_CHATGPT_READ/);
  assert.match(watchdog, /TIME_GATED_PHASE1_X11_POKE_SENT_NO_CHATGPT_READ/);
  // Pokes use the exact reviewer-wake delivery script; only the message differs.
  assert.match(watchdog, /bash scripts\/browser-deliver-message-v1\.sh/);
  assert.match(wake, /bash scripts\/browser-deliver-message-v1\.sh/);
  const deliver = fs.readFileSync('scripts/browser-deliver-message-v1.sh', 'utf8');
  assert.match(deliver, /WAKE_ACTION='wake'/);
  assert.match(deliver, /node scripts\/browser-agent-wake\.mjs/);
  assert.match(watchdog, /POKE_NOT_SENT_/);
  // A chat frozen on the stop button is stopped before the poke; wakes never set this.
  assert.match(watchdog, /STOP_BEFORE_SEND='true'/);
  assert.doesNotMatch(wake, /STOP_BEFORE_SEND/);
  assert.match(fs.readFileSync('scripts/browser-agent-wake.mjs', 'utf8'), /if \(bool\(env\.STOP_BEFORE_SEND\)\) \{[\s\S]*?x11-stop-or-send-click/);
  assert.doesNotMatch(watchdog, /WAKE_ACTION=['"]observe['"]/);
  assert.doesNotMatch(watchdog, /assistantCount|lastAssistantHash|humanChallenge|loginPrompt|conversationUnavailable/);
});

test('wake still triggers an immediate first watchdog sweep', () => {
  assert.match(wake, /Arm immediate watchdog observation/);
  assert.match(wake, /gh workflow run browser-agent-watchdog\.yml/);
});

test('watchdog and wake share the same home-exit visible-X11 transport', () => {
  for (const workflow of [watchdog, wake]) {
    assert.match(workflow, /tailscale\/github-action@v4/);
    assert.match(workflow, /TAILSCALE_AUTHKEY/);
    assert.match(workflow, /tailscale set --exit-node=/);
    assert.match(workflow, /Xvfb :99/);
    assert.match(workflow, /x11vnc/);
  }
});

test('legacy successor launcher is fail-closed and current successor routing uses the orchestrator', () => {
  assert.match(watchdog, /Legacy create-fresh Lite successor launcher is retired/);
  assert.match(watchdog, /lite-audit-browser-orchestrator-v1\.yml/);
  assert.match(orchestrator, /prepare-lite-assignment-successor-v2\.mjs/);
  assert.match(orchestrator, /\.agentChats\[\$reviewer\]/);
  assert.match(orchestrator, /-f mode=resume_existing/);
  assert.doesNotMatch(orchestrator, /-f mode=create_fresh|WAKE_UP_MESSAGE\.md/);
});

test('Lite watchdog does not equate phase closure with campaign completion', () => {
  assert.match(watchdog, /LITE_CAMPAIGN_TERMINAL_/);
  assert.match(watchdog, /Internal phase advancement/);
  assert.doesNotMatch(watchdog, /\[ "\$lite_campaign_status" = "COMPLETE" \] \|\| \[ "\$lite_phase_state" = "CLOSED" \]/);
});

test('legacy parallel chat watchdog is absent while one-shot trigger shim is allowed', () => {
  const workflows = fs.readdirSync(path.join(root, '.github/workflows'));
  assert.equal(workflows.includes('browser-agent-chat-watchdog-v40.yml'), false);
  assert.equal(workflows.includes('browser-agent-watchdog.yml'), true);
  assert.equal(workflows.includes('watchdog-sweep-once-v1.yml'), true);
});

test('terminal watchdog state retention is bounded without touching active state or registrations', () => {
  assert.match(watchdog, /prune_completed_states\(\)/);
  assert.match(watchdog, /WATCHDOG_COMPLETED_RETENTION_MAX:-100/);
  assert.match(watchdog, /status=="COMPLETED_CANONICAL_GATE"/);
  assert.match(watchdog, /process\/browser-agent-watchdog\/active\/\$file_name/);
  assert.match(watchdog, /--method DELETE "\$completed_dir_api\/\$file_name"/);
  assert.doesNotMatch(watchdog, /DELETE[^\n]*process\/browser-agent-wake\/registrations/);
});

test('watchdog workflow contains one complete sweep body and no duplicated corrupt tail', () => {
  const lines = watchdog.split(/\r?\n/);
  assert.equal(lines.some((line) => line.startsWith('\\t')), false);
  assert.equal(lines.some((line) => /^\t/.test(line)), false);
  assert.equal((watchdog.match(/launch_lite_successor\(\) \{/g) ?? []).length, 1);
  assert.equal((watchdog.match(/Watchdog sweep complete; active state remains for the next scheduled sweep\./g) ?? []).length, 1);
});

test('stop click is verified from desktop screenshots and has a live self-test on a scratch chat', () => {
  const runtime = fs.readFileSync('scripts/browser-agent-wake.mjs', 'utf8');
  assert.match(runtime, /x11FindDarkDisc\(search, searchX, searchY\)/);
  assert.match(runtime, /disc\.darkCells >= 6 && disc\.darkCells <= 40/);
  assert.match(runtime, /if \(onButton\) \{/);
  assert.match(runtime, /STOP_CLICK_MISSED_NOT_ON_BUTTON/);
  assert.match(watchdog, /\.lastStopClick=\$sc/);
  const selftest = fs.readFileSync('.github/workflows/browser-stop-click-selftest-v1.yml', 'utf8');
  assert.match(selftest, /Refuse registered audit chats/);
  assert.match(selftest, /group: chatgpt-shared-browser-session-v1/);
  assert.match(selftest, /test "\$status" = STOP_CLICK_ON_BUTTON/);
});

test('targeted-test executor wake is scope-locked to running the plan', () => {
  const controller = fs.readFileSync('.github/workflows/lite-phase-work-packet-controller-v1.yml', 'utf8');
  assert.match(controller, /TARGETED TEST EXECUTOR: your only task is to run the tests in the plan/);
  assert.match(controller, /do not open other phases, reports or authority files/);
  assert.match(controller, /zero test assertions is a failure to repair, not progress/);
});

test('shared delivery keeps its stdout to key=value lines safe for GITHUB_OUTPUT', () => {
  const deliver = fs.readFileSync('scripts/browser-deliver-message-v1.sh', 'utf8');
  assert.match(deliver, /node scripts\/browser-agent-wake\.mjs >&2/);
  for (const line of deliver.split('\n').filter(l => /^echo /.test(l))) assert.match(line, /^echo "(ok|send_attempted|skipped|rc)=/);
});
