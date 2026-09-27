#!/usr/bin/env python3
from pathlib import Path
import sys
ROOT=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else Path(__file__).resolve().parents[1]
errors=[]
def req(c,m):
    if not c: errors.append(m)
def read(rel):
    p=ROOT/rel; req(p.is_file(),f'missing {rel}'); return p.read_text(encoding='utf-8') if p.is_file() else ''
final=read('phases/phase-10/resources/FINAL_REPORT.md')
supp=read('phases/phase-10/resources/FINAL_REPORT_SUPPLEMENT.md')
phase10=read('phases/phase-10/START_HERE.md')
reportmod=read('phases/phase-10/resources/audit-modules/report-assurance-case.md')
phase1=read('phases/phase-1/START_HERE.md')
phase6=read('phases/phase-6/START_HERE.md')
pressure=read('tests/PRESSURE_SCENARIOS.md')
for token in ['Audit Methodology & Security Processes','Security Claims & Assurance Evidence','Final report gate']:
    req(token.lower() in final.lower(),f'FINAL_REPORT missing {token}')
combined='\n'.join([supp,phase10,reportmod])
for token in ['Audit Methodology & Security Processes','Slither','Medusa','finalization']:
    req(token.lower() in combined.lower(),f'Phase-10 reporting route missing methodology token {token}')
req(('native foundry' in combined.lower()) or ('native fuzz' in combined.lower()),'Phase-10 reporting route missing native fuzz/Foundry methodology requirement')
req('slither' in phase1.lower(),'Phase 1 card must explicitly route neutral Slither work')
req('medusa' in phase6.lower() and ('foundry' in phase6.lower() or 'native fuzz' in phase6.lower()),'Phase 6 card must route both fuzz engines')
for token in ['manual','economic','purpose','execution status','quantitative','limitations']:
    req(token.lower() in supp.lower(),f'current supplement missing methodology detail {token}')
req('phase table' in supp.lower() and ('insufficient' in supp.lower() or 'alone' in supp.lower()),'supplement must say phase table is insufficient')
req('Final report is concise but omits methodology details' in pressure,'pressure scenario for methodology omission missing')
if errors:
    print('FINAL REPORT METHODOLOGY CONTRACT FAILED'); [print('-',e) for e in errors]; raise SystemExit(1)
print('FINAL REPORT METHODOLOGY CONTRACT PASS')
