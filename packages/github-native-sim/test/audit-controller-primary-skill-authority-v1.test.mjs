import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const workflow = fs.readFileSync(path.join(root, '.github/workflows/audit-controller-execution.yml'), 'utf8');

test('controller operation resolves omitted Lite skill path from campaign authority or global primary pointer', () => {
  assert.match(workflow, /skillAuthority\?\.current/);
  assert.match(workflow, /audit-process\/v7\/LITE_PRIMARY_SKILL_AUTHORITY_v1\.json/);
  assert.match(workflow, /audit-v7-lite-primary-skill-authority-v1/);
  assert.match(workflow, /pointer\.status==='ACTIVE'/);
  assert.match(workflow, /resolved_skill_path/);
  assert.match(workflow, /resolved_skill_sha/);
  assert.match(workflow, /Stable authority folder must contain exactly one unpacked package directory with root SKILL\.md/);
  assert.match(workflow, /sha256sum "\$skill_target"/);
  assert.match(workflow, /SKILL_PACKAGE_PATH=\$resolved_skill_path/);
});

test('explicit request skill path still has precedence over automatic resolution', () => {
  const explicit = workflow.indexOf('resolved_skill_path="${SKILL_PACKAGE_PATH:-}"');
  const fallback = workflow.indexOf('if [ -z "$resolved_skill_path" ]; then');
  assert.ok(explicit >= 0);
  assert.ok(fallback > explicit);
});
