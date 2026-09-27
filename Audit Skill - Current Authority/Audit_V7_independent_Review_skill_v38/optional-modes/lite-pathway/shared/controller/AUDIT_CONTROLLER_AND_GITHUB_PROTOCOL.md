# Lite Audit Controller and GitHub Protocol

All repository operations use the connected GitHub connector app under the universal rules. Bind the exact active campaign pointer and `workspacePath`; never invent or normalize a campaign path.

Lite execution begins with non-semantic `web-bootstrap-agent` for Phase 0, followed by the semantic reviewer lineage `reviewer-1` → `reviewer-2` → `reviewer-3L` → `reviewer-4`. Mandatory fresh-agent handoffs are `P0_TO_P1`, `P1_TO_P2`, `P5_TO_P6`, and `P67_TO_P8`.

Controller state must preserve exact campaign/source/build identities, the accepted Source Intelligence bundle identity, current milestone/segment, authorized reviewer, checkpoint digests, due obligations, handoff identities and Lite activation evidence.

If the connector fails, follow the homepage Recovery Router. Never substitute direct GitHub URLs, browser access or generic web retrieval for repository operations.


## Fresh Lite campaign initialization

For a fresh Lite campaign, do not manually create controller folders or pre-bind source metadata. Use the Contract-Automation `Audit Source Initialization` workflow.

Agent input is exactly one direct URL identifying one ZIP file on Google Drive or GitHub. Folder submissions are invalid. The initialization workflow derives the source filename, SHA-256, byte length and logical slug; allocates the next `rN` campaign with a fresh `g1` generation; creates `campaigns/<campaign>/source/`; stores the original ZIP and safely unpacks its contents into that same source folder; records the Git blob and source-admission commit; creates `CAMPAIGN_STATE_v1.json`, `ACTIVE_PHASE_POINTER_v1.json` and `SOLO_AUDIT_STATE_v1.json`; publishes `.deep-assurance/active/<slug>.json`; merges the initialized campaign into Audit-Controller `main` through a short-lived branch and pull request; then arms the existing Lite browser orchestrator.

Submitting the same ZIP again through a new request intentionally creates the next campaign revision. Re-running the exact same workflow request is idempotent and reuses its prior initialization result.
