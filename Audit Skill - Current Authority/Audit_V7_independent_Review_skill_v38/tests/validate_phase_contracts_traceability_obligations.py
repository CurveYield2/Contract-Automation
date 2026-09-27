#!/usr/bin/env python3
from pathlib import Path
import json,re,sys
ROOT=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else Path(__file__).resolve().parents[1]
errs=[]
def req(c,m):
    if not c: errs.append(m)
def load(rel):
    p=ROOT/rel; req(p.is_file(),f'missing {rel}')
    if not p.is_file(): return None
    try:return json.loads(p.read_text(encoding='utf-8'))
    except Exception as e: errs.append(f'invalid JSON {rel}: {e}'); return None
schema=load('shared/controller/PHASE_CONTRACT_SCHEMA.json')
graph=load('shared/controller/SECURITY_TRACEABILITY_GRAPH.json')
obl=load('shared/controller/CARRIED_FORWARD_OBLIGATION_LEDGER.json')
req(schema and schema.get('$id')=='audit-v7-phase-contract-v1','phase contract schema identity')
req(graph and graph.get('artifactId')=='SECURITY_TRACEABILITY_GRAPH','traceability graph identity')
req(obl and obl.get('artifactId')=='CARRIED_FORWARD_OBLIGATION_LEDGER','obligation ledger identity')
for tok in ['Every material PROP-*','Every material HYP-*','Every CAND-*','Every validated FIND-*','Every material final CLAIM-*']:
    req(any(tok in x for x in (graph or {}).get('completenessRules',[])),f'graph missing completeness rule {tok}')
for tok in ['OPEN or IN_PROGRESS','BLOCKED_CARRIED','stable OBL-*']:
    req(any(tok in x for x in (obl or {}).get('sealingRules',[])),f'obligation ledger missing sealing rule {tok}')
sm=load('shared/controller/SOLO_WORKFLOW_STATE_MACHINE.json') or {}
for ph in sm.get('phases',[]):
    n=ph['sequence']; rel=f'phases/phase-{n}/PHASE_CONTRACT.json'; c=load(rel) or {}
    req(c.get('schemaVersion')=='audit-v7-phase-contract-v1',f'phase {n} contract schema')
    req(c.get('phase',{}).get('sequence')==n,f'phase {n} contract sequence')
    req(c.get('phase',{}).get('reviewerLineage')==ph.get('reviewerLineage'),f'phase {n} reviewer mismatch')
    req(len(c.get('steps',[]))>=1,f'phase {n} contract steps')
    card_path=ROOT/f'phases/phase-{n}/START_HERE.md'
    card=card_path.read_text(encoding='utf-8')
    card_rows=[]
    for line in card.splitlines():
        m=re.match(r'^\|\s*(\d+)\s*\|\s*\*\*(.*?)\*\*\s*\|',line)
        if m: card_rows.append((int(m.group(1)),m.group(2).strip()))
    contract_rows=[(x.get('step'),x.get('action')) for x in c.get('steps',[])]
    req(contract_rows==card_rows,f'phase {n} contract/card step mismatch: {contract_rows} != {card_rows}')
    for step in c.get('steps',[]):
        for r in step.get('resources',[]):
            if r.startswith(('http://','https://','#')): continue
            target=(card_path.parent/r.split('#',1)[0]).resolve()
            req(target.exists(),f'phase {n} contract resource missing: {r}')
    req(ph.get('phaseContract')==rel,f'phase {n} state machine contract routing')
    req(ph.get('phaseContractRequiredBeforePhaseWork') is True,f'phase {n} contract not hard gate')
    req(ph.get('securityTraceabilityGraphCheckpointRequiredBeforeEvidenceSealed') is True,f'phase {n} graph not sealing gate')
    req(ph.get('carriedForwardObligationCheckpointRequiredBeforeEvidenceSealed') is True,f'phase {n} obligation not sealing gate')
    req('PHASE CONTRACT HARD GATE' in card and 'PHASE_CONTRACT.json' in card,f'phase {n} card missing contract gate')
    req('Reconcile campaign-global security state' in card,f'phase {n} card missing global reconciliation step')
    req('SECURITY_TRACEABILITY_GRAPH' in json.dumps(c),f'phase {n} contract missing graph')
    req('CARRIED_FORWARD_OBLIGATION_LEDGER' in json.dumps(c),f'phase {n} contract missing obligations')
report=(ROOT/'shared/reporting/PHASE_REPORT.md').read_text(encoding='utf-8')
for tok in ['Campaign-global security traceability checkpoint','Campaign-global obligation checkpoint','must be 0 before EVIDENCE_SEALED']:
    req(tok in report,f'phase report missing {tok}')
ctl=(ROOT/'shared/controller/AI_Auditor_Controller.md').read_text(encoding='utf-8')
for tok in ['Machine-readable phase contracts','SECURITY_TRACEABILITY_GRAPH','CARRIED_FORWARD_OBLIGATION_LEDGER','OPEN` or `IN_PROGRESS']:
    req(tok in ctl,f'controller missing {tok}')
profiles=load('shared/handoff/SUCCESSOR_HANDOFF_BOUNDARY_PROFILES.json') or {}
req(set(profiles.get('profiles',{}))=={'P1_TO_P2','P5_TO_P6','P6A_TO_P6B','P6B_TO_P6C','P6_TO_P7','P8_TO_P9'},'generic successor profiles missing')
proto=(ROOT/'shared/handoff/SUCCESSOR_HANDOFF_PROTOCOL.md').read_text(encoding='utf-8')
req('Security Traceability Graph' in proto and 'Carried-Forward Obligation Ledger' in proto and 'Domain Applicability Registry' in proto,'generic handoff missing global state transfer')
matrix=load('shared/controller/EVIDENCE_INVALIDATION_MATRIX.json') or {}
req(matrix.get('artifactId')=='EVIDENCE_INVALIDATION_MATRIX','invalidation matrix identity')
report=(ROOT/'shared/reporting/PHASE_REPORT.md').read_text(encoding='utf-8')
req('Evidence invalidation event reconciliation' in report,'phase report missing invalidation event reconciliation')
if errs:
    print('PHASE CONTRACT / TRACEABILITY / OBLIGATION VALIDATION FAIL')
    [print('-',e) for e in errs]
    raise SystemExit(1)
print('PHASE CONTRACT / TRACEABILITY / OBLIGATION VALIDATION PASS')
