// Executes on GitHub Actions; the release carries this exact frozen standard input.
import fs from 'node:fs';
import path from 'node:path';
import solc from 'solc';
import {createHash} from 'node:crypto';
const sources={};
for(const dir of ['contracts','test_contracts'])if(fs.existsSync(dir))for(const name of fs.readdirSync(dir))if(name.endsWith('.sol'))sources[dir+'/'+name]={content:fs.readFileSync(dir+'/'+name,'utf8')};
const settings={optimizer:{enabled:true,runs:200},viaIR:true,evmVersion:'cancun',outputSelection:{'*':{'*':['abi','evm.bytecode','evm.deployedBytecode','metadata']}}};
function resolve(p){try{const contents=fs.readFileSync(path.join('node_modules',p),'utf8');sources[p]={content:contents};return {contents};}catch{return {error:'Missing pinned import '+p};}}
let out=JSON.parse(solc.compile(JSON.stringify({language:'Solidity',sources,settings}),{import:resolve}));
for(const e of out.errors||[])console.log(e.formattedMessage);
if(out.errors?.some(e=>e.severity==='error'))process.exit(1);
const input={language:'Solidity',sources,settings};out=JSON.parse(solc.compile(JSON.stringify(input)));
if(out.errors?.some(e=>e.severity==='error'))throw Error('Frozen input does not compile');
fs.mkdirSync('build_v1',{recursive:true});fs.writeFileSync('build_v1/solidity_standard_input_v1.json',JSON.stringify(input,null,2));
const manifest={compiler:solc.version(),sourceCommit:process.env.GITHUB_SHA,settings,sources:{},artifacts:[]};
for(const [p,s] of Object.entries(sources))manifest.sources[p]=createHash('sha256').update(s.content).digest('hex');
for(const [p,contracts] of Object.entries(out.contracts))for(const [name,c] of Object.entries(contracts))if(c.evm.bytecode.object){
 const artifact={contractName:name,source:p,abi:c.abi,bytecode:'0x'+c.evm.bytecode.object,deployedBytecode:'0x'+c.evm.deployedBytecode.object,immutableReferences:c.evm.deployedBytecode.immutableReferences};
 const size=c.evm.deployedBytecode.object.length/2;if(p.startsWith('contracts/')&&size>24576)throw Error(name+' exceeds EIP-170');
 fs.writeFileSync('build_v1/'+name+'_v1.json',JSON.stringify(artifact,null,2));manifest.artifacts.push({name,source:p,runtimeBytes:size});console.log(name,'runtime',size);
}
fs.writeFileSync('build_v1/source_manifest_v1.json',JSON.stringify(manifest,null,2));
