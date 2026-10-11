from pathlib import Path
import urllib.request, json
from harvest_verified_sources_v1 import Pres
root=Path(__file__).resolve().parent
address='0xaFCC5492e0217D540A4A73408eeb1AdF2902fA43'
req=urllib.request.Request('https://fraxscan.com/address/'+address,headers={'User-Agent':'Mozilla/5.0'})
raw=urllib.request.urlopen(req,timeout=20).read().decode()
p=Pres();p.feed(raw)
abi=None
for value in p.items.values():
 try:
  obj=json.loads(value)
  if isinstance(obj,list) and obj and all(isinstance(i,dict) and 'type' in i for i in obj):abi=obj;break
 except Exception:pass
result={'address':address,'abi':abi,'sources':p.sources}
(root/'evidence/fraxtal_live_dependency_v1.json').write_text(json.dumps(result,indent=2))
print('Fraxtal shared dependency functions:',[i['name'] for i in abi or [] if i['type']=='function'])
print('Fraxtal dependency source files:',list(p.sources))
