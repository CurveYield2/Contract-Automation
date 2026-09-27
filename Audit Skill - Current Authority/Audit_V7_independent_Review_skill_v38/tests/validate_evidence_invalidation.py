#!/usr/bin/env python3
from pathlib import Path
import json,sys
R=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else Path(__file__).resolve().parents[1]
errs=[]
def req(c,m):
    if not c: errs.append(m)
def load(rel):
    try:return json.loads((R/rel).read_text())
    except Exception as e: errs.append(f'{rel}: {e}'); return {}
m=load('shared/controller/EVIDENCE_INVALIDATION_MATRIX.json')
req(m.get('artifactId')=='EVIDENCE_INVALIDATION_MATRIX','matrix identity')
rules=m.get('rules',[]); ids=[x.get('id') for x in rules]
req(len(rules)>=13 and len(ids)==len(set(ids)),'matrix rules/IDs')
for eid in ['EIM-001','EIM-002','EIM-003','EIM-004','EIM-005','EIM-006','EIM-008','EIM-010','EIM-012']:
    req(eid in ids,f'missing {eid}')
req(set(m.get('effectClasses',{}))=={'INVALIDATES','REQUIRES_REBIND','RECONCILE_ONLY','PRESERVES'},'effect classes')
g=load('shared/controller/SECURITY_TRACEABILITY_GRAPH.json')
req(g.get('nodeIdFamilies',{}).get('INVALIDATION_EVENT')=='INV-*','graph missing INV family')
for tok in ['INVALIDATES','REPLACES','REBIND_REQUIRED_FOR']:
    req(tok in g.get('allowedEdgeTypes',[]),f'graph missing edge {tok}')
for n in range(11):
    c=load(f'phases/phase-{n}/PHASE_CONTRACT.json')
    chk=c.get('globalControlCheckpoints',{}).get('evidenceInvalidationMatrix',{})
    req(chk.get('requiredBeforeEvidenceSealed') is True,f'phase {n} matrix not sealing gate')
    req(any('EVIDENCE_INVALIDATION_MATRIX' in x for x in c.get('inputs',{}).get('required',[])),f'phase {n} matrix not required input')
report=(R/'shared/reporting/PHASE_REPORT.md').read_text()
for tok in ['Evidence invalidation event reconciliation','NO_MATERIAL_CHANGE_EVENT','INV-* ID / event']:
    req(tok in report,f'phase report missing {tok}')
if errs:
    print('EVIDENCE INVALIDATION VALIDATION FAIL'); [print('-',e) for e in errs]; raise SystemExit(1)
print('EVIDENCE INVALIDATION VALIDATION PASS')
