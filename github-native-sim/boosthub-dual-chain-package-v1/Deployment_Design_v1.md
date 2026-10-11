# BoostHub dual-chain deployment package v1

The release includes the unchanged BoostHub v11, IBoostHub v5, claim executor v8 and staking v20 source, the original explorer-verified missing dependencies, compiled deployment artifacts, and a Windows PowerShell runner.

Ethereum and Fraxtal receive separate live configuration snapshots. Pools retain their original order, assets, gauges, reward tokens, platform fees, active flags and depositor-lock settings. Each old staking depositor is mapped to its newly deployed staking contract. Removed retained-token taxes and converters are not restored. The v20 ramp continues to apply to all registered rewards with the 65/35 split.

A single permissionless CREATE3 factory uses Solmate's existing CREATE3 library. Its CREATE2 bootstrap uses the established 0x4e59 deterministic deployment proxy. CREATE3 salts are scoped to the deploying EOA and a release identifier. With the same EOA and release identifier, the new Hub, claim helper and corresponding staking PIDs have equal addresses on both chains even when chain-specific constructor arguments differ. The factory does not hold ongoing protocol privileges.

PowerShell requires Node.js 22 or newer and runs a bundled signer with no npm installation or contract compilation. Check mode is read-only. Deploy mode reads the private key through a concealed prompt and sends it only through child-process standard input. Transactions run sequentially and are recorded before submission so interruption recovery reuses the identical signed transaction. Live external contract code, chain identity, package hashes and configured asset/gauge relationships are checked before any deployment.

Verification includes the existing 74-case contract suite rebuilt against original dependencies, script validation tests, PowerShell syntax checks, deterministic address equality checks and the full deploy/configure/resume sequence on disposable Anvil forks of both live chains. No production transaction is submitted by package preparation.

Completion means a saved v2 ZIP with original dependencies, source provenance, compiled artifacts, chain snapshots, operator configuration, PowerShell runner, executable verification evidence and complete instructions. Repository work is temporary, trace-only, with its workflow removed and PR closed at completion.
