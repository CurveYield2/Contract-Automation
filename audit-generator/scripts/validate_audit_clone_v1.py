#!/usr/bin/env python3
import argparse, fitz, json, collections, sys

def rrect(r): return tuple(round(float(x),1) for x in r)
def rcolor(c):
    if c is None: return None
    return tuple(round(float(x),3) for x in c)

def drawing_signature(page):
    sig=[]
    for d in page.get_drawings():
        sig.append((rrect(d['rect']), round(float(d.get('width') or 0),2), rcolor(d.get('color')), rcolor(d.get('fill')), str(d.get('type'))))
    return collections.Counter(sig)

def image_signature(page):
    out=[]
    for im in page.get_image_info(xrefs=True):
        out.append((rrect(im['bbox']), int(im.get('width',0)), int(im.get('height',0))))
    return collections.Counter(out)

def styles(page):
    s=set(); sizes=[]
    d=page.get_text('dict')
    for b in d['blocks']:
        if b['type']!=0: continue
        for l in b['lines']:
            for sp in l['spans']:
                if sp['text'].strip():
                    tup=(sp['font'],round(float(sp['size']),2),int(sp['color']),int(sp['flags']))
                    s.add(tup); sizes.append(float(sp['size']))
    return s,sizes

def chars(page): return len(''.join(page.get_text('text').split()))

ap=argparse.ArgumentParser(description='Validate a CurveYield audit candidate against approved v37 visual templates.')
ap.add_argument('reference')
ap.add_argument('candidate')
ap.add_argument('--page-map', help='JSON mapping candidate_to_reference, 1-based page numbers')
ap.add_argument('--allow-geometry-pages', default='', help='Comma-separated candidate page numbers allowed to use explicit Scope/Finding geometry exceptions')
ap.add_argument('--json-out')
args=ap.parse_args()
ref=fitz.open(args.reference); cand=fitz.open(args.candidate)
allowed={int(x) for x in args.allow_geometry_pages.split(',') if x.strip()}
if args.page_map:
    m=json.load(open(args.page_map))['candidate_to_reference']
    mapping={int(k):int(v) for k,v in m.items()}
else:
    if ref.page_count!=cand.page_count:
        print('FAIL: page count differs; provide --page-map for an elastic report.',file=sys.stderr); sys.exit(2)
    mapping={i:i for i in range(1,cand.page_count+1)}
results=[]; failures=[]; warnings=[]
for cp in range(1,cand.page_count+1):
    if cp not in mapping:
        failures.append(f'candidate page {cp}: missing template mapping'); continue
    rp=mapping[cp]
    if rp<1 or rp>ref.page_count:
        failures.append(f'candidate page {cp}: invalid reference template page {rp}'); continue
    a=ref[rp-1]; b=cand[cp-1]
    rec={'candidate_page':cp,'reference_page':rp,'checks':{}}
    size_ok=abs(a.rect.width-b.rect.width)<0.25 and abs(a.rect.height-b.rect.height)<0.25
    rec['checks']['page_size']=size_ok
    if not size_ok: failures.append(f'page {cp}: page size/orientation drift')
    sa,_=styles(a); sb,sizes_b=styles(b)
    new_styles=sorted(sb-sa)
    rec['checks']['new_text_styles']=new_styles
    if new_styles: failures.append(f'page {cp}: new font/size/color/style tuples not present in mapped template: {new_styles[:5]}')
    if sizes_b and min(sizes_b)<5.8:
        failures.append(f'page {cp}: text below 5.8 pt ({min(sizes_b):.2f})')
    if cp not in allowed:
        dg_ok=drawing_signature(a)==drawing_signature(b)
        im_ok=image_signature(a)==image_signature(b)
        rec['checks']['drawing_geometry']=dg_ok; rec['checks']['images']=im_ok
        if not dg_ok: failures.append(f'page {cp}: vector drawing geometry differs from mapped template')
        if not im_ok: failures.append(f'page {cp}: image placement/count differs from mapped template')
    else:
        rec['checks']['drawing_geometry']='EXPLICIT_EXCEPTION'; rec['checks']['images']='EXPLICIT_EXCEPTION'
    ca,cb=chars(a),chars(b); ratio=(cb/ca if ca else 1.0); rec['checks']['nonspace_character_ratio']=round(ratio,3)
    if ratio<0.6 or ratio>1.4: warnings.append(f'page {cp}: total character density ratio {ratio:.2f}; inspect copy fit/filler/page scaling')
    results.append(rec)
report={'reference':args.reference,'candidate':args.candidate,'candidate_pages':cand.page_count,'failures':failures,'warnings':warnings,'pages':results,'status':'PASS' if not failures else 'FAIL'}
if args.json_out: json.dump(report,open(args.json_out,'w'),indent=2)
print(json.dumps(report,indent=2))
sys.exit(0 if not failures else 1)
