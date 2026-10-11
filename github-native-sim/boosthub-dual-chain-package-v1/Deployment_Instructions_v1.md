# BoostHub contract stack v2 — Windows deployment

The package supplies BoostHub v12, IBoostHub v5, Ethereum Merkle helper v8, Fraxtal sdFXS URD helper v5, and staking v20. Deploy one claim helper appropriate to the selected chain. The interface is not a deployed contract.

BoostHub v12 accepts a zero `vlBoost` constructor address. Fraxtal uses zero and skips boost checkpoint calls; Ethereum can retain its real registry. Gauge checkpoints still require a configured, supported selector.

## Files and prerequisites

Install Node.js 22 or newer on Windows and reopen PowerShell. The extracted package already contains compiled artifacts, a bundled runner, the original three missing Solidity dependencies, and the OpenZeppelin/Solmate source files used by the build. No npm installation or local compilation is needed to deploy.

Keep the complete extracted package together. `Deploy_Configure_v1.ps1` defaults to read-only `Check` on Ethereum. Broadcasting requires an explicit `-Mode Deploy` and a signing key entered at the hidden prompt. The key is not a command argument or saved to the state files. Pending state files temporarily contain signed transactions so retries can rebroadcast exactly the same transaction; keep these files private.

```powershell
Expand-Archive -LiteralPath .\BoostHub_Contract_Stack_v2.zip -DestinationPath .\BoostHub_Contract_Stack_v2
Set-Location .\BoostHub_Contract_Stack_v2
```

Set your deployment EOA below. It must match the key you enter when deploying. The package's default deployer is zero so it cannot silently choose an account for you.

```powershell
$deployer = '0xYOUR_DEPLOYMENT_EOA'
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\deployment\Deploy_Configure_v1.ps1 -Mode Check -Chain Ethereum -DeployerAddress $deployer
```

Replace the example address with a real 20-byte EVM address. Use `-EthereumRpcUrl` or `-FraxtalRpcUrl` to supply your own RPC endpoint. The default public endpoints may rate limit. Execution-policy bypass above applies only to that PowerShell process.

## Review the configuration before broadcasting

Edit `deployment\deployment_config_v1.json` for the desired owners, staking admins, keepers, fee receivers, pool definitions and gas limits. The supplied pool definitions are reference settings read from the existing Hub, not a balance migration. Ethereum contains sdCRV (PID 0), sdFXN (PID 1), sdYB (PID 2); Fraxtal contains sdFXS (PID 0). The script deploys fresh staking depositors and registers the configured reward tokens. Selecting Ethereum does not deploy anything on Fraxtal.

The final owners/admins default to the live values. If your deployment EOA differs from a final owner/admin, the script configures the stack and queues the final role transfers. Those recipients must then accept the roles. Edit the owner/admin fields if you intend to administer the new stack with your deployment EOA instead. The helper configurator has only a one-time Hub binding; it cannot redirect the helper after binding.

Several old settings have no matching behavior in the revised stack:

- Yield-token retention, vlSDT reserve fees, token converters and retained-token withdrawals are removed and are not recreated.
- The 65/35 split applies to the foregone part of the deposit-age reward ramp, independently for every reward token. The configured 5% Hub platform fee remains separate.
- Staking admin fees use the external live platform recipient. Old configurations that send those fees back to the old Hub cannot be reused because retained-token recovery was removed.
- Older sdYB/Fraxtal staking contracts expose no keeper/smoothing settings. Their supplied defaults are the staking admin and zero smoothing. Review these new constructor choices.
- Existing zero gauge checkpoint selectors stay zero in the reference settings. Calling `checkpoint` with such a PID fails until its selector is configured; `checkpoint([])` works on Fraxtal without making boost calls.
- Queued old changes, votes, user balances, claim proofs and pending rewards are not copied. Fresh reward proofs must name the new Hub account.

## Deploy, configure, and verify

Ethereum:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\deployment\Deploy_Configure_v1.ps1 -Mode Deploy -Chain Ethereum -DeployerAddress $deployer
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\deployment\Deploy_Configure_v1.ps1 -Mode Verify -Chain Ethereum -DeployerAddress $deployer
```

Fraxtal, using the separate URD helper and no vlBoost:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\deployment\Deploy_Configure_v1.ps1 -Mode Check -Chain Fraxtal -DeployerAddress $deployer
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\deployment\Deploy_Configure_v1.ps1 -Mode Deploy -Chain Fraxtal -DeployerAddress $deployer
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\deployment\Deploy_Configure_v1.ps1 -Mode Verify -Chain Fraxtal -DeployerAddress $deployer
```

The script predicts fresh addresses using a caller-scoped CREATE3 factory and verifies deployed code, helper binding, pool settings, staking rewards and roles. It cannot replace the contracts already at `0xFbEF8941Da53EA724385B44E91ae9672061D0263`. Keep the deployment ID, deployer, edited configuration, package, and `deployment\state_v1` unchanged when resuming. If interrupted, rerun the same command. A pending signed transaction is checked/rebroadcast before a new one is signed. Avoid using the deployment account concurrently from another application.

A successful final state is `CONFIGURED_AND_VERIFIED`. `ROLE_ACCEPTANCE_REQUIRED` means configuration is present but final roles still need acceptance. The state JSON lists each receiver, contract, and exact calldata. An EOA recipient can run:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\deployment\Deploy_Configure_v1.ps1 -Mode AcceptRoles -Chain Fraxtal -DeployerAddress $deployer
```

At this prompt, enter the final recipient's key; keep `-DeployerAddress` equal to the original deployer. A Safe/DAO recipient must execute the listed acceptance calldata through its normal governance process, then run `Verify`. Changes after the Hub's seven-day initial configuration window may require its ten-day timelock.

## Fraxtal helper v5 usage

The helper retains the verified v4 route: chain ID 252, PID 0, sdFXS `0x1AEe2382e05Dc68BDfC472F1E46d570feCca5814`, Stake DAO URD `0xAeB87C92b2E7d3b21fA046Ae1E51E0ebF11A41Af`.

Its constructor is `constructor(address configurator)`. Deploy the helper first, deploy Hub v12 with `(owner, address(0), helper)`, then let the configurator call `setBoostHub(newHub)` once. Add the sdFXS pool at PID 0 with sdFXS registered as a reward. The supplied script performs this sequence.

Call `supplyClaim(cumulativeClaimable, proof)` with a current URD proof for the **new Hub**, sdFXS, and its cumulative claim entitlement. The leaf is `keccak256(bytes.concat(keccak256(abi.encode(newHub, sdFXS, cumulativeClaimable))))`; proof pairs are sorted. This is not a MultiMerkleStash indexed claim.

The Hub owner then calls `claimStakeDaoRewards(0)`. BoostHub invokes `claimToken(0, sdFXS)` inside its per-token transaction. The helper checks the current root, cumulative amount, registered reward, and recipient; confirms the claimed delta against the Hub's actual balance increase; and lets BoostHub account for the platform fee and net rewards. The staking keeper/admin then uses the ordinary staking harvest path. At least one principal deposit is needed because the Hub rejects reward collection with zero total stake.

`buildBoostHubClaimCalldata()` returns the updated one-argument Hub call. The old `execute(bytes[])` route is removed. Unsupported tokens/PIDs and absent claims are skipped. Stale/completed claims are cleared; a failed claim remains retryable. `getClaim()`, `isClaimCurrent()`, and `clearStaleClaim()` retain their no-argument v4 forms. URD `recipients(newHub)` must be zero or the new Hub itself; this helper provides no reward-redirection setter.

## Evidence and limitations

`verification_evidence_v2.json`, the test transcripts and dependency provenance record the exact sources, compilers and tested scope. Compilation and dependency installation were performed on GitHub. Tests use mocks plus local Anvil forks; no public-chain deployment was broadcast by this work.

The prior stack's documented existing defects remain outside this compatibility change, including false-returning ERC20 payout behavior and unharvested rewards on a final Hub exit. Read `BoostHub_Stack_Changes_v2.md` before funding a deployment. Passing these checks does not establish that arbitrary tokens, future distributor roots or every live operating condition will work.
