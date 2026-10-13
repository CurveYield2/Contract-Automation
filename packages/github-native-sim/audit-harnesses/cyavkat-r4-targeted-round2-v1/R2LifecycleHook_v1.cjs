// Test-only verified-fork ABI investigation. Never broadcast to a production RPC.
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {ethers}=require(process.env.R2_ETHERS_PATH || 'ethers');
const DEPLOYER='0x11b78837cadC8E894F1c6e13fA9f3A085a75FA35';
const SAFE='0x47623C62f281807D615eeb4A2CEee9d97F9D3C49';
const VAULT='0xEd83daf48429cfb2C650Fd721b9241e180fd4548';
const OLD='0x59B340EAb30AFE0cecD51C609d3190e8C75C40AE';
const ACCESS='0xd7f408f203c5c6a76c9c55c9f6b015929F151fAA';
const USERS=['0x000000000000000000000000000000000000Aa01','0x000000000000000000000000000000000000Aa02','0x000000000000000000000000000000000000Aa03','0x000000000000000000000000000000000000Aa04'];
const ID='9f283a35597d2032b3fb3159979405079eb7a6c6d3fe187ad33ec47f795853e9';
const RPC=process.env.LOCALHOST_RPC_URL||'http://127.0.0.1:8655';
if(!/http:\/\/(127\.0\.0\.1|localhost):8655\/?$/.test(RPC)) throw Error('NEVER execute against a nonlocal RPC');
const ROOT=path.resolve(__dirname,'..');
const OUTPUT=process.env.R2_EVIDENCE_FILE||path.join(ROOT,'round2-real-legacy-lifecycle-v1.json');
const p=new ethers.JsonRpcProvider(RPC,747474,{staticNetwork:true,cacheTimeout:-1});
const vi=new ethers.Interface([
  'function transfer(address to,uint256 value) returns(bool)',
  'function balanceOf(address) view returns(uint256)',
  'function totalSupply() view returns(uint256)',
  'function totalAssets() view returns(uint256)',
  'function convertToAssets(uint256) view returns(uint256)',
  'function allowance(address,address) view returns(uint256)',
  'function redeemFromRequest(uint256,address,address) returns(uint256)',
  'function asset() view returns(address)',
  'function PLASMA_VAULT_BASE() view returns(address)',
]);
const wi=new ethers.Interface([
  'function requestShares(uint256)',
  'function requestInfo(address) view returns(uint256 shares,uint256 endWithdrawWindowTimestamp,bool canWithdraw,uint256 withdrawWindowInSeconds,uint256 refundableFeeShares)',
  'function getSharesToRelease() view returns(uint256)',
  'function getRequestFee() view returns(uint256)',
  'function getLastReleaseFundsTimestamp() view returns(uint256)',
  'function releaseFunds(uint256,uint256)',
  'function releaseFor(address,uint256,uint256) returns(uint256)',
  'function controller() view returns(address)',
  'function releasableShares() view returns(uint256)',
]);
const ai=new ethers.Interface([
  'function hasRole(uint64,address) view returns(bool,uint32)',
  'function grantRole(uint64,address,uint32)',
  'function revokeRole(uint64,address)'
]);
const state={schemaVersion:'curveyield-round2-authentic-legacy-lifecycle-raw-v1',requestId:ID,sourceSha256:'7c620ff30c79ceff532af3ad0977d184e66d76a4e00b600d61050799f5b9c8be',boundedLocalRpc:RPC,events:[],transactions:[],snapshots:[],phases:[],failures:[],users:USERS,setupAttempted:false,cutoverAttempted:false};
function safeJson(v){return JSON.stringify(v,(_k,z)=>typeof z==='bigint'?z.toString():z,2)+'\n';}
function save(){fs.mkdirSync(path.dirname(OUTPUT),{recursive:true});fs.writeFileSync(OUTPUT,safeJson(state));}
async function call(label,to,iface,method,args=[]){const input=iface.encodeFunctionData(method,args);const row={kind:'eth_call',label,to,method,args,encodedCalldata:input};try{const output=await p.call({to,data:input});row.success=true;row.rawReturn=output;row.result=Array.from(iface.decodeFunctionResult(method,output)).map(x=>Array.isArray(x)?Array.from(x):x);}catch(e){row.success=false;row.error=String(e.shortMessage||e.message||e).slice(0,1800);row.revertData=e.data||null;}state.events.push(row);save();return row;}
async function tx(label,from,to,iface,method,args=[],gasLimit=2600000n){const input=iface.encodeFunctionData(method,args),row={kind:'eth_sendTransaction',label,from,to,method,args,encodedCalldata:input};try{const signer=await p.getSigner(from);const t=await signer.sendTransaction({to,data:input,gasLimit});row.txHash=t.hash;const receipt=await t.wait();row.status=Number(receipt.status);row.blockNumber=receipt.blockNumber;row.gasUsed=receipt.gasUsed;row.logs=receipt.logs.map(l=>({address:l.address,topics:l.topics,data:l.data}));row.success=receipt.status===1; }catch(e){row.success=false;row.status=0;row.error=String(e.shortMessage||e.message||e).slice(0,1800);row.txHash=e.transactionHash||e.receipt?.hash||null;row.revertData=e.data||null;if(e.receipt){row.blockNumber=e.receipt.blockNumber;row.gasUsed=e.receipt.gasUsed;}}
 state.transactions.push(row);console.log('[R2_EXEC]',label,JSON.stringify({success:row.success,hash:row.txHash,error:row.error}));save();return row;}
async function snapshot(label){const [block,base,oldFee,oldReleased,oldLast,totalSupply,totalAssets,oldEscrow,ownerShares,alphaOld,alphaDeployer]=await Promise.all([p.getBlock('latest'),call(label+':vaultBase',VAULT,vi,'PLASMA_VAULT_BASE'),call(label+':oldRequestFee',OLD,wi,'getRequestFee'),call(label+':oldReleased',OLD,wi,'getSharesToRelease'),call(label+':oldLastRelease',OLD,wi,'getLastReleaseFundsTimestamp'),call(label+':totalSupply',VAULT,vi,'totalSupply'),call(label+':totalAssets',VAULT,vi,'totalAssets'),call(label+':oldEscrowShares',VAULT,vi,'balanceOf',[OLD]),call(label+':deployerShares',VAULT,vi,'balanceOf',[DEPLOYER]),call(label+':oldAlpha',ACCESS,ai,'hasRole',[200,OLD]),call(label+':deployerAlpha',ACCESS,ai,'hasRole',[200,DEPLOYER])]);const row={label,blockNumber:block.number,blockHash:block.hash,timestamp:block.timestamp,base,oldFee,oldReleased,oldLast,totalSupply,totalAssets,oldEscrow,ownerShares,alphaOld,alphaDeployer,users:[]};
for(const user of USERS){const [shares,oldRequest]=await Promise.all([call(label+':shareBalance:'+user,VAULT,vi,'balanceOf',[user]),call(label+':requestInfo:'+user,OLD,wi,'requestInfo',[user])]);row.users.push({user,shares,oldRequest})}
state.snapshots.push(row);save();return row;}
async function before(){
 const net=await p.getNetwork();if(net.chainId!==747474n)throw Error('wrong fork chain');
 const blk=await p.getBlock('latest');state.fork={chainId:String(net.chainId),initialBlock:blk.number,initialBlockHash:blk.hash,initialTimestamp:blk.timestamp};
 state.codeHashes={};for(const [k,a] of [['VAULT',VAULT],['OLD',OLD],['ACCESS',ACCESS]]){const code=await p.getCode(a);state.codeHashes[k]=ethers.keccak256(code);if(code==='0x')throw Error('missing actual code '+k);}
 await snapshot('before_claims');state.setupAttempted=true;save();
 // Test-owned wallets receive ETH only for transaction gas via isolated Anvil; vault shares come solely from legitimate ERC20 transfers.
 for(const user of USERS) await p.send('anvil_setBalance',[user,'0x3635c9adc5dea00000']);
 for(const user of USERS) await tx('real_ERC20_share_transfer:'+user,DEPLOYER,VAULT,vi,'transfer',[user,1000000000000000000n]);
 // Four supported old manager requests; pending class is added AFTER release so it cannot use the same release epoch.
 for(const user of USERS.slice(1))await tx('real_oldWM_requestShares:'+user,user,OLD,wi,'requestShares',[500000000000000000n]);
 const readReleased=await call('released_candidate_before',OLD,wi,'requestInfo',[USERS[1]]);
 const shareRelease=readReleased.success?BigInt(readReleased.result[0]):0n;
 const controller=await call('actual_configured_old_WM_controller',OLD,wi,'controller');
 const expectedController=controller.success?controller.result[0]:null;
 if(expectedController&&ethers.isAddress(expectedController)){
   const controllerCode=await p.getCode(expectedController);
   state.oldWMConfiguredController={address:expectedController,codehash:ethers.keccak256(controllerCode)};
   state.events.push({kind:'AUTHENTIC_CONTROLLER_CONTEXT_LIMIT',detail:'The releaseFor probe uses Anvil contract-address impersonation for the exact configured controller identity. This establishes the manager authorization and release semantics, NOT existence of an exposed externally reachable controller method.'});save();
   await p.send('anvil_setBalance',[expectedController,'0x3635c9adc5dea00000']);
 }
 await p.send('evm_increaseTime',[2]);await p.send('evm_mine',[]);
 if(shareRelease>0n && expectedController && ethers.isAddress(expectedController)){
   await tx('authorized_real_WM_releaseFor_released_class',expectedController,OLD,wi,'releaseFor',[USERS[1],(await p.getBlock('latest')).timestamp-1,shareRelease]);
   await tx('authorized_real_WM_releaseFor_healthy_control',expectedController,OLD,wi,'releaseFor',[USERS[3],(await p.getBlock('latest')).timestamp-1,shareRelease]);
 }
 const oldReleasePost=await call('released_candidate_after',OLD,wi,'requestInfo',[USERS[1]]);
 // Old released-but-unredeemed class is preserved (user1). Separate pre-cutover healthy control user3 redeems tiny amount.
 const preControl=await call('healthy_old_control_requestInfo',OLD,wi,'requestInfo',[USERS[3]]);
 if(preControl.success&&preControl.result[2]===true){
   const amount=1n;
   await tx('healthy_old_pre_cutover_redeem',USERS[3],VAULT,vi,'redeemFromRequest',[amount,USERS[3],USERS[3]],5000000n);
 }
 await tx('pending_after_release_oldWM_request',USERS[0],OLD,wi,'requestShares',[500000000000000000n]);
 const postPending=await call('pending_after_epoch',OLD,wi,'requestInfo',[USERS[0]]);
 state.classSetup={releasedOwner:USERS[1],pendingOwner:USERS[0],feeOwner:USERS[2],healthyOwner:USERS[3],shareRelease,releasedFlag:oldReleasePost.result?.[2],pendingFlag:postPending.result?.[2]};
 await snapshot('before_real_cutover');save();
}
async function after(){
 state.cutoverAttempted=true;
 await snapshot('after_real_cutover');
 const deploymentFile=path.join(ROOT,'deployments','katana-phase2.json');
 const cfg=JSON.parse(fs.readFileSync(deploymentFile,'utf8'));
 const newWm=cfg.withdrawManagerV2;if(!newWm||!ethers.isAddress(newWm))throw Error('missing generated actual newWM');
 state.newWithdrawManager=newWm;state.newWMCodeHash=ethers.keccak256(await p.getCode(newWm));save();
 const pointer=await p.getStorage(VAULT,'0x465d2ff0062318fe6f4c7e9ac78cfcd70bc86a1d992722875ef83a9770513100');
 state.afterPointerRaw=pointer;save();
 const newAbi=new ethers.Interface(['function requestShares(uint256)','function requestInfo(address) view returns(uint256,uint256,bool,uint256,uint256)','function activeRequestedShares() view returns(uint256)','function getSharesToRelease() view returns(uint256)']);
 for(const user of USERS){
    await call('post_old_record:'+user,OLD,wi,'requestInfo',[user]);
    await call('post_new_record:'+user,newWm,newAbi,'requestInfo',[user]);
 }
 await call('post_new_requests_total',newWm,newAbi,'activeRequestedShares');
 await call('post_old_WM_alpha',ACCESS,ai,'hasRole',[200,OLD]);
 await call('post_new_WM_alpha',ACCESS,ai,'hasRole',[200,newWm]);
 const releasedOwner=USERS[1];
 const beforeBal=await call('released_owner_balance_pre_attempt',VAULT,vi,'balanceOf',[releasedOwner]);
 // Same legal redeemFromRequest ABI as pre-cutover, exercised on new routed manager with test-owned legitimate claimant.
 const failed=await tx('post_cutover_old_released_claimant_redeem',releasedOwner,VAULT,vi,'redeemFromRequest',[500000000000000n,releasedOwner,releasedOwner],5000000n);
 const afterBal=await call('released_owner_balance_after_attempt',VAULT,vi,'balanceOf',[releasedOwner]);
 state.oldClaimRedeem={caller:releasedOwner,beforeBal:beforeBal.result?.[0],afterBal:afterBal.result?.[0],success:failed.success,txHash:failed.txHash};
 await tx('post_cutover_fresh_newWM_request',USERS[3],newWm,newAbi,'requestShares',[1000000000000000n]);
 await call('post_new_requests_total_after',newWm,newAbi,'activeRequestedShares');
 await snapshot('after_legitimate_completion_attempts');
 const block=await p.getBlock('latest');
 state.finishedAtForkBlock=block.number;state.finishedBlockHash=block.hash;save();
}
module.exports={before,after};
