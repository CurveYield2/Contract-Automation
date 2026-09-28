#!/usr/bin/env python3
import json, hashlib, pathlib, re, sys

root=pathlib.Path(sys.argv[1]).resolve()
packages=sorted(p for p in root.iterdir() if p.is_dir() and (p/'SKILL.md').is_file())
if len(packages)!=1:
    raise SystemExit('expected exactly one Lite authority package')
pkg=packages[0]

protocol='''# Lite Phase Receipt Protocol

This protocol is the authoritative Lite control-plane model.

## One receipt per phase

Every Lite phase owns exactly one versioned receipt:

`receipts/PHASE_00_RECEIPT_v1.json` through `receipts/PHASE_10_RECEIPT_v1.json`.

The receipt is created when the phase begins and updated in place throughout that phase. Git history preserves earlier states. Do not create separate completion, validation, retirement, handoff, successor, blocker, pointer, or proof-of-proof receipts.

Actual audit evidence remains in its substantive artifact files. The receipt records only process state and references to that evidence.

## Separate Audit Campaign Directory

`Audit Campaign Directory/` remains a separate repository-level directory. It is not consolidated into campaign receipts.

Each active Lite campaign has one minimal entry:

`Audit Campaign Directory/campaigns/<campaign-slug>.json`

The entry contains campaign identity, workspace, source identity, current phase receipt path, current phase sequence, current reviewer/executor and campaign status. It is the discovery/routing pointer for automation.

The directory does not duplicate audit evidence or phase conclusions.

## Reviewer procedure

At phase start, resolve the current receipt through the Audit Campaign Directory entry and read that receipt before doing phase work.

During the phase:
- write substantive audit results only to the phase's designated evidence/resources;
- update the same phase receipt with evidence/output references, obligations, invalidation events and material automation identities;
- record failures in the receipt's `errors` array instead of creating blocker receipts;
- never create a separate handoff package, completion companion, validation receipt, retirement gate, Start Here successor file, or wake-message file.

When substantive work is complete:
1. ensure all required evidence/output references are recorded in the current receipt;
2. update obligations and invalidation state;
3. set `phase.status` to `EVIDENCE_READY`;
4. leave `validation.status` as `PENDING`;
5. stop changing security-result fields until deterministic validation runs.

The reviewer MUST NOT self-set `validation.status=PASS`, `phase.status=SEALED`, or `phase.status=COMPLETE`.

## Deterministic validation and advancement

The Contract-Automation receipt controller verifies that referenced required evidence exists and that the required global controls are present. It writes PASS/FAIL into the same receipt.

On PASS:
- same-reviewer boundaries create the next phase receipt and advance the Audit Campaign Directory pointer while keeping the same chat;
- fresh-reviewer boundaries mark the outgoing receipt `SUCCESSOR_PENDING`; the orchestrator creates the incoming receipt, dynamically generates the wake prompt from the receipts, and browser wake marks the transition `SUCCESSOR_ACTIVATED`;
- Phase 10 marks the phase receipt and campaign directory COMPLETE.

No persistent handoff/wake/start files are created.

## Fresh reviewer boundaries

The only fresh-reviewer boundaries are:
- Phase 0 -> reviewer-1 / Phase 1;
- Phase 1 -> reviewer-2 / combined Phases 2-5;
- Phase 5 -> reviewer-3L / merged Phases 6-7;
- Phase 7 -> reviewer-4 / combined Phases 8-10.

The outgoing receipt itself carries the successor reviewer, assigned work, next phase and predecessor evidence references.

## Campaign-global substantive controls

These remain separate because they contain live audit data:
- `controller/SECURITY_TRACEABILITY_GRAPH_v1.json`
- `controller/CARRIED_FORWARD_OBLIGATION_LEDGER_v1.json`
- `controller/EVIDENCE_INVALIDATION_MATRIX_v1.json`
- `evidence/source-intelligence/SOURCE_INTELLIGENCE_BUNDLE_INDEX_v1.json`

Receipts point to them; checkpoint copies are prohibited.

## Rework

For explicit phase rework, increment the phase receipt revision only when the sealed phase itself is reopened. Git history preserves all prior receipt bytes. Do not generate auxiliary rework receipts.

## Prohibited Lite bookkeeping artifacts

New Lite campaigns must not generate:
- `CAMPAIGN_STATE_vN.json`
- `ACTIVE_PHASE_POINTER_vN.json`
- `SOLO_AUDIT_STATE_vN.json`
- `SUCCESSOR_HANDOFF*.json`
- `SUCCESSOR_HANDOFF_RECEIPT*.json`
- `START_HERE_SUCCESSOR.md`
- `WAKE_UP_MESSAGE.md`
- `MECHANICAL_WORK_PACKET*.json`
- `MECHANICAL_WORK_COMPLETION*.json`
- phase completion companions/validation sidecars
- phase retirement-gate sidecars
- process blocker receipts

For current Lite campaigns, the phase receipt is the sole process receipt.
'''
(pkg/'shared/controller/LITE_PHASE_RECEIPT_PROTOCOL.md').write_text(protocol)

(pkg/'shared/controller/AUTOMATIC_PHASE_ADVANCEMENT_PROTOCOL.md').write_text('''# Lite Automatic Phase Advancement Protocol

Lite phase advancement is receipt-driven. Follow [LITE_PHASE_RECEIPT_PROTOCOL.md](LITE_PHASE_RECEIPT_PROTOCOL.md).

A reviewer finishes substantive work by updating the current `receipts/PHASE_XX_RECEIPT_v1.json` to `EVIDENCE_READY`. The reviewer does not self-seal.

Contract-Automation validates referenced required evidence and writes the result into that same receipt. On PASS it either initializes the next receipt for the same reviewer, marks a fresh-reviewer transition pending, or completes the campaign at Phase 10.

The Audit Campaign Directory entry is the only repository-level current-campaign pointer. No campaign-state/pointer/solo-state trio, completion companion, handoff package, retirement receipt, mechanical reconciliation packet or successor receipt is part of the current Lite path.
''')

(pkg/'shared/controller/AUDIT_CONTROLLER_AND_GITHUB_PROTOCOL.md').write_text('''# Lite Audit Controller and GitHub Protocol

Use the GitHub connector for reviewer repository access. Contract-Automation owns GitHub Actions workflows; Audit-Controller owns campaign evidence, receipts, authority and the separate Audit Campaign Directory.

For Lite process state, [LITE_PHASE_RECEIPT_PROTOCOL.md](LITE_PHASE_RECEIPT_PROTOCOL.md) is authoritative.

Current campaign discovery:
1. locate the campaign entry under `Audit Campaign Directory/campaigns/`;
2. read its `currentReceiptPath`;
3. read that phase receipt;
4. execute only the phase authorized by the receipt and current Phase Contract.

Do not reconstruct current state from historical campaign files when the Audit Campaign Directory and current receipt are available. Do not create additional process receipts.
''')

(pkg/'shared/controller/RECOVERY_ROUTER.md').write_text('''# Lite Recovery Router

For a current Lite campaign, recovery starts from exactly two control locations:

1. `Audit Campaign Directory/campaigns/<slug>.json`;
2. the `currentReceiptPath` named by that directory entry.

Then inspect the substantive evidence references and `errors` recorded in that receipt.

Recovery rules:
- resume the same phase when its receipt is ACTIVE, EVIDENCE_READY, VALIDATING or BLOCKED;
- if validation failed, repair only the failed prerequisite and return the same receipt to EVIDENCE_READY;
- if a same-reviewer next receipt already exists, continue that receipt in the same chat;
- if a fresh successor is pending, regenerate the wake dynamically from the outgoing/incoming receipts;
- never create replacement handoff, blocker, completion or retirement receipts;
- never restart sealed substantive work merely to reconstruct bookkeeping.

Historical pre-single-receipt campaigns may retain their legacy control artifacts, but new Lite campaigns use the phase-receipt model exclusively.
''')

# Update source-intelligence prose away from bootstrap-agent wording.
sip=pkg/'shared/source-intelligence/SOURCE_INTELLIGENCE_REUSE_PROTOCOL.md'
if sip.exists():
    s=sip.read_text()
    s=s.replace('web-bootstrap-agent','phase0-automation')
    s=s.replace('Phase-0 web-bootstrap agent','Phase-0 automation')
    sip.write_text(s)

# Recursive string migrations used in Phase Contracts.
replacements={
    'Accepted P0_TO_P1 receipt':'Sealed Phase-0 receipt',
    'Accepted P1_TO_P2 receipt':'Sealed Phase-1 receipt',
    'Accepted P5_TO_P6 receipt':'Sealed Phase-5 receipt',
    'Accepted P67_TO_P8 receipt':'Sealed Phase-7 receipt',
    'Phase-0 Bootstrap Audit Surface':'Phase-0 audit surface (evidence/phase0/PHASE0_AUDIT_SURFACE_v1.json)',
    'Phase-0 Bootstrap Audit Surface Manifest':'Phase-0 audit surface (evidence/phase0/PHASE0_AUDIT_SURFACE_v1.json)',
    'Phase-0 controller-validation PASS':'Phase-0 receipt validation PASS',
    'Phase-0 completion evidence':'sealed Phase-0 receipt',
    'current Phase-0 completion evidence':'current sealed Phase-0 receipt',
    'Successor handoff protocol':'Lite Phase Receipt Protocol',
    'successor handoff':'receipt transition',
    'Successor handoff':'Receipt transition',
    'handoff package':'receipt transition',
    'handoff-validation':'receipt validation',
    'retirement gate':'receipt transition gate',
}
def xform(v):
    if isinstance(v,str):
        for a,b in replacements.items(): v=v.replace(a,b)
        v=v.replace('../../shared/handoff/SUCCESSOR_HANDOFF_RECEPTION_CHECKLIST.md','../../shared/controller/LITE_PHASE_RECEIPT_PROTOCOL.md')
        v=v.replace('../../shared/handoff/SUCCESSOR_HANDOFF_PROTOCOL.md','../../shared/controller/LITE_PHASE_RECEIPT_PROTOCOL.md')
        return v
    if isinstance(v,list): return [xform(x) for x in v]
    if isinstance(v,dict): return {k:xform(val) for k,val in v.items()}
    return v

for seq in range(11):
    cp=pkg/f'phases/phase-{seq}/PHASE_CONTRACT.json'
    data=xform(json.loads(cp.read_text()))
    auth=data.setdefault('authorization',{})
    auth.pop('incomingSuccessorReceipt',None)
    auth['phaseReceipt']=f'receipts/PHASE_{seq:02d}_RECEIPT_v1.json'
    auth['receiptProtocol']='shared/controller/LITE_PHASE_RECEIPT_PROTOCOL.md'
    auth['reviewerMaySelfSeal']=False
    # Remove legacy handoff/process-sidecar outputs, normalize live controls.
    outs=[]
    for row in data.get('requiredOutputs',[]):
        art=str(row.get('artifact',''))
        if art.startswith('handoffs/') or any(token in art for token in [
            'PHASE0_AUTOMATION_COMPLETION_REPORT','PHASE0_AUTOMATION_VALIDATION',
            'PHASE0_WEB_BOOTSTRAP_COMPLETION_REPORT','PHASE_COMPLETION_VALIDATION',
            'SUCCESSOR_HANDOFF','WAKE_UP_MESSAGE','START_HERE_SUCCESSOR',
            'PROCESS_BLOCKER_RECEIPT','MECHANICAL_WORK_PACKET','MECHANICAL_WORK_COMPLETION'
        ]):
            continue
        art=art.replace('shared/controller/SECURITY_TRACEABILITY_GRAPH.json','controller/SECURITY_TRACEABILITY_GRAPH_v1.json')
        art=art.replace('shared/controller/CARRIED_FORWARD_OBLIGATION_LEDGER.json','controller/CARRIED_FORWARD_OBLIGATION_LEDGER_v1.json')
        art=art.replace('shared/controller/EVIDENCE_INVALIDATION_MATRIX.json','controller/EVIDENCE_INVALIDATION_MATRIX_v1.json')
        row['artifact']=art
        outs.append(row)
    if seq==0:
        # Ensure the real Phase-0 audit input and invalidation state are explicit.
        def add(artifact,role):
            if not any(r.get('artifact')==artifact for r in outs):
                outs.append({'artifact':artifact,'role':role,'required':True})
        add('evidence/phase0/PHASE0_AUDIT_SURFACE_v1.json','PHASE0_AUDIT_SURFACE')
        add('controller/EVIDENCE_INVALIDATION_MATRIX_v1.json','EVIDENCE_INVALIDATION_STATE')
    receipt_art=f'receipts/PHASE_{seq:02d}_RECEIPT_v1.json'
    if not any(r.get('artifact')==receipt_art for r in outs):
        outs.append({'artifact':receipt_art,'role':'PHASE_RECEIPT','required':True})
    data['requiredOutputs']=outs
    data['receiptCompletionRule']='Record substantive outputs and obligations in the current phase receipt, set phase.status=EVIDENCE_READY and validation.status=PENDING, then stop. Deterministic automation validates/seals/advances the same receipt.'
    # Fresh boundary artifact creation is no longer a phase output.
    sc=[]
    for item in data.get('sealingCriteria',[]):
        if any(t in item.lower() for t in ['handoff','retirement gate','wake message']):
            continue
        sc.append(item)
    sc.append('Current phase receipt contains all required evidence/output references and reaches deterministic validation PASS before seal.')
    data['sealingCriteria']=sc
    cp.write_text(json.dumps(data,indent=2)+'\n')

    sh=pkg/f'phases/phase-{seq}/START_HERE.md'
    if sh.exists():
        text=sh.read_text()
        text=text.replace('../../shared/handoff/SUCCESSOR_HANDOFF_RECEPTION_CHECKLIST.md','../../shared/controller/LITE_PHASE_RECEIPT_PROTOCOL.md')
        text=text.replace('../../shared/handoff/SUCCESSOR_HANDOFF_PROTOCOL.md','../../shared/controller/LITE_PHASE_RECEIPT_PROTOCOL.md')
        text=text.replace('PHASE0_BOOTSTRAP_AUDIT_SURFACE_MANIFEST','PHASE0_AUDIT_SURFACE_v1')
        text=text.replace('Phase 0 Bootstrap Audit Surface Manifest','Phase-0 Audit Surface')
        text=text.replace('Phase-0 Bootstrap Audit Surface','Phase-0 Audit Surface')
        receipt_note=f'''\n## Receipt control — mandatory\n\nUse [Lite Phase Receipt Protocol](../../shared/controller/LITE_PHASE_RECEIPT_PROTOCOL.md). Resolve this campaign through `Audit Campaign Directory/campaigns/<slug>.json` and update only `receipts/PHASE_{seq:02d}_RECEIPT_v1.json` for process state. Keep substantive audit evidence in the designated phase resources. Do not create completion companions, validation sidecars, retirement receipts, handoff packages, Start Here successor files, wake-message files, blocker receipts, or mechanical reconciliation packets. When substantive Phase {seq} work is complete, record required evidence/output references and obligations in the receipt, set `phase.status=EVIDENCE_READY` and leave `validation.status=PENDING`; deterministic automation validates and advances it.\n'''
        if '## Receipt control — mandatory' not in text:
            lines=text.splitlines(True)
            pos=1 if lines else 0
            text=''.join(lines[:pos])+receipt_note+''.join(lines[pos:])
        # Remove explicit instructions to create legacy handoff files where possible.
        text=re.sub(r'(?im)^.*(?:SUCCESSOR_HANDOFF|WAKE_UP_MESSAGE|START_HERE_SUCCESSOR|handoff package|retirement gate).*$\n?','',text)
        sh.write_text(text)

# Phase 0 contract must use the actual new audit surface names, not old bookkeeping.
p0=pkg/'phases/phase-0/PHASE_CONTRACT.json'
d=json.loads(p0.read_text())
d['requiredOutputs']=[r for r in d['requiredOutputs'] if not any(x in r['artifact'] for x in ['PHASE0_BOOTSTRAP_MANIFEST','PHASE0_AUTOMATION_COMPLETION','PHASE0_AUTOMATION_VALIDATION'])]
p0.write_text(json.dumps(d,indent=2)+'\n')

# Update top-level Lite docs to establish receipt authority, while preserving substantive instructions.
for rel in ['SKILL.md','LITE_ORCHESTRATOR_MODE.md','docs/USER_GUIDE.md']:
    p=pkg/rel
    if not p.exists(): continue
    text=p.read_text()
    text=text.replace('web-bootstrap-agent','phase0-automation')
    text=text.replace('SUCCESSOR_HANDOFF.json','phase receipt')
    text=text.replace('SUCCESSOR_HANDOFF_RECEIPT.json','phase receipt')
    text=text.replace('WAKE_UP_MESSAGE.md','dynamically generated successor wake')
    text=text.replace('START_HERE_SUCCESSOR.md','incoming phase receipt')
    text=text.replace('PHASE0_BOOTSTRAP_AUDIT_SURFACE_MANIFEST','PHASE0_AUDIT_SURFACE_v1')
    banner='''\n> **CURRENT LITE CONTROL PLANE:** Process state uses exactly one receipt per phase under `receipts/`, plus the separate repository-level `Audit Campaign Directory/` for campaign discovery/routing. [Lite Phase Receipt Protocol](shared/controller/LITE_PHASE_RECEIPT_PROTOCOL.md) supersedes legacy handoff/completion/retirement receipt mechanics. Substantive audit evidence remains separate.\n\n'''
    if 'CURRENT LITE CONTROL PLANE' not in text:
        lines=text.splitlines(True); pos=1 if lines else 0
        text=''.join(lines[:pos])+banner+''.join(lines[pos:])
    p.write_text(text)

# Delete obsolete Lite bookkeeping templates/resources. Actual substantive evidence templates stay.
obsolete=[
 'shared/handoff/HANDOFF_DISCOVERY_AND_CONTEXT_RECOVERY.md',
 'shared/handoff/START_HERE_SUCCESSOR_TEMPLATE.md',
 'shared/handoff/SUCCESSOR_HANDOFF_BOUNDARY_PROFILES.json',
 'shared/handoff/SUCCESSOR_HANDOFF_PROTOCOL.md',
 'shared/handoff/SUCCESSOR_HANDOFF_RECEIPT_SCHEMA.json',
 'shared/handoff/SUCCESSOR_HANDOFF_RECEIPT_TEMPLATE.json',
 'shared/handoff/SUCCESSOR_HANDOFF_RECEPTION_CHECKLIST.md',
 'shared/handoff/SUCCESSOR_HANDOFF_SCHEMA.json',
 'shared/handoff/SUCCESSOR_HANDOFF_TEMPLATE.json',
 'shared/handoff/WAKE_UP_MESSAGE_TEMPLATE.md',
 'shared/reporting/PROCESS_BLOCKER_RECEIPT.json',
 'shared/controller/SOLO_AUDIT_STATE.json',
 'shared/controller/SOLO_WORKFLOW_STATE_MACHINE.json',
 'phases/phase-0/resources/PHASE0_BOOTSTRAP_AUDIT_SURFACE_MANIFEST.md',
 'phases/phase-0/resources/INSTRUCTION_READ_PROOF.json',
 'phases/phase-0/resources/PHASE0_CAPABILITY_PREFLIGHT.md',
 'phases/phase-0/resources/PHASE0_WEB_BOOTSTRAP_COMPLETION_REPORT.md',
]
for rel in obsolete:
    p=pkg/rel
    if p.exists(): p.unlink()

# Remove any now-empty handoff directory.
handoff=pkg/'shared/handoff'
if handoff.exists():
    try: handoff.rmdir()
    except OSError: pass

# Fail on active-authority references to deleted bookkeeping names.
for p in pkg.rglob('*'):
    if not p.is_file() or p.name in {'MANIFEST.json','PACKAGE_PROVENANCE.md'}: continue
    try: text=p.read_text()
    except UnicodeDecodeError: continue
    bad=[x for x in [
      'SUCCESSOR_HANDOFF.json','SUCCESSOR_HANDOFF_RECEIPT.json','WAKE_UP_MESSAGE.md','START_HERE_SUCCESSOR.md',
      'PHASE0_WEB_BOOTSTRAP_COMPLETION_REPORT','PHASE0_CAPABILITY_PREFLIGHT','INSTRUCTION_READ_PROOF.json',
      'PROCESS_BLOCKER_RECEIPT.json','MECHANICAL_WORK_PACKET_v2.json','MECHANICAL_WORK_COMPLETION_v2.json'
    ] if x in text]
    if bad:
        raise SystemExit(f'stale Lite bookkeeping references in {p.relative_to(pkg)}: {bad}')

# Regenerate package manifest from actual package bytes.
entries=[]
for p in sorted(x for x in pkg.rglob('*') if x.is_file() and x.name!='MANIFEST.json'):
    b=p.read_bytes()
    entries.append({'path':p.relative_to(pkg).as_posix(),'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()})
manifest={
  'schemaVersion':'audit-litemode-v10-manifest-v2',
  'release':'Audit_Litemode_v10',
  'packageRevision':'v10',
  'mode':'LITE',
  'entrypoint':'SKILL.md',
  'controlPlane':'SINGLE_PHASE_RECEIPT_PLUS_AUDIT_CAMPAIGN_DIRECTORY',
  'stableAuthorityFolder':'CurveYield2/Audit-Controller/Audit Skill - Current Authority',
  'files':entries
}
(pkg/'MANIFEST.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps({'status':'PASS','package':pkg.name,'files':len(entries)}))
