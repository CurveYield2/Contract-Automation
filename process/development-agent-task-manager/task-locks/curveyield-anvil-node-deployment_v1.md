# Development Agent Task-Lock State v1

MANAGER ID:
curveyield-anvil-node-deployment

END-STATE INVARIANT:
CurveYield2/anvil-node is reduced to the minimum proven Stacks/Anvil functionality required to deploy, through GitHub-controlled automation, a persistent CurveYield Ethereum Anvil RPC service with a stable remotely reachable RPC URL that passes Contract-Automation fork-source compatibility checks; no browser UI or public node-provisioning surface is required.

CURRENT MAIN:
Contract-Automation: 5c8f937be27810c3f07d593bccb3c5fe0dfb3580
anvil-node: 9a943eca6e1f093ec449211aa7f1f11a6437f123

AUTHORITY:
- Human instruction in current task: deploy a CurveYield Anvil node via GitHub and execute this lock.
- Contract-Automation/AGENTS.md @ 5c8f937be27810c3f07d593bccb3c5fe0dfb3580.
- Contract-Automation/FOCUS/TASK LOCKS/TASK_LOCK_PROTOCOL_v1.md @ blob 1f464444e1f0d148b46aeba2bd93ffda7846f834.
- CurveYield2/anvil-node upstream Stacks baseline @ 9a943eca6e1f093ec449211aa7f1f11a6437f123.

SATISFIED:
- CurveYield2/anvil-node exists and its main branch exactly matches the selected upstream Stacks baseline commit.
- The upstream baseline already contains proven Anvil process lifecycle, fork-url, persistent state, readiness, and graceful-state-write behavior.

REMAINING DELTA:
- Determine the existing GitHub deployment/hosting path available to CurveYield2/anvil-node without inventing parallel infrastructure.
- Reduce the live deployment surface to the minimum fixed Anvil service required for CurveYield simulations.
- Add one canonical GitHub-controlled deployment/qualification path.
- Deploy one persistent Ethereum Anvil node and obtain its stable RPC URL.
- Verify chain identity, historical/fork-read behavior, mutability, persistence/restart behavior, and Contract-Automation compatibility.
- Record the final integration endpoint/profile without exposing secrets.

PARKED OBSERVATIONS:
- Upstream repository licensing must be confirmed before broader redistribution of copied/modified upstream code; this does not block private technical deployment work.

ACTIVE BLOCKER:
None

NEXT ACTION:
Inspect CurveYield2/anvil-node current GitHub workflows, repository deployment metadata, and available runner/deployment configuration to identify the smallest existing GitHub-controlled hosting path.
