import { createHash } from 'node:crypto';

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

export function canonicalRequestJsonV2(value) {
  return JSON.stringify(canonicalize(value));
}

export function computeCanonicalRequestIdentityV2(request) {
  if (!request || typeof request !== 'object' || Array.isArray(request)) {
    throw new TypeError('REQUEST_IDENTITY_INPUT_INVALID: request must be an object');
  }
  const unsigned = structuredClone(request);
  delete unsigned.requestId;
  delete unsigned.requestDigest;
  const requestDigest = createHash('sha256').update(canonicalRequestJsonV2(unsigned)).digest('hex');
  return Object.freeze({ requestId: `dar-${requestDigest.slice(0, 32)}`, requestDigest });
}

export function assertCanonicalRequestIdentityV2(request) {
  const computed = computeCanonicalRequestIdentityV2(request);
  if (request.requestDigest !== computed.requestDigest) {
    const error = new Error(`REQUEST_DIGEST_MISMATCH: declared ${request.requestDigest ?? 'missing'}; computed ${computed.requestDigest}`);
    error.code = 'REQUEST_DIGEST_MISMATCH';
    error.expected = computed.requestDigest;
    error.observed = request.requestDigest ?? null;
    throw error;
  }
  if (request.requestId !== computed.requestId) {
    const error = new Error(`REQUEST_ID_MISMATCH: declared ${request.requestId ?? 'missing'}; computed ${computed.requestId}`);
    error.code = 'REQUEST_ID_MISMATCH';
    error.expected = computed.requestId;
    error.observed = request.requestId ?? null;
    throw error;
  }
  return computed;
}
