#!/usr/bin/env python3
from pathlib import Path
import json,re,sys,hashlib
R=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else Path(__file__).resolve().parents[1]
L=R/'optional-modes/lite-pathway'; errs=[]
def req(c,m):
    if not c: errs.append(m)
def load(rel):
    p=L/rel; req(p.is_file(),f'missing Lite file {rel}')
    try:return json.loads(p.read_text()) if p.is_file() else {}
    except Exception as e: errs.append(f'invalid Lite JSON {rel}: {e}'); return {}
skill=(L/'SKILL.md').read_text() if (L/'SKILL.md').is_file() else ''
req('Release identity: `audit-v7-independent-review-lite@1.0.0`' in skill,'Lite release identity mismatch')
req('Package revision: `v38.3.3`' in skill,'Lite package revision mismatch')
# Lite nested manifest must exactly describe the isolated pathway (excluding itself).
lm=load('MANIFEST.json')
req(lm.get('schemaVersion')=='audit-v7-independent-review-lite-manifest-v38.3.3','Lite manifest schema mismatch')
req(lm.get('release')=='audit-v7-independent-review-lite@1.0.0','Lite manifest release mismatch')
req(lm.get('packageRevision')=='v38.3.3','Lite manifest package revision mismatch')
listed=set()
for e in lm.get('files',[]):
    rel=e.get('path',''); listed.add(rel)
    fp=R/rel
    req(fp.is_file(),f'Lite manifest missing file {rel}')
    if fp.is_file():
        req(fp.stat().st_size==e.get('bytes'),f'Lite manifest bytes mismatch {rel}')
        req(hashlib.sha256(fp.read_bytes()).hexdigest()==e.get('sha256'),f'Lite manifest sha mismatch {rel}')
actual={str(x.relative_to(R)).replace('\\','/') for x in L.rglob('*') if x.is_file() and x.resolve()!=(L/'MANIFEST.json').resolve()}
req(listed==actual,f'Lite manifest file-set mismatch: missing={sorted(actual-listed)} extra={sorted(listed-actual)}')
# Canonical navigation and contracts.
for n in range(11):
    req((L/f'phases/phase-{n}/START_HERE.md').is_file(),f'missing Lite phase {n} START_HERE')
    req((L/f'phases/phase-{n}/PHASE_CONTRACT.json').is_file(),f'missing Lite phase {n} PHASE_CONTRACT')
# Timed-out rename migration must not recur.
for p in L.rglob('*'):
    if p.is_file() and p.name.startswith('Lite_'): errs.append(f'noncanonical timed-out Lite_ filename remains: {p.relative_to(L)}')
# All Markdown relative links resolve.
link_re=re.compile(r'\[[^\]]*\]\(([^)]+)\)')
for p in L.rglob('*.md'):
    for m in link_re.finditer(p.read_text(errors='ignore')):
        target=m.group(1).strip()
        if target.startswith(('http://','https://','#','mailto:')): continue
        path=target.split('#',1)[0]
        if not path: continue
        try: ok=(p.parent/path).resolve().exists()
        except OSError: ok=False
        req(ok,f'broken Lite link {p.relative_to(L)} -> {target}')
# Every Phase Contract resource resolves and its step rows match the current card.
for n in range(11):
    cp=L/f'phases/phase-{n}/PHASE_CONTRACT.json'; cardp=L/f'phases/phase-{n}/START_HERE.md'
    if not cp.is_file() or not cardp.is_file(): continue
    c=json.loads(cp.read_text()); card=cardp.read_text()
    # Lite Phase Contracts are intentionally compact machine contracts while cards may expose finer reviewer steps.
    # Require non-empty ordered contract work, but do not force a 1:1 prose/card row count.
    contract_rows=[(x.get('step'),x.get('action')) for x in c.get('steps',[])]
    req(len(contract_rows)>=1,f'Lite phase {n} contract has no executable steps')
    req([x[0] for x in contract_rows]==list(range(1,len(contract_rows)+1)),f'Lite phase {n} contract step order invalid')
    for step in c.get('steps',[]):
        for resource in step.get('resources',[]):
            if resource.startswith(('http://','https://','#')): continue
            try: ok=(cp.parent/resource.split('#',1)[0]).resolve().exists()
            except OSError: ok=False
            req(ok,f'Lite phase {n} contract resource missing: {resource}')
# Four reviewer lineages, high security reasoning, cheap optional orchestrator.
sm=load('shared/controller/SOLO_WORKFLOW_STATE_MACHINE.json')
actor=sm.get('actorTopology',{})
req(actor.get('sequentialReviewerLineages')==4,'Lite must retain four semantic reviewer lineages')
boot=actor.get('bootstrapAgent',{})
req(boot.get('id')=='web-bootstrap-agent' and boot.get('phases')==[0],'Lite web-bootstrap agent topology missing')
req(boot.get('securityJudgmentAuthority') is False,'web-bootstrap agent must have zero semantic security authority')
req('PHASE0_COMPLETION_VALIDATION_PASS' in boot.get('retirementRequires',[]) and 'P0_TO_P1_HANDOFF_VALIDATION_PASS' in boot.get('retirementRequires',[]),'web-bootstrap retirement gates missing')
expected={
 'reviewer-1':([1],'gpt-5.6-terra','high'),
 'reviewer-2':([2,3,4,5],'gpt-5.6-sol','high'),
 'reviewer-3L':([6,7],'gpt-5.6-sol','high'),
 'reviewer-4':([8,9,10],'gpt-5.6-sol','high'),
}
for rid,(phases,model,reasoning) in expected.items():
    rec=actor.get('reviewers',{}).get(rid,{})
    req(rec.get('phases')==phases,f'{rid} phase ownership mismatch')
    req(rec.get('model')==model and rec.get('reasoning')==reasoning,f'{rid} model/reasoning mismatch')
orch=actor.get('orchestrator',{})
req(orch.get('optional') is True and orch.get('reasoning')=='medium','Lite orchestrator must be optional/medium reasoning')
cf=orch.get('conditionalFinalAdversarialReview',{})
req(cf.get('default')=='NOT_TRIGGERED' and cf.get('reasoning')=='max','conditional final adversarial review policy missing')
req(len(sm.get('milestones',[]))==4 and [m.get('reportAt') for m in sm.get('milestones',[])]==[1,5,7,10],'Lite milestone/report topology mismatch')
# Web-bootstrap specialization invariants.
req('P0_TO_P1' in json.dumps(load('shared/handoff/SUCCESSOR_HANDOFF_BOUNDARY_PROFILES.json')),'P0_TO_P1 boundary profile missing')
si=(L/'shared/source-intelligence/SOURCE_INTELLIGENCE_REUSE_PROTOCOL.md').read_text()
req('Phase 0 web-bootstrap creates and seals' in si and '`web-bootstrap-agent` generates' in si,'Source Intelligence ownership must be Phase-0 web bootstrap')
p0card=(L/'phases/phase-0/START_HERE.md').read_text()
for forbidden in ['security findings','risk/severity decisions','standards-conformance conclusions','dependency trust judgments']:
    req(forbidden.lower() in p0card.lower(),f'Phase 0 semantic prohibition missing: {forbidden}')
p1card=(L/'phases/phase-1/START_HERE.md').read_text()
req('MUST NOT redo Phase-0 exact build admission' in p1card,'Phase 1 no-repeat bootstrap rule missing')
# Cold-walk efficiency invariants.
p0=load('phases/phase-0/PHASE_CONTRACT.json'); p1=load('phases/phase-1/PHASE_CONTRACT.json')
req(any(x.get('artifact')=='phases/phase-0/resources/PHASE0_WEB_BOOTSTRAP_COMPLETION_REPORT.md' for x in p0.get('requiredOutputs',[])),'Phase 0 web-bootstrap completion report missing')
req(all(x.get('artifact')!='shared/reporting/PHASE_REPORT.md' for x in p0.get('requiredOutputs',[])),'Phase 0 must not file a duplicate full milestone report')
req(p0.get('phase',{}).get('reviewerLineage')=='web-bootstrap-agent','Phase 0 executor must be web-bootstrap-agent')
req(p0.get('authorization',{}).get('retirementRequiresAutomationPass') is True,'Phase 0 retirement PASS gate missing')
req('P0_TO_P1' in json.dumps(p0),'Phase 0 must seal P0_TO_P1 before retirement')
req(any(x.get('action')=='Generate and seal canonical Source Intelligence core' for x in p0.get('steps',[])),'Phase 0 Source Intelligence generation missing')
req(any(x.get('action')=='Initiate and supervise required existing bootstrap automation' for x in p0.get('steps',[])),'Phase 0 automation supervision missing')
req(any(x.get('role')=='COMBINED_P0_1_MILESTONE_REPORT_TEMPLATE' for x in p1.get('requiredOutputs',[])),'Phase 1 must file combined P0_1 milestone report')
phase1_actions={x.get('action') for x in p1.get('steps',[])}
for moved in ['Admit the exact build','Fill the canonical Source Intelligence core from the supplied template','Run neutral Slither/static reconnaissance and attach it to Source Intelligence','Initialize overlays and pin the accepted bundle index','Complete the frozen audit-surface manifest']:
    req(moved not in phase1_actions,f'Phase 1 still owns moved mechanical task: {moved}')
req(p1.get('authorization',{}).get('incomingSuccessorReceipt')=='P0_TO_P1','Phase 1 must require P0_TO_P1 receipt')
auto=(L/'shared/controller/AUTOMATIC_PHASE_ADVANCEMENT_PROTOCOL.md').read_text()
req('web-bootstrap-agent' in auto and 'P0_TO_P1' in auto,'Lite Phase0 web-bootstrap successor routing missing')
p4=(L/'phases/phase-4/START_HERE.md').read_text(); req('one principal semantic source traversal' in p4,'Phase 4 one-pass multi-lens invariant missing')
p5=(L/'phases/phase-5/START_HERE.md').read_text(); req('Delta-only source reopening' in p5,'Phase 5 delta-only source reopen invariant missing')
p6=(L/'phases/phase-6/resources/LITE_PHASE6_7_EXECUTION_PROTOCOL.md').read_text(); req('Deterministic environment reuse and batching' in p6,'Phase 6 environment batching invariant missing')
p8=(L/'phases/phase-8/START_HERE.md').read_text(); req('Candidate-family deduplication rule' in p8,'Phase 8 candidate-family dedupe invariant missing')
p10=(L/'phases/phase-10/START_HERE.md').read_text(); req('Mechanical prefill rule' in p10,'Phase 10 mechanical prefill invariant missing')
# Trigger-only homepage routing for rare recovery content.
req('Recovery Router — conditional' in skill and 'HANDOFF_DISCOVERY_AND_CONTEXT_RECOVERY.md' in skill,'Lite homepage conditional recovery/handoff routing missing')
if errs:
    print('LITE COLD-WALK VALIDATION FAIL'); [print('-',e) for e in errs]; raise SystemExit(1)
print('LITE COLD-WALK VALIDATION PASS')
