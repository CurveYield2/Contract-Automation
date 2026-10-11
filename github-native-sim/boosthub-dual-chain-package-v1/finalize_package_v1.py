from pathlib import Path
import json,hashlib,shutil,os,re,zipfile
root=Path(__file__).resolve().parent;release=root/'release_v2';evidence=root/'evidence'
shutil.copyfile(root/'Deployment_Instructions_v1.md',release/'Deployment_Instructions_v1.md')
shutil.copyfile(root/'BoostHub_Stack_Changes_v2.md',release/'BoostHub_Stack_Changes_v2.md')
shutil.copytree(evidence,release/'verification_v2',dirs_exist_ok=True)
text=(evidence/'full_stack_green_v2.txt').read_text()
match=re.search(r'(\d+) tests passed, (\d+) failed, (\d+) skipped \((\d+) total tests\)',text)
assert match and int(match[2])==0 and int(match[3])==0,text[-4000:]
versions=json.loads((release/'dependency_provenance_v1.json').read_text())['sourceVersions']
runtime={}
for p in (release/'artifacts_v1').glob('*.json'):
 a=json.loads(p.read_text());runtime[a['contractName']]=(len(a['deployedBytecode'])-2)//2
report={'version':'v2','sourceVersions':versions,'executionRepository':'CurveYield2/Contract-Automation',
 'executionCommit':os.environ['GITHUB_SHA'],'runId':int(os.environ['GITHUB_RUN_ID']),
 'runUrl':f"https://github.com/CurveYield2/Contract-Automation/actions/runs/{os.environ['GITHUB_RUN_ID']}",
 'tests':{'passed':int(match[1]),'failed':0,'skipped':0,'fuzzTrials':256},
 'runtimeBytes':runtime,'forkDeployment':json.loads((evidence/'fork_deployment_results_v1.json').read_text()),
 'mainnetBroadcast':False,'windowsChecks':'See matching workflow windows-powershell job; published final ZIP is retained only when that job succeeds.',
 'scope':'Compatibility and functional regression testing, not a complete security audit.'}
(release/'verification_evidence_v2.json').write_text(json.dumps(report,indent=2)+'\n')
identity={'version':'v2','contracts':{str(p.relative_to(release)):{'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in (release/'contracts').rglob('*') if p.is_file()}}
(release/'source_identity_v2.json').write_text(json.dumps(identity,indent=2)+'\n')
# The operator configuration and state are intentionally editable; all executable files remain hashed.
manifest={str(p.relative_to(release)).replace('\\','/'):hashlib.sha256(p.read_bytes()).hexdigest() for p in release.rglob('*') if p.is_file() and p.name!='package_manifest_v1.json' and p!=release/'deployment/deployment_config_v1.json'}
(release/'package_manifest_v1.json').write_text(json.dumps({'version':'v1','sha256':manifest},indent=2)+'\n')
archive=root/'BoostHub_Contract_Stack_v2.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=9)as z:
 for p in sorted(release.rglob('*')):
  if p.is_file():z.write(p,p.relative_to(release))
(root/'BoostHub_Contract_Stack_v2.sha256').write_text(hashlib.sha256(archive.read_bytes()).hexdigest()+'  '+archive.name+'\n')
print('Versioned ZIP prepared:',archive.name,'bytes',archive.stat().st_size)
