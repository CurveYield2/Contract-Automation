# Focus Lock — Upgrade Agent Launcher Design v1

## END-STATE INVARIANT

Produce implementation-ready design specifications for an easy Upgrade Agent Launcher that sits in front of the already-merged Development Agent Task Manager.

The preferred user experience is a small Cloudflare-hosted web page because the operator already uses Cloudflare. The design must also retain a GitHub-only launch path.

The launcher must reuse the existing Development Agent Task Manager as the sole execution backend. It must not create a parallel browser driver, parallel watchdog, parallel replacement system, or audit execution pathway.

## CURRENT MAIN

- Repository: `CurveYield2/Contract-Automation`
- Baseline main commit: `9b3e5556d173567b04b31c37fd5f97c356e54fc5`
- Design branch: `upgrade-agent-launcher-design-v1`

## CURRENT EXECUTION BACKEND

Already available on `main`:

- `.github/workflows/development-agent-task-manager.yml`
- declarative request schema `curveyield-development-agent-task-request-v1`
- focus/task-lock protocol and template
- Project-backed continuity by default
- corrected human-style home-exit Playwright browser transport
- scheduled supervision and replacement
- machine completion gating

The launcher is an intake/status layer around this backend.

## HARD BOUNDARIES

- Do not alter audit execution wakes, audit reviewer watchdogs, audit campaign orchestration, audit phase handoffs, Audit V7 execution/qualification, or audit-source initialization as part of the launcher design.
- The launcher may target Audit-Controller for repository-development work, but it must never add GitHub Actions workflows to Audit-Controller.
- Do not introduce a second development-agent manager.
- Do not put ChatGPT/browser credentials in the web application.
- Do not make the Cloudflare application the durable source of task state.
- Do not auto-merge implementation branches by default.

## SATISFIED

- Confirmed current `main` contains the merged focus-locked Development Agent Task Manager.
- Confirmed the preferred declarative intake path is one request JSON file under `process/development-agent-task-manager/requests/`.
- Confirmed a push containing exactly one changed request file triggers the existing manager.
- Confirmed the existing request contract already supports target repository, target branch, base ref, initial assignment and continuity mode.
- Confirmed there is currently no Cloudflare/web application scaffold in the repository.
- Selected a thin Cloudflare UI + GitHub durable backend architecture as the preferred design direction.
- Selected a GitHub-only launcher wrapper as the fallback surface.

## REMAINING DELTA

1. Write the system architecture and lifecycle specification.
2. Write the Cloudflare web/UI/API specification.
3. Write the GitHub-only fallback specification.
4. Define security boundaries, atomic Git write behavior, naming/versioning and failure handling.
5. Define implementation acceptance criteria.
6. Close this design lock once all design documents are committed.

## PARKED OBSERVATIONS

- Changes to audit methodology are out of scope.
- General repository reorganization is out of scope.
- Replacing the already-corrected development browser runtime is out of scope.
- Automatic code merging is out of scope for launcher v1.

## ACTIVE BLOCKER

None

## NEXT ACTION

Commit the implementation-ready launcher system specification, Cloudflare web specification, and GitHub-only fallback specification.

## ANTI-DRIFT CHECK

Before adding a requirement, ask:

`Does this requirement make it easier or safer to launch, observe, resume, or finish a managed development/upgrade task through the existing manager?`

If no, park it.
