#!/usr/bin/env python3
from pathlib import Path
import json,sys
R=Path(__file__).resolve().parents[1]; errs=[]
def req(c,m):
    if not c: errs.append(m)
report=(R/'shared/reporting/PHASE_REPORT.md').read_text()
for tok in ['Canonical outputs created','New canonical audit facts','Carried-forward obligations','Evidence invalidation triggers','Automatic next transition','Advancement checkpoint','AUTO_ADVANCE_READY']:
    req(tok in report,f'Phase report missing {tok}')
for n in range(11):
    card=(R/f'phases/phase-{n}/START_HERE.md').read_text()
    req('WAITING_FOR_HUMAN_RESPONSE' not in card,f'Phase {n} still waits for human')
    c=json.loads((R/f'phases/phase-{n}/PHASE_CONTRACT.json').read_text())
    req(c.get('authorization',{}).get('humanApprovalRequired') is False,f'Phase {n} contract still requires approval')
    req(c.get('authorization',{}).get('automaticAdvanceAfterSeal') is True,f'Phase {n} contract missing auto advance')
if errs:
 print('PHASE REPORTING VALIDATION FAIL'); [print('-',e) for e in errs]; sys.exit(1)
print('PHASE REPORTING VALIDATION PASS')
