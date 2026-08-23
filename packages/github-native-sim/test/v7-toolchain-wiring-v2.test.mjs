import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { V7_POLICY } from '../src/v7-policy.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const read = (relative) => fs.readFileSync(path.join(repoRoot, relative), 'utf8');

test('both canonical V7 workflows use one shared Medusa 1.5.1 setup and qualification preserves exact usability evidence', () => {
  const action = read(V7_POLICY.workflows.toolchainSetup);
  const execution = read(V7_POLICY.workflows.execution);
  const qualification = read(V7_POLICY.workflows.qualification);

  assert.match(action, /actions\/setup-go@v5/);
  assert.match(action, /go-version:\s*'1\.24\.6'/);
  assert.match(action, /go install github\.com\/crytic\/medusa@v1\.5\.1/);
  assert.match(action, /npm run v7:toolchain:verify/);

  const sharedAction = /uses:\s*\.\/\.github\/actions\/setup-v7-toolchain/g;
  assert.equal((execution.match(sharedAction) ?? []).length, 1);
  assert.equal((qualification.match(sharedAction) ?? []).length, 1);

  assert.match(qualification, /Record exact toolchain verification evidence/);
  assert.match(qualification, /v7:toolchain:verify > \.audit-evidence\/v7-infrastructure-qualification\/toolchain\.json/);
  assert.match(qualification, /Upload qualification evidence/);
  assert.match(qualification, /if:\s*always\(\)/);
  assert.equal(V7_POLICY.tools.medusa, '1.5.1');
});
