import fs from 'node:fs';
import path from 'node:path';
import {build} from 'esbuild';
const release='release_v1';fs.mkdirSync(release,{recursive:true});
const copy=(a,b)=>{fs.mkdirSync(path.dirname(release+'/'+b),{recursive:true});fs.copyFileSync(a,release+'/'+b);};
copy('contracts/BoostHubEthereumRewardConverter_v1.sol','contracts/BoostHubEthereumRewardConverter_v1.sol');
copy('build_v1/BoostHubEthereumRewardConverter_v1.json','artifacts_v1/BoostHubEthereumRewardConverter_v1.json');
copy('build_v1/source_manifest_v1.json','source_manifest_v1.json');copy('build_v1/solidity_standard_input_v1.json','solidity_standard_input_v1.json');
copy('Ethereum_Route_Inventory_v1.json','Ethereum_Route_Inventory_v1.json');copy('Ethereum_Converter_Instructions_v1.md','Ethereum_Converter_Instructions_v1.md');copy('deployment/Deploy-Converter_v1.ps1','deployment/Deploy-Converter_v1.ps1');
copy('deployment/deploy_converter_source_v1.cjs','deployment/source/deploy_converter_source_v1.cjs');
const std=JSON.parse(fs.readFileSync('build_v1/solidity_standard_input_v1.json'));for(const [name,s] of Object.entries(std.sources))if(name.startsWith('@openzeppelin/')){const p=release+'/dependencies_v1/'+name;fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,s.content);}
for(const [packageName,label] of [['@openzeppelin/contracts','OpenZeppelin'],['ethers','ethers'],['esbuild','esbuild']]){const p='node_modules/'+packageName+'/LICENSE';if(fs.existsSync(p))copy(p,'licenses_v1/'+label+'_LICENSE_v1.txt');}
await build({entryPoints:['deployment/deploy_converter_source_v1.cjs'],outfile:release+'/deployment/deploy_converter_v1.cjs',bundle:true,platform:'node',format:'cjs',target:'node22',legalComments:'external'});
for(const f of ['package.json','package-lock.json','run_tests_v1.mjs','unit_v1.test.mjs','fork_v1.mjs','combined_routes_v1.test.mjs','release_requirement_v1.test.mjs','live_catalog_v1.json'])copy(f,'verification_project_v1/'+f);
copy('test_contracts/ConverterMocks_v1.sol','verification_project_v1/test_contracts/ConverterMocks_v1.sol');
copy('contracts/BoostHubEthereumRewardConverter_v1.sol','verification_project_v1/contracts/BoostHubEthereumRewardConverter_v1.sol');
fs.writeFileSync(release+'/verification_project_v1/compile_v1.mjs',`import fs from 'node:fs';
import solc from 'solc';
const input=JSON.parse(fs.readFileSync('../solidity_standard_input_v1.json'));
const result=JSON.parse(solc.compile(JSON.stringify(input)));
if(result.errors?.some(e=>e.severity==='error'))throw Error(result.errors.filter(e=>e.severity==='error').map(e=>e.formattedMessage).join('\\n'));
fs.mkdirSync('build_v1',{recursive:true});
for(const [source,contracts] of Object.entries(result.contracts))for(const [name,c] of Object.entries(contracts))if(c.evm.bytecode.object)fs.writeFileSync('build_v1/'+name+'_v1.json',JSON.stringify({contractName:name,source,abi:c.abi,bytecode:'0x'+c.evm.bytecode.object,deployedBytecode:'0x'+c.evm.deployedBytecode.object,immutableReferences:c.evm.deployedBytecode.immutableReferences},null,2));
`);
for(const [from,to] of [['test_evidence_v1','evidence_v1/tests'],['evidence_inputs_v1/trace','evidence_v1/live_trace'],['evidence_inputs_v1/bindings','evidence_v1/source_bindings']])if(fs.existsSync(from))fs.cpSync(from,release+'/'+to,{recursive:true});
const inventory=JSON.parse(fs.readFileSync(release+'/Ethereum_Route_Inventory_v1.json'));if(!fs.readFileSync(release+'/Ethereum_Converter_Instructions_v1.md','utf8').includes(inventory.blockHash))throw Error('Instruction block hash differs from inventory');
console.log('Prepared converter release and bundled PowerShell runner');
