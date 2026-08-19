# CurveYield Audit PDF Generator v1

Deterministic post-audit publication module for CurveYield security audits.

## Architecture

The private `CurveYield2/Solo-Audit-Controller` remains the authoritative, read-only campaign/evidence source. This public execution module performs normalization, System Overview resolution, page planning, frozen-template rendering, evidence manifest generation, hyperlink/semantic checks, and the mandatory 50-pass PDF QA gate.

The approved v37 PDF is copied page-by-page and treated as frozen visual geometry. Standard pages permit text/link mutation only. The only geometry exceptions are the approved Large Scope and Multi-Finding families.

The newer developer specification overrides the original reference ordering: output page 2 is **System Overview**, followed by Table of Contents and Executive Summary.

## GitHub Actions

Use `.github/workflows/audit-pdf-generator-v1.yml`.

The public repository needs a read-only secret named `AUDIT_CONTROLLER_READ_TOKEN` that can clone `CurveYield2/Solo-Audit-Controller`. The token is used only to obtain campaign evidence. The workflow does not execute audited source code or campaign scripts.

Required workflow inputs:

- campaign repository
- campaign ref
- campaign root
- exact product name
- template version
- output audit version
- optional System Overview path

## Deterministic stop codes

- `SYSTEM_OVERVIEW_SOURCE_REQUIRED`
- `SYSTEM_OVERVIEW_AGENT_OVERRIDE_REQUIRED`
- `CANONICAL_STATE_CONFLICT`
- `FINDING_COUNT_CONFLICT`
- `MISSING_PUBLIC_EVIDENCE`
- `CONTENT_REWRITE_REQUIRED`
- `TEXT_OVERFLOW`
- `PDF_QA_FAILED`

No font shrinking, layout improvisation, private evidence links, stale finding IDs, fuzz-timeout-to-PASS conversion, or manual PDF repair is permitted.
