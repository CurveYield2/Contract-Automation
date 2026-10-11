#!/usr/bin/env python3
"""Require all three exact v11 Beefy vaults to be deployed and verified."""
import json,pathlib,sys
root=pathlib.Path(sys.argv[1])
states=root/'simulation-v1/state'
report={}
for chain,chain_id,number in (('ethereum',1,2),('fraxtal',252,1)):
    path=states/f'deployment_{chain}_v1.json'
    if not path.exists(): raise AssertionError(f'Missing deployment state for {chain}')
    state=json.loads(path.read_text())
    assert state['chainId']==chain_id,(chain,state['chainId'])
    expected=['deploy/converter','deploy/helper','deploy/hub']
    expected+=sum(([f'deploy/staking/{i}',f'deploy/beefy/strategy/{i}',f'deploy/beefy/vault/{i}'] for i in range(number)),[])
    missing=[k for k in expected if state['steps'].get(k,{}).get('status')!='confirmed']
    assert not missing,f'{chain} missing live simulated contract deployments: {missing}'
    assert state['status']=='CONFIGURED_AND_VERIFIED',f'{chain} configuration not fully verified: {state["status"]}'
    assert not state.get('pendingRoles'),f'{chain} pending roles'
    assert not state.get('converterReport',{}).get('previewFailures'),f'{chain} failed converter oracle previews'
    assert not any('sdyb' in key.lower() for key in state['steps']),f'{chain} unexpected sdYB deployment'
    steps={name:int(v['gasUsed']) for name,v in state['steps'].items() if v.get('status')=='confirmed' and 'gasUsed' in v}
    report[chain]={'chainId':chain_id,'status':state['status'],'stakingDeployments':number,'beefyStrategies':number,'beefyVaults':number,'converterRoutes':len(state.get('converterReport',{}).get('activeRoutes',[])),'addresses':state.get('addresses'),'steps':steps,'totalGasUsed':sum(steps.values())}
pathlib.Path('boosthub-v13-full-summary-v1.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
