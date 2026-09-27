#!/usr/bin/env python3
from pathlib import Path
import re,sys
R=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else Path(__file__).resolve().parents[1]
errs=[]
def req(c,m):
    if not c: errs.append(m)
p=R/'tests/PRESSURE_SCENARIOS.md'; req(p.is_file(),'missing consolidated pressure corpus')
text=p.read_text() if p.is_file() else ''
ids=re.findall(r'^###\s+([A-Z][A-Z0-9_-]*-\d{3})\b',text,re.M)
req(len(ids)>=60,'pressure corpus unexpectedly small')
req(len(ids)==len(set(ids)),'duplicate pressure scenario IDs')
req(not list((R/'tests').glob('PRESSURE_SCENARIOS_v*.md')),'versioned pressure scenario siblings remain')
for tok in ['INVALIDATION-001','SUCCESSOR-001','RULE-001','FUZZ-012','LINEAGE-008','HANDOFF-012']:
    req(tok in ids,f'missing regression scenario {tok}')
req('PDF-layout-only scenarios were intentionally retired' in text,'retirement note missing')
if errs:
    print('REGRESSION CORPUS VALIDATION FAIL'); [print('-',e) for e in errs]; raise SystemExit(1)
print(f'REGRESSION CORPUS VALIDATION PASS - {len(ids)} stable scenarios')
