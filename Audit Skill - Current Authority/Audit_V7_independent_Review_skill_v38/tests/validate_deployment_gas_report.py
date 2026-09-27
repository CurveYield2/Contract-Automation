from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
card=(ROOT/'phases/phase-7/START_HERE.md').read_text(encoding='utf-8')
execmod=(ROOT/'phases/phase-7/resources/audit-modules/controller-operated-execution.md').read_text(encoding='utf-8')
release=(ROOT/'phases/phase-10/START_HERE.md').read_text(encoding='utf-8')
template=(ROOT/'shared/reporting/Contract_Deployment_Gas_Report.md').read_text(encoding='utf-8')
required_exec=['every independently deployable production contract','compiler deployment-gas estimate','same exact compiler','same optimizer','shared/reporting/Contract_Deployment_Gas_Report.md','Contract | Chain | Compiler | Optimization | Runtime bytes | Deployment gas estimate','do not create a second deployment workflow']
for needle in required_exec: assert needle in execmod, f'missing Phase-7 gas requirement: {needle}'
for needle in ['deployment-gas estimates for every independently deployable production contract','Gas report']:
    assert needle in card, f'Phase-7 card missing gas routing: {needle}'
for needle in ['Gas report','final report artifacts']:
    assert needle.lower() in release.lower(), f'Phase-10 delivery route missing gas report: {needle}'
assert 'UNAVAILABLE' in template and 'typed reason' in template, 'unavailable compiler estimate must be recorded, not omitted'
print('deployment gas report validation: PASS')
