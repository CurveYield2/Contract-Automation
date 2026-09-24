export function parseAuditOperatorIssueV1({ title, body } = {}) {
  if (typeof title !== 'string') throw new TypeError('title is required');
  const match = title.match(/^\[agent\] audit-operator ([A-Za-z0-9._-]{1,120})$/);
  if (!match) throw new Error('title must be exactly: [agent] audit-operator <request-id>');
  const requestId = match[1];
  const lines = String(body ?? '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const controllerLine = lines.find((line) => line.startsWith('controller_ref='));
  if (!controllerLine) throw new Error('issue body must contain controller_ref=<40-hex-commit>');
  const controllerRef = controllerLine.slice('controller_ref='.length);
  if (!/^[0-9a-f]{40}$/.test(controllerRef)) throw new Error('controller_ref must be an exact lowercase 40-hex commit');
  return {
    schemaVersion: 'audit-operator-issue-trigger-v1',
    requestId,
    controllerRef,
    requestPath: `.deep-assurance/operator/requests/${requestId}.json`,
  };
}
