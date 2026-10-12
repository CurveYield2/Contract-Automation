import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Interface} from 'ethers';
import {captureDeployedStateSnapshotV1} from '../src/adr-deployed-state-snapshot-v1.mjs';

const address='0x0000000000000000000000000000000000001234',qualifiedName='Main.sol:Main';
const abi=[
 {type:'function',name:'total',inputs:[],outputs:[{type:'uint256',name:''}],stateMutability:'view'},
 {type:'function',name:'broken',inputs:[],outputs:[{type:'bool',name:''}],stateMutability:'view'},
 {type:'function',name:'garbage',inputs:[],outputs:[{type:'address',name:''}],stateMutability:'view'},
 {type:'function',name:'mutate',inputs:[],outputs:[],stateMutability:'nonpayable'},
 {type:'function',name:'withArgs',inputs:[{type:'uint256',name:'id'}],outputs:[{type:'uint256',name:''}],stateMutability:'view'}
];
test('empty deployment list is nonfatal',async()=>{
 const r=await captureDeployedStateSnapshotV1({provider:{},deployedContracts:[],artifactByQualified:new Map()});
 assert.equal(r.status,'NO_DEPLOYMENT_ADDRESSES');
 assert.deepEqual(r.rows,[]);
});
test('snapshot records OK, REVERTED, ERROR and skips non-readonly functions',async()=>{
 const iface=new Interface(abi), provider={
  call:async tx=>{
   const parsed=iface.parseTransaction({data:tx.data});
   if(parsed.name==='total')return iface.encodeFunctionResult('total',[5n]);
   if(parsed.name==='broken')throw Object.assign(new Error('execution reverted'),{code:'CALL_EXCEPTION'});
   throw new Error('temporary provider failure');
  }
 };
 const result=await captureDeployedStateSnapshotV1({
  provider,deployedContracts:[{qualifiedName,address}],artifactByQualified:new Map([[qualifiedName,{abi}]])
 });
 assert.equal(result.status,'CAPTURED',JSON.stringify(result));
 assert.deepEqual(result.rows.map(r=>[r.function,r.status]),[['total','OK'],['broken','REVERTED'],['garbage','ERROR']]);
 assert.equal(result.rows[0].result,'5');
});
