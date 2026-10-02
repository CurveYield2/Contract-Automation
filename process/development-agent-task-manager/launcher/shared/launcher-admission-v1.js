const DEFAULT_ALLOWED_REPOSITORIES = [
  'CurveYield2/Contract-Automation',
  'CurveYield2/Audit-Controller',
];

export const DEFAULT_AUTHORITY_PATH =
  'process/development-agent-task-manager/UPGRADE_AGENT_EXECUTION_AUTHORITY_v1.md';

export function safeSlug(value) {
  const slug = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 72)
    .replace(/-+$/g, '');
  if (!slug) throw new Error('Task name must contain at least one letter or number.');
  return slug;
}

export function validateLaunchInput(input, {
  allowedRepositories = DEFAULT_ALLOWED_REPOSITORIES,
} = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Launch input must be an object.');
  }
  const taskName = String(input.taskName || '').trim();
  const instruction = String(input.instruction || '').trim();
  const targetRepository = String(input.targetRepository || '').trim();
  const baseRef = String(input.baseRef || 'main').trim();
  const authorityPath = String(input.authorityPath || DEFAULT_AUTHORITY_PATH).trim();
  const continuityMode = String(input.continuityMode || 'managed_project').trim();
  const initialAssignment = String(input.initialAssignment || '');
  const targetBranch = String(input.targetBranch || '').trim();
  const acceptanceCriteria = Array.isArray(input.acceptanceCriteria)
    ? input.acceptanceCriteria.map((item) => String(item).trim()).filter(Boolean)
    : [];

  if (taskName.length < 1 || taskName.length > 120) throw new Error('Task name must be 1-120 characters.');
  if (instruction.length < 1 || instruction.length > 30000) throw new Error('Instruction must be 1-30000 characters.');
  if (!allowedRepositories.includes(targetRepository)) throw new Error('Target repository is not allowlisted.');
  if (!baseRef || baseRef.length > 255) throw new Error('Base ref is invalid.');
  if (!authorityPath || authorityPath.length > 500) throw new Error('Authority path is invalid.');
  if (!['managed_project', 'standalone'].includes(continuityMode)) throw new Error('Continuity mode is invalid.');
  if (initialAssignment.length > 10000) throw new Error('Initial assignment is too long.');
  if (targetBranch.length > 255) throw new Error('Target branch is too long.');
  if (acceptanceCriteria.length > 30) throw new Error('Too many acceptance criteria.');
  if (acceptanceCriteria.some((item) => item.length > 1000)) throw new Error('Acceptance criterion is too long.');

  return {
    taskName,
    instruction,
    targetRepository,
    baseRef,
    authorityPath,
    continuityMode,
    initialAssignment,
    targetBranch,
    acceptanceCriteria,
  };
}

export function managerIdentity(taskName, revision) {
  if (!Number.isInteger(revision) || revision < 1 || revision > 9999) {
    throw new Error('Revision must be an integer between 1 and 9999.');
  }
  const slug = safeSlug(taskName);
  const managerId = `upgrade-${slug}-r${revision}`;
  if (managerId.length > 160) throw new Error('Generated manager ID is too long.');
  return { slug, revision, managerId };
}

export function buildLaunchPaths({ managerId }) {
  if (!/^[A-Za-z0-9._-]{1,160}$/.test(managerId)) throw new Error('Manager ID is invalid.');
  return {
    specificationPath: `process/development-agent-task-manager/specifications/${managerId}_SPEC_v1.md`,
    requestPath: `process/development-agent-task-manager/requests/${managerId}_v1.json`,
    activePath: `process/development-agent-task-manager/active/${managerId}.json`,
    completedPath: `process/development-agent-task-manager/completed/${managerId}.json`,
  };
}

export function defaultTargetBranch(taskName, revision) {
  const { slug } = managerIdentity(taskName, revision);
  return `upgrade/${slug}-r${revision}`;
}

function markdownList(items, emptyValue = '- None') {
  return items.length ? items.map((item) => `- ${item}`).join('\n') : emptyValue;
}

export function renderTaskSpecification(input) {
  const data = validateLaunchInput(input);
  const managerId = String(input.managerId || '').trim();
  const targetBranch = String(input.resolvedTargetBranch || data.targetBranch || '').trim();
  if (!/^[A-Za-z0-9._-]{1,160}$/.test(managerId)) throw new Error('managerId is required for specification rendering.');
  if (!targetBranch) throw new Error('resolvedTargetBranch is required for specification rendering.');

  return `# Managed Upgrade Task Specification v1

## Manager

- Manager ID: \`${managerId}\`
- Target repository: \`${data.targetRepository}\`
- Target branch: \`${targetBranch}\`
- Base ref: \`${data.baseRef}\`
- Final merge target: \`main\`
- Continuity: \`${data.continuityMode}\`
- Authority: \`${data.authorityPath}\`

## Human Requested End-State

${data.instruction}

## Acceptance Criteria

${markdownList(data.acceptanceCriteria)}

## Execution Contract

- Preserve the human-requested end-state exactly; do not broaden it.
- Read the selected authority and Development/Upgrade Agent Task-Lock Protocol before implementation.
- Inspect live target-repository \`main\` and the target branch before edits.
- Work only the smallest remaining delta.
- Park non-blocking discoveries.
- Keep one implementation branch.
- Verify required tests before completion.
- A successful task concludes only after the verified implementation is merged into target repository \`main\`.
- The Development Agent Task Manager owns final PR creation/reuse and merge after the completion receipt is valid.
`;
}

export function renderManagerRequest(input) {
  const data = validateLaunchInput(input);
  const managerId = String(input.managerId || '').trim();
  const targetBranch = String(input.resolvedTargetBranch || data.targetBranch || '').trim();
  const specificationPath = String(input.specificationPath || '').trim();
  if (!/^[A-Za-z0-9._-]{1,160}$/.test(managerId)) throw new Error('managerId is required for request rendering.');
  if (!targetBranch) throw new Error('resolvedTargetBranch is required for request rendering.');
  if (!specificationPath) throw new Error('specificationPath is required for request rendering.');

  return {
    schemaVersion: 'curveyield-development-agent-task-request-v1',
    status: 'READY',
    managerId,
    specificationPath,
    skillPath: data.authorityPath,
    authorityRef: 'main',
    targetRepository: data.targetRepository,
    targetBranch,
    baseRef: data.baseRef,
    continuityMode: data.continuityMode,
    ...(data.initialAssignment ? { initialAssignment: data.initialAssignment } : {}),
  };
}

export function completedResult(state) {
  if (!state || state.status !== 'COMPLETE' || state.merge?.status !== 'MERGED') {
    return null;
  }
  const outputUrl = typeof state.output?.url === 'string' ? state.output.url : '';
  if (!/^https:\/\/github\.com\//.test(outputUrl)) return null;
  const projectUrl = state.continuity?.mode === 'managed_project' &&
    /^https:\/\/chatgpt\.com\//.test(String(state.continuity?.project?.url || ''))
      ? state.continuity.project.url
      : null;
  return {
    status: 'COMPLETE',
    outputUrl,
    projectUrl,
    artifactUrl: /^https:\/\/github\.com\//.test(String(state.output?.artifactUrl || ''))
      ? state.output.artifactUrl
      : null,
  };
}

export function parseAllowedRepositories(value) {
  const repos = String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return repos.length ? repos : [...DEFAULT_ALLOWED_REPOSITORIES];
}
