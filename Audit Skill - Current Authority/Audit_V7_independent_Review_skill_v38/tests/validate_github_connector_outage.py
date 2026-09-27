from pathlib import Path
import json,sys
R=Path(__file__).resolve().parents[1]
errs=[]
def req(c,m):
    if not c: errs.append(m)
skill=(R/'SKILL.md').read_text()
proto=(R/'shared/controller/AUDIT_CONTROLLER_AND_GITHUB_PROTOCOL.md').read_text()
ops=(R/'shared/lenses/operations-recovery-lens.md').read_text()
p0=(R/'phases/phase-0/START_HERE.md').read_text()
pre=(R/'phases/phase-0/resources/PHASE0_CAPABILITY_PREFLIGHT.md').read_text()
sm=json.loads((R/'shared/controller/SOLO_WORKFLOW_STATE_MACHINE.json').read_text())
for tok in ['mandatory GitHub connector outage report','continue every unaffected','Do not substitute another repository interface']:
    req(tok.lower() in skill.lower(),f'homepage missing outage rule: {tok}')
for tok in ['GitHub connector outage recovery and mandatory human report','PROCESS_BLOCKER_RECEIPT.json','CurveYield2/Audit-Controller','CurveYield2/Contract-Automation','outage report is not a stopping point']:
    req(tok.lower() in proto.lower(),f'protocol missing: {tok}')
req('mandatory' in ops.lower() and 'outage report' in ops.lower(),'operations lens missing mandatory outage report')
req('successful live connector reads against both required repositories' in p0,'Phase 0 card missing live connector proof')
req('GitHub connector app — live read of `CurveYield2/Audit-Controller`' in pre,'preflight missing controller repo live read')
req('GitHub connector app — live read of `CurveYield2/Contract-Automation`' in pre,'preflight missing automation repo live read')
gi=sm.get('globalInvariants',{})
for k,v in [('githubConnectorFailureTriggersImmediateRecovery',True),('githubConnectorOutageReportRequiredAfterRecoveryExhaustion',True),('githubConnectorOutageReportDoesNotPauseUnaffectedWork',True),('githubRepositoryAccessFallbackAllowed',False)]:
    req(gi.get(k) is v,f'state invariant mismatch: {k}')
if errs:
    print('GITHUB CONNECTOR OUTAGE VALIDATION FAIL'); [print('-',e) for e in errs]; sys.exit(1)
print('GITHUB CONNECTOR OUTAGE VALIDATION PASS')
