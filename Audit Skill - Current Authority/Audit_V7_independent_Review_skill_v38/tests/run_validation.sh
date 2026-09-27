#!/usr/bin/env bash
set -euo pipefail
python3 tests/validate_skill.py
python3 tests/validate_successor_handoffs.py
python3 tests/validate_evidence_invalidation.py
python3 tests/validate_source_intelligence_reuse.py
python3 tests/validate_universal_rule_ids.py
python3 tests/validate_regression_corpus.py
python3 tests/validate_behavioral_invariants.py
python3 tests/validate_human_interaction_and_lineage.py
python3 tests/validate_github_connector_outage.py
python3 tests/validate_github_actions_guide.py
python3 tests/validate_final_report_methodology.py
python3 tests/validate_assurance_case.py
python3 tests/validate_deployment_gas_report.py
python3 tests/validate_phase_contracts_traceability_obligations.py
python3 tests/validate_domain_applicability_and_phase6_subgates.py
python3 tests/validate_phase_reporting.py
python3 tests/validate_auto_advancement_and_phase6_split.py
python3 tests/validate_process_preservation.py
python3 tests/validate_lite_cold_walk.py
python3 tests/validate_manifest.py
python3 "$(dirname "$0")/validate_sequential_structure.py" "${1:-$(cd "$(dirname "$0")/.." && pwd)}"
