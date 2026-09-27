#!/usr/bin/env python3
from pathlib import Path
import sys
ROOT=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else Path(__file__).resolve().parents[1]
errs=[]
def req(c,m):
    if not c: errs.append(m)
def read(rel):
    p=ROOT/rel; req(p.is_file(),f'missing {rel}'); return p.read_text(encoding='utf-8') if p.is_file() else ''
skill=read('SKILL.md'); controller=read('shared/controller/AI_Auditor_Controller.md'); phase10=read('phases/phase-10/START_HERE.md')
final=read('phases/phase-10/resources/FINAL_REPORT.md'); assurance=read('phases/phase-10/resources/ASSURANCE_CASE_AND_EVIDENCE_INDEPENDENCE.md'); template=read('phases/phase-10/resources/ASSURANCE_CASE.md')
req('Phase 10 →' in skill,'homepage must route Phase 10')
for token in ['assurance case','material claim','exact release hash','evidence independence']:
    req(token.lower() in (controller+'\n'+phase10).lower(),f'active Phase-10/controller route missing {token}')
for token in ['Security Claims & Assurance Evidence','current sealed evidence','finding','Final report gate']:
    req(token.lower() in final.lower(),f'FINAL_REPORT missing {token}')
for token in ['material claim','threat/failure mode','exact release hash','PROCEDURAL_INDEPENDENCE_ONLY','evidence diversity']:
    req(token.lower() in assurance.lower(),f'assurance reference missing {token}')
for token in ['Claim ID','Claim','Requirement','Threat / failure mode','Argument','Evidence refs','Evidence class','Responsible lens','Exact source identity','Exact release hash','Status','Limitations']:
    req(token.lower() in template.lower(),f'assurance template missing {token}')
if errs:
    print('ASSURANCE CASE CONTRACT FAIL'); [print('-',e) for e in errs]; raise SystemExit(1)
print('ASSURANCE CASE CONTRACT PASS')
