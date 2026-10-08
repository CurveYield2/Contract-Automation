import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import net from 'node:net';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { JsonRpcProvider, ContractFactory, Interface, MaxUint256, ZeroAddress,
  keccak256, solidityPacked, TypedDataEncoder, encodeBytes32String, concat } from 'ethers';

const exec = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const fixtureFile = path.join(here, 'fixtures/boosthub/current-source.json');
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const DAY = 86400;
const checkpointSelector = '0x4b820093'; // independently replaced below from ABI

test('Unchanged BoostHub v9 / interface v4 / helper v6 functional verification',
  { skip: process.env.GITHUB_ACTIONS !== 'true', timeout: 900000 }, async t => {
  // Runtime compilation/dependency installation is deliberately GitHub-only.
  const evidence = { version: 1, sourceBindings: [], supportDeclarations: [],
    compiler: null, compileProfiles: [], checks: [], liveStakeDaoTested: false };
  const out = path.resolve('.audit-evidence/v7-infrastructure-qualification/boosthub-functional');
  await fs.mkdir(out, {recursive:true});
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(),'boosthub-functional-'));
  let processHandle, provider;
  const coveredHub = new Set(), coveredHelper = new Set();
  try {
    const fixture = JSON.parse(await fs.readFile(fixtureFile,'utf8'));
    evidence.sourceBindings = fixture.bindings;
    evidence.supportDeclarations = fixture.reconstructed_support;
    for (const b of fixture.bindings) assert.equal(sha(fixture.sources[b.source].content),b.sha256,b.source);
    const childEnv = {PATH:process.env.PATH,HOME:process.env.HOME,CI:'true'};
    await exec('npm',['install','--prefix',tmp,'--ignore-scripts','--no-audit','--no-fund',
      'solc@0.8.28','@openzeppelin/contracts@5.0.0'],{env:childEnv,timeout:240000,maxBuffer:4*1024*1024});
    const require = createRequire(path.join(tmp,'package.json'));
    const solc = require('solc');
    evidence.compiler = solc.version();
    assert.match(evidence.compiler,/^0\.8\.28\+/);
    const imported = {};
    const importCallback = name => {
      if(!name.startsWith('@openzeppelin/contracts/')) return {error:'Undeclared import '+name};
      try { const s=require('node:fs').readFileSync(path.join(tmp,'node_modules',name),'utf8'); imported[name]=sha(s); return {contents:s}; }
      catch {return {error:'Unavailable import '+name};}
    };
    function compile(viaIR) {
      const settings={optimizer:{enabled:true,runs:1000},viaIR,evmVersion:'paris',outputSelection:{'*':{'*':['abi','evm.bytecode.object','evm.deployedBytecode.object']}}};
      const output=JSON.parse(solc.compile(JSON.stringify({language:'Solidity',sources:fixture.sources,settings}),{import:importCallback}));
      const errors=(output.errors??[]).filter(x=>x.severity==='error');
      evidence.compileProfiles.push({settings,status:errors.length?'FAIL':'PASS',errors:errors.map(x=>x.formattedMessage)});
      return {output,errors};
    }
    const legacy=compile(false);
    const ir=compile(true);
    evidence.importHashes=imported;
    assert.equal(ir.errors.length,0,JSON.stringify(ir.errors));
    const built=ir.output.contracts;
    const artifact=(source,name)=>built[source][name];
    const hubArtifact=artifact('BoostHub.sol','BoostHub');
    const helperArtifact=artifact('StakeDaoMerkleClaimExecutor.sol','StakeDaoMerkleClaimExecutor');
    evidence.runtimeBytes={BoostHub:hubArtifact.evm.deployedBytecode.object.length/2,helper:helperArtifact.evm.deployedBytecode.object.length/2};
    assert.ok(evidence.runtimeBytes.BoostHub<=24576,'EIP-170 BoostHub');
    assert.ok(evidence.runtimeBytes.helper<=24576,'EIP-170 helper');
    await fs.writeFile(path.join(out,'compiled-abi.json'),JSON.stringify({hub:hubArtifact.abi,helper:helperArtifact.abi},null,2));
    await fs.writeFile(path.join(out,'compiler-evidence.json'),JSON.stringify({profiles:evidence.compileProfiles,imports:imported,sizes:evidence.runtimeBytes},null,2));
    const port = await new Promise((resolve,reject)=>{const s=net.createServer();s.on('error',reject);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
    processHandle=spawn('anvil',['--port',String(port),'--hardfork','paris','--silent'],{env:childEnv,stdio:['ignore','pipe','pipe']});
    let anvilLogs='';processHandle.stdout.on('data',b=>anvilLogs+=b);processHandle.stderr.on('data',b=>anvilLogs+=b);
    provider=new JsonRpcProvider(`http://127.0.0.1:${port}`,undefined,{cacheTimeout:-1});
    provider.pollingInterval=40;
    for(let i=0;i<150;i++) { try {await provider.getBlockNumber();break;} catch {if(processHandle.exitCode!==null) throw Error('Anvil exited: '+anvilLogs); await new Promise(r=>setTimeout(r,100));} }
    const owner=await provider.getSigner(0), alice=await provider.getSigner(1), bob=await provider.getSigner(2), carol=await provider.getSigner(3), treasury=await provider.getSigner(4), outsider=await provider.getSigner(5);
    const A=await alice.getAddress(),B=await bob.getAddress(),C=await carol.getAddress(),O=await owner.getAddress(),T=await treasury.getAddress();
    const tx=async p=>{const x=await p;return x.wait();};
    const deploy=async (source,name,args=[])=>{const a=artifact(source,name); const c=await new ContractFactory(a.abi,a.evm.bytecode.object,owner).deploy(...args);await c.waitForDeployment();return c;};
    const recorder=await deploy('Mocks.sol','OrderRecorder');
    const boost=await deploy('Mocks.sol','TestBoost',[recorder.target]);
    const stash=await deploy('Mocks.sol','TestStash');
    const helper=await deploy('StakeDaoMerkleClaimExecutor.sol','StakeDaoMerkleClaimExecutor',[O,stash.target]);
    const hub=await deploy('BoostHub.sol','BoostHub',[O,boost.target,helper.target]);
    await tx(helper.setBoostHub(hub.target));
    const asset=await deploy('Mocks.sol','TestToken'),r1=await deploy('Mocks.sol','TestToken'),r2=await deploy('Mocks.sol','TestToken');
    const gauge=await deploy('Mocks.sol','TestGauge',[asset.target,recorder.target]);
    await tx(gauge.addReward(asset.target));await tx(gauge.addReward(r1.target));await tx(gauge.addReward(r2.target));
    await tx(hub.addPoolsBatch([asset.target],[gauge.target],[[asset.target,r1.target,r2.target]]));
    const selector=new Interface(artifact('Mocks.sol','TestGauge').abi).getFunction('user_checkpoint').selector;
    async function configure(depositor=A,{locked=false,active=true,bps=0,recipient=T,pid=0,cp=selector}={}) {
      await tx(hub.setDepositors([pid],[depositor],[locked],[cp],[[bps,recipient]],[active]));
    }
    await configure();await tx(hub.executeTransactions());
    for(const s of [alice,bob,carol]) {await tx(asset.mint(await s.getAddress(),10n**24n));await tx(asset.connect(s).approve(hub.target,MaxUint256));}
    const base=await provider.send('evm_snapshot',[]);
    let snapshot=base;
    async function run(name, hubFunctions, helperFunctions, fn, defect=false) {
      await t.test(name,async()=>{
        await provider.send('evm_revert',[snapshot]);snapshot=await provider.send('evm_snapshot',[]);
        try {const detail=await fn();for(const f of hubFunctions)coveredHub.add(f);for(const f of helperFunctions)coveredHelper.add(f);
          evidence.checks.push({name,status:defect?'CONFIRMED_DEFECT':'PASS',detail:detail??null});
        } catch(e) {evidence.checks.push({name,status:'FAIL',error:e.shortMessage??e.message});throw e;}
      });
    }
    const revert=async fn=>assert.rejects(async()=>tx(fn()));
    async function at(time) {await provider.send('evm_setNextBlockTimestamp',[time]);await provider.send('evm_mine',[]);}
    async function seed(token,amount) {await tx(gauge.reward(hub.target,token.target,amount));}
    async function deposit(amount=10000n,s=alice) {await tx(hub.connect(s).deposit(0,amount));}
    async function publish(token,amount,index=0,proof=[]) {
      const leaf=keccak256(solidityPacked(['uint256','address','uint256'],[index,hub.target,amount]));
      let root=leaf;for(const x of proof)root=keccak256(concat(BigInt(root)<=BigInt(x)?[root,x]:[x,root]));
      await tx(stash.publish(token.target,root,amount));return {leaf,root,index,amount,proof};
    }
    async function supply(token,amount,index=0,s=owner,proof=[]) {await publish(token,amount,index,proof);await tx(helper.connect(s).supplyClaim(0,token.target,index,amount,proof));}

    await run('Constructors reject every required zero address',[],[],async()=>{
      for(const args of [[ZeroAddress,boost.target,helper.target],[O,ZeroAddress,helper.target],[O,boost.target,ZeroAddress]]) await assert.rejects(()=>deploy('BoostHub.sol','BoostHub',args));
      for(const args of [[ZeroAddress,stash.target],[O,ZeroAddress]]) await assert.rejects(()=>deploy('StakeDaoMerkleClaimExecutor.sol','StakeDaoMerkleClaimExecutor',args));
    });
    await run('Consolidated pool, position and system reads preserve aligned fields',['poolInfo','positionInfo','systemInfo','owner'],[],async()=>{
      const p=await hub.poolInfo(0),s=await hub.systemInfo(),v=await hub.positionInfo(0,A);
      assert.equal(p.asset,asset.target);assert.equal(p.gauge,gauge.target);assert.equal(p.active,true);assert.equal(p.feeConfigSet,true);assert.equal(p.depositor,A);assert.equal(p.depositorLocked,false);assert.equal(p.accRewardPerShare.length,3);
      assert.equal(v.principal,0n);assert.equal(v.approved,true);assert.equal(v.rewardTokens.length,3);assert.equal(v.pendingRewards.length,3);
      assert.equal(s.vlBoost,boost.target);assert.equal(s.stakeDaoClaimExecutor,helper.target);assert.equal(s.poolCount,1n);assert.equal(s.configChangeDelay,10n*BigInt(DAY));assert.equal(s.vlsdtDelegated,12345n);assert.equal(await hub.owner(),O);
      await tx(boost.faults(true,false));assert.equal((await hub.systemInfo()).vlsdtDelegated,0n);
      await assert.rejects(()=>hub.poolInfo(1));await assert.rejects(()=>hub.positionInfo(1,A));
    });
    await run('Pool batch checks lengths, gauge assets, uniqueness, token limits and rollback',['addPoolsBatch'],[],async()=>{
      await revert(()=>hub.addPoolsBatch([asset.target],[],[]));
      await revert(()=>hub.addPoolsBatch([asset.target],[gauge.target],[[]]));
      await revert(()=>hub.addPoolsBatch([ZeroAddress],[gauge.target],[[]]));
      const g=await deploy('Mocks.sol','TestGauge',[asset.target,recorder.target]);
      await revert(()=>hub.addPoolsBatch([r1.target],[g.target],[[]]));
      await revert(()=>hub.addPoolsBatch([asset.target],[g.target],[[r1.target,r1.target]]));
      await revert(()=>hub.addPoolsBatch([asset.target],[g.target],[[ZeroAddress]]));
      await revert(()=>hub.addPoolsBatch([asset.target],[g.target],[Array(9).fill(r1.target)]));
      await revert(()=>hub.addPoolsBatch([asset.target,asset.target],[g.target,g.target],[[],[]]));
      assert.equal((await hub.systemInfo()).poolCount,1n);await tx(hub.addPoolsBatch([],[],[]));
      await tx(hub.addPoolsBatch([asset.target],[g.target],[[r1.target]]));assert.equal((await hub.systemInfo()).poolCount,2n);
    });
    await run('Owner-only write access is enforced',['setDepositors','clearTransactions','transferOwnership','emergencyWithdrawYieldBoostingTokens','claimStakeDaoRewards','delegateVotingPowerBatch','approveSnapshotVoteUint32','renounceOwnership'],[],async()=>{
      const u=hub.connect(outsider);
      await revert(()=>u.setDepositors([0],[A],[false],[selector],[[0,T]],[true]));
      await revert(()=>u.clearTransactions());await revert(()=>u.transferOwnership(B));await revert(()=>u.renounceOwnership());
      await revert(()=>u.emergencyWithdrawYieldBoostingTokens(0,1,T));await revert(()=>u.claimStakeDaoRewards(0));
      await revert(()=>u.addPoolsBatch([],[],[]));await revert(()=>u.delegateVotingPowerBatch(T,['new.eth'],B));
      await revert(()=>u.approveSnapshotVoteUint32('from','new.eth',1,'proposal',1,'reason','app','{}'));
    });
    await run('Depositor batch validates all parallel input lengths and rolls back',['setDepositors'],[],async()=>{
      const args=[[0],[A],[false],[selector],[[0,T]],[true]];
      for(let i=1;i<args.length;i++){const a=args.map(x=>[...x]);a[i]=[];await revert(()=>hub.setDepositors(...a));}
      await revert(()=>hub.setDepositors([1],[A],[false],[selector],[[0,T]],[true]));await revert(()=>configure(ZeroAddress));
      await revert(()=>hub.setDepositors([0,0],[B,ZeroAddress],[false,false],[selector,selector],[[0,T],[0,T]],[true,true]));assert.equal((await hub.poolInfo(0)).depositor,A);
    });
    await run('Permanent depositor lock permits fee updates but forbids replacement and deactivation',['setDepositors','executeTransactions'],[],async()=>{
      await configure(A,{locked:true});await tx(hub.executeTransactions());await configure(A,{bps:2000,locked:false});await tx(hub.executeTransactions());
      assert.equal((await hub.poolInfo(0)).depositorLocked,true);assert.equal((await hub.poolInfo(0)).platformFeeBps,2000n);
      await revert(()=>configure(B));await revert(()=>configure(A,{active:false}));
    });
    await run('Unlocked disable/re-enable preserves principal exits and claims',['setDepositors','deposit','withdraw','claim'],[],async()=>{
      await deposit();await seed(r1,500n);await tx(hub.harvest(0));await configure(A,{active:false});
      await revert(()=>deposit(1n));await tx(hub.connect(alice).withdraw(0,10000));await tx(hub.connect(alice).claim(0,[r1.target],A));assert.equal(await r1.balanceOf(A),500n);
      await configure(A,{active:true});await tx(hub.executeTransactions());await deposit(1n);
      await revert(()=>configure(A,{locked:true,active:false}));assert.equal((await hub.poolInfo(0)).depositorLocked,false);
    });
    await run('Fee cap is 20 percent; nonzero fees require recipient; zero fees accept zero recipient',['setDepositors','executeTransactions'],[],async()=>{
      await revert(()=>configure(A,{bps:2001}));await revert(()=>configure(A,{bps:1,recipient:ZeroAddress}));
      await configure(A,{bps:0,recipient:ZeroAddress});await tx(hub.executeTransactions());assert.equal((await hub.poolInfo(0)).platformFeeBps,0n);
    });
    await run('Seven-day bootstrap boundary and ten-day timelock are exact',['setDepositors','pendingTransactions','executeTransactions'],[],async()=>{
      const start=Number((await hub.systemInfo()).deployedAt);await at(start+7*DAY-10);await configure(A,{bps:100});
      let q=await hub.pendingTransactions();assert.ok(Number(q.feeChanges[0].readyAt)<start+7*DAY);await tx(hub.executeTransactions());assert.equal((await hub.poolInfo(0)).platformFeeBps,100n);
      await at(start+7*DAY);await configure(A,{bps:200});q=await hub.pendingTransactions();const queuedBlock=await provider.getBlock('latest');assert.equal(Number(q.feeChanges[0].readyAt),queuedBlock.timestamp+10*DAY);
      await tx(hub.executeTransactions());assert.equal((await hub.poolInfo(0)).platformFeeBps,100n);
      await at(Number(q.feeChanges[0].readyAt)-1);assert.equal((await hub.poolInfo(0)).platformFeeBps,100n);
      await at(Number(q.feeChanges[0].readyAt));await tx(hub.executeTransactions());assert.equal((await hub.poolInfo(0)).platformFeeBps,200n);
    });
    await run('Batch execution executes ready actions and retains immature actions',['executeTransactions','pendingTransactions','emergencyWithdrawYieldBoostingTokens'],[],async()=>{
      const start=Number((await hub.systemInfo()).deployedAt);await at(start+8*DAY);await configure(A,{bps:500});const f=Number((await hub.pendingTransactions()).feeChanges[0].readyAt);
      await at(start+9*DAY);await tx(asset.mint(hub.target,30));await tx(hub.emergencyWithdrawYieldBoostingTokens(0,30,T));const w=Number((await hub.pendingTransactions()).withdrawals[0].readyAt);
      await at(f);await tx(hub.executeTransactions());assert.equal((await hub.poolInfo(0)).platformFeeBps,500n);assert.equal((await hub.pendingTransactions()).withdrawals.length,1);assert.equal(await asset.balanceOf(T),0n);
      await at(w);await tx(hub.executeTransactions());assert.equal(await asset.balanceOf(T),30n);assert.equal((await hub.pendingTransactions()).withdrawals.length,0);
    });
    await run('Clear removes both ready and immature actions of all types',['clearTransactions','pendingTransactions','transferOwnership'],[],async()=>{
      const start=Number((await hub.systemInfo()).deployedAt);await configure(A,{bps:1});await at(start+8*DAY);await tx(hub.transferOwnership(B));await tx(hub.emergencyWithdrawYieldBoostingTokens(0,1,T));
      let q=await hub.pendingTransactions();assert.equal(q.feeChanges.length,1);assert.equal(q.withdrawals.length,1);assert.equal(q.pendingOwner,B);
      await tx(hub.clearTransactions());q=await hub.pendingTransactions();assert.equal(q.feeChanges.length,0);assert.equal(q.withdrawals.length,0);assert.equal(q.pendingOwner,ZeroAddress);assert.equal(q.ownershipTransferReadyAt,0n);
    });
    await run('Ownership acceptance uses pending owner and zero target cancels transfer',['transferOwnership','executeTransactions','owner'],[],async()=>{
      await tx(hub.transferOwnership(B));await revert(()=>hub.executeTransactions());await tx(hub.connect(bob).executeTransactions());assert.equal(await hub.owner(),B);
      await tx(hub.connect(bob).transferOwnership(C));await tx(hub.connect(bob).transferOwnership(ZeroAddress));assert.equal((await hub.pendingTransactions()).pendingOwner,ZeroAddress);assert.equal(await hub.owner(),B);
    });
    await run('Ready action failure atomically preserves ownership and queued fees',['executeTransactions','pendingTransactions'],[],async()=>{
      await configure(A,{bps:100});await tx(hub.emergencyWithdrawYieldBoostingTokens(0,1,T));await tx(hub.transferOwnership(B));
      await revert(()=>hub.connect(bob).executeTransactions());assert.equal(await hub.owner(),O);assert.equal((await hub.poolInfo(0)).platformFeeBps,0n);
      const q=await hub.pendingTransactions();assert.equal(q.pendingOwner,B);assert.equal(q.feeChanges.length,1);assert.equal(q.withdrawals.length,1);
    });
    await run('Inherited renounce immediately removes owner and pending ownership',['renounceOwnership','owner'],[],async()=>{
      await tx(hub.transferOwnership(B));await tx(hub.renounceOwnership());assert.equal(await hub.owner(),ZeroAddress);assert.equal((await hub.pendingTransactions()).pendingOwner,ZeroAddress);
    });
    await run('Deposit/withdraw accounting, authorization, zero amounts and overwithdrawal',['deposit','withdraw','positionInfo','poolInfo'],[],async()=>{
      await revert(()=>hub.connect(bob).deposit(0,1));await revert(()=>hub.connect(alice).deposit(0,0));await revert(()=>hub.connect(alice).withdraw(0,0));await revert(()=>hub.connect(alice).deposit(2,1));
      await deposit();assert.equal((await hub.positionInfo(0,A)).principal,10000n);assert.equal((await hub.poolInfo(0)).totalStaked,10000n);assert.equal(await gauge.balances(hub.target),10000n);
      await revert(()=>hub.connect(alice).withdraw(0,10001));await tx(hub.connect(alice).withdraw(0,4000));assert.equal((await hub.positionInfo(0,A)).principal,6000n);assert.equal(await gauge.balances(hub.target),6000n);
    });
    await run('Gauge/token transfer failures roll back deposits and withdrawals',['deposit','withdraw'],[],async()=>{
      await tx(asset.faults(false,false,true));await revert(()=>deposit());assert.equal((await hub.positionInfo(0,A)).principal,0n);await tx(asset.faults(false,false,false));
      await tx(gauge.faults(true,false,false,true));await revert(()=>deposit());await tx(gauge.faults(false,false,false,true));await deposit();
      await tx(gauge.faults(false,true,false,true));await revert(()=>hub.connect(alice).withdraw(0,100));assert.equal((await hub.positionInfo(0,A)).principal,10000n);
    });
    await run('Token callback cannot reenter guarded lifecycle functions',['deposit'],[],async()=>{
      await tx(asset.setCallback(hub.target,hub.interface.encodeFunctionData('harvest',[0])));await deposit();assert.equal(await asset.callbackRejected(),true);assert.equal((await hub.positionInfo(0,A)).principal,10000n);
    });
    await run('Harvest charges configured performance fee and 3 percent post-fee asset retention',['harvest','claim','yieldBoostingTokenBalances'],[],async()=>{
      await configure(A,{bps:2000});await tx(hub.executeTransactions());await deposit();await seed(asset,10000n);await seed(r1,10000n);const preview=await hub.harvest.staticCall(0);assert.equal(preview[1][0],7760n);assert.equal(preview[1][1],8000n);
      await tx(hub.harvest(0));assert.equal(await asset.balanceOf(T),2000n);assert.equal(await r1.balanceOf(T),2000n);assert.equal((await hub.poolInfo(0)).retainedStakingToken,240n);assert.equal(await gauge.balances(hub.target),10240n);
      const y=await hub.yieldBoostingTokenBalances();assert.deepEqual([...y[1]],[240n]);await tx(hub.connect(alice).claim(0,[r1.target],A));assert.equal(await r1.balanceOf(A),8000n);
    });
    await run('Empty harvest and new gauge rewards preserve token/index alignment',['harvest','poolInfo'],[],async()=>{
      const empty=await hub.harvest.staticCall(0);assert.equal(empty[0].length,3);assert.deepEqual([...empty[1]],[0n,0n,0n]);
      const extra=await deploy('Mocks.sol','TestToken');await tx(gauge.addReward(extra.target));await deposit();await seed(extra,50n);await tx(hub.harvest(0));const p=await hub.poolInfo(0);assert.equal(p.rewardTokens.length,4);assert.equal(p.accRewardPerShare.length,4);assert.equal(p.rewardTokens[3],extra.target);
    });
    await run('Selected-token claims skip omitted bad tokens and preserve omitted rewards',['claim','positionInfo'],[],async()=>{
      await deposit();await seed(r1,100n);await seed(r2,200n);await tx(hub.harvest(0));await tx(r2.faults(true,true,true));
      await tx(hub.connect(alice).claim(0,[r1.target],A));assert.equal(await r1.balanceOf(A),100n);assert.equal((await hub.positionInfo(0,A)).pendingRewards[2],200n);
      await revert(()=>hub.connect(alice).claim(0,[r2.target],A));await tx(r2.faults(false,false,false));await tx(hub.connect(alice).claim(0,[r2.target],A));assert.equal(await r2.balanceOf(A),200n);
    });
    await run('Claims reject unregistered tokens, unauthorized caller and zero receiver; duplicates pay once',['claim'],[],async()=>{
      await deposit();await seed(r1,60n);await tx(hub.harvest(0));await revert(()=>hub.connect(bob).claim(0,[r1.target],B));await revert(()=>hub.connect(alice).claim(0,[r1.target],ZeroAddress));await revert(()=>hub.connect(alice).claim(0,[T],A));
      const v=await hub.connect(alice).claim.staticCall(0,[r1.target,r1.target],A);assert.deepEqual([...v[1]],[60n,0n]);await tx(hub.connect(alice).claim(0,[r1.target,r1.target],A));assert.equal(await r1.balanceOf(A),60n);await tx(hub.connect(alice).claim(0,[],A));
    });
    await run('Previous depositor can withdraw principal and previously accrued rewards',['setDepositors','withdraw','claim','positionInfo'],[],async()=>{
      await deposit();await seed(r1,100n);await tx(hub.harvest(0));await configure(B);await tx(hub.executeTransactions());await deposit(10000n,bob);assert.equal((await hub.positionInfo(0,A)).approved,false);
      await tx(hub.connect(alice).withdraw(0,10000));await tx(hub.connect(alice).claim(0,[r1.target],A));assert.equal(await r1.balanceOf(A),100n);
    });
    await run('Direct transfers are retained stake, earn for users and remain admin-withdrawable',['deposit','withdraw','claim','emergencyWithdrawYieldBoostingTokens','yieldBoostingTokenBalances'],[],async()=>{
      await tx(asset.mint(hub.target,500));await deposit();assert.equal((await hub.poolInfo(0)).retainedStakingToken,500n);assert.equal((await hub.positionInfo(0,A)).principal,10000n);assert.equal(await gauge.balances(hub.target),10500n);
      await seed(r1,100n);await tx(hub.harvest(0));await tx(hub.connect(alice).claim(0,[r1.target],A));assert.equal(await r1.balanceOf(A),100n);
      await tx(asset.mint(hub.target,200));await tx(hub.connect(alice).withdraw(0,10000));assert.equal((await hub.poolInfo(0)).retainedStakingToken,700n);assert.equal(await gauge.balances(hub.target),700n);
      await tx(hub.emergencyWithdrawYieldBoostingTokens(0,700,T));await tx(hub.executeTransactions());assert.equal(await asset.balanceOf(T),700n);assert.equal((await hub.poolInfo(0)).retainedStakingToken,0n);
    });
    await run('Asset reward reserves are protected from automatic staking and emergency withdrawal',['claim','emergencyWithdrawYieldBoostingTokens','executeTransactions','yieldBoostingTokenBalances'],[],async()=>{
      await deposit();await seed(asset,1000n);await tx(hub.harvest(0));assert.equal((await hub.positionInfo(0,A)).pendingRewards[0],970n);assert.equal((await hub.poolInfo(0)).retainedStakingToken,30n);
      await tx(hub.connect(alice).claim(0,[],A));assert.equal(await asset.balanceOf(hub.target),970n);assert.equal((await hub.yieldBoostingTokenBalances())[1][0],30n);
      await tx(hub.emergencyWithdrawYieldBoostingTokens(0,31,T));await revert(()=>hub.executeTransactions());await tx(hub.clearTransactions());await tx(hub.emergencyWithdrawYieldBoostingTokens(0,30,T));await tx(hub.executeTransactions());assert.equal(await asset.balanceOf(hub.target),970n);await tx(hub.connect(alice).claim(0,[asset.target],A));
    });
    await run('Donation sweep failure preserves the user claim and retries later',['claim','yieldBoostingTokenBalances'],[],async()=>{
      await deposit();await seed(r1,100n);await tx(hub.harvest(0));await tx(asset.mint(hub.target,100));await tx(gauge.faults(true,false,false,true));
      await tx(hub.connect(alice).claim(0,[r1.target],A));assert.equal(await r1.balanceOf(A),100n);assert.equal((await hub.poolInfo(0)).retainedStakingToken,0n);assert.equal((await hub.yieldBoostingTokenBalances())[1][0],100n);
      await tx(gauge.faults(false,false,false,true));await tx(hub.connect(alice).claim(0,[],A));assert.equal((await hub.poolInfo(0)).retainedStakingToken,100n);
    });
    await run('Shared-asset aggregation counts wallet surplus once and sums both gauges',['yieldBoostingTokenBalances','claim'],[],async()=>{
      const g=await deploy('Mocks.sol','TestGauge',[asset.target,recorder.target]);await tx(hub.addPoolsBatch([asset.target],[g.target],[[]]));await configure(B,{pid:1});await tx(hub.executeTransactions());await tx(asset.mint(hub.target,400));
      assert.deepEqual([...(await hub.yieldBoostingTokenBalances())[1]],[400n]);await tx(hub.connect(alice).claim(0,[],A));assert.equal((await hub.poolInfo(0)).retainedStakingToken,400n);assert.equal((await hub.poolInfo(1)).retainedStakingToken,0n);
    });
    await run('Merged checkpoint is permissionless, boost-first, selected-pool scoped and atomic',['checkpoint'],[],async()=>{
      await tx(hub.connect(bob).checkpoint([]));assert.equal(await boost.checkpoints(),1n);assert.equal(await gauge.checkpoints(),0n);
      await tx(hub.connect(bob).checkpoint([0]));assert.equal(await boost.checkpoints(),2n);assert.equal(await gauge.checkpoints(),1n);assert.ok((await recorder.sequence(boost.target))<(await recorder.sequence(gauge.target)));
      await tx(gauge.faults(false,false,false,false));await revert(()=>hub.checkpoint([0]));assert.equal(await boost.checkpoints(),2n);assert.equal(await gauge.checkpoints(),1n);await revert(()=>hub.checkpoint([1]));
      const alt=new Interface(artifact('Mocks.sol','TestGauge').abi).getFunction('alternateCheckpoint').selector;await configure(A,{cp:alt});await tx(hub.checkpoint([0]));
      await tx(boost.faults(false,true));await revert(()=>hub.checkpoint([]));
    });
    await run('Delegation accepts unlisted spaces and validates caller, registry, delegate and batch',['delegateVotingPowerBatch'],[],async()=>{
      const registry=await deploy('Mocks.sol','TestDelegateRegistry');await tx(hub.delegateVotingPowerBatch(registry.target,['newspace.eth','other.eth'],B));
      assert.equal(await registry.delegates(hub.target,encodeBytes32String('newspace.eth')),B);await revert(()=>hub.delegateVotingPowerBatch(registry.target,[],B));await revert(()=>hub.delegateVotingPowerBatch(ZeroAddress,['s'],B));await revert(()=>hub.delegateVotingPowerBatch(registry.target,['s'],ZeroAddress));
    });
    await run('Snapshot Uint32 approval matches independent EIP-712 encoding and ERC-1271',['approveSnapshotVoteUint32','isValidSignature'],[],async()=>{
      const value={from:hub.target.toLowerCase(),space:'unlistedspace.eth',timestamp:123,proposal:'proposal',choice:2,reason:'reason',app:'snapshot',metadata:'{}'};
      const types={Vote:[{name:'from',type:'string'},{name:'space',type:'string'},{name:'timestamp',type:'uint64'},{name:'proposal',type:'string'},{name:'choice',type:'uint32'},{name:'reason',type:'string'},{name:'app',type:'string'},{name:'metadata',type:'string'}]};
      const hash=TypedDataEncoder.hash({name:'snapshot',version:'0.1.4'},types,value);assert.equal(await hub.isValidSignature(hash,'0x'),'0xffffffff');
      const args=[value.from,value.space,value.timestamp,value.proposal,value.choice,value.reason,value.app,value.metadata];assert.equal(await hub.approveSnapshotVoteUint32.staticCall(...args),hash);await tx(hub.approveSnapshotVoteUint32(...args));assert.equal(await hub.isValidSignature(hash,'0xabcd'),'0x1626ba7e');
    });
    await run('Helper binding is configurator-only, nonzero and one-time',['systemInfo'],['setBoostHub','boostHub','configurator','merkleStash','VERSION'],async()=>{
      assert.equal(await helper.boostHub(),hub.target);assert.equal(await helper.configurator(),O);assert.equal(await helper.merkleStash(),stash.target);assert.equal(await helper.VERSION(),6n);
      await revert(()=>helper.setBoostHub(hub.target));await revert(()=>helper.setBoostHub(B));const fresh=await deploy('StakeDaoMerkleClaimExecutor.sol','StakeDaoMerkleClaimExecutor',[O,stash.target]);
      await revert(()=>fresh.connect(alice).setBoostHub(hub.target));await revert(()=>fresh.setBoostHub(ZeroAddress));await revert(()=>fresh.supplyClaim(0,r1.target,0,1,[]));await tx(fresh.setBoostHub(hub.target));
    });
    await run('Helper first proof requires owner; later suppliers cannot change token PID',['addPoolsBatch'],['supplyClaim','targetPid','targetCount','targetAt'],async()=>{
      const p=await publish(r1,100n);await revert(()=>helper.connect(alice).supplyClaim(0,r1.target,0,100,[]));await tx(helper.supplyClaim(0,r1.target,0,100,[]));
      assert.deepEqual([...(await helper.targetPid(r1.target))],[0n,true]);assert.equal(await helper.targetCount(),1n);assert.deepEqual([...(await helper.targetAt(0))],[0n,r1.target]);await assert.rejects(()=>helper.targetAt(1));
      await tx(helper.connect(alice).supplyClaim(0,r1.target,0,100,[]));await revert(()=>helper.connect(alice).supplyClaim(1,r1.target,0,100,[]));
      await revert(()=>helper.supplyClaim(0,ZeroAddress,0,100,[]));await revert(()=>helper.supplyClaim(0,r2.target,0,0,[]));await revert(()=>helper.supplyClaim(0,T,0,100,[]));
    });
    await run('Merkle proof, recipient, amount, root, claimed-index validation and proof reads',[],['supplyClaim','getClaim'],async()=>{
      const sibling=keccak256('0x1234');await publish(r1,100n,7,[sibling]);await revert(()=>helper.supplyClaim(0,r1.target,7,101,[sibling]));await revert(()=>helper.supplyClaim(0,r1.target,7,100,[]));
      await tx(helper.supplyClaim(0,r1.target,7,100,[sibling]));const c=await helper.getClaim(r1.target);assert.equal(c[0].index,7n);assert.equal(c[0].amount,100n);assert.equal(c[0].exists,true);assert.deepEqual([...c[1]],[sibling]);
      await tx(stash.markClaimed(r1.target,7));await revert(()=>helper.supplyClaim(0,r1.target,7,100,[sibling]));await revert(()=>helper.supplyClaim(0,r2.target,0,100,[]));
    });
    await run('Pool-ID-only aggregate succeeds when one of three tokens has a proof',['claimStakeDaoRewards','claim','positionInfo'],['claimPool','pendingTokens','hasPendingClaims','getClaim','buildBoostHubClaimCalldata'],async()=>{
      await deposit();await supply(r1,123n);assert.deepEqual([...(await helper.pendingTokens(0))],[r1.target]);assert.equal(await helper.hasPendingClaims(0),true);
      assert.equal(await helper.buildBoostHubClaimCalldata(0),hub.interface.encodeFunctionData('claimStakeDaoRewards',[0]));await assert.rejects(()=>helper.buildBoostHubClaimCalldata(1));await revert(()=>helper.claimPool(0));
      const v=await hub.claimStakeDaoRewards.staticCall(0);assert.deepEqual([...v[1]],[0n,123n,0n]);await tx(hub.claimStakeDaoRewards(0));assert.equal(await helper.hasPendingClaims(0),false);assert.equal((await helper.getClaim(r1.target))[0].exists,false);assert.equal((await hub.positionInfo(0,A)).pendingRewards[1],123n);
      await tx(hub.connect(alice).claim(0,[r1.target],A));assert.equal(await r1.balanceOf(A),123n);await tx(hub.claimStakeDaoRewards(0));
    });
    await run('Aggregate succeeds with two proofs, future pool/token and no historical fixed registry',['claimStakeDaoRewards','addPoolsBatch','setDepositors'],['supplyClaim','claimPool'],async()=>{
      await deposit();await supply(r1,100n);await supply(r2,200n);await tx(hub.claimStakeDaoRewards(0));assert.equal((await hub.positionInfo(0,A)).pendingRewards[1],100n);assert.equal((await hub.positionInfo(0,A)).pendingRewards[2],200n);
      const tok=await deploy('Mocks.sol','TestToken'),g=await deploy('Mocks.sol','TestGauge',[asset.target,recorder.target]);await tx(hub.addPoolsBatch([asset.target],[g.target],[[tok.target]]));await configure(B,{pid:1});await tx(hub.executeTransactions());await tx(hub.connect(bob).deposit(1,10000));
      const root=keccak256(solidityPacked(['uint256','address','uint256'],[0,hub.target,100]));await tx(stash.publish(tok.target,root,100));await tx(helper.supplyClaim(1,tok.target,0,100,[]));await tx(hub.claimStakeDaoRewards(1));assert.equal((await hub.positionInfo(1,B)).pendingRewards[0],100n);
    });
    await run('Stash claim failure preserves failed proof and pays other token for later retry',['claimStakeDaoRewards'],['claimPool','getClaim','pendingTokens'],async()=>{
      await deposit();await supply(r1,100n);await supply(r2,200n);await tx(stash.setFailure(r1.target,true));await tx(hub.claimStakeDaoRewards(0));
      assert.equal((await helper.getClaim(r1.target))[0].exists,true);assert.equal((await helper.getClaim(r2.target))[0].exists,false);assert.equal((await hub.positionInfo(0,A)).pendingRewards[1],0n);assert.equal((await hub.positionInfo(0,A)).pendingRewards[2],200n);
      await tx(stash.setFailure(r1.target,false));await tx(hub.claimStakeDaoRewards(0));assert.equal((await helper.getClaim(r1.target))[0].exists,false);assert.equal((await hub.positionInfo(0,A)).pendingRewards[1],100n);
    });
    await run('Stale root/update and externally claimed indexes clear safely',['claimStakeDaoRewards'],['clearStaleClaim','claimPool','getClaim'],async()=>{
      await deposit();assert.equal(await helper.clearStaleClaim.staticCall(r1.target),false);await supply(r1,100n);assert.equal(await helper.clearStaleClaim.staticCall(r1.target),false);
      await publish(r1,200n);assert.equal(await helper.clearStaleClaim.staticCall(r1.target),true);await tx(helper.connect(alice).clearStaleClaim(r1.target));assert.equal((await helper.getClaim(r1.target))[0].exists,false);
      await supply(r1,100n,2);await tx(stash.markClaimed(r1.target,2));await tx(hub.claimStakeDaoRewards(0));assert.equal((await helper.getClaim(r1.target))[0].exists,false);
      await supply(r1,100n,3);await publish(r1,200n,3);await tx(hub.claimStakeDaoRewards(0));assert.equal((await helper.getClaim(r1.target))[0].exists,false);
    });
    await run('Aggregate zero-principal guard does not consume helper claim',['claimStakeDaoRewards'],['getClaim'],async()=>{
      await supply(r1,100n);await revert(()=>hub.claimStakeDaoRewards(0));assert.equal((await helper.getClaim(r1.target))[0].exists,true);
    });
    await run('CONFIRMED DEFECT: withdrawing all principal strands outstanding gauge rewards',['withdraw','harvest','deposit','claim'],[],async()=>{
      await deposit(100n);await seed(r1,100n);await tx(hub.connect(alice).withdraw(0,100));
      assert.equal((await hub.positionInfo(0,A)).pendingRewards[1],0n);await tx(hub.harvest(0));assert.equal(await gauge.claimable_reward(hub.target,r1.target),100n);
      await configure(B);await tx(hub.executeTransactions());await deposit(100n,bob);await tx(hub.harvest(0));assert.equal((await hub.positionInfo(0,B)).pendingRewards[1],100n);
      await revert(()=>hub.connect(alice).claim(0,[r1.target],A));return {outstandingReward:100,formerDepositorReward:0,nextDepositorReward:100};
    },true);
    await run('CONFIRMED DEFECT: reward-debt rounding can exceed funded reserves',['deposit','withdraw','harvest','claim','positionInfo'],[],async()=>{
      const steps=[['deposit',0,3],['reward',1],['deposit',1,5],['deposit',1,12],['deposit',0,11],['reward',1],['deposit',2,5],['reward',2],['withdraw',1,3],['deposit',2,2],['reward',1],['reward',1],['deposit',0,2],['reward',1],['withdraw',1,1],['withdraw',0,1],['reward',1]];
      const signers=[alice,bob,carol],addresses=[A,B,C];let funded=0n;
      for(const [op,i,x] of steps) {if(op==='reward'){await seed(r1,BigInt(i));await tx(hub.harvest(0));funded+=BigInt(i);}else if(op==='deposit'){await configure(addresses[i]);await tx(hub.executeTransactions());await deposit(BigInt(x),signers[i]);}else await tx(hub.connect(signers[i]).withdraw(0,x));}
      const liabilities=[];for(const a of addresses)liabilities.push((await hub.positionInfo(0,a)).pendingRewards[1]);const total=liabilities.reduce((x,y)=>x+y,0n);assert.ok(total>funded);assert.equal(funded,8n);assert.equal(total,10n);
      await tx(hub.connect(alice).claim(0,[r1.target],A));await tx(hub.connect(bob).claim(0,[r1.target],B));await revert(()=>hub.connect(carol).claim(0,[r1.target],C));return {funded:String(funded),recordedClaims:liabilities.map(String),totalRecorded:String(total),lastClaimReverts:true};
    },true);
    await run('CONFIRMED LIMIT: bad registered balanceOf blocks aggregate Merkle claims',['claimStakeDaoRewards'],['getClaim'],async()=>{
      await deposit();await supply(r1,100n);await tx(r2.faults(true,false,false));await revert(()=>hub.claimStakeDaoRewards(0));assert.equal((await helper.getClaim(r1.target))[0].exists,true);return {availableProofs:1,unrelatedRegisteredTokenBalanceReadFails:true,aggregateReverts:true};
    },true);

    const abiNames=a=>a.filter(x=>x.type==='function').map(x=>x.name).sort();
    const hNames=abiNames(hubArtifact.abi),eNames=abiNames(helperArtifact.abi);
    evidence.coverage={hub:{abiFunctions:hNames,covered:[...coveredHub].sort(),uncovered:hNames.filter(x=>!coveredHub.has(x))},helper:{abiFunctions:eNames,covered:[...coveredHelper].sort(),uncovered:eNames.filter(x=>!coveredHelper.has(x))}};
    assert.deepEqual(evidence.coverage.hub.uncovered,[]);assert.deepEqual(evidence.coverage.helper.uncovered,[]);
    evidence.status=evidence.checks.some(x=>x.status==='FAIL')?'TEST_FAILURE':evidence.checks.some(x=>x.status==='CONFIRMED_DEFECT')?'FUNCTIONAL_ISSUES_FOUND':'PASS';
    evidence.legacyCompileSucceeded=legacy.errors.length===0;
  } catch(e) {evidence.fatalError=e.shortMessage??e.message; evidence.status='EXECUTION_BLOCKED';throw e;}
  finally {
    if(provider)provider.destroy();if(processHandle)processHandle.kill('SIGTERM');
    await fs.writeFile(path.join(out,'functional-results.json'),JSON.stringify(evidence,null,2)+'\n');
    console.log('BOOSTHUB_FUNCTIONAL_EVIDENCE '+JSON.stringify(evidence));
    await fs.rm(tmp,{recursive:true,force:true});
  }
});
