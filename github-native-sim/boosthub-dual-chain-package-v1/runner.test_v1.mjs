import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const path = new URL('./deployment/deploy_runner_v1.mjs', import.meta.url);
test('the deployment runner validates real operator configuration before signing', async () => {
  assert.equal(fs.existsSync(path), true, 'Deployment runner has not been implemented');
  const { validateConfig } = await import(path);
  assert.throws(()=>validateConfig({}), /version|deployer|chains/i);
});
test('CREATE3 addresses stay equal across chain-specific constructor arguments', async () => {
  assert.equal(fs.existsSync(path), true, 'Deployment runner has not been implemented');
  const { predictAddresses } = await import(path);
  const artifacts = {factory:{bytecode:'0x6000600055'}};
  const a=predictAddresses(artifacts,'0x1000000000000000000000000000000000000001','release-test',3);
  const b=predictAddresses(artifacts,'0x1000000000000000000000000000000000000001','release-test',5);
  assert.equal(a.hub,b.hub);assert.equal(a.helper,b.helper);assert.equal(a.staking[0],b.staking[0]);
  const c=predictAddresses(artifacts,'0x2000000000000000000000000000000000000002','release-test',3);
  assert.notEqual(a.hub,c.hub);
});
test('a pending transaction is rebroadcast with the same signed bytes when resumed', async () => {
  assert.equal(fs.existsSync(path), true, 'Deployment runner has not been implemented');
  const { submitStep } = await import(path);
  const state={steps:{x:{hash:'0xabc',raw:'0xdead',nonce:0,status:'pending'}}};
  let sends=0,signed=0;
  const provider={getTransactionReceipt:async()=>null,getTransaction:async()=>null,
    broadcastTransaction:async raw=>{assert.equal(raw,'0xdead');sends++;},
    waitForTransaction:async()=>({status:1,hash:'0xabc',blockNumber:2,gasUsed:1n})};
  const signer={signTransaction:async()=>{signed++;throw Error('must not sign again');}};
  await submitStep({provider,signer,state,save:()=>{},confirmations:1,timeoutMs:1000},'x',{});
  assert.equal(sends,1);assert.equal(signed,0);assert.equal(state.steps.x.status,'confirmed');
});
test('Fraxtal configuration uses URD with no vlBoost and rejects a fake registry', async () => {
  const {validateConfig,FRAXTAL_URD,FRAXTAL_SDFXS}=await import(path);
  const owner='0x1000000000000000000000000000000000000001';
  const c={version:'v1',deployer:owner,deploymentId:'validation',chains:{fraxtal:{chainId:252,owner,vlBoost:'0x0000000000000000000000000000000000000000',rewardDistributor:FRAXTAL_URD,claimMode:'urd',maxFeePerGasGwei:'1',priorityFeePerGasGwei:'0',pools:[{pid:0,asset:FRAXTAL_SDFXS,gauge:owner,stakingAdmin:owner,keeper:owner,stakingFeeReceiver:owner,platformFeeRecipient:owner,platformFeeBps:500,rewardSmoothingUnits:0,active:true,lockDepositor:false,checkpointSelector:'0x00000000',hubRewardTokens:[FRAXTAL_SDFXS],externalRewardTokens:[],disabledRewardTokens:[]}]}}};
  assert.equal(validateConfig(c),c);c.chains.fraxtal.vlBoost=owner;
  assert.throws(()=>validateConfig(c),/Fraxtal has no vlBoost/);
});
test('the signing account must be an explicitly configured EOA address', async () => {
  const {validateConfig}=await import(path);
  assert.throws(()=>validateConfig({version:'v1',deployer:'0x0000000000000000000000000000000000000000'}),/deployer/);
});
test('JSON from Windows PowerShell accepts a UTF-8 byte-order mark', async () => {
  const {parseJson}=await import(path);
  assert.deepEqual(parseJson('\ufeff{"mode":"Check"}'),{mode:'Check'});
});
test('malformed stdin fails without echoing potentially sensitive input', async () => {
  const {spawnSync}=await import('node:child_process');
  const r=spawnSync(process.execPath,[path.pathname],{input:'{"privateKey":"fixture-do-not-echo",',encoding:'utf8',env:{...process.env,BOOSTHUB_EXECUTE:'1'}});
  assert.equal(r.status,1);assert.match(r.stderr,/invalid input JSON/);assert.equal(r.stderr.includes('fixture-do-not-echo'),false);
});
