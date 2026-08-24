import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const cli=fs.readFileSync(new URL('../src/v7-cli.mjs',import.meta.url),'utf8');

test('canonical V7 CLI exposes targeted preflight command through shared registry',()=>{
 assert.match(cli,/runTargetedPreflightV1/);
 assert.match(cli,/command==='preflight'/);
 assert.match(cli,/--operation/);
 assert.match(cli,/--config/);
});

test('canonical V7 CLI exposes failure doctor command for failed-run diagnosis',()=>{
 assert.match(cli,/diagnoseFailureV1|diagnoseFailureFileV1/);
 assert.match(cli,/command==='doctor'/);
});
