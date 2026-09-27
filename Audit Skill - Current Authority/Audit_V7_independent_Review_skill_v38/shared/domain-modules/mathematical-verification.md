<!--M:mathematical-verification:8769b3c79f56e459ce5b43c3fa2f449e4f14c0070de7424b34e792a33ca90310-->
### `mathematical-verification`
Trigger: Use when formulas, units, bounds, precision, rates, ratios, or iterative calculations determine contract safety

## Objective

Verify dimensions, domains, monotonicity, bounds, precision, and edge behavior of contract mathematics.

## Review Contract

- Annotate every quantity with units and scaling.
- Check zero, one, maximum, boundary, overflow, underflow, and rounding cases.
- Derive expected inequalities and conservation relations.
- Link each conclusion to implementation expressions and available execution evidence.

## Required Output

A unit-and-dimension proof plus an invariant matrix.
