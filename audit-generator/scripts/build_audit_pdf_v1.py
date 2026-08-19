#!/usr/bin/env python3
"""Audit Generator v1 CLI orchestrator."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
from pathlib import Path

from normalize_audit_v1 import normalize
from overview_resolver_v1 import resolve, write_request
from plan_pages_v1 import plan
from render_frozen_template_v1 import render
from qa_audit_pdf_v1 import qa
from publish_evidence_v1 import publish

GENERATOR_VERSION='audit-generator-v1'

def sha256(path:Path)->str:
    h=hashlib.sha256()
    with path.open('rb') as f:
        for c in iter(lambda:f.read(1024*1024),b''): h.update(c)
    return h.hexdigest()

def main():
    ap=argparse.ArgumentParser(prog='audit-generator-v1')
    src=ap.add_mutually_exclusive_group(required=True); src.add_argument('--campaign-path',type=Path); src.add_argument('--campaign-repo')
    ap.add_argument('--campaign-ref',default='main'); ap.add_argument('--campaign-root',default='.')
    ap.add_argument('--product-name',required=True); ap.add_argument('--template',default='approved-reference-v1'); ap.add_argument('--output-version',required=True)
    ap.add_argument('--system-overview',type=Path); ap.add_argument('--allow-agent-overview',action='store_true'); ap.add_argument('--build-dir',type=Path,default=Path('build/audit-generator-v1'))
    ap.add_argument('--skip-qa',action='store_true',help='Development only; production workflow does not use this.')
    args=ap.parse_args(); build=args.build_dir.resolve(); build.mkdir(parents=True,exist_ok=True)
    base=Path(__file__).resolve().parents[1]; reference=base/'templates/approved-reference-v1/reference_v1.pdf'; budgets=base/'references/REFERENCE_TEXTBOX_BUDGETS_v1.json'
    campaign_path=args.campaign_path.resolve() if args.campaign_path else None; temp_clone=None
    if args.campaign_repo:
        token=os.environ.get('AUDIT_CONTROLLER_READ_TOKEN') or os.environ.get('GITHUB_TOKEN')
        if not token: raise RuntimeError('CAMPAIGN_REPO_TOKEN_REQUIRED')
        temp_clone=build/'_campaign_repo_v1'
        if temp_clone.exists(): subprocess.run(['rm','-rf',str(temp_clone)],check=True)
        url=f"https://x-access-token:{token}@github.com/{args.campaign_repo}.git"
        subprocess.run(['git','clone','--depth','1','--branch',args.campaign_ref,url,str(temp_clone)],check=True,stdout=subprocess.DEVNULL)
        campaign_path=(temp_clone/args.campaign_root).resolve()
    if not campaign_path or not campaign_path.exists(): raise RuntimeError('CAMPAIGN_PATH_NOT_FOUND')

    data=normalize(campaign_path,args.product_name,args.campaign_repo,args.campaign_ref); data['audit_identity']['output_version']=args.output_version
    data_path=build/'audit-report-data_v1.json'; data_path.write_text(json.dumps(data,indent=2,sort_keys=True)+'\n')
    try: overview=resolve(data,campaign_path,args.system_overview,args.allow_agent_overview)
    except RuntimeError as e:
        if str(e)=='SYSTEM_OVERVIEW_SOURCE_REQUIRED':
            request=build/'system-overview-request_v1.md'; write_request(request,args.product_name); print(f'ERROR: SYSTEM_OVERVIEW_SOURCE_REQUIRED\nGenerated request: {request}',file=sys.stderr); return 20
        raise
    if overview.get('agent_generated') and args.allow_agent_overview: print('WARNING: --allow-agent-overview used; manifest will record agent synthesis.',file=sys.stderr)
    ov_path=build/'system-overview-provenance_v1.json'; ov_path.write_text(json.dumps(overview,indent=2,sort_keys=True)+'\n')
    page_plan=plan(data); plan_path=build/'page-plan_v1.json'; plan_path.write_text(json.dumps(page_plan,indent=2)+'\n')
    pdf=build/f"CurveYield_{re.sub(r'[^A-Za-z0-9_-]+','_',args.product_name)}_Security_Audit_{args.output_version}.pdf"
    render(reference,budgets,data_path,ov_path,plan_path,pdf)
    template_map=build/'template-page-map_v1.json'; template_map.write_text(json.dumps({'candidate_to_reference':{str(i+1):int(p['template_page']) for i,p in enumerate(page_plan)}},indent=2)+'\n')
    allowed=','.join(str(i+1) for i,p in enumerate(page_plan) if p.get('geometry_exception'))
    structural=build/'structural-validation_v1.json'
    cmd=[sys.executable,str(base/'scripts/validate_audit_clone_v1.py'),str(reference),str(pdf),'--page-map',str(template_map),'--json-out',str(structural)]
    if allowed: cmd += ['--allow-geometry-pages',allowed]
    subprocess.run(cmd,check=True)
    qa_path=build/'pdf-qa-report_v1.json'; contact=build/'contact-sheet_v1.png'
    if not args.skip_qa: qa(pdf,reference,data_path,plan_path,qa_path,contact)
    public_root=build/'client-publication_v1'; evidence_payload=publish(data,campaign_path,public_root)
    evidence_manifest=build/'evidence-manifest_v1.json'; evidence_manifest.write_text(json.dumps(evidence_payload,indent=2,sort_keys=True)+'\n')
    manifest={
      'generator_version':GENERATOR_VERSION,'template_version':args.template,'template_sha256':sha256(reference),'campaign_source':args.campaign_repo or str(campaign_path),'campaign_ref':args.campaign_ref,'campaign_root':args.campaign_root,
      'normalized_data_sha256':sha256(data_path),'page_plan_sha256':sha256(plan_path),'evidence_manifest_sha256':sha256(evidence_manifest),'output_pdf_sha256':sha256(pdf),'qa_status':'SKIPPED' if args.skip_qa else 'PASS','system_overview':overview,
    }
    (build/'pdf-build-manifest_v1.json').write_text(json.dumps(manifest,indent=2,sort_keys=True)+'\n')
    print(pdf); return 0

if __name__=='__main__': raise SystemExit(main())
