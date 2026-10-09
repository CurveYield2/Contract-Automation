# fxMint WBTC repayment task v5

State: BLOCKED by the user's no-redeployment constraint.

Latest requested action: reuse deployed helper 0x69B658189d63C39126F7BD017D883A872487713e for 74 fxUSD repayment without another deployment.

Read-only verification run 37862379764 completed successfully and reported request BLOCKED at Ethereum block 26151117: TARGET_DEBT_REPAYMENT 100 fxUSD, FLASH_AMOUNT 100.4 USDC, debt 94.470130433123808237 fxUSD. Execute eth_call reverted InvalidPlan() selector 0x21f24259. Source has no amount setter/argument or upgrade mechanism; the amounts are compiler constants. No broadcast or deployment occurred for the 74 request.

Root cause: implementation wrongly fixed repayment and loan amounts instead of parameterizing them for reuse. Workflow edits cannot modify these deployed constants. Native FX router alternatives were inspected but change the flash-loan asset and flow, so are not a drop-in execution of the requested same-helper route. A corrected parameterized helper would require a new deployment; user instruction currently forbids that.

Existing successful 100 fxUSD mainnet transaction and evidence remain recorded in README_v5.md. Collector workflow v4 now captures existing helper capabilities. Other current source remains runner/workflow v9, helper v3, collector script v3. Superseded docs and collector workflow archived/removed. No duplicate workflow active.

Exact next action requires user change to the no-redeployment constraint or a separately authorized alternative transaction route. Do not broadcast a known-reverting transaction, bypass the helper guards, or deploy a replacement under the current request.
