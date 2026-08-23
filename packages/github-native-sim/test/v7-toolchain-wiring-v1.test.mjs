import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');

function read(relative) {
  return fs.readFileSync(path.join(repoRoot, relative), 'utf8');
}

test('both canonical V7 workflows call one shared Medusa 1.5.1 setup and qualification records exact usability', () => {
  const setup = read('.github/actions/setup-v7-toolchain/action.yml');
  const execution = read('.github/workflows/audit-controller-execution.yml');
  const qualification = read('.github/workflows/v7-execution-infrastructure-qualification.yml');

  assert.match(setup, /actions\/setup-go@v5/);
  assert.match(setup, /go-version:\s*['"]?1\.24/);
  assert.match(setup, /go install github\.com\/crytic\/medusa@v1\.5\.1/);
  assert.match(setup, /medusa[^\n]*--version/);
  assert.match(setup, /1\\\.5\\\.1|1\.5\.1/);

  for (const workflow of [execution, qualification]) {
    const calls = workflow.match(/uses:\s*\.\/\.github\/actions\/setup-v7-toolchain/g) ?? [];
    assert.equal(calls.length, 1, 'each canonical workflow must invoke the shared V7 toolchain action exactly once');
  }

  assert.match(qualification, /medusa151Usable/);
  assert.match(qualification, /execFileSync\(['"]medusa['"],\s*\[['"]--version['"]\]/);
  assert.match(qualification, /medusaVersion/);
});
