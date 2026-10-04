#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { startAnvilEngine } from '../../../runner/src/anvil-engine.mjs';

const ROUTER = '0x01F9894f92ea9224fECc8C35482E20a05De13582';
const SAFE = '0x47623C62f281807D615eeb4A2CEee9d97F9D3C49';
const SUSHI_FACTORY = '0x203e8740894c8955cB8950759876d7E7E45E04c1';
const TARGET_FXUSD_VBUSDC_POOL = '0x2d43e7931329dbb709f33d7049c937c6794bae10';

const FXUSD = '0x4c03ff0f44A55e7098a09016E02a01d3cdC2FDF9';
const VBUSDC = '0x203A662b0BD271A6ed5a60EdFbd04bFce608FD36';
const VBWBTC = '0x0913DA6Da4b42f538B445599b46Bb4622342Cf52';

const FXUSD_TO_VBUSDC = '0x4c03ff0f44a55e7098a09016e02a01d3cdc2fdf9000064203a662b0bd271a6ed5a60edfbd04bfce608fd36';
const VBUSDC_TO_FXUSD = '0x203a662b0bd271a6ed5a60edfbd04bfce608fd360000644c03ff0f44a55e7098a09016e02a01d3cdc2fdf9';
const VBUSDC_TO_VBWBTC = '0x203a662b0bd271a6ed5a60edfbd04bfce608fd360001f40913da6da4b42f538b445599b46bb4622342cf52';

const FUNDING_ACCOUNT = '0x3Ef3D8bA38EBe18DB133cEc108f4D14CE00Dd9Ae';
const DEV_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const DEFAULT_DEPOSIT = 200000n;
const TWAP_WINDOW = 900;
const MAX_TWAP_DEVIATION_BPS = 200;

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

async function configureRoute({ provider, ethers, safe, router, owner, tokenIn, tokenOut, route }) {
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
    data: router.interface.encodeFunctionData(
      'setRouteTwapGuard',
      [tokenIn, tokenOut, TWAP_WINDOW, MAX_TWAP_DEVIATION_BPS]
    ),
    ethers,
  });

  const installed = await router.routeFor(tokenIn, tokenOut);
  const guard = await router.routeTwapGuard(tokenIn, tokenOut);
  assert(lower(installed) === lower(route), `route mismatch ${tokenIn} -> ${tokenOut}`);
  assert(Number(guard[0]) === TWAP_WINDOW, 'TWAP window mismatch');
  assert(Number(guard[1]) === MAX_TWAP_DEVIATION_BPS, 'TWAP deviation mismatch');
  assert(guard[2] === true, 'TWAP guard not configured');

  return {
    tokenIn,
    tokenOut,
    route: installed,
    routeFeeBpsConfigured: 0,
    twapWindow: Number(guard[0]),
    maxTwapDeviationBps: Number(guard[1]),
  };
}

async function configureForkRoutes({ provider, ethers }) {
  const factory = new ethers.Contract(
    SUSHI_FACTORY,
    ['function getPool(address,address,uint24) view returns (address)'],
    provider
  );
  const pool = await factory.getPool(FXUSD, VBUSDC, 100);
  assert(lower(pool) === lower(TARGET_FXUSD_VBUSDC_POOL), 'wrong fxUSD/vbUSDC 0.01% pool');

  const routerAbi = [
    'function owner() view returns (address)',
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
  assert(lower(await routerRead.owner()) === lower(SAFE), 'router owner is not CurveYield Safe');

  const safeRead = new ethers.Contract(SAFE, safeAbi, provider);
  const threshold = await safeRead.getThreshold();
  const owners = await safeRead.getOwners();
  assert(threshold === 1n, 'CurveYield Safe threshold is not 1');
  assert(owners.length > 0, 'CurveYield Safe has no owner');

  const owner = owners[0];
  await provider.send('anvil_impersonateAccount', [owner]);
  await provider.send('anvil_setBalance', [owner, '0x56BC75E2D63100000']);

  const ownerSigner = await provider.getSigner(owner);
  const safe = new ethers.Contract(SAFE, safeAbi, ownerSigner);
  const router = new ethers.Contract(ROUTER, routerAbi, ownerSigner);

  const routes = [];
  routes.push(await configureRoute({
    provider, ethers, safe, router, owner,
    tokenIn: FXUSD, tokenOut: VBUSDC, route: FXUSD_TO_VBUSDC,
  }));
  routes.push(await configureRoute({
    provider, ethers, safe, router, owner,
    tokenIn: VBUSDC, tokenOut: FXUSD, route: VBUSDC_TO_FXUSD,
  }));
  routes.push(await configureRoute({
    provider, ethers, safe, router, owner,
    tokenIn: VBUSDC, tokenOut: VBWBTC, route: VBUSDC_TO_VBWBTC,
  }));

  return {
    safe: SAFE,
    safeOwnerUsed: owner,
    safeThreshold: Number(threshold),
    targetFxUsdVbUsdcPool: pool,
    routes,
  };
}

async function fundAccount({ provider, ethers, account0, amount }) {
  const tokenAbi = [
    'function balanceOf(address) view returns (uint256)',
    'function transfer(address,uint256) returns (bool)'
  ];
  const token = new ethers.Contract(VBWBTC, tokenAbi, provider);
  const sourceBalance = await token.balanceOf(FUNDING_ACCOUNT);
  assert(sourceBalance >= amount, 'funding account lacks enough vbWBTC');

  await provider.send('anvil_impersonateAccount', [FUNDING_ACCOUNT]);
  await provider.send('anvil_setBalance', [FUNDING_ACCOUNT, '0x56BC75E2D63100000']);
  const signer = await provider.getSigner(FUNDING_ACCOUNT);
  const tx = await token.connect(signer).transfer(account0, amount);
  const receipt = await tx.wait();
  assert(receipt.status === 1, 'vbWBTC funding transfer failed');

  const funded = await token.balanceOf(account0);
  assert(funded >= amount, 'Anvil account0 did not receive vbWBTC');

  return {
    source: FUNDING_ACCOUNT,
    sourceBalanceBefore: sourceBalance.toString(),
    fundedAccount: account0,
    fundedBalanceAfter: funded.toString(),
    amount: amount.toString(),
  };
}

async function writeFoundryConfig(root) {
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
  const outputRoot = path.resolve(args.output ?? 'katana-cyvbwbtc-simulation-v10-output');
  const forkUrl = args['fork-url'];
  const depositAmount = BigInt(args['deposit-amount'] ?? DEFAULT_DEPOSIT.toString());
  assert(forkUrl, '--fork-url is required');
  assert(depositAmount > 0n, 'deposit amount must be positive');

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
    schemaVersion: 'curveyield-katana-cyvbwbtc-lifecycle-v10',
    status: 'RUNNING',
    fork: { engine: engine.engine, chainId: 747474, upstreamRpcExposed: false },
    routeConfiguration: null,
    funding: null,
    simulation: null,
    failures: [],
  };

  try {
    const provider = engine.provider;
    assert(BigInt(await provider.send('eth_chainId', [])) === 747474n, 'wrong fork chain id');

    summary.routeConfiguration = await configureForkRoutes({ provider, ethers });

    const account0 = engine.aliases.account0;
    const devWallet = new ethers.Wallet(DEV_PRIVATE_KEY);
    assert(lower(account0) === lower(devWallet.address), 'Anvil account0/private key mismatch');

    summary.funding = await fundAccount({
      provider,
      ethers,
      account0,
      amount: depositAmount,
    });

    await writeFoundryConfig(smartRoot);

    const simulation = await run(
      'forge',
      [
        'script',
        'cyvbWBTC/script/SimulateCyvbWBTC_v9.s.sol:SimulateCyvbWBTC_v9',
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
          SIM_DEPOSIT_AMOUNT: depositAmount.toString(),
        },
      }
    );

    summary.simulation = {
      exitCode: simulation.code,
      stdoutTail: simulation.stdout.slice(-30000),
      stderrTail: simulation.stderr.slice(-30000),
    };
    assert(simulation.code === 0, 'SimulateCyvbWBTC_v9 failed');

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
      path.join(outputRoot, 'KATANA_CYVBWBTC_LIFECYCLE_RESULT_v10.json'),
      JSON.stringify(summary, null, 2) + '\n'
    );
    await engine.close().catch(() => {});
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
