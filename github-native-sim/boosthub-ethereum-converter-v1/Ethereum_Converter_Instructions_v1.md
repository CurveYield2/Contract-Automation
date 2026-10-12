# Ethereum BoostHub unified converter v1

`BoostHubEthereumRewardConverter` replaces the separate converters used by the traced Ethereum BoostHub staking and vault contracts with one deployment. It embeds the routes and swaps through the existing Curve router or YB pools directly. It does not delegate swaps to the old converters.

| Input | Output | Execution |
|---|---|---|
| CRV | sdCRV | CRV/sdCRV pool through the Curve router |
| crvUSD | sdCRV | TriCRV → CRV/sdCRV through the Curve router |
| wstETH | sdFXN | Unwrap → stETH/ETH → ETH/FXN → FXN/sdFXN |
| crvUSD | sdYB | crvUSD/YB → YB/sdYB using direct pool exchanges |

The sdYB output is **0x0c057598dcE1891688829581f890DD2a3685a43f**, matching the live Hub PID 2 asset and converter. The separate **0xe065Bc161b90C9C4Bba2de7F1E194b70A3267c47** reward token is not this route's output.

The routes were traced at Ethereum block **26167322**, hash **0x9c9f00657c37b28114b90eca8fb8ddba0e98f1ebc19bd80e8d7eb89eb7497411**. The inventory JSON records the exact pools, indices, configured converters, current vaults, and older vaults.

## Slippage behavior

`previewConvert(input, output, amount)` preserves each current route's quote:

- CRV→sdCRV and crvUSD→sdCRV use Curve pool price oracles discounted by each pool's live swap fee.
- wstETH→sdFXN first uses wstETH's unwrap ratio and the legacy stETH/ETH pool's `get_dy`, then the FXN pools' fee-adjusted price oracles.
- crvUSD→sdYB preserves the deployed converter's two `get_dy` quotes. Its first exchange receives zero minimum; the second exchange and converter enforce the final caller minimum. This legacy route does not have an independent oracle price-impact floor.

`convert(input, output, amount, minimum)` and four-argument `swap` pass the caller minimum through and verify the actual output balance increase. They preserve the existing caller-controlled guard; the constructor slippage setting is used only by three-argument `swap`.

Three-argument `swap(input, output, amount)` calculates:

```
minimum = previewConvert(input, output, amount) * (10000 - slippageBps) / 10000
```

The immutable constructor value accepts **0–400 BPS**. The deployment runner defaults to **100 BPS (1%)**, matching the current sdCRV/sdFXN vault strategy settings. Existing strategies continue to use their own configured minimum calculations; the current sdYB strategy uses 25 BPS. Converter fees are zero, as in the source-bound deployed revisions. Pool swap fees still apply.

## Windows PowerShell deployment

Extract the ZIP and install Node.js 22 or newer. The bundled runner already contains its JavaScript dependencies; no npm install or local Solidity compilation is required.

From the extracted directory, simulate deployment and write a configuration plan:

```powershell
& .\deployment\Deploy-Converter_v1.ps1 -RpcUrl 'YOUR_ETHEREUM_RPC_URL' -SlippageBps 100
```

To deploy, set `PRIVATE_KEY` in your current PowerShell process using your normal secure credential mechanism, then run:

```powershell
& .\deployment\Deploy-Converter_v1.ps1 -RpcUrl 'YOUR_ETHEREUM_RPC_URL' -SlippageBps 100 -Broadcast
```

Retain `Converter_Deployment_State_v1.json`. Repeating the same command verifies or resumes its recorded deployment rather than deploying another converter. The runner validates chain ID, dependency code, simulated runtime, deployed runtime, route count, and immutable slippage. It writes `Converter_Deployment_Plan_v1.json` containing owner/admin configuration calldata.

Configuration is a separate owner/admin action. For current live vault strategies, use the generated `addRewardRoute(token, newConverter, existingMinAmount)` calls. The sdYB strategy queues the change and needs `applyRewardRoute(token)` after its existing 10-day delay. The two current V2 strategies update immediately. Their configured slippage values and input thresholds are retained.

The plan also includes `set_reward_converter(token, newConverter)` calls for the two **live v17 staking contracts** that still use fee converters. The newly delivered **BoostHubStaking v21** has no converter wiring; these legacy configuration calls do not apply to it.

For the **BeefyVault_BoostHub_Adapter v6** / `BaseAllToWantBoostHubV5`, supply this converter as the strategy's **swapper** at deployment. It implements the adapter's `getAmountOut` and three-argument `swap` interface. That adapter's swapper is immutable, so an existing instance cannot change it using a setter.

## Scope and evidence

This release consolidates every unique swap pair configured in the discovered live Ethereum consumers. It retains the corrected TriCRV **CryptoSwap type 3**; an older converter at `0xf4b32155BeA17b075AEf88540e14F9835e16351B` still advertises incorrect type 1 for that hop. Older revisions for the same pairs used spot quotes; the combined converter uses the current-depositor oracle revisions for sdCRV/sdFXN.

The Hub also lists SDT, 3CRV, WBTC, and the separate `0xe065...` reward token without configured converter routes in these consumers. They remain unsupported. The newer adapter defers unsupported reward swaps; adding more Hub reward tokens does not create new swap routes automatically.

Some discovered older vaults still point to former staking depositors rather than the Hub's current depositors. They are recorded for trace completeness. The generated configuration plan covers current-depositor consumers; it does not migrate these older staking relationships.

The package includes compiler input, ABI/bytecode, dependency sources/licenses, unit and fork evidence, matched live converter sources, and the route inventory. Source-to-runtime matching excludes Solidity metadata and constructor immutable ranges, while retaining full observed runtime hashes and constructor/getter values. All test transactions were executed on disposable local Anvil instances inside GitHub Actions. No production deployment or configuration transaction was sent.
