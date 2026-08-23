import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { V7_POLICY } from '../src/v7-policy.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');

function read(relative) {
  return fs.readFileSync(path.join(repoRoot, relative), 'utf8');
}

test('both canonical V7 workflows call the same shared Medusa 1.5.1 setup and qualification records usability', () => {
  const setup = read(V7_POLICY.workflows.toolchainSetup);
  const execution = read(V7_POLICY.workflows.execution);
  const qualification = read(V7_POLICY.workflows.qualification);

  assert.match(setup, /actions\/setup-go@v5/);
  assert.match(setup, /go-version:\s*['"]?1\.24/);
  assert.match(setup, /go install github\.com\/crytic\/medusa@v1\.5\.1/);
  assert.match(setup, /npm run v7:toolchain:verify/);

  const sharedUse = /uses:\s*\.\/\.github\/actions\/setup-v7-toolchain/g;
  assert.equal((execution.match(sharedUse) ?? []).length, 1);
  assert.equal((qualification.match(sharedUse) ?? []).length, 1);

  assert.match(qualification, /medusa151Usable/);
  assert.match(qualification, /medusaVersion/);
  assert.match(qualification, /expectedMedusaVersion/);
  assert.match(qualification, /V7_POLICY\.tools\.medusa/);
});
