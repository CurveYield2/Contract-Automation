from pathlib import Path
import json,hashlib,shutil,os,re,zipfile
root=Path(__file__).resolve().parent;release=root/'release_v3';evidence=root/'evidence'
shutil.copyfile(root/'Deployment_Instructions_v2.md',release/'Deployment_Instructions_v2.md')
shutil.copyfile(root/'BoostHub_Stack_Changes_v3.md',release/'BoostHub_Stack_Changes_v3.md')
shutil.copytree(evidence,release/'verification_v3',dirs_exist_ok=True)
for source in ['RewardTokenSync_v1.t.sol','StakingHubCompatibility_v2.t.sol','runner.test_v2.mjs']:
    shutil.copyfile(root/source,release/'verification_v3'/source)
text=(evidence/'full_stack_green_v3.txt').read_text()
match=re.search(r'(\d+) tests passed, (\d+) failed, (\d+) skipped \((\d+) total tests\)',text)
assert match and int(match[2])==0 and int(match[3])==0,text[-4000:]
versions=json.loads((release/'dependency_provenance_v2.json').read_text())['sourceVersions']
runtime={}
for p in (release/'artifacts_v1').glob('*.json'):
 a=json.loads(p.read_text());runtime[a['contractName']]=(len(a['deployedBytecode'])-2)//2
report={'version':'v3','sourceVersions':versions,'executionRepository':'CurveYield2/Contract-Automation',
 'executionCommit':os.environ['GITHUB_SHA'],'runId':int(os.environ['GITHUB_RUN_ID']),
 'runUrl':f"https://github.com/CurveYield2/Contract-Automation/actions/runs/{os.environ['GITHUB_RUN_ID']}",
 'tests':{'passed':int(match[1]),'failed':0,'skipped':0,'fuzzTrials':256},
 'runtimeBytes':runtime,'forkDeployment':json.loads((evidence/'fork_deployment_results_v2.json').read_text()),
 'mainnetBroadcast':False,'rewardSyncBaseline':{'runId':38115438515,'commit':'977f799465f932fe0a2cc8de5800d2a10d410877','tests':10,'passed':0,'failed':10},'rewardSyncTests':10,'deploymentRunnerTests':9,'windowsChecks':'See matching workflow windows-powershell job; published final ZIP is retained only when that job succeeds.',
 'scope':'Compatibility and functional regression testing, not a complete security audit.'}
(release/'verification_evidence_v3.json').write_text(json.dumps(report,indent=2)+'\n')
identity={'version':'v3','contracts':{str(p.relative_to(release)):{'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in (release/'contracts').rglob('*') if p.is_file()}}
(release/'source_identity_v3.json').write_text(json.dumps(identity,indent=2)+'\n')
# The operator configuration and state are intentionally editable; all executable files remain hashed.
manifest={str(p.relative_to(release)).replace('\\','/'):hashlib.sha256(p.read_bytes()).hexdigest() for p in release.rglob('*') if p.is_file() and p.name!='package_manifest_v2.json' and p!=release/'deployment/deployment_config_v2.json'}
(release/'package_manifest_v2.json').write_text(json.dumps({'version':'v2','sha256':manifest},indent=2)+'\n')
archive=root/'BoostHub_Contract_Stack_v3.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=9)as z:
 for p in sorted(release.rglob('*')):
  if p.is_file():z.write(p,p.relative_to(release))
(root/'BoostHub_Contract_Stack_v3.sha256').write_text(hashlib.sha256(archive.read_bytes()).hexdigest()+'  '+archive.name+'\n')
print('Versioned ZIP prepared:',archive.name,'bytes',archive.stat().st_size)
