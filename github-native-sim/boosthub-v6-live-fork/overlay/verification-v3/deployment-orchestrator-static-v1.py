from pathlib import Path
import json
root=Path(__file__).resolve().parents[1]
script=root/'deployment-v3'/'deploy-configure-suite-v1.js'
if not script.exists(): raise SystemExit('FAIL: missing deployment-v3/deploy-configure-suite-v1.js')
text=script.read_text()
required=[
 'const VAULT_LABELS=["sdCRV","sdFXN"]',
 'DEPLOYED_CRV_TO_SDCRV','DEPLOYED_CRVUSD_TO_SDCRV','DEPLOYED_WSTETH_TO_SDFXN','DEPLOYED_CRVUSD_TO_SDYB',
 'CurveYieldGauge-v1','setPoolRuntimeConfigs','poolDepositorLocked','ethers.ZeroHash.slice(0,10)',
 'deploy(ctx,`${key}Gauge`','add_reward','setCyGovChildGauge','add_external_reward',
 'for(const label of VAULT_LABELS)stacks[label]=await deployVaultStrategyGauge'
]
for x in required:
    if x not in text: raise SystemExit(f'FAIL: missing orchestrator behavior {x}')
if 'lockPoolDepositor(' in text: raise SystemExit('FAIL: orchestrator may not call permanent BoostHub depositor lock')
v=text.index('deploy(ctx,`${key}Vault`')
s=text.index('deploy(ctx,`${key}Strategy`')
g=text.index('deploy(ctx,`${key}Gauge`')
if not (v < s < g): raise SystemExit('FAIL: expected Vault -> Strategy -> Gauge ordering')
if text.count('poolDepositorLocked') < 3: raise SystemExit('FAIL: missing preflight/before/after depositor lock assertions')
config=json.loads((root/'config-mainnet-v3.json').read_text())
if 'childGauges' in config: raise SystemExit('FAIL: config still expects pre-existing ChildGauge addresses')
if any(k in config['pools']['sdYB'] for k in ['vaultName','vaultSymbol','vaultDecimals','strategyRouteTokens','strategyRouteConverterKeys']): raise SystemExit('FAIL: sdYB still contains Vault/Strategy deployment config')
print('PASS: deployment orchestrator static design constraints')
