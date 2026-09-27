#!/usr/bin/env python3
from pathlib import Path
import re,sys
ROOT=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else Path(__file__).resolve().parents[1]
errors=[]
def req(c,m):
    if not c: errors.append(m)
skill=(ROOT/"SKILL.md").read_text(encoding="utf-8")
for tok in ["Mandatory non-blocking work updates","do not bother the human","Recovery Router","reviewer-3","reviewer-4","GitHub connector app only","web browser","CurveYield2/Audit-Controller","CurveYield2/Contract-Automation",".deep-assurance/active/","docs/agent-guides/","Phase map","Canonical Source Intelligence","U-SOURCEINTEL-001"]: req(tok.lower() in skill.lower(),f"homepage missing {tok}")
for n in range(11):
    p=ROOT/f"phases/phase-{n}/START_HERE.md"; req(p.is_file(),f"missing phase {n} START_HERE")
    if not p.is_file(): continue
    t=p.read_text(encoding="utf-8")
    req("CURRENT-PHASE READ BOUNDARY" in t,f"phase {n} missing read boundary")
    req("UNIVERSAL RULE IDS" in t and "U-GITHUB-001" in t and "U-SOURCEINTEL-001" in t,f"phase {n} missing universal connector-rule reference")
    req("## Phase card" in t and "| Step | Action |" in t,f"phase {n} missing step card")
    req("PHASE CONTRACT HARD GATE" in t and "PHASE_CONTRACT.json" in t,f"phase {n} missing phase contract hard gate")
    steps=[int(x) for x in re.findall(r"^\| (\d+) \|",t,re.M)]
    req(steps==list(range(1,len(steps)+1)),f"phase {n} step numbering must be unique/sequential: {steps}")
# Internal markdown links must resolve unless http(s) or anchor.
link_re=re.compile(r"\[[^\]]+\]\(([^)]+)\)")
for p in ROOT.rglob("*.md"):
    t=p.read_text(encoding="utf-8")
    for link in link_re.findall(t):
        target=link.split('#',1)[0].strip()
        if not target or target.startswith(("http://","https://","mailto:")): continue
        q=(p.parent/target).resolve()
        try:q.relative_to(ROOT.resolve())
        except: errors.append(f"link escapes packet: {p.relative_to(ROOT)} -> {link}"); continue
        req(q.exists(),f"broken link: {p.relative_to(ROOT)} -> {link}")
# Old phase instruction routing must be absent from runtime text.
for p in ROOT.rglob("*"):
    if p.is_file() and p.suffix.lower() in {".md",".json",".py",".sh",".yaml",".yml"}:
        try:t=p.read_text(encoding="utf-8")
        except: continue
        if p.name != "validate_sequential_structure.py" and "references/phase-instructions/" in t: errors.append(f"stale phase-instructions reference: {p.relative_to(ROOT)}")
if errors:
    print("SEQUENTIAL STRUCTURE VALIDATION FAIL"); [print("-",e) for e in errors]; raise SystemExit(1)
print("SEQUENTIAL STRUCTURE VALIDATION PASS - homepage + 11 phase cards + stable universal-rule routing + resolved internal links")
