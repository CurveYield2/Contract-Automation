#!/usr/bin/env python3
"""Approved page-family planner v1."""
from __future__ import annotations
import json,math
from pathlib import Path
from typing import Any
SEVERITY_ORDER=["Critical","High","Medium","Low","Informational"]
def finding_weight(f:dict[str,Any])->int:
    return sum(len(str(x)) for x in [f.get("description",""),f.get("impact",""),f.get("exploit_or_failure_mechanics",""),f.get("remediation","")])
def plan_findings(findings:list[dict[str,Any]])->list[dict[str,Any]]:
    pages=[]
    for sev in SEVERITY_ORDER:
        fs=[f for f in findings if f.get("severity")==sev]; i=0
        while i<len(fs):
            f=fs[i]
            if finding_weight(f)>2200:
                pages.append({"family":"finding-single","template_page":16 if sev in {"Critical","High","Medium"} else 18,"severity":sev,"finding_ids":[f["id"]]}); pages.append({"family":"finding-continuation","template_page":17,"severity":sev,"finding_ids":[f["id"]]}); i+=1; continue
            group=[f]
            for candidate in fs[i+1:i+3]:
                if len(group)<3 and sum(finding_weight(x) for x in group+[candidate])<=2600: group.append(candidate)
                else: break
            pages.append({"family":{1:"finding-single",2:"finding-two",3:"finding-three"}[len(group)],"template_page":16 if sev in {"Critical","High","Medium"} else 18,"severity":sev,"finding_ids":[x["id"] for x in group]})
            for x in group:
                if str(x.get("status","")).endswith("VERIFIED") and (x.get("remediation") or x.get("verification")): pages.append({"family":"remediation","template_page":17,"severity":sev,"finding_ids":[x["id"]]})
            i+=len(group)
    return pages
def plan(data:dict[str,Any])->list[dict[str,Any]]:
    scope_n=len(data.get("scope") or []); pages=[{"family":"cover","template_page":1},{"family":"system-overview","template_page":5},{"family":"toc","template_page":2},{"family":"executive-summary","template_page":3}]
    if scope_n:
        if scope_n<=5: pages.append({"family":"scope-standard","template_page":4,"scope_slice":[0,scope_n]})
        elif scope_n<=9:
            for start in range(0,scope_n,5): pages.append({"family":"scope-standard","template_page":4,"scope_slice":[start,min(start+5,scope_n)]})
        else:
            for start in range(0,scope_n,10): pages.append({"family":"scope-compact","template_page":4,"scope_slice":[start,min(start+10,scope_n)],"geometry_exception":"large-scope-v1"})
    if data.get("limitations") or data.get("methodology") or data.get("findings"): pages.append({"family":"threat-model","template_page":6})
    methodology=data.get("methodology") or []
    if methodology:
        count=max(1,min(6,math.ceil(sum(len(x.get("text","")) for x in methodology)/1800)))
        for n in range(count): pages.append({"family":"methodology","template_page":7+min(n,5),"methodology_part":n})
        pages.append({"family":"results","template_page":13})
        if len(methodology)>3: pages.append({"family":"results","template_page":14})
        pages.append({"family":"security-claims","template_page":15})
    pages.extend(plan_findings(data.get("findings") or []))
    if data.get("limitations"): pages.append({"family":"qualifications","template_page":20})
    recommendations=data.get("recommendations") or []
    if recommendations or data.get("findings"):
        pages.append({"family":"recommendations","template_page":21})
        if len(recommendations)>2 or len(data.get("findings") or [])>4: pages.append({"family":"recommendations","template_page":22})
    pages.append({"family":"evidence-index","template_page":23})
    if len(data.get("evidence") or [])>7: pages.append({"family":"evidence-index","template_page":24})
    pages.append({"family":"conclusion","template_page":25}); return pages
if __name__=="__main__":
    import argparse
    parser=argparse.ArgumentParser(); parser.add_argument("--data",type=Path,required=True); parser.add_argument("--output",type=Path,required=True); args=parser.parse_args(); data=json.loads(args.data.read_text()); args.output.write_text(json.dumps(plan(data),indent=2)+"\n")
