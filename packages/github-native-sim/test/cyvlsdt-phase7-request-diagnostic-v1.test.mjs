import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { validateDeepAssuranceRequestV2 } from '../src/schema.mjs';

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

function sha256Canonical(value) {
  return createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex');
}

const unsigned = {
  schemaVersion: 'deep-assurance-github-request-v2',
  processId: 'audit-v7-independent-review',
  contractAutomationRelease: {
    repository: 'CurveYield2/Contract-Automation',
    branch: 'recovery/v7-execution-layer-v1',
    commit: '612fa50264e587e3f24550bf4dae35719b04211c',
    contractVersion: 'contract-automation-v7-relocated-v1'
  },
  runnerRelease: {
    version: 'deep-assurance-github-bridge-v1',
    manifestSha256: '2bebd99bb8ae770eb2feca0de7dc7e54596127a0c768922189e907e6658773dc'
  },
  campaignId: 'cyvlSDT v30',
  assignmentId: 'cyvlsdt-v30-phase7-fork-lifecycle-v1',
  phaseId: 'fork-simulation-lifecycle',
  gateId: 'phase7-fork-simulation-lifecycle-v1',
  profileId: 'github-native-simulate-v2',
  source: {
    repository: 'CurveYield2/Solo-Audit-Controller',
    commit: '6bde63416a4611e127b8bb3a5958e6b6d874c188',
    projectPath: 'CurveYield-cyvlSDT-Deployment-Package-v30',
    archivePath: 'campaigns/CurveYield-cyvlSDT-Deployment-Package-v30.zip',
    archiveSha256: 'cc5c4dc6f8aa5d2e48043f6c3a837317ce6a4590c291e7e0571e4206c7d9877a'
  },
  configuration: {
    compilers: [
      { language: 'solidity', version: '0.8.28' },
      { language: 'vyper', version: '0.3.10' }
    ],
    timeoutMinutes: 35,
    analysis: {
      slither: false,
      medusa: false,
      nativeFuzz: false
    },
    optimizer: { enabled: true, runs: 200 },
    evmVersion: 'cancun',
    viaIR: true,
    deploymentGas: {
      deployableContracts: [
        { sourceName: 'contracts/CurveYieldVlSDTLocker.sol', contractName: 'CurveYieldVlSDTLocker' },
        { sourceName: 'contracts/CurveYieldVlSDTToken.sol', contractName: 'CurveYieldVlSDTToken' },
        { sourceName: 'contracts/CurveYieldVlSDTRevenueStaking.sol', contractName: 'CurveYieldVlSDTRevenueStaking' },
        { sourceName: 'contracts/CurveYieldVault.sol', contractName: 'CurveYieldVault' },
        { sourceName: 'contracts/CurveYieldRevenueStrategyV20.sol', contractName: 'CurveYieldRevenueStrategyV20' },
        { sourceName: 'contracts/CurveYieldRevenueConverter.sol', contractName: 'CurveYieldRevenueConverter' },
        { sourceName: 'contracts/CurveYieldUsdcToSdtConverter.sol', contractName: 'CurveYieldUsdcToSdtConverter' },
        { sourceName: 'contracts/CurveYieldVlSDTBoostStaking.sol', contractName: 'CurveYieldVlSDTBoostStaking' },
        { sourceName: 'contracts/CurveYieldVlSDTBoostMerchant.sol', contractName: 'CurveYieldVlSDTBoostMerchant' },
        { sourceName: 'contracts/CurveYieldGovernanceToken.sol', contractName: 'CurveYieldGovernanceToken' },
        { sourceName: 'contracts/CurveYieldGovernanceMintController.sol', contractName: 'CurveYieldGovernanceMintController' },
        { sourceName: 'contracts/CurveYieldGovernanceStaking.vy', contractName: 'CurveYieldGovernanceStaking' },
        { sourceName: 'contracts/CurveYieldCyGovYieldStaking.sol', contractName: 'CurveYieldCyGovYieldStaking' },
        { sourceName: 'contracts/CurveYieldCyGovFraxswapConverter.sol', contractName: 'CurveYieldCyGovFraxswapConverter' },
        { sourceName: 'contracts/CurveYieldCyGovDiscountedSaleConverterV9.sol', contractName: 'CurveYieldCyGovDiscountedSaleConverterV9' }
      ]
    },
    simulation: {
      chain: 'ethereum',
      block: 25817400,
      workflow: {
        steps: [
          { action: 'snapshot', alias: 'baseline', label: 'pin baseline fork state' },
          { action: 'assertCall', target: '0x73968b9a57c6E53d41345FD57a6E6ae27d6CDB2F', function: 'decimals() view returns (uint8)', args: [], equals: '18', label: 'SDT decimals' },
          { action: 'staticCall', target: '0x73968b9a57c6E53d41345FD57a6E6ae27d6CDB2F', function: 'totalSupply() view returns (uint256)', args: [], saveAs: 'sdtSupply', label: 'SDT live supply' },
          { action: 'assertCall', target: '0x94818A7baa7e9F5dC62ce4da1B52ef9a760b80B8', function: 'decimals() view returns (uint8)', args: [], equals: '18', label: 'vlSDT decimals' },
          { action: 'staticCall', target: '0x94818A7baa7e9F5dC62ce4da1B52ef9a760b80B8', function: 'totalSupply() view returns (uint256)', args: [], saveAs: 'vlsdtSupply', label: 'vlSDT live supply' },
          { action: 'assertCall', target: '0xaB05ca46d1c78CAbB051efFE35099714Cad2AddA', function: 'decimals() view returns (uint8)', args: [], equals: '18', label: 'vlBoost decimals' },
          { action: 'staticCall', target: '0xaB05ca46d1c78CAbB051efFE35099714Cad2AddA', function: 'totalSupply() view returns (uint256)', args: [], saveAs: 'vlboostSupply', label: 'vlBoost live supply' },
          { action: 'assertCall', target: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', function: 'decimals() view returns (uint8)', args: [], equals: '6', label: 'USDC decimals' },
          { action: 'assertCall', target: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', function: 'decimals() view returns (uint8)', args: [], equals: '8', label: 'WBTC decimals' },
          { action: 'assertCall', target: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', function: 'decimals() view returns (uint8)', args: [], equals: '18', label: 'WETH decimals' },
          { action: 'assertCall', target: '0xA19bf6fBf05624282cb6ed498f4761f22e084Edd', function: 'price_oracle() view returns (uint256)', args: [], equals: '42512812725887', label: 'SDT WETH pinned Curve oracle' },
          { action: 'staticCall', target: '0xA19bf6fBf05624282cb6ed498f4761f22e084Edd', function: 'get_virtual_price() view returns (uint256)', args: [], saveAs: 'sdtWethVirtualPrice', label: 'SDT WETH virtual price' },
          { action: 'staticCall', target: '0xA19bf6fBf05624282cb6ed498f4761f22e084Edd', function: 'get_dy(uint256,uint256,uint256) view returns (uint256)', args: [0, 1, '1000000000000000000'], saveAs: 'sdtToWethQuote', label: 'SDT to WETH one-token quote' },
          { action: 'staticCall', target: '0xA19bf6fBf05624282cb6ed498f4761f22e084Edd', function: 'fee_receiver() view returns (address)', args: [], saveAs: 'sdtWethFeeReceiver', label: 'SDT WETH fee receiver' },
          { action: 'staticCall', target: '0xA19bf6fBf05624282cb6ed498f4761f22e084Edd', function: 'admin() view returns (address)', args: [], saveAs: 'sdtWethAdmin', label: 'SDT WETH admin' },
          { action: 'assertCall', target: '0x7F86Bf177Dd4F3494b841a37e810A34dD56c829B', function: 'decimals() view returns (uint8)', args: [], equals: '18', label: 'TricryptoUSDC LP decimals' },
          { action: 'staticCall', target: '0x7F86Bf177Dd4F3494b841a37e810A34dD56c829B', function: 'get_virtual_price() view returns (uint256)', args: [], saveAs: 'tricryptoVirtualPrice', label: 'TricryptoUSDC virtual price' },
          { action: 'staticCall', target: '0x7F86Bf177Dd4F3494b841a37e810A34dD56c829B', function: 'get_dy(uint256,uint256,uint256) view returns (uint256)', args: [0, 2, '1000000'], saveAs: 'usdcToWethQuote', label: 'TricryptoUSDC one-USDC quote to WETH' },
          { action: 'increaseTime', seconds: 3600, label: 'advance fork time one hour' },
          { action: 'mine', blocks: 2, label: 'mine fork lifecycle blocks' },
          { action: 'staticCall', target: '0xA19bf6fBf05624282cb6ed498f4761f22e084Edd', function: 'price_oracle() view returns (uint256)', args: [], saveAs: 'sdtWethOracleAfterTime', label: 'observe oracle after time advance' },
          { action: 'revertSnapshot', snapshot: '$baseline', label: 'restore baseline fork state' },
          { action: 'assertCall', target: '0xA19bf6fBf05624282cb6ed498f4761f22e084Edd', function: 'price_oracle() view returns (uint256)', args: [], equals: '42512812725887', label: 'oracle restored after snapshot revert' }
        ]
      }
    }
  }
};

test('derive and validate cyvlSDT v30 Phase 7 Anvil-only request', () => {
  const digest = sha256Canonical(unsigned);
  const request = {
    ...unsigned,
    requestId: `dar-${digest.slice(0, 32)}`,
    requestDigest: digest
  };
  const validated = validateDeepAssuranceRequestV2(request);
  assert.equal(validated.phaseId, 'fork-simulation-lifecycle');
  assert.equal(validated.configuration.simulation.block, 25817400);
  console.log(`CYVLSDT_PHASE7_REQUEST_ID=${request.requestId}`);
  console.log(`CYVLSDT_PHASE7_REQUEST_DIGEST=${request.requestDigest}`);
  console.log(`CYVLSDT_PHASE7_REQUEST_JSON=${JSON.stringify(request)}`);
});
