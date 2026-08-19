#!/usr/bin/env python3
"""System Overview source resolver v1. No implicit LLM authoring."""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

CANDIDATE_NAMES=("overview","introduction","product","architecture","protocol","readme","docs","deployment")

def _paragraphs(text:str)->list[str]:
    text=re.sub(r"```.*?```","",text,flags=re.S); paras=[]
    for raw in re.split(r"\n\s*\n",text):
        p=re.sub(r"^#+\s*","",raw.strip()); p=re.sub(r"\[(.*?)\]\([^)]*\)",r"\1",p); p=re.sub(r"\s+"," ",p)
        if 80<=len(p)<=1200 and not p.startswith(("- ","|")): paras.append(p)
    return paras

def resolve(data:dict[str,Any],campaign_root:Path,explicit:Path|None,allow_agent_overview:bool)->dict[str,Any]:
    if explicit:
        text=explicit.read_text(encoding="utf-8",errors="replace").strip(); paras=_paragraphs(text)[:3] or [text]
        return {"paragraphs":paras,"source_type":"client_supplied","sources":[str(explicit)],"agent_generated":False}
    context=data.get("product_context") or {}
    if isinstance(context,dict) and context.get("overview"):
        ov=context["overview"]; paras=ov if isinstance(ov,list) else _paragraphs(str(ov))[:3]; agent_generated=bool(context.get("agent_generated"))
        if agent_generated and not allow_agent_overview: raise RuntimeError("SYSTEM_OVERVIEW_AGENT_OVERRIDE_REQUIRED")
        return {"paragraphs":paras,"source_type":context.get("source_type") or ("agent_synthesis" if agent_generated else "client_supplied"),"sources":context.get("sources") or [],"agent_generated":agent_generated,"override_used":bool(agent_generated and allow_agent_overview)}
    scored=[]; product=str(data.get("audit_identity",{}).get("product_name") or "").lower()
    for p in campaign_root.rglob("*"):
        if not p.is_file() or p.suffix.lower() not in {".md",".txt"}: continue
        low=p.name.lower(); score=sum(3 for k in CANDIDATE_NAMES if k in low)
        if "readme" in low: score+=3
        if any(part.lower() in {"docs","documentation"} for part in p.parts): score+=4
        text=p.read_text(encoding="utf-8",errors="replace")
        if product and product in text.lower(): score+=8
        paras=_paragraphs(text)
        if paras and score: scored.append((score,p,paras))
    if scored:
        score,path,paras=sorted(scored,key=lambda x:(x[0],str(x[1])),reverse=True)[0]
        if score>=6: return {"paragraphs":paras[:3],"source_type":"official_documentation","sources":[str(path.relative_to(campaign_root))],"agent_generated":False}
    raise RuntimeError("SYSTEM_OVERVIEW_SOURCE_REQUIRED")

def write_request(path:Path,product_name:str)->None:
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(f"# System Overview Request v1\n\nProvide 1-3 paragraphs for **{product_name}** describing what the product is, what users do with it, its primary purpose, what it automates or optimizes, and the current supported configuration where important.\n",encoding="utf-8")

if __name__=="__main__":
    import argparse
    parser=argparse.ArgumentParser(); parser.add_argument("--data",required=True,type=Path); parser.add_argument("--campaign-path",required=True,type=Path); parser.add_argument("--system-overview",type=Path); parser.add_argument("--allow-agent-overview",action="store_true"); parser.add_argument("--output",required=True,type=Path); args=parser.parse_args()
    data=json.loads(args.data.read_text())
    try: result=resolve(data,args.campaign_path,args.system_overview,args.allow_agent_overview)
    except RuntimeError as e:
        if str(e)=="SYSTEM_OVERVIEW_SOURCE_REQUIRED": write_request(args.output.parent/"system-overview-request_v1.md",data["audit_identity"]["product_name"])
        raise
    args.output.write_text(json.dumps(result,indent=2,sort_keys=True)+"\n")
