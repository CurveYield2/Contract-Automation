<!--M:remediation-review:d61fa2ad4af4aebc1cfd6088478dc11b9cea2cee7f05776d6613c7f16b8ba43a-->
### `remediation-review`
Trigger: Use when findings have proposed fixes, source changes, configuration changes, or release-candidate updates

## Objective

Verify that each remediation fixes the root cause without creating regression or release drift.

## Review Contract

- Map finding to changed lines, changed behavior, and required regression evidence.
- Review the complete changed surface, not only the proposed patch.
- Rerun affected compile and simulation gates against the new exact source.
- Do not mark a finding resolved until accepted evidence binds the final release.

## Required Output

A remediation ledger with resolution decision and exact regression evidence.
