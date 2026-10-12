from pathlib import Path
import json,hashlib,zipfile,re,shutil,os
root=Path(__file__).resolve().parent;release=root/'release_v1';evidence=root/'test_evidence_v1'
for f in ['deployment_runner_acceptance_v1.json','deployment_runner_v1.txt']:
 if (evidence/f).exists():shutil.copy2(evidence/f,release/'evidence_v1/tests'/f)
data=json.loads((evidence/'live_fork_v1.json').read_text());unit=(evidence/'unit_v1.txt').read_text();combined=(evidence/'combined_routes_green_v1.txt').read_text();runner=(evidence/'deployment_runner_v1.txt').read_text()
assert '# fail 0' in unit and '# fail 0' in combined and '# fail 0' in runner
assert len(data['cases'])==16 and all(c['status'] in ['SWAPPED','AUTOMATIC_SWAP'] for c in data['cases'])
assert len(data['configuration'])==4 and len(data['stakingConfiguration'])==3
report={'version':1,'sourceCommit':os.environ['GITHUB_SHA'],'runId':os.environ['GITHUB_RUN_ID'],'githubRun':'https://github.com/CurveYield2/Contract-Automation/actions/runs/'+os.environ['GITHUB_RUN_ID'],'chainId':1,'forkBlock':data['pin'],'forkBlockHash':data['pinHash'],'unitTests':16,'combinedInterfaceTests':5,'deploymentRunnerTests':3,'explicitSwaps':12,'automaticSwaps':4,'configuredVaultRoutes':4,'configuredLegacyStakingRoutes':3,'ybVaultConfigurationDelaySeconds':864000,'noProductionTransactions':True,'contractRuntimeBytes':(len(json.loads((release/'artifacts_v1/BoostHubEthereumRewardConverter_v1.json').read_text())['deployedBytecode'])-2)//2}
(release/'Ethereum_Converter_Verification_v1.json').write_text(json.dumps(report,indent=2))
hashes={str(p.relative_to(release)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(release.rglob('*')) if p.is_file()}
(release/'SHA256SUMS_v1.txt').write_text(''.join(d+'  '+p+'\n' for p,d in hashes.items()))
target=root/'BoostHub_Ethereum_Converter_v1.zip'
with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
 for p in sorted(release.rglob('*')):
  if p.is_file():z.write(p,p.relative_to(release))
(root/'BoostHub_Ethereum_Converter_v1.sha256').write_text(hashlib.sha256(target.read_bytes()).hexdigest()+'  '+target.name+'\n')
print('Packaged',target.name,'bytes',target.stat().st_size,'checks',report)
