import fs from 'node:fs';
import path from 'node:path';
import solc from 'solc';
import {build} from 'esbuild';
const root=path.dirname(new URL(import.meta.url).pathname),release=path.join(root,'release_v3');
const sources={};
for(const file of ['contracts/BoostHub.sol','contracts/interfaces/IBoostHub.sol','contracts/StakeDaoMerkleClaimExecutor.sol','contracts/StakeDaoFraxtalSdFxsUrdClaimExecutor_v5.sol','contracts/BoostHubDeploymentFactory_v1.sol'])sources[file]={content:fs.readFileSync(path.join(release,file),'utf8')};
const settings={optimizer:{enabled:true,runs:200},viaIR:true,evmVersion:'cancun',outputSelection:{'*':{'*':['abi','evm.bytecode','evm.deployedBytecode','metadata']}}};
function resolve(name){
  let file;
  if(name.startsWith('@openzeppelin/contracts/'))file=path.join(root,'lib/openzeppelin-contracts/contracts',name.slice('@openzeppelin/contracts/'.length));
  else if(name.startsWith('solmate/'))file=path.join(root,'lib/solmate',name.slice('solmate/'.length));
  else file=path.join(release,name);
  try{const content=fs.readFileSync(file,'utf8');sources[name]={content};return {contents:content};}catch{return {error:'Missing exact source '+name};}
}
let output=JSON.parse(solc.compile(JSON.stringify({language:'Solidity',sources,settings}),{import:resolve}));
if(output.errors?.some(e=>e.severity==='error'))throw Error(output.errors.filter(e=>e.severity==='error').map(e=>e.formattedMessage).join('\n'));
// Freeze a self-contained standard JSON input, then compile that exact frozen input.
const input={language:'Solidity',sources,settings};
output=JSON.parse(solc.compile(JSON.stringify(input)));
if(output.errors?.some(e=>e.severity==='error'))throw Error(output.errors.filter(e=>e.severity==='error').map(e=>e.formattedMessage).join('\n'));
fs.writeFileSync(path.join(release,'solidity_standard_input_v1.json'),JSON.stringify(input,null,2));
for(const [key,file,name]of [['hub','contracts/BoostHub.sol','BoostHub'],['helper','contracts/StakeDaoMerkleClaimExecutor.sol','StakeDaoMerkleClaimExecutor'],['helperFraxtal','contracts/StakeDaoFraxtalSdFxsUrdClaimExecutor_v5.sol','StakeDaoFraxtalSdFxsUrdClaimExecutor'],['factory','contracts/BoostHubDeploymentFactory_v1.sol','BoostHubDeploymentFactory']]){
  const c=output.contracts[file][name];
  const a={contractName:name,compiler:solc.version(),evmVersion:'cancun',optimizerRuns:200,viaIR:true,abi:c.abi,bytecode:'0x'+c.evm.bytecode.object,deployedBytecode:'0x'+c.evm.deployedBytecode.object,immutableReferences:c.evm.deployedBytecode.immutableReferences};
  if((a.deployedBytecode.length-2)/2>24576)throw Error(name+' exceeds EIP-170');
  fs.writeFileSync(path.join(release,'artifacts_v1',key+'_v1.json'),JSON.stringify(a,null,2));
  console.log(name+' runtime bytes '+(a.deployedBytecode.length-2)/2);
}
for(const [project,label]of [['openzeppelin-contracts','OpenZeppelin'],['solmate','Solmate']]) {
  fs.mkdirSync(path.join(release,'dependencies_v1'),{recursive:true});
  for(const candidate of ['LICENSE','LICENSE.txt','COPYING']) {
    const source=path.join(root,'lib',project,candidate);
    if(fs.existsSync(source))fs.copyFileSync(source,path.join(release,'dependencies_v1',label+'_'+candidate));
  }
}
await build({entryPoints:[path.join(root,'deployment/deploy_runner_v2.mjs')],outfile:path.join(release,'deployment/deploy_runner_v2.cjs'),bundle:true,platform:'node',format:'cjs',target:'node22',legalComments:'external'});
for(const [name,obj]of Object.entries(sources)){
  if(name.startsWith('@openzeppelin/')||name.startsWith('solmate/')){
    const p=path.join(release,'dependencies_v1',name);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,obj.content);
  }
}
