// Katana cyvbUSDC Morpho venue configuration v1.
// Grant the specific Morpho Blue market as a *lending supply* venue.
// This file never allocates assets, changes other market settings, or configures withdrawal ordering.
import { appendFile } from "node:fs/promises";
import {
  AbiCoder,
  Contract,
  JsonRpcProvider,
  Wallet,
  getAddress,
  keccak256,
} from "ethers";

const CHAIN_ID = 747474n;
const VAULT = getAddress("0xDf9CbCB8b57A031e91CAe673a6A5786d85Ce2eC5");
const VBUSDC = getAddress("0x203A662b0BD271A6ed5a60EdFbd04bFce608FD36");
const MORPHO = getAddress("0xD50F2DffFd62f94Ee4AEd9ca05C61d0753268aBc");
const SUPPLY_FUSE = getAddress("0xC66c3F5cC5e1550A0Ff960c06D630A2FBB80E19d");
const BALANCE_FUSE = getAddress("0x83790D83C23461cd22429276406C4f09DB885A85");
const IPOR_MARKET_ID = 14n;
const BLUE_MARKET = "0xcfac40b9f06194a33d9526f73642f6849b908c2b6d8669ad9d2d4a3e7dcb017a";
const FUSE_MANAGER_ROLE = 300n;
const MODE = process.env.MODE || "inspect";
const CONFIRMATION = "ENABLE_VBUSDC_YVAUSD";

const vaultAbi = [
  "function asset() view returns (address)",
  "function getAccessManagerAddress() view returns (address)",
  "function isFuseSupported(address) view returns (bool)",
  "function isBalanceFuseSupported(uint256,address) view returns (bool)",
  "function getMarketSubstrates(uint256) view returns (bytes32[])",
  "function isMarketSubstrateGranted(uint256,bytes32) view returns (bool)",
  "function getInstantWithdrawalFuses() view returns (address[])",
  "function grantMarketSubstrates(uint256,bytes32[])",
];
const fuseAbi = [
  "function MARKET_ID() view returns (uint256)",
  "function MORPHO() view returns (address)",
];
const morphoAbi = [
  "function idToMarketParams(bytes32) view returns (address loanToken,address collateralToken,address oracle,address irm,uint256 lltv)",
];
const accessAbi = [
  "function getTargetFunctionRole(address,bytes4) view returns (uint64)",
  "function getRoleMember(uint64,address) view returns (bool,uint32)",
  "function canCall(address,address,bytes4) view returns (bool,uint32)",
];

function assert(ok, why) {
  if (!ok) throw new Error(why);
}
function same(a, b) {
  return getAddress(a) === getAddress(b);
}
function exactArray(a, b) {
  return a.length === b.length && a.every((value, index) => value.toLowerCase() === b[index].toLowerCase());
}
async function checkCode(provider, address, label) {
  assert((await provider.getCode(address)) !== "0x", `${label} has no contract code at ${address}`);
}
const summary = [];
function report(line) {
  console.log(line);
  summary.push(line);
}
async function main() {
  assert(["inspect", "apply"].includes(MODE), "MODE must be inspect or apply");
  const key = process.env.DEPLOYER_FX;
  assert(key && /^0x[0-9a-fA-F]{64}$/.test(key), "DEPLOYER_FX must be a 0x-prefixed 32-byte private key");
  const provider = new JsonRpcProvider(process.env.KATANA_RPC_URL || "https://rpc.katana.network/", undefined, { staticNetwork: false });
  const network = await provider.getNetwork();
  assert(network.chainId === CHAIN_ID, `Wrong chain: expected ${CHAIN_ID}, got ${network.chainId}`);
  const signer = new Wallet(key, provider);
  const vault = new Contract(VAULT, vaultAbi, provider);

  await checkCode(provider, VAULT, "Vault");
  await checkCode(provider, MORPHO, "Morpho");
  await checkCode(provider, SUPPLY_FUSE, "Supply fuse");
  await checkCode(provider, BALANCE_FUSE, "Balance fuse");

  const underlying = await vault.asset();
  assert(same(underlying, VBUSDC), `Vault asset ${underlying} is not expected vbUSDC ${VBUSDC}`);

  const morpho = new Contract(MORPHO, morphoAbi, provider);
  const params = await morpho.idToMarketParams(BLUE_MARKET);
  assert(same(params.loanToken, VBUSDC), `Morpho market loanToken ${params.loanToken} is not vbUSDC`);
  assert(!same(params.collateralToken, "0x0000000000000000000000000000000000000000"), "Morpho collateral is zero");
  const recomputed = keccak256(AbiCoder.defaultAbiCoder().encode(
    ["address", "address", "address", "address", "uint256"],
    [params.loanToken, params.collateralToken, params.oracle, params.irm, params.lltv],
  ));
  assert(recomputed.toLowerCase() === BLUE_MARKET, "Morpho market ID differs from canonical market params");

  const fuse = new Contract(SUPPLY_FUSE, fuseAbi, provider);
  const balanceFuse = new Contract(BALANCE_FUSE, fuseAbi, provider);
  const [supplyMarketId, balanceMarketId, fuseMorpho, balanceMorpho, supplyInstalled, balanceInstalled] =
    await Promise.all([
      fuse.MARKET_ID(),
      balanceFuse.MARKET_ID(),
      fuse.MORPHO(),
      balanceFuse.MORPHO(),
      vault.isFuseSupported(SUPPLY_FUSE),
      vault.isBalanceFuseSupported(IPOR_MARKET_ID, BALANCE_FUSE),
    ]);
  assert(supplyMarketId === IPOR_MARKET_ID, "Supply fuse uses an unexpected IPOR market ID");
  assert(balanceMarketId === IPOR_MARKET_ID, "Balance fuse uses an unexpected IPOR market ID");
  assert(same(fuseMorpho, MORPHO) && same(balanceMorpho, MORPHO), "Installed Morpho fuses point to another protocol");
  assert(supplyInstalled, "Expected Morpho supply fuse is not installed on this vault");
  assert(balanceInstalled, "Expected Morpho balance fuse is not installed for IPOR market 14: NAV tracking would be unsafe");

  const managerAddress = await vault.getAccessManagerAddress();
  await checkCode(provider, managerAddress, "Vault access manager");
  const access = new Contract(managerAddress, accessAbi, provider);
  const selector = vault.interface.getFunction("grantMarketSubstrates").selector;
  const configuredRole = await access.getTargetFunctionRole(VAULT, selector);
  assert(configuredRole === FUSE_MANAGER_ROLE, `Unexpected role for grantMarketSubstrates: ${configuredRole}, expected 300`);
  const [roleMember, permission] = await Promise.all([
    access.getRoleMember(FUSE_MANAGER_ROLE, signer.address),
    access.canCall(signer.address, VAULT, selector),
  ]);
  const [immediate, delay] = permission;
  const existing = [...await vault.getMarketSubstrates(IPOR_MARKET_ID)];
  const isAlreadyGranted = await vault.isMarketSubstrateGranted(IPOR_MARKET_ID, BLUE_MARKET);
  assert(existing.length === new Set(existing.map(x => x.toLowerCase())).size, "Existing substrate list has duplicates; abort to preserve exactly");
  assert(isAlreadyGranted === existing.some(x => x.toLowerCase() === BLUE_MARKET), "Substrate list and grant flag disagree");
  const next = isAlreadyGranted ? existing : [...existing, BLUE_MARKET];

  report("# cyvbUSDC Morpho lending venue v1");
  report(`Mode: ${MODE}`);
  report(`Chain: ${network.chainId}; vault: ${VAULT}`);
  report(`DEPLOYER_FX signer address: ${signer.address}`);
  report(`Access manager: ${managerAddress}`);
  report(`Required role: FUSE_MANAGER_ROLE = ${FUSE_MANAGER_ROLE} (immediate authorization: ${immediate}; member active: ${roleMember[0]}; execution delay: ${delay}s)`);
  report(`Morpho market: ${BLUE_MARKET}`);
  report(`Morpho collateral token: ${params.collateralToken}; loan/supply token: ${params.loanToken}`);
  report(`Installed supply fuse: ${SUPPLY_FUSE}; balance fuse: ${BALANCE_FUSE}; IPOR market: ${IPOR_MARKET_ID}`);
  report(`Existing Morpho substrates: ${existing.length}; requested substrate already granted: ${isAlreadyGranted}`);
  report(`Existing instant-withdraw fuse entries (unchanged): ${(await vault.getInstantWithdrawalFuses()).length}`);

  if (MODE === "inspect") {
    report("INSPECT_ONLY: no transactions sent and no chain configuration changed.");
    return;
  }

  assert(process.env.APPLY_CONFIRMATION === CONFIRMATION,
    `Apply requires confirmation value ${CONFIRMATION}`);
  if (isAlreadyGranted) {
    report("NO_OP: target market already granted; no transaction sent.");
    return;
  }
  assert(roleMember[0] && immediate && delay === 0n,
    "Signer lacks immediately executable FUSE_MANAGER_ROLE (300), or is subject to an execution delay");
  // A grant overwrites every substrate for the IPOR market. Abort if another manager changes
  // the set while this workflow is preparing its transaction.
  const current = [...await vault.getMarketSubstrates(IPOR_MARKET_ID)];
  assert(exactArray(current, existing), "Market substrates changed during preflight; refusing a stale overwrite");
  const calldata = vault.interface.encodeFunctionData("grantMarketSubstrates", [IPOR_MARKET_ID, next]);
  // eth_call simulates the stateful governance transaction without broadcasting.
  await provider.call({ from: signer.address, to: VAULT, data: calldata });

  // Recheck as close to broadcast as possible (still not atomic with competing writers).
  assert(exactArray([...await vault.getMarketSubstrates(IPOR_MARKET_ID)], existing),
    "Market substrates changed before broadcast");
  const writeVault = vault.connect(signer);
  const transaction = await writeVault.grantMarketSubstrates(IPOR_MARKET_ID, next);
  report(`Transaction submitted: ${transaction.hash}`);
  const receipt = await transaction.wait(1);
  assert(receipt && receipt.status === 1, `Transaction failed: ${transaction.hash}`);
  const finalSubstrates = [...await vault.getMarketSubstrates(IPOR_MARKET_ID)];
  assert(exactArray(finalSubstrates, next), "Post-transaction substrate list does not exactly match preserved existing list plus new market");
  assert(await vault.isMarketSubstrateGranted(IPOR_MARKET_ID, BLUE_MARKET),
    "Post-transaction market permission is not active");
  assert(await vault.isFuseSupported(SUPPLY_FUSE) &&
    await vault.isBalanceFuseSupported(IPOR_MARKET_ID, BALANCE_FUSE),
    "Installed Morpho fuse/balance-fuse binding changed after grant");
  report(`SUCCESS: market enabled without disturbing ${existing.length} previously configured substrate(s). Tx: ${transaction.hash}`);
  report("No vbUSDC was deposited, withdrawn, approved, or transferred by this configuration workflow.");
}
try {
  await main();
} catch (error) {
  report(`FAIL: ${error.shortMessage || error.message || String(error)}`);
  process.exitCode = 1;
} finally {
  if (process.env.GITHUB_STEP_SUMMARY) {
    await appendFile(process.env.GITHUB_STEP_SUMMARY, summary.join("\n\n") + "\n").catch(() => {});
  }
}
