import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import solc from 'solc';
import {buildReviewInventoryV1} from '../src/adr-review-inventory-v1.mjs';
import {buildSystemFactsV1} from '../src/adr-system-facts-v1.mjs';

test('sibling guard asymmetry, guarded state writer and token transfer flows',async()=>{
 const root=fileURLToPath(new URL('./fixtures/adr-inventory/',import.meta.url)),sources={};
 async function scan(dir) {
  for(const item of await fs.readdir(dir,{withFileTypes:true})){
   const abs=path.join(dir,item.name);
   if(item.isDirectory())await scan(abs);
   else if(abs.endsWith('.sol'))sources[path.relative(root,abs).split(path.sep).join('/')]={content:await fs.readFile(abs,'utf8')};
  }
 }
 await scan(root);
 const input={language:'Solidity',sources,settings:{outputSelection:{'*':{'*':['abi'],'':['ast']}}}};
 const out=JSON.parse(solc.compile(JSON.stringify(input)));
 assert.deepEqual((out.errors??[]).filter(e=>e.severity==='error'),[]);
 const sourceAsts=Object.fromEntries(Object.entries(out.sources).map(([p,v])=>[p,v.ast]));
 const inventory=await buildReviewInventoryV1({projectRoot:root,build:{sourceAsts,artifacts:[]},
  campaign:{campaignId:'test',campaignGenerationId:'g1',sourceSha256:'a'.repeat(64)}});
 const facts=buildSystemFactsV1({inventory}).payload;
 assert.ok(facts.siblingGroups.some(g=>g.signature==='sensitive()'&&g.asymmetric),JSON.stringify(facts.siblingGroups));
 assert.ok(facts.guardTable.some(row=>row.function==='write(uint256)'&&row.hasGuard));
 assert.ok(facts.valueFlows.some(row=>row.memberName==='transfer'));
 assert.ok(facts.crossContractEdges.some(row=>row.memberName==='ping'));
});
