#!/usr/bin/env python3
"""Select and copy client-relevant evidence into a public audit package v1."""
from __future__ import annotations
import json,re,shutil
from pathlib import Path
from typing import Any
ALLOWED_ROLES={"test_receipt","fuzz_receipt","fork_receipt","compiler_receipt","remediation_receipt","source_manifest","limitation_record"}
def slug(s:str)->str: return re.sub(r'[^A-Za-z0-9._-]+','-',s).strip('-') or 'audit'
def publish(data:dict[str,Any],campaign:Path,out_root:Path)->dict[str,Any]:
    product=data['audit_identity']['product_name']; dest=out_root/'Audits'/product; evidence_dir=dest/'Evidence'; source_dir=dest/'Source'; evidence_dir.mkdir(parents=True,exist_ok=True); source_dir.mkdir(parents=True,exist_ok=True)
    records=[]; used=set()
    for e in data.get('evidence') or []:
        if e.get('role') not in ALLOWED_ROLES: continue
        rel=Path(str(e.get('path',''))); src=(campaign/rel).resolve()
        if campaign.resolve() not in src.parents and src!=campaign.resolve(): raise RuntimeError('PRIVATE_EVIDENCE_PATH_ESCAPE')
        if not src.is_file(): raise RuntimeError(f"MISSING_PUBLIC_EVIDENCE:{rel.as_posix()}")
        base=slug(src.name); name=base; n=2
        while name in used: name=f"{src.stem}-{n}{src.suffix}"; n+=1
        used.add(name); dst=evidence_dir/name; shutil.copy2(src,dst)
        records.append({"role":e['role'],"source_private_path":rel.as_posix(),"public_relative_path":dst.relative_to(out_root).as_posix(),"sha256":e['sha256']})
    manifest={"schema_version":"evidence-manifest-v1","product_name":product,"records":records}
    (evidence_dir/'evidence-manifest_v1.json').write_text(json.dumps(manifest,indent=2,sort_keys=True)+'\n')
    (dest/'README_v1.md').write_text(f"# {product} Audit Package v1\n\nThis directory contains client-relevant evidence selected from the authoritative audit campaign. Internal controller/admin artifacts are intentionally excluded.\n")
    return manifest
if __name__=='__main__':
    import argparse
    ap=argparse.ArgumentParser(); ap.add_argument('--data',type=Path,required=True); ap.add_argument('--campaign-path',type=Path,required=True); ap.add_argument('--output-root',type=Path,required=True); ap.add_argument('--manifest',type=Path,required=True); a=ap.parse_args(); m=publish(json.loads(a.data.read_text()),a.campaign_path.resolve(),a.output_root.resolve()); a.manifest.write_text(json.dumps(m,indent=2,sort_keys=True)+'\n')
