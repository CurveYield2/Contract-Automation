// fxMINT WBTC repayment: read-only Ethereum evidence collector v1.
// All RPC access is supplied by the existing runner-owned secret.
import { JsonRpcProvider, Contract, formatUnits } from 'ethers';
import { writeFile, mkdir, appendFile } from 'node:fs/promises';
import { FxSdk } from '@aladdindao/fx-sdk';
import { createPhase6MutableRpcSession } from './phase6-mutable-rpc-v1.mjs';

const OWNER = '0x9f2B20A772246960810045905B7daccf960eE288';
const ADDR = {
  USDC: '0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  WBTC: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
  fxUSD: '0x085780639CC2cACd35E474e71f4d000e2405d8f6',
  balancerV2Vault: '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
  uniswapV3Factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
};
const ERC20 = ['function decimals() view returns (uint8)', 'function symbol() view returns (string)', 'function balanceOf(address) view returns (uint256)'];
const FACTORY = ['function getPool(address,address,uint24) view returns (address)'];
const POOL = ['function liquidity() view returns (uint128)', 'function slot0() view returns (uint160,int24,uint16,uint16,uint16,uint8,bool)'];
const outfile = 'fxmint-wbtc-repayment-v1-data.json';
const report = {version:'v1',mode:'read-only',owner:OWNER,tokenAddresses:ADDR,observedAt:new Date().toISOString(),checks:{},positions:[],markets:[],failures:[],status:'INCOMPLETE'};
let session;
const trimError = (e) => String(e?.shortMessage || e?.message || e).slice(0,480).replace(/https?:\/\/[^\s'"]+/g,'[redacted-rpc-url]');
const asJson = (_k,v) => typeof v==='bigint' ? v.toString() : v;
async function probe(name,fn) { try { return await fn(); } catch(e) { report.failures.push({probe:name,error:trimError(e)}); return null; } }
try {
  session = await createPhase6MutableRpcSession();
  if (session.evidence.status !== 'PASS') throw Error('Approved Ethereum RPC session failed identity preflight: '+session.evidence.failureKind);
  const rpc = new JsonRpcProvider(session.runtime.url,1,{staticNetwork:true});
  const block = await rpc.getBlock('latest');
  report.chain = {chainId:Number((await rpc.getNetwork()).chainId),blockNumber:block.number,blockHash:block.hash};
  if (report.chain.chainId !== 1) throw Error('Ethereum mainnet chain ID mismatch');
  report.ownerEthWei=(await rpc.getBalance(OWNER)).toString();
  for (const [symbol,address] of Object.entries(ADDR)) {
    report.checks[symbol+'Code'] = (await rpc.getCode(address)).length > 2;
  }
  for (const sym of ['USDC','WBTC','fxUSD']) {
    const tok=new Contract(ADDR[sym],ERC20,rpc);
    report.checks[sym]=await probe(sym,async()=>({
      address:ADDR[sym],symbol:await tok.symbol(),decimals:Number(await tok.decimals()),
      ownerBalance:(await tok.balanceOf(OWNER)).toString(),
      balancerV2VaultBalance:(await tok.balanceOf(ADDR.balancerV2Vault)).toString()
    }));
  }
  const sdk = new FxSdk({rpcUrl:session.runtime.url,chainId:1});
  for (const type of ['long','short']) {
    const positions=await probe('FX SDK BTC '+type,()=>sdk.getPositions({userAddress:OWNER,market:'BTC',type}));
    if (!Array.isArray(positions)) continue;
    for (const p of positions) report.positions.push({
      type,positionId:String(p.positionId),
      rawColls:String(p.rawColls),rawDebts:String(p.rawDebts),
      rawCollsToken:p.rawCollsToken,rawDebtsToken:p.rawDebtsToken,
      rawCollsDecimals:p.rawCollsDecimals,rawDebtsDecimals:p.rawDebtsDecimals,
      currentLeverage:p.currentLeverage,lsdLeverage:p.lsdLeverage
    });
  }
  const factory=new Contract(ADDR.uniswapV3Factory,FACTORY,rpc);
  const pairs=[['USDC','fxUSD'],['WBTC','USDC'],['WBTC','fxUSD']];
  for (const pair of pairs) for (const fee of [100,500,3000,10000]) {
    const address=await probe('Uniswap V3 '+pair.join('/')+' fee '+fee,()=>factory.getPool(ADDR[pair[0]],ADDR[pair[1]],fee));
    if (!address || /^0x0{40}$/i.test(address)) continue;
    const pool=new Contract(address,POOL,rpc);
    const state=await probe('pool '+address,async()=>({liquidity:(await pool.liquidity()).toString(),sqrtPriceX96:(await pool.slot0())[0].toString()}));
    report.markets.push({pair:pair.join('/'),fee,address,...(state||{})});
  }
  const usdc=report.checks.USDC;
  const enoughFlashLiquidity=usdc&&BigInt(usdc.balancerV2VaultBalance)>=200000000n;
  report.checks.enoughBalancerUSDC=Boolean(enoughFlashLiquidity);
  report.checks.positionFound=report.positions.length>0;
  report.checks.requiredFlow='USDC -> fxUSD -> debt repayment + WBTC collateral withdrawal -> USDC (additional fxUSD -> USDC leg needed if withdrawn WBTC is sold for fxUSD)';
  report.status = !report.checks.positionFound ? 'POSITION_NOT_DISCOVERED' : !enoughFlashLiquidity ? 'FLASH_LIQUIDITY_MISSING' : 'POSITION_AND_FLASH_LIQUIDITY_DISCOVERED';
} catch(e) {
  report.status='COLLECTION_FAILED';
  report.failures.push({probe:'main',error:trimError(e)});
} finally {
  if (session) await session.close().catch(()=>{});
  await mkdir('fxmint-wbtc-evidence',{recursive:true});
  await writeFile('fxmint-wbtc-evidence/'+outfile,JSON.stringify(report,asJson,2)+'\n');
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY,
    '### fxMINT WBTC evidence v1\n\nStatus: '+report.status+'\n\nPositions: '+report.positions.length+
    '\n\nEthereum block: '+(report.chain?.blockNumber ?? 'not available')+
    '\n\nSee JSON artifact for read-only positions, pool observations and typed failures.\n');
  console.log(JSON.stringify({status:report.status,positions:report.positions.length,block:report.chain?.blockNumber,checks:report.checks,failures:report.failures},asJson,2));
  if (report.status==='COLLECTION_FAILED') process.exitCode=1;
}