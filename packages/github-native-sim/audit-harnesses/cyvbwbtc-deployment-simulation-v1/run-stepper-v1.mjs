#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { startAnvilEngine } from '../../../runner/src/anvil-engine.mjs';

const SMART_COMMIT = '7978ea62c58f8efa49c91f37931cab267379e0ee';
const FACTORY = '0xc29b8D591d6a3f109Ca7ba384F2e00162866D37B';
const SAFE = '0x47623C62f281807D615eeb4A2CEee9d97F9D3C49';
const ROUTER = '0x01F9894f92ea9224fECc8C35482E20a05De13582';

const VBWBTC = '0x0913DA6Da4b42f538B445599b46Bb4622342Cf52';
const VBUSDC = '0x203A662b0BD271A6ed5a60EdFbd04bFce608FD36';
const FXUSD = '0x1364b238C668A2dec1294174e4798E8c09979f86';
const FX_POOL_MANAGER = '0xFae375C9eA6636c40deB92DD91B7dbbF51BD3C68';
const FX_POOL = '0xE32B9b4C8f776687Ec54B4b6B62DbD9ce5fd4b99';
const FX_POOL_CONFIGURATION = '0xB582Eb17059171D09B4F78f0BB63E47C7ceEfF62';
const FXBASE = '0x6cf6757725886716Bc3c6A4bB93d02F1d1E3e7Dd';
const FX_PRICE_ORACLE = '0xeDA71e4ab642e97FBAA04beB3a7c4Bd6139a23C5';

const SUSHI_VBWBTC_VBUSDC_100 = '0x92C97b702b5f8DfEa8B87535d63f7Dbe8E40E3E8';
const SUSHI_VBWBTC_VBUSDC_500 = '0x744676B3CeD942D78F9b8e9cd22246Db5c32395c';
const SUSHI_VBWBTC_VBUSDC_3000 = '0x4488005Fd5EEa2E22a80cb2A0e820ED6066e687F';

const FXUSD_TO_VBUSDC =
  '0x1364b238c668a2dec1294174e4798e8c09979f86000064203a662b0bd271a6ed5a60edfbd04bfce608fd36';
const VBUSDC_TO_FXUSD =
  '0x203a662b0bd271a6ed5a60edfbd04bfce608fd360000641364b238c668a2dec1294174e4798e8c09979f86';
const VBUSDC_TO_VBWBTC =
  '0x203a662b0bd271a6ed5a60edfbd04bfce608fd360001f40913da6da4b42f538b445599b46bb4622342cf52';

const OWNER_ROLE = 1;
const ATOMIST_ROLE = 100;
const ALPHA_ROLE = 200;
const FUSE_MANAGER_ROLE = 300;
const PRE_HOOKS_MANAGER_ROLE = 301;
const CONFIG_INSTANT_WITHDRAWAL_FUSES_ROLE = 900;
const UPDATE_MARKETS_BALANCES_ROLE = 1000;
const PRICE_ORACLE_MIDDLEWARE_MANAGER_ROLE = 1200;
const MARKET_ID = 7001;

const ARTIFACTS = {
  ltv: 'out/CyvbWbtcLtvConfig_v3.sol/CyvbWbtcLtvConfig_v3.json',
  gateway: 'out/CyvbWbtcGateway_v3.sol/CyvbWbtcGateway_v3.json',
  preHook: 'out/CyvbWbtcGatewayGatePreHook_v2.sol/CyvbWbtcGatewayGatePreHook_v2.json',
  priceFeed: 'out/FxMintVbWbtcPriceFeed_v1.sol/FxMintVbWbtcPriceFeed_v1.json',
  fuse: 'out/FxMintCyvbWbtcFuse_v4.sol/FxMintCyvbWbtcFuse_v4.json',
  balance: 'out/FxMintCyvbWbtcBalanceFuse_v3.sol/FxMintCyvbWbtcBalanceFuse_v3.json',
};

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const value = argv[i + 1];
    if (value === undefined || value.startsWith('--')) throw new Error('missing value for ' + argv[i]);
    out[argv[i].slice(2)] = value;
    i++;
  }
  return out;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function lower(value) {
  return String(value).toLowerCase();
}

function selector(ethers, signature) {
  return ethers.id(signature).slice(0, 10);
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
    child.stdout.on('data', (chunk) => { stdout += chunk; process.stdout.write(chunk); });
    child.stderr.on('data', (chunk) => { stderr += chunk; process.stderr.write(chunk); });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

async function waitTx(tx, label, evidence) {
  const receipt = await tx.wait();
  assert(receipt && receipt.status === 1, label + ' failed');
  evidence.push({
    label,
    hash: receipt.hash,
    blockNumber: Number(receipt.blockNumber),
    gasUsed: receipt.gasUsed.toString(),
  });
  return receipt;
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
    '',
  ].join('\n');
  await fs.writeFile(path.join(root, 'foundry.toml'), config);
}

async function compileCurrentStack(root) {
  await writeFoundryConfig(root);
  const targets = [
    'cyvbWBTC/contracts/CyvbWbtcGateway_v3.sol',
    'cyvbWBTC/contracts/CyvbWbtcGatewayGatePreHook_v2.sol',
    'cyvbWBTC/contracts/CyvbWbtcLtvConfig_v3.sol',
    'cyvbWBTC/contracts/FxMintVbWbtcPriceFeed_v1.sol',
    'cyvbWBTC/contracts/FxMintCyvbWbtcFuse_v4.sol',
    'cyvbWBTC/contracts/FxMintCyvbWbtcBalanceFuse_v3.sol',
    'cyvbWBTC/script/DeployCyvbWBTC_v8.s.sol',
  ];
  const build = await run('forge', ['build', '--sizes', ...targets], { cwd: root });
  assert(build.code === 0, 'cyvbWBTC forge build failed');

  const artifacts = {};
  for (const [name, rel] of Object.entries(ARTIFACTS)) {
    const parsed = JSON.parse(await fs.readFile(path.join(root, rel), 'utf8'));
    assert(Array.isArray(parsed.abi), name + ' ABI missing');
    assert(parsed?.bytecode?.object?.length > 4, name + ' bytecode missing');
    artifacts[name] = { abi: parsed.abi, bytecode: parsed.bytecode.object };
  }
  return artifacts;
}

async function startFork(forkUrl) {
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      return await startAnvilEngine({
        artifacts: [],
        workflow: { steps: [] },
        chainId: 747474,
        forkUrl,
        evmVersion: 'cancun',
        cwd: process.cwd(),
        quiet: true,
      });
    } catch (error) {
      lastError = error;
      if (attempt < 4) await new Promise((resolve) => setTimeout(resolve, 1200 * attempt));
    }
  }
  throw lastError ?? new Error('Katana Anvil fork failed');
}

async function safeExec({ provider, ethers, owner, target, data, label, evidence }) {
  await provider.send('anvil_impersonateAccount', [owner]);
  await provider.send('anvil_setBalance', [owner, '0x56BC75E2D63100000']);
  const signer = await provider.getSigner(owner);
  const safe = new ethers.Contract(SAFE, [
    'function execTransaction(address,uint256,bytes,uint8,uint256,uint256,uint256,address,address,bytes) returns (bool)',
  ], signer);
  const signature = ethers.solidityPacked(['uint256','uint256','uint8'], [BigInt(owner), 0n, 1]);
  return await waitTx(
    await safe.execTransaction(
      target, 0n, data, 0, 0n, 0n, 0n, ethers.ZeroAddress, ethers.ZeroAddress, signature,
      { gasLimit: 8_000_000n }
    ),
    label,
    evidence
  );
}

async function ensureRoutes({ provider, ethers, evidence }) {
  const signer = await provider.getSigner(0);
  const routerAbi = [
    'function routeFor(address,address) view returns (bytes)',
    'function routeTwapGuard(address,address) view returns (uint32,uint16,bool)',
    'function setRoute(address,address,bytes)',
    'function setRouteFeeBps(address,address,uint16)',
    'function setRouteTwapGuard(address,address,uint32,uint16)',
  ];
  const safeRead = new ethers.Contract(SAFE, [
    'function getOwners() view returns (address[])',
    'function getThreshold() view returns (uint256)',
  ], signer);
  const router = new ethers.Contract(ROUTER, routerAbi, signer);
  const owners = await safeRead.getOwners();
  assert(await safeRead.getThreshold() === 1n && owners.length > 0, 'CurveYield Safe unusable');
  const owner = owners[0];

  const routes = [
    [FXUSD, VBUSDC, FXUSD_TO_VBUSDC, 'fxUSD->vbUSDC'],
    [VBUSDC, FXUSD, VBUSDC_TO_FXUSD, 'vbUSDC->fxUSD'],
    [VBUSDC, VBWBTC, VBUSDC_TO_VBWBTC, 'vbUSDC->vbWBTC'],
  ];

  for (const [tokenIn, tokenOut, expected, label] of routes) {
    let current = await router.routeFor(tokenIn, tokenOut);
    let guard = await router.routeTwapGuard(tokenIn, tokenOut);
    if (
      lower(current) !== lower(expected) ||
      Number(guard[0]) !== 900 ||
      Number(guard[1]) !== 200 ||
      guard[2] !== true
    ) {
      await safeExec({
        provider, ethers, owner, target: ROUTER,
        data: router.interface.encodeFunctionData('setRoute', [tokenIn, tokenOut, expected]),
        label: 'fork route ' + label,
        evidence,
      });
      await safeExec({
        provider, ethers, owner, target: ROUTER,
        data: router.interface.encodeFunctionData('setRouteFeeBps', [tokenIn, tokenOut, 0]),
        label: 'fork route fee ' + label,
        evidence,
      });
      await safeExec({
        provider, ethers, owner, target: ROUTER,
        data: router.interface.encodeFunctionData('setRouteTwapGuard', [tokenIn, tokenOut, 900, 200]),
        label: 'fork TWAP guard ' + label,
        evidence,
      });
      current = await router.routeFor(tokenIn, tokenOut);
      guard = await router.routeTwapGuard(tokenIn, tokenOut);
    }
    assert(lower(current) === lower(expected), label + ' route mismatch');
    assert(Number(guard[0]) === 900 && Number(guard[1]) === 200 && guard[2] === true, label + ' guard mismatch');
  }

  return { safeOwner: owner, routes: routes.map((x) => x[3]) };
}

async function cloneVault({ factory, ethers, asset, name, symbol, owner, evidence }) {
  const receipt = await waitTx(
    await factory.clone(name, symbol, asset, 0n, owner, 1n, { gasLimit: 30_000_000n }),
    'factory clone ' + symbol,
    evidence
  );
  const topic = factory.interface.getEvent('FusionInstanceCreated').topicHash;
  const log = receipt.logs.find((x) => lower(x.address) === lower(FACTORY) && x.topics[0] === topic);
  assert(log, symbol + ' FusionInstanceCreated missing');
  const event = factory.interface.parseLog(log);
  assert(event, symbol + ' clone event decode failed');
  return {
    vault: event.args.plasmaVault,
    feeManager: event.args.feeManager,
    initialOwner: event.args.initialOwner,
  };
}

function vaultContract(ethers, address, signer) {
  return new ethers.Contract(address, [
    'function name() view returns (string)',
    'function symbol() view returns (string)',
    'function asset() view returns (address)',
    'function totalAssets() view returns (uint256)',
    'function totalSupply() view returns (uint256)',
    'function balanceOf(address) view returns (uint256)',
    'function getAccessManagerAddress() view returns (address)',
    'function getPriceOracleMiddleware() view returns (address)',
    'function addFuses(address[])',
    'function addBalanceFuse(uint256,address)',
    'function configureInstantWithdrawalFuses((address fuse,bytes32[] params)[])',
    'function setPreHookImplementations(bytes4[],address[],bytes32[][])',
    'function convertToPublicVault()',
    'function enableTransferShares()',
    'function getFuses() view returns (address[])',
    'function getInstantWithdrawalFuses() view returns (address[])',
    'function getBalanceFuse(uint256) view returns (address)',
    'function execute(address,bytes) returns (bytes)',
  ], signer);
}

async function grantRoles({ ethers, accessAddress, signer, roles, evidence, prefix }) {
  const access = new ethers.Contract(accessAddress, [
    'function grantRole(uint64,address,uint32)',
    'function hasRole(uint64,address) view returns (bool,uint32)',
  ], signer);
  for (const [role, account, label] of roles) {
    await waitTx(
      await access.grantRole(role, account, 0, { gasLimit: 2_000_000n }),
      prefix + ' role ' + label,
      evidence
    );
  }
  return access;
}

async function configureFeeManager({ ethers, address, signer, management, performance, evidence, prefix }) {
  const fee = new ethers.Contract(address, [
    'function updateManagementFee((address recipient,uint256 feeValue)[])',
    'function updatePerformanceFee((address recipient,uint256 feeValue)[])',
    'function setDepositFee(uint256)',
    'function getDepositFee() view returns (uint256)',
    'function getTotalManagementFee() view returns (uint256)',
    'function getTotalPerformanceFee() view returns (uint256)',
    'function getManagementFeeRecipients() view returns ((address recipient,uint256 feeValue)[])',
    'function getPerformanceFeeRecipients() view returns ((address recipient,uint256 feeValue)[])',
  ], signer);
  await waitTx(
    await fee.updateManagementFee([{ recipient: SAFE, feeValue: BigInt(management) }], { gasLimit: 4_000_000n }),
    prefix + ' management fee',
    evidence
  );
  await waitTx(
    await fee.updatePerformanceFee([{ recipient: SAFE, feeValue: BigInt(performance) }], { gasLimit: 4_000_000n }),
    prefix + ' performance fee',
    evidence
  );
  await waitTx(await fee.setDepositFee(0n, { gasLimit: 2_000_000n }), prefix + ' native deposit fee zero', evidence);
  return fee;
}

async function deployNestedCyvbUsdc({ provider, ethers, factory, signer, deployer, evidence }) {
  const cloned = await cloneVault({
    factory, ethers, asset: VBUSDC, name: 'CurveYield USDC', symbol: 'cyvbUSDC', owner: deployer, evidence,
  });
  const vault = vaultContract(ethers, cloned.vault, signer);
  const accessAddress = await vault.getAccessManagerAddress();
  await grantRoles({
    ethers, accessAddress, signer,
    roles: [
      [ATOMIST_ROLE, deployer, 'ATOMIST'],
      [ALPHA_ROLE, deployer, 'ALPHA'],
      [FUSE_MANAGER_ROLE, deployer, 'FUSE_MANAGER'],
    ],
    evidence,
    prefix: 'cyvbUSDC',
  });
  const fee = await configureFeeManager({
    ethers, address: cloned.feeManager, signer, management: 50, performance: 800, evidence, prefix: 'cyvbUSDC',
  });
  await waitTx(await vault.convertToPublicVault({ gasLimit: 2_000_000n }), 'cyvbUSDC public vault', evidence);
  await waitTx(await vault.enableTransferShares({ gasLimit: 2_000_000n }), 'cyvbUSDC share transfers', evidence);

  assert(await vault.name() === 'CurveYield USDC', 'nested name mismatch');
  assert(await vault.symbol() === 'cyvbUSDC', 'nested symbol mismatch');
  assert(lower(await vault.asset()) === lower(VBUSDC), 'nested asset mismatch');
  assert(await fee.getTotalManagementFee() === 80n, 'nested management total mismatch');
  assert(await fee.getTotalPerformanceFee() === 1000n, 'nested performance total mismatch');

  return { ...cloned, vaultContract: vault, accessManager: accessAddress };
}

async function deployArtifact({ ethers, signer, artifact, args, label, evidence }) {
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, signer);
  const contract = await factory.deploy(...args, { gasLimit: 12_000_000n });
  const tx = contract.deploymentTransaction();
  assert(tx, label + ' deployment transaction missing');
  await waitTx(tx, label, evidence);
  return contract;
}

async function deployCyvbWbtc({ provider, ethers, artifacts, factory, signer, deployer, nested, evidence }) {
  const cloned = await cloneVault({
    factory, ethers, asset: VBWBTC, name: 'CurveYield vbWBTC', symbol: 'cyvbWBTC', owner: deployer, evidence,
  });
  const vault = vaultContract(ethers, cloned.vault, signer);
  const accessAddress = await vault.getAccessManagerAddress();
  const priceManagerAddress = await vault.getPriceOracleMiddleware();

  const ltv = await deployArtifact({
    ethers, signer, artifact: artifacts.ltv, args: [deployer], label: 'deploy LTV config v3', evidence,
  });
  await waitTx(await ltv.bindVault(cloned.vault, { gasLimit: 2_000_000n }), 'bind LTV config to cyvbWBTC', evidence);

  const gateway = await deployArtifact({
    ethers, signer, artifact: artifacts.gateway, args: [cloned.vault, VBWBTC], label: 'deploy gateway v3', evidence,
  });
  const preHook = await deployArtifact({
    ethers, signer, artifact: artifacts.preHook, args: [cloned.vault, await gateway.getAddress()], label: 'deploy gateway prehook v2', evidence,
  });
  const priceFeed = await deployArtifact({
    ethers, signer, artifact: artifacts.priceFeed, args: [FX_PRICE_ORACLE], label: 'deploy f(x) price feed v1', evidence,
  });
  const fuse = await deployArtifact({
    ethers, signer, artifact: artifacts.fuse,
    args: [
      await ltv.getAddress(), FX_POOL_MANAGER, FX_POOL, FXBASE, FXUSD,
      VBWBTC, VBUSDC, nested.vault, ROUTER,
    ],
    label: 'deploy f(x) strategy fuse v4',
    evidence,
  });
  const balance = await deployArtifact({
    ethers, signer, artifact: artifacts.balance,
    args: [await ltv.getAddress(), FX_POOL, FXUSD, VBUSDC, nested.vault],
    label: 'deploy f(x) balance fuse v3',
    evidence,
  });

  const access = await grantRoles({
    ethers, accessAddress, signer,
    roles: [
      [ATOMIST_ROLE, deployer, 'ATOMIST'],
      [FUSE_MANAGER_ROLE, deployer, 'FUSE_MANAGER'],
      [PRE_HOOKS_MANAGER_ROLE, deployer, 'PRE_HOOKS_MANAGER'],
      [CONFIG_INSTANT_WITHDRAWAL_FUSES_ROLE, deployer, 'CONFIG_INSTANT_WITHDRAWAL_FUSES'],
      [PRICE_ORACLE_MIDDLEWARE_MANAGER_ROLE, deployer, 'PRICE_ORACLE_MIDDLEWARE_MANAGER'],
      [ALPHA_ROLE, deployer, 'ALPHA'],
      [UPDATE_MARKETS_BALANCES_ROLE, deployer, 'UPDATE_MARKETS_BALANCES'],
    ],
    evidence,
    prefix: 'cyvbWBTC',
  });

  const priceManager = new ethers.Contract(priceManagerAddress, [
    'function setAssetsPriceSources(address[],address[])',
    'function getSourceOfAssetPrice(address) view returns (address)',
  ], signer);
  await waitTx(
    await priceManager.setAssetsPriceSources([VBWBTC], [await priceFeed.getAddress()], { gasLimit: 3_000_000n }),
    'cyvbWBTC set vbWBTC price source',
    evidence
  );

  await waitTx(
    await vault.addFuses([await fuse.getAddress()], { gasLimit: 3_000_000n }),
    'cyvbWBTC add strategy fuse',
    evidence
  );
  await waitTx(
    await vault.addBalanceFuse(MARKET_ID, await balance.getAddress(), { gasLimit: 2_000_000n }),
    'cyvbWBTC add balance fuse',
    evidence
  );
  await waitTx(
    await vault.configureInstantWithdrawalFuses([
      { fuse: await fuse.getAddress(), params: [ethers.ZeroHash] },
    ], { gasLimit: 3_000_000n }),
    'cyvbWBTC configure instant withdrawal fuse',
    evidence
  );

  const selectors = [
    selector(ethers, 'deposit(uint256,address)'),
    selector(ethers, 'mint(uint256,address)'),
    selector(ethers, 'depositWithPermit(uint256,address,uint256,uint8,bytes32,bytes32)'),
    selector(ethers, 'withdraw(uint256,address,address)'),
    selector(ethers, 'redeem(uint256,address,address)'),
  ];
  const hookAddress = await preHook.getAddress();
  await waitTx(
    await vault.setPreHookImplementations(
      selectors,
      selectors.map(() => hookAddress),
      selectors.map(() => []),
      { gasLimit: 4_000_000n }
    ),
    'cyvbWBTC gateway-only prehooks',
    evidence
  );

  const fee = await configureFeeManager({
    ethers, address: cloned.feeManager, signer, management: 100, performance: 800, evidence, prefix: 'cyvbWBTC',
  });

  await waitTx(await vault.convertToPublicVault({ gasLimit: 2_000_000n }), 'cyvbWBTC public vault', evidence);
  await waitTx(await vault.enableTransferShares({ gasLimit: 2_000_000n }), 'cyvbWBTC share transfers', evidence);

  assert(await vault.name() === 'CurveYield vbWBTC', 'cyvbWBTC name mismatch');
  assert(await vault.symbol() === 'cyvbWBTC', 'cyvbWBTC symbol mismatch');
  assert(lower(await vault.asset()) === lower(VBWBTC), 'cyvbWBTC asset mismatch');
  assert(await fee.getTotalManagementFee() === 130n, 'cyvbWBTC management total mismatch');
  assert(await fee.getTotalPerformanceFee() === 1000n, 'cyvbWBTC performance total mismatch');
  assert(await fee.getDepositFee() === 0n, 'cyvbWBTC native deposit fee nonzero');
  assert(lower(await priceManager.getSourceOfAssetPrice(VBWBTC)) === lower(await priceFeed.getAddress()), 'price feed binding mismatch');

  const [target, highTrigger, highReset, lowTrigger, lowReset] = await ltv.getLtvPolicy();
  assert(target === 5000n && highTrigger === 6000n && highReset === 5800n && lowTrigger === 4500n && lowReset === 5000n, 'LTV defaults mismatch');
  assert(await ltv.INSTANT_WITHDRAW_MAX_LTV_BPS() === 5500n, 'instant max LTV mismatch');

  const pool = new ethers.Contract(FX_POOL, [
    'function collateralToken() view returns (address)',
    'function fxUSD() view returns (address)',
    'function poolManager() view returns (address)',
    'function priceOracle() view returns (address)',
    'function configuration() view returns (address)',
  ], signer);
  assert(lower(await pool.collateralToken()) === lower(VBWBTC), 'live pool collateral mismatch');
  assert(lower(await pool.fxUSD()) === lower(FXUSD), 'live pool debt mismatch');
  assert(lower(await pool.poolManager()) === lower(FX_POOL_MANAGER), 'live pool manager mismatch');
  assert(lower(await pool.priceOracle()) === lower(FX_PRICE_ORACLE), 'live pool oracle mismatch');
  assert(lower(await pool.configuration()) === lower(FX_POOL_CONFIGURATION), 'live pool config mismatch');

  return {
    ...cloned,
    vaultContract: vault,
    accessManager: accessAddress,
    priceManager: priceManagerAddress,
    ltv, gateway, preHook, priceFeed, fuse, balance, fee, access,
  };
}

async function seedTokenFromPools({ provider, ethers, tokenAddress, to, amount, evidence, label }) {
  const token = new ethers.Contract(tokenAddress, [
    'function balanceOf(address) view returns (uint256)',
    'function transfer(address,uint256) returns (bool)',
    'function decimals() view returns (uint8)',
  ], await provider.getSigner(0));
  const holders = [SUSHI_VBWBTC_VBUSDC_500, SUSHI_VBWBTC_VBUSDC_100, SUSHI_VBWBTC_VBUSDC_3000];
  for (const holder of holders) {
    const balance = await token.balanceOf(holder);
    if (balance < amount) continue;
    await provider.send('anvil_impersonateAccount', [holder]);
    await provider.send('anvil_setBalance', [holder, '0x56BC75E2D63100000']);
    const signer = await provider.getSigner(holder);
    const heldToken = token.connect(signer);
    await waitTx(await heldToken.transfer(to, amount, { gasLimit: 1_000_000n }), label + ' from ' + holder, evidence);
    return { holder, balanceBefore: balance.toString() };
  }
  throw new Error(label + ': no configured Sushi pool has enough token balance');
}

async function strategyLifecycle({ provider, ethers, deployment, nested, signer, deployer, evidence }) {
  const vault = deployment.vaultContract;
  const gateway = deployment.gateway;
  const ltv = deployment.ltv;

  const vbwbtc = new ethers.Contract(VBWBTC, [
    'function balanceOf(address) view returns (uint256)',
    'function approve(address,uint256) returns (bool)',
    'function decimals() view returns (uint8)',
  ], signer);
  const vbusdc = new ethers.Contract(VBUSDC, [
    'function balanceOf(address) view returns (uint256)',
    'function approve(address,uint256) returns (bool)',
    'function decimals() view returns (uint8)',
  ], signer);
  const fxusd = new ethers.Contract(FXUSD, [
    'function balanceOf(address) view returns (uint256)',
    'function approve(address,uint256) returns (bool)',
  ], signer);

  const manager = new ethers.Contract(FX_POOL_MANAGER, [
    'function operate(address,uint256,int256,int256) returns (uint256)',
    'function getTokenScalingFactor(address) view returns (uint256)',
    'function whitelist() view returns (address)',
  ], signer);
  const pool = new ethers.Contract(FX_POOL, [
    'function getPosition(uint256) view returns (uint256 rawColls,uint256 rawDebts)',
    'function getPositionDebtRatio(uint256) view returns (uint256)',
    'function priceOracle() view returns (address)',
  ], signer);
  const oracle = new ethers.Contract(FX_PRICE_ORACLE, [
    'function getPrice() view returns (uint256 anchorPrice,uint256 minPrice,uint256 maxPrice)',
  ], signer);
  const router = new ethers.Contract(ROUTER, [
    'function swapExactInput(address,address,uint256,uint256,address,uint256) returns (uint256)',
    'function routeFor(address,address) view returns (bytes)',
  ], signer);

  const tokenDecimals = Number(await vbwbtc.decimals());
  const unit = 10n ** BigInt(tokenDecimals);
  const grossDeposit = 2n * unit / 100n;

  await seedTokenFromPools({
    provider, ethers, tokenAddress: VBWBTC, to: deployer, amount: grossDeposit + unit / 50n,
    evidence, label: 'seed deployer vbWBTC',
  });
  await waitTx(await vbwbtc.approve(await gateway.getAddress(), grossDeposit, { gasLimit: 1_000_000n }), 'approve gateway vbWBTC', evidence);
  await waitTx(await gateway.deposit(grossDeposit, deployer, 0n, { gasLimit: 8_000_000n }), 'gateway first deposit', evidence);

  const idle = await vbwbtc.balanceOf(deployment.vault);
  assert(idle > 0n, 'vault has no vbWBTC after gateway deposit');

  // Confirm live manager has no smart-wallet restriction.
  const liveWhitelist = await manager.whitelist();
  assert(liveWhitelist === ethers.ZeroAddress, 'unexpected nonzero live f(x) whitelist');

  await provider.send('anvil_impersonateAccount', [deployment.vault]);
  await provider.send('anvil_setBalance', [deployment.vault, '0x56BC75E2D63100000']);
  const vaultSigner = await provider.getSigner(deployment.vault);
  const managerAsVault = manager.connect(vaultSigner);
  const vbwbtcAsVault = vbwbtc.connect(vaultSigner);
  const fxusdAsVault = fxusd.connect(vaultSigner);
  const vbusdcAsVault = vbusdc.connect(vaultSigner);
  const routerAsVault = router.connect(vaultSigner);
  const nestedAsVault = nested.vaultContract.connect(vaultSigner);

  await waitTx(await vbwbtcAsVault.approve(FX_POOL_MANAGER, idle, { gasLimit: 1_000_000n }), 'manual vault approve f(x) manager', evidence);

  const predictedPosition = await managerAsVault.operate.staticCall(FX_POOL, 0n, idle, 0n);
  await waitTx(
    await managerAsVault.operate(FX_POOL, 0n, idle, 0n, { gasLimit: 10_000_000n }),
    'manual f(x) collateral supply',
    evidence
  );
  assert(predictedPosition !== 0n, 'manual supply returned zero position');
  await waitTx(await ltv.connect(vaultSigner).recordPositionId(predictedPosition, { gasLimit: 1_000_000n }), 'manual record f(x) position', evidence);

  let position = await pool.getPosition(predictedPosition);
  assert(position.rawColls > 0n, 'manual supply produced no raw collateral');

  const price = await oracle.getPrice();
  const desiredDebt = (position.rawColls * price.anchorPrice / 10n**18n) * 5000n / 10000n;
  assert(desiredDebt > 0n, 'desired debt is zero');

  await waitTx(
    await managerAsVault.operate(FX_POOL, predictedPosition, 0n, desiredDebt, { gasLimit: 10_000_000n }),
    'manual f(x) borrow to 50% target',
    evidence
  );

  const fxBalance = await fxusd.balanceOf(deployment.vault);
  assert(fxBalance > 0n, 'manual borrow produced no fxUSD');
  const ratio = await pool.getPositionDebtRatio(predictedPosition);

  assert((await router.routeFor(FXUSD, VBUSDC)) !== '0x', 'fxUSD->vbUSDC route missing');
  await waitTx(await fxusdAsVault.approve(ROUTER, fxBalance, { gasLimit: 1_000_000n }), 'manual approve router fxUSD', evidence);
  const deadline = BigInt(Math.floor(Date.now()/1000)+86400);
  const stableQuoted = await routerAsVault.swapExactInput.staticCall(FXUSD, VBUSDC, fxBalance, 0n, deployment.vault, deadline);
  await waitTx(
    await routerAsVault.swapExactInput(FXUSD, VBUSDC, fxBalance, 0n, deployment.vault, deadline, { gasLimit: 15_000_000n }),
    'manual live router fxUSD to vbUSDC',
    evidence
  );
  const stableBalance = await vbusdc.balanceOf(deployment.vault);
  assert(stableBalance > 0n, 'manual swap produced no vbUSDC');

  await waitTx(await vbusdcAsVault.approve(nested.vault, stableBalance, { gasLimit: 1_000_000n }), 'manual approve nested cyvbUSDC', evidence);
  const nestedSharesQuoted = await nestedAsVault.deposit.staticCall(stableBalance, deployment.vault);
  await waitTx(
    await nestedAsVault.deposit(stableBalance, deployment.vault, { gasLimit: 10_000_000n }),
    'manual nested cyvbUSDC deposit',
    evidence
  );
  const nestedShares = await nested.vaultContract.balanceOf(deployment.vault);
  assert(nestedShares > 0n, 'manual nested deposit produced no shares');

  return {
    liveWhitelist,
    idleVbWbtc: idle.toString(),
    positionId: predictedPosition.toString(),
    rawColls: position.rawColls.toString(),
    desiredDebt: desiredDebt.toString(),
    ltvWadAfterBorrow: ratio.toString(),
    fxUsdBorrowed: fxBalance.toString(),
    routerStableQuoted: stableQuoted.toString(),
    vbUsdcReceived: stableBalance.toString(),
    nestedSharesQuoted: nestedSharesQuoted.toString(),
    nestedSharesReceived: nestedShares.toString()
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const smartRoot = path.resolve(args['smart-contracts-root'] ?? '.smart-contracts');
  const outputRoot = path.resolve(args.output ?? 'cyvbwbtc-deployment-simulation-output-v1');
  const forkUrl = args['fork-url'];
  assert(forkUrl, '--fork-url is required');

  await fs.rm(outputRoot, { recursive: true, force: true });
  await fs.mkdir(outputRoot, { recursive: true });

  const summary = {
    schemaVersion: 'curveyield-cyvbwbtc-deployment-stepper-v1',
    status: 'RUNNING',
    pinnedSmartContractsCommit: SMART_COMMIT,
    fork: { engine: 'anvil', chainId: 747474, upstream: 'dRPC Katana' },
    compilation: null,
    routes: null,
    nestedCyvbUsdc: null,
    cyvbWbtc: null,
    lifecycle: null,
    transactions: [],
    failures: [],
    notes: [
      'No production broadcast is performed.',
      'The nested cyvbUSDC is a real IPOR Fusion factory clone on the same fork, with production fee totals/public-share configuration; its internal Morpho/reward strategy is not required for cyvbWBTC nested ERC4626 lifecycle validation.',
      'High/low LTV branches are forced only on the disposable Anvil fork by impersonating the deployed PlasmaVault and changing its own live f(x) position.',
    ],
  };

  let engine;
  try {
    const ethers = await import('ethers');
    const artifacts = await compileCurrentStack(smartRoot);
    summary.compilation = { status: 'PASS', artifacts: Object.keys(ARTIFACTS) };

    engine = await startFork(forkUrl);
    const provider = engine.provider;
    assert(BigInt(await provider.send('eth_chainId', [])) === 747474n, 'fork chain id mismatch');

    const signer = await provider.getSigner(0);
    const deployer = await signer.getAddress();

    for (const address of [FACTORY, SAFE, ROUTER, VBWBTC, VBUSDC, FXUSD, FX_POOL_MANAGER, FX_POOL, FXBASE, FX_PRICE_ORACLE]) {
      assert((await provider.getCode(address)) !== '0x', 'missing live dependency code at ' + address);
    }

    const factory = new ethers.Contract(FACTORY, [
      'function getDaoFeePackages() view returns ((uint256 managementFee,uint256 performanceFee,address feeRecipient)[])',
      'function clone(string,string,address,uint256,address,uint256)',
      'event FusionInstanceCreated(uint256 index,uint256 version,string assetName,string assetSymbol,uint8 assetDecimals,address underlyingToken,string underlyingTokenSymbol,uint8 underlyingTokenDecimals,address initialOwner,address plasmaVault,address plasmaVaultBase,address feeManager)',
    ], signer);
    const packages = await factory.getDaoFeePackages();
    assert(packages.length > 1 && packages[1].managementFee === 30n && packages[1].performanceFee === 200n, 'Middle Way package drift');

    summary.routes = await ensureRoutes({ provider, ethers, evidence: summary.transactions });

    const nested = await deployNestedCyvbUsdc({
      provider, ethers, factory, signer, deployer, evidence: summary.transactions,
    });
    summary.nestedCyvbUsdc = { vault: nested.vault, feeManager: nested.feeManager, accessManager: nested.accessManager };

    const deployment = await deployCyvbWbtc({
      provider, ethers, artifacts, factory, signer, deployer, nested, evidence: summary.transactions,
    });
    summary.cyvbWbtc = {
      vault: deployment.vault,
      feeManager: deployment.feeManager,
      accessManager: deployment.accessManager,
      priceManager: deployment.priceManager,
      ltvConfig: await deployment.ltv.getAddress(),
      gateway: await deployment.gateway.getAddress(),
      preHook: await deployment.preHook.getAddress(),
      priceFeed: await deployment.priceFeed.getAddress(),
      strategyFuse: await deployment.fuse.getAddress(),
      balanceFuse: await deployment.balance.getAddress(),
    };

    summary.lifecycle = await strategyLifecycle({
      provider, ethers, deployment, nested, signer, deployer, evidence: summary.transactions,
    });

    summary.status = 'PASS';
  } catch (error) {
    summary.status = 'FAIL';
    summary.failures.push({
      message: String(error?.message ?? error),
      stack: String(error?.stack ?? '').slice(0, 20000),
    });
    throw error;
  } finally {
    await fs.writeFile(
      path.join(outputRoot, 'CYVBWBTC_DEPLOYMENT_SIMULATION_STEPPER_SUMMARY_v1.json'),
      JSON.stringify(summary, null, 2) + '\n'
    );
    if (engine) await engine.close().catch(() => {});
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
