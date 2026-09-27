#!/usr/bin/env python3
from pathlib import Path
import sys
root=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else Path(__file__).resolve().parents[1]
errs=[]
guide=root/'shared/execution/GITHUB_ACTIONS_VIA_GITHUB_APP.md'
if not guide.is_file(): errs.append('missing GitHub Actions guide')
else:
    g=guide.read_text(encoding='utf-8')
    for token in ['workflow_dispatch','pull_request','issues:','issue_comment','DIAGNOSE → REPAIR → RETRY → VERIFY','DESIGN AGENT-OPERABLE TRIGGER']:
        if token not in g: errs.append(f'guide missing {token}')
for rel in [
    'shared/execution/TECHNICAL_EXECUTION_REQUEST_PLAYBOOK.md',
    'shared/execution/EXECUTION_PREFLIGHT_AND_REPAIR_PROTOCOL.md',
    'phases/phase-0/START_HERE.md','phases/phase-1/START_HERE.md','phases/phase-6/START_HERE.md','phases/phase-7/START_HERE.md','phases/phase-9/START_HERE.md']:
    p=root/rel
    if not p.is_file() or 'GITHUB_ACTIONS_VIA_GITHUB_APP.md' not in p.read_text(encoding='utf-8'):
        errs.append(f'missing Actions-guide routing in {rel}')
skill=(root/'SKILL.md').read_text(encoding='utf-8')
if 'absence of a direct `workflow_dispatch` tool means Actions are unavailable' not in skill:
    errs.append('homepage missing workflow-dispatch clarification')
if errs:
    print('GITHUB ACTIONS GUIDE FAIL')
    [print('-',e) for e in errs]
    raise SystemExit(1)
print('GITHUB ACTIONS GUIDE PASS')
