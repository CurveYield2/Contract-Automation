import fs from 'node:fs';
import path from 'node:path';
import solc from 'solc';
import {Contract,JsonRpcProvider,FetchRequest,keccak256} from 'ethers';
const out='binding_evidence_v1';fs.mkdirSync(out,{recursive:true});
const req=new FetchRequest('https://eth.drpc.org');req.timeout=20000;const provider=new JsonRpcProvider(req,1,{staticNetwork:true,batchMaxCount:1});
const pin=26167322;
function standard(item){let text=item.SourceCode;if(text.startsWith('{{'))text=text.slice(1,-1);const x=JSON.parse(text);return x.sources?x:{language:'Solidity',sources:x};}
function trim(code){const bytes=(code.length-2)/2;const length=parseInt(code.slice(-4),16);if(length>bytes||length<5)throw Error('Missing Solidity metadata');return code.slice(0,code.length-2*(length+2));}
function normalized(code,refs){let b=trim(code).slice(2);for(const ranges of Object.values(refs||{}))for(const {start,length} of ranges)b=b.slice(0,start*2)+'0'.repeat(length*2)+b.slice((start+length)*2);return b;}
async function compile(input,name){input.settings={...input.settings,outputSelection:{'*':{'*':['abi','evm.bytecode','evm.deployedBytecode']}}};const result=JSON.parse(solc.compile(JSON.stringify(input)));const errors=result.errors?.filter(e=>e.severity==='error')||[];if(errors.length)throw Error(errors.map(e=>e.formattedMessage).join('\n'));for(const [file,contracts] of Object.entries(result.contracts))if(contracts[name])return {file,contract:contracts[name],input};throw Error('Missing compiled '+name);}
const bindings=[];let legacyInput;
for(const address of ['0x63B6e49A7EC0b5596576bc10470c846e46b8aF99','0x8F746707ed9b44a0c13dDd6dE78F8786e8EabAdD','0x94a72979b8b38e69CeE8DD64D29F6712524e9958','0x3C618Deb7659695C378170A032A1B8e61e17644E']){
 const url='https://api.routescan.io/v2/network/mainnet/evm/1/etherscan/api?module=contract&action=getsourcecode&address='+address;const response=await (await fetch(url,{signal:AbortSignal.timeout(20000)})).json();const item=response.result[0];const input=standard(item);if(address.startsWith('0x3C'))legacyInput=input;
 const c=await compile(input,item.ContractName);const live=await provider.getCode(address,pin);const matches=normalized(live,c.contract.evm.deployedBytecode.immutableReferences)===normalized('0x'+c.contract.evm.deployedBytecode.object,c.contract.evm.deployedBytecode.immutableReferences);
 bindings.push({address,name:item.ContractName,pin,liveRuntimeHash:keccak256(live),matchingExecutableRuntime:matches,metadataAndImmutablesExcluded:true,settings:input.settings});if(!matches)throw Error('Live verified source binding failed '+address);
 fs.writeFileSync(out+'/'+address.toLowerCase()+'_standard_input_v1.json',JSON.stringify(input,null,2));
}
const lp='0x10dF0e197bc1FEF44D1D1a648C2874c9cdC34692',live=await provider.getCode(lp,pin);let matched;
const referenceRoot='reference_evidence_v1';
for(const dir of fs.readdirSync(referenceRoot).filter(x=>x.startsWith('CurveYield-'))){
 const file=path.join(referenceRoot,dir,'SdYbRewardConverter.sol');if(!fs.existsSync(file))continue;
 const sources=Object.fromEntries(Object.entries(legacyInput.sources).filter(([p])=>p.startsWith('@openzeppelin/')));sources['contracts/src/SdYbRewardConverter.sol']={content:fs.readFileSync(file,'utf8')};
 for(const evmVersion of ['paris','cancun'])for(const viaIR of [true,false]){
  const input={language:'Solidity',sources,settings:{optimizer:{enabled:true,runs:200},evmVersion,viaIR}};const c=await compile(input,'SdYbRewardConverter');const matches=normalized(live,c.contract.evm.deployedBytecode.immutableReferences)===normalized('0x'+c.contract.evm.deployedBytecode.object,c.contract.evm.deployedBytecode.immutableReferences);
  console.log('YB candidate',dir,evmVersion,viaIR,'bytes',c.contract.evm.deployedBytecode.object.length/2,'match',matches);
  if(matches){matched={address:lp,name:'SdYbRewardConverter',sourcePackage:dir,pin,liveRuntimeHash:keccak256(live),matchingExecutableRuntime:true,metadataAndImmutablesExcluded:true,settings:input.settings};fs.writeFileSync(out+'/yb_matched_source_v1.sol',sources['contracts/src/SdYbRewardConverter.sol'].content);fs.writeFileSync(out+'/yb_matched_standard_input_v1.json',JSON.stringify(input,null,2));break;}
 }if(matched)break;
}
if(!matched)throw Error('No YB source candidate matches the deployed runtime');bindings.push(matched);fs.writeFileSync(out+'/live_source_bindings_v1.json',JSON.stringify({compiler:solc.version(),pin,bindings},null,2));console.log('All source bindings matched');provider.destroy();
