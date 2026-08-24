import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { attestLiveDeploymentV1 } from '../src/live-deployment-attestation-v1.mjs';

const address='0x'+'1'.repeat(40), impl='0x'+'2'.repeat(40), admin='0x'+'3'.repeat(40);
const code='0x60016002';
const codeHash=createHash('sha256').update(Buffer.from(code.slice(2),'hex')).digest('hex');
const blockHash='0x'+'a'.repeat(64);
function transport(overrides={}){
  return async(method,params)=>{
    if(method==='eth_chainId') return '0x1';
    if(method==='eth_getBlockByNumber') return {number:'0x7b',hash:blockHash};
    if(method==='eth_getCode') return params[0].toLowerCase()===impl.toLowerCase()?'0x6000':code;
    if(method==='eth_getStorageAt') return '0x'+'0'.repeat(24)+impl.slice(2).toLowerCase();
    if(method==='eth_call') return '0x'+'0'.repeat(63)+'1';
    throw new Error(`unexpected ${method}`);
  };
}
function input(extra={}) { return { chain:'ethereum',blockNumber:123,blockHash,expectedChainId:1,deployments:[{label:'Vault',address,expectedRuntimeBytecodeSha256:codeHash,proxy:{kind:'NONE',expectedImplementation:null,expectedAdmin:null,implementationSlot:null,adminSlot:null,beaconSlot:null},criticalReads:[]}],...extra}; }

test('exact runtime match is ATTESTED',async()=>{
  const result=await attestLiveDeploymentV1(input(),{transport:transport()});
  assert.equal(result.status,'ATTESTED');
  assert.equal(result.deployments[0].runtimeCodeSha256,codeHash);
});

test('wrong runtime or missing code is MISMATCH',async()=>{
  let result=await attestLiveDeploymentV1(input({deployments:[{...input().deployments[0],expectedRuntimeBytecodeSha256:'f'.repeat(64)}]}),{transport:transport()});
  assert.equal(result.status,'MISMATCH');
  result=await attestLiveDeploymentV1(input(),{transport:async(method,params)=>method==='eth_chainId'?'0x1':method==='eth_getBlockByNumber'?{number:'0x7b',hash:blockHash}:method==='eth_getCode'?'0x':null});
  assert.equal(result.status,'MISMATCH');
});

test('declared proxy read failure is UNATTESTABLE and implementation mismatch is MISMATCH',async()=>{
  const dep={...input().deployments[0],expectedRuntimeBytecodeSha256:null,proxy:{kind:'EIP1967',expectedImplementation:impl,expectedAdmin:null,implementationSlot:null,adminSlot:null,beaconSlot:null}};
  let result=await attestLiveDeploymentV1(input({deployments:[dep]}),{transport:async(method,params)=>{ if(method==='eth_chainId')return'0x1'; if(method==='eth_getBlockByNumber')return{number:'0x7b',hash:blockHash}; if(method==='eth_getCode')return code; if(method==='eth_getStorageAt')throw new Error('blocked'); }});
  assert.equal(result.status,'UNATTESTABLE');
  result=await attestLiveDeploymentV1(input({deployments:[dep]}),{transport:async(method,params)=>{ if(method==='eth_chainId')return'0x1'; if(method==='eth_getBlockByNumber')return{number:'0x7b',hash:blockHash}; if(method==='eth_getCode')return code; if(method==='eth_getStorageAt')return '0x'+'0'.repeat(24)+'4'.repeat(40); }});
  assert.equal(result.status,'MISMATCH');
});

test('critical read mismatch is MISMATCH',async()=>{
  const dep={...input().deployments[0],criticalReads:[{function:'paused() view returns (bool)',args:[],expected:false,comparison:'EQUALS'}]};
  const result=await attestLiveDeploymentV1(input({deployments:[dep]}),{transport:transport()});
  assert.equal(result.status,'MISMATCH');
});
