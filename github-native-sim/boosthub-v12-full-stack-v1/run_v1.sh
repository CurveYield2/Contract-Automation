#!/usr/bin/env bash
set -euo pipefail
ROOT="$GITHUB_WORKSPACE/.boosthub-v12-full"
ETH_RPC="${RPC_ETHEREUM:?Missing configured RPC_ETHEREUM secret}"
FRA_RPC="${RPC_FRAXTAL:-https://rpc.frax.com}"
test "$(timeout 25s cast chain-id --rpc-url "$ETH_RPC")" = 1
test "$(timeout 25s cast chain-id --rpc-url "$FRA_RPC")" = 252
anvil --fork-url "$ETH_RPC" --chain-id 1 --block-time 1 --port 8545 > boosthub-v12-anvil-ethereum-v1.log 2>&1 &
echo $! > .boosthub-ethereum.pid
anvil --fork-url "$FRA_RPC" --chain-id 252 --block-time 1 --port 8546 > boosthub-v12-anvil-fraxtal-v1.log 2>&1 &
echo $! > .boosthub-fraxtal.pid
for i in $(seq 1 45); do
  eth="$(timeout 5s cast chain-id --rpc-url http://127.0.0.1:8545 2>/dev/null || true)"
  fra="$(timeout 5s cast chain-id --rpc-url http://127.0.0.1:8546 2>/dev/null || true)"
  if [ "$eth" = 1 ] && [ "$fra" = 252 ]; then break; fi
  sleep 2
done
test "${eth:-}" = 1
test "${fra:-}" = 252
echo "[full-v11] Both forks are ready; entering deployment"
# Only the temporary publicly documented Anvil development account is used.
export ANVIL_TEST_KEY="$(sed -n '/Private Keys/,$p' boosthub-v12-anvil-ethereum-v1.log | grep -Eo '0x[0-9a-fA-F]{64}' | head -n1)"
test -n "$ANVIL_TEST_KEY"
export ANVIL_TEST_ADDRESS="$(cast wallet address --private-key "$ANVIL_TEST_KEY")"
python3 - <<'PY'
import pathlib,json,os
root=pathlib.Path('.boosthub-v12-full')
config=json.loads((root/'deployment/deployment_config_v9.json').read_text())
signer=os.environ['ANVIL_TEST_ADDRESS']
config['deployer']=signer
for chain in config['chains'].values():
    chain['owner']=signer
    chain['converter']['owner']=signer
    chain['maxFeePerGasGwei']='200'
    chain['priorityFeePerGasGwei']='0.05'
    for p in chain['pools']: p['stakingAdmin']=signer
out=root/'simulation-v1/fork_only_config_v1.json'
out.parent.mkdir(parents=True,exist_ok=True)
out.write_text(json.dumps(config,indent=2)+'\n')
print('Fork-only deployer/admin substitutions:',signer,'all pool economic settings unchanged')
PY
export BOOSTHUB_EXECUTE=0
# Exact production runner module invoked directly with ephemeral fork-only signer.
cat > .boosthub-v12-run-v1.mjs <<'EOF'
import {main} from './.boosthub-v12-full/deployment/deploy_runner_v9.mjs';
import path from 'node:path';
const root=path.resolve('.boosthub-v12-full');
await main({
  mode: process.env.V11_MODE || 'Deploy',
  chain: 'Both', packageRoot:root,
  configPath:path.join(root,'simulation-v1/fork_only_config_v1.json'),
  stateDirectory:path.join(root,'simulation-v1/state'),
  privateKey:process.env.ANVIL_TEST_KEY,
  deployerAddress:process.env.ANVIL_TEST_ADDRESS,
  rpcUrls:{ethereum:'http://127.0.0.1:8545',fraxtal:'http://127.0.0.1:8546'}
});
EOF
set +e
timeout -s TERM -k 10s 720s node .boosthub-v12-run-v1.mjs 2>&1 | tee boosthub-v12-full-deploy-v1.log
status=${PIPESTATUS[0]}
set -e
if [ "$status" -ne 0 ] && grep -q 'Fee timelock is still active' boosthub-v12-full-deploy-v1.log; then
  echo 'Advancing fork clocks 10 days to pass the existing timelock (fork only)'
  for port in 8545 8546; do
    cast rpc anvil_increaseTime 864000 --rpc-url "http://127.0.0.1:$port" >/dev/null
    cast rpc anvil_mine 1 --rpc-url "http://127.0.0.1:$port" >/dev/null
  done
  timeout -s TERM -k 10s 720s node .boosthub-v12-run-v1.mjs 2>&1 | tee -a boosthub-v12-full-deploy-v1.log
else
  test "$status" -eq 0
fi
python3 github-native-sim/boosthub-v12-full-stack-v1/summarize_v1.py "$ROOT"
