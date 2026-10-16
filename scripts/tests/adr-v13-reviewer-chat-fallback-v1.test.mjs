import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';

const fallback='.agentChats[$reviewer] // (if $reviewer == "reviewer-3" then .agentChats["reviewer-3L"] else empty end) // empty';
const files=[
  '.github/workflows/lite-phase-work-packet-controller-v1.yml',
  '.github/workflows/lite-audit-browser-orchestrator-v1.yml'
];

test('v13 attacker wakes reuse the existing reviewer-3L registration without altering v12',()=>{
  for(const path of files)assert.ok(fs.readFileSync(path,'utf8').includes(fallback),path+' missing v13 fallback');
  const registration={agentChats:{
    'reviewer-2':'https://chatgpt.com/c/reviewer2',
    'reviewer-3L':'https://chatgpt.com/c/attacker'
  }};
  for(const [reviewer,expected] of [
    ['reviewer-2',registration.agentChats['reviewer-2']],
    ['reviewer-3L',registration.agentChats['reviewer-3L']],
    ['reviewer-3',registration.agentChats['reviewer-3L']]
  ]){
    const run=spawnSync('jq',['-r','--arg','reviewer',reviewer,fallback],{
      encoding:'utf8',input:JSON.stringify(registration)
    });
    assert.equal(run.status,0,run.stderr);
    assert.equal(run.stdout.trim(),expected);
  }
});
