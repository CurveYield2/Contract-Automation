#!/usr/bin/env python3
"""Deterministic campaign artifact reader for Audit PDF Generator v1."""
from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Iterable

VERSION_RE = re.compile(r"(?i)(?:^|[-_])v(\d+)(?:\D|$)")

SINGULAR_ROLES = {
    "publication_handoff", "canonical_receipt", "campaign_state", "release_state",
    "final_audit_report", "finding_normalization", "finding_ledger", "source_manifest",
    "audit_methodology_report",
}

ROLE_PRECEDENCE = {
    "publication_handoff": 100, "canonical_receipt": 95, "campaign_state": 90,
    "release_state": 85, "final_audit_report": 80, "finding_normalization": 75,
    "finding_ledger": 70, "remediation_receipt": 65, "test_receipt": 60,
    "fuzz_receipt": 60, "fork_receipt": 60, "compiler_receipt": 60,
    "source_manifest": 58, "audit_methodology_report": 55, "limitation_record": 50,
    "recommendation_record": 50, "human_acknowledgement": 45, "phase_report": 40,
    "intermediate_draft": 10, "other": 0,
}

@dataclass(frozen=True)
class Artifact:
    path: str
    role: str
    version: int
    sha256: str
    size: int
    precedence: int

def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()

def numeric_version(name: str) -> int:
    matches = VERSION_RE.findall(name)
    return max((int(x) for x in matches), default=0)

def classify(path: Path) -> str:
    s = path.as_posix().lower(); name = path.name.lower()
    if "pdf-publication-handoff" in name or "audit-pdf-handoff" in name: return "publication_handoff"
    if "canonical" in s and ("receipt" in s or "sealed" in s or "final-state" in s): return "canonical_receipt"
    if "campaign-state" in name or ("control" in s and "state" in name and name.endswith(".json")): return "campaign_state"
    if "release" in name and ("state" in name or "receipt" in name or "manifest" in name): return "release_state"
    if "final" in name and "audit" in name and ("report" in name or name.endswith(".md")): return "final_audit_report"
    if "finding" in name and "normal" in name: return "finding_normalization"
    if "finding" in name and "ledger" in name: return "finding_ledger"
    if "remediation" in s and ("receipt" in name or "report" in name or name.endswith(".json")): return "remediation_receipt"
    if "fuzz" in s and ("receipt" in name or "result" in name or "report" in name or name.endswith(".json")): return "fuzz_receipt"
    if "fork" in s and ("receipt" in name or "result" in name or "report" in name or name.endswith(".json")): return "fork_receipt"
    if any(k in s for k in ("compile", "compiler", "build")) and any(k in name for k in ("receipt", "result", "report", "manifest")): return "compiler_receipt"
    if "test" in s and any(k in name for k in ("receipt", "result", "report", "manifest")): return "test_receipt"
    if "source" in name and "manifest" in name: return "source_manifest"
    if "methodology" in s and ("report" in name or name.endswith(".md")): return "audit_methodology_report"
    if "limitation" in s or "qualification" in s: return "limitation_record"
    if "recommend" in s: return "recommendation_record"
    if "ack" in s and "human" in s: return "human_acknowledgement"
    if "/reports/" in s or name.endswith("-report-v1.md"): return "phase_report"
    if any(k in s for k in ("draft", "intermediate", "working")): return "intermediate_draft"
    return "other"

def discover(root: Path) -> list[Artifact]:
    artifacts: list[Artifact] = []
    for path in sorted(root.rglob("*")):
        if not path.is_file() or ".git" in path.parts: continue
        role = classify(path)
        artifacts.append(Artifact(path=path.relative_to(root).as_posix(), role=role,
            version=numeric_version(path.name), sha256=sha256_file(path), size=path.stat().st_size,
            precedence=ROLE_PRECEDENCE[role]))
    return artifacts

def selected_authorities(artifacts: Iterable[Artifact]) -> dict[str, Artifact]:
    grouped: dict[str, list[Artifact]] = {}
    for a in artifacts:
        if a.role in SINGULAR_ROLES: grouped.setdefault(a.role, []).append(a)
    out: dict[str, Artifact] = {}
    for role, items in grouped.items():
        max_version = max(x.version for x in items); candidates = [x for x in items if x.version == max_version]
        hashes = {x.sha256 for x in candidates}
        if len(candidates) > 1 and len(hashes) > 1: raise RuntimeError(f"CANONICAL_STATE_CONFLICT:{role}:v{max_version}")
        out[role] = sorted(candidates, key=lambda x: x.path)[-1]
    return out

def load_structured(root: Path, artifact: Artifact | None) -> Any:
    if artifact is None: return None
    p = root / artifact.path
    if p.suffix.lower() == ".json": return json.loads(p.read_text(encoding="utf-8"))
    return p.read_text(encoding="utf-8", errors="replace")

def build_inventory(root: Path) -> dict[str, Any]:
    artifacts = discover(root); authorities = selected_authorities(artifacts)
    phases = sorted({part for a in artifacts for part in Path(a.path).parts if re.fullmatch(r"phase[-_ ]?\d+", part, re.I)})
    return {"root": str(root), "phases": phases, "authorities": {k: asdict(v) for k, v in authorities.items()}, "artifacts": [asdict(a) for a in artifacts]}

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(); parser.add_argument("campaign_path", type=Path); parser.add_argument("--output", type=Path); args = parser.parse_args()
    payload = build_inventory(args.campaign_path.resolve()); text = json.dumps(payload, indent=2, sort_keys=True)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True); args.output.write_text(text + "\n", encoding="utf-8")
    else: print(text)
