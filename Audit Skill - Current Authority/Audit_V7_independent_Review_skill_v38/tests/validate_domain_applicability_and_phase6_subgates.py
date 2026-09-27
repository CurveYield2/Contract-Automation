#!/usr/bin/env python3
from pathlib import Path
import json,re,sys
root=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else Path(__file__).resolve().parents[1]; errs=[]
def load(rel):
 try:return json.loads((root/rel).read_text())
 except Exception as e: errs.append(f'{rel}: {e}'); return {}
def text(rel):
 try:return (root/rel).read_text()
 except Exception as e: errs.append(f'{rel}: {e}'); return ''
m=load('shared/controller/DOMAIN_APPLICABILITY_MATRIX.json'); r=load('shared/controller/DOMAIN_APPLICABILITY_REGISTRY.json')
if m.get('statusVocabulary')!=['TRIGGERED','NOT_TRIGGERED','UNCERTAIN_INCLUDE']: errs.append('domain status vocabulary')
if len(m.get('domains',[]))!=10 or len(r.get('decisions',[]))!=10: errs.append('expected 10 domain rules/templates')
for ph in [3,4,6,7]:
    if 'DOMAIN_APPLICABILITY_REGISTRY' not in text(f'phases/phase-{ph}/START_HERE.md') and ph!=6: errs.append(f'phase {ph} missing domain registry route')
    if 'domainApplicability' not in load(f'phases/phase-{ph}/PHASE_CONTRACT.json'): errs.append(f'phase {ph} contract missing domain applicability')
s=load('phases/phase-6/resources/PHASE6_SUBGATE_STATE.json'); gs=s.get('subgates',[]); expected=[f'P6.{i}' for i in range(9)]
if [g.get('gateId') for g in gs]!=expected: errs.append('subgate IDs/order')
byid={g.get('gateId'):g for g in gs}; expected_primary={'P6.1':[1],'P6.2':[2],'P6.3':[3,4,7],'P6.4':[5],'P6.5':[6],'P6.6':[8,9,10,11]}
for gid,ps in expected_primary.items():
    if byid.get(gid,{}).get('processes')!=ps: errs.append(f'{gid} process coverage')
if byid.get('P6.7',{}).get('processes')!=[2,3,4,5,6,7,8,9,10,11]: errs.append('P6.7 Foundry coverage')
if byid.get('P6.8',{}).get('processes')!=list(range(1,12)): errs.append('P6.8 Process 1-11 coverage')
for g in gs:
    expected_owner='6A' if g['ordinal']==0 else ('6B' if g['ordinal']<=6 else '6C')
    if g.get('ownerSubphase')!=expected_owner: errs.append(f'{g.get("gateId")} owner mismatch')
contract=load('phases/phase-6/PHASE_CONTRACT.json')
if [g.get('gateId') for g in contract.get('subgates',[])]!=expected: errs.append('contract subgate preservation')
if [x.get('id') for x in contract.get('subphases',[])]!=['6A','6B','6C']: errs.append('phase6 subphase order')
method=text('phases/phase-6/resources/PHASE6_FUZZ_CAMPAIGN_METHODOLOGY.md')
for i in range(1,12):
    mh=re.search(r'^# Process '+str(i)+r' —.*$',method,re.M)
    if not mh: errs.append(f'method process {i} absent')
for rel in ['PHASE6_DYNAMIC_ASSURANCE_PLAN.md','PHASE6_ACCOUNTING_ASSURANCE_MODEL.md','PHASE6_RANDOMIZED_ATTACK_CAMPAIGN_MATRIX.md','PHASE6_KNOWN_ATTACK_DISPOSITION.md','PHASE6_MUTATION_SENSITIVITY_REPORT.md','PHASE6_COVERAGE_GAP_REPORT.md','PHASE6_V29_COMPATIBILITY_AND_FALLBACK.md']:
    if not (root/'phases/phase-6/resources'/rel).is_file(): errs.append(f'missing v29 resource {rel}')
for tok in ['accounting assurance','randomized accounting','known/historical','mutation','coverage-gap']:
    if tok.lower() not in method.lower(): errs.append(f'methodology missing v29 {tok}')
if errs:
 print('DOMAIN APPLICABILITY / PHASE6 SUBGATES FAIL'); [print('-',e) for e in errs]; raise SystemExit(1)
print('DOMAIN APPLICABILITY / PHASE6 SUBGATES PASS')
