import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import solc from 'solc';
import {buildReviewInventoryV1,writeReviewInventoryOutputsV1} from '../src/adr-review-inventory-v1.mjs';
import {canonicalJsonV1} from '../src/canonical-json-v1.mjs';

const fixtureRoot=fileURLToPath(new URL('./fixtures/adr-inventory/',import.meta.url));
const campaign={campaignId:'adr-fixture',campaignGenerationId:'adr-fixture-g1',sourceSha256:'a'.repeat(64),
  generatedAt:'2026-10-12T12:00:00.000Z'};
async function sourceFiles(root=fixtureRoot){
 const out={};async function scan(dir){
  for(const d of await fs.readdir(dir,{withFileTypes:true})){
   const file=path.join(dir,d.name);
   if(d.isDirectory())await scan(file);
   else if(d.name.endsWith('.sol'))out[path.relative(root,file).split(path.sep).join('/')]={content:await fs.readFile(file,'utf8')};
  }
 }
 await scan(root);return out;
}
async function setup(){
 const input={language:'Solidity',sources:await sourceFiles(),
  settings:{outputSelection:{'*':{'*':['abi'],'':['ast']}}}};
 const output=JSON.parse(solc.compile(JSON.stringify(input)));
 const severe=(output.errors??[]).filter(e=>e.severity==='error');
 assert.deepEqual(severe,[],JSON.stringify(severe));
 const sourceAsts=Object.fromEntries(Object.entries(output.sources??{}).map(([p,v])=>[p,v.ast]));
 return {build:{sourceAsts,artifacts:[]},inventory:await buildReviewInventoryV1({projectRoot:fixtureRoot,build:{sourceAsts,artifacts:[]},campaign})};
}
const prepared=setup();
test('all executable declaration kinds, library and inherited function are inventoried',async()=>{
 const {inventory}=await prepared;
 const kinds=new Set(inventory.payload.declarations.map(x=>x.kind));
 for(const k of ['FUNCTION','CONSTRUCTOR','FALLBACK','RECEIVE','FREE_FUNCTION','MODIFIER','CONSTANT','IMMUTABLE','STATE_INITIALIZER','GENERATED_GETTER'])
  assert.ok(kinds.has(k),k+' missing');
 assert.ok(inventory.payload.contexts.some(c=>c.qualifiedContainer==='Main.sol:DemoMath'&&c.kind==='FUNCTION'));
 const inherited=inventory.payload.contexts.filter(c=>c.canonicalSignature==='inherited()'&&c.qualifiedContainer.endsWith(':SharedBase'));
 assert.equal(inherited.length,1);
 assert.ok(inherited[0].effectiveIn.includes('Inheritance.sol:ChildOne'));
 assert.ok(inherited[0].effectiveIn.includes('Inheritance.sol:ChildTwo'));
 assert.ok(!inventory.payload.contexts.some(c=>c.qualifiedContainer==='Main.sol:ITarget'));
 const vendor=inventory.payload.contexts.filter(c=>c.kind==='INHERITED_DEPENDENCY'&&c.canonicalSignature==='vendorCall()');
 assert.equal(vendor.length,1);
 assert.deepEqual(vendor[0].effectiveIn,['VendorChild.sol:VendorChild']);
 assert.equal(inventory.payload.complete,true);
});
test('UTF-8 byte offsets yield correct line anchors',async()=>{
 const {inventory}=await prepared;
 const c=inventory.payload.contexts.find(c=>c.canonicalSignature==='afterUnicode()');
 assert.equal(c.lineStart,5);
});
test('overloads have distinct identities and callback/tx.origin triggers are emitted',async()=>{
 const {inventory}=await prepared;
 const overloads=inventory.payload.contexts.filter(c=>c.canonicalSignature.startsWith('overloaded('));
 assert.equal(overloads.length,2);
 assert.notEqual(overloads[0].symbolId,overloads[1].symbolId);
 const cb=inventory.payload.contexts.find(c=>c.canonicalSignature.startsWith('callback('));
 assert.ok(inventory.payload.triggers[cb.contextId].includes('EXTERNAL_CALL_BEFORE_STATE_WRITE'));
 const tx=inventory.payload.contexts.find(c=>c.canonicalSignature==='originCheck()');
 assert.ok(inventory.payload.triggers[tx.contextId].includes('TX_ORIGIN'));
});
test('missing in-scope AST yields file-level fallback and typed coverage gap',async()=>{
 const {build}=await prepared;
 const without={...build,sourceAsts:{...build.sourceAsts}};
 delete without.sourceAsts['Utf8.sol'];
 const result=await buildReviewInventoryV1({projectRoot:fixtureRoot,build:without,campaign});
 assert.equal(result.payload.complete,false);
 assert.ok(result.payload.contexts.some(c=>c.path==='Utf8.sol'&&c.kind==='FILE_FALLBACK'));
 assert.ok(result.payload.limitations.some(l=>l.code==='INVENTORY_INCOMPLETE'&&l.path==='Utf8.sol'));
});
test('reversing input compilation units and source AST insertion produces identical canonical output',async()=>{
 const {build,inventory}=await prepared;
 const entries=Object.entries(build.sourceAsts).reverse();
 const a=await buildReviewInventoryV1({projectRoot:fixtureRoot,build:{compilationUnits:[{unitId:'a',sourceAsts:Object.fromEntries(entries)}],artifacts:[]},campaign});
 assert.equal(canonicalJsonV1(inventory),canonicalJsonV1(a));
});
test('disabled policy writes nothing to the output directory (legacy path)',async()=>{
 const {build}=await prepared;
 const temp=await fs.mkdtemp(path.join(fileURLToPath(new URL('../../../',import.meta.url)),'adr-legacy-'));
 try {
  await writeReviewInventoryOutputsV1({outputDir:temp,projectRoot:fixtureRoot,build,request:{...campaign,source:{archiveSha256:campaign.sourceSha256}},policy:null});
  assert.deepEqual(await fs.readdir(temp),[]);
 }finally{await fs.rm(temp,{force:true,recursive:true});}
});
