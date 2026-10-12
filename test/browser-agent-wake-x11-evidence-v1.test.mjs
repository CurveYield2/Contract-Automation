import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const wake=fs.readFileSync('scripts/browser-agent-wake.mjs','utf8');
const yml=fs.readFileSync('.github/workflows/browser-agent-wake.yml','utf8');
const dispatch=fs.readFileSync('.github/workflows/phase1-wake-repair-dispatch-v1.yml','utf8');
test('fixed-coordinate wake never marks Return key as durable delivery',()=>{
 const start=wake.indexOf('let sendChanged');
 const block=wake.slice(start,wake.indexOf('  } finally {',start));
 assert.ok(start>0);
 assert.match(block,/sendAttempted: true, persisted:false/);
 assert.match(block,/verification:'X11_VISIBLE_COMPOSER_TRANSITION_ONLY'/);
 assert.match(block,/NOT proof that ChatGPT/);
});
test('diagnostic-only captures X11 desktop without typing a message',()=>{
 const a=wake.indexOf('if (bool(env.WAKE_DIAGNOSTIC_ONLY))');
 const b=wake.indexOf('if (action === \'observe\')',a);
 assert.ok(a>0 && b>a);
 assert.match(wake.slice(a,b),/DIAGNOSTIC_ONLY_NO_SEND/);
 assert.doesNotMatch(wake.slice(a,b),/humanX11TypeText\(page, wakeMessage\)/);
 assert.match(wake.slice(0,b),/captureX11VisualEvidence\('01_after_chat_navigation'\)/);
});
test('wake workflow retains screenshot evidence and cannot arm state for unverified send',()=>{
 assert.match(yml,/sudo apt-get install -y x11vnc xclip xdotool scrot/);
 assert.match(yml,/WAKE_DIAGNOSTIC_ONLY/);
 assert.match(yml,/Browser result claimed an X11 send without input evidence/);
 assert.match(yml,/steps.receipt.outputs.verified == 'true'/);
 assert.match(dispatch,/diagnosticOnly:\$diagnostic/);
});
