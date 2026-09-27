import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const workflow = fs.readFileSync(path.join(root, '.github/workflows/audit-source-initialization-v1.yml'), 'utf8');
const run = fs.readFileSync(path.join(root, 'scripts/audit-source-initialization/run-v1.sh'), 'utf8');
const resolve = fs.readFileSync(path.join(root, 'scripts/audit-source-initialization/resolve-source-v1.sh'), 'utf8');
const extract = fs.readFileSync(path.join(root, 'scripts/audit-source-initialization/extract-v1.sh'), 'utf8');
const state = fs.readFileSync(path.join(root, 'scripts/audit-source-initialization/write-state-v1.py'), 'utf8');
const request = JSON.parse(fs.readFileSync(path.join(root, 'process/audit-source-initialization/REQUEST_TEMPLATE_v1.json'), 'utf8'));

test('Audit Source Initialization accepts only source_url as request payload', () => {
  assert.equal(request.schema, 'curveyield-audit-source-initialization/v1');
  assert.equal(Object.keys(request).length, 2);
  assert.equal(typeof request.source_url, 'string');
  assert.match(workflow, /source_url:/);
  assert.doesNotMatch(workflow, /campaign_id:\n\s+description:/);
  assert.doesNotMatch(workflow, /audit_name:\n\s+description:/);
});

test('only direct single ZIP files on Google Drive or GitHub are accepted', () => {
  assert.match(resolve, /Google Drive folder submissions are not accepted/);
  assert.match(resolve, /GitHub folders\/repository archives are not accepted/);
  assert.match(resolve, /GitHub URL must identify one \.zip file/);
  assert.match(resolve, /Downloaded object is not a ZIP file/);
  assert.match(resolve, /unzip -tqq/);
});

test('source identity is derived by automation', () => {
  assert.match(resolve, /sha256sum/);
  assert.match(resolve, /stat -c '%s'/);
  assert.match(resolve, /display-base/);
  assert.match(resolve, /slug/);
  assert.match(run, /source_blob=.*git rev-parse/);
  assert.match(run, /admission_commit=.*git rev-parse HEAD/);
});

test('repeated submissions allocate new rN while exact workflow retry is idempotent', () => {
  assert.match(run, /max \+ 1/);
  assert.match(run, /campaign_id="\$slug-r\$revision"/);
  assert.match(run, /new request using the same ZIP is NOT/);
  assert.match(run, /prior-source-init\.json/);
});

test('campaign source folder contains retained ZIP plus safely unpacked source', () => {
  assert.match(run, /source_dir="\$campaign_root\/source"/);
  assert.match(run, /cp "\$work\/\$filename" "\$source_path"/);
  assert.match(run, /safe_extract_audit_zip/);
  assert.match(extract, /archive entry escapes source directory/);
  assert.match(extract, /symlink archive entry forbidden/);
  assert.match(extract, /embedded \.git path forbidden/);
});

test('workflow writes initial controller state and active pointer on Audit-Controller main', () => {
  assert.match(state, /CAMPAIGN_STATE_v1\.json/);
  assert.match(state, /ACTIVE_PHASE_POINTER_v1\.json/);
  assert.match(state, /SOLO_AUDIT_STATE_v1\.json/);
  assert.match(state, /sourceFenceStatus/);
  assert.match(state, /"BOUND"/);
  assert.match(state, /ACTIVE_PATH/);
  assert.match(run, /git push origin HEAD:main/);
});

test('workflow arms the existing Lite browser orchestrator after initialization', () => {
  assert.match(run, /lite-audit-browser-orchestrator-v1\.yml/);
  assert.match(run, /audit_controller_ref=main/);
});
