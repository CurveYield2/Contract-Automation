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
