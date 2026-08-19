#!/usr/bin/env python3
"""Frozen-template renderer v1.

Copies approved PDF pages and mutates text/link annotations only, except the two
explicitly-approved geometry families: compact Scope and multi-Finding pages.
"""
from __future__ import annotations
import json,re
from pathlib import Path
from typing import Any
import fitz
OLD_PRODUCT_TOKENS=("sdyb","v31.28.27","curveyield sdyb vault","cde67c2b8732668887b45c796c4854d680d2726b")
def rgb(color_int:int): return ((color_int>>16&255)/255.0,(color_int>>8&255)/255.0,(color_int&255)/255.0)
def block_style(block:dict[str,Any])->dict[str,Any]:
    s=block["styles"][0]; font=s["font"]; mapping={"Helvetica":"helv","Helvetica-Bold":"hebo","Courier":"cour","Courier-Bold":"cobo"}
    return {"fontname":mapping.get(font,"F2+0" if "Bold" in font else "F3+0"),"fontsize":float(s["size"]),"color":rgb(int(s["color"]))}
def fit_text(page:fitz.Page,block:dict[str,Any],text:str,align:int=0)->None:
    text=text or ""
    if not text:return
    hard_max=int(block.get("hard_max_chars") or max(1,block.get("char_count",1)*1.3))
    if len(text)>hard_max and "\n" not in text: raise RuntimeError(f"CONTENT_REWRITE_REQUIRED:{len(text)}>{hard_max}:{text[:60]}")
    style=block_style(block); rect=fitz.Rect(block["bbox"])
    result=page.insert_textbox(rect,text,fontname=style["fontname"],fontsize=style["fontsize"],color=style["color"],align=align,overlay=True)
    if result<-.1: raise RuntimeError(f"TEXT_OVERFLOW:{text[:60]}")
def redact_all_text(page:fitz.Page,blocks:list[dict[str,Any]])->None:
    for b in blocks: page.add_redact_annot(fitz.Rect(b["bbox"]),fill=None)
    page.apply_redactions(images=0,graphics=0,text=0)
def md_chunks(records:list[dict[str,str]],max_chars:int=500)->list[str]:
    out=[]
    for rec in records:
        text=rec.get("text",""); text=re.sub(r"```.*?```","",text,flags=re.S)
        for part in re.split(r"\n\s*\n",text):
            p=re.sub(r"^#{1,6}\s*","",part.strip()); p=re.sub(r"\s+"," ",p)
            if not p:continue
            while len(p)>max_chars:
                cut=p.rfind(". ",0,max_chars)
                if cut<max_chars//2:cut=p.rfind(" ",0,max_chars)
                if cut<1:raise RuntimeError("CONTENT_REWRITE_REQUIRED:unbreakable-markdown")
                out.append(p[:cut+1].strip()); p=p[cut+1:].strip()
            if p:out.append(p)
    return out
def header_footer_values(data:dict[str,Any],family:str,page_no:int,total:int)->tuple[str,str]:
    product=data["audit_identity"]["product_name"]; version=data["audit_identity"].get("audit_version") or data["audit_identity"].get("output_version") or "v1"
    return f"CurveYield Security {version}",f"CurveYield {product} Security Audit {version}  |  {page_no} of {total}"
def generic_page(page:fitz.Page,blocks:list[dict[str,Any]],data:dict[str,Any],family:str,page_no:int,total:int,content:list[str])->None:
    redact_all_text(page,blocks); header,footer=header_footer_values(data,family,page_no,total); content_iter=iter(content)
    for i,b in enumerate(blocks):
        ref=b.get("reference_text",""); low=ref.lower()
        if i==0 and page_no!=1 and b["bbox"][1]<30: fit_text(page,b,header)
        elif b["bbox"][1]>790: fit_text(page,b,footer)
        elif re.match(r"^\d{2}\s",ref): fit_text(page,b,re.sub(r"^\d{2}",f"{page_no:02d}",ref))
        elif any(t in low for t in OLD_PRODUCT_TOKENS) or re.search(r"\b(run\s+)?\d{6,}\b",low) or re.search(r"\b[mlhi]-\d+\b",low):
            try:fit_text(page,b,next(content_iter))
            except StopIteration:pass
        elif b["styles"][0]["size"]>=8.0 and "Bold" in b["styles"][0]["font"]: fit_text(page,b,ref)
        else:
            try:fit_text(page,b,next(content_iter))
            except StopIteration:pass
def render_cover(page,blocks,data,page_no,total):
    redact_all_text(page,blocks); product=data["audit_identity"]["product_name"]; version=data["audit_identity"].get("audit_version") or data["audit_identity"].get("output_version") or "v1"; status=data["results"]["technical_status"]; oc=data["results"]["open_counts"]
    values={0:"CurveYield",1:f"{product}  /  {version}",2:"CurveYield Security",3:"Smart-contract security audit",4:"Canonical source review, adversarial evidence, remediation verification, and release qualification",5:status,6:"TECHNICAL STATUS",7:"FINAL FINDING STATE",8:"  |  ".join(f"{f['id']} {f['status'].replace('_',' ').lower()}" for f in data.get('findings',[])[:4]) or "No validated findings",9:f"{oc['critical']} open Critical  /  {oc['high']} open High  /  {oc['medium']} open Medium  /  {oc['low']} open Low",10:f"AUDIT PERIOD {data['audit_identity'].get('audit_period') or 'Campaign-defined'}",11:f"REPORT DATE {data['audit_identity'].get('report_date') or 'Build date recorded in manifest'}",12:f"DEPLOYMENT STATE {data.get('release',{}).get('deploymentState') or data.get('release',{}).get('releaseState') or 'Campaign-defined'}",13:f"CurveYield {product} Security Audit {version}  |  1 of {total}"}
    for i,b in enumerate(blocks):fit_text(page,b,values.get(i,""))
def render_overview(page,blocks,data,overview,page_no,total):
    redact_all_text(page,blocks); product=data["audit_identity"]["product_name"]; paras=overview["paragraphs"]; scope_n=len(data.get("scope") or []); metrics=[str(scope_n or "-")+" AUDITED CONTRACTS",str(len(data.get('findings') or []))+" VALIDATED FINDINGS",data["results"]["technical_status"]+" TECHNICAL STATUS"]
    values={0:f"CurveYield Security {data['audit_identity'].get('output_version','v1')}",1:f"CurveYield {product} Security Audit  |  {page_no} of {total}",2:f"{page_no:02d} SYSTEM OVERVIEW",3:f"Product context for {product}",4:product.upper(),5:paras[0] if paras else "",6:paras[1] if len(paras)>1 else (paras[0] if paras else ""),7:metrics[0],8:"canonical audited scope",9:metrics[1],10:"canonical finding ledger",11:metrics[2],12:"release disposition",13:"CURRENT AUDITED CONFIGURATION",21:"WHAT THE SYSTEM AUTOMATES"}
    if len(paras)>2:values[23]=paras[2]
    arch=data.get("product_context",{}).get("architecture_labels") or []; arch_slots=[14,15,16,17,18,19,20,22,24,25,26,27,28,29,30,31,32,33,34,35]
    for i,b in enumerate(blocks):
        if i in values:fit_text(page,b,values[i])
        elif i in arch_slots:
            idx=arch_slots.index(i)
            if idx<len(arch):fit_text(page,b,str(arch[idx]))
def render_toc(page,blocks,data,plan,page_no,total):
    redact_all_text(page,blocks); labels=[]; seen=set(); names={"system-overview":"System Overview","executive-summary":"Executive Summary","scope-standard":"Scope","scope-compact":"Scope","threat-model":"Security Considerations & Threat Model","methodology":"Audit Methodology & Security Processes","results":"Audit Results","security-claims":"Security Claims & Assurance Evidence","qualifications":"Informational & Release Qualifications","recommendations":"Recommendations","evidence-index":"Evidence Index","conclusion":"Conclusion"}
    for idx,p in enumerate(plan,1):
        fam=p["family"]
        if fam.startswith("finding"):
            for fid in p.get("finding_ids",[]):labels.append((f"{p.get('severity','')} Severity Issue - {fid}",idx))
        elif fam=="remediation":labels.append((f"{', '.join(p.get('finding_ids',[]))} Remediation & Verification",idx))
        elif fam in names and fam not in seen:labels.append((names[fam],idx));seen.add(fam)
    values=[f"{label} {pno:02d}" for label,pno in labels[:15]]
    for i,b in enumerate(blocks):
        if i<15:fit_text(page,b,values[i] if i<len(values) else "")
        elif i==15:fit_text(page,b,f"CurveYield Security {data['audit_identity'].get('output_version','v1')}")
        elif i==16:fit_text(page,b,f"{page_no:02d} TABLE OF CONTENTS")
        elif i==17:fit_text(page,b,"Report structure and finding locations")
        elif i==18:fit_text(page,b,f"CurveYield {data['audit_identity']['product_name']} Security Audit  |  {page_no} of {total}")
def render_summary(page,blocks,data,page_no,total):
    redact_all_text(page,blocks);oc=data["results"]["open_counts"];findings=data.get("findings") or []
    values={0:"FINDING DISPOSITION",4:"AUDIT IDENTITY",9:f"CurveYield Security {data['audit_identity'].get('output_version','v1')}",10:f"{page_no:02d} EXECUTIVE SUMMARY",11:"Final security position and the evidence that drove it",12:f"CurveYield {data['audit_identity']['product_name']} Security Audit Summary  |  {page_no} of {total}",13:"TECHNICAL STATUS",14:data['results']['technical_status'],15:("No open Critical or High findings." if not oc['critical'] and not oc['high'] else "Validated release-blocking findings remain open."),16:"OPEN FINDINGS",17:f"{oc['critical']} open",18:"Critical",19:f"{oc['high']} open",20:"High",21:f"{oc['medium']} open",22:"Medium",23:f"{oc['low']} open",24:"Low",25:"KEY EVIDENCE"}
    for j,f in enumerate(findings[:3],start=1):values[j]=f"{f['id']} {f['severity']} - {f['title']}";values[39+j]=f['status'].replace('_',' ')
    values[5]=f"AUDIT CAMPAIGN {data['audit_identity'].get('campaign_generation_id') or 'canonical campaign'}";values[6]=f"AUDIT VERSION {data['audit_identity'].get('output_version','v1')}";values[7]="FINAL COMPILER PROFILE "+("evidence present" if data.get('compiler',{}).get('known') else "not claimed");values[8]=f"RELEASE STATE {data['audit_identity'].get('campaign_status') or 'canonical campaign state'}"
    metrics=[len(data.get('scope') or []),len(data.get('evidence') or []),len(data.get('fork_runs') or []),len(data.get('tests') or [])]
    for idx,val in zip([26,28,30,32],metrics):values[idx]=str(val)
    for idx,label in zip([27,29,31,33],["audited contracts","evidence records","fork records","test records"]):values[idx]=label
    for i,b in enumerate(blocks):fit_text(page,b,str(values.get(i,"")))
def render_scope_standard(page,blocks,data,slice_,page_no,total):
    redact_all_text(page,blocks);items=data.get('scope',[])[slice_[0]:slice_[1]];product=data['audit_identity']['product_name'];values={10:f"CurveYield Security {data['audit_identity'].get('output_version','v1')}",11:f"{page_no:02d} SCOPE",12:f"Audited production contracts for {product}",13:f"CurveYield {product} Security Audit Scope  |  {page_no} of {total}",14:"RELEASE STATE",15:"Only contracts in the canonical audited scope are listed on this page.",0:f"Canonical audited scope contains {len(data.get('scope') or [])} contract(s)."};slots=[(1,2,3,17),(4,5,6,18),(7,8,9,19)]
    for idx,item in enumerate(items[:3]):a,b,c,d=slots[idx];values[a]=f"{slice_[0]+idx+1} {item.get('name','')}";values[b]=str(item.get('version') or '');values[c]=str(item.get('role') or 'Audited contract');values[d]=str(item.get('status') or 'REVIEWED').replace('_',' ')
    for i,b in enumerate(blocks):fit_text(page,b,str(values.get(i,"")))
def render_scope_compact(page,blocks,data,slice_,page_no,total):
    redact_all_text(page,blocks);product=data['audit_identity']['product_name'];items=data.get('scope',[])[slice_[0]:slice_[1]]
    for i,b in enumerate(blocks):
        if i==10:fit_text(page,b,f"CurveYield Security {data['audit_identity'].get('output_version','v1')}")
        elif i==11:fit_text(page,b,f"{page_no:02d} SCOPE")
        elif i==12:fit_text(page,b,f"Canonical audited scope - {len(data.get('scope') or [])} contracts")
        elif i==13:fit_text(page,b,f"CurveYield {product} Security Audit Scope  |  {page_no} of {total}")
    x0,x1=62,533;gap=18;colw=(x1-x0-gap)/2;y=150;cardh=108;rowgap=12
    for n,item in enumerate(items[:10]):
        row=n//2;col=n%2;left=x0+col*(colw+gap);top=y+row*(cardh+rowgap);rect=fitz.Rect(left,top,left+colw,top+cardh);shape=page.new_shape();shape.draw_rect(rect);shape.finish(color=(.82,.84,.86),fill=None,width=.7);shape.commit(overlay=True)
        title=f"{slice_[0]+n+1} {item.get('name','')}";role=str(item.get('role') or 'Audited contract');status=str(item.get('status') or 'REVIEWED').replace('_',' ')
        if page.insert_textbox(fitz.Rect(left+9,top+10,left+colw-9,top+31),title,fontname='hebo',fontsize=8.5,color=(.10,.12,.16))<0:raise RuntimeError('CONTENT_REWRITE_REQUIRED:scope-title')
        if page.insert_textbox(fitz.Rect(left+9,top+39,left+colw-9,top+76),role,fontname='helv',fontsize=7.7,color=(.32,.35,.40))<0:raise RuntimeError('CONTENT_REWRITE_REQUIRED:scope-role')
        page.insert_textbox(fitz.Rect(left+9,top+82,left+colw-9,top+99),status,fontname='hebo',fontsize=6.8,color=(.12,.48,.32))
def render_finding(page,blocks,data,spec,page_no,total):
    findings={f['id']:f for f in data.get('findings',[])};fs=[findings[x] for x in spec.get('finding_ids',[]) if x in findings];content=[]
    for f in fs:content += [f"{f['id']} - {f['title']}",f"Status: {f['status'].replace('_',' ')}",str(f.get('description') or ''),str(f.get('impact') or ''),str(f.get('exploit_or_failure_mechanics') or ''),str(f.get('remediation') or ''),"Verification: "+json.dumps(f.get('verification') or [])]
    generic_page(page,blocks,data,spec['family'],page_no,total,[x for x in content if x])
def render_section(page,blocks,data,spec,page_no,total):
    family=spec['family']
    if family=='cover':return render_cover(page,blocks,data,page_no,total)
    if family=='system-overview':return render_overview(page,blocks,data,data['_overview'],page_no,total)
    if family=='toc':return render_toc(page,blocks,data,data['_page_plan'],page_no,total)
    if family=='executive-summary':return render_summary(page,blocks,data,page_no,total)
    if family=='scope-standard':return render_scope_standard(page,blocks,data,spec['scope_slice'],page_no,total)
    if family=='scope-compact':return render_scope_compact(page,blocks,data,spec['scope_slice'],page_no,total)
    if family.startswith('finding') or family=='remediation':return render_finding(page,blocks,data,spec,page_no,total)
    if family in {'methodology','results','security-claims','threat-model'}:content=md_chunks(data.get('methodology') or [],max_chars=420)
    elif family=='qualifications':content=md_chunks(data.get('limitations') or [],max_chars=420)
    elif family=='recommendations':
        content=md_chunks(data.get('recommendations') or [],max_chars=420)
        if not content:
            for f in data.get('findings') or []:
                if f.get('remediation'):content.append(f"{f['id']} - {f['remediation']}")
    elif family=='evidence-index':content=[f"{e['role']}  {Path(e['path']).name}" for e in data.get('evidence') or []]
    elif family=='conclusion':
        oc=data['results']['open_counts'];content=[f"Final disposition: {data['results']['technical_status']}",f"Open findings: {oc['critical']} Critical / {oc['high']} High / {oc['medium']} Medium / {oc['low']} Low",f"Canonical campaign: {data['audit_identity'].get('campaign_generation_id') or 'recorded in build manifest'}"]+[f"{f['id']} {f['severity']} {f['status'].replace('_',' ')} - {f['title']}" for f in data.get('findings') or []]
    else:content=[]
    return generic_page(page,blocks,data,family,page_no,total,content)
def render(reference:Path,budgets_path:Path,data_path:Path,overview_path:Path,plan_path:Path,output:Path):
    data=json.loads(data_path.read_text());overview=json.loads(overview_path.read_text());plan=json.loads(plan_path.read_text());budgets=json.loads(budgets_path.read_text());data['_overview']=overview;data['_page_plan']=plan;by_page={p['page']:p for p in budgets['pages']};ref=fitz.open(reference);out=fitz.open();total=len(plan)
    for page_no,spec in enumerate(plan,1):
        t=int(spec['template_page']);out.insert_pdf(ref,from_page=t-1,to_page=t-1);page=out[-1];blocks=by_page[t]['text_blocks'];render_section(page,blocks,data,spec,page_no,total)
    output.parent.mkdir(parents=True,exist_ok=True);out.save(output,garbage=4,deflate=True);out.close();ref.close()
if __name__=='__main__':
    import argparse
    ap=argparse.ArgumentParser();ap.add_argument('--reference',type=Path,required=True);ap.add_argument('--budgets',type=Path,required=True);ap.add_argument('--data',type=Path,required=True);ap.add_argument('--overview',type=Path,required=True);ap.add_argument('--page-plan',type=Path,required=True);ap.add_argument('--output',type=Path,required=True);a=ap.parse_args();render(a.reference,a.budgets,a.data,a.overview,a.page_plan,a.output)
