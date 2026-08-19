#!/usr/bin/env python3
"""Deterministic 50-pass Audit PDF QA v1."""
from __future__ import annotations

import json
import re
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Callable

import fitz
from PIL import Image, ImageChops, ImageStat
import pypdfium2 as pdfium

PRIVATE_PATTERNS=("solo-audit-controller","private-audit-controller","/campaigns/")


def rec(n:int,name:str,fn:Callable[[],tuple[bool,str]]):
    try: ok,detail=fn(); return {"pass":n,"name":name,"status":"PASS" if ok else "FAIL","detail":detail}
    except Exception as e: return {"pass":n,"name":name,"status":"FAIL","detail":f"{type(e).__name__}: {e}"}


def render_pdfium(pdf:Path,out:Path):
    out.mkdir(parents=True,exist_ok=True); doc=pdfium.PdfDocument(str(pdf)); paths=[]
    for i,p in enumerate(doc):
        img=p.render(scale=1.5).to_pil(); fp=out/f"page-{i+1:03d}.png"; img.save(fp); paths.append(fp)
    return paths


def render_poppler(pdf:Path,out:Path):
    if not shutil.which('pdftoppm'): raise RuntimeError('pdftoppm unavailable')
    out.mkdir(parents=True,exist_ok=True); subprocess.run(['pdftoppm','-png','-r','108',str(pdf),str(out/'page')],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
    return sorted(out.glob('page-*.png'))


def qa(pdf:Path,reference:Path,data_path:Path,plan_path:Path,report_path:Path,contact_path:Path):
    data=json.loads(data_path.read_text()); plan=json.loads(plan_path.read_text()); doc=fitz.open(pdf); ref=fitz.open(reference); results=[]
    texts=[p.get_text() for p in doc]; full='\n'.join(texts); page_count=len(doc)
    def all_pages_same_size():
        target=ref[0].rect; bad=[i+1 for i,p in enumerate(doc) if abs(p.rect.width-target.width)>.01 or abs(p.rect.height-target.height)>.01]; return (not bad,f"bad pages={bad}")
    def no_outside_text():
        bad=[]
        for i,p in enumerate(doc):
            for b in p.get_text('blocks'):
                if b[0]<-1 or b[1]<-1 or b[2]>p.rect.width+1 or b[3]>p.rect.height+1: bad.append(i+1)
        return (not bad,f"bad pages={sorted(set(bad))}")
    def no_overlap_heavy():
        bad=[]
        for i,p in enumerate(doc):
            bs=[fitz.Rect(b[:4]) for b in p.get_text('blocks') if str(b[4]).strip()]
            for a in range(len(bs)):
                for b in range(a+1,len(bs)):
                    inter=bs[a]&bs[b]
                    if inter.is_empty: continue
                    if inter.get_area()>0.25*min(bs[a].get_area(),bs[b].get_area()): bad.append(i+1); break
        return (not bad,f"pages={sorted(set(bad))}")
    def margin_clear():
        bad=[]
        for i,p in enumerate(doc):
            for b in p.get_text('blocks'):
                if b[0]<5 or b[2]>p.rect.width-5: bad.append(i+1)
        return (not bad,f"pages={sorted(set(bad))}")
    for n,name,fn in [
        (1,'page dimensions',all_pages_same_size),(2,'text inside page bounds',no_outside_text),(3,'major text overlap',no_overlap_heavy),(4,'edge clearances',margin_clear),
        (5,'page count matches plan',lambda:(page_count==len(plan),f"pdf={page_count} plan={len(plan)}")),
        (6,'no empty pages',lambda:(all(t.strip() for t in texts),str([i+1 for i,t in enumerate(texts) if not t.strip()]))),
        (7,'footer clearance',lambda:(all(any(b[1]>790 for b in p.get_text('blocks')) for p in doc),'footer block present')),
        (8,'header clearance',lambda:(all(any(b[1]<40 for b in p.get_text('blocks')) for p in doc),'header block present')),
        (9,'no duplicate page labels',lambda:(all(f"{i} of {page_count}" in texts[i-1] for i in range(1,page_count+1)),'page numbering text')),
        (10,'stale old reference identity absent',lambda:(not any(x in full.lower() for x in ('sdyb vault','v31.28.27','25.1884%')), 'old identity scan')),
    ]: results.append(rec(n,name,fn))
    sizes=[]; fonts=[]
    for p in doc:
        d=p.get_text('dict')
        for b in d['blocks']:
            for l in b.get('lines',[]):
                for s in l.get('spans',[]): sizes.append(float(s['size'])); fonts.append(str(s['font']))
    typography=[
        (11,'minimum readable body size',lambda:(min(sizes)>=6.0 if sizes else False,f"min={min(sizes) if sizes else None}")),
        (12,'maximum title size bounded',lambda:(max(sizes)<=30 if sizes else False,f"max={max(sizes) if sizes else None}")),
        (13,'approved font families only',lambda:(all(any(k in f for k in ('Helvetica','DejaVu','Courier')) for f in fonts),str(sorted(set(fonts))))),
        (14,'no tiny-font overflow workaround',lambda:(not any(s<6 for s in sizes),f"tiny={sum(1 for s in sizes if s<6)}")),
        (15,'title hierarchy present',lambda:(any(s>=20 for s in sizes),'large title present')),
        (16,'body typography present',lambda:(any(6.5<=s<=10.8 for s in sizes),'body range present')),
        (17,'no font explosion',lambda:(len(set(fonts))<=12,f"fonts={len(set(fonts))}")),
        (18,'no pathological long unbroken tokens',lambda:(not re.search(r'\S{140,}',full),'token scan')),
        (19,'no replacement glyphs',lambda:('\ufffd' not in full,'unicode replacement scan')),
        (20,'no obvious clipped marker',lambda:('CONTENT_REWRITE_REQUIRED' not in full and 'TEXT_OVERFLOW' not in full,'error marker scan')),
    ]
    for n,name,fn in typography: results.append(rec(n,name,fn))
    chars=[len(t.strip()) for t in texts]
    balance=[
      (21,'reasonable page density',lambda:(all(c<6000 for c in chars),f"max={max(chars)}")),(22,'no blank body pages',lambda:(all(c>40 for c in chars),f"min={min(chars)}")),
      (23,'system overview substantive',lambda:(len(texts[1])>300,f"chars={len(texts[1])}")),(24,'scope page count bounded',lambda:(sum(1 for p in plan if p['family'].startswith('scope'))<=max(1,(len(data.get('scope') or [])+9)//10+1),'scope plan')),
      (25,'finding pages not empty',lambda:(all(len(texts[i])>180 for i,p in enumerate(plan) if p['family'].startswith('finding')),'finding density')),
      (26,'recommendations omitted or substantive',lambda:(all(len(texts[i])>140 for i,p in enumerate(plan) if p['family']=='recommendations'),'recommendation density')),
      (27,'evidence index substantive',lambda:(all(len(texts[i])>120 for i,p in enumerate(plan) if p['family']=='evidence-index'),'evidence density')),
      (28,'conclusion substantive',lambda:(len(texts[-1])>160,f"chars={len(texts[-1])}")),(29,'no extreme density outlier',lambda:(max(chars)<4*max(400,sum(chars)/len(chars)),f"max={max(chars)} avg={sum(chars)//len(chars)}")),
      (30,'toc fits one page',lambda:(len(texts[2])<4500,f"toc chars={len(texts[2])}")),]
    for n,name,fn in balance: results.append(rec(n,name,fn))
    oc=data['results']['open_counts']; semantic=[
      (31,'product name present',lambda:(data['audit_identity']['product_name'] in full,'product name')),
      (32,'technical status present',lambda:(data['results']['technical_status'] in texts[0] and data['results']['technical_status'] in texts[3],'status on cover+summary')),
      (33,'critical count matches',lambda:(f"{oc['critical']} open Critical" in full,'critical open count')),
      (34,'high count matches',lambda:(f"{oc['high']} open High" in full,'high open count')),
      (35,'medium count matches',lambda:(f"{oc['medium']} open Medium" in full,'medium open count')),
      (36,'low count matches',lambda:(f"{oc['low']} open Low" in full,'low open count')),
      (37,'canonical finding IDs present',lambda:(all(f['id'] in full for f in data.get('findings') or []),'finding IDs')),
      (38,'scope contracts present',lambda:(all(str(x.get('name')) in full for x in data.get('scope') or []),'scope names')),
      (39,'limitations visible',lambda:(not data.get('limitations') or any('LIMIT' in t.upper() or 'QUALIFICATION' in t.upper() for t in texts),'limitations section')),
      (40,'no fuzz timeout promoted to pass',lambda:(not ('TIMEOUT' in full and re.search(r'fuzz[^\n]{0,80}\bPASS\b',full,re.I)),'fuzz semantics')),
    ]
    for n,name,fn in semantic: results.append(rec(n,name,fn))
    links=[l for p in doc for l in p.get_links()]
    hyperlink=[
      (41,'private controller links absent',lambda:(not any(any(k in str(l.get('uri','')).lower() for k in PRIVATE_PATTERNS) for l in links),'private URL scan')),
      (42,'internal link destinations valid',lambda:(all(0<=int(l.get('page',0))<page_count for l in links if l.get('kind')==fitz.LINK_GOTO),'goto range')),
      (43,'external links use https',lambda:(all(str(l.get('uri','')).startswith('https://') for l in links if l.get('uri')),'https links')),
      (44,'no temporary signed URLs',lambda:(not any('x-amz-signature' in str(l.get('uri','')).lower() or 'sig=' in str(l.get('uri','')).lower() for l in links),'signed URL scan')),
      (45,'opaque hashes not dumped unlinked',lambda:(len(re.findall(r'\b[a-f0-9]{40,64}\b',full,re.I))<=len(links)+8,'opaque identifier density')),
    ]
    for n,name,fn in hyperlink: results.append(rec(n,name,fn))
    with tempfile.TemporaryDirectory() as td:
        td=Path(td); a=render_pdfium(pdf,td/'pdfium'); b=render_poppler(pdf,td/'poppler'); diffs=[]
        for pa,pb in zip(a,b):
            ia=Image.open(pa).convert('RGB'); ib=Image.open(pb).convert('RGB').resize(ia.size); diff=ImageChops.difference(ia,ib); diffs.append(sum(ImageStat.Stat(diff).mean)/3)
        results.append(rec(46,'two renderers produced all pages',lambda:(len(a)==page_count and len(b)==page_count,f"pdfium={len(a)} poppler={len(b)}")))
        results.append(rec(47,'renderer parity mean difference',lambda:(sum(diffs)/len(diffs)<8.0,f"mean={sum(diffs)/len(diffs):.3f}")))
        results.append(rec(48,'renderer parity worst page',lambda:(max(diffs)<18.0,f"max={max(diffs):.3f}")))
        thumbs=[]
        for p in a:
            im=Image.open(p).convert('RGB'); im.thumbnail((180,255)); thumbs.append(im.copy())
        cols=4; rows=(len(thumbs)+cols-1)//cols; sheet=Image.new('RGB',(cols*190,rows*265),'white')
        for i,im in enumerate(thumbs): sheet.paste(im,((i%cols)*190,(i//cols)*265))
        contact_path.parent.mkdir(parents=True,exist_ok=True); sheet.save(contact_path); stat=ImageStat.Stat(sheet)
        results.append(rec(49,'contact sheet generated and nonblank',lambda:(contact_path.exists() and sum(stat.var)>10,f"size={sheet.size}")))
    def reader50():
        issues=[]
        if data['audit_identity']['product_name'].lower() not in texts[1].lower(): issues.append('page 2 lacks product name')
        if 'what is ' in texts[1].lower(): issues.append('question-style overview heading')
        if any(k in full.lower() for k in PRIVATE_PATTERNS): issues.append('private identifier visible')
        if any(x in full for x in ('TODO','TBD','PLACEHOLDER')): issues.append('placeholder text')
        return (not issues,', '.join(issues) or 'clean')
    results.append(rec(50,'fresh client-reader inspection',reader50))
    status='PASS' if all(x['status']=='PASS' for x in results) else 'FAIL'; payload={'schema_version':'pdf-qa-report-v1','qa_status':status,'passes':results}
    report_path.write_text(json.dumps(payload,indent=2)+"\n")
    if status!='PASS': raise RuntimeError('PDF_QA_FAILED')
    doc.close(); ref.close(); return payload

if __name__=='__main__':
    import argparse
    ap=argparse.ArgumentParser(); ap.add_argument('--pdf',type=Path,required=True); ap.add_argument('--reference',type=Path,required=True); ap.add_argument('--data',type=Path,required=True); ap.add_argument('--page-plan',type=Path,required=True); ap.add_argument('--report',type=Path,required=True); ap.add_argument('--contact-sheet',type=Path,required=True); a=ap.parse_args(); qa(a.pdf,a.reference,a.data,a.page_plan,a.report,a.contact_sheet)
