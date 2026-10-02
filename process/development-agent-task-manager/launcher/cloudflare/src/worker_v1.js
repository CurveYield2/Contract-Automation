import {
  DEFAULT_AUTHORITY_PATH,
  buildLaunchPaths,
  completedResult,
  defaultTargetBranch,
  managerIdentity,
  parseAllowedRepositories,
  renderManagerRequest,
  renderTaskSpecification,
  validateLaunchInput,
} from '../../shared/launcher-admission-v1.js';

const encoder = new TextEncoder();
let accessJwksCache = { issuer: '', expiresAt: 0, keys: [] };

function responseJson(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer',
    },
  });
}

function base64UrlDecode(value) {
  const padded = String(value).replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
}

function base64UrlEncode(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function utf8Base64Url(value) {
  return base64UrlEncode(encoder.encode(value));
}

function cloudflareIssuer(env) {
  const configured = String(env.CF_ACCESS_TEAM_DOMAIN || '').trim();
  if (!configured) return '';
  if (/^https:\/\//.test(configured)) return configured.replace(/\/$/, '');
  return `https://${configured.replace(/\/$/, '')}`;
}

async function verifyCloudflareAccess(request, env) {
  if (String(env.CF_ACCESS_REQUIRED || 'true').toLowerCase() === 'false') return { email: 'local-development' };

  const assertion = request.headers.get('CF-Access-Jwt-Assertion') || '';
  if (!assertion) throw Object.assign(new Error('Cloudflare Access authentication is required.'), { status: 401 });

  const [headerPart, payloadPart, signaturePart] = assertion.split('.');
  if (!headerPart || !payloadPart || !signaturePart) throw Object.assign(new Error('Malformed Cloudflare Access assertion.'), { status: 401 });

  let header;
  let payload;
  try {
    header = JSON.parse(new TextDecoder().decode(base64UrlDecode(headerPart)));
    payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(payloadPart)));
  } catch {
    throw Object.assign(new Error('Malformed Cloudflare Access assertion.'), { status: 401 });
  }
  if (header.alg !== 'RS256' || !header.kid) throw Object.assign(new Error('Unsupported Cloudflare Access assertion.'), { status: 401 });

  const issuer = cloudflareIssuer(env);
  const audience = String(env.CF_ACCESS_AUD || '').trim();
  if (!issuer || !audience) throw Object.assign(new Error('Cloudflare Access verifier is not configured.'), { status: 500 });

  const now = Math.floor(Date.now() / 1000);
  if (payload.iss !== issuer || Number(payload.exp || 0) <= now || Number(payload.nbf || 0) > now + 60) {
    throw Object.assign(new Error('Expired or invalid Cloudflare Access assertion.'), { status: 401 });
  }
  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!audiences.includes(audience)) throw Object.assign(new Error('Cloudflare Access audience mismatch.'), { status: 401 });

  if (accessJwksCache.issuer !== issuer || accessJwksCache.expiresAt < Date.now()) {
    const certs = await fetch(`${issuer}/cdn-cgi/access/certs`, { cf: { cacheTtl: 300, cacheEverything: true } });
    if (!certs.ok) throw Object.assign(new Error('Unable to fetch Cloudflare Access signing keys.'), { status: 503 });
    const body = await certs.json();
    accessJwksCache = { issuer, expiresAt: Date.now() + 5 * 60 * 1000, keys: Array.isArray(body.keys) ? body.keys : [] };
  }
  const jwk = accessJwksCache.keys.find((item) => item.kid === header.kid);
  if (!jwk) throw Object.assign(new Error('Cloudflare Access signing key not found.'), { status: 401 });
  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  const valid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    base64UrlDecode(signaturePart),
    encoder.encode(`${headerPart}.${payloadPart}`),
  );
  if (!valid) throw Object.assign(new Error('Cloudflare Access signature is invalid.'), { status: 401 });
  return { email: String(payload.email || request.headers.get('Cf-Access-Authenticated-User-Email') || '') };
}

function derLength(length) {
  if (length < 128) return Uint8Array.of(length);
  const bytes = [];
  let value = length;
  while (value > 0) {
    bytes.unshift(value & 0xff);
    value >>= 8;
  }
  return Uint8Array.of(0x80 | bytes.length, ...bytes);
}

function derWrap(tag, bytes) {
  return Uint8Array.of(tag, ...derLength(bytes.length), ...bytes);
}

function concatBytes(...items) {
  const length = items.reduce((sum, item) => sum + item.length, 0);
  const out = new Uint8Array(length);
  let offset = 0;
  for (const item of items) {
    out.set(item, offset);
    offset += item.length;
  }
  return out;
}

function pemBytes(pem) {
  const body = String(pem)
    .replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/\s+/g, '');
  return Uint8Array.from(atob(body), (ch) => ch.charCodeAt(0));
}

function privateKeyPkcs8Bytes(pem) {
  if (/BEGIN PRIVATE KEY/.test(pem) && !/BEGIN RSA PRIVATE KEY/.test(pem)) return pemBytes(pem);
  if (!/BEGIN RSA PRIVATE KEY/.test(pem)) throw new Error('GitHub App private key must be PKCS#8 or RSA PKCS#1 PEM.');
  const pkcs1 = pemBytes(pem);
  const version = Uint8Array.of(0x02, 0x01, 0x00);
  const rsaAlgorithm = Uint8Array.of(
    0x30, 0x0d,
    0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01,
    0x05, 0x00,
  );
  const privateKey = derWrap(0x04, pkcs1);
  return derWrap(0x30, concatBytes(version, rsaAlgorithm, privateKey));
}

async function githubAppJwt(env) {
  const appId = String(env.GITHUB_APP_ID || '').trim();
  const privateKey = String(env.GITHUB_APP_PRIVATE_KEY || '').replace(/\\n/g, '\n').trim();
  if (!appId || !privateKey) throw new Error('GitHub App credentials are incomplete.');
  const key = await crypto.subtle.importKey(
    'pkcs8',
    privateKeyPkcs8Bytes(privateKey),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const now = Math.floor(Date.now() / 1000);
  const header = utf8Base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = utf8Base64Url(JSON.stringify({ iat: now - 60, exp: now + 540, iss: appId }));
  const input = `${header}.${payload}`;
  const signature = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, encoder.encode(input)));
  return `${input}.${base64UrlEncode(signature)}`;
}

async function githubToken(env) {
  if (String(env.GITHUB_TOKEN || '').trim()) return String(env.GITHUB_TOKEN).trim();
  const installationId = String(env.GITHUB_INSTALLATION_ID || '').trim();
  if (!installationId) throw new Error('GitHub authentication is not configured.');
  const jwt = await githubAppJwt(env);
  const response = await fetch(`https://api.github.com/app/installations/${encodeURIComponent(installationId)}/access_tokens`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${jwt}`,
      accept: 'application/vnd.github+json',
      'user-agent': 'curveyield-upgrade-agent-launcher-v1',
      'x-github-api-version': '2022-11-28',
    },
  });
  if (!response.ok) throw new Error(`GitHub installation token request failed (${response.status}).`);
  const body = await response.json();
  if (!body.token) throw new Error('GitHub installation token response did not contain a token.');
  return body.token;
}

async function githubRequest(token, path, { method = 'GET', body = null, allow404 = false } = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      accept: 'application/vnd.github+json',
      'user-agent': 'curveyield-upgrade-agent-launcher-v1',
      'x-github-api-version': '2022-11-28',
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : null,
  });
  if (allow404 && response.status === 404) return null;
  if (!response.ok) {
    const message = await response.text().catch(() => '');
    const error = new Error(`GitHub API ${method} ${path} failed (${response.status}): ${message.slice(0, 500)}`);
    error.status = response.status;
    throw error;
  }
  if (response.status === 204) return null;
  return response.json();
}

async function contentJson(token, repository, path, ref = 'main') {
  const item = await githubRequest(
    token,
    `/repos/${repository}/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(ref)}`,
    { allow404: true },
  );
  if (!item?.content) return null;
  const decoded = atob(String(item.content).replace(/\s+/g, ''));
  return JSON.parse(decoded);
}

async function contentExists(token, repository, path, ref = 'main') {
  return Boolean(await githubRequest(
    token,
    `/repos/${repository}/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(ref)}`,
    { allow404: true },
  ));
}

async function branchExists(token, repository, branch) {
  return Boolean(await githubRequest(
    token,
    `/repos/${repository}/git/ref/heads/${branch.split('/').map(encodeURIComponent).join('/')}`,
    { allow404: true },
  ));
}

async function allocateLaunchIdentity(token, env, input) {
  const controlRepo = `${String(env.GITHUB_OWNER || 'CurveYield2').trim()}/${String(env.CONTROL_REPO || 'Contract-Automation').trim()}`;
  for (let revision = 1; revision <= 999; revision += 1) {
    const { managerId } = managerIdentity(input.taskName, revision);
    const paths = buildLaunchPaths({ managerId });
    const targetBranch = input.targetBranch || defaultTargetBranch(input.taskName, revision);
    const collisions = await Promise.all([
      contentExists(token, controlRepo, paths.requestPath, 'main'),
      contentExists(token, controlRepo, paths.activePath, 'main'),
      contentExists(token, controlRepo, paths.completedPath, 'main'),
      branchExists(token, input.targetRepository, targetBranch),
    ]);
    if (!collisions.some(Boolean)) return { managerId, revision, targetBranch, paths, controlRepo };
  }
  throw new Error('No free task revision is available.');
}

async function atomicAdmissionCommit(token, repository, files, message) {
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const ref = await githubRequest(token, `/repos/${repository}/git/ref/heads/main`);
    const headSha = ref.object.sha;
    const commit = await githubRequest(token, `/repos/${repository}/git/commits/${headSha}`);
    const blobs = [];
    for (const file of files) {
      const blob = await githubRequest(token, `/repos/${repository}/git/blobs`, {
        method: 'POST',
        body: { content: file.content, encoding: 'utf-8' },
      });
      blobs.push({ path: file.path, mode: '100644', type: 'blob', sha: blob.sha });
    }
    const tree = await githubRequest(token, `/repos/${repository}/git/trees`, {
      method: 'POST',
      body: { base_tree: commit.tree.sha, tree: blobs },
    });
    const created = await githubRequest(token, `/repos/${repository}/git/commits`, {
      method: 'POST',
      body: { message, tree: tree.sha, parents: [headSha] },
    });
    try {
      await githubRequest(token, `/repos/${repository}/git/refs/heads/main`, {
        method: 'PATCH',
        body: { sha: created.sha, force: false },
      });
      return { sha: created.sha, previousMainSha: headSha };
    } catch (error) {
      if (![409, 422].includes(error.status) || attempt === 4) throw error;
    }
  }
  throw new Error('Atomic admission commit failed after bounded retries.');
}

function requestPathname(request) {
  return new URL(request.url).pathname;
}

async function launchTask(request, env) {
  const token = await githubToken(env);
  const allowedRepositories = parseAllowedRepositories(env.ALLOWED_TARGET_REPOSITORIES);
  const raw = await request.json();
  const input = validateLaunchInput({
    ...raw,
    authorityPath: raw.authorityPath || env.DEFAULT_AUTHORITY_PATH || DEFAULT_AUTHORITY_PATH,
  }, { allowedRepositories });

  const identity = await allocateLaunchIdentity(token, env, input);
  if (!await contentExists(token, identity.controlRepo, input.authorityPath, 'main')) {
    throw Object.assign(new Error('Selected authority path does not exist on current Contract-Automation main.'), { status: 400 });
  }

  const renderInput = {
    ...input,
    managerId: identity.managerId,
    resolvedTargetBranch: identity.targetBranch,
    specificationPath: identity.paths.specificationPath,
  };
  const specification = renderTaskSpecification(renderInput);
  const managerRequest = JSON.stringify(renderManagerRequest(renderInput), null, 2) + '\n';
  const admitted = await atomicAdmissionCommit(
    token,
    identity.controlRepo,
    [
      { path: identity.paths.specificationPath, content: specification },
      { path: identity.paths.requestPath, content: managerRequest },
    ],
    `chore(upgrade-launcher): admit ${identity.managerId}`,
  );

  return responseJson({
    managerId: identity.managerId,
    status: 'SUBMITTED',
    admissionCommitSha: admitted.sha,
    targetRepository: input.targetRepository,
    targetBranch: identity.targetBranch,
  }, 201);
}

async function taskStatus(managerId, env) {
  if (!/^[A-Za-z0-9._-]{1,160}$/.test(managerId)) return responseJson({ error: 'Invalid manager ID.' }, 400);
  const token = await githubToken(env);
  const owner = String(env.GITHUB_OWNER || 'CurveYield2').trim();
  const controlRepo = `${owner}/${String(env.CONTROL_REPO || 'Contract-Automation').trim()}`;
  const paths = buildLaunchPaths({ managerId });

  const completed = await contentJson(token, controlRepo, paths.completedPath, 'main');
  if (completed) {
    const result = completedResult(completed);
    if (result) return responseJson({ managerId, ...result });
    return responseJson({ managerId, status: 'BLOCKED', reason: completed.lastDecision || 'Terminal state is incomplete.' });
  }

  const active = await contentJson(token, controlRepo, paths.activePath, 'main');
  if (active) {
    const blocked = ['BLOCKED', 'REPAIR_REQUIRED'].includes(String(active.merge?.status || '')) ||
      /^MERGE_(?:BLOCKED|REPAIR_REQUIRED)/.test(String(active.lastDecision || ''));
    return responseJson({
      managerId,
      status: blocked ? 'BLOCKED' : 'RUNNING',
      ...(blocked ? { reason: active.merge?.reason || active.lastDecision || 'Merge requires attention.' } : {}),
    });
  }

  if (await contentExists(token, controlRepo, paths.requestPath, 'main')) {
    return responseJson({ managerId, status: 'STARTING' });
  }
  return responseJson({ error: 'Task not found.' }, 404);
}

async function staticResponse(request, env) {
  if (!env.ASSETS) return new Response('Launcher assets binding is unavailable.', { status: 503 });
  const url = new URL(request.url);
  if (url.pathname === '/') url.pathname = '/index_v1.html';
  const asset = await env.ASSETS.fetch(new Request(url.toString(), {
    method: 'GET',
    headers: request.headers,
  }));
  const headers = new Headers(asset.headers);
  headers.set('cache-control', url.pathname.endsWith('.html') ? 'no-store' : 'public, max-age=300');
  headers.set('x-content-type-options', 'nosniff');
  headers.set('referrer-policy', 'no-referrer');
  headers.set('x-frame-options', 'DENY');
  headers.set('content-security-policy', "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
  return new Response(asset.body, { status: asset.status, statusText: asset.statusText, headers });
}

export default {
  async fetch(request, env) {
    try {
      const pathname = requestPathname(request);
      if (pathname === '/health') return responseJson({ ok: true, version: 'v1' });
      await verifyCloudflareAccess(request, env);

      if (pathname === '/api/tasks' && request.method === 'POST') return launchTask(request, env);
      const match = pathname.match(/^\/api\/tasks\/([A-Za-z0-9._-]{1,160})$/);
      if (match && request.method === 'GET') return taskStatus(match[1], env);
      if (pathname.startsWith('/api/')) return responseJson({ error: 'Not found.' }, 404);
      return staticResponse(request, env);
    } catch (error) {
      const status = Number(error?.status || 500);
      const safeStatus = status >= 400 && status <= 599 ? status : 500;
      return responseJson({ error: error?.message || 'Unexpected launcher error.' }, safeStatus);
    }
  },
};
