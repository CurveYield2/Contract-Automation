import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
const workflow=fs.readFileSync(fileURLToPath(new URL('../../../.github/workflows/lite-v7-execution-dispatch-v1.yml',import.meta.url)),'utf8');
test('unchanged Phase 9 dispatch admission remains present',()=>assert.match(workflow,/controller\/phase9-reruns\//));
test('Phase 6 dispatch is explicitly bounded',()=>{
 assert.match(workflow,/controller\/phase6-tests\//);
 assert.match(workflow,/ROUND_LIMIT_REACHED/);
 assert.match(workflow,/phaseSequence==9 or \.phaseSequence==6/);
});
