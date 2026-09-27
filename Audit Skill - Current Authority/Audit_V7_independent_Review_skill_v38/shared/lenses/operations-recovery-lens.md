# Operations Recovery Lens v1

**Executor:** the currently active reviewer (`reviewer-1`, `reviewer-2`, `reviewer-3`, `reviewer-4`, or `reviewer-5` according to controller phase binding). **Active:** All phases when controller/tooling mechanics fail.

This lens preserves the corresponding Deep Assurance V6.1 role objective without claiming a separate reviewer identity. Use the current phase instruction, applicable domain ledgers, exact evidence bindings, and `shared/lenses/SOLO_LENS_ISOLATION_PROTOCOL.md`.

The lens may produce candidates, challenges, reconciliations, or evidence validation, but it cannot bypass the current phase, automatic advancement/completeness gate, source identity, findings-validation pipeline, or final evidence convergence.


## GitHub connector outage path

When the GitHub connector app stops working, disappears, becomes disconnected/permission-denied, or repeatedly fails a required repository operation, execute the connector recovery ladder in `shared/controller/AUDIT_CONTROLLER_AND_GITHUB_PROTOCOL.md` before reporting unavailability. Preserve exact failure evidence and populate `shared/reporting/PROCESS_BLOCKER_RECEIPT.json`. If the connector remains unavailable after the ladder is exhausted or proven impossible, a concise GitHub connector outage report to the human is **mandatory**, even if unrelated phase work remains executable. That report must not pause unaffected work: send it, then immediately continue every authorized task that does not require GitHub. Never use browser/web/raw GitHub access as substitute audit evidence.
