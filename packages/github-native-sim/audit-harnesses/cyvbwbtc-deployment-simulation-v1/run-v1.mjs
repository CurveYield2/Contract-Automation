#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { startAnvilEngine } from '../../../runner/src/anvil-engine.mjs';

const ROUTER = '0x01F9894f92ea9224fECc8C35482E20a05De13582';
const SAFE = '0x47623C62f281807D615eeb4A2CEee9d97F9D3C49';
const VBWBTC = '0x0913DA6Da4b42f538B445599b46Bb4622342Cf52';
const VBUSDC = '0x203A662b0BD271A6ed5a60EdFbd04bFce608FD36';
const FXUSD = '0x1364b238C668A2dec1294174e4798E8c09979f86';
const FUNDING_ACCOUNT = '0x3Ef3D8bA38EBe18DB133cEc108f4D14CE00Dd9Ae';

const FXUSD_TO_VBUSDC = '0x1364b238c668a2dec1294174e4798e8c09979f86000064203a662b0bd271a6ed5a60edfbd04bfce608fd36';
const VBUSDC_TO_FXUSD = '0x203a662b0bd271a6ed5a60edfbd04bfce608fd360000641364b238c668a2dec1294174e4798e8c09979f86';
const VBUSDC_TO_VBWBTC = '0x203a662b0bd271a6ed5a60edfbd04bfce608fd360001f40913da6da4b42f538b445599b46bb4622342cf52';

const DEV_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const SIM_DEPOSIT_AMOUNT = 200000n;

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    out[argv[i].slice(2)] = argv[++i];
  }
  return out;
}

function lower(x) {
  return String(x).toLowerCase();
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function run(command, args, { cwd, env = {} } = {}) {
  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
      process.stdout.write(chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
      process.stderr.write(chunk);
    });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

async function safeExec({ safe, router, owner, data, ethers }) {
  const signature = ethers.solidityPacked(
    ['uint256', 'uint256', 'uint8'],
    [BigInt(owner), 0n, 1]
  );
  const tx = await safe.execTransaction(
    await router.getAddress(),
    0n,
    data,
    0,
    0n,
    0n,
    0n,
    ethers.ZeroAddress,
    ethers.ZeroAddress,
    signature,
    { gasLimit: 5_000_000n }
  );
  const receipt = await tx.wait();
  assert(receipt.status === 1, 'Safe router configuration transaction failed');
}

async function configureRoute({ provider, ethers, tokenIn, tokenOut, route }) {
  const routerAbi = [
    'function routeFor(address,address) view returns (bytes)',
    'function routeTwapGuard(address,address) view returns (uint32,uint16,bool)',
    'function setRoute(address,address,bytes)',
    'function setRouteFeeBps(address,address,uint16)',
    'function setRouteTwapGuard(address,address,uint32,uint16)'
  ];
  const safeAbi = [
    'function getOwners() view returns (address[])',
    'function getThreshold() view returns (uint256)',
    'function execTransaction(address,uint256,bytes,uint8,uint256,uint256,uint256,address,address,bytes) returns (bool)'
  ];

  const routerRead = new ethers.Contract(ROUTER, routerAbi, provider);
  const current = await routerRead.routeFor(tokenIn, tokenOut);
  if (current !== '0x') {
    assert(lower(current) === lower(route), `unexpected existing route ${tokenIn} -> ${tokenOut}`);
    return { installedBySimulation: false, route: current };
  }

  const safeRead = new ethers.Contract(SAFE, safeAbi, provider);
  const threshold = await safeRead.getThreshold();
  const owners = await safeRead.getOwners();
  assert(threshold === 1n, 'CurveYield Safe threshold is not 1');
  assert(owners.length > 0, 'CurveYield Safe has no owners');

  const owner = owners[0];
  await provider.send('anvil_impersonateAccount', [owner]);
  await provider.send('anvil_setBalance', [owner, '0x56BC75E2D63100000']);

  const signer = await provider.getSigner(owner);
  const safe = new ethers.Contract(SAFE, safeAbi, signer);
  const router = new ethers.Contract(ROUTER, routerAbi, signer);

  await safeExec({
    safe,
    router,
    owner,
    data: router.interface.encodeFunctionData('setRoute', [tokenIn, tokenOut, route]),
    ethers,
  });
  await safeExec({
    safe,
    router,
    owner,
    data: router.interface.encodeFunctionData('setRouteFeeBps', [tokenIn, tokenOut, 0]),
    ethers,
  });
  await safeExec({
    safe,
    router,
    owner,
    data: router.interface.encodeFunctionData('setRouteTwapGuard', [tokenIn, tokenOut, 900, 200]),
    ethers,
  });

  const installed = await routerRead.routeFor(tokenIn, tokenOut);
  const guard = await routerRead.routeTwapGuard(tokenIn, tokenOut);
  assert(lower(installed) === lower(route), 'fork route did not persist');
  assert(Number(guard[0]) === 900 && Number(guard[1]) === 200 && guard[2] === true, 'TWAP guard mismatch');

  return {
    installedBySimulation: true,
    owner,
    route: installed,
    guard: [Number(guard[0]), Number(guard[1]), guard[2]],
  };
}

async function fundSimulation({ provider, ethers, account0 }) {
  const tokenAbi = [
    'function balanceOf(address) view returns (uint256)',
    'function transfer(address,uint256) returns (bool)'
  ];
  const token = new ethers.Contract(VBWBTC, tokenAbi, provider);
  const sourceBalance = await token.balanceOf(FUNDING_ACCOUNT);
  assert(sourceBalance >= SIM_DEPOSIT_AMOUNT, 'fork funding account lacks vbWBTC');

  await provider.send('anvil_impersonateAccount', [FUNDING_ACCOUNT]);
  await provider.send('anvil_setBalance', [FUNDING_ACCOUNT, '0x56BC75E2D63100000']);
  const signer = await provider.getSigner(FUNDING_ACCOUNT);
  const writable = token.connect(signer);
  const tx = await writable.transfer(account0, SIM_DEPOSIT_AMOUNT);
  const receipt = await tx.wait();
  assert(receipt.status === 1, 'fork vbWBTC funding transfer failed');

  const funded = await token.balanceOf(account0);
  assert(funded >= SIM_DEPOSIT_AMOUNT, 'Anvil account0 not funded with vbWBTC');
  return {
    source: FUNDING_ACCOUNT,
    sourceBalanceBefore: sourceBalance.toString(),
    account0BalanceAfter: funded.toString(),
    amount: SIM_DEPOSIT_AMOUNT.toString(),
  };
}

async function writeEphemeralFoundryConfig(root) {
  const config = [
    '[profile.default]',
    'solc = "0.8.30"',
    'src = "cyvbWBTC/contracts"',
    'script = "cyvbWBTC/script"',
    'test = "cyvbWBTC/test"',
    'out = "out"',
    'libs = ["lib"]',
    'optimizer = true',
    'optimizer_runs = 10000000',
    'evm_version = "cancun"',
    ''
  ].join('\n');
  await fs.writeFile(path.join(root, 'foundry.toml'), config);
}

async function main() {
  const args = parseArgs(process.argv);
  const smartRoot = path.resolve(args['smart-contracts-root'] ?? '.smart-contracts');
  const outputRoot = path.resolve(args.output ?? '.cyvbwbtc-deployment-simulation-output');
  const forkUrl = args['fork-url'];
  assert(forkUrl, '--fork-url is required');

  await fs.rm(outputRoot, { recursive: true, force: true });
  await fs.mkdir(outputRoot, { recursive: true });

  const ethers = await import('ethers');
  const engine = await startAnvilEngine({
    artifacts: [],
    workflow: { steps: [] },
    chainId: 747474,
    forkUrl,
    evmVersion: 'cancun',
    cwd: process.cwd(),
    quiet: true,
  });

  const summary = {
    schemaVersion: 'curveyield-cyvbwbtc-deployment-simulation-v1',
    status: 'RUNNING',
    fork: { engine: engine.engine, chainId: 747474, upstreamRpcExposed: false },
    routes: [],
    funding: null,
    simulation: null,
    failures: [],
  };

  try {
    const provider = engine.provider;
    const chainId = await provider.send('eth_chainId', []);
    assert(BigInt(chainId) === 747474n, 'Anvil fork chain id mismatch');

    const account0 = engine.aliases.account0;
    const devWallet = new ethers.Wallet(DEV_PRIVATE_KEY);
    assert(lower(devWallet.address) === lower(account0), 'Anvil account0 does not match canonical dev private key');

    summary.routes.push(await configureRoute({
      provider,
      ethers,
      tokenIn: FXUSD,
      tokenOut: VBUSDC,
      route: FXUSD_TO_VBUSDC,
    }));
    summary.routes.push(await configureRoute({
      provider,
      ethers,
      tokenIn: VBUSDC,
      tokenOut: FXUSD,
      route: VBUSDC_TO_FXUSD,
    }));
    summary.routes.push(await configureRoute({
      provider,
      ethers,
      tokenIn: VBUSDC,
      tokenOut: VBWBTC,
      route: VBUSDC_TO_VBWBTC,
    }));

    summary.funding = await fundSimulation({ provider, ethers, account0 });
    await writeEphemeralFoundryConfig(smartRoot);

    const simulation = await run(
      'forge',
      [
        'script',
        'cyvbWBTC/script/SimulateCyvbWBTC_v8.s.sol:SimulateCyvbWBTC_v8',
        '--rpc-url',
        engine.url,
        '--broadcast',
        '--slow',
        '-vvv'
      ],
      {
        cwd: smartRoot,
        env: {
          PRIVATE_KEY: DEV_PRIVATE_KEY,
          SIM_DEPOSIT_AMOUNT: SIM_DEPOSIT_AMOUNT.toString(),
        },
      }
    );

    summary.simulation = {
      exitCode: simulation.code,
      stdoutTail: simulation.stdout.slice(-20000),
      stderrTail: simulation.stderr.slice(-20000),
    };
    assert(simulation.code === 0, 'SimulateCyvbWBTC_v8.s.sol failed');

    summary.status = 'PASS';
  } catch (error) {
    summary.status = 'FAIL';
    summary.failures.push({
      message: String(error?.message ?? error),
      stack: String(error?.stack ?? '').slice(0, 12000),
    });
    throw error;
  } finally {
    await fs.writeFile(
      path.join(outputRoot, 'CYVBWBTC_DEPLOYMENT_SIMULATION_SUMMARY_v1.json'),
      JSON.stringify(summary, null, 2) + '\n'
    );
    await engine.close().catch(() => {});
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
