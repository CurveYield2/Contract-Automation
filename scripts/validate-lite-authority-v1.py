#!/usr/bin/env python3
import json
import re
import sys
from pathlib import Path
from urllib.parse import unquote

root=Path(sys.argv[1] if len(sys.argv)>1 else "Audit Skill - Current Authority").resolve()
packages=sorted(p for p in root.iterdir() if p.is_dir() and (p/"SKILL.md").is_file())
if len(packages)!=1:
    raise SystemExit(f"expected exactly one unpacked Lite authority package under {root}, found {len(packages)}")
pkg=packages[0]

prohibited=[
    "shared/handoff/",
    "SOLO_WORKFLOW_STATE_MACHINE.json",
    "SOLO_AUDIT_STATE.json",
    "web-bootstrap-agent",
    "WAKE_UP_MESSAGE_TEMPLATE.md",
    "SUCCESSOR_HANDOFF_PROTOCOL.md",
    "HANDOFF_DISCOVERY_AND_CONTEXT_RECOVERY.md",
    "START_HERE_SUCCESSOR_TEMPLATE.md",
    "PROCESS_BLOCKER_RECEIPT.json",
]
term_excludes={"PACKAGE_PROVENANCE.md","LITE_PHASE_RECEIPT_PROTOCOL.md"}
errors=[]

text_files=[p for p in pkg.rglob("*") if p.is_file() and p.suffix.lower() in {".md",".json",".yaml",".yml",".txt"}]
for p in text_files:
    try:
        text=p.read_text()
    except UnicodeDecodeError:
        continue
    rel=p.relative_to(pkg).as_posix()
    if p.name not in term_excludes:
        for term in prohibited:
            if term in text:
                errors.append(f"{rel}: prohibited current-Lite reference {term!r}")

    if p.suffix.lower()==".md":
        for match in re.finditer(r"\[[^\]]*\]\(([^)]+)\)",text):
            raw=match.group(1).strip()
            if not raw or raw.startswith(("http://","https://","mailto:","#")):
                continue
            if raw.startswith("<") and raw.endswith(">"):
                raw=raw[1:-1]
            target=unquote(raw.split("#",1)[0].split("?",1)[0]).strip()
            if not target:
                continue
            candidate=(p.parent/target).resolve()
            try:
                candidate.relative_to(pkg.resolve())
            except ValueError:
                errors.append(f"{rel}: local link escapes authority package: {raw}")
                continue
            if not candidate.exists():
                errors.append(f"{rel}: broken local link: {raw}")

phase7=json.loads((pkg/"phases/phase-7/PHASE_CONTRACT.json").read_text())
auth=phase7.get("authorization",{})
if auth.get("independentExecutionAuthorized") is not False:
    errors.append("phase-7/PHASE_CONTRACT.json: independentExecutionAuthorized must be false")
if auth.get("reviewerExecutionAuthorized") is not False:
    errors.append("phase-7/PHASE_CONTRACT.json: reviewerExecutionAuthorized must be false")
if auth.get("executorType")!="GITHUB_ACTIONS_AUTOMATION":
    errors.append("phase-7/PHASE_CONTRACT.json: executorType must be GITHUB_ACTIONS_AUTOMATION")
if phase7.get("phase",{}).get("reviewerLineage")!="phase7-automation":
    errors.append("phase-7/PHASE_CONTRACT.json: reviewerLineage must be phase7-automation")

if errors:
    print("Lite authority validation FAILED:")
    for e in errors:
        print(f"- {e}")
    raise SystemExit(1)
print(f"Lite authority validation PASS: {pkg.name}; checked {len(text_files)} text files")
