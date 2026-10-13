// Katana cyvbUSDC Morpho configuration fork simulation v1.
// ALL writes go to an ephemeral Anvil fork, never the public Katana chain.
import { writeFile } from "node:fs/promises";
import { AbiCoder, Contract, Interface, JsonRpcProvider, Wallet, getAddress, keccak256, MaxUint256 } from "ethers";

const address = (a) => getAddress(a.toLowerCase());
const VAULT = address("0xDf9CbCB8b57A031e91CAe673a6A5786d85Ce2eC5");
const VBUSDC = address("0x203A662b0BD271A6ed5a60EdFbd04bFce608FD36");
const MORPHO = address("0xD50F2DffFd62f94Ee4AEd9ca05C61d0753268aBc");
const MARKET = "0xcfac40b9f06194a33d9526f73642f6849b908c2b6d8669ad9d2d4a3e7dcb017a";
const MAINNET_ROLE_MANAGER = address("0x47623C62f281807D615eeb4A2CEee9d97F9D3C49");
const EXPECTED = [
  { id: 41n, supply: address("0x1f657229ec2D261be7dCD63ca82abed334d1f28b"), balance: address("0x70Ed27aEE2dD509bC6BB067d8e2C61A1FE96eCa4"), name: "Morpho liquidity" },
  { id: 14n, supply: address("0xC66c3F5cC5e1550A0Ff960c06D630A2FBB80E19d"), balance: address("0x83790D83C23461cd22429276406C4f09DB885A85"), name: "Morpho legacy/other" },
];
const vaultAbi = [
  "function asset() view returns (address)",
  "function getAccessManagerAddress() view returns (address)",
  "function isFuseSupported(address) view returns (bool)",
  "function isBalanceFuseSupported(uint256,address) view returns (bool)",
  "function getFuses() view returns (address[])",
  "function getMarketSubstrates(uint256) view returns (bytes32[])",
  "function isMarketSubstrateGranted(uint256,bytes32) view returns (bool)",
  "function getInstantWithdrawalFuses() view returns (address[])",
  "function grantMarketSubstrates(uint256,bytes32[])",
  "function execute((address fuse,bytes data)[] calls_)",
  "function totalAssets() view returns (uint256)",
];
const accessAbi = [
  "function getRoleAdmin(uint64) view returns (uint64)",
  "function getTargetFunctionRole(address,bytes4) view returns (uint64)",
  "function hasRole(uint64,address) view returns (bool,uint32)",
  "function canCall(address,address,bytes4) view returns (bool,uint32)",
  "function grantRole(uint64,address,uint32)",
];
const fuseAbi = [
  "function MARKET_ID() view returns (uint256)",
  "function MORPHO() view returns (address)",
];
const morphoAbi = ["function idToMarketParams(bytes32) view returns (address loanToken,address collateralToken,address oracle,address irm,uint256 lltv)"];
const tokenAbi = ["function balanceOf(address) view returns (uint256)", "function decimals() view returns (uint8)"];
const report = { version: "v1", mode: "EPHEMERAL_ANVIL_FORK_ONLY", status: "FAIL", checks: {}, details: {}, txs: [], notes: [] };
const eq = (a,b) => String(a).toLowerCase() === String(b).toLowerCase();
const assert = (condition, why) => { if(!condition) throw new Error(why); };
const log = (s) => { report.notes.push(s); console.log(s); };
async function rpc(provider, method, params) {
  return await provider.send(method, params);
}
async function run() {
  const url = process.env.KATANA_RPC_URL || "http://127.0.0.1:8545";
  assert(url === "http://127.0.0.1:8545", "Refusing nonlocal RPC for fork mutation");
  const p = new JsonRpcProvider(url);
  assert((await p.getNetwork()).chainId === 747474n, "Wrong chain ID");
  assert((await rpc(p, "web3_clientVersion", [])).toLowerCase().includes("anvil"), "Refusing to operate without Anvil");
  report.details.forkBlock = await p.getBlockNumber();
  const vault = new Contract(VAULT, vaultAbi, p);
  const morpho = new Contract(MORPHO, morphoAbi, p);
  assert((await p.getCode(VAULT)) !== "0x", "Vault has no code");
  const actualAsset = await vault.asset();
  report.details.vaultAsset = actualAsset;
  assert(eq(actualAsset, VBUSDC), `Vault asset is not vbUSDC: ${actualAsset}`);
  const params = await morpho.idToMarketParams(MARKET);
  report.details.morphoParams = { loanToken: params.loanToken, collateralToken: params.collateralToken, oracle: params.oracle, irm: params.irm, lltv: params.lltv.toString() };
  assert(eq(params.loanToken, VBUSDC), "Morpho loan token is not vbUSDC");
  const id = keccak256(AbiCoder.defaultAbiCoder().encode(
    ["address", "address", "address", "address", "uint256"],
    [params.loanToken, params.collateralToken, params.oracle, params.irm, params.lltv]
  ));
  assert(eq(id, MARKET), "Morpho market parameter hash does not match ID");
  report.checks.marketIdentity = "PASS";
  let selected;
  for (const candidate of EXPECTED) {
    const supplyInstalled = await vault.isFuseSupported(candidate.supply);
    const balanceInstalled = await vault.isBalanceFuseSupported(candidate.id, candidate.balance);
    log(`Candidate ${candidate.name}, IPOR market ${candidate.id}: supplyInstalled=${supplyInstalled}; balanceInstalled=${balanceInstalled}`);
    if (!supplyInstalled || !balanceInstalled) continue;
    const supply = new Contract(candidate.supply, fuseAbi, p);
    const balance = new Contract(candidate.balance, fuseAbi, p);
    const values = await Promise.all([supply.MARKET_ID(), balance.MARKET_ID(), supply.MORPHO(), balance.MORPHO()]);
    assert(values[0] === candidate.id && values[1] === candidate.id, "Installed fuse market ID mismatch");
    assert(eq(values[2], MORPHO) && eq(values[3], MORPHO), "Installed fuse Morpho address mismatch");
    assert(!selected, "Multiple Morpho candidate fuses found; disambiguation required");
    selected = candidate;
  }
  report.details.selected = selected ? { marketId: selected.id.toString(), supplyFuse: selected.supply, balanceFuse: selected.balance } : null;
  assert(selected, "No recognized Morpho supply and balance-fuse pair installed on this vault");
  report.checks.installedFuses = "PASS";
  const managerAddress = await vault.getAccessManagerAddress();
  const access = new Contract(managerAddress, accessAbi, p);
  report.details.accessManager = managerAddress;
  const original = [...await vault.getMarketSubstrates(selected.id)];
  const originalWithdraw = [...await vault.getInstantWithdrawalFuses()];
  report.details.substratesBefore = original;
  report.details.withdrawalFusesBefore = originalWithdraw;
  const granted = await vault.isMarketSubstrateGranted(selected.id, MARKET);
  assert(granted === original.some(x => eq(x, MARKET)), "Inconsistent substrate state");
  const next = granted ? original : [...original, MARKET];
  assert(new Set(next.map(s=>s.toLowerCase())).size === next.length, "Duplicated market substrate present");
  const selector = vault.interface.getFunction("grantMarketSubstrates").selector;
  const role = await access.getTargetFunctionRole(VAULT, selector);
  const roleAdmin = await access.getRoleAdmin(role);
  report.details.role = role.toString();
  report.details.roleAdmin = roleAdmin.toString();
  report.checks.roleMapping = role === 300n ? "PASS" : "UNEXPECTED";
  log(`Vault ${VAULT}, manager ${managerAddress}, grantMarketSubstrates role ${role} (admin role ${roleAdmin})`);
  log(`Original ${original.length} substrate(s); requested already granted=${granted}; withdrawal fuses=${originalWithdraw.length}`);
  assert(role === 300n, "grantMarketSubstrates role is not FUSE_MANAGER_ROLE (300)");

  // Exercise exactly the production configurator's governance path on a local fork.
  // A disposable key is deliberately used instead of production DEPLOYER_FX.
  const user = new Wallet("0x" + "a1".repeat(32), p);
  report.details.simulatedSigner = user.address;
  await rpc(p, "anvil_setBalance", [user.address, "0x3635c9adc5dea00000"]);
  const beforePermission = await access.canCall(user.address, VAULT, selector);
  report.details.signerPermissionBefore = [beforePermission[0], beforePermission[1].toString()];
  if (!beforePermission[0]) {
    // Try the known protocol governance Safe as a fork-only impersonated admin.
    const adminMember = await access.hasRole(roleAdmin, MAINNET_ROLE_MANAGER);
    report.details.knownGovernanceSafe = MAINNET_ROLE_MANAGER;
    report.details.knownGovernanceSafeHasAdminRole = adminMember[0];
    assert(adminMember[0] && adminMember[1] === 0n,
      `Known governance Safe lacks immediate admin role ${roleAdmin}; cannot safely simulate granting role`);
    await rpc(p, "anvil_setBalance", [MAINNET_ROLE_MANAGER, "0x3635c9adc5dea00000"]);
    await rpc(p, "anvil_impersonateAccount", [MAINNET_ROLE_MANAGER]);
    const adminSigner = await p.getSigner(MAINNET_ROLE_MANAGER);
    const receipt = await (await access.connect(adminSigner).grantRole(role, user.address, 0)).wait();
    assert(receipt?.status === 1, "Fork-only simulated role assignment reverted");
    report.txs.push({type:"fork-only grantRole",hash:receipt.hash});
    await rpc(p, "anvil_stopImpersonatingAccount", [MAINNET_ROLE_MANAGER]);
  }
  const can = await access.canCall(user.address, VAULT, selector);
  assert(can[0] && can[1] === 0n, "Simulated signer still not immediately authorized");
  report.checks.forkOnlyRoleGrant = "PASS";
  if (!granted) {
    const predicted = await vault.connect(user).grantMarketSubstrates.staticCall(selected.id, next);
    void predicted;
    const receipt = await (await vault.connect(user).grantMarketSubstrates(selected.id, next)).wait();
    assert(receipt?.status === 1, "Fork-only substrate grant reverted");
    report.txs.push({type:"fork-only grantMarketSubstrates",hash:receipt.hash});
  }
  const after = [...await vault.getMarketSubstrates(selected.id)];
  assert(after.length === next.length && after.every((s,i)=>eq(s,next[i])), "Other Morpho substrate permissions were changed");
  assert(await vault.isMarketSubstrateGranted(selected.id, MARKET), "Requested Morpho market not granted after simulation");
  const withdrawAfter = [...await vault.getInstantWithdrawalFuses()];
  assert(withdrawAfter.length === originalWithdraw.length && withdrawAfter.every((s,i)=>eq(s,originalWithdraw[i])),
    "Instant withdrawal fuse ordering changed");
  report.checks.configurationTransaction = "PASS";
  report.checks.previousVenuesPreserved = "PASS";
  report.checks.instantWithdrawConfigPreserved = "PASS";
  report.details.substratesAfter = after;

  // Supply and exit require ALPHA_ROLE; check the opportunity to run them on this fork
  // without representing a zero-token no-op as a successful lending test.
  const token = new Contract(VBUSDC, tokenAbi, p);
  const idle = await token.balanceOf(VAULT);
  report.details.vaultIdleVbUsdc = idle.toString();
  const execSelector = vault.interface.getFunction("execute").selector;
  const executeRole = await access.getTargetFunctionRole(VAULT, execSelector);
  report.details.executeRole = executeRole.toString();
  assert(executeRole === 200n, "Vault execute unexpectedly not ALPHA_ROLE");
  if (idle > 0n && !granted) {
    const alphaAdminRole = await access.getRoleAdmin(200n);
    const alphaAdmin = await access.hasRole(alphaAdminRole, MAINNET_ROLE_MANAGER);
    assert(alphaAdmin[0] && alphaAdmin[1] === 0n, "Safe cannot grant ALPHA for supply/withdraw simulation");
    await rpc(p, "anvil_impersonateAccount", [MAINNET_ROLE_MANAGER]);
    await (await access.connect(await p.getSigner(MAINNET_ROLE_MANAGER)).grantRole(200n, user.address, 0)).wait();
    await rpc(p, "anvil_stopImpersonatingAccount", [MAINNET_ROLE_MANAGER]);
    const amount = idle < 1_000_000n ? idle : 1_000_000n;
    const fuseIface = new Interface([
      "function enter((bytes32 morphoMarketId,uint256 amount))",
      "function exit((bytes32 morphoMarketId,uint256 amount))",
    ]);
    const supplyAction = [{fuse: selected.supply, data: fuseIface.encodeFunctionData("enter", [[MARKET,amount]])}];
    const supplyReceipt = await (await vault.connect(user).execute(supplyAction)).wait();
    assert(supplyReceipt?.status === 1, "Supply fuse execution failed on fork");
    const interim = await token.balanceOf(VAULT);
    assert(interim < idle, "Morpho supply did not decrease idle vbUSDC");
    const exitAction = [{fuse: selected.supply, data: fuseIface.encodeFunctionData("exit",[[MARKET,MaxUint256]])}];
    const exitReceipt = await (await vault.connect(user).execute(exitAction)).wait();
    assert(exitReceipt?.status === 1, "Withdraw fuse execution failed on fork");
    const finalIdle = await token.balanceOf(VAULT);
    assert(finalIdle >= idle, "Full Morpho exit failed to restore vault-held vbUSDC");
    report.txs.push({type:"fork-only supply",hash:supplyReceipt.hash},{type:"fork-only exit",hash:exitReceipt.hash});
    report.checks.supplyAndWithdraw = "PASS";
  } else {
    report.checks.supplyAndWithdraw = "NOT_EXERCISED";
    log(`Supply+withdraw not exercised: original idle vbUSDC=${idle}; market already granted=${granted}`);
  }
  report.status = "PASS";
  log("PASS: local Anvil-only venue grant succeeded; preexisting Morpho venues and withdrawal config remain intact.");
}
try { await run(); } catch(error) {
  report.error = String(error.shortMessage || error.message || error);
  console.error("FAIL:",report.error);
  process.exitCode=1;
} finally {
  await writeFile("cyvbusdc-morpho-simulation-v1.json", JSON.stringify(report,null,2)+"\n");
  console.log("Summary:",JSON.stringify(report));
}
