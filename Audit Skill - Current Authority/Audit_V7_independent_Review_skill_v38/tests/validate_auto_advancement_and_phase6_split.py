#!/usr/bin/env python3
from pathlib import Path
import json,sys
R=Path(__file__).resolve().parents[1]; errs=[]
def req(c,m):
    if not c: errs.append(m)
skill=(R/'SKILL.md').read_text(); auto=(R/'shared/controller/AUTOMATIC_PHASE_ADVANCEMENT_PROTOCOL.md').read_text(); sm=json.loads((R/'shared/controller/SOLO_WORKFLOW_STATE_MACHINE.json').read_text())
for tok in ['no per-phase human approval gate','AUTO_ADVANCE_READY','P6A_TO_P6B','P6B_TO_P6C']:
    req(tok.lower() in (skill+'\n'+auto+json.dumps(sm)).lower(),f'missing {tok}')
# Operative runtime files must have no human-wait state; migration protocol is the one allowed historical reference.
for p in [R/'SKILL.md',R/'shared/controller/AI_Auditor_Controller.md',R/'shared/reporting/PHASE_REPORT.md']+[R/f'phases/phase-{n}/START_HERE.md' for n in range(11)]:
    t=p.read_text(); req('WAITING_FOR_HUMAN_RESPONSE' not in t,f'legacy wait remains {p.relative_to(R)}')
for sp,reviewer,gates in [('6A','reviewer-3A',['P6.0']),('6B','reviewer-3B',['P6.1','P6.2','P6.3','P6.4','P6.5','P6.6']),('6C','reviewer-3C',['P6.7','P6.8'])]:
    c=json.loads((R/f'phases/phase-6/subphases/phase-{sp}/SUBPHASE_CONTRACT.json').read_text())
    req(c['reviewer']==reviewer,f'{sp} reviewer'); req(c['ownedSubgates']==gates,f'{sp} gates'); req(c['humanApprovalRequired'] is False,f'{sp} approval')
compat=(R/'phases/phase-6/resources/PHASE6_V29_COMPATIBILITY_AND_FALLBACK.md').read_text()
for tok in ['UNAVAILABLE_USE_MANUAL_FALLBACK','Never restart completed work','Historical Exploit KB','Accounting-chaos generator','Mutation engine','Automatic coverage-gap analyzer']:
    req(tok in compat,f'compat missing {tok}')
if errs:
 print('AUTO ADVANCEMENT / PHASE6 SPLIT FAIL'); [print('-',e) for e in errs]; raise SystemExit(1)
print('AUTO ADVANCEMENT / PHASE6 SPLIT PASS')
