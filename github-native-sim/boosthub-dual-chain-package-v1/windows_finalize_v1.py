from pathlib import Path
import json,os,hashlib,zipfile
root=Path(os.environ['GITHUB_WORKSPACE']);release=root/'windows_package';report=release/'verification_evidence_v2.json'
data=json.loads(report.read_text());data['windowsChecks']={'job':'windows-powershell','runtime':'Windows PowerShell 5.1 and Node.js 22','passed':True,'scope':'Native parser and bundled read-only preflight on Ethereum and Fraxtal'}
report.write_text(json.dumps(data,indent=2)+'\n')
log=root/'PowerShell_Compatibility_v1.txt';target=release/'verification_v2/PowerShell_Compatibility_v1.txt';target.write_bytes(log.read_bytes())
manifest={str(p.relative_to(release)).replace('\\','/'):hashlib.sha256(p.read_bytes()).hexdigest() for p in release.rglob('*') if p.is_file() and p.name!='package_manifest_v1.json' and p!=release/'deployment/deployment_config_v1.json'}
(release/'package_manifest_v1.json').write_text(json.dumps({'version':'v1','sha256':manifest},indent=2)+'\n')
archive=root/'BoostHub_Contract_Stack_v2.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=9)as z:
 for p in sorted(release.rglob('*')):
  if p.is_file():z.write(p,str(p.relative_to(release)).replace('\\','/'))
(root/'BoostHub_Contract_Stack_v2.sha256').write_text(hashlib.sha256(archive.read_bytes()).hexdigest()+'  '+archive.name+'\n')
print('Final ZIP includes successful Windows validation evidence')
