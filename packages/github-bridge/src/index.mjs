import { validateCreateJobRequest } from '../../protocol/src/index.mjs';

export const BRIDGE_MARKER = '<!-- preflightsim-job -->';
export const STARTED_MARKER = '<!-- preflightsim-bridge-started -->';

export function parseAllowedUsers(value) {
  return new Set(String(value ?? '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean));
}

export function extractJobRequest(issueBody) {
  const body = String(issueBody ?? '');
  const markerIndex = body.indexOf(BRIDGE_MARKER);
  if (markerIndex < 0) throw new Error(`Issue body is missing the ${BRIDGE_MARKER} marker`);
  const remainder = body.slice(markerIndex + BRIDGE_MARKER.length);
  const match = remainder.match(/```json\s*([\s\S]*?)```/i);
  if (!match) throw new Error('Issue body must contain a fenced JSON job request after the marker');
  let parsed;
  try {
    parsed = JSON.parse(match[1]);
  } catch {
    throw new Error('PreflightSim issue payload is not valid JSON');
  }
  const request = parsed?.preflightsimJob ?? parsed;
  return validateCreateJobRequest(request);
}

function githubHeaders(token) {
  return {
    accept: 'application/vnd.github+json',
    authorization: `Bearer ${token}`,
    'content-type': 'application/json',
    'user-agent': 'PreflightSim-GitHub-Bridge',
    'x-github-api-version': '2022-11-28'
  };
}

function apiHeaders(apiKey) {
  return {
    accept: 'application/json',
    authorization: `Bearer ${apiKey}`,
    'content-type': 'application/json'
  };
}

async function responseJson(response, label) {
  let body;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  if (!response.ok) {
    const message = body?.error?.message ?? body?.message ?? `${label} returned ${response.status}`;
    const failure = new Error(message);
    failure.status = response.status;
    failure.payload = body;
    throw failure;
  }
  return body;
}

async function githubRequest(fetcher, token, url, init = {}) {
  return responseJson(await fetcher(url, {
    ...init,
    headers: { ...githubHeaders(token), ...(init.headers ?? {}) }
  }), 'GitHub API');
}

async function preflightRequest(fetcher, apiKey, url, init = {}) {
  return responseJson(await fetcher(url, {
    ...init,
    headers: { ...apiHeaders(apiKey), ...(init.headers ?? {}) }
  }), 'PreflightSim API');
}

export function splitResultComments(result, { maxBodyChars = 50_000, maxParts = 12 } = {}) {
  const serialized = JSON.stringify(result, null, 2);
  const reserve = 180;
  const chunkSize = Math.max(1_000, maxBodyChars - reserve);
  const totalNeeded = Math.ceil(serialized.length / chunkSize);
  const total = Math.min(totalNeeded, maxParts);
  const comments = [];
  for (let index = 0; index < total; index += 1) {
    const start = index * chunkSize;
    const end = Math.min(serialized.length, start + chunkSize);
    const truncated = index === total - 1 && end < serialized.length;
    const body = serialized.slice(start, end);
    comments.push(`<!-- preflightsim-result-part:${index + 1}/${total} -->\n### PreflightSim result part ${index + 1}/${total}\n\n\`\`\`json\n${body}\n\`\`\`${truncated ? '\n\n_Result truncated by the GitHub bridge size cap._' : ''}`);
  }
  return comments;
}

function formatSummary(summary) {
  const lines = [
    '<!-- preflightsim-bridge-summary -->',
    `## PreflightSim ${summary.status === 'completed' ? 'completed' : 'finished with failure'}`,
    '',
    `- Job: \`${summary.jobId}\``,
    `- Status: **${summary.status}**`
  ];
  if (summary.mode) lines.push(`- Mode: \`${summary.mode}\``);
  if (summary.chain) lines.push(`- Chain: \`${summary.chain}\``);
  if (summary.compiler) {
    lines.push(`- Compiler diagnostics: ${summary.compiler.errorCount} errors, ${summary.compiler.warningCount} warnings`);
  }
  if (summary.workflow) {
    lines.push(`- Workflow: ${summary.workflow.completedSteps}/${summary.workflow.totalSteps} steps completed; ${summary.workflow.failedSteps} failed`);
  }
  if (summary.deployments && Object.keys(summary.deployments).length) {
    lines.push('', '### Deployments', '```json', JSON.stringify(summary.deployments, null, 2), '```');
  }
  if (summary.error) {
    lines.push('', '### Error', '```json', JSON.stringify(summary.error, null, 2), '```');
  }
  return lines.join('\n');
}

export async function runGithubBridge({
  issue,
  repository,
  allowedUsers,
  apiUrl,
  apiKey,
  githubToken,
  fetcher = fetch,
  sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  pollIntervalMs = 20_000,
  maxPolls = 115
}) {
  if (issue?.pull_request) throw new Error('PreflightSim bridge accepts GitHub issues, not pull requests');
  const author = String(issue?.user?.login ?? '').toLowerCase();
  const allowlist = allowedUsers instanceof Set ? allowedUsers : parseAllowedUsers(allowedUsers);
  if (!author || !allowlist.has(author)) throw new Error(`GitHub author ${issue?.user?.login ?? '(unknown)'} is not authorized`);
  if (!repository || !/^[-A-Za-z0-9_.]+\/[-A-Za-z0-9_.]+$/.test(repository)) throw new Error('Invalid GitHub repository name');
  if (!Number.isInteger(issue?.number)) throw new Error('Issue number is required');

  const githubBase = `https://api.github.com/repos/${repository}`;
  const commentsUrl = `${githubBase}/issues/${issue.number}/comments`;
  const comments = await githubRequest(fetcher, githubToken, `${commentsUrl}?per_page=100`);
  if (comments.some((comment) => String(comment?.body ?? '').includes(STARTED_MARKER))) {
    throw new Error('This PreflightSim issue job has already started');
  }

  const request = extractJobRequest(issue.body);
  await githubRequest(fetcher, githubToken, commentsUrl, {
    method: 'POST',
    body: JSON.stringify({ body: `${STARTED_MARKER}\nPreflightSim accepted this issue and is submitting the validated job.` })
  });

  const base = String(apiUrl).replace(/\/$/, '');
  const created = await preflightRequest(fetcher, apiKey, `${base}/api/v1/jobs`, {
    method: 'POST',
    body: JSON.stringify(request)
  });
  await githubRequest(fetcher, githubToken, commentsUrl, {
    method: 'POST',
    body: JSON.stringify({ body: `PreflightSim job created: \`${created.jobId}\`. The bridge will post results here when execution finishes.` })
  });

  let status = created;
  for (let attempt = 0; attempt < maxPolls; attempt += 1) {
    status = await preflightRequest(fetcher, apiKey, `${base}/api/v1/jobs/${created.jobId}`);
    if (status.status === 'completed' || status.status === 'failed') break;
    if (attempt < maxPolls - 1) await sleep(pollIntervalMs);
  }
  if (status.status !== 'completed' && status.status !== 'failed') {
    throw new Error(`PreflightSim job ${created.jobId} did not finish within the bridge polling window`);
  }

  const summary = await preflightRequest(fetcher, apiKey, `${base}/api/v1/jobs/${created.jobId}/summary`);
  let result;
  try {
    result = await preflightRequest(fetcher, apiKey, `${base}/api/v1/jobs/${created.jobId}/result`);
  } catch (cause) {
    if (status.status !== 'failed' || cause?.status !== 409) throw cause;
    result = {
      jobId: created.jobId,
      status: 'failed',
      error: summary.error ?? { message: 'No full result was published for this failed job' }
    };
  }
  await githubRequest(fetcher, githubToken, commentsUrl, {
    method: 'POST',
    body: JSON.stringify({ body: formatSummary(summary) })
  });
  for (const comment of splitResultComments(result)) {
    await githubRequest(fetcher, githubToken, commentsUrl, {
      method: 'POST',
      body: JSON.stringify({ body: comment })
    });
  }
  await githubRequest(fetcher, githubToken, `${githubBase}/issues/${issue.number}`, {
    method: 'PATCH',
    body: JSON.stringify({ state: 'closed', state_reason: 'completed' })
  });
  return { jobId: created.jobId, status: status.status, summary };
}

export async function postBridgeFailure({ repository, issueNumber, githubToken, message, fetcher = fetch }) {
  if (!repository || !Number.isInteger(issueNumber) || !githubToken) return;
  const url = `https://api.github.com/repos/${repository}/issues/${issueNumber}/comments`;
  const safeMessage = String(message ?? 'Unknown bridge failure').replaceAll('```', "'''").slice(0, 8_000);
  await githubRequest(fetcher, githubToken, url, {
    method: 'POST',
    body: JSON.stringify({ body: `<!-- preflightsim-bridge-failed -->\n## PreflightSim bridge failed\n\n\`\`\`text\n${safeMessage}\n\`\`\`` })
  });
}
