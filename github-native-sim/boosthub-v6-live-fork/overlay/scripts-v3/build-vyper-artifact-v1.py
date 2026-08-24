#!/usr/bin/env python3
from pathlib import Path
import argparse, hashlib, json
import vyper
from vyper.compiler import compile_code

TARGETS={
    'staking':('0.4.3','contracts/boosthub/vyper/BoostHubStaking-v17.vy','BoostHubStaking-v17'),
    'gauge':('0.3.10','contracts/gauges/CurveYieldGauge-v1.vy','CurveYieldGauge-v1'),
}
parser=argparse.ArgumentParser(); parser.add_argument('target',choices=TARGETS); args=parser.parse_args()
expected,rel,name=TARGETS[args.target]
version=getattr(vyper,'__version__','')
if version!=expected: raise SystemExit(f'expected Vyper {expected} for {args.target}, got {version}')
root=Path(__file__).resolve().parents[1]; src=root/rel; text=src.read_text()
if version.startswith('0.3.'):
    result=compile_code(text,['abi','bytecode','bytecode_runtime'])
else:
    result=compile_code(text,contract_path=str(src),output_formats=['abi','bytecode','bytecode_runtime'])
outdir=root/'artifacts-vyper-v3'; outdir.mkdir(exist_ok=True)
artifact={'contractName':name,'sourceName':rel,'compiler':'vyper','compilerVersion':version,'sourceSha256':hashlib.sha256(src.read_bytes()).hexdigest(),'abi':result['abi'],'bytecode':result['bytecode'],'bytecode_runtime':result['bytecode_runtime']}
(outdir/f'{name}.json').write_text(json.dumps(artifact,indent=2)+'\n')
print(f'wrote {outdir/f"{name}.json"}')
