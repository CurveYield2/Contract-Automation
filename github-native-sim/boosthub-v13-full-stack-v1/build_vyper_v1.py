#!/usr/bin/env python3
"""Build the exact BoostHub v11 staking artifact with Vyper 0.4.3, on GitHub only."""
from pathlib import Path
import json,sys,vyper
root=Path(sys.argv[1]).resolve()
source=root/"contracts/BoostHubStaking.vy"
assert source.is_file(),source
compiled=vyper.compile_code(source.read_text(),output_formats=["abi","bytecode","bytecode_runtime"],contract_path=str(source))
result={"contractName":"BoostHubStaking","sourceVersion":"v22","abi":compiled["abi"],"bytecode":compiled["bytecode"],"deployedBytecode":compiled["bytecode_runtime"],"immutableReferences":{}}
out=root/"build_v1/BoostHubStaking_v22.json"
out.parent.mkdir(parents=True,exist_ok=True)
out.write_text(json.dumps(result,indent=2)+"\n")
print(f"Vyper {vyper.__version__}, staking runtime bytes: {(len(result['deployedBytecode'])-2)//2}")
print(out)
