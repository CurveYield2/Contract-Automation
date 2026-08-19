#!/usr/bin/env python3
"""Normalize a CurveYield audit campaign into the deterministic report model v1."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

from campaign_reader_v1 import Artifact, build_inventory, load_structured

VALID_SEVERITIES = {"Critical", "High", "Medium", "Low", "Informational"}
OPEN_STATUSES = {"OPEN", "UNRESOLVED", "VALIDATED_OPEN", "NO_GO"}
VERIFIED_STATUSES = {"REMEDIATED_VERIFIED", "FIXED_VERIFIED", "REPAIRED_VERIFIED", "RESOLVED_VERIFIED"}

def _artifact(d: dict[str, Any] | None) -> Artifact | None:
    return Artifact(**d) if d else None

def _flatten(obj: Any):
    if isinstance(obj, dict):
        yield obj
        for v in obj.values(): yield from _flatten(v)
    elif isinstance(obj, list):
        for v in obj: yield from _flatten(v)

def _canonical_finding(item: dict[str, Any]) -> dict[str, Any] | None:
    raw_id = item.get("canonical_id") or item.get("canonicalId") or item.get("id") or item.get("findingId")
    severity = item.get("severity") or item.get("finalSeverity")
    status = item.get("status") or item.get("finalStatus") or item.get("disposition")
    title = item.get("title") or item.get("name") or item.get("summary")
    if not raw_id or not severity or not status: return None
    sev = str(severity).strip().title()
    if sev == "Info": sev = "Informational"
    if sev not in VALID_SEVERITIES: return None
    return {
        "id": str(raw_id).strip(), "severity": sev, "title": str(title or raw_id).strip(),
        "status": str(status).strip().upper().replace(" ", "_"),
        "affected_contracts": item.get("affected_contracts") or item.get("affectedContracts") or [],
        "description": item.get("description") or item.get("rootCause") or "",
        "impact": item.get("impact") or "",
        "exploit_or_failure_mechanics": item.get("exploit_or_failure_mechanics") or item.get("mechanics") or item.get("reproductionMechanics") or "",
        "reproduction": item.get("reproduction") or item.get("reproductionEvidence") or [],
        "remediation": item.get("remediation") or item.get("fix") or "",
        "verification": item.get("verification") or item.get("verificationEvidence") or [],
        "final_disposition": item.get("final_disposition") or item.get("finalDisposition") or status,
        "source_refs": item.get("source_refs") or item.get("sourceRefs") or [],
        "historical_id": item.get("historical_id") or item.get("historicalId"),
    }

def _collect_findings(root: Path, inv: dict[str, Any]) -> list[dict[str, Any]]:
    candidates: list[tuple[int, dict[str, Any]]] = []
    role_weight = {"publication_handoff":100,"canonical_receipt":95,"release_state":85,"final_audit_report":80,"finding_normalization":75,"finding_ledger":70,"campaign_state":65}
    for role, weight in role_weight.items():
        a = _artifact(inv["authorities"].get(role))
        if not a: continue
        try: data = load_structured(root, a)
        except Exception: continue
        for obj in _flatten(data):
            f = _canonical_finding(obj)
            if f: candidates.append((weight, f))
    by_id: dict[str, tuple[int, dict[str, Any]]] = {}; aliases: dict[str, str] = {}
    for weight, f in candidates:
        if f.get("historical_id"): aliases[str(f["historical_id"])] = f["id"]
        current = by_id.get(f["id"])
        if current is None or weight > current[0]: by_id[f["id"]] = (weight, f)
        elif weight == current[0] and json.dumps(f, sort_keys=True) != json.dumps(current[1], sort_keys=True): raise RuntimeError(f"CANONICAL_STATE_CONFLICT:finding:{f['id']}")
    findings = [v[1] for v in by_id.values()]; order = {"Critical":0,"High":1,"Medium":2,"Low":3,"Informational":4}
    findings.sort(key=lambda x:(order[x["severity"]],x["id"]))
    for f in findings:
        if f["id"] in aliases: f["id"] = aliases[f["id"]]
    return findings

def _load_markdown(root: Path, inv: dict[str, Any], roles: set[str]) -> list[dict[str, str]]:
    out=[]
    for a in inv["artifacts"]:
        if a["role"] not in roles: continue
        p=root/a["path"]
        if p.suffix.lower() not in {".md",".txt"}: continue
        text=p.read_text(encoding="utf-8",errors="replace").strip()
        if text: out.append({"source":a["path"],"text":text})
    return out

def _derive_scope(root: Path, inv: dict[str, Any]) -> list[dict[str, Any]]:
    handoff_art=_artifact(inv["authorities"].get("publication_handoff"))
    if handoff_art:
        handoff=load_structured(root,handoff_art)
        if isinstance(handoff,dict) and isinstance(handoff.get("scope"),list): return handoff["scope"]
    src_art=_artifact(inv["authorities"].get("source_manifest"))
    if src_art:
        data=load_structured(root,src_art)
        for obj in _flatten(data):
            files=obj.get("auditedContracts") or obj.get("contracts") or obj.get("scope")
            if isinstance(files,list) and files and all(isinstance(x,(dict,str)) for x in files):
                result=[]
                for x in files:
                    if isinstance(x,str): result.append({"name":x,"role":"Audited contract","status":"REVIEWED"})
                    else: result.append({"name":x.get("name") or x.get("filename") or x.get("path"),"role":x.get("role") or "Audited contract","status":x.get("status") or x.get("disposition") or "REVIEWED","version":x.get("version")})
                return [x for x in result if x.get("name")]
    return []

def _compiler(root: Path, inv: dict[str, Any]) -> dict[str, Any]:
    records=[]
    for a in inv["artifacts"]:
        if a["role"]!="compiler_receipt": continue
        p=root/a["path"]; rec={"source":a["path"],"sha256":a["sha256"]}
        if p.suffix.lower()==".json":
            try: rec["data"]=json.loads(p.read_text(encoding="utf-8"))
            except Exception: pass
        records.append(rec)
    return {"records":records,"known":bool(records)}

def _evidence_records(root: Path, inv: dict[str, Any]) -> list[dict[str, Any]]:
    keep={"test_receipt","fuzz_receipt","fork_receipt","compiler_receipt","remediation_receipt","source_manifest","limitation_record"}
    return [{"role":a["role"],"path":a["path"],"sha256":a["sha256"],"version":a["version"]} for a in inv["artifacts"] if a["role"] in keep]

def normalize(root: Path, product_name: str, campaign_repo: str | None = None, campaign_ref: str | None = None) -> dict[str, Any]:
    inv=build_inventory(root)
    handoff_art=_artifact(inv["authorities"].get("publication_handoff"))
    if handoff_art:
        handoff=load_structured(root,handoff_art)
        if isinstance(handoff,dict) and handoff.get("schema_version")=="pdf-publication-handoff-v1":
            base=dict(handoff.get("audit_report_data") or {})
            if base:
                base.setdefault("provenance",{})["publication_handoff"]=handoff_art.path
                return base
    findings=_collect_findings(root,inv)
    counts={sev.lower():0 for sev in VALID_SEVERITIES}; open_counts={sev.lower():0 for sev in VALID_SEVERITIES}
    for f in findings:
        counts[f["severity"].lower()]+=1
        if f["status"] in OPEN_STATUSES: open_counts[f["severity"].lower()]+=1
        if f["status"] in VERIFIED_STATUSES and not (f.get("remediation") or f.get("verification")): raise RuntimeError(f"MISSING_PUBLIC_EVIDENCE:{f['id']}:verification")
    technical_status="NO_GO" if open_counts["critical"] or open_counts["high"] else "PASS"
    campaign_state_art=_artifact(inv["authorities"].get("campaign_state")); campaign_state=load_structured(root,campaign_state_art) if campaign_state_art else {}
    methodology_docs=_load_markdown(root,inv,{"audit_methodology_report","phase_report"}); limitations_docs=_load_markdown(root,inv,{"limitation_record"}); recommendations_docs=_load_markdown(root,inv,{"recommendation_record"})
    result={
        "audit_identity":{"product_name":product_name,"campaign_generation_id":campaign_state.get("campaignGenerationId") if isinstance(campaign_state,dict) else None,"process_id":campaign_state.get("processId") if isinstance(campaign_state,dict) else None,"campaign_status":campaign_state.get("campaignStatus") if isinstance(campaign_state,dict) else None,"campaign_source":campaign_repo or str(root),"campaign_ref":campaign_ref},
        "product_context":{},"scope":_derive_scope(root,inv),"methodology":methodology_docs,
        "results":{"technical_status":technical_status,"finding_counts":counts,"open_counts":open_counts},"findings":findings,
        "remediations":[x for x in _evidence_records(root,inv) if x["role"]=="remediation_receipt"],"post_audit_defects":[],
        "tests":[x for x in _evidence_records(root,inv) if x["role"]=="test_receipt"],"fuzzing":[x for x in _evidence_records(root,inv) if x["role"]=="fuzz_receipt"],"fork_runs":[x for x in _evidence_records(root,inv) if x["role"]=="fork_receipt"],
        "compiler":_compiler(root,inv),"release":campaign_state if isinstance(campaign_state,dict) else {},"limitations":limitations_docs,"recommendations":recommendations_docs,"evidence":_evidence_records(root,inv),"links":{},
        "provenance":{"campaign_inventory_sha256":hashlib.sha256(json.dumps(inv,sort_keys=True).encode()).hexdigest(),"authorities":inv["authorities"]},
    }
    return result

if __name__=="__main__":
    import argparse
    parser=argparse.ArgumentParser(); parser.add_argument("--campaign-path",required=True,type=Path); parser.add_argument("--product-name",required=True); parser.add_argument("--campaign-repo"); parser.add_argument("--campaign-ref"); parser.add_argument("--output",required=True,type=Path); args=parser.parse_args()
    out=normalize(args.campaign_path.resolve(),args.product_name,args.campaign_repo,args.campaign_ref); args.output.parent.mkdir(parents=True,exist_ok=True); args.output.write_text(json.dumps(out,indent=2,sort_keys=True)+"\n",encoding="utf-8")
