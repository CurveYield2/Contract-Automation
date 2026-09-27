#!/usr/bin/env python3
from pathlib import Path
import json,re,sys
ROOT=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else Path(__file__).resolve().parents[1]
errors=[]
def req(c,m):
    if not c: errors.append(m)
def read(rel):
    p=ROOT/rel; req(p.is_file(),f"missing {rel}"); return p.read_text(encoding='utf-8') if p.is_file() else ''
skill=read('SKILL.md')
req(skill.startswith('---\nname: audit-v7-independent-review\n'),'frontmatter name mismatch')
req('Release identity: `audit-v7-independent-review@1.32.0`' in skill,'release mismatch')
req('Package revision: `v38.3.3`' in skill,'package revision mismatch')
for token in ['GitHub connector app only','CurveYield2/Audit-Controller','CurveYield2/Contract-Automation','.deep-assurance/active/','campaigns/','docs/agent-guides/','AUTO_ADVANCE_READY','PROCEDURAL_INDEPENDENCE_ONLY','Phase 6A','Phase 6B','Phase 6C']:
    req(token.lower() in skill.lower(),f'SKILL missing universal control: {token}')
for n in range(11): req((ROOT/f'phases/phase-{n}/START_HERE.md').is_file(),f'missing Phase {n} card')
for sp in ['6A','6B','6C']:
    req((ROOT/f'phases/phase-6/subphases/phase-{sp}/START_HERE.md').is_file(),f'missing Phase {sp} card')
    req((ROOT/f'phases/phase-6/subphases/phase-{sp}/SUBPHASE_CONTRACT.json').is_file(),f'missing Phase {sp} contract')
req(not (ROOT/'references/phase-instructions').exists(),'old phase-instructions directory must not remain')
req(not (ROOT/'shared/controller/HUMAN_PHASE_GATE_PROTOCOL.md').exists(),'obsolete human phase gate protocol must be removed')
req(not (ROOT/'shared/reporting/HUMAN_PHASE_RESPONSE.json').exists(),'obsolete human phase response schema must be removed')
req((ROOT/'shared/controller/AUTOMATIC_PHASE_ADVANCEMENT_PROTOCOL.md').is_file(),'missing automatic advancement protocol')
sm=json.loads(read('shared/controller/SOLO_WORKFLOW_STATE_MACHINE.json') or '{}')
req(sm.get('processId')=='audit-v7-independent-review','state-machine process mismatch')
req(len(sm.get('phases',[]))==11,'must have 11 numbered phases')
req(sm.get('navigation',{}).get('progressiveDisclosureRequired') is True,'progressive disclosure not enforced')
req(sm.get('navigation',{}).get('githubRepositoryAccessMethod')=='GITHUB_CONNECTOR_APP_ONLY','GitHub connector-only rule missing')
gi=sm.get('globalInvariants',{})
req(gi.get('selfAdvanceAllowed') is True,'validated automatic advance must be enabled')
req(gi.get('automaticPostSealAdvanceRequired') is True,'automatic post-seal advance missing')
req(gi.get('humanApprovalGateExists') is False,'human approval gate must be disabled')
req(gi.get('successorHandoffRequiredAtBoundaries')==['P1_TO_P2','P5_TO_P6','P6A_TO_P6B','P6B_TO_P6C','P6_TO_P7','P8_TO_P9'],'successor boundary invariant mismatch')
for ph in sm.get('phases',[]):
    n=ph.get('sequence'); req(ph.get('phaseCard')==f'phases/phase-{n}/START_HERE.md',f'phase {n} card route mismatch')
    req(ph.get('phaseReportTemplate')=='shared/reporting/PHASE_REPORT.md',f'phase {n} report route mismatch')
for p in ROOT.rglob('*.json'):
    try: json.loads(p.read_text(encoding='utf-8'))
    except Exception as e: errors.append(f'invalid JSON {p.relative_to(ROOT)}: {e}')
for base in [ROOT/'shared',ROOT/'phases',ROOT/'docs',ROOT/'profiles',ROOT/'tools']:
    if not base.exists(): continue
    for p in base.rglob('*'):
        if p.is_file() and re.search(r'(?:_v|-v)\d+(?=\.[^.]+$)',p.name,re.I): errors.append(f'versioned active runtime filename remains: {p.relative_to(ROOT)}')
for tok in ['Mandatory non-blocking work updates','do not bother the human','required process failure is an immediate repair trigger','reviewer-3A','reviewer-3B','reviewer-3C','reviewer-4','reviewer-5']:
    req(tok.lower() in skill.lower() or tok in json.dumps(sm),f'missing v31 control {tok}')
severity=(ROOT/'shared/policy/SEVERITY_CALIBRATION.md').read_text(encoding='utf-8')
for tok in ['0.5% of total deposited funds','5% of annual strategy yield generated from deposits','5% or more of the total deposited funds','total or near-total loss of deposited value','Critical overrides High','High overrides Medium']:
    req(tok in severity,f'missing v31 severity threshold {tok}')
if errors:
    print('VALIDATION FAILED'); [print('-',e) for e in errors]; raise SystemExit(1)
print('Audit V7 v38.3.3 validation PASS')
