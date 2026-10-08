# fxMint WBTC repayment task v3

State: COMPLETE. User requested the transferred position owner 0xFF90b414D84F7Ec4FAEADBD8Da86Ad515F930654, actual 100 fxUSD debt repayment, 0.12 gwei simulation, and ETH cost.

Collector v3 run 37858977924 passed, verifying owner position #887. Runner v8 run 37859119586 passed on commit 7f4d82e5686bb8dc30cbeb777b6cd1db58a91ca0. Debt decreased exactly 100 fxUSD, from 194.470130433123808237 to 94.470130433123808237. Complete flash repayment, slippage checks, ownership return, zero retained tokens, and negative authorization/rollback checks passed.

Measured cost at 120000000 wei/gas: repayment 1354850 gas = 0.000162582 ETH; approval 55948 gas = 0.00000671376 ETH; deployment 2024687 gas = 0.00024296244 ETH; all three total 0.0004122582 ETH.

Observed upstream base fee 0.158904269 gwei exceeded requested 0.12. Initial v7 run stopped at this guard. v8 explicitly records a local fork fee scenario (base fee zero) and requires exact effective gas price 0.12 for every receipt. Live mode checks real base fee and stops before any broadcast if it exceeds 0.12. No mainnet broadcast or token/protocol-state fabrication occurred.

Current live files: collection workflow/data v3, repayment workflow/runner v8, helper v3, README_v3.md. Superseded active source and documentation archived and removed. No new branch created. All compilation/dependency downloads occurred only within GitHub. Terminal evidence and cost receipts reside in run artifacts.
