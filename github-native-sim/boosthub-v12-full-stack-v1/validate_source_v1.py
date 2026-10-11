#!/usr/bin/env python3
"""Validate exact transmitted v11 live-source members and fork scope."""
from pathlib import Path
import hashlib,json,sys
root=Path(sys.argv[1]).resolve()
manifest=root/'package_manifest_v12.json'
data=json.loads(manifest.read_text())
assert data['version']=='v12'
retained={}; omitted=[]
for path,digest in data['sha256'].items():
    file=root/path
    if not file.exists():
        assert path.startswith(('historical_evidence_v3/','verification_v3/','beefy/reference_original_stack/')) or path in ('deployment/deploy_runner_v9.cjs','deployment/deploy_runner_v2.cjs.LEGAL.txt'),f'Unexpected required file missing: {path}'
        omitted.append(path);continue
    assert hashlib.sha256(file.read_bytes()).hexdigest()==digest,f'Source mismatch {path}'
    retained[path]=digest
assert len(retained)>=50
assert (root/'contracts/BoostHubStaking.vy').read_bytes()==(root/'beefy/contracts/staking/BoostHubStaking.vy').read_bytes()
config=json.loads((root/'deployment/deployment_config_v9.json').read_text())
assert list(config['chains'])==['ethereum','fraxtal']
assert [p['pid'] for p in config['chains']['ethereum']['pools']]==[0,1]
assert [p['pid'] for p in config['chains']['fraxtal']['pools']]==[0]
assert all(p['beefy']['enabled'] for n in config['chains'].values() for p in n['pools'])
assert not any('sdyb' in json.dumps(p).lower() for n in config['chains'].values() for p in n['pools'])
(root/'build_scope_v1.json').write_text(json.dumps({'verified_exact_source_files':retained,'excluded_nonruntime_members':omitted},indent=2)+'\n')
data['sha256']=retained
manifest.write_text(json.dumps(data,indent=2)+'\n')
print('Validated exact v11 on-chain source, build and deployment files:',len(retained),'excluded historical evidence:',len(omitted))
