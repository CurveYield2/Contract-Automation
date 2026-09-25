import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const workflow = fs.readFileSync(path.join(root, '.github/workflows/audit-controller-execution.yml'), 'utf8');

test('canonical private controller validator admits report and evidence assembly operations', () => {
  assert.match(workflow, /BUILD_FINAL_EVIDENCE_INDEX/);
  assert.match(workflow, /BUILD_REPORT_SCAFFOLD/);
  assert.match(workflow, /evidenceIndexInputPath/);
  assert.match(workflow, /reportScaffoldInputPath/);
});

test('report and evidence operations remain inside canonical controller-operation workflow', () => {
  const workflows = fs.readdirSync(path.join(root, '.github/workflows'));
  assert.equal(workflows.some((name) => /report.*bridge|evidence.*bridge/i.test(name)), false);
  assert.match(workflow, /name:\s*Validate private controller operation request/);
  assert.match(workflow, /name:\s*Execute deterministic controller operation/);
  assert.match(workflow, /name:\s*Write controller-operation result back to exact private branch/);
});
