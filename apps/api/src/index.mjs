import {
  CHAINS,
  MAX_ARCHIVE_BYTES,
  ValidationError,
  validateCreateJobRequest,
  validateJobResult
} from '../../../packages/protocol/src/index.mjs';

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' };
const MAX_JSON_BODY_BYTES = 3 * 1024 * 1024;
const UPLOAD_EXPIRY_SECONDS = 15 * 60;

function json(value, status = 200, headers = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { ...JSON_HEADERS, ...headers }
  });
}

function error(code, message, status = 400, details = undefined) {
  return json({ error: { code, message, ...(details === undefined ? {} : { details }) } }, status);
}

function withCors(response, env) {
  const headers = new Headers(response.headers);
  headers.set('access-control-allow-origin', env.CORS_ORIGIN || '*');
  headers.set('access-control-allow-headers', 'authorization, content-type');
  headers.set('access-control-allow-methods', 'GET, POST, OPTIONS');
  headers.set('access-control-max-age', '86400');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

async function digest(value) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
}

async function secureEqual(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string') return false;
  const [a, b] = await Promise.all([digest(left), digest(right)]);
  let difference = a.byteLength ^ b.byteLength;
  const length = Math.max(a.byteLength, b.byteLength);
  for (let index = 0; index < length; index += 1) {
    difference |= (a[index % a.byteLength] ?? 0) ^ (b[index % b.byteLength] ?? 0);
  }
  return difference === 0;
}

function bearer(request) {
  const authorization = request.headers.get('authorization') ?? '';
  return authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
}

async function authorized(request, expected) {
  return secureEqual(bearer(request), expected ?? '');
}

async function authorizedClient(request, env) {
  const configured = [env.CLIENT_API_KEY, env.GPT_API_KEY, env.GITHUB_BRIDGE_API_KEY]
    .filter((value) => typeof value === 'string' && value.length > 0);
  if (configured.length === 0) return false;
  const matches = await Promise.all(configured.map((expected) => secureEqual(bearer(request), expected)));
  return matches.some(Boolean);
}

async function readLimitedText(request, maxBytes) {
  const contentLength = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new ValidationError('body_too_large', `Request body exceeds ${maxBytes} bytes`);
  }
  let text;
  try {
    text = await request.text();
  } catch {
    throw new ValidationError('invalid_body', 'Request body could not be read');
  }
  if (new TextEncoder().encode(text).byteLength > maxBytes) {
    throw new ValidationError('body_too_large', `Request body exceeds ${maxBytes} bytes`);
  }
  return text;
}

function parseJsonText(text) {
  try {
    return JSON.parse(text || '{}');
  } catch {
    throw new ValidationError('invalid_json', 'Request body is not valid JSON');
  }
}

async function parseBody(request, maxBytes = MAX_JSON_BODY_BYTES) {
  const contentType = (request.headers.get('content-type') ?? 'application/json').toLowerCase();
  if (contentType.startsWith('application/json')) {
    return parseJsonText(await readLimitedText(request, maxBytes));
  }
  if (contentType.startsWith('application/x-www-form-urlencoded')) {
    const form = new URLSearchParams(await readLimitedText(request, maxBytes));
    if ([...form.keys()].some((key) => key !== 'request')) {
      throw new ValidationError('unknown_field', 'Form bodies may contain only the request field', '$');
    }
    return parseJsonText(form.get('request') ?? '');
  }
  if (contentType.startsWith('multipart/form-data')) {
    const contentLength = Number(request.headers.get('content-length') ?? '0');
    if (Number.isFinite(contentLength) && contentLength > maxBytes) {
      throw new ValidationError('body_too_large', `Request body exceeds ${maxBytes} bytes`);
    }
    let form;
    try {
      form = await request.formData();
    } catch {
      throw new ValidationError('invalid_form', 'Multipart form body could not be parsed');
    }
    const keys = [...form.keys()];
    if (keys.some((key) => key !== 'request')) {
      throw new ValidationError('unknown_field', 'Form bodies may contain only the request field', '$');
    }
    const value = form.get('request');
    if (typeof value !== 'string' || new TextEncoder().encode(value).byteLength > maxBytes) {
      throw new ValidationError('invalid_form', 'Multipart request field must be JSON text within the body limit');
    }
    return parseJsonText(value);
  }
  throw new ValidationError('unsupported_content_type', 'Use application/json, application/x-www-form-urlencoded, or multipart/form-data');
}

function jobKey(jobId, name) {
  return `jobs/${jobId}/${name}`;
}

async function putJson(bucket, key, value) {
  await bucket.put(key, JSON.stringify(value), {
    httpMetadata: { contentType: 'application/json' }
  });
}

async function getJson(bucket, key) {
  const object = await bucket.get(key);
  return object ? object.json() : null;
}

function newId(prefix) {
  return `${prefix}_${crypto.randomUUID().replaceAll('-', '')}`;
}

function isoNow() {
  return new Date().toISOString();
}

function encodeRfc3986(value) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

function amzDate(date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, '');
}

async function hmac(key, value) {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    typeof key === 'string' ? new TextEncoder().encode(key) : key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(value)));
}

function hex(bytes) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(value) {
  return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))));
}

export async function presignR2Put(env, objectKey, contentType, expires = UPLOAD_EXPIRY_SECONDS) {
  const date = new Date();
  const dateTime = amzDate(date);
  const dateStamp = dateTime.slice(0, 8);
  const region = 'auto';
  const service = 's3';
  const host = `${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  const canonicalUri = `/${encodeRfc3986(env.R2_BUCKET_NAME)}/${objectKey.split('/').map(encodeRfc3986).join('/')}`;
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const parameters = new URLSearchParams({
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Content-Sha256': 'UNSIGNED-PAYLOAD',
    'X-Amz-Credential': `${env.R2_ACCESS_KEY_ID}/${credentialScope}`,
    'X-Amz-Date': dateTime,
    'X-Amz-Expires': String(expires),
    'X-Amz-SignedHeaders': 'content-type;host'
  });
  parameters.sort();
  const canonicalQuery = [...parameters.entries()]
    .map(([key, value]) => `${encodeRfc3986(key)}=${encodeRfc3986(value)}`)
    .join('&');
  const canonicalHeaders = `content-type:${contentType.trim()}\nhost:${host}\n`;
  const canonicalRequest = [
    'PUT',
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    'content-type;host',
    'UNSIGNED-PAYLOAD'
  ].join('\n');
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    dateTime,
    credentialScope,
    await sha256Hex(canonicalRequest)
  ].join('\n');
  const kDate = await hmac(`AWS4${env.R2_SECRET_ACCESS_KEY}`, dateStamp);
  const kRegion = await hmac(kDate, region);
  const kService = await hmac(kRegion, service);
  const kSigning = await hmac(kService, 'aws4_request');
  const signature = hex(await hmac(kSigning, stringToSign));
  return `https://${host}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

async function dispatchGithub(env, jobId) {
  const fetcher = env.FETCH ?? fetch;
  const workflow = encodeURIComponent(env.GITHUB_WORKFLOW || 'simulate.yml');
  const url = `https://api.github.com/repos/${encodeURIComponent(env.GITHUB_OWNER)}/${encodeURIComponent(env.GITHUB_REPO)}/actions/workflows/${workflow}/dispatches`;
  const response = await fetcher(url, {
    method: 'POST',
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${env.GITHUB_TOKEN}`,
      'content-type': 'application/json',
      'user-agent': 'PreflightSim-Lite',
      'x-github-api-version': '2026-03-10'
    },
    body: JSON.stringify({
      ref: env.GITHUB_REF || 'main',
      inputs: { job_id: jobId }
    })
  });
  let payload = {};
  if (response.status !== 204) {
    try { payload = await response.json(); } catch { payload = {}; }
  }
  if (!response.ok) {
    throw new Error(payload.message || `GitHub dispatch returned ${response.status}`);
  }
  return {
    githubRunId: payload.workflow_run_id ?? null,
    githubRunUrl: payload.html_url ?? null
  };
}

async function handleUpload(request, env) {
  const body = await parseBody(request);
  const allowed = new Set(['size', 'contentType']);
  for (const key of Object.keys(body)) {
    if (!allowed.has(key)) throw new ValidationError('unknown_field', `$.${key} is not allowed`, `$.${key}`);
  }
  if (!Number.isSafeInteger(body.size) || body.size < 1 || body.size > MAX_ARCHIVE_BYTES) {
    throw new ValidationError('invalid_upload_size', `size must be from 1 to ${MAX_ARCHIVE_BYTES}`, '$.size');
  }
  const contentType = body.contentType ?? 'application/zip';
  if (contentType !== 'application/zip') {
    throw new ValidationError('invalid_content_type', 'Only application/zip uploads are accepted', '$.contentType');
  }
  const uploadId = newId('upl');
  const objectKey = `uploads/${uploadId}/project.zip`;
  const uploadUrl = await presignR2Put(env, objectKey, contentType);
  await putJson(env.JOBS, `uploads/${uploadId}/session.json`, {
    uploadId,
    objectKey,
    declaredSize: body.size,
    contentType,
    createdAt: isoNow(),
    expiresAt: new Date(Date.now() + UPLOAD_EXPIRY_SECONDS * 1000).toISOString()
  });
  return json({
    uploadId,
    objectKey,
    uploadUrl,
    expiresInSeconds: UPLOAD_EXPIRY_SECONDS,
    requiredHeaders: { 'content-type': contentType }
  }, 201);
}

async function verifyUploadProject(env, project) {
  if (project.type !== 'upload') return;
  const object = await env.JOBS.head(project.objectKey);
  if (!object) {
    throw new ValidationError('upload_missing', 'Uploaded project object does not exist', '$.project.objectKey');
  }
  if (object.size < 1 || object.size > MAX_ARCHIVE_BYTES) {
    throw new ValidationError('project_too_large', `Uploaded archive exceeds ${MAX_ARCHIVE_BYTES} bytes`, '$.project.objectKey');
  }
}

function agentJobUrl(env, jobId) {
  const base = String(env.PUBLIC_APP_URL ?? 'https://preflight.curveyield.online').replace(/\/$/, '');
  return `${base}/agent/job.html?job=${encodeURIComponent(jobId)}`;
}

async function handleCreateJob(request, env) {
  const normalized = validateCreateJobRequest(await parseBody(request));
  await verifyUploadProject(env, normalized.project);
  const jobId = newId('job');
  const createdAt = isoNow();
  const status = {
    jobId,
    status: 'queued',
    stage: 'dispatching',
    chain: normalized.chain,
    createdAt,
    updatedAt: createdAt,
    githubRunId: null,
    githubRunUrl: null,
    agentJobUrl: agentJobUrl(env, jobId)
  };
  await putJson(env.JOBS, jobKey(jobId, 'request.json'), { jobId, ...normalized, createdAt });
  await putJson(env.JOBS, jobKey(jobId, 'status.json'), status);
  try {
    const dispatch = await dispatchGithub(env, jobId);
    Object.assign(status, dispatch, { stage: 'queued', updatedAt: isoNow() });
    await putJson(env.JOBS, jobKey(jobId, 'status.json'), status);
    return json(status, 202);
  } catch (cause) {
    Object.assign(status, {
      status: 'failed',
      stage: 'dispatch',
      updatedAt: isoNow(),
      error: { code: 'dispatch_failed', message: cause.message }
    });
    await putJson(env.JOBS, jobKey(jobId, 'status.json'), status);
    return json({ jobId, error: status.error }, 502);
  }
}

async function handleGetStatus(env, jobId) {
  const status = await getJson(env.JOBS, jobKey(jobId, 'status.json'));
  return status ? json(status) : error('not_found', 'Job not found', 404);
}


function summarizeJob(status, result = null) {
  if (!result) {
    return {
      jobId: status.jobId,
      status: status.status,
      stage: status.stage,
      ...(status.chain === undefined ? {} : { chain: status.chain }),
      createdAt: status.createdAt,
      updatedAt: status.updatedAt,
      ...(status.agentJobUrl === undefined ? {} : { agentJobUrl: status.agentJobUrl }),
      ...(status.error === undefined ? {} : { error: status.error })
    };
  }

  const diagnostics = Array.isArray(result.compilerDiagnostics) ? result.compilerDiagnostics : [];
  const steps = Array.isArray(result.steps) ? result.steps : [];
  return {
    jobId: result.jobId,
    status: result.status,
    mode: result.mode,
    ...(result.chain === undefined ? {} : { chain: result.chain }),
    ...(result.chainId === undefined ? {} : { chainId: result.chainId }),
    ...(result.block === undefined ? {} : { block: result.block }),
    compilerVersion: result.compilerVersion,
    compiler: {
      diagnosticCount: diagnostics.length,
      errorCount: diagnostics.filter((item) => item?.severity === 'error').length,
      warningCount: diagnostics.filter((item) => item?.severity === 'warning').length,
      artifactCount: Array.isArray(result.artifacts) ? result.artifacts.length : 0
    },
    deployments: result.deployments ?? {},
    workflow: {
      totalSteps: steps.length,
      completedSteps: steps.filter((step) => step?.status === 'completed').length,
      failedSteps: steps.filter((step) => step?.status === 'failed').length
    },
    startedAt: result.startedAt,
    finishedAt: result.finishedAt,
    ...(result.error === undefined ? {} : { error: result.error }),
    ...(status?.agentJobUrl === undefined ? {} : { agentJobUrl: status.agentJobUrl })
  };
}

async function handleGetSummary(env, jobId) {
  const status = await getJson(env.JOBS, jobKey(jobId, 'status.json'));
  if (!status) return error('not_found', 'Job not found', 404);
  const result = await getJson(env.JOBS, jobKey(jobId, 'result.json'));
  return json(summarizeJob(status, result));
}

async function handleGetResult(env, jobId) {
  const result = await env.JOBS.get(jobKey(jobId, 'result.json'));
  if (result) return new Response(result.body, { headers: JSON_HEADERS });
  const status = await getJson(env.JOBS, jobKey(jobId, 'status.json'));
  if (!status) return error('not_found', 'Job not found', 404);
  return error('result_not_ready', `Job is ${status.status}`, 409);
}

async function handleGetReport(env, jobId) {
  const report = await env.JOBS.get(jobKey(jobId, 'report.html'));
  if (report) return new Response(report.body, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer'
    }
  });
  const status = await getJson(env.JOBS, jobKey(jobId, 'status.json'));
  if (!status) return error('not_found', 'Job not found', 404);
  return error('report_not_ready', `Job is ${status.status}`, 409);
}

async function internalGetRequest(env, jobId) {
  const job = await env.JOBS.get(jobKey(jobId, 'request.json'));
  return job ? new Response(job.body, { headers: JSON_HEADERS }) : error('not_found', 'Job not found', 404);
}

async function internalGetProject(env, jobId) {
  const request = await getJson(env.JOBS, jobKey(jobId, 'request.json'));
  if (!request) return error('not_found', 'Job not found', 404);
  if (request.project.type !== 'upload') {
    return error('project_not_uploaded', 'Job does not use an uploaded project', 409);
  }
  const project = await env.JOBS.get(request.project.objectKey);
  if (!project) return error('not_found', 'Uploaded project not found', 404);
  return new Response(project.body, {
    headers: {
      'content-type': 'application/zip',
      'content-length': String(project.size)
    }
  });
}

async function internalUpdateStatus(request, env, jobId) {
  const body = await parseBody(request);
  if (!['running', 'failed'].includes(body.status)) {
    throw new ValidationError('invalid_status', 'Runner status must be running or failed', '$.status');
  }
  const previous = await getJson(env.JOBS, jobKey(jobId, 'status.json'));
  if (!previous) return error('not_found', 'Job not found', 404);
  const next = {
    ...previous,
    status: body.status,
    stage: typeof body.stage === 'string' ? body.stage.slice(0, 120) : previous.stage,
    progress: body.progress ?? previous.progress,
    error: body.error ?? previous.error,
    updatedAt: isoNow()
  };
  await putJson(env.JOBS, jobKey(jobId, 'status.json'), next);
  return new Response(null, { status: 204 });
}

async function internalPublishResult(request, env, jobId) {
  const body = await parseBody(request, 25 * 1024 * 1024);
  if (typeof body.html !== 'string' || body.html.length > 20 * 1024 * 1024) {
    throw new ValidationError('invalid_report', 'html must be a string up to 20 MB', '$.html');
  }
  const result = validateJobResult(body.result);
  if (result.jobId !== jobId) {
    throw new ValidationError('job_mismatch', 'Result jobId does not match route', '$.result.jobId');
  }
  await putJson(env.JOBS, jobKey(jobId, 'result.json'), result);
  await env.JOBS.put(jobKey(jobId, 'report.html'), body.html, {
    httpMetadata: { contentType: 'text/html; charset=utf-8' }
  });
  const previous = await getJson(env.JOBS, jobKey(jobId, 'status.json'));
  await putJson(env.JOBS, jobKey(jobId, 'status.json'), {
    ...(previous ?? { jobId, createdAt: result.startedAt }),
    status: result.status,
    stage: result.status === 'completed' ? 'completed' : 'failed',
    updatedAt: isoNow(),
    finishedAt: result.finishedAt
  });
  return new Response(null, { status: 204 });
}

async function route(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;

  if (request.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (request.method === 'GET' && path === '/api/v1/health') {
    return json({ status: 'ok', service: 'preflightsim-lite-api', version: '0.1.0' });
  }
  const internal = path.startsWith('/internal/v1/');
  if (internal) {
    if (!(await authorized(request, env.RUNNER_API_KEY))) return error('unauthorized', 'Invalid runner API key', 401);
  } else if (!(await authorizedClient(request, env))) {
    return error('unauthorized', 'Invalid client API key', 401);
  }

  if (request.method === 'GET' && path === '/api/v1/chains') return json({ chains: CHAINS });
  if (request.method === 'POST' && path === '/api/v1/uploads') return handleUpload(request, env);
  if (request.method === 'POST' && path === '/api/v1/jobs') return handleCreateJob(request, env);

  let match = path.match(/^\/api\/v1\/jobs\/(job_[A-Za-z0-9]+)$/);
  if (request.method === 'GET' && match) return handleGetStatus(env, match[1]);
  match = path.match(/^\/api\/v1\/jobs\/(job_[A-Za-z0-9]+)\/summary$/);
  if (request.method === 'GET' && match) return handleGetSummary(env, match[1]);
  match = path.match(/^\/api\/v1\/jobs\/(job_[A-Za-z0-9]+)\/result$/);
  if (request.method === 'GET' && match) return handleGetResult(env, match[1]);
  match = path.match(/^\/api\/v1\/jobs\/(job_[A-Za-z0-9]+)\/report$/);
  if (request.method === 'GET' && match) return handleGetReport(env, match[1]);

  match = path.match(/^\/internal\/v1\/jobs\/(job_[A-Za-z0-9]+)$/);
  if (request.method === 'GET' && match) return internalGetRequest(env, match[1]);
  match = path.match(/^\/internal\/v1\/jobs\/(job_[A-Za-z0-9]+)\/project$/);
  if (request.method === 'GET' && match) return internalGetProject(env, match[1]);
  match = path.match(/^\/internal\/v1\/jobs\/(job_[A-Za-z0-9]+)\/status$/);
  if (request.method === 'POST' && match) return internalUpdateStatus(request, env, match[1]);
  match = path.match(/^\/internal\/v1\/jobs\/(job_[A-Za-z0-9]+)\/result$/);
  if (request.method === 'POST' && match) return internalPublishResult(request, env, match[1]);

  return error('not_found', 'Route not found', 404);
}

export default {
  async fetch(request, env) {
    try {
      return withCors(await route(request, env), env);
    } catch (cause) {
      if (cause instanceof ValidationError) {
        return withCors(error(cause.code, cause.message, 400, { path: cause.path }), env);
      }
      console.error(cause);
      return withCors(error('internal_error', 'Internal server error', 500), env);
    }
  }
};
