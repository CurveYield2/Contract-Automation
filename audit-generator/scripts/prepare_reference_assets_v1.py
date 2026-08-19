#!/usr/bin/env python3
"""Restore frozen approved reference assets from repository-safe base64 parts v1."""
from __future__ import annotations
import base64,hashlib,json,zipfile
from io import BytesIO
from pathlib import Path
def prepare(base:Path):
    manifest=json.loads((base/'assets/reference-assets-manifest_v1.json').read_text())
    encoded=''.join((base/'assets'/p).read_text().strip() for p in manifest['parts'])
    archive=base64.b64decode(encoded)
    if hashlib.sha256(archive).hexdigest()!=manifest['archive_sha256']: raise RuntimeError('REFERENCE_ARCHIVE_HASH_MISMATCH')
    with zipfile.ZipFile(BytesIO(archive)) as z: z.extractall(base)
    pdf=base/'templates/approved-reference-v1/reference_v1.pdf'
    if hashlib.sha256(pdf.read_bytes()).hexdigest()!=manifest['reference_pdf_sha256']: raise RuntimeError('REFERENCE_PDF_HASH_MISMATCH')
    print(pdf)
if __name__=='__main__': prepare(Path(__file__).resolve().parents[1])
