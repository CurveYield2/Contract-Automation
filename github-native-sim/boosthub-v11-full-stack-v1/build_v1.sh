#!/usr/bin/env bash
set -euo pipefail
ROOT="$GITHUB_WORKSPACE/.boosthub-v11-full"
SRC=github-native-sim/boosthub-v11-full-stack-v1/source/BoostHub_v11_exact_source_v1.tar.xz
echo '6c43db8df54bee950559e80785b3a17ee59b77174afdecef1e9892a3f599391c  '${SRC} | sha256sum -c -
mkdir -p "$ROOT"
tar -xJf "$SRC" -C "$ROOT"
python3 github-native-sim/boosthub-v11-full-stack-v1/validate_source_v1.py "$ROOT"
mkdir -p "$ROOT/lib"
git clone -q --depth 1 --branch v4.9.6 https://github.com/OpenZeppelin/openzeppelin-contracts.git "$ROOT/lib/openzeppelin-4"
git clone -q --depth 1 --branch v5.4.0 https://github.com/OpenZeppelin/openzeppelin-contracts.git "$ROOT/lib/openzeppelin-5"
python3 - "$ROOT/beefy/contracts/converter/BoostHubEthereumRewardConverter_v6.sol" <<'PY'
from pathlib import Path
import sys
p=Path(sys.argv[1]); s=p.read_text()
old='0xDC24316b9AE028F1497c275EB9192a3Ea0f67022'
new='0x21E27a5E5513D6e65C4f830167390997aA84843a'
assert s.count(old)==1, 'Expected exactly one legacy stETH pool address'
p.write_text(s.replace(old,new))
print('Fork-only remediation: stETH/ETH legacy pool with NO EMA -> NG pool with proven pool price_oracle()')
PY
mkdir -p "$ROOT/ci-src"
cp -a "$ROOT/beefy/contracts/beefy" "$ROOT/ci-src/beefy"
cp -a "$ROOT/beefy/contracts/converter" "$ROOT/ci-src/converter"
cat > "$ROOT/foundry.toml" <<'EOF'
[profile.default]
src = "ci-src"
test = "unused-tests"
script = "unused-scripts"
out = "out"
libs = ["lib"]
solc_version = "0.8.28"
optimizer = true
optimizer_runs = 200
remappings = [
  "@openzeppelin-4/contracts/=lib/openzeppelin-4/contracts/",
  "@openzeppelin/contracts/=lib/openzeppelin-5/contracts/"
]
EOF
forge build --root "$ROOT" 2>&1 | tee boosthub-v11-solidity-compile-v1.log
python3 -m pip install --disable-pip-version-check --no-input 'vyper==0.4.3'
python3 github-native-sim/boosthub-v11-full-stack-v1/build_vyper_v1.py "$ROOT" 2>&1 | tee boosthub-v11-vyper-compile-v1.log
python3 "$ROOT/deployment/Import_Build_Artifacts_v4.py" \
 --staking "$ROOT/build_v1/BoostHubStaking_v22.json" \
 --strategy "$ROOT/out/StrategyConvexBoostHubStakingV5.sol/StrategyConvexBoostHubStakingV5.json" \
 --vault "$ROOT/out/BeefyVaultV7FixedV2.sol/BeefyVaultV7FixedV2.json" \
 --converter "$ROOT/out/BoostHubEthereumRewardConverter_v6.sol/BoostHubEthereumRewardConverter.json" \
 --fraxtalConverter "$ROOT/out/BoostHubFraxtalRewardConverter_v1.sol/BoostHubFraxtalRewardConverter.json" \
 2>&1 | tee boosthub-v11-artifact-import-v1.log
cd "$ROOT"
npm install --no-save --no-audit --no-fund --ignore-scripts ethers@6.15.0
node --check deployment/deploy_runner_v9.mjs
