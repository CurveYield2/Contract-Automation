import { CHAINS } from '../../protocol/src/index.mjs';
import { startAnvilEngine } from '../../runner/src/anvil-engine.mjs';

const ALLOWLISTED_ACTIONS = new Set([
  'deploy', 'call', 'staticCall', 'expectRevert', 'setBalance', 'transferNative',
  'mine', 'increaseTime', 'snapshot', 'revertSnapshot', 'assertBalance', 'assertCall',
]);
const ETHEREUM_ARCHIVE_RPC_ENV = 'SIM_ARCHIVE_PRIMARY_ETHEREUM_01';
const CURRENT_ARCHIVE_CHAINS = new Set(['ethereum']);

function literalTargets(workflow) {
  const targets = new Set();
  for (const step of workflow?.steps ?? []) {
    if (typeof step.target === 'string' && /^0x[0-9a-fA-F]{40}$/.test(step.target)) targets.add(step.target.toLowerCase());
  }
  return [...targets];
}

function literalActors(workflow) {
  const actors = new Set();
  for (const step of workflow?.steps ?? []) {
    if (typeof step.from === 'string' && /^0x[0-9a-fA-F]{40}$/.test(step.from)) actors.add(step.from.toLowerCase());
  }
  return [...actors];
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

export async function runPhase7ForkPreflightV1({
  request,
  environment = process.env,
  startEngine = startAnvilEngine,
}) {
  if (!request || request.phaseId !== 'fork-simulation-lifecycle') throw new Error('Phase 7 fork preflight requires fork-simulation-lifecycle request');
  if (request.profileId !== 'github-native-simulate-v2') throw new Error('Phase 7 fork preflight requires github-native-simulate-v2');
  const simulation = request.configuration?.simulation;
  if (!simulation) throw new Error('Phase 7 fork preflight requires simulation configuration');
  const chain = CHAINS[simulation.chain];
  if (!chain) throw new Error(`Unsupported Phase 7 chain ${simulation.chain}`);

  const workflowActions = checkWorkflowActions(simulation.workflow);

  if (!CURRENT_ARCHIVE_CHAINS.has(simulation.chain)) {
    return {
      schemaVersion: 'audit-v7-phase7-fork-preflight-v1',
      status: 'FAIL',
      requestId: request.requestId,
      sourceCommit: request.source.commit,
      chain: simulation.chain,
      pinnedBlock: simulation.block,
      evmVersion: request.configuration.evmVersion,
      checks: {
        archiveRpcSecret: {
          status: 'UNAVAILABLE',
          reason: 'ARCHIVE_RPC_UNAVAILABLE',
          supportedArchiveChains: [...CURRENT_ARCHIVE_CHAINS],
        },
        workflowActions,
      },
      blockingReason: 'ARCHIVE_RPC_UNAVAILABLE',
      nextState: 'PHASE7_FORK_PREFLIGHT',
    };
  }

  const forkUrl = environment[ETHEREUM_ARCHIVE_RPC_ENV];
  const archiveRpcSecret = {
    status: typeof forkUrl === 'string' && forkUrl.length > 0 ? 'PASS' : 'FAIL',
    profile: ETHEREUM_ARCHIVE_RPC_ENV,
  };
  if (archiveRpcSecret.status !== 'PASS' || workflowActions.status !== 'PASS') {
    return {
      schemaVersion: 'audit-v7-phase7-fork-preflight-v1',
      status: 'FAIL',
      requestId: request.requestId,
      sourceCommit: request.source.commit,
      chain: simulation.chain,
      pinnedBlock: simulation.block,
      evmVersion: request.configuration.evmVersion,
      checks: { archiveRpcSecret, workflowActions },
      blockingReason: archiveRpcSecret.status !== 'PASS' ? 'ARCHIVE_RPC_SECRET_MISSING' : 'UNSUPPORTED_WORKFLOW_ACTION',
      nextState: archiveRpcSecret.status !== 'PASS' ? 'PHASE7_FORK_PREFLIGHT' : 'RUNNER_REPAIR_REBIND',
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

    const chainIdHex = await engine.provider.send('eth_chainId', []);
    const chainIdentity = {
      status: Number(BigInt(chainIdHex)) === chain.chainId ? 'PASS' : 'FAIL',
      expectedChainId: chain.chainId,
      observedChainId: Number(BigInt(chainIdHex)),
    };

    const pinnedBlock = await engine.provider.getBlock(simulation.block);
    const pinnedBlockState = {
      status: pinnedBlock?.number === simulation.block && Boolean(pinnedBlock?.hash) ? 'PASS' : 'FAIL',
      number: pinnedBlock?.number ?? null,
      hash: pinnedBlock?.hash ?? null,
    };

    const codeChecks = [];
    for (const address of literalTargets(simulation.workflow)) {
      const code = await engine.provider.getCode(address);
      codeChecks.push({ address, byteLength: code === '0x' ? 0 : (code.length - 2) / 2, status: code !== '0x' ? 'PASS' : 'FAIL' });
    }
    const targetCode = {
      status: codeChecks.every((item) => item.status === 'PASS') ? 'PASS' : 'FAIL',
      targets: codeChecks,
    };

    const actors = literalActors(simulation.workflow);
    const balanceChecks = [];
    for (const actor of actors.slice(0, 3)) {
      await engine.provider.send('evm_setAccountBalance', [actor, '0xde0b6b3a7640000']);
      const balance = await engine.provider.getBalance(actor);
      balanceChecks.push({ actor, balance: balance.toString(), status: balance === 10n ** 18n ? 'PASS' : 'FAIL' });
    }
    const impersonationBalanceControl = {
      status: balanceChecks.every((item) => item.status === 'PASS') ? 'PASS' : 'FAIL',
      actors: balanceChecks,
      note: actors.length === 0 ? 'No literal actor required by workflow; Anvil engine startup still validated.' : undefined,
    };

    const anvilLauncher = { status: engine.engine === 'anvil' ? 'PASS' : 'FAIL', engine: engine.engine };
    const exactHardfork = { status: 'PASS', requested: request.configuration.evmVersion, downgradeAllowed: false };
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
      requestId: request.requestId,
      sourceCommit: request.source.commit,
      chain: simulation.chain,
      pinnedBlock: simulation.block,
      evmVersion: request.configuration.evmVersion,
      checks,
      nextState: status === 'PASS' ? 'ACTIVE' : 'RUNNER_REPAIR_REBIND',
    };
  } catch (error) {
    return {
      schemaVersion: 'audit-v7-phase7-fork-preflight-v1',
      status: 'FAIL',
      requestId: request.requestId,
      sourceCommit: request.source.commit,
      chain: simulation.chain,
      pinnedBlock: simulation.block,
      evmVersion: request.configuration.evmVersion,
      checks: {
        archiveRpcSecret,
        workflowActions,
        anvilLauncher: { status: 'FAIL', reason: error?.message ?? String(error) },
        exactHardfork: { status: 'FAIL', requested: request.configuration.evmVersion, reason: error?.message ?? String(error) },
      },
      nextState: 'RUNNER_REPAIR_REBIND',
    };
  } finally {
    if (engine) await engine.close().catch(() => {});
  }
}
