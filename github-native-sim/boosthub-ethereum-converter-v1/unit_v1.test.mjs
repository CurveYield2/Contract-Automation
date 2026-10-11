import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Contract,ContractFactory,JsonRpcProvider,ZeroAddress} from 'ethers';
const E=10n**18n,D=10n**10n;
const addresses={crv:'0xD533a949740bb3306d119CC777fa900bA034cd52',crvusd:'0xf939E0A03FB07F59A73314E73794Be0E57ac1b4E',sdcrv:'0xD1b5651E55D4CeeD36251c61c50C889B36F6abB5',wst:'0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0',st:'0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84',fxn:'0x365AccFCa291e7D3914637ABf1F7635dB165Bb09',sdfxn:'0xe19d1c837B8A1C83A56cD9165b2c0256D39653aD',yb:'0x01791F726B4103694969820be083196cC7c045fF',sdyb:'0x0c057598dcE1891688829581f890DD2a3685a43f',router:'0x99a58482BD75cbab83b27EC03CA68fF489b5788f',tri:'0x4eBdF703948ddCEA3B11f675B4D1Fba9d2414A14',crvpool:'0xCA0253A98D16e9C1e3614caFDA19318EE69772D0',stpool:'0xDC24316b9AE028F1497c275EB9192a3Ea0f67022',fxnpool:'0xC15F285679a1Ef2d25F53D4CbD0265E1D02F2A92',sdfxnpool:'0x28Ca243dc0aC075dD012fCf9375C25D18A844d96',ybpool:'0xec977F46467a3021785Cff88894886E617abd65b',sdybpool:'0x98b540fa89690969D111D045afCa575C91519B1A'};
const rpc=process.env.UNIT_RPC||'http://127.0.0.1:8546';if(new URL(rpc).hostname!=='127.0.0.1')throw Error('Tests require disposable local Anvil');
const provider=new JsonRpcProvider(rpc,1,{staticNetwork:true,batchMaxCount:1,cacheTimeout:-1});provider.pollingInterval=50;let signer,caller,converter,router,tokens={},pools={},base;
const art=n=>JSON.parse(fs.readFileSync('build_v1/'+n+'_v1.json'));
async function etch(address,name){const a=art(name);await provider.send('anvil_setCode',[address,a.deployedBytecode]);return new Contract(address,a.abi,signer);}
const tx=async p=>(await p).wait();
const fee=(x,f)=>x*(D-f)/D;
test.before(async()=>{
 signer=await provider.getSigner(0);caller=await signer.getAddress();
 for(const n of ['crv','crvusd','sdcrv','st','fxn','sdfxn','yb','sdyb']){tokens[n]=await etch(addresses[n],'ConverterMockToken');await tx(tokens[n].initializeDecimals(18));}
 tokens.wst=await etch(addresses.wst,'ConverterMockWstEth');await tx(tokens.wst.initializeDecimals(18));await tx(tokens.wst.setRatio(12n*E/10n));
 for(const n of ['tri','crvpool','stpool','fxnpool','sdfxnpool','ybpool','sdybpool']){pools[n]=await etch(addresses[n],'ConverterMockOracle');await tx(pools[n].configure(2n*E,4n*E,4000000n,E));}
 await tx(pools.ybpool.configureExchange(addresses.crvusd,addresses.yb,E,false));await tx(pools.sdybpool.configureExchange(addresses.yb,addresses.sdyb,E,false));
 router=await etch(addresses.router,'ConverterMockRouter');await tx(router.configure(E,false,0));
 const a=art('BoostHubEthereumRewardConverter');converter=await new ContractFactory(a.abi,a.bytecode,signer).deploy(100);await converter.waitForDeployment();
 base=await provider.send('evm_snapshot',[]);
});
test.beforeEach(async()=>{await provider.send('evm_revert',[base]);base=await provider.send('evm_snapshot',[]);});
test.after(()=>provider.destroy());
test('all live pairs are registered while unsupported tokens and reversed pairs reject',async()=>{
 for(const [a,b] of [['crv','sdcrv'],['crvusd','sdcrv'],['wst','sdfxn'],['crvusd','sdyb']])assert.equal(await converter.isSupportedPair(addresses[a],addresses[b]),true);
 assert.equal(await converter.isSupportedPair(addresses.sdcrv,addresses.crv),false);
 await assert.rejects(converter.previewConvert(ZeroAddress,addresses.sdcrv,E));
 await assert.rejects(converter.previewConvert(addresses.sdcrv,addresses.crv,E));
});
test('CRV quote uses the pool oracle with its native fee and decimal normalization',async()=>{
 const expected=fee(E/2n,4000000n);assert.equal(await converter.previewConvert(addresses.crv,addresses.sdcrv,E),expected);
 await tx(tokens.crv.initializeDecimals(6));assert.equal(await converter.previewConvert(addresses.crv,addresses.sdcrv,1000000n),expected);
});
test('crvUSD quote uses the indexed CRV oracle then the sdCRV oracle',async()=>{
 const expected=fee(fee(E/4n,4000000n)/2n,4000000n);assert.equal(await converter.previewConvert(addresses.crvusd,addresses.sdcrv,E),expected);
});
test('wstETH quote preserves unwrapping, the legacy stETH quote, and the two oracle hops',async()=>{
 const expected=fee(fee((12n*E/10n)/2n,4000000n)/2n,4000000n);assert.equal(await converter.previewConvert(addresses.wst,addresses.sdfxn,E),expected);
});
test('quotes fail closed for missing pool oracles and invalid Curve fees',async()=>{
 await tx(pools.crvpool.setMissingOracle(true));await assert.rejects(converter.previewConvert(addresses.crv,addresses.sdcrv,E));
 await tx(pools.crvpool.setMissingOracle(false));await tx(pools.crvpool.configure(E,E,D,E));await assert.rejects(converter.previewConvert(addresses.crv,addresses.sdcrv,E));
});
test('zero quotes and zero conversions have distinct behavior',async()=>{
 assert.equal(await converter.previewConvert(addresses.crv,addresses.sdcrv,0),0n);
 await assert.rejects(converter.convert(addresses.crv,addresses.sdcrv,0,0));
});
test('caller minimum is passed to the router and output balance deltas exclude preexisting funds',async()=>{
 const c=await converter.getAddress();await tx(tokens.crv.mint(caller,E));await tx(tokens.sdcrv.mint(c,7n*E));await tx(tokens.crv.approve(c,E));await tx(router.configure(E,false,100n*E));
 assert.equal(await converter.convert.staticCall(addresses.crv,addresses.sdcrv,E,E),E);
 await tx(converter.convert(addresses.crv,addresses.sdcrv,E,E));assert.equal(await router.lastMinimum(),E);assert.equal(await tokens.sdcrv.balanceOf(caller),E);assert.equal(await tokens.sdcrv.balanceOf(c),7n*E);assert.equal(await tokens.crv.allowance(c,addresses.router),0n);
});
test('converter verifies actual output even if a router ignores the caller minimum',async()=>{
 const c=await converter.getAddress();await tx(tokens.crv.mint(caller,E));await tx(tokens.crv.approve(c,E));await tx(router.configure(E/2n,true,100n*E));
 await assert.rejects(converter.convert(addresses.crv,addresses.sdcrv,E,E));assert.equal(await tokens.crv.balanceOf(caller),E);assert.equal(await tokens.sdcrv.balanceOf(caller),0n);
});
test('three-argument swap enforces the same oracle-derived minimum formula automatically',async()=>{
 const c=await converter.getAddress();await tx(tokens.crv.mint(caller,E));await tx(tokens.crv.approve(c,E));const q=await converter.previewConvert(addresses.crv,addresses.sdcrv,E);const floor=q*9900n/10000n;
 await tx(router.configure(floor*E/E,false,0));await tx(converter['swap(address,address,uint256)'](addresses.crv,addresses.sdcrv,E));assert.equal(await router.lastMinimum(),floor);
});
test('getAmountOut and four-argument swap preserve the converter compatibility interface',async()=>{
 assert.equal(await converter.getAmountOut(addresses.crv,addresses.sdcrv,E),await converter.previewConvert(addresses.crv,addresses.sdcrv,E));
 const c=await converter.getAddress();await tx(tokens.crv.mint(caller,E));await tx(tokens.crv.approve(c,E));await tx(converter['swap(address,address,uint256,uint256)'](addresses.crv,addresses.sdcrv,E,E));assert.equal(await tokens.sdcrv.balanceOf(caller),E);
});
test('automatic slippage configuration respects the live strategy cap',async()=>{
 const a=art('BoostHubEthereumRewardConverter');await assert.rejects(new ContractFactory(a.abi,a.bytecode,signer).deploy(401));assert.equal(await converter.slippageBps(),100n);
});
test('sdYB retains the exact two deployed pool quotes and direct-pool minimum checks',async()=>{
 assert.equal(await converter.previewConvert(addresses.crvusd,addresses.sdyb,E),E);
 const c=await converter.getAddress();await tx(tokens.crvusd.mint(caller,E));await tx(tokens.crvusd.approve(c,E));await tx(tokens.yb.mint(c,3n*E));await tx(tokens.sdyb.mint(c,4n*E));
 await tx(converter.convert(addresses.crvusd,addresses.sdyb,E,E));assert.equal(await pools.ybpool.lastMinimum(),0n);assert.equal(await pools.sdybpool.lastMinimum(),E);assert.equal(await tokens.sdyb.balanceOf(caller),E);assert.equal(await tokens.yb.balanceOf(c),3n*E);assert.equal(await tokens.sdyb.balanceOf(c),4n*E);assert.equal(await tokens.crvusd.allowance(c,addresses.ybpool),0n);assert.equal(await tokens.yb.allowance(c,addresses.sdybpool),0n);
});
test('sdYB verifies actual final output independently of the second pool return/minimum behavior',async()=>{
 const c=await converter.getAddress();await tx(tokens.crvusd.mint(caller,E));await tx(tokens.crvusd.approve(c,E));await tx(pools.sdybpool.configureExchange(addresses.yb,addresses.sdyb,E/2n,true));
 await assert.rejects(converter.convert(addresses.crvusd,addresses.sdyb,E,E));assert.equal(await tokens.crvusd.balanceOf(caller),E);
});
test('sdYB router adapters retain the live route validation and guarded conversion',async()=>{
 const r=await converter.route(addresses.crvusd,addresses.sdyb),p=await converter.swapParams(addresses.crvusd,addresses.sdyb);assert.equal(await converter.get_exchange_multiple_amount(Array.from(r),p.map(x=>Array.from(x)),E),E);
 const c=await converter.getAddress();await tx(tokens.crvusd.mint(caller,E));await tx(tokens.crvusd.approve(c,E));await tx(converter.exchange_multiple(Array.from(r),p.map(x=>Array.from(x)),E,E));assert.equal(await tokens.sdyb.balanceOf(caller),E);
 const bad=Array.from(r);bad[1]=ZeroAddress;await assert.rejects(converter.get_exchange_multiple_amount(bad,p.map(x=>Array.from(x)),E));
});
test('wstETH conversion spends only newly unwrapped stETH and resets its router allowance',async()=>{
 const c=await converter.getAddress();await tx(tokens.wst.mint(caller,E));await tx(tokens.wst.approve(c,E));await tx(tokens.st.mint(c,7n*E));
 await tx(converter.convert(addresses.wst,addresses.sdfxn,E,E));assert.equal(await tokens.sdfxn.balanceOf(caller),12n*E/10n);assert.equal(await tokens.st.balanceOf(c),7n*E);assert.equal(await tokens.st.allowance(c,addresses.router),0n);
});
test('route getters report the correct Curve pool types and unwrap-adjusted wstETH path',async()=>{
 assert.equal(await converter.routeCount(),4n);const tokensAt=await converter.routeAt(3);assert.equal(tokensAt[0],addresses.crvusd);assert.equal(tokensAt[1],addresses.sdyb);
 const p=await converter.swapParams(addresses.crvusd,addresses.sdcrv);assert.equal(p[0][2],3n);const r=await converter.route(addresses.wst,addresses.sdfxn);assert.equal(r[0],addresses.st);assert.equal((await converter.pools(addresses.wst,addresses.sdfxn)).length,3);
 await assert.rejects(converter.routeAt(4));
});
