// This test is run first against one existing single-route converter (red),
// then against the new combined converter on a local Anvil Ethereum fork (green).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Contract,JsonRpcProvider,FetchRequest} from 'ethers';
const catalogue=JSON.parse(fs.readFileSync('live_catalog_v1.json'));
const request=new FetchRequest(process.env.READ_RPC||'https://eth.drpc.org');request.timeout=20000;
const provider=new JsonRpcProvider(request,1,{staticNetwork:true,batchMaxCount:1});
const converter=new Contract(process.env.CONVERTER||'0x63B6e49A7EC0b5596576bc10470c846e46b8aF99',['function previewConvert(address,address,uint256) view returns(uint256)'],provider);
for(const route of catalogue.routes)test('one converter quotes '+route.from+' -> '+route.to,async()=>{
 let quote;try{quote=await converter.previewConvert(route.from,route.to,10n**16n);}catch{}
 assert.ok(typeof quote==='bigint'&&quote>0n,'The selected converter does not implement this live route');
});
test.after(()=>provider.destroy());
