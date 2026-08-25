import { startRpcIdentityProxy } from '../../runner/src/rpc-identity-proxy-v1.mjs';
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

async function probeNormalizedRpc(url, fetchImpl, { frozenBlockNumber = null, frozenBlockHash = null } = {}) {
  const chainIdHex = await rpcCall(url, 'eth_chainId', [], fetchImpl);
  const chainId = hexQuantity(chainIdHex, 'eth_chainId');
  const requestPinned = Number.isSafeInteger(frozenBlockNumber) && frozenBlockNumber >= 0 && typeof frozenBlockHash === 'string';
  const blockNumberHex = requestPinned
    ? `0x${frozenBlockNumber.toString(16)}`
    : await rpcCall(url, 'eth_blockNumber', [], fetchImpl);
  const blockNumber = hexQuantity(blockNumberHex, requestPinned ? 'frozenBlockNumber' : 'eth_blockNumber');
  const block = await rpcCall(url, 'eth_getBlockByNumber', [blockNumberHex, false], fetchImpl);
  const blockHash = typeof block?.hash === 'string' ? block.hash : null;
  const chainIdMatchesExpected = chainId === PHASE6_MUTABLE_RPC_CHAIN_ID;
  const blockHashMatchesExpected = requestPinned ? blockHash?.toLowerCase() === frozenBlockHash.toLowerCase() : Boolean(blockHash);
  return {
    status: chainIdMatchesExpected && Boolean(blockHash) && blockHashMatchesExpected ? 'PASS' : 'FAIL',
    chainId,
    chainIdMatchesExpected,
    blockNumber,
    blockHash,
    requestPinned,
    expectedBlockNumber: requestPinned ? frozenBlockNumber : null,
    expectedBlockHash: requestPinned ? frozenBlockHash : null,
    blockHashMatchesExpected,
  };
}

export function resolvePhase6MutableRpcUrl(environment = process.env) {
  const url = environment?.[PHASE6_MUTABLE_RPC_ENV];
  if (typeof url !== 'string' || url.length === 0) throw new Error(`Runner secret ${PHASE6_MUTABLE_RPC_ENV} is required for Phase 6 mutable-RPC execution`);
  return url;
}

function failedSessionEvidence(failureKind, reason) {
  return {
    status: 'FAIL', failureKind, profile: PHASE6_MUTABLE_RPC_ENV, chain: PHASE6_MUTABLE_RPC_CHAIN,
    expectedChainId: PHASE6_MUTABLE_RPC_CHAIN_ID, reason,
    backendPolicy: V7_POLICY.mutableRpc.backendPolicy,
    requesterSuppliedRpcAllowed: V7_POLICY.mutableRpc.requesterSuppliedRpcAllowed,
    rpcUrlExposedInEvidence: false,
  };
}

function observedUpstreamChainId(proxy) {
  const observation = proxy?.getUpstreamIdentityObservation?.();
  if (!observation?.chainId) return null;
  try { return hexQuantity(observation.chainId, 'upstream eth_chainId'); }
  catch { return null; }
}

export async function createPhase6MutableRpcSession({
  environment = process.env,
  fetchImpl = globalThis.fetch,
  startIdentityProxy = startRpcIdentityProxy,
  frozenBlockNumber = null,
  frozenBlockHash = null,
} = {}) {
  let upstreamUrl;
  try { upstreamUrl = resolvePhase6MutableRpcUrl(environment); }
  catch (error) {
    return { evidence: failedSessionEvidence('MUTABLE_RPC_SECRET_MISSING', error.message), runtime: null, async close() {} };
  }

  let proxy;
  try {
    proxy = await startIdentityProxy({ upstreamUrl, chainId: PHASE6_MUTABLE_RPC_CHAIN_ID, fetchImpl });
    const normalized = await probeNormalizedRpc(proxy.url, fetchImpl, { frozenBlockNumber, frozenBlockHash });
    const upstreamChainId = observedUpstreamChainId(proxy);
    if (normalized.status !== 'PASS') {
      await proxy.close().catch(() => {});
      return {
        evidence: {
          ...failedSessionEvidence(
            normalized.requestPinned && normalized.blockHashMatchesExpected === false
              ? 'MUTABLE_RPC_FROZEN_BLOCK_MISMATCH'
              : 'MUTABLE_RPC_IDENTITY_FAILURE',
            normalized.requestPinned && normalized.blockHashMatchesExpected === false
              ? 'Identity-normalized Phase 6 RPC did not return the admitted frozen block hash'
              : 'Identity-normalized Phase 6 RPC did not reconcile to Ethereum'
          ),
          observedChainId: normalized.chainId,
          chainIdMatchesExpected: normalized.chainIdMatchesExpected,
          blockNumber: normalized.blockNumber,
          blockHash: normalized.blockHash,
          requestPinned: normalized.requestPinned,
          expectedBlockNumber: normalized.expectedBlockNumber,
          expectedBlockHash: normalized.expectedBlockHash,
          blockHashMatchesExpected: normalized.blockHashMatchesExpected,
          identityNormalization: {
            status: 'FAIL', observedUpstreamChainId: upstreamChainId, observedNormalizedChainId: normalized.chainId,
            upstreamIdentityVirtualized: upstreamChainId === null ? null : upstreamChainId !== PHASE6_MUTABLE_RPC_CHAIN_ID,
          },
        },
        runtime: null,
        async close() {},
      };
    }

    let closed = false;
    const evidence = {
      status: 'PASS', failureKind: null, profile: PHASE6_MUTABLE_RPC_ENV, chain: PHASE6_MUTABLE_RPC_CHAIN,
      expectedChainId: PHASE6_MUTABLE_RPC_CHAIN_ID, observedChainId: normalized.chainId, chainIdMatchesExpected: true,
      blockNumber: normalized.blockNumber, blockHash: normalized.blockHash,
      requestPinned: normalized.requestPinned,
      expectedBlockNumber: normalized.expectedBlockNumber,
      expectedBlockHash: normalized.expectedBlockHash,
      blockHashMatchesExpected: normalized.blockHashMatchesExpected,
      backendPolicy: V7_POLICY.mutableRpc.backendPolicy,
      requesterSuppliedRpcAllowed: V7_POLICY.mutableRpc.requesterSuppliedRpcAllowed,
      rpcUrlExposedInEvidence: false,
      identityNormalization: {
        status: 'PASS', observedUpstreamChainId: upstreamChainId, observedNormalizedChainId: normalized.chainId,
        upstreamIdentityVirtualized: upstreamChainId === null ? null : upstreamChainId !== PHASE6_MUTABLE_RPC_CHAIN_ID,
        mode: 'EXISTING_RPC_IDENTITY_PROXY', rawIdentityProbeBypassUsed: false,
      },
    };
    const runtime = {
      url: proxy.url, blockNumber: normalized.blockNumber, blockHash: normalized.blockHash,
      requestPinned: normalized.requestPinned,
      chain: PHASE6_MUTABLE_RPC_CHAIN, chainId: PHASE6_MUTABLE_RPC_CHAIN_ID,
      profile: PHASE6_MUTABLE_RPC_ENV, identityNormalized: true,
    };
    return {
      evidence,
      runtime,
      async close() {
        if (closed) return;
        closed = true;
        await proxy.close();
      },
    };
  } catch (error) {
    if (proxy) await proxy.close().catch(() => {});
    return {
      evidence: failedSessionEvidence('MUTABLE_RPC_PROBE_FAILURE', redactMutableRpcSecret(error?.message ?? String(error), upstreamUrl)),
      runtime: null,
      async close() {},
    };
  }
}

export async function probePhase6MutableRpc(options = {}) {
  const session = await createPhase6MutableRpcSession(options);
  try { return structuredClone(session.evidence); }
  finally { await session.close().catch(() => {}); }
}

export function phase6MutableRpcRuntime({ session } = {}) {
  if (session?.evidence?.status !== 'PASS' || !session?.runtime?.url) throw new Error('Phase 6 mutable RPC runtime requires an active passing identity-normalized RPC session');
  return { ...session.runtime };
}

export function redactMutableRpcSecret(value, secret) {
  const text = String(value ?? '');
  if (typeof secret !== 'string' || secret.length === 0) return text;
  return text.replaceAll(secret, '<redacted-mutable-anvil-rpc>');
}
