| 7 | Pinned-fork lifecycle and deterministic simulations | [Phase 7 →](phases/phase-7/START_HERE.md) |
| 8 | Candidate validation, remediation guidance, severity; handoff to reviewer-5 | [Phase 8 →](phases/phase-8/START_HERE.md) |
| 9 | Remediation and regression review | [Phase 9 →](phases/phase-9/START_HERE.md) |
| 10 | Evidence convergence, release verification and final report | [Phase 10 →](phases/phase-10/START_HERE.md) |

## Universal supporting authority

Do **not** read these by default. Phase cards/recovery routes link them when needed:

- [Controller contract](shared/controller/AI_Auditor_Controller.md)
- [Workflow state machine](shared/controller/SOLO_WORKFLOW_STATE_MACHINE.json)
- [Automatic phase advancement protocol](shared/controller/AUTOMATIC_PHASE_ADVANCEMENT_PROTOCOL.md)
- [Phase status / verdict policy](shared/policy/PHASE_STATUS_AND_VERDICT_POLICY.md)
- [Universal rule registry](shared/policy/UNIVERSAL_RULE_REGISTRY.json)
- [Evidence invalidation matrix](shared/controller/EVIDENCE_INVALIDATION_MATRIX.json)
- [Generic successor handoff engine](shared/handoff/SUCCESSOR_HANDOFF_PROTOCOL.md)

If a phase card and a linked supporting resource conflict, the phase card controls phase routing while the controller/state machine controls admissible state transitions. Neither may override the universal hard rules on this homepage.
