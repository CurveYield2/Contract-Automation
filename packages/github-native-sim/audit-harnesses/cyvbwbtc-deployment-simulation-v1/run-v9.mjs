#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { startAnvilEngine } from '../../../runner/src/anvil-engine.mjs';

const FACTORY = '0xc29b8D591d6a3f109Ca7ba384F2e00162866D37B';
const ROUTER = '0x01F9894f92ea9224fECc8C35482E20a05De13582';
const SAFE = '0x47623C62f281807D615eeb4A2CEee9d97F9D3C49';
const VB_USDC = '0x203A662b0BD271A6ed5a60EdFbd04bFce608FD36';
const KAT = '0x7F1f4b4b29f5058fA32CC7a97141b8D7e5ABDC2d';
const USD_PRICE_FEED = '0x64518f821Cd07A9471711Eba5D8fEF9c75063B01';
const KAT_PRICE_SOURCE = '0xc62782910529ee50eFDa9a0273B20d8bD1C1e4b2';
const ERC20_BALANCE_FUSE = '0xb81C00eb71a3D629E6f7Ba66a26218c418D438b8';
const MORPHO_BALANCE_FUSE = '0x70Ed27aEE2dD509bC6BB067d8e2C61A1FE96eCa4';
const MORPHO_SUPPLY_FUSE = '0x1f657229ec2D261be7dCD63ca82abed334d1f28b';
const MERKL_CLAIM_FUSE = '0xF4278e62a6B5A45E378e6692C7Aa9C7291E7ce36';

const AVKAT_MARKET = '0xbd48214a2f12e951da20ad0b8fd83b611c693b5bbaa280b68ba4075678f2a138';
const SIUSD_MARKET = '0xf7fc5cc82200ddf8f23188ddbd6727eda2c8bc41863e91fb767bbc6e4f71890e';
const WEETH_MARKET = '0x76e311d4b0e2e6ae88ad9bab18063452a6d39837d7104c430ff62457b91cb2cb';
const EXPECTED_ROUTE = '0x7f1f4b4b29f5058fa32cc7a97141b8d7e5abdc2d0001f4203a662b0bd271a6ed5a60edfbd04bfce608fd36';

const EXPECTED_SCRIPT_PATH = 'cyvbUSDC/script/DeployCyvbUSDC_v3.s.sol';
const EXPECTED_REWARD_ARTIFACT = 'out/KatRewardSwapAndSplitFuse_v3.sol/KatRewardSwapAndSplitFuse_v3.json';

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

function bytes32Address(ethers, address) {
  return ethers.zeroPadValue(address, 32);
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

async function withTimeout(promise, label, ms) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('WATCHDOG_TIMEOUT: ' + label + ' exceeded ' + ms + 'ms')),
          ms
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function waitTx(tx, label, evidence) {
  const receipt = await withTimeout(tx.wait(), 'tx receipt: ' + label, 90_000);
  assert(receipt && receipt.status === 1, label + ' transaction failed');
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
    'src = "cyvbUSDC/contracts"',
    'script = "cyvbUSDC/script"',
    'test = "cyvbUSDC/test"',
    'out = "out"',
    'libs = ["lib"]',
    'optimizer = true',
    'optimizer_runs = 10000000',
    'evm_version = "cancun"',
    ''
  ].join('\n');
  await fs.writeFile(path.join(root, 'foundry.toml'), config);
}

async function verifyPinnedSource(root) {
  const script = await fs.readFile(path.join(root, EXPECTED_SCRIPT_PATH), 'utf8');
  const checks = [
    'contract DeployCyvbUSDC_v3 is Script',
    'FACTORY.clone(',
    '"CurveYield USDC"',
    '"cyvbUSDC"',
    'MIDDLE_WAY_PACKAGE_INDEX = 1',
    'CURVEYIELD_MANAGEMENT_BPS = 50',
    'CURVEYIELD_PERFORMANCE_BPS = 800',
    'REWARD_VESTING_TIME = 15 days',
    'MORPHO_LIQUIDITY_SUPPLY_FUSE = 0x1f657229ec2D261be7dCD63ca82abed334d1f28b',
    'MERKL_CLAIM_FUSE = 0xF4278e62a6B5A45E378e6692C7Aa9C7291E7ce36',
    'new KatRewardSwapAndSplitFuse_v3(',
    'vault.convertToPublicVault();',
    'vault.enableTransferShares();'
  ];
  for (const needle of checks) assert(script.includes(needle), 'Pinned deployment source drift: missing ' + needle);
  return { path: EXPECTED_SCRIPT_PATH, checks };
}

async function startKatanaFork({ forkUrl }) {
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
      if (attempt === 4) break;
      await new Promise((resolve) => setTimeout(resolve, 1200 * attempt));
    }
  }
  throw lastError ?? new Error('Katana Anvil fork failed to start');
}

async function safeExec({ safe, router, owner, data, ethers, evidence }) {
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
    { gasLimit: 7_000_000n }
  );
  return await waitTx(tx, 'fork-only Safe router configuration', evidence);
}

async function ensureForkRoute({ provider, ethers, txEvidence }) {
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

  const localReadSigner = await provider.getSigner(0);
  const routerRead = new ethers.Contract(ROUTER, routerAbi, localReadSigner);
  const current = await routerRead.routeFor(KAT, VB_USDC);
  if (current !== '0x') {
    assert(lower(current) === lower(EXPECTED_ROUTE), 'Existing route differs from expected direct KAT/vbUSDC path');
    const guard = await routerRead.routeTwapGuard(KAT, VB_USDC);
    return {
      installedBySimulation: false,
      route: current,
      guard: [Number(guard[0]), Number(guard[1]), guard[2]],
    };
  }

  const safeRead = new ethers.Contract(SAFE, safeAbi, localReadSigner);
  const owners = await safeRead.getOwners();
  const threshold = await safeRead.getThreshold();
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
    data: router.interface.encodeFunctionData('setRoute', [KAT, VB_USDC, EXPECTED_ROUTE]),
    ethers,
    evidence: txEvidence,
  });
  await safeExec({
    safe,
    router,
    owner,
    data: router.interface.encodeFunctionData('setRouteFeeBps', [KAT, VB_USDC, 0]),
    ethers,
    evidence: txEvidence,
  });
  await safeExec({
    safe,
    router,
    owner,
    data: router.interface.encodeFunctionData('setRouteTwapGuard', [KAT, VB_USDC, 900, 200]),
    ethers,
    evidence: txEvidence,
  });

  const installed = await routerRead.routeFor(KAT, VB_USDC);
  const guard = await routerRead.routeTwapGuard(KAT, VB_USDC);
  assert(lower(installed) === lower(EXPECTED_ROUTE), 'Fork route installation mismatch');
  assert(Number(guard[0]) === 900 && Number(guard[1]) === 200 && guard[2] === true, 'Fork TWAP guard mismatch');

  return {
    installedBySimulation: true,
    owner,
    route: installed,
    guard: [Number(guard[0]), Number(guard[1]), guard[2]],
  };
}

async function compileRewardFuse({ smartRoot }) {
  await writeFoundryConfig(smartRoot);
  const build = await run('forge', ['build', '--sizes'], { cwd: smartRoot });
  assert(build.code === 0, 'Smart-Contracts forge build failed');

  const artifactPath = path.join(smartRoot, EXPECTED_REWARD_ARTIFACT);
  const artifact = JSON.parse(await fs.readFile(artifactPath, 'utf8'));
  const bytecode = artifact?.bytecode?.object;
  assert(typeof bytecode === 'string' && bytecode.length > 4, 'KatRewardSwapAndSplitFuse_v3 bytecode missing');
  assert(Array.isArray(artifact.abi), 'KatRewardSwapAndSplitFuse_v3 ABI missing');

  return {
    artifactPath: EXPECTED_REWARD_ARTIFACT,
    abi: artifact.abi,
    bytecode,
  };
}

async function executeDeploymentPlan({ provider, ethers, rewardArtifact, txEvidence }) {
  const signer = await provider.getSigner(0);
  const deployer = await signer.getAddress();

  for (const address of [
    FACTORY, VB_USDC, KAT, USD_PRICE_FEED, KAT_PRICE_SOURCE,
    ERC20_BALANCE_FUSE, MORPHO_BALANCE_FUSE, MORPHO_SUPPLY_FUSE,
    MERKL_CLAIM_FUSE, ROUTER
  ]) {
    assert((await provider.getCode(address)) !== '0x', 'External dependency code missing at ' + address);
  }

  const factoryAbi = [
    'function getDaoFeePackages() view returns ((uint256 managementFee,uint256 performanceFee,address feeRecipient)[])',
    'function clone(string,string,address,uint256,address,uint256)',
    'event FusionInstanceCreated(uint256 index,uint256 version,string assetName,string assetSymbol,uint8 assetDecimals,address underlyingToken,string underlyingTokenSymbol,uint8 underlyingTokenDecimals,address initialOwner,address plasmaVault,address plasmaVaultBase,address feeManager)'
  ];
  const factory = new ethers.Contract(FACTORY, factoryAbi, signer);

  const packages = await factory.getDaoFeePackages();
  assert(packages.length > 1, 'Middle Way package missing');
  assert(packages[1].managementFee === 30n, 'Middle Way management fee changed');
  assert(packages[1].performanceFee === 200n, 'Middle Way performance fee changed');
  assert(packages[1].feeRecipient !== ethers.ZeroAddress, 'Middle Way IPOR recipient is zero');

  const router = new ethers.Contract(ROUTER, ['function routeFor(address,address) view returns (bytes)'], signer);
  assert((await router.routeFor(KAT, VB_USDC)) !== '0x', 'KAT->vbUSDC route prerequisite missing');

  const cloneReceipt = await waitTx(
    await factory.clone('CurveYield USDC', 'cyvbUSDC', VB_USDC, 0n, deployer, 1n, { gasLimit: 30_000_000n }),
    'FACTORY.clone',
    txEvidence
  );

  const topic = factory.interface.getEvent('FusionInstanceCreated').topicHash;
  const eventLog = cloneReceipt.logs.find((log) => lower(log.address) === lower(FACTORY) && log.topics[0] === topic);
  assert(eventLog, 'FusionInstanceCreated event missing');
  const created = factory.interface.parseLog(eventLog);
  assert(created, 'FusionInstanceCreated could not be decoded');
  assert(created.args.assetName === 'CurveYield USDC', 'factory event vault name mismatch');
  assert(created.args.assetSymbol === 'cyvbUSDC', 'factory event vault symbol mismatch');
  assert(lower(created.args.underlyingToken) === lower(VB_USDC), 'factory event underlying mismatch');

  const plasmaVault = created.args.plasmaVault;
  const feeManagerAddress = created.args.feeManager;

  const vaultAbi = [
    'function name() view returns (string)',
    'function symbol() view returns (string)',
    'function asset() view returns (address)',
    'function getAccessManagerAddress() view returns (address)',
    'function getRewardsClaimManagerAddress() view returns (address)',
    'function getPriceOracleMiddleware() view returns (address)',
    'function addFuses(address[])',
    'function addBalanceFuse(uint256,address)',
    'function grantMarketSubstrates(uint256,bytes32[])',
    'function configureInstantWithdrawalFuses((address fuse,bytes32[] params)[])',
    'function convertToPublicVault()',
    'function enableTransferShares()',
    'function getFuses() view returns (address[])',
    'function getInstantWithdrawalFuses() view returns (address[])',
    'function getMarketSubstrates(uint256) view returns (bytes32[])',
    'function getManagementFeeData() view returns ((address feeAccount,uint16 feeInPercentage,uint32 lastUpdateTimestamp))',
    'function getPerformanceFeeData() view returns ((address feeAccount,uint16 feeInPercentage))'
  ];
  const vault = new ethers.Contract(plasmaVault, vaultAbi, signer);
  const [accessManager, rewardsManager, priceManager] = await Promise.all([
    vault.getAccessManagerAddress(),
    vault.getRewardsClaimManagerAddress(),
    vault.getPriceOracleMiddleware(),
  ]);

  const access = new ethers.Contract(accessManager, [
    'function grantRole(uint64,address,uint32)',
    'function hasRole(uint64,address) view returns (bool,uint32)'
  ], signer);

  for (const [role, account, label] of [
    [100, deployer, 'grant ATOMIST'],
    [300, deployer, 'grant FUSE_MANAGER'],
    [900, deployer, 'grant CONFIG_INSTANT_WITHDRAWAL_FUSES'],
    [1200, deployer, 'grant PRICE_ORACLE_MIDDLEWARE_MANAGER'],
    [200, deployer, 'grant ALPHA'],
    [600, deployer, 'grant CLAIM_REWARDS'],
    [1000, deployer, 'grant UPDATE_MARKETS_BALANCES'],
    [1100, plasmaVault, 'grant vault UPDATE_REWARDS_BALANCE']
  ]) {
    await waitTx(await access.grantRole(role, account, 0, { gasLimit: 2_000_000n }), label, txEvidence);
  }

  const price = new ethers.Contract(priceManager, [
    'function setAssetsPriceSources(address[],address[])',
    'function getSourceOfAssetPrice(address) view returns (address)'
  ], signer);
  await waitTx(
    await price.setAssetsPriceSources(
      [VB_USDC, KAT],
      [USD_PRICE_FEED, KAT_PRICE_SOURCE],
      { gasLimit: 3_000_000n }
    ),
    'set vbUSDC/KAT price sources',
    txEvidence
  );

  await waitTx(await vault.addFuses([MORPHO_SUPPLY_FUSE], { gasLimit: 3_000_000n }), 'add Morpho supply fuse', txEvidence);
  await waitTx(await vault.addBalanceFuse(41, MORPHO_BALANCE_FUSE, { gasLimit: 2_000_000n }), 'add market41 balance fuse', txEvidence);
  await waitTx(await vault.addBalanceFuse(7, ERC20_BALANCE_FUSE, { gasLimit: 2_000_000n }), 'add market7 balance fuse', txEvidence);

  await waitTx(
    await vault.grantMarketSubstrates(41, [AVKAT_MARKET, SIUSD_MARKET, WEETH_MARKET], { gasLimit: 3_000_000n }),
    'grant Morpho market substrates',
    txEvidence
  );
  await waitTx(
    await vault.grantMarketSubstrates(7, [bytes32Address(ethers, KAT)], { gasLimit: 2_000_000n }),
    'grant residual KAT substrate',
    txEvidence
  );

  const zero = ethers.ZeroHash;
  const instant = [
    { fuse: MORPHO_SUPPLY_FUSE, params: [zero, AVKAT_MARKET] },
    { fuse: MORPHO_SUPPLY_FUSE, params: [zero, SIUSD_MARKET] },
    { fuse: MORPHO_SUPPLY_FUSE, params: [zero, WEETH_MARKET] },
  ];
  await waitTx(
    await vault.configureInstantWithdrawalFuses(instant, { gasLimit: 4_000_000n }),
    'configure three instant withdrawal fuses',
    txEvidence
  );

  const feeManager = new ethers.Contract(feeManagerAddress, [
    'function updateManagementFee((address recipient,uint256 feeValue)[])',
    'function updatePerformanceFee((address recipient,uint256 feeValue)[])',
    'function getTotalManagementFee() view returns (uint256)',
    'function getTotalPerformanceFee() view returns (uint256)',
    'function getManagementFeeRecipients() view returns ((address recipient,uint256 feeValue)[])',
    'function getPerformanceFeeRecipients() view returns ((address recipient,uint256 feeValue)[])'
  ], signer);
  await waitTx(
    await feeManager.updateManagementFee([{ recipient: SAFE, feeValue: 50n }], { gasLimit: 4_000_000n }),
    'configure CurveYield management fee',
    txEvidence
  );
  await waitTx(
    await feeManager.updatePerformanceFee([{ recipient: SAFE, feeValue: 800n }], { gasLimit: 4_000_000n }),
    'configure CurveYield performance fee',
    txEvidence
  );

  const rewards = new ethers.Contract(rewardsManager, [
    'function setupVestingTime(uint256)',
    'function addRewardFuses(address[])',
    'function getRewardsFuses() view returns (address[])',
    'function isRewardFuseSupported(address) view returns (bool)',
    'function getVestingData() view returns ((uint32 vestingTime,uint32 updateBalanceTimestamp,uint128 transferredTokens,uint128 lastUpdateBalance))'
  ], signer);
  await waitTx(await rewards.setupVestingTime(15n * 24n * 60n * 60n, { gasLimit: 2_000_000n }), 'set 15-day reward vesting', txEvidence);

  const rewardFactory = new ethers.ContractFactory(rewardArtifact.abi, rewardArtifact.bytecode, signer);
  const rewardFuse = await rewardFactory.deploy(plasmaVault, rewardsManager, ROUTER, { gasLimit: 9_000_000n });
  const rewardDeployTx = rewardFuse.deploymentTransaction();
  assert(rewardDeployTx, 'custom reward fuse deployment transaction missing');
  await waitTx(rewardDeployTx, 'deploy KatRewardSwapAndSplitFuse_v3', txEvidence);
  const rewardFuseAddress = await rewardFuse.getAddress();

  await waitTx(
    await rewards.addRewardFuses([MERKL_CLAIM_FUSE, rewardFuseAddress], { gasLimit: 3_000_000n }),
    'install Merkl and KAT reward fuses',
    txEvidence
  );

  await waitTx(await vault.convertToPublicVault({ gasLimit: 2_000_000n }), 'convert to public vault', txEvidence);
  await waitTx(await vault.enableTransferShares({ gasLimit: 2_000_000n }), 'enable share transfers', txEvidence);

  return {
    deployer,
    plasmaVault,
    feeManagerAddress,
    accessManager,
    rewardsManager,
    priceManager,
    rewardFuseAddress,
    signer,
    vault,
    access,
    price,
    feeManager,
    rewards,
  };
}

async function verifyDeployment({ context, provider, ethers }) {
  const {
    deployer, plasmaVault, feeManagerAddress, accessManager, rewardsManager,
    priceManager, rewardFuseAddress, signer, vault, access, price, feeManager, rewards
  } = context;

  const [
    name,
    symbol,
    asset,
    fuses,
    instant,
    market41,
    market7,
    management,
    performance,
    totalManagement,
    totalPerformance,
    managementRecipients,
    performanceRecipients,
    rewardFuses,
    vesting,
    alpha,
    claimer,
    marketUpdater,
    vaultUpdater,
  ] = await Promise.all([
    vault.name(),
    vault.symbol(),
    vault.asset(),
    vault.getFuses(),
    vault.getInstantWithdrawalFuses(),
    vault.getMarketSubstrates(41),
    vault.getMarketSubstrates(7),
    vault.getManagementFeeData(),
    vault.getPerformanceFeeData(),
    feeManager.getTotalManagementFee(),
    feeManager.getTotalPerformanceFee(),
    feeManager.getManagementFeeRecipients(),
    feeManager.getPerformanceFeeRecipients(),
    rewards.getRewardsFuses(),
    rewards.getVestingData(),
    access.hasRole(200, deployer),
    access.hasRole(600, deployer),
    access.hasRole(1000, deployer),
    access.hasRole(1100, plasmaVault),
  ]);

  assert(name === 'CurveYield USDC', 'deployed name mismatch');
  assert(symbol === 'cyvbUSDC', 'deployed symbol mismatch');
  assert(lower(asset) === lower(VB_USDC), 'deployed asset mismatch');

  assert(fuses.map(lower).includes(lower(MORPHO_SUPPLY_FUSE)), 'Morpho supply fuse missing');
  assert(instant.length === 3 && instant.every((x) => lower(x) === lower(MORPHO_SUPPLY_FUSE)), 'instant withdrawal fuse list mismatch');

  assert(market41.length === 3, 'market41 substrate count mismatch');
  assert(lower(market41[0]) === lower(AVKAT_MARKET), 'avKAT market order mismatch');
  assert(lower(market41[1]) === lower(SIUSD_MARKET), 'siUSD market order mismatch');
  assert(lower(market41[2]) === lower(WEETH_MARKET), 'weETH market order mismatch');
  assert(market7.length === 1 && lower(market7[0]) === lower(bytes32Address(ethers, KAT)), 'residual KAT substrate mismatch');

  assert(Number(management.feeInPercentage) === 80, 'vault management fee mismatch');
  assert(Number(performance.feeInPercentage) === 1000, 'vault performance fee mismatch');
  assert(totalManagement === 80n, 'FeeManager total management mismatch');
  assert(totalPerformance === 1000n, 'FeeManager total performance mismatch');
  assert(managementRecipients.length === 1, 'management recipient count mismatch');
  assert(lower(managementRecipients[0].recipient) === lower(SAFE) && managementRecipients[0].feeValue === 50n, 'management recipient/value mismatch');
  assert(performanceRecipients.length === 1, 'performance recipient count mismatch');
  assert(lower(performanceRecipients[0].recipient) === lower(SAFE) && performanceRecipients[0].feeValue === 800n, 'performance recipient/value mismatch');

  assert(lower(await price.getSourceOfAssetPrice(VB_USDC)) === lower(USD_PRICE_FEED), 'vbUSDC price source mismatch');
  assert(lower(await price.getSourceOfAssetPrice(KAT)) === lower(KAT_PRICE_SOURCE), 'KAT price source mismatch');

  assert(rewardFuses.map(lower).includes(lower(MERKL_CLAIM_FUSE)), 'Merkl reward fuse missing');
  assert(rewardFuses.map(lower).includes(lower(rewardFuseAddress)), 'custom reward fuse missing');
  assert(Number(vesting.vestingTime) === 15 * 24 * 60 * 60, 'reward vesting mismatch');

  assert(alpha[0] === true && Number(alpha[1]) === 0, 'ALPHA role mismatch');
  assert(claimer[0] === true && Number(claimer[1]) === 0, 'CLAIM_REWARDS role mismatch');
  assert(marketUpdater[0] === true && Number(marketUpdater[1]) === 0, 'UPDATE_MARKETS_BALANCES role mismatch');
  assert(vaultUpdater[0] === true && Number(vaultUpdater[1]) === 0, 'vault UPDATE_REWARDS_BALANCE role mismatch');

  const reward = new ethers.Contract(rewardFuseAddress, [
    'function VAULT() view returns (address)',
    'function MANAGER() view returns (address)',
    'function ROUTER() view returns (address)',
    'function ADMIN_FEE_RECEIVER() view returns (address)',
    'function KAT() view returns (address)',
    'function VB_USDC() view returns (address)'
  ], signer);
  assert(lower(await reward.VAULT()) === lower(plasmaVault), 'reward fuse VAULT binding mismatch');
  assert(lower(await reward.MANAGER()) === lower(rewardsManager), 'reward fuse MANAGER binding mismatch');
  assert(lower(await reward.ROUTER()) === lower(ROUTER), 'reward fuse ROUTER binding mismatch');
  assert(lower(await reward.ADMIN_FEE_RECEIVER()) === lower(SAFE), 'reward fuse admin receiver mismatch');
  assert(lower(await reward.KAT()) === lower(KAT), 'reward fuse KAT mismatch');
  assert(lower(await reward.VB_USDC()) === lower(VB_USDC), 'reward fuse vbUSDC mismatch');

  return {
    plasmaVault,
    feeManager: feeManagerAddress,
    accessManager,
    rewardsManager,
    priceManager,
    rewardFuse: rewardFuseAddress,
    name,
    symbol,
    asset,
    installedFuses: fuses,
    instantWithdrawalFuses: instant,
    market41Substrates: market41,
    market7Substrates: market7,
    managementFeeBps: Number(totalManagement),
    performanceFeeBps: Number(totalPerformance),
    managementRecipients: managementRecipients.map((x) => ({ recipient: x.recipient, feeValue: x.feeValue.toString() })),
    performanceRecipients: performanceRecipients.map((x) => ({ recipient: x.recipient, feeValue: x.feeValue.toString() })),
    rewardFuses,
    rewardVestingSeconds: Number(vesting.vestingTime),
    roles: {
      alpha: alpha[0],
      claimRewards: claimer[0],
      updateMarketsBalances: marketUpdater[0],
      vaultUpdateRewardsBalance: vaultUpdater[0],
    },
  };
}


const SMART_CONTRACTS_COMMIT = 'ef8c02efab79c718cd401be6ca5d05dac0b3cff9';

const VBWBTC = '0x0913DA6Da4b42f538B445599b46Bb4622342Cf52';
const FXUSD = '0x1364b238C668A2dec1294174e4798E8c09979f86';
const FX_POOL_MANAGER = '0xFae375C9eA6636c40deB92DD91B7dbbF51BD3C68';
const FX_POOL = '0xE32B9b4C8f776687Ec54B4b6B62DbD9ce5fd4b99';
const FX_POOL_CONFIGURATION = '0xB582Eb17059171D09B4F78f0BB63E47C7ceEfF62';
const FXBASE = '0x6cf6757725886716Bc3c6A4bB93d02F1d1E3e7Dd';
const FX_PRICE_ORACLE = '0xeDA71e4ab642e97FBAA04beB3a7c4Bd6139a23C5';

const IPOR_ERC4626_SUPPLY_FUSE = '0xb05770874500c7dC981AF26AFb95C7656e2545c5';
const IPOR_ERC4626_BALANCE_FUSE = '0x5F8696C110Ccb3686c8B209Fc61dcf40daf88167';
const IPOR_UNIVERSAL_SWAPPER_V2 = '0x2513bA6f5603217636973F130128fc0372084C1E';
const IPOR_UNIVERSAL_SWAPPER_BALANCE_V2 = '0x87dF04464459Bfb377aFB130aD3Fd98A0957C0b1';
const IPOR_BALANCE_FUSES_READER = '0xaBa54310aF826DFE3153f78dB2eaa27eC2Be6758';

const ERC20_BALANCE_MARKET_ID = 7n;
const UNIVERSAL_SWAPPER_V2_MARKET_ID = 1202n;
const ERC4626_MARKET_ID = 100001n;

const SUSHI_VBWBTC_VBUSDC_100 = '0x92C97b702b5f8DfEa8B87535d63f7Dbe8E40E3E8';
const SUSHI_VBWBTC_VBUSDC_500 = '0x744676B3CeD942D78F9b8e9cd22246Db5c32395c';
const SUSHI_VBWBTC_VBUSDC_3000 = '0x4488005Fd5EEa2E22a80cb2A0e820ED6066e687F';

const FXUSD_TO_VBUSDC =
  '0x1364b238c668a2dec1294174e4798e8c09979f86000064203a662b0bd271a6ed5a60edfbd04bfce608fd36';
const VBUSDC_TO_FXUSD =
  '0x203a662b0bd271a6ed5a60edfbd04bfce608fd360000641364b238c668a2dec1294174e4798e8c09979f86';
const VBUSDC_TO_VBWBTC =
  '0x203a662b0bd271a6ed5a60edfbd04bfce608fd360001f40913da6da4b42f538b445599b46bb4622342cf52';

const CYVBWBTC_ARTIFACTS = {
  config: 'out/CyvbWbtcLtvConfig_v3.sol/CyvbWbtcLtvConfig_v3.json',
  gateway: 'out/CyvbWbtcGateway_v3.sol/CyvbWbtcGateway_v3.json',
  preHook: 'out/CyvbWbtcGatewayGatePreHook_v3.sol/CyvbWbtcGatewayGatePreHook_v3.json',
  priceFeed: 'out/FxMintVbWbtcPriceFeed_v2.sol/FxMintVbWbtcPriceFeed_v2.json',
  position: 'out/FxMintCyvbWbtcPositionFuse_v3.sol/FxMintCyvbWbtcPositionFuse_v3.json',
  balance: 'out/FxMintCyvbWbtcErc20BalanceFuse_v6.sol/FxMintCyvbWbtcErc20BalanceFuse_v6.json',
  instant: 'out/FxMintCyvbWbtcInstantWithdrawFuse_v4.sol/FxMintCyvbWbtcInstantWithdrawFuse_v4.json',
};

function tokenSubstrate(ethers, address) {
  return ethers.toBeHex((1n << 248n) | BigInt(address), 32);
}

function targetSubstrate(ethers, address) {
  return ethers.toBeHex((2n << 248n) | BigInt(address), 32);
}

function slippageSubstrate(ethers, wad) {
  return ethers.toBeHex((3n << 248n) | BigInt(wad), 32);
}

async function writeCyvbWbtcFoundryConfig(root) {
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

async function compileCyvbWbtc({ smartRoot }) {
  await writeCyvbWbtcFoundryConfig(smartRoot);
  const targets = [
    'cyvbWBTC/contracts/CyvbWbtcGateway_v3.sol',
    'cyvbWBTC/contracts/CyvbWbtcGatewayGatePreHook_v3.sol',
    'cyvbWBTC/contracts/CyvbWbtcLtvConfig_v3.sol',
    'cyvbWBTC/contracts/FxMintVbWbtcPriceFeed_v2.sol',
    'cyvbWBTC/contracts/FxMintCyvbWbtcPositionFuse_v3.sol',
    'cyvbWBTC/contracts/FxMintCyvbWbtcErc20BalanceFuse_v6.sol',
    'cyvbWBTC/contracts/FxMintCyvbWbtcInstantWithdrawFuse_v4.sol',
    'cyvbWBTC/script/DeployCyvbWBTC_v16.s.sol',
  ];
  const build = await run('forge', ['build', '--sizes', ...targets], { cwd: smartRoot });
  assert(build.code === 0, 'cyvbWBTC v13 forge build failed');

  const artifacts = {};
  for (const [name, rel] of Object.entries(CYVBWBTC_ARTIFACTS)) {
    const parsed = JSON.parse(await fs.readFile(path.join(smartRoot, rel), 'utf8'));
    assert(Array.isArray(parsed.abi), name + ' ABI missing');
    assert(parsed?.bytecode?.object?.length > 4, name + ' bytecode missing');
    artifacts[name] = { abi: parsed.abi, bytecode: parsed.bytecode.object };
  }
  return artifacts;
}

async function safeExecRouter({ provider, ethers, owner, router, safe, data, label, evidence }) {
  const signature = ethers.solidityPacked(['uint256','uint256','uint8'], [BigInt(owner), 0n, 1]);
  return await waitTx(
    await safe.execTransaction(
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
      { gasLimit: 8_000_000n }
    ),
    label,
    evidence
  );
}

async function ensureCyvbWbtcRoutes({ provider, ethers, evidence }) {
  const routerAbi = [
    'function routeFor(address,address) view returns (bytes)',
    'function routeTwapGuard(address,address) view returns (uint32,uint16,bool)',
    'function setRoute(address,address,bytes)',
    'function setRouteFeeBps(address,address,uint16)',
    'function setRouteTwapGuard(address,address,uint32,uint16)',
  ];
  const safeAbi = [
    'function getOwners() view returns (address[])',
    'function getThreshold() view returns (uint256)',
    'function execTransaction(address,uint256,bytes,uint8,uint256,uint256,uint256,address,address,bytes) returns (bool)',
  ];

  const readSigner = await provider.getSigner(0);
  const routerRead = new ethers.Contract(ROUTER, routerAbi, readSigner);
  const safeRead = new ethers.Contract(SAFE, safeAbi, readSigner);
  const owners = await safeRead.getOwners();
  assert(await safeRead.getThreshold() === 1n && owners.length > 0, 'CurveYield Safe unavailable');
  const owner = owners[0];

  await provider.send('anvil_impersonateAccount', [owner]);
  await provider.send('anvil_setBalance', [owner, '0x56BC75E2D63100000']);
  const signer = await provider.getSigner(owner);
  const router = new ethers.Contract(ROUTER, routerAbi, signer);
  const safe = new ethers.Contract(SAFE, safeAbi, signer);

  const routes = [
    [FXUSD, VB_USDC, FXUSD_TO_VBUSDC, 'fxUSD->vbUSDC'],
    [VB_USDC, FXUSD, VBUSDC_TO_FXUSD, 'vbUSDC->fxUSD'],
    [VB_USDC, VBWBTC, VBUSDC_TO_VBWBTC, 'vbUSDC->vbWBTC'],
  ];

  const result = [];
  for (const [tokenIn, tokenOut, expected, label] of routes) {
    let route = await routerRead.routeFor(tokenIn, tokenOut);
    let guard = await routerRead.routeTwapGuard(tokenIn, tokenOut);
    let installedBySimulation = false;

    if (
      lower(route) !== lower(expected) ||
      Number(guard[0]) !== 900 ||
      Number(guard[1]) !== 200 ||
      guard[2] !== true
    ) {
      installedBySimulation = true;
      await safeExecRouter({
        provider, ethers, owner, router, safe,
        data: router.interface.encodeFunctionData('setRoute', [tokenIn, tokenOut, expected]),
        label: 'fork route ' + label,
        evidence,
      });
      await safeExecRouter({
        provider, ethers, owner, router, safe,
        data: router.interface.encodeFunctionData('setRouteFeeBps', [tokenIn, tokenOut, 0]),
        label: 'fork route fee ' + label,
        evidence,
      });
      await safeExecRouter({
        provider, ethers, owner, router, safe,
        data: router.interface.encodeFunctionData('setRouteTwapGuard', [tokenIn, tokenOut, 900, 200]),
        label: 'fork TWAP ' + label,
        evidence,
      });
      route = await routerRead.routeFor(tokenIn, tokenOut);
      guard = await routerRead.routeTwapGuard(tokenIn, tokenOut);
    }

    assert(lower(route) === lower(expected), label + ' route mismatch');
    assert(Number(guard[0]) === 900 && Number(guard[1]) === 200 && guard[2] === true, label + ' guard mismatch');
    result.push({ label, installedBySimulation, route, guard: [Number(guard[0]), Number(guard[1]), guard[2]] });
  }
  return result;
}

async function deployArtifactV13({ ethers, signer, artifact, args, label, evidence }) {
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, signer);
  const contract = await factory.deploy(...args, { gasLimit: 12_000_000n });
  const tx = contract.deploymentTransaction();
  assert(tx, label + ' deployment transaction missing');
  await waitTx(tx, label, evidence);
  return contract;
}

function cyvbWbtcVault(ethers, address, signer) {
  return new ethers.Contract(address, [
    'function name() view returns (string)',
    'function symbol() view returns (string)',
    'function asset() view returns (address)',
    'function totalAssets() view returns (uint256)',
    'function totalSupply() view returns (uint256)',
    'function balanceOf(address) view returns (uint256)',
    'function previewRedeem(uint256) view returns (uint256)',
    'function approve(address,uint256) returns (bool)',
    'function transfer(address,uint256) returns (bool)',
    'function getAccessManagerAddress() view returns (address)',
    'function getPriceOracleMiddleware() view returns (address)',
    'function addFuses(address[])',
    'function addBalanceFuse(uint256,address)',
    'function grantMarketSubstrates(uint256,bytes32[])',
    'function updateDependencyBalanceGraphs(uint256[],uint256[][])',
    'function configureInstantWithdrawalFuses((address fuse,bytes32[] params)[])',
    'function setPreHookImplementations(bytes4[],address[],bytes32[][])',
    'function convertToPublicVault()',
    'function enableTransferShares()',
    'function getFuses() view returns (address[])',
    'function getInstantWithdrawalFuses() view returns (address[])',
    'function getBalanceFuse(uint256) view returns (address)',
    'function getMarketSubstrates(uint256) view returns (bytes32[])',
    'function getDependencyBalanceGraph(uint256) view returns (uint256[])',
    'function execute((address fuse,bytes data)[])',
  ], signer);
}

async function cloneFusionVault({ ethers, signer, name, symbol, asset, owner, evidence }) {
  const factory = new ethers.Contract(FACTORY, [
    'function clone(string,string,address,uint256,address,uint256)',
    'event FusionInstanceCreated(uint256 index,uint256 version,string assetName,string assetSymbol,uint8 assetDecimals,address underlyingToken,string underlyingTokenSymbol,uint8 underlyingTokenDecimals,address initialOwner,address plasmaVault,address plasmaVaultBase,address feeManager)',
  ], signer);
  const receipt = await waitTx(
    await factory.clone(name, symbol, asset, 0n, owner, 1n, { gasLimit: 30_000_000n }),
    'factory clone ' + symbol,
    evidence
  );
  const topic = factory.interface.getEvent('FusionInstanceCreated').topicHash;
  const log = receipt.logs.find((x) => lower(x.address) === lower(FACTORY) && x.topics[0] === topic);
  assert(log, symbol + ' clone event missing');
  const event = factory.interface.parseLog(log);
  assert(event, symbol + ' clone decode failed');
  return {
    vault: event.args.plasmaVault,
    feeManager: event.args.feeManager,
    initialOwner: event.args.initialOwner,
  };
}

async function grantCyvbWbtcRoles({ ethers, vault, signer, deployer, evidence }) {
  const accessAddress = await vault.getAccessManagerAddress();
  const access = new ethers.Contract(accessAddress, [
    'function grantRole(uint64,address,uint32)',
    'function hasRole(uint64,address) view returns (bool,uint32)',
  ], signer);

  for (const [role, account, label] of [
    [100, deployer, 'ATOMIST'],
    [300, deployer, 'FUSE_MANAGER'],
    [301, deployer, 'PRE_HOOKS_MANAGER'],
    [900, deployer, 'CONFIG_INSTANT_WITHDRAWAL_FUSES'],
    [1200, deployer, 'PRICE_ORACLE_MIDDLEWARE_MANAGER'],
    [200, deployer, 'ALPHA'],
    [1000, deployer, 'UPDATE_MARKETS_BALANCES'],
  ]) {
    await waitTx(
      await access.grantRole(role, account, 0, { gasLimit: 2_000_000n }),
      'cyvbWBTC role ' + label,
      evidence
    );
  }
  return { accessAddress, access };
}

async function deployCyvbWbtcV13({ provider, ethers, artifacts, nestedVault, signer, deployer, evidence }) {
  const cloned = await cloneFusionVault({
    ethers, signer,
    name: 'CurveYield vbWBTC',
    symbol: 'cyvbWBTC',
    asset: VBWBTC,
    owner: deployer,
    evidence,
  });

  const vault = cyvbWbtcVault(ethers, cloned.vault, signer);
  const { accessAddress, access } = await grantCyvbWbtcRoles({
    ethers, vault, signer, deployer, evidence,
  });

  const config = await deployArtifactV13({
    ethers, signer, artifact: artifacts.config, args: [deployer],
    label: 'deploy cyvbWBTC LTV config v3', evidence,
  });
  await waitTx(
    await config.bindVault(cloned.vault, { gasLimit: 2_000_000n }),
    'bind cyvbWBTC config',
    evidence
  );

  const gateway = await deployArtifactV13({
    ethers, signer, artifact: artifacts.gateway, args: [cloned.vault, VBWBTC],
    label: 'deploy cyvbWBTC gateway v3', evidence,
  });
  const preHook = await deployArtifactV13({
    ethers, signer, artifact: artifacts.preHook, args: [await gateway.getAddress()],
    label: 'deploy cyvbWBTC gateway prehook v3', evidence,
  });
  const priceFeed = await deployArtifactV13({
    ethers, signer, artifact: artifacts.priceFeed, args: [FX_PRICE_ORACLE],
    label: 'deploy cyvbWBTC f(x) price feed v2', evidence,
  });
  const positionFuse = await deployArtifactV13({
    ethers, signer, artifact: artifacts.position,
    args: [await config.getAddress(), FX_POOL_MANAGER, FX_POOL, VBWBTC, FXUSD],
    label: 'deploy cyvbWBTC f(x) position fuse v3', evidence,
  });
  const balanceFuse = await deployArtifactV13({
    ethers, signer, artifact: artifacts.balance,
    args: [await config.getAddress(), FX_POOL],
    label: 'deploy cyvbWBTC market-7 balance fuse v5', evidence,
  });
  const instantFuse = await deployArtifactV13({
    ethers, signer, artifact: artifacts.instant,
    args: [
      await config.getAddress(),
      FX_POOL_MANAGER,
      FX_POOL,
      FXBASE,
      FXUSD,
      VBWBTC,
      VB_USDC,
      nestedVault,
      ROUTER,
    ],
    label: 'deploy cyvbWBTC instant fuse v4', evidence,
  });

  const priceManagerAddress = await vault.getPriceOracleMiddleware();
  const priceManager = new ethers.Contract(priceManagerAddress, [
    'function setAssetsPriceSources(address[],address[])',
    'function getSourceOfAssetPrice(address) view returns (address)',
  ], signer);
  await waitTx(
    await priceManager.setAssetsPriceSources(
      [VBWBTC, VB_USDC, FXUSD],
      [await priceFeed.getAddress(), USD_PRICE_FEED, USD_PRICE_FEED],
      { gasLimit: 4_000_000n }
    ),
    'configure cyvbWBTC price sources',
    evidence
  );

  await waitTx(
    await vault.addFuses([
      await positionFuse.getAddress(),
      await instantFuse.getAddress(),
      IPOR_ERC4626_SUPPLY_FUSE,
      IPOR_UNIVERSAL_SWAPPER_V2,
    ], { gasLimit: 4_000_000n }),
    'install cyvbWBTC fuses',
    evidence
  );

  await waitTx(
    await vault.addBalanceFuse(ERC20_BALANCE_MARKET_ID, await balanceFuse.getAddress(), { gasLimit: 2_000_000n }),
    'install market-7 ERC20/f(x) balance fuse',
    evidence
  );
  await waitTx(
    await vault.addBalanceFuse(ERC4626_MARKET_ID, IPOR_ERC4626_BALANCE_FUSE, { gasLimit: 2_000_000n }),
    'install canonical ERC4626 balance fuse',
    evidence
  );
  await waitTx(
    await vault.addBalanceFuse(UNIVERSAL_SWAPPER_V2_MARKET_ID, IPOR_UNIVERSAL_SWAPPER_BALANCE_V2, { gasLimit: 2_000_000n }),
    'install canonical universal swapper balance fuse',
    evidence
  );

  await waitTx(
    await vault.grantMarketSubstrates(
      ERC20_BALANCE_MARKET_ID,
      [bytes32Address(ethers, FX_POOL), bytes32Address(ethers, FXUSD), bytes32Address(ethers, VB_USDC)],
      { gasLimit: 3_000_000n }
    ),
    'grant market-7 f(x)/stable substrates',
    evidence
  );
  await waitTx(
    await vault.grantMarketSubstrates(
      ERC4626_MARKET_ID,
      [bytes32Address(ethers, nestedVault)],
      { gasLimit: 2_000_000n }
    ),
    'grant nested cyvbUSDC substrate',
    evidence
  );
  await waitTx(
    await vault.grantMarketSubstrates(
      UNIVERSAL_SWAPPER_V2_MARKET_ID,
      [
        tokenSubstrate(ethers, FXUSD),
        tokenSubstrate(ethers, VB_USDC),
        tokenSubstrate(ethers, VBWBTC),
        targetSubstrate(ethers, FXUSD),
        targetSubstrate(ethers, VB_USDC),
        targetSubstrate(ethers, VBWBTC),
        targetSubstrate(ethers, ROUTER),
        slippageSubstrate(ethers, 10n ** 16n),
      ],
      { gasLimit: 5_000_000n }
    ),
    'grant canonical swapper substrates',
    evidence
  );

  await waitTx(
    await vault.updateDependencyBalanceGraphs(
      [ERC4626_MARKET_ID, UNIVERSAL_SWAPPER_V2_MARKET_ID],
      [[ERC20_BALANCE_MARKET_ID], [ERC20_BALANCE_MARKET_ID]],
      { gasLimit: 3_000_000n }
    ),
    'configure canonical balance dependencies',
    evidence
  );

  await waitTx(
    await vault.configureInstantWithdrawalFuses([
      { fuse: await instantFuse.getAddress(), params: [ethers.ZeroHash] },
    ], { gasLimit: 3_000_000n }),
    'configure cyvbWBTC instant withdrawal fuse',
    evidence
  );

  const selectors = [
    ethers.id('deposit(uint256,address)').slice(0,10),
    ethers.id('mint(uint256,address)').slice(0,10),
    ethers.id('depositWithPermit(uint256,address,uint256,uint8,bytes32,bytes32)').slice(0,10),
    ethers.id('withdraw(uint256,address,address)').slice(0,10),
    ethers.id('redeem(uint256,address,address)').slice(0,10),
  ];
  const hookAddress = await preHook.getAddress();
  await waitTx(
    await vault.setPreHookImplementations(
      selectors,
      selectors.map(() => hookAddress),
      selectors.map(() => []),
      { gasLimit: 4_000_000n }
    ),
    'install cyvbWBTC gateway-only prehooks',
    evidence
  );

  const feeManager = new ethers.Contract(cloned.feeManager, [
    'function updateManagementFee((address recipient,uint256 feeValue)[])',
    'function updatePerformanceFee((address recipient,uint256 feeValue)[])',
    'function setDepositFee(uint256)',
    'function getTotalManagementFee() view returns (uint256)',
    'function getTotalPerformanceFee() view returns (uint256)',
    'function getDepositFee() view returns (uint256)',
  ], signer);
  await waitTx(
    await feeManager.updateManagementFee([{ recipient: SAFE, feeValue: 100n }], { gasLimit: 4_000_000n }),
    'configure cyvbWBTC management fee',
    evidence
  );
  await waitTx(
    await feeManager.updatePerformanceFee([{ recipient: SAFE, feeValue: 800n }], { gasLimit: 4_000_000n }),
    'configure cyvbWBTC performance fee',
    evidence
  );
  await waitTx(
    await feeManager.setDepositFee(0n, { gasLimit: 2_000_000n }),
    'disable IPOR native deposit fee',
    evidence
  );

  await waitTx(await vault.convertToPublicVault({ gasLimit: 2_000_000n }), 'cyvbWBTC public vault', evidence);
  await waitTx(await vault.enableTransferShares({ gasLimit: 2_000_000n }), 'cyvbWBTC share transfers', evidence);

  return {
    ...cloned,
    vault,
    accessAddress,
    access,
    priceManagerAddress,
    priceManager,
    feeManager,
    config,
    gateway,
    preHook,
    priceFeed,
    positionFuse,
    balanceFuse,
    instantFuse,
  };
}

async function verifyCyvbWbtcV13({ ethers, deployment, nestedVault }) {
  const { vault } = deployment;
  assert(await vault.name() === 'CurveYield vbWBTC', 'cyvbWBTC name mismatch');
  assert(await vault.symbol() === 'cyvbWBTC', 'cyvbWBTC symbol mismatch');
  assert(lower(await vault.asset()) === lower(VBWBTC), 'cyvbWBTC underlying mismatch');

  assert(await deployment.positionFuse.MARKET_ID() === ERC20_BALANCE_MARKET_ID, 'position fuse custom market id detected');
  assert(await deployment.balanceFuse.MARKET_ID() === ERC20_BALANCE_MARKET_ID, 'balance fuse custom market id detected');
  assert(await deployment.instantFuse.MARKET_ID() === ERC4626_MARKET_ID, 'instant fuse custom market id detected');

  const reader = new ethers.Contract(IPOR_BALANCE_FUSES_READER, [
    'function getBalanceFuseInfo(address) view returns (uint256[] marketIds,address[] fuseAddresses)',
  ], deployment.vault.runner);

  const [balanceMarketIds, balanceFuseAddresses] =
    await reader.getBalanceFuseInfo(deployment.vault.target);

  const balanceFuseByMarket = new Map(
    balanceMarketIds.map((id, i) => [id.toString(), balanceFuseAddresses[i]])
  );

  assert(
    lower(balanceFuseByMarket.get(ERC20_BALANCE_MARKET_ID.toString())) ===
      lower(await deployment.balanceFuse.getAddress()),
    'market7 balance fuse mismatch'
  );
  assert(
    lower(balanceFuseByMarket.get(ERC4626_MARKET_ID.toString())) ===
      lower(IPOR_ERC4626_BALANCE_FUSE),
    'canonical ERC4626 balance mismatch'
  );
  assert(
    lower(balanceFuseByMarket.get(UNIVERSAL_SWAPPER_V2_MARKET_ID.toString())) ===
      lower(IPOR_UNIVERSAL_SWAPPER_BALANCE_V2),
    'canonical swapper balance mismatch'
  );

  const market7 = await vault.getMarketSubstrates(ERC20_BALANCE_MARKET_ID);
  assert(market7.length === 3, 'market7 substrate count mismatch');
  assert(lower(market7[0]) === lower(bytes32Address(ethers, FX_POOL)), 'market7 f(x) pool mismatch');
  assert(lower(market7[1]) === lower(bytes32Address(ethers, FXUSD)), 'market7 fxUSD mismatch');
  assert(lower(market7[2]) === lower(bytes32Address(ethers, VB_USDC)), 'market7 vbUSDC mismatch');

  const nested = await vault.getMarketSubstrates(ERC4626_MARKET_ID);
  assert(nested.length === 1 && lower(nested[0]) === lower(bytes32Address(ethers, nestedVault)), 'ERC4626 substrate mismatch');

  const nestedDeps = await vault.getDependencyBalanceGraph(ERC4626_MARKET_ID);
  const swapDeps = await vault.getDependencyBalanceGraph(UNIVERSAL_SWAPPER_V2_MARKET_ID);
  assert(nestedDeps.length === 1 && nestedDeps[0] === ERC20_BALANCE_MARKET_ID, 'ERC4626 dependency mismatch');
  assert(swapDeps.length === 1 && swapDeps[0] === ERC20_BALANCE_MARKET_ID, 'swapper dependency mismatch');

  const instant = await vault.getInstantWithdrawalFuses();
  assert(instant.length === 1 && lower(instant[0]) === lower(await deployment.instantFuse.getAddress()), 'instant fuse mismatch');

  assert(await deployment.feeManager.getTotalManagementFee() === 130n, 'management fee total mismatch');
  assert(await deployment.feeManager.getTotalPerformanceFee() === 1000n, 'performance fee total mismatch');
  assert(await deployment.feeManager.getDepositFee() === 0n, 'native deposit fee nonzero');

  assert(lower(await deployment.priceManager.getSourceOfAssetPrice(VBWBTC)) === lower(await deployment.priceFeed.getAddress()), 'vbWBTC price source mismatch');
  assert(lower(await deployment.priceManager.getSourceOfAssetPrice(VB_USDC)) === lower(USD_PRICE_FEED), 'vbUSDC price source mismatch');
  assert(lower(await deployment.priceManager.getSourceOfAssetPrice(FXUSD)) === lower(USD_PRICE_FEED), 'fxUSD price source mismatch');

  const policy = await deployment.config.getLtvPolicy();
  assert(policy.targetLtvBps === 5000n, 'target LTV mismatch');
  assert(policy.highTriggerBps === 6000n && policy.highResetBps === 5800n, 'high policy mismatch');
  assert(policy.lowTriggerBps === 4500n && policy.lowResetBps === 5000n, 'low policy mismatch');
  assert(await deployment.config.INSTANT_WITHDRAW_MAX_LTV_BPS() === 5500n, 'instant ceiling mismatch');
}

async function seedTokenFromPoolsV13({ provider, ethers, tokenAddress, to, amount, evidence, label }) {
  const token = new ethers.Contract(tokenAddress, [
    'function balanceOf(address) view returns (uint256)',
    'function transfer(address,uint256) returns (bool)',
  ], await provider.getSigner(0));

  const holders = [SUSHI_VBWBTC_VBUSDC_500, SUSHI_VBWBTC_VBUSDC_100, SUSHI_VBWBTC_VBUSDC_3000];
  for (const holder of holders) {
    const balance = await token.balanceOf(holder);
    if (balance < amount) continue;
    await provider.send('anvil_impersonateAccount', [holder]);
    await provider.send('anvil_setBalance', [holder, '0x56BC75E2D63100000']);
    const held = token.connect(await provider.getSigner(holder));
    await waitTx(
      await held.transfer(to, amount, { gasLimit: 1_000_000n }),
      label + ' from ' + holder,
      evidence
    );
    return holder;
  }
  throw new Error(label + ': no configured Sushi pool has enough balance');
}

async function executeFuseActions({ vault, actions, label, evidence, gasLimit = 20_000_000n }) {
  return await waitTx(
    await vault.execute(actions, { gasLimit }),
    label,
    evidence
  );
}

async function buildCanonicalSwapAction({ ethers, tokenIn, tokenOut, amountIn, minAmountOut, deadline, signer }) {
  const swapper = new ethers.Contract(IPOR_UNIVERSAL_SWAPPER_V2, [
    'function EXECUTOR() view returns (address)',
  ], signer);
  const executor = await swapper.EXECUTOR();

  const erc20 = new ethers.Interface(['function approve(address,uint256) returns (bool)']);
  const router = new ethers.Interface([
    'function swapExactInput(address,address,uint256,uint256,address,uint256) returns (uint256)',
  ]);
  const fuse = new ethers.Interface([
    'function enter((address tokenIn,address tokenOut,uint256 amountIn,uint256 minAmountOut,(address[] targets,bytes[] data) data)) returns (address,address,uint256,uint256)',
  ]);

  const targets = [tokenIn, ROUTER];
  const data = [
    erc20.encodeFunctionData('approve', [ROUTER, amountIn]),
    router.encodeFunctionData('swapExactInput', [
      tokenIn,
      tokenOut,
      amountIn,
      minAmountOut,
      executor,
      deadline,
    ]),
  ];

  return {
    fuse: IPOR_UNIVERSAL_SWAPPER_V2,
    data: fuse.encodeFunctionData('enter', [{
      tokenIn,
      tokenOut,
      amountIn,
      minAmountOut,
      data: { targets, data },
    }]),
  };
}

function erc4626EnterAction({ ethers, nestedVault, amount, minShares = 0n }) {
  const iface = new ethers.Interface([
    'function enter((address vault,uint256 vaultAssetAmount,uint256 minSharesOut)) returns (uint256)',
  ]);
  return {
    fuse: IPOR_ERC4626_SUPPLY_FUSE,
    data: iface.encodeFunctionData('enter', [{
      vault: nestedVault,
      vaultAssetAmount: amount,
      minSharesOut: minShares,
    }]),
  };
}

function erc4626ExitAction({ ethers, nestedVault, amount, maxShares = 0n }) {
  const iface = new ethers.Interface([
    'function exit((address vault,uint256 vaultAssetAmount,uint256 maxSharesBurned)) returns (uint256)',
  ]);
  return {
    fuse: IPOR_ERC4626_SUPPLY_FUSE,
    data: iface.encodeFunctionData('exit', [{
      vault: nestedVault,
      vaultAssetAmount: amount,
      maxSharesBurned: maxShares,
    }]),
  };
}

function positionEnterAction({ deployment, collateralAmount, debtAmount }) {
  return {
    fuse: deployment.positionFuse.target,
    data: deployment.positionFuse.interface.encodeFunctionData('enter', [{
      collateralAmount,
      debtAmount,
    }]),
  };
}

function positionExitAction({ deployment, collateralAmount, debtAmount }) {
  return {
    fuse: deployment.positionFuse.target,
    data: deployment.positionFuse.interface.encodeFunctionData('exit', [{
      collateralAmount,
      debtAmount,
    }]),
  };
}

async function getFxState({ ethers, deployment, signer }) {
  const pool = new ethers.Contract(FX_POOL, [
    'function getPosition(uint256) view returns (uint256 rawColls,uint256 rawDebts)',
    'function getPositionDebtRatio(uint256) view returns (uint256)',
    'function priceOracle() view returns (address)',
    'function configuration() view returns (address)',
  ], signer);
  const manager = new ethers.Contract(FX_POOL_MANAGER, [
    'function getTokenScalingFactor(address) view returns (uint256)',
  ], signer);
  const oracle = new ethers.Contract(FX_PRICE_ORACLE, [
    'function getPrice() view returns (uint256 anchorPrice,uint256 minPrice,uint256 maxPrice)',
  ], signer);
  const feeConfig = new ethers.Contract(FX_POOL_CONFIGURATION, [
    'function getPoolFeeRatio(address,address) view returns (uint256,uint256,uint256,uint256)',
  ], signer);

  const positionId = await deployment.config.positionId();
  const pos = positionId === 0n ? { rawColls: 0n, rawDebts: 0n } : await pool.getPosition(positionId);
  const price = await oracle.getPrice();
  const fees = await feeConfig.getPoolFeeRatio(FX_POOL, deployment.vault.target);
  const scale = await manager.getTokenScalingFactor(VBWBTC);

  return {
    pool,
    manager,
    oracle,
    feeConfig,
    positionId,
    rawColls: pos.rawColls,
    rawDebts: pos.rawDebts,
    anchorPrice: price.anchorPrice,
    supplyFee: fees[0],
    withdrawFee: fees[1],
    borrowFee: fees[2],
    repayFee: fees[3],
    scale,
  };
}

function desiredDebt(rawColls, anchorPrice, targetBps) {
  return (rawColls * anchorPrice / 10n ** 18n) * BigInt(targetBps) / 10_000n;
}

async function deployFreshViaIporActions({ provider, ethers, deployment, nestedVault, signer, evidence, targetBps = 5000 }) {
  const vbwbtc = new ethers.Contract(VBWBTC, ['function balanceOf(address) view returns (uint256)'], signer);
  const fxusd = new ethers.Contract(FXUSD, ['function balanceOf(address) view returns (uint256)'], signer);
  const vbusdc = new ethers.Contract(VB_USDC, ['function balanceOf(address) view returns (uint256)'], signer);
  const nested = new ethers.Contract(nestedVault, ['function balanceOf(address) view returns (uint256)'], signer);

  const idle = await vbwbtc.balanceOf(deployment.vault.target);
  assert(idle > 0n, 'no idle vbWBTC for strategy deployment');

  const before = await getFxState({ ethers, deployment, signer });
  const netAdded = idle - (idle * before.supplyFee / 1_000_000_000n);
  const rawAdded = netAdded * before.scale / 10n ** 18n;
  const targetDebt = desiredDebt(before.rawColls + rawAdded, before.anchorPrice, targetBps);
  const debtIncrease = targetDebt > before.rawDebts ? targetDebt - before.rawDebts : 0n;
  assert(debtIncrease > 0n, 'fresh strategy debt increase is zero');

  await executeFuseActions({
    vault: deployment.vault,
    actions: [positionEnterAction({ deployment, collateralAmount: idle, debtAmount: debtIncrease })],
    label: 'IPOR action: open/increase f(x) position',
    evidence,
  });

  const fxBal = await fxusd.balanceOf(deployment.vault.target);
  assert(fxBal > 0n, 'f(x) borrow produced no fxUSD');

  const deadline = BigInt(Math.floor(Date.now() / 1000) + 86400);
  const swap = await buildCanonicalSwapAction({
    ethers,
    tokenIn: FXUSD,
    tokenOut: VB_USDC,
    amountIn: fxBal,
    minAmountOut: 0n,
    deadline,
    signer,
  });
  await executeFuseActions({
    vault: deployment.vault,
    actions: [swap],
    label: 'IPOR canonical swapper: fxUSD -> vbUSDC',
    evidence,
  });

  const stableBal = await vbusdc.balanceOf(deployment.vault.target);
  assert(stableBal > 0n, 'canonical swap produced no vbUSDC');

  await executeFuseActions({
    vault: deployment.vault,
    actions: [erc4626EnterAction({ ethers, nestedVault, amount: stableBal })],
    label: 'IPOR canonical ERC4626: deposit vbUSDC into cyvbUSDC',
    evidence,
  });

  const shares = await nested.balanceOf(deployment.vault.target);
  assert(shares > 0n, 'nested cyvbUSDC shares missing');

  const after = await getFxState({ ethers, deployment, signer });
  const ratio = await after.pool.getPositionDebtRatio(after.positionId);
  return { ...after, ratio, nestedShares: shares };
}

async function highLtvRebalanceViaIpor({ ethers, deployment, nestedVault, signer, evidence }) {
  let state = await getFxState({ ethers, deployment, signer });
  const extraDebt = state.rawDebts / 4n;
  await executeFuseActions({
    vault: deployment.vault,
    actions: [positionEnterAction({ deployment, collateralAmount: 0n, debtAmount: extraDebt })],
    label: 'IPOR action: perturb high LTV',
    evidence,
  });

  state = await getFxState({ ethers, deployment, signer });
  let ratio = await state.pool.getPositionDebtRatio(state.positionId);
  assert(ratio >= 6000n * 10n ** 14n, 'high trigger not crossed');

  const targetDebt = desiredDebt(state.rawColls, state.anchorPrice, 5800);
  const reduction = state.rawDebts - targetDebt;
  assert(reduction > 0n, 'high-LTV debt reduction zero');

  const vbusdc = new ethers.Contract(VB_USDC, [
    'function balanceOf(address) view returns (uint256)',
  ], signer);
  const fxusd = new ethers.Contract(FXUSD, [
    'function balanceOf(address) view returns (uint256)',
  ], signer);

  const stableNeeded = ((reduction * 102n) / 100n + 10n ** 12n - 1n) / 10n ** 12n;
  await executeFuseActions({
    vault: deployment.vault,
    actions: [erc4626ExitAction({ ethers, nestedVault, amount: stableNeeded })],
    label: 'IPOR canonical ERC4626: fund high-LTV repay',
    evidence,
  });

  const stableBal = await vbusdc.balanceOf(deployment.vault.target);
  const swap = await buildCanonicalSwapAction({
    ethers,
    tokenIn: VB_USDC,
    tokenOut: FXUSD,
    amountIn: stableBal,
    minAmountOut: reduction,
    deadline: BigInt(Math.floor(Date.now() / 1000) + 86400),
    signer,
  });
  await executeFuseActions({
    vault: deployment.vault,
    actions: [swap],
    label: 'IPOR canonical swapper: vbUSDC -> fxUSD for deleverage',
    evidence,
  });

  assert(await fxusd.balanceOf(deployment.vault.target) >= reduction, 'repay fxUSD insufficient');
  await executeFuseActions({
    vault: deployment.vault,
    actions: [positionExitAction({ deployment, collateralAmount: 0n, debtAmount: reduction })],
    label: 'IPOR action: repay to 58% LTV',
    evidence,
  });

  state = await getFxState({ ethers, deployment, signer });
  ratio = await state.pool.getPositionDebtRatio(state.positionId);
  assert(ratio >= 5790n * 10n ** 14n && ratio <= 5810n * 10n ** 14n, 'high reset not ~58%');

  const residualFx = await fxusd.balanceOf(deployment.vault.target);
  if (residualFx > 0n) {
    const back = await buildCanonicalSwapAction({
      ethers,
      tokenIn: FXUSD,
      tokenOut: VB_USDC,
      amountIn: residualFx,
      minAmountOut: 0n,
      deadline: BigInt(Math.floor(Date.now() / 1000) + 86400),
      signer,
    });
    await executeFuseActions({
      vault: deployment.vault,
      actions: [back],
      label: 'IPOR canonical swapper: recycle residual fxUSD',
      evidence,
    });
    const stableResidual = await vbusdc.balanceOf(deployment.vault.target);
    if (stableResidual > 0n) {
      await executeFuseActions({
        vault: deployment.vault,
        actions: [erc4626EnterAction({ ethers, nestedVault, amount: stableResidual })],
        label: 'IPOR canonical ERC4626: redeposit residual stable',
        evidence,
      });
    }
  }
  return ratio;
}

async function lowLtvRebalanceViaIpor({ provider, ethers, deployment, nestedVault, signer, evidence }) {
  const extraCollateral = 1_000_000n; // 0.01 vbWBTC
  await seedTokenFromPoolsV13({
    provider, ethers, tokenAddress: VBWBTC, to: deployment.vault.target,
    amount: extraCollateral, evidence, label: 'seed low-LTV collateral',
  });
  await executeFuseActions({
    vault: deployment.vault,
    actions: [positionEnterAction({ deployment, collateralAmount: extraCollateral, debtAmount: 0n })],
    label: 'IPOR action: perturb low LTV',
    evidence,
  });

  let state = await getFxState({ ethers, deployment, signer });
  let ratio = await state.pool.getPositionDebtRatio(state.positionId);
  assert(ratio <= 4500n * 10n ** 14n, 'low trigger not crossed');

  const targetDebt = desiredDebt(state.rawColls, state.anchorPrice, 5000);
  const increase = targetDebt - state.rawDebts;
  assert(increase > 0n, 'low-LTV debt increase zero');

  const fxusd = new ethers.Contract(FXUSD, ['function balanceOf(address) view returns (uint256)'], signer);
  const vbusdc = new ethers.Contract(VB_USDC, ['function balanceOf(address) view returns (uint256)'], signer);

  await executeFuseActions({
    vault: deployment.vault,
    actions: [positionEnterAction({ deployment, collateralAmount: 0n, debtAmount: increase })],
    label: 'IPOR action: borrow to 50% LTV',
    evidence,
  });

  const fxBal = await fxusd.balanceOf(deployment.vault.target);
  const swap = await buildCanonicalSwapAction({
    ethers,
    tokenIn: FXUSD,
    tokenOut: VB_USDC,
    amountIn: fxBal,
    minAmountOut: 0n,
    deadline: BigInt(Math.floor(Date.now() / 1000) + 86400),
    signer,
  });
  await executeFuseActions({
    vault: deployment.vault,
    actions: [swap],
    label: 'IPOR canonical swapper: low-LTV borrowed fxUSD -> vbUSDC',
    evidence,
  });
  const stable = await vbusdc.balanceOf(deployment.vault.target);
  if (stable > 0n) {
    await executeFuseActions({
      vault: deployment.vault,
      actions: [erc4626EnterAction({ ethers, nestedVault, amount: stable })],
      label: 'IPOR canonical ERC4626: deposit low-LTV borrow proceeds',
      evidence,
    });
  }

  state = await getFxState({ ethers, deployment, signer });
  ratio = await state.pool.getPositionDebtRatio(state.positionId);
  assert(ratio >= 4990n * 10n ** 14n && ratio <= 5010n * 10n ** 14n, 'low reset not ~50%');
  return ratio;
}

async function runUserLifecycle({ provider, ethers, deployment, nestedVault, signer, evidence }) {
  const alice = signer;
  const aliceAddress = await alice.getAddress();
  const bob = await provider.getSigner(1);
  const bobAddress = await bob.getAddress();

  const vbwbtcAlice = new ethers.Contract(VBWBTC, [
    'function approve(address,uint256) returns (bool)',
    'function balanceOf(address) view returns (uint256)',
  ], alice);
  const vbwbtcBob = vbwbtcAlice.connect(bob);
  const vaultAlice = deployment.vault.connect(alice);
  const vaultBob = deployment.vault.connect(bob);
  const gatewayAlice = deployment.gateway.connect(alice);
  const gatewayBob = deployment.gateway.connect(bob);

  const safeBefore = await vbwbtcAlice.balanceOf(SAFE);

  const aliceGross = 2_000_000n; // 0.02 vbWBTC
  const bobGross = 1_000_000n;   // 0.01 vbWBTC

  await seedTokenFromPoolsV13({
    provider, ethers, tokenAddress: VBWBTC, to: aliceAddress,
    amount: aliceGross + 1_000_000n, evidence, label: 'seed Alice vbWBTC',
  });
  await seedTokenFromPoolsV13({
    provider, ethers, tokenAddress: VBWBTC, to: bobAddress,
    amount: bobGross, evidence, label: 'seed Bob vbWBTC',
  });

  await waitTx(await vbwbtcAlice.approve(deployment.gateway.target, aliceGross), 'Alice approve gateway', evidence);
  await waitTx(await gatewayAlice.deposit(aliceGross, aliceAddress, 0n, { gasLimit: 8_000_000n }), 'Alice first gateway deposit', evidence);

  const aliceShares = await vaultAlice.balanceOf(aliceAddress);
  const alicePpsValueBefore = await vaultAlice.previewRedeem(aliceShares);

  await waitTx(await vbwbtcBob.approve(deployment.gateway.target, bobGross), 'Bob approve gateway', evidence);
  await waitTx(await gatewayBob.deposit(bobGross, bobAddress, 0n, { gasLimit: 8_000_000n }), 'Bob gateway deposit', evidence);

  const alicePpsValueAfter = await vaultAlice.previewRedeem(aliceShares);
  assert(alicePpsValueAfter > alicePpsValueBefore, 'second-deposit fee did not increase incumbent value');
  assert(await vbwbtcAlice.balanceOf(SAFE) === safeBefore, 'operation fee reached admin Safe');

  let directBlocked = false;
  try {
    const direct = new ethers.Contract(deployment.vault.target, [
      'function deposit(uint256,address) returns (uint256)',
    ], alice);
    const tx = await direct.deposit(1n, aliceAddress, { gasLimit: 2_000_000n });
    await tx.wait();
  } catch {
    directBlocked = true;
  }
  assert(directBlocked, 'direct vault deposit bypass succeeded');

  let state = await deployFreshViaIporActions({
    provider, ethers, deployment, nestedVault, signer: alice, evidence, targetBps: 5000,
  });
  assert(state.ratio >= 4990n * 10n ** 14n && state.ratio <= 5010n * 10n ** 14n, 'initial strategy LTV not ~50%');

  const highRatio = await highLtvRebalanceViaIpor({
    ethers, deployment, nestedVault, signer: alice, evidence,
  });
  const lowRatio = await lowLtvRebalanceViaIpor({
    provider, ethers, deployment, nestedVault, signer: alice, evidence,
  });

  await waitTx(
    await vaultAlice.approve(deployment.gateway.target, ethers.MaxUint256),
    'Alice approve gateway shares',
    evidence
  );

  const aliceUnderlyingBefore = await vbwbtcAlice.balanceOf(aliceAddress);
  await waitTx(
    await gatewayAlice.withdraw(100_000n, aliceAddress, aliceAddress, ethers.MaxUint256, { gasLimit: 25_000_000n }),
    'Alice small instant withdrawal',
    evidence
  );
  const aliceUnderlyingAfter = await vbwbtcAlice.balanceOf(aliceAddress);
  assert(aliceUnderlyingAfter > aliceUnderlyingBefore, 'small instant withdrawal paid no vbWBTC');

  state = await getFxState({ ethers, deployment, signer: alice });
  let ratio = await state.pool.getPositionDebtRatio(state.positionId);
  assert(ratio <= 5500n * 10n ** 14n, 'small instant withdrawal exceeds 55%');

  // A larger request crosses the collateral-only 55% boundary and must trigger full unwind.
  await waitTx(
    await gatewayAlice.withdraw(500_000n, aliceAddress, aliceAddress, ethers.MaxUint256, { gasLimit: 30_000_000n }),
    'Alice deleveraging/full-unwind instant withdrawal',
    evidence
  );

  state = await getFxState({ ethers, deployment, signer: alice });
  assert(state.rawColls === 0n && state.rawDebts === 0n, 'large instant withdrawal left f(x) debt/collateral');
  const nestedToken = new ethers.Contract(nestedVault, ['function balanceOf(address) view returns (uint256)'], alice);
  assert(await nestedToken.balanceOf(deployment.vault.target) === 0n, 'large instant withdrawal left nested shares');
  assert(await vbwbtcAlice.balanceOf(SAFE) === safeBefore, 'instant fee reached admin Safe');

  // Redeploy remaining vault capital and prove the recorded f(x) NFT is reusable.
  const firstPositionId = await deployment.config.positionId();
  state = await deployFreshViaIporActions({
    provider, ethers, deployment, nestedVault, signer: alice, evidence, targetBps: 5000,
  });
  assert(await deployment.config.positionId() === firstPositionId, 'f(x) position id not reused');

  // Consolidate remaining shares into Alice so one final redemption is a true last-holder exit.
  const bobShares = await vaultBob.balanceOf(bobAddress);
  if (bobShares > 0n) {
    await waitTx(await vaultBob.transfer(aliceAddress, bobShares), 'Bob transfers remaining shares to Alice', evidence);
  }

  const finalShares = await vaultAlice.balanceOf(aliceAddress);
  await waitTx(
    await gatewayAlice.redeem(finalShares, aliceAddress, aliceAddress, 0n, { gasLimit: 30_000_000n }),
    'Alice last-holder full redemption',
    evidence
  );

  assert(await vaultAlice.totalSupply() === 0n, 'full exit left share supply');
  state = await getFxState({ ethers, deployment, signer: alice });
  assert(state.rawColls === 0n && state.rawDebts === 0n, 'full exit left f(x) position');
  assert(await nestedToken.balanceOf(deployment.vault.target) === 0n, 'full exit left nested shares');

  // Deposit after zero supply and redeploy to prove no orphan-value capture and lifecycle reuse.
  const redeposit = 500_000n;
  await waitTx(await vbwbtcAlice.approve(deployment.gateway.target, redeposit), 'Alice reapprove gateway after zero supply', evidence);
  await waitTx(await gatewayAlice.deposit(redeposit, aliceAddress, 0n, { gasLimit: 8_000_000n }), 'Alice redeposit after full exit', evidence);
  state = await deployFreshViaIporActions({
    provider, ethers, deployment, nestedVault, signer: alice, evidence, targetBps: 5000,
  });
  assert(await deployment.config.positionId() === firstPositionId, 'redeposit did not reuse f(x) position id');
  assert(state.rawColls > 0n && state.rawDebts > 0n, 'redeposit strategy did not reopen position');

  return {
    directVaultBypassBlocked: directBlocked,
    alicePpsValueBeforeSecondDeposit: alicePpsValueBefore.toString(),
    alicePpsValueAfterSecondDeposit: alicePpsValueAfter.toString(),
    highResetLtvWad: highRatio.toString(),
    lowResetLtvWad: lowRatio.toString(),
    reusablePositionId: firstPositionId.toString(),
    totalSupplyAfterRedeposit: (await vaultAlice.totalSupply()).toString(),
    adminOperationFeeDeltaVbWbtc: ((await vbwbtcAlice.balanceOf(SAFE)) - safeBefore).toString(),
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const smartRoot = path.resolve(args['smart-contracts-root'] ?? '.smart-contracts');
  const outputRoot = path.resolve(args.output ?? 'cyvbwbtc-ipor-native-live-fork-output-v9');
  const forkUrl = args['fork-url'];
  assert(forkUrl, '--fork-url is required');

  await fs.rm(outputRoot, { recursive: true, force: true });
  await fs.mkdir(outputRoot, { recursive: true });

  const summary = {
    schemaVersion: 'curveyield-cyvbwbtc-ipor-native-live-fork-v9',
    status: 'RUNNING',
    simulationMethod: 'CONTRACT_AUTOMATION_ANVIL_IPOR_NATIVE_EXACT_SEQUENCE',
    pinnedSmartContractsCommit: SMART_CONTRACTS_COMMIT,
    fork: { engine: 'anvil', chainId: 747474, upstream: 'dRPC Katana', productionBroadcast: false },
    compilation: null,
    routes: null,
    nestedCyvbUsdc: null,
    cyvbWbtc: null,
    lifecycle: null,
    transactions: [],
    failures: [],
    notes: [
      'No production broadcast is performed.',
      'cyvbUSDC is deployed first using the proven v7 exact-sequence adapter in the same Anvil fork.',
      'cyvbWBTC uses canonical live IPOR Katana ERC4626 and UniversalTokenSwapper fuses.',
      'No custom accounting market id is used: f(x) position and residual ERC20 accounting share official ERC20_VAULT_BALANCE market 7.',
      'The custom instant adapter reports official ERC4626_0001 market 100001 and uses official market 7/100001/1202 substrate namespaces.',
    ],
  };

  let engine;
  try {
    const ethers = await import('ethers');

    summary.sourceBinding = await verifyPinnedSource(smartRoot);
    const rewardArtifact = await compileRewardFuse({ smartRoot });
    const cyvbWbtcArtifacts = await compileCyvbWbtc({ smartRoot });
    summary.compilation = {
      status: 'PASS',
      nestedRewardArtifact: rewardArtifact.artifactPath,
      cyvbWbtcArtifacts: Object.keys(CYVBWBTC_ARTIFACTS),
    };

    summary.stage = 'startKatanaFork';
    engine = await withTimeout(startKatanaFork({ forkUrl }), 'startKatanaFork', 120_000);
    const provider = engine.provider;
    assert(BigInt(await provider.send('eth_chainId', [])) === 747474n, 'Anvil chain id mismatch');

    summary.stage = 'ensureRoutes';
    summary.routes = {
      cyvbUsdc: await withTimeout(
        ensureForkRoute({ provider, ethers, txEvidence: summary.transactions }),
        'ensure cyvbUSDC route',
        120_000
      ),
      cyvbWbtc: await withTimeout(
        ensureCyvbWbtcRoutes({ provider, ethers, evidence: summary.transactions }),
        'ensure cyvbWBTC routes',
        120_000
      ),
    };

    // Deploy the real cyvbUSDC candidate first, using the proven v7 exact sequence.
    summary.stage = 'deployCyvbUSDC';
    const nestedContext = await withTimeout(
      executeDeploymentPlan({
        provider,
        ethers,
        rewardArtifact,
        txEvidence: summary.transactions,
      }),
      'deploy cyvbUSDC exact sequence',
      180_000
    );
    summary.stage = 'verifyCyvbUSDC';
    summary.nestedCyvbUsdc = await withTimeout(
      verifyDeployment({ context: nestedContext, provider, ethers }),
      'verify cyvbUSDC',
      120_000
    );

    const signer = await provider.getSigner(0);
    const deployer = await signer.getAddress();

    for (const address of [
      VBWBTC, FXUSD, FX_POOL_MANAGER, FX_POOL, FX_POOL_CONFIGURATION, FXBASE,
      FX_PRICE_ORACLE, IPOR_ERC4626_SUPPLY_FUSE, IPOR_ERC4626_BALANCE_FUSE,
      IPOR_UNIVERSAL_SWAPPER_V2, IPOR_UNIVERSAL_SWAPPER_BALANCE_V2,
      IPOR_BALANCE_FUSES_READER,
    ]) {
      assert((await provider.getCode(address)) !== '0x', 'cyvbWBTC dependency missing at ' + address);
    }

    summary.stage = 'deployCyvbWBTC';
    const deployment = await withTimeout(
      deployCyvbWbtcV13({
        provider,
        ethers,
        artifacts: cyvbWbtcArtifacts,
        nestedVault: nestedContext.plasmaVault,
        signer,
        deployer,
        evidence: summary.transactions,
      }),
      'deploy cyvbWBTC v16 candidate',
      180_000
    );

    summary.stage = 'verifyCyvbWBTC';
    await withTimeout(
      verifyCyvbWbtcV13({
        ethers,
        deployment,
        nestedVault: nestedContext.plasmaVault,
      }),
      'verify cyvbWBTC',
      120_000
    );

    summary.cyvbWbtc = {
      vault: deployment.vault.target,
      feeManager: deployment.feeManager.target,
      accessManager: deployment.accessAddress,
      priceManager: deployment.priceManagerAddress,
      config: deployment.config.target,
      gateway: deployment.gateway.target,
      preHook: deployment.preHook.target,
      priceFeed: deployment.priceFeed.target,
      positionFuse: deployment.positionFuse.target,
      balanceFuse: deployment.balanceFuse.target,
      instantFuse: deployment.instantFuse.target,
      canonicalErc4626SupplyFuse: IPOR_ERC4626_SUPPLY_FUSE,
      canonicalErc4626BalanceFuse: IPOR_ERC4626_BALANCE_FUSE,
      canonicalUniversalSwapperV2: IPOR_UNIVERSAL_SWAPPER_V2,
      canonicalUniversalSwapperBalanceV2: IPOR_UNIVERSAL_SWAPPER_BALANCE_V2,
      marketIds: {
        erc20AndFxAccounting: Number(ERC20_BALANCE_MARKET_ID),
        erc4626: Number(ERC4626_MARKET_ID),
        universalSwapperV2: Number(UNIVERSAL_SWAPPER_V2_MARKET_ID),
      },
    };

    summary.stage = 'userLifecycle';
    summary.lifecycle = await withTimeout(
      runUserLifecycle({
        provider,
        ethers,
        deployment,
        nestedVault: nestedContext.plasmaVault,
        signer,
        evidence: summary.transactions,
      }),
      'full cyvbWBTC user lifecycle',
      300_000
    );

    summary.stage = 'complete';
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
      path.join(outputRoot, 'CYVBWBTC_IPOR_NATIVE_LIVE_FORK_SUMMARY_v9.json'),
      JSON.stringify(summary, null, 2) + '\n'
    );
    if (engine) await engine.close().catch(() => {});
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
