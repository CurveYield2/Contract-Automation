import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { validateDeepAssuranceRequestWithV26V1 } from './schema-v26.mjs';
import { assertCanonicalRequestIdentityV2 } from './request-identity-v2.mjs';
import { preflightRequestSubmitV1 } from './preflight/request-submit-v1.mjs';
import { V7_POLICY } from './v7-policy.mjs';

function sha256(bytes) { return createHash('sha256').update(bytes).digest('hex'); }
function encodePath(value) { return String(value).split('/').map(encodeURIComponent).join('/'); }

async function githubApi({ repository, token, method = 'GET', route, body = undefined }) {
  if (!token) throw new Error('V7 request submission requires GH_TOKEN or GITHUB_TOKEN');
  const response = await fetch(`https://api.github.com/repos/${repository}${route}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      'content-type': 'application/json',
      'user-agent': 'curveyield-contract-automation-v7-submit',
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  let payload = null;
  if (text) { try { payload = JSON.parse(text); } catch { payload = { message: text }; } }
  if (!response.ok) {
    const error = new Error(`GitHub API ${method} ${route} failed with HTTP ${response.status}: ${payload?.message ?? 'unknown error'}`);
    error.status = response.status; error.payload = payload; throw error;
  }
  return payload;
}

async function maybeGetRef({ repository, token, branch }) {
  try { return await githubApi({ repository, token, route: `/git/ref/heads/${encodePath(branch)}` }); }
  catch (error) { if (error.status === 404) return null; throw error; }
}

async function verifyBlobBytes({ repository, token, blobSha, expectedBytes }) {
  const blob = await githubApi({ repository, token, route: `/git/blobs/${blobSha}` });
  if (blob?.encoding !== 'base64' || typeof blob?.content !== 'string') throw new Error('GitHub blob verification returned unsupported encoding');
  const observed = Buffer.from(blob.content.replace(/\n/g, ''), 'base64');
  if (!observed.equals(expectedBytes)) throw new Error('Remote Git blob bytes do not exactly match the locally validated request bytes');
  return { bytes: observed.length, sha256: sha256(observed) };
}

async function ensureAtomicDiff({ repository, token, base, head, requestPath }) {
  const compare = await githubApi({ repository, token, route: `/compare/${encodeURIComponent(base)}...${encodeURIComponent(head)}` });
  const changed = (compare?.files ?? []).map((file) => file.filename).sort();
  if (changed.length !== 1 || changed[0] !== requestPath) {
    throw new Error(`V7 request branch must differ from ${base} by exactly ${requestPath}; observed ${changed.join(', ') || 'no changed files'}`);
  }
  return changed;
}

async function ensureTracePullRequest({ repository, token, base, branch, request }) {
  const [owner] = repository.split('/');
  const pulls = await githubApi({ repository, token, route: `/pulls?state=open&base=${encodeURIComponent(base)}&head=${encodeURIComponent(`${owner}:${branch}`)}` });
  if (Array.isArray(pulls) && pulls.length > 0) return pulls[0];
  return githubApi({ repository, token, method: 'POST', route: '/pulls', body: {
    title: `V7 request ${request.requestId} — ${request.phaseId}`,
    head: branch, base,
    body: `Trace-only V7 execution request. Do not merge.\n\nRequest: ${request.requestId}\nPhase: ${request.phaseId}\nSource: ${request.source.repository}@${request.source.commit}`,
    draft: false,
  }});
}

const EXECUTABLE_PHASES = new Set(['build-and-test', 'fork-simulation-lifecycle']);
function buildRequestSubmitReceipt({ request, repository, targetPath, currentBaseSha, branchBaseSha, reuseExistingPr }) {
  const computed = assertCanonicalRequestIdentityV2(request);
  return preflightRequestSubmitV1({
    repository,
    requestPath: targetPath,
    requestId: request.requestId,
    computedRequestId: computed.requestId,
    requestDigest: request.requestDigest,
    computedRequestDigest: computed.requestDigest,
    sourceCommit: request.source.commit,
    ...(request.source.archiveSha256 ? { archiveSha256: request.source.archiveSha256 } : {}),
    schemaValid: true,
    requestPayload: request,
    profileAdmitted: Object.values(V7_POLICY.profiles).includes(request.profileId),
    phaseAdmitted: EXECUTABLE_PHASES.has(request.phaseId),
    currentTrustedBaseSha: currentBaseSha,
    branchBaseSha,
    predictedChangedPaths: [targetPath],
    duplicateSemanticsExistingPr: reuseExistingPr,
    reuseExistingPr,
    verifyRemoteBytes: true,
    rollbackPlan: reuseExistingPr ? 'no new branch mutation; preserve existing immutable request branch' : 'delete request branch/trace PR if post-write exact-byte verification fails',
  });
}

function requirePassingReceipt(receipt) {
  if (receipt.status === 'PREFLIGHT_PASS' && receipt.executionAuthorized === true) return receipt;
  const error = new Error(`REQUEST_SUBMIT_PREFLIGHT_FAILED: ${receipt.firstFailure ?? 'unknown'}: ${receipt.diagnostics?.[0]?.summary ?? 'request submission blocked'}`);
  error.code = receipt.firstFailure ?? 'REQUEST_SUBMIT_PREFLIGHT_FAILED';
  error.preflight = receipt;
  throw error;
}

export async function submitV7Request({
  requestPath,
  repository = 'CurveYield2/Contract-Automation',
  base = 'main',
  branch = null,
  token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN,
  createPullRequest = true,
} = {}) {
  if (!requestPath) throw new Error('V7 request submission requires --request <request.json>');
  const absolute = path.resolve(requestPath);
  const bytes = await fs.readFile(absolute);
  let parsed;
  try { parsed = JSON.parse(bytes.toString('utf8')); }
  catch (error) { throw new Error(`Request JSON parse failed before submission: ${error.message}`); }
  const request = validateDeepAssuranceRequestWithV26V1(parsed);
  const identity = assertCanonicalRequestIdentityV2(request);
  const transportSha256 = sha256(bytes);
  const targetPath = `github-native-sim/requests/${request.requestId}/request.json`;
  const requestBranch = branch ?? `audit-request/${request.requestId}`;

  // Read-only discovery is allowed before preflight; no GitHub mutation occurs above or below until the receipt passes.
  const baseRef = await githubApi({ repository, token, route: `/git/ref/heads/${encodePath(base)}` });
  const existingRef = await maybeGetRef({ repository, token, branch: requestBranch });
  let existingCommit = null;
  if (existingRef) existingCommit = await githubApi({ repository, token, route: `/git/commits/${existingRef.object.sha}` });
  const branchBaseSha = existingCommit?.parents?.[0]?.sha ?? baseRef.object.sha;
  const preflight = requirePassingReceipt(buildRequestSubmitReceipt({
    request, repository, targetPath, currentBaseSha: baseRef.object.sha, branchBaseSha, reuseExistingPr: Boolean(existingRef),
  }));

  if (existingRef) {
    const tree = await githubApi({ repository, token, route: `/git/trees/${existingCommit.tree.sha}?recursive=1` });
    const entry = (tree?.tree ?? []).find((item) => item.path === targetPath && item.type === 'blob');
    if (!entry) throw new Error(`Existing request branch ${requestBranch} does not contain ${targetPath}`);
    const verified = await verifyBlobBytes({ repository, token, blobSha: entry.sha, expectedBytes: bytes });
    // Existing immutable request branches are intentionally not rebased merely to pick up newer trusted runner code.
    const pr = createPullRequest ? await ensureTracePullRequest({ repository, token, base, branch: requestBranch, request }) : null;
    return {
      status: 'ALREADY_SUBMITTED_VERIFIED', requestId: request.requestId, requestDigest: identity.requestDigest,
      transportSha256, bytes: verified.bytes, repository, base, branch: requestBranch, commit: existingRef.object.sha,
      targetPath, preflight,
      pullRequest: pr ? { number: pr.number, url: pr.html_url } : null,
    };
  }

  const baseCommit = await githubApi({ repository, token, route: `/git/commits/${baseRef.object.sha}` });
  const blob = await githubApi({ repository, token, method: 'POST', route: '/git/blobs', body: { content: bytes.toString('base64'), encoding: 'base64' } });
  const tree = await githubApi({ repository, token, method: 'POST', route: '/git/trees', body: {
    base_tree: baseCommit.tree.sha,
    tree: [{ path: targetPath, mode: '100644', type: 'blob', sha: blob.sha }],
  }});
  const commit = await githubApi({ repository, token, method: 'POST', route: '/git/commits', body: {
    message: `Submit atomic V7 request ${request.requestId}`, tree: tree.sha, parents: [baseRef.object.sha],
  }});
  await githubApi({ repository, token, method: 'POST', route: '/git/refs', body: { ref: `refs/heads/${requestBranch}`, sha: commit.sha } });

  const verified = await verifyBlobBytes({ repository, token, blobSha: blob.sha, expectedBytes: bytes });
  if (verified.sha256 !== transportSha256 || verified.bytes !== bytes.length) throw new Error('Remote request verification digest/length mismatch');
  await ensureAtomicDiff({ repository, token, base, head: requestBranch, requestPath: targetPath });
  const pr = createPullRequest ? await ensureTracePullRequest({ repository, token, base, branch: requestBranch, request }) : null;

  return {
    status: 'SUBMITTED_VERIFIED', requestId: request.requestId, requestDigest: identity.requestDigest,
    transportSha256, bytes: bytes.length, repository, base, branch: requestBranch, commit: commit.sha,
    targetPath, preflight,
    pullRequest: pr ? { number: pr.number, url: pr.html_url } : null,
  };
}
