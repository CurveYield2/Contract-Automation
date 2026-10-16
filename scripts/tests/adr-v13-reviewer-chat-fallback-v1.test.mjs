import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';

const workflows=[
 '.github/workflows/lite-phase-work-packet-controller-v1.yml',
 '.github/workflows/lite-audit-browser-orchestrator-v1.yml'
];
test('v13 is directly registered as reviewer-3; frozen v12 keeps reviewer-3L',()=>{
 const init=fs.readFileSync('scripts/audit-source-initialization/run-v1.sh','utf8');
 assert.match(init,/third_reviewer_key="reviewer-3L"/);
 assert.match(init,/third_reviewer_key="reviewer-3"/);
 assert.match(init,/\(\$thirdReviewer\):\$chat3/);
 const selector='.agentChats[$reviewer] // empty';
 for(const file of workflows)assert.ok(fs.readFileSync(file,'utf8').includes(selector),file);
 for(const role of ['reviewer-3L','reviewer-3']){
   const registration={agentChats:{[role]:'https://chatgpt.com/c/attacker'}};
   const run=spawnSync('jq',['-r','--arg','reviewer',role,selector],{
     input:JSON.stringify(registration),encoding:'utf8'});
   assert.equal(run.status,0,run.stderr);
   assert.equal(run.stdout.trim(),registration.agentChats[role]);
 }
});
