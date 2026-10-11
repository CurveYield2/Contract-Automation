from pathlib import Path
import json, shutil, hashlib, subprocess, os

root=Path(__file__).resolve().parent
controller=Path(os.environ['GITHUB_WORKSPACE'])/'.controller/audits/functional-verification/boosthub-four-contracts-v1'
out=root/'release_v2'; out.mkdir(exist_ok=True)
evidence=root/'evidence'; evidence.mkdir(exist_ok=True)
source_data=json.loads((evidence/'verified_explorer_sources_v1.json').read_text())
snapshot=json.loads((evidence/'live_stack_snapshot_v1.json').read_text())
assert snapshot['ethereum']['code']==snapshot['fraxtal']['code'], 'Verified Fraxtal source must bind to identical Ethereum runtime'
verified=source_data['fraxtal']['sources']
records=[]
for relative in ['interfaces/IStakeDaoGauge.sol','interfaces/IvlBoost.sol','libraries/BoostHubErrors.sol']:
    source_name='contracts/src/'+relative
    source=verified[source_name]
    assert hashlib.sha256(source['content'].encode()).hexdigest()==source['sha256']
    for target in [controller/'contracts'/relative, out/'contracts'/relative]:
        target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(source['content'].encode())
    records.append({'path':'contracts/'+relative,'verifiedSourcePath':source_name,'sha256':source['sha256']})
expected={
 'contracts/BoostHub.sol':'4eee4062bf9c0f0e09a757b83d37fd00f7270d4f19c11a15d8ebe3f7feb6e0c6',
 'contracts/interfaces/IBoostHub.sol':'5fc8b437bae0990f6c6503cac3828d26cbfe616cf9062937dfb393a9ca4332a7',
 'contracts/StakeDaoMerkleClaimExecutor.sol':'388ad1bbf3a7e3cb6d633a6e73320204b4b725038fcb8e6e01bc8dedb38bfa03',
 'contracts/BoostHubStaking.vy':'7b87d07a4af3c4a24adb6a636efec6a1e9cfe1e9c5824d2de4eb017ffceb4f0c'}
for relative,digest in expected.items():
    p=controller/relative;assert hashlib.sha256(p.read_bytes()).hexdigest()==digest
    target=out/relative;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(p,target)
shutil.copyfile(root/'contracts/BoostHubDeploymentFactory_v1.sol',out/'contracts/BoostHubDeploymentFactory_v1.sol')
shutil.copytree(root/'deployment',out/'deployment',dirs_exist_ok=True)
(out/'artifacts_v1').mkdir(exist_ok=True)
vyper={}
for fmt in ['abi','bytecode','bytecode_runtime']:
    r=subprocess.run(['vyper','--evm-version','cancun','--optimize','gas','-f',fmt,str(out/'contracts/BoostHubStaking.vy')],text=True,capture_output=True,check=True)
    vyper[fmt]=json.loads(r.stdout) if fmt=='abi' else r.stdout.strip()
staking={'contractName':'BoostHubStaking','sourceVersion':'v20','compiler':'vyper 0.4.3','evmVersion':'cancun','optimize':'gas',
 'abi':vyper['abi'],'bytecode':vyper['bytecode'],'deployedBytecode':vyper['bytecode_runtime'],'immutableReferences':{}}
assert (len(staking['deployedBytecode'])-2)//2<=24576
(out/'artifacts_v1/staking_v1.json').write_text(json.dumps(staking,indent=2))
(controller/'evidence').mkdir(exist_ok=True)
(controller/'evidence/staking.bytecode').write_text(staking['bytecode'])
provenance={'version':'v1','requestedEthereumExplorer':source_data['ethereum']['url'],'ethereumRetrievalError':source_data['ethereum'].get('error'),
 'verifiedSourceExplorer':source_data['fraxtal']['url'],'verifiedHtmlSha256':source_data['fraxtal']['htmlSha256'],
 'runtimeEquivalence':{'equal':True,'sha256':hashlib.sha256(bytes.fromhex(snapshot['ethereum']['code'][2:])).hexdigest(),
  'ethereumBlock':snapshot['ethereum']['blockNumber'],'ethereumBlockHash':snapshot['ethereum']['blockHash'],
  'fraxtalBlock':snapshot['fraxtal']['blockNumber'],'fraxtalBlockHash':snapshot['fraxtal']['blockHash']},
 'dependencies':records,'contractSourceSha256':expected,
 'openzeppelin':{'version':'5.4.0','commit':'c64a1edb67b6e3f4a15cca8909c9482ad33a02b0'},
 'solmate':{'commit':'89365b880c4f3c786bdd453d4b8e8fe410344a69'},
 'sourceVersions':{'BoostHub':'v11','IBoostHub':'v5','StakeDaoMerkleClaimExecutor':'v8','BoostHubStaking':'v20','BoostHubDeploymentFactory':'v1'}}
(out/'dependency_provenance_v1.json').write_text(json.dumps(provenance,indent=2))
(out/'live_stack_snapshot_v1.json').write_text(json.dumps(snapshot,indent=2))
print('Original dependencies recovered; four delivered sources preserved byte-for-byte; Vyper compiled')
