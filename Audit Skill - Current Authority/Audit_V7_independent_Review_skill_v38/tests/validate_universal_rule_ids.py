#!/usr/bin/env python3
from pathlib import Path
import json,re,sys
R=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else Path(__file__).resolve().parents[1]
errs=[]
def req(c,m):
    if not c: errs.append(m)
reg=json.loads((R/'shared/policy/UNIVERSAL_RULE_REGISTRY.json').read_text())
ids=[r['id'] for r in reg.get('rules',[])]
expected=['U-EXEC-001','U-GITHUB-001','U-STATE-001','U-EVIDENCE-001','U-REPAIR-001','U-HUMAN-001','U-DISCLOSURE-001','U-SOURCEINTEL-001','U-UPDATES-001','U-HUMANCOMMS-001']
req(ids==expected,'universal rule registry IDs/order')
skill=(R/'SKILL.md').read_text()
for rid in expected: req(rid in skill,f'homepage missing {rid}')
for n in range(11):
    card=(R/f'phases/phase-{n}/START_HERE.md').read_text()
    req('UNIVERSAL RULE IDS' in card,f'phase {n} missing rule-ID header')
    req('GITHUB ACCESS HARD RULE' not in card,f'phase {n} duplicates GitHub universal prose')
    c=json.loads((R/f'phases/phase-{n}/PHASE_CONTRACT.json').read_text())
    req(c.get('universalRuleIds')==expected,f'phase {n} contract rule IDs')
if errs:
    print('UNIVERSAL RULE ID VALIDATION FAIL'); [print('-',e) for e in errs]; raise SystemExit(1)
print('UNIVERSAL RULE ID VALIDATION PASS')
