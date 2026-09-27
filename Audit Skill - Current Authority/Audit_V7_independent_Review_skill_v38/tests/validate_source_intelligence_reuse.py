#!/usr/bin/env python3
from pathlib import Path
import json, sys, re
root=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else Path(__file__).resolve().parents[1]
errs=[]
def req(c,m):
    if not c: errs.append(m)
si=root/'shared/source-intelligence'
for f in ['SOURCE_INTELLIGENCE_TEMPLATE.json','SOURCE_INTELLIGENCE_SCHEMA.json','SOURCE_INTELLIGENCE_REUSE_PROTOCOL.md']:
    req((si/f).is_file(),f'missing {f}')
if (si/'SOURCE_INTELLIGENCE_TEMPLATE.json').is_file():
    t=json.loads((si/'SOURCE_INTELLIGENCE_TEMPLATE.json').read_text())
    for k in ['identity','build','sourceFiles','compilerArtifacts','contracts','functions','storageLayout','inheritanceGraph','callGraph','privilegeCandidates','externalInterfaces','valueFlowCandidates','eventsAndErrors','sourceAnchors','staticRecon','limitations','completion']:
        req(k in t,f'template missing {k}')
    req('__FILL_REQUIRED__' in (si/'SOURCE_INTELLIGENCE_TEMPLATE.json').read_text(),'template must visibly expose fill sentinel')
    req('campaignArtifactSha256' not in t.get('completion',{}),'template must not require self-referential digest')
    req(t.get('completion',{}).get('artifactDigestRecordLocation')=='PHASE_REPORT_AND_CONTROLLER_EVIDENCE_AFTER_ARTIFACT_SEAL','template must route artifact digest externally')
skill=(root/'SKILL.md').read_text()
req('U-SOURCEINTEL-001' in skill,'homepage missing U-SOURCEINTEL-001')
req('SOURCE_INTELLIGENCE_TEMPLATE.json' in skill,'homepage missing Source Intelligence template routing')
for n in range(1,11):
    c=json.loads((root/f'phases/phase-{n}/PHASE_CONTRACT.json').read_text())
    req('U-SOURCEINTEL-001' in c.get('universalRuleIds',[]),f'phase {n} contract missing source intelligence rule')
    req('sourceIntelligence' in c.get('globalControlCheckpoints',{}),f'phase {n} contract missing sourceIntelligence checkpoint')
    card=(root/f'phases/phase-{n}/START_HERE.md').read_text()
    if n==1:
        req('Fill the canonical Source Intelligence core from the supplied template' in card,'phase1 missing generation step')
        req('SOURCE_INTELLIGENCE_TEMPLATE.json' in card,'phase1 missing exact template link')
    else:
        req('SOURCE INTELLIGENCE REUSE GATE' in card,f'phase {n} missing reuse gate')
        req('THIS PHASE REVIEWS' in card,f'phase {n} missing relevant-section instruction')
# Later phase cards must explicitly reject reconstruction.
for n in range(2,11):
    card=(root/f'phases/phase-{n}/START_HERE.md').read_text().lower()
    req(('do not recreate' in card or 'do not rebuild' in card),f'phase {n} missing anti-rediscovery instruction')
# Phase9 must regenerate on remediation source changes.
p9=(root/'phases/phase-9/START_HERE.md').read_text()
req('fill a new Source Intelligence version' in p9,'phase9 missing remediation regeneration rule')
# Phase reports carry the checkpoint.
req('## Source Intelligence checkpoint' in (root/'shared/reporting/PHASE_REPORT.md').read_text(),'phase report missing Source Intelligence checkpoint')
if errs:
    print('SOURCE INTELLIGENCE VALIDATION FAIL'); [print('-',e) for e in errs]; raise SystemExit(1)
print('SOURCE INTELLIGENCE VALIDATION PASS - exact Phase1 template + Phase2-10 reuse/invalidation routing present')
