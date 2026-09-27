#!/usr/bin/env python3
from pathlib import Path
import json,sys
R=Path(__file__).resolve().parents[1]; errs=[]
def req(c,m):
    if not c: errs.append(m)
def load(rel):
    p=R/rel; req(p.is_file(),f'missing {rel}')
    try:return json.loads(p.read_text()) if p.is_file() else {}
    except Exception as e: errs.append(f'invalid {rel}: {e}'); return {}
for rel in ['shared/handoff/SUCCESSOR_HANDOFF_PROTOCOL.md','shared/handoff/SUCCESSOR_HANDOFF_SCHEMA.json','shared/handoff/SUCCESSOR_HANDOFF_RECEIPT_SCHEMA.json','shared/handoff/SUCCESSOR_HANDOFF_TEMPLATE.json','shared/handoff/SUCCESSOR_HANDOFF_RECEIPT_TEMPLATE.json','shared/handoff/SUCCESSOR_HANDOFF_RECEPTION_CHECKLIST.md','shared/handoff/SUCCESSOR_HANDOFF_BOUNDARY_PROFILES.json','shared/handoff/START_HERE_SUCCESSOR_TEMPLATE.md','shared/handoff/WAKE_UP_MESSAGE_TEMPLATE.md']:
    req((R/rel).is_file(),f'missing generic handoff artifact {rel}')
profiles=load('shared/handoff/SUCCESSOR_HANDOFF_BOUNDARY_PROFILES.json').get('profiles',{})
expected={
 'P1_TO_P2':(1,2,'reviewer-1','reviewer-2'),
 'P5_TO_P6':(5,6,'reviewer-2','reviewer-3A'),
 'P6A_TO_P6B':(6,6,'reviewer-3A','reviewer-3B'),
 'P6B_TO_P6C':(6,6,'reviewer-3B','reviewer-3C'),
 'P6_TO_P7':(6,7,'reviewer-3C','reviewer-4'),
 'P8_TO_P9':(8,9,'reviewer-4','reviewer-5')}
req(set(profiles)==set(expected),'boundary profiles mismatch')
for pid,(fp,tp,out,inc) in expected.items():
    p=profiles.get(pid,{})
    req((p.get('fromPhase'),p.get('toPhase'),p.get('outgoingReviewer'),p.get('incomingReviewer'))==(fp,tp,out,inc),f'{pid} identity mismatch')
    arts=p.get('campaignArtifacts',{})
    for key,suffix in [('handoff','SUCCESSOR_HANDOFF.json'),('startPacket','START_HERE_SUCCESSOR.md'),('receipt','SUCCESSOR_HANDOFF_RECEIPT.json'),('wakeUpMessage','WAKE_UP_MESSAGE.md')]:
        req(arts.get(key)==f'handoffs/{pid}/{suffix}',f'{pid} {key} path')
proto=(R/'shared/handoff/SUCCESSOR_HANDOFF_PROTOCOL.md').read_text()
for tok in ['P6A_TO_P6B','P6B_TO_P6C','AUTO_AFTER_SEAL','No human `CONTINUE` or approval is required','WAKE_UP_MESSAGE.md','standalone fenced `text` copy block']:
    req(tok in proto,f'protocol missing {tok}')
schema=load('shared/handoff/SUCCESSOR_HANDOFF_SCHEMA.json')
req(set(schema['properties']['boundaryProfileId']['enum'])==set(expected),'handoff schema enum mismatch')
req('boundaryAuthorization' in schema['properties']['payload']['required'],'handoff must require automatic boundary authorization')
req('humanBoundaryResponse' not in schema['properties']['payload'].get('properties',{}),'human response field must be removed')
sm=load('shared/controller/SOLO_WORKFLOW_STATE_MACHINE.json')
req(sm.get('actorTopology',{}).get('plannedSuccessorHandoffBoundaries')==list(expected),'state-machine boundary order mismatch')
if errs:
 print('SUCCESSOR HANDOFF VALIDATION FAIL'); [print('-',e) for e in errs]; raise SystemExit(1)
print('SUCCESSOR HANDOFF VALIDATION PASS')
