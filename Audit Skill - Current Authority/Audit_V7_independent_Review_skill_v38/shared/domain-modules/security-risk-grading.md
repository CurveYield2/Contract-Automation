<!--M:security-risk-grading:c72000bc3d6b359acc1e298127afbea8fccd00943da0a734d3eb945f9a177c62-->
### `security-risk-grading`
Trigger: Use when beginning an audit or when new evidence may increase impact, complexity, or required review depth

## Objective

Set the audit risk grade from assets, authority, accounting, dependencies, and maximum credible loss.

## Review Contract

- Map protected assets, privileged actors, trust boundaries, upgrade paths, callbacks, and external dependencies.
- Grade impact and complexity using explicit evidence rather than project reputation.
- Record promotion challenges that would require a higher grade.
- Freeze the grade manifest to the exact source commit.

## Required Output

A security-grade manifest with rationale, credible loss, assumptions, and promotion triggers.
