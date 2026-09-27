#!/usr/bin/env python3
from pathlib import Path
import json,sys
R=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else Path(__file__).resolve().parents[1]
errs=[]
def req(c,m):
    if not c: errs.append(m)
skill=(R/'SKILL.md').read_text(); sm=json.loads((R/'shared/controller/SOLO_WORKFLOW_STATE_MACHINE.json').read_text()); matrix=json.loads((R/'shared/controller/EVIDENCE_INVALIDATION_MATRIX.json').read_text())
req('never restart a sealed phase' in skill.lower() or 'never restart a sealed phase for convenience' in skill.lower(),'sealed-work reuse invariant')
req('Diagnose, repair, retry' in skill or 'diagnose, repair, retry' in skill,'repair-first invariant')
req(sm.get('actorTopology',{}).get('plannedSuccessorHandoffBoundaries')==['P1_TO_P2','P5_TO_P6','P6A_TO_P6B','P6B_TO_P6C','P6_TO_P7','P8_TO_P9'],'fresh-reviewer boundaries')
p6=next(p for p in sm.get('phases',[]) if p.get('sequence')==6)
req(p6.get('internalSubgatesRequiredInOrder')==[f'P6.{i}' for i in range(9)],'Phase6 subgate order')
req(p6.get('medusaTerminalRequiredBeforeNativeFoundry') is True,'Medusa-before-Foundry invariant')
dm=json.loads((R/'shared/controller/DOMAIN_APPLICABILITY_MATRIX.json').read_text())
req(dm.get('statusVocabulary')==['TRIGGERED','NOT_TRIGGERED','UNCERTAIN_INCLUDE'],'domain applicability invariant')
req(any(r.get('id')=='EIM-001' and r.get('effect')=='INVALIDATES' for r in matrix.get('rules',[])),'source-change invalidation invariant')
proto=(R/'shared/handoff/SUCCESSOR_HANDOFF_PROTOCOL.md').read_text()
req('START_HERE_SUCCESSOR.md' in proto and 'Read the campaign-local `START_HERE_SUCCESSOR.md` first.' in proto,'successor bootstrap-first invariant')
req('No direct **Run workflow** tool does not mean GitHub Actions cannot be run' in (R/'shared/execution/GITHUB_ACTIONS_VIA_GITHUB_APP.md').read_text(),'GitHub Actions event-trigger invariant')
if errs:
    print('BEHAVIORAL INVARIANT VALIDATION FAIL'); [print('-',e) for e in errs]; raise SystemExit(1)
print('BEHAVIORAL INVARIANT VALIDATION PASS')
