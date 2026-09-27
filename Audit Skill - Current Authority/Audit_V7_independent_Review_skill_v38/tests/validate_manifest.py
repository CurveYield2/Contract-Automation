#!/usr/bin/env python3
from pathlib import Path
import json, hashlib, sys
root=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else Path(__file__).resolve().parents[1]
manifest_path=root/'MANIFEST.json'
errs=[]
if not manifest_path.is_file():
    print('MANIFEST FAIL\n- missing MANIFEST.json'); raise SystemExit(1)
manifest=json.loads(manifest_path.read_text(encoding='utf-8'))
listed=set()
for e in manifest.get('files',[]):
    rel=e['path']; listed.add(rel); p=root/rel
    if not p.is_file(): errs.append(f'missing {rel}'); continue
    if p.stat().st_size!=e['bytes']: errs.append(f'bytes mismatch {rel}')
    if hashlib.sha256(p.read_bytes()).hexdigest()!=e['sha256']: errs.append(f'sha mismatch {rel}')
actual={str(p.relative_to(root)).replace('\\','/') for p in root.rglob('*') if p.is_file() and p.resolve()!=manifest_path.resolve() and '.git' not in p.relative_to(root).parts}
for rel in sorted(actual-listed): errs.append(f'unlisted file {rel}')
for rel in sorted(listed-actual): errs.append(f'manifest-only file {rel}')
if manifest.get('release')!='audit-v7-independent-review@1.32.0': errs.append('release mismatch')
if manifest.get('packageRevision')!='v38.3.3': errs.append('package revision mismatch')
if manifest.get('schemaVersion')!='audit-v7-independent-review-manifest-v38.3.3': errs.append('schema version mismatch')
if errs:
    print('MANIFEST FAIL'); [print('-',e) for e in errs]; raise SystemExit(1)
print(f'MANIFEST PASS - {len(listed)} entries')
