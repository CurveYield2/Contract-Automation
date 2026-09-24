import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAuditOperatorIssueV1 } from '../src/issue-trigger-v1.mjs';

test('parses exact agent-operable audit operator issue', () => {
  const out = parseAuditOperatorIssueV1({
    title: '[agent] audit-operator awr-smoke-v1',
    body: `controller_ref=${'a'.repeat(40)}\n`,
  });
  assert.equal(out.requestId, 'awr-smoke-v1');
  assert.equal(out.controllerRef, 'a'.repeat(40));
  assert.equal(out.requestPath, '.deep-assurance/operator/requests/awr-smoke-v1.json');
});

test('rejects mutable refs and malformed titles', () => {
  assert.throws(() => parseAuditOperatorIssueV1({ title: '[agent] audit-operator x', body: 'controller_ref=main' }), /40-hex/);
  assert.throws(() => parseAuditOperatorIssueV1({ title: 'audit-operator x', body: `controller_ref=${'a'.repeat(40)}` }), /title/);
});
