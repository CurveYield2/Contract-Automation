#!/usr/bin/env python3
"""Freeze approved v37 reference geometry and stable text slots v1."""
from __future__ import annotations
import hashlib,json,re
from pathlib import Path
import fitz

def sha256(p:Path):
 h=hashlib.sha256(); h.update(p.read_bytes()); return h.hexdigest()

def slug(s:str): return re.sub(r'[^A-Z0-9]+','_',s.upper()).strip('_')

def freeze(reference:Path,budgets_path:Path,outdir:Path):
 budgets=json.loads(budgets_path.read_text()); doc=fitz.open(reference); outdir.mkdir(parents=True,exist_ok=True)
 slots=[]; geometry=[]
 for page_meta in budgets['pages']:
  n=page_meta['page']; role=page_meta['role']; page=doc[n-1]
  for i,b in enumerate(page_meta['text_blocks'],1):
   slots.append({'slot_id':f"{slug(role)}.BLOCK_{i:02d}",'page_family':slug(role).lower().replace('_','-'),'template_page':n,'bbox':b['bbox'],'font':b['styles'][0]['font'],'font_size':b['styles'][0]['size'],'color':b['styles'][0]['color'],'alignment':'reference','original_character_count':b['char_count'],'preferred_min_chars':b['preferred_min_chars'],'preferred_max_chars':b['preferred_max_chars'],'hard_min_chars':b['hard_min_chars'],'hard_max_chars':b['hard_max_chars'],'reference_text':b['reference_text']})
  drawings=[]
  for d in page.get_drawings():
   drawings.append({'rect':[round(x,3) for x in d['rect']], 'type':d.get('type'), 'fill':d.get('fill'), 'color':d.get('color'), 'width':d.get('width')})
  images=[]
  for img in page.get_images(full=True): images.append({'xref':img[0],'width':img[2],'height':img[3]})
  geometry.append({'template_page':n,'width':page.rect.width,'height':page.rect.height,'rotation':page.rotation,'drawing_count':len(drawings),'drawings':drawings,'image_count':len(images),'images':images})
 manifest={'template_version':'approved-reference-v1','reference_file':'reference_v1.pdf','sha256':sha256(reference),'page_count':len(doc),'source_reference_name':'CurveYield_sdYB_Vault_v31.28.27_Security_Audit_v37.pdf','ordering_override':'System Overview template page 5 is output page 2 under Automated Audit Generator Developer Specification v1'}
 (outdir/'template-manifest_v1.json').write_text(json.dumps(manifest,indent=2,sort_keys=True)+'\n')
 (outdir/'text-slots_v1.json').write_text(json.dumps({'template_version':'approved-reference-v1','slots':slots},indent=2)+'\n')
 (outdir/'immutable-geometry_v1.json').write_text(json.dumps({'template_version':'approved-reference-v1','pages':geometry},indent=2)+'\n')
 doc.close()
if __name__=='__main__':
 import argparse
 ap=argparse.ArgumentParser(); ap.add_argument('--reference',type=Path,required=True); ap.add_argument('--budgets',type=Path,required=True); ap.add_argument('--output-dir',type=Path,required=True); a=ap.parse_args(); freeze(a.reference,a.budgets,a.output_dir)
