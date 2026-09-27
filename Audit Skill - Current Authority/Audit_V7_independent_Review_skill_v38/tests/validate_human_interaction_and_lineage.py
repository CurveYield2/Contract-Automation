#!/usr/bin/env python3
from pathlib import Path
import json,sys
R=Path(__file__).resolve().parents[1]; errs=[]
def req(c,m):
    if not c: errs.append(m)
skill=(R/'SKILL.md').read_text(); sm=json.loads((R/'shared/controller/SOLO_WORKFLOW_STATE_MACHINE.json').read_text())
for tok in ['Execute first; do not bother the human','Mandatory non-blocking work updates','A progress update cannot terminate an active-phase turn','Required process failure is an immediate repair trigger','Required source upload','Phase-8 remediation guidance','Confirmed GitHub connector outage','Automatic post-seal advancement','Do not wait for `CONTINUE`']:
    req(tok.lower() in skill.lower(),f'homepage missing {tok}')
req(sm['actorTopology'].get('reviewer1Phases')==[0,1],'reviewer-1 phases mismatch')
req(sm['actorTopology'].get('reviewer2Phases')==[2,3,4,5],'reviewer-2 phases mismatch')
req(sm['actorTopology'].get('phase6Subreviewers')=={'6A':'reviewer-3A','6B':'reviewer-3B','6C':'reviewer-3C'},'phase6 subreviewer mismatch')
req(sm['actorTopology'].get('reviewer3Phases')==[6],'reviewer-3 phase mismatch')
req(sm['actorTopology'].get('reviewer4Phases')==[7,8],'reviewer-4 phases mismatch')
req(sm['actorTopology'].get('reviewer5Phases')==[9,10],'reviewer-5 phases mismatch')
req(sm['actorTopology'].get('plannedSuccessorHandoffBoundaries')==['P1_TO_P2','P5_TO_P6','P6A_TO_P6B','P6B_TO_P6C','P6_TO_P7','P8_TO_P9'],'handoff boundary mismatch')
gi=sm.get('globalInvariants',{})
for k,v in [('selfAdvanceAllowed',True),('automaticPostSealAdvanceRequired',True),('humanApprovalGateExists',False),('mandatoryNonBlockingWorkUpdates',True),('workUpdateMayTerminateWhileExecutableWorkRemains',False),('humanMayBeUsedAsRoutineTroubleshootingResource',False),('requiredProcessFailureTriggersImmediateRepair',True),('githubRepositoryAccessFallbackAllowed',False),('phase6ThreeFreshSubreviewersRequired',True)]: req(gi.get(k) is v,f'global invariant mismatch {k}')
# Runtime active text must not retain an operative human wait gate; migration protocol may name the legacy token.
for rel in ['SKILL.md','shared/controller/AI_Auditor_Controller.md','shared/reporting/PHASE_REPORT.md']+[f'phases/phase-{n}/START_HERE.md' for n in range(11)]:
    t=(R/rel).read_text(); req('WAITING_FOR_HUMAN_RESPONSE' not in t,f'legacy human wait remains in {rel}'); req('HUMAN_PHASE_GATE_PROTOCOL' not in t,f'legacy human gate link remains in {rel}')
if errs:
 print('HUMAN INTERACTION / LINEAGE VALIDATION FAIL'); [print('-',e) for e in errs]; sys.exit(1)
print('HUMAN INTERACTION / LINEAGE VALIDATION PASS')
