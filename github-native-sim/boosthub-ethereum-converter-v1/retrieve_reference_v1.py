from pathlib import Path
import zipfile,hashlib,json
base=Path('.controller/campaigns/Boosthub Staking v2/source');out=Path('github-native-sim/boosthub-ethereum-converter-v1/reference_evidence_v1');out.mkdir(parents=True,exist_ok=True)
manifest={}
for package in base.glob('*.zip'):
 digest=hashlib.sha256(package.read_bytes()).hexdigest()
 if package.name.endswith('Remediated-v4.zip'):assert digest=='4b502a2040712da8e6f4e80165ed74c8e3f492226e60141bc23ac8585a3855d4'
 files=[]
 with zipfile.ZipFile(package) as z:
  for n in z.namelist():
   if n.endswith('.sol') and ('Converter' in n or 'SdYb' in n):
    target=out/package.stem/Path(n).name;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(z.read(n));files.append({'path':n,'sha256':hashlib.sha256(z.read(n)).hexdigest()})
 manifest[package.name]={'sha256':digest,'files':files}
 print(package.name, digest, 'converter files',files)
(out/'reference_packages_v1.json').write_text(json.dumps(manifest,indent=2))
