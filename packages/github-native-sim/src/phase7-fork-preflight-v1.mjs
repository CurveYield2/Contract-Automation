import { CHAINS } from '../../protocol/src/index.mjs';
import { startAnvilEngine } from '../../runner/src/anvil-engine.mjs';
import { probeArchiveRpcIdentity } from './archive-rpc-identity-v1.mjs';

const ETHEREUM_ARCHIVE_RPC_ENV = 'SIM_ARCHIVE_PRIMARY_ETHEREUM_01';
const IMPERSONATION_PROBE_ACTOR = '0x000000000000000000000000000000000000dEaD';
const ALLOWLISTED_ACTIONS = new Set([
  'deploy', 'call', 'staticCall', 'expectRevert', 'setBalance', 'transferNative',
  'mine', 'increaseTime', 'snapshot', 'revertSnapshot', 'assertBalance', 'assertCall',
]);

function literalTargets(workflow) {
  const targets = new Set();
  for (const step of workflow?.steps ?? []) {
    if (typeof step.target === 'string' && /^0x[0-9a-fA-F]{40}$/.test(step.target)) targets.add(step.target.toLowerCase());
  }
  return [...targets];
}

function checkWorkflowActions(workflow) {
  const unsupported = (workflow?.steps ?? [])
    .map((step, index) => ({ index, action: step?.action }))
    .filter(({ action }) => !ALLOWLISTED_ACTIONS.has(action));
  return {
    status: unsupported.length === 0 ? 'PASS' : 'FAIL',
    unsupported,
    supportedActions: [...ALLOWLISTED_ACTIONS].sort(),
  };
}

function unsupportedArchiveChain(request, workflowActions) {
  const simulation = request.configuration.simulation;
  return {
    schemaVersion: 'audit-v7-phase7-fork-preflight-v1',
    status: 'BLOCKED',
    failureKind: 'ARCHIVE_RPC_UNAVAILABLE',
    requestId: request.requestId,
    sourceCommit: request.source.commit,
    chain: simulation.chain,
    pinnedBlock: simulation.block,
    pinnedBlockHash: simulation.blockHash ?? null,
    evmVersion: request.configuration.evmVersion,
    checks: {
      archiveRpcSecret: {
        status: 'UNAVAILABLE',
        admittedArchiveChains: ['ethereum'],
        profile: null,
        reason: `No qualified archive RPC is admitted for ${simulation.chain}`,
      },
      workflowActions,
    },
    nextState: 'PHASE7_FORK_PREFLIGHT',
  };
}

function reconcileUpstreamIdentity({ upstreamIdentity, expectedChainId, expectedBlockHash, localBlock }) {
  const directIdentityMatch = upstreamIdentity.chainIdMatchesExpected === true
    && upstreamIdentity.networkIdMatchesExpected === true;
  const transactionChainMatch = upstreamIdentity.sampleTransaction?.chainId === expectedChainId;
  const expectedHashMatch = typeof expectedBlockHash === 'string'
    && upstreamIdentity.block?.hash?.toLowerCase() === expectedBlockHash.toLowerCase();
  const localHashMatch = Boolean(localBlock?.hash)
    && upstreamIdentity.block?.hash?.toLowerCase() === localBlock.hash.toLowerCase();
  const stateIdentityEstablished = expectedHashMatch && localHashMatch;
  const reconciled = stateIdentityEstablished && (directIdentityMatch || transactionChainMatch);
  return {
    status: reconciled ? 'PASS' : 'FAIL',
    expectedChainId,
    remoteChainId: upstreamIdentity.remoteChainId,
    remoteNetworkId: upstreamIdentity.remoteNetworkId,
    directIdentityMatch,
    sampleTransactionChainId: upstreamIdentity.sampleTransaction?.chainId ?? null,
    transactionChainMatch,
    expectedBlockHash,
    upstreamBlockHash: upstreamIdentity.block?.hash ?? null,
    localAnvilBlockHash: localBlock?.hash ?? null,
    expectedHashMatch,
    localHashMatch,
    reconciliationMode: reconciled
      ? (directIdentityMatch ? 'DIRECT_IDENTITY_AND_STATE_MATCH' : 'IDENTITY_PROXY_STATE_RECONCILED')
      : 'UNRECONCILED',
    identityProxyRequired: reconciled && !directIdentityMatch,
  };
}

async function proveImpersonationBalanceControl(provider) {
  const actor = IMPERSONATION_PROBE_ACTOR;
  const probeBalanceHex = '0xde0b6b3a7640000';
  let impersonated = false;
  try {
    await provider.send('anvil_impersonateAccount', [actor]);
    impersonated = true;
    await provider.send('evm_setAccountBalance', [actor, probeBalanceHex]);
    const balance = await provider.getBalance(actor);
    return {
      status: balance === 10n ** 18n ? 'PASS' : 'FAIL',
      actor,
      impersonationSucceeded: true,
      balanceMutationSucceeded: balance === 10n ** 18n,
      observedBalance: balance.toString(),
    };
  } catch (error) {
    return {
      status: 'FAIL',
      actor,
      impersonationSucceeded: impersonated,
      balanceMutationSucceeded: false,
      reason: error?.message ?? String(error),
    };
  } finally {
    if (impersonated) await provider.send('anvil_stopImpersonatingAccount', [actor]).catch(() => {});
  }
}

export async function runPhase7ForkPreflightV1({
  request,
  environment = process.env,
  startEngine = startAnvilEngine,
  probeUpstreamIdentity = probeArchiveRpcIdentity,
}) {
  if (!request || request.phaseId !== 'fork-simulation-lifecycle') throw new Error('Phase 7 fork preflight requires fork-simulation-lifecycle request');
  if (request.profileId !== 'github-native-simulate-v2') throw new Error('Phase 7 fork preflight requires github-native-simulate-v2');
  const simulation = request.configuration?.simulation;
  if (!simulation) throw new Error('Phase 7 fork preflight requires simulation configuration');
  const chain = CHAINS[simulation.chain];
  if (!chain) throw new Error(`Unsupported Phase 7 chain ${simulation.chain}`);

  const workflowActions = checkWorkflowActions(simulation.workflow);
  if (simulation.chain !== 'ethereum') return unsupportedArchiveChain(request, workflowActions);

  const forkUrl = environment[ETHEREUM_ARCHIVE_RPC_ENV];
  const archiveRpcSecret = {
    status: typeof forkUrl === 'string' && forkUrl.length > 0 ? 'PASS' : 'FAIL',
    profile: ETHEREUM_ARCHIVE_RPC_ENV,
  };
  if (archiveRpcSecret.status !== 'PASS' || workflowActions.status !== 'PASS') {
    return {
      schemaVersion: 'audit-v7-phase7-fork-preflight-v1',
      status: 'FAIL',
      failureKind: archiveRpcSecret.status !== 'PASS' ? 'ARCHIVE_RPC_SECRET_MISSING' : 'UNSUPPORTED_WORKFLOW_ACTION',
      requestId: request.requestId,
      sourceCommit: request.source.commit,
      chain: simulation.chain,
      pinnedBlock: simulation.block,
      pinnedBlockHash: simulation.blockHash ?? null,
      evmVersion: request.configuration.evmVersion,
      checks: { archiveRpcSecret, workflowActions },
      nextState: archiveRpcSecret.status !== 'PASS' ? 'PHASE7_FORK_PREFLIGHT' : 'RUNNER_REPAIR_REBIND',
    };
  }
  if (typeof simulation.blockHash !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(simulation.blockHash)) {
    return {
      schemaVersion: 'audit-v7-phase7-fork-preflight-v1',
      status: 'FAIL',
      failureKind: 'PINNED_BLOCK_HASH_REQUIRED',
      requestId: request.requestId,
      sourceCommit: request.source.commit,
      chain: simulation.chain,
      pinnedBlock: simulation.block,
      pinnedBlockHash: simulation.blockHash ?? null,
      evmVersion: request.configuration.evmVersion,
      checks: { archiveRpcSecret, workflowActions, pinnedBlockState: { status: 'FAIL', reason: 'Exact pinned block hash is required' } },
      nextState: 'PHASE7_FORK_PREFLIGHT',
    };
  }

  let upstreamIdentity;
  try {
    upstreamIdentity = await probeUpstreamIdentity({
      rpcUrl: forkUrl,
      block: simulation.block,
      expectedChainId: chain.chainId,
    });
  } catch (error) {
    return {
      schemaVersion: 'audit-v7-phase7-fork-preflight-v1',
      status: 'FAIL',
      failureKind: 'ARCHIVE_IDENTITY_PROBE_FAILURE',
      requestId: request.requestId,
      sourceCommit: request.source.commit,
      chain: simulation.chain,
      pinnedBlock: simulation.block,
      pinnedBlockHash: simulation.blockHash,
      evmVersion: request.configuration.evmVersion,
      checks: {
        archiveRpcSecret,
        workflowActions,
        chainIdentity: { status: 'FAIL', reason: error?.message ?? String(error) },
      },
      nextState: 'PHASE7_FORK_PREFLIGHT',
    };
  }

  const placeholderArtifacts = { get() { throw new Error('Preflight does not deploy artifacts'); } };
  let engine;
  try {
    engine = await startEngine({
      artifacts: placeholderArtifacts,
      workflow: simulation.workflow,
      chainId: chain.chainId,
      forkUrl,
      block: simulation.block,
      evmVersion: request.configuration.evmVersion,
    });

    const anvilChainIdHex = await engine.provider.send('eth_chainId', []);
    const observedAnvilChainId = Number(BigInt(anvilChainIdHex));
    const localBlock = await engine.provider.getBlock(simulation.block);
    const chainIdentity = reconcileUpstreamIdentity({
      upstreamIdentity,
      expectedChainId: chain.chainId,
      expectedBlockHash: simulation.blockHash,
      localBlock,
    });
    chainIdentity.anvilChainId = observedAnvilChainId;
    chainIdentity.anvilChainIdMatchesExpected = observedAnvilChainId === chain.chainId;
    if (!chainIdentity.anvilChainIdMatchesExpected) chainIdentity.status = 'FAIL';

    const pinnedBlockState = {
      status: localBlock?.number === simulation.block
        && Boolean(localBlock?.hash)
        && localBlock.hash.toLowerCase() === simulation.blockHash.toLowerCase()
        && upstreamIdentity.block?.hash?.toLowerCase() === simulation.blockHash.toLowerCase()
        ? 'PASS' : 'FAIL',
      number: localBlock?.number ?? null,
      expectedHash: simulation.blockHash,
      localHash: localBlock?.hash ?? null,
      upstreamHash: upstreamIdentity.block?.hash ?? null,
    };

    const codeChecks = [];
    for (const address of literalTargets(simulation.workflow)) {
      const code = await engine.provider.getCode(address);
      codeChecks.push({ address, byteLength: code === '0x' ? 0 : (code.length - 2) / 2, status: code !== '0x' ? 'PASS' : 'FAIL' });
    }
    const targetCode = {
      status: codeChecks.length > 0 && codeChecks.every((item) => item.status === 'PASS') ? 'PASS' : 'FAIL',
      targets: codeChecks,
      reason: codeChecks.length === 0 ? 'Workflow contains no literal external target to prove archive code readiness' : undefined,
    };

    const impersonationBalanceControl = await proveImpersonationBalanceControl(engine.provider);
    const anvilLauncher = { status: engine.engine === 'anvil' ? 'PASS' : 'FAIL', engine: engine.engine };
    const exactHardfork = {
      status: engine.engine === 'anvil' ? 'PASS' : 'FAIL',
      requested: request.configuration.evmVersion,
      launchArgumentMode: 'EXACT_REQUESTED_HARDFORK_NO_DOWNGRADE',
      downgradeAllowed: false,
    };
    const checks = {
      anvilLauncher,
      exactHardfork,
      archiveRpcSecret,
      chainIdentity,
      pinnedBlockState,
      targetCode,
      impersonationBalanceControl,
      workflowActions,
    };
    const status = Object.values(checks).every((check) => check.status === 'PASS') ? 'PASS' : 'FAIL';
    return {
      schemaVersion: 'audit-v7-phase7-fork-preflight-v1',
      status,
      failureKind: status === 'PASS' ? null : 'FORK_PREFLIGHT_ASSERTION_FAILURE',
      requestId: request.requestId,
      sourceCommit: request.source.commit,
      chain: simulation.chain,
      pinnedBlock: simulation.block,
      pinnedBlockHash: simulation.blockHash,
      evmVersion: request.configuration.evmVersion,
      checks,
      nextState: status === 'PASS' ? 'ACTIVE' : 'RUNNER_REPAIR_REBIND',
    };
  } catch (error) {
    return {
      schemaVersion: 'audit-v7-phase7-fork-preflight-v1',
      status: 'FAIL',
      failureKind: 'ANVIL_PREFLIGHT_FAILURE',
      requestId: request.requestId,
      sourceCommit: request.source.commit,
      chain: simulation.chain,
      pinnedBlock: simulation.block,
      pinnedBlockHash: simulation.blockHash,
      evmVersion: request.configuration.evmVersion,
      checks: {
        archiveRpcSecret,
        workflowActions,
        chainIdentity: {
          status: 'FAIL',
          expectedChainId: chain.chainId,
          remoteChainId: upstreamIdentity?.remoteChainId ?? null,
          remoteNetworkId: upstreamIdentity?.remoteNetworkId ?? null,
          sampleTransactionChainId: upstreamIdentity?.sampleTransaction?.chainId ?? null,
        },
        anvilLauncher: { status: 'FAIL', reason: error?.message ?? String(error) },
        exactHardfork: { status: 'FAIL', requested: request.configuration.evmVersion, reason: error?.message ?? String(error) },
      },
      nextState: 'RUNNER_REPAIR_REBIND',
    };
  } finally {
    if (engine) await engine.close().catch(() => {});
  }
}
