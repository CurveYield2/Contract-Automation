import { V7_POLICY } from './v7-policy.mjs';

export const PHASE6_MUTABLE_RPC_ENV = V7_POLICY.mutableRpc.ethereumProfile;
export const PHASE6_MUTABLE_RPC_CHAIN = V7_POLICY.mutableRpc.chain;
export const PHASE6_MUTABLE_RPC_CHAIN_ID = V7_POLICY.mutableRpc.chainId;

function hexQuantity(value, label) {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]+$/.test(value)) throw new Error(`${label} must be a hex quantity`);
  const parsed = Number(BigInt(value));
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error(`${label} exceeds safe integer range`);
  return parsed;
}

async function rpcCall(url, method, params, fetchImpl) {
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  if (!response?.ok) throw new Error(`mutable Anvil RPC ${method} returned HTTP ${response?.status ?? 'unknown'}`);
  const payload = await response.json();
  if (payload?.error) throw new Error(`mutable Anvil RPC ${method} failed: ${payload.error.message ?? 'unknown error'}`);
  if (payload?.result === undefined || payload?.result === null) throw new Error(`mutable Anvil RPC ${method} returned no result`);
  return payload.result;
}

export function resolvePhase6MutableRpcUrl(environment = process.env) {
  const url = environment?.[PHASE6_MUTABLE_RPC_ENV];
  if (typeof url !== 'string' || url.length === 0) throw new Error(`Runner secret ${PHASE6_MUTABLE_RPC_ENV} is required for Phase 6 mutable-RPC execution`);
  return url;
}

export async function probePhase6MutableRpc({ environment = process.env, fetchImpl = globalThis.fetch } = {}) {
  let url;
  try {
    url = resolvePhase6MutableRpcUrl(environment);
  } catch (error) {
    return {
      status: 'FAIL',
      failureKind: 'MUTABLE_RPC_SECRET_MISSING',
      profile: PHASE6_MUTABLE_RPC_ENV,
      chain: PHASE6_MUTABLE_RPC_CHAIN,
      expectedChainId: PHASE6_MUTABLE_RPC_CHAIN_ID,
      reason: error.message,
    };
  }

  try {
    const chainIdHex = await rpcCall(url, 'eth_chainId', [], fetchImpl);
    const chainId = hexQuantity(chainIdHex, 'eth_chainId');
    const blockNumberHex = await rpcCall(url, 'eth_blockNumber', [], fetchImpl);
    const blockNumber = hexQuantity(blockNumberHex, 'eth_blockNumber');
    const block = await rpcCall(url, 'eth_getBlockByNumber', [blockNumberHex, false], fetchImpl);
    const blockHash = typeof block?.hash === 'string' ? block.hash : null;
    const chainIdMatchesExpected = chainId === PHASE6_MUTABLE_RPC_CHAIN_ID;
    const status = chainIdMatchesExpected && blockHash ? 'PASS' : 'FAIL';
    return {
      status,
      failureKind: status === 'PASS' ? null : 'MUTABLE_RPC_IDENTITY_FAILURE',
      profile: PHASE6_MUTABLE_RPC_ENV,
      chain: PHASE6_MUTABLE_RPC_CHAIN,
      expectedChainId: PHASE6_MUTABLE_RPC_CHAIN_ID,
      observedChainId: chainId,
      chainIdMatchesExpected,
      blockNumber,
      blockHash,
      backendPolicy: V7_POLICY.mutableRpc.backendPolicy,
      requesterSuppliedRpcAllowed: V7_POLICY.mutableRpc.requesterSuppliedRpcAllowed,
      rpcUrlExposedInEvidence: false,
    };
  } catch (error) {
    return {
      status: 'FAIL',
      failureKind: 'MUTABLE_RPC_PROBE_FAILURE',
      profile: PHASE6_MUTABLE_RPC_ENV,
      chain: PHASE6_MUTABLE_RPC_CHAIN,
      expectedChainId: PHASE6_MUTABLE_RPC_CHAIN_ID,
      reason: redactMutableRpcSecret(error?.message ?? String(error), url),
    };
  }
}

export function phase6MutableRpcRuntime({ environment = process.env, preflight } = {}) {
  if (preflight?.mutableRpc?.status !== 'PASS') throw new Error('Phase 6 mutable RPC runtime requires passing preflight evidence');
  const url = resolvePhase6MutableRpcUrl(environment);
  const blockNumber = preflight.mutableRpc.blockNumber;
  if (!Number.isSafeInteger(blockNumber) || blockNumber < 0) throw new Error('Phase 6 mutable RPC preflight did not freeze a valid block number');
  return {
    url,
    blockNumber,
    blockHash: preflight.mutableRpc.blockHash ?? null,
    chain: PHASE6_MUTABLE_RPC_CHAIN,
    chainId: PHASE6_MUTABLE_RPC_CHAIN_ID,
    profile: PHASE6_MUTABLE_RPC_ENV,
  };
}

export function redactMutableRpcSecret(value, secret) {
  const text = String(value ?? '');
  if (typeof secret !== 'string' || secret.length === 0) return text;
  return text.replaceAll(secret, '<redacted-mutable-anvil-rpc>');
}
