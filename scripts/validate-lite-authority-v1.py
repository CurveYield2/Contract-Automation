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



# Structured-action / one-schema-per-phase invariants.
policy=pkg/"shared/controller/LITE_PHASE_SCHEMA_POLICY.md"
if not policy.exists():
    errors.append("shared/controller/LITE_PHASE_SCHEMA_POLICY.md missing")
packet_template=pkg/"shared/controller/PHASE_WORK_PACKET_TEMPLATE_v1.json"
if not packet_template.exists():
    errors.append("shared/controller/PHASE_WORK_PACKET_TEMPLATE_v1.json missing")

for phase in range(1,11):
    phase_dir=pkg/f"phases/phase-{phase}"
    expected_schema=phase_dir/f"PHASE_{phase:02d}_SCHEMA_v1.json"
    schemas=sorted(phase_dir.glob("PHASE_*_SCHEMA_v*.json"))
    if schemas != [expected_schema]:
        errors.append(f"phase-{phase}: expected exactly one phase work schema {expected_schema.name}; found {[p.name for p in schemas]}")
        continue
    try:
        schema=json.loads(expected_schema.read_text())
        contract=json.loads((phase_dir/"PHASE_CONTRACT.json").read_text())
        template_path=pkg/schema["workForm"]["template"]
        form_template=json.loads(template_path.read_text())
    except Exception as exc:
        errors.append(f"phase-{phase}: failed to load schema/contract/form template: {exc}")
        continue

    if schema.get("schemaVersion")!="curveyield-lite-phase-work-schema-v1" or schema.get("phase")!=phase:
        errors.append(f"phase-{phase}: schema identity mismatch")
    if contract.get("workSchema")!=f"phases/phase-{phase}/PHASE_{phase:02d}_SCHEMA_v1.json":
        errors.append(f"phase-{phase}: contract workSchema mismatch")
    if contract.get("workForm")!=schema.get("workForm",{}).get("campaignPath"):
        errors.append(f"phase-{phase}: contract workForm mismatch")
    auth=contract.get("authorization",{})
    if auth.get("activeReceiptExistsDuringAgentWork") is not False:
        errors.append(f"phase-{phase}: activeReceiptExistsDuringAgentWork must be false")
    if auth.get("controllerBookkeepingTiming")!="AFTER_PACKET_VALIDATION_PASS_ONLY":
        errors.append(f"phase-{phase}: controllerBookkeepingTiming mismatch")
    submission=contract.get("submissionPolicy",{})
    if submission.get("agentCreatesReceipt") is not False or submission.get("agentPerformsBookkeeping") is not False:
        errors.append(f"phase-{phase}: agent receipt/bookkeeping ownership must be false")
    if submission.get("controllerCreatesAndSealsReceiptAfterPass") is not True:
        errors.append(f"phase-{phase}: controller must create/seal receipt only after PASS")
    if submission.get("laterPhasesRecheckPriorBookkeeping") is not False:
        errors.append(f"phase-{phase}: later phases must not re-check predecessor bookkeeping")

    actions=schema.get("actions",{})
    steps=contract.get("steps",[])
    if len(actions)!=len(steps):
        errors.append(f"phase-{phase}: schema action count {len(actions)} != contract step count {len(steps)}")
    for step in steps:
        n=step.get("step")
        key=f"step-{n}"
        action=actions.get(key)
        if not action:
            errors.append(f"phase-{phase}: contract step {n} has no schema action")
            continue
        dest=step.get("outputDestination")
        if not isinstance(dest,dict):
            errors.append(f"phase-{phase} step {n}: outputDestination is mandatory")
            continue
        if dest.get("document")!=schema.get("workForm",{}).get("campaignPath"):
            errors.append(f"phase-{phase} step {n}: output document mismatch")
        if dest.get("section")!=action.get("section"):
            errors.append(f"phase-{phase} step {n}: section mismatch")
        expected_schema_ref=f"phases/phase-{phase}/PHASE_{phase:02d}_SCHEMA_v1.json#actions.{key}"
        if dest.get("schema")!=expected_schema_ref:
            errors.append(f"phase-{phase} step {n}: schema reference mismatch")
        field_names=[x.get("name") for x in action.get("fields",[])]
        if dest.get("requiredFields")!=field_names:
            errors.append(f"phase-{phase} step {n}: requiredFields do not exactly match schema")
        form_action=form_template.get("actions",{}).get(key)
        if not form_action:
            errors.append(f"phase-{phase} step {n}: work-form template section missing")
        else:
            if form_action.get("section")!=action.get("section"):
                errors.append(f"phase-{phase} step {n}: work-form section title mismatch")
            outputs=form_action.get("outputs",{})
            for field in action.get("fields",[]):
                name=field.get("name")
                if name not in outputs:
                    errors.append(f"phase-{phase} step {n}: form field {name} missing")
                if not field.get("consumers"):
                    errors.append(f"phase-{phase} step {n}: required field {name} has no declared consumer/purpose")
        if not action.get("fields"):
            errors.append(f"phase-{phase} step {n}: every agent/automation action must produce defined output fields")

    for key in actions:
        try:
            n=int(key.split("-",1)[1])
        except Exception:
            errors.append(f"phase-{phase}: invalid schema action key {key}")
            continue
        if not any(s.get("step")==n for s in steps):
            errors.append(f"phase-{phase}: schema action {key} has no matching contract step")

    report=schema.get("finalReport")
    if schema.get("automationOnly"):
        if phase!=7:
            errors.append(f"phase-{phase}: only Phase 7 may be automationOnly")
    else:
        if not report:
            errors.append(f"phase-{phase}: agent-executed phase requires one schema-governed final report")
        else:
            report_template=pkg/report.get("template","")
            if not report_template.exists():
                errors.append(f"phase-{phase}: final-report template missing: {report.get('template')}")
            if contract.get("finalReport")!=report.get("campaignPath"):
                errors.append(f"phase-{phase}: contract finalReport mismatch")

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
