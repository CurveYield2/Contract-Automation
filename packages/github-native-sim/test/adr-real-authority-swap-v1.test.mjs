import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {requiredFile,loadPhaseSchema,authorityRootFromReceipt} from '../../../scripts/lib/lite-phase-work-v1.mjs';

test('real swap binds v12 as the single live package and preserves all historical campaign authority',t=>{
  if(!process.env.ADR_SWAPPED_CONTROLLER_ROOT){t.skip('set ADR_SWAPPED_CONTROLLER_ROOT for AC swap validation');return;}
  const root=path.resolve(process.env.ADR_SWAPPED_CONTROLLER_ROOT);
  const authorityHome=path.join(root,'Audit Skill - Current Authority');
  const packages=fs.readdirSync(authorityHome,{withFileTypes:true})
    .filter(x=>x.isDirectory()&&fs.existsSync(path.join(authorityHome,x.name,'SKILL.md')))
    .map(x=>x.name);
  assert.deepEqual(packages,['Audit_Litemode_v12'],'exactly one live v12 authority package');
  const v12='Audit Skill - Current Authority/Audit_Litemode_v12';
  const manifest=JSON.parse(fs.readFileSync(requiredFile(root,v12+'/MANIFEST.json'),'utf8'));
  assert.equal(manifest.release,'Audit_Litemode_v12');
  assert.equal(manifest.detectionPolicy,'audit-detection-rebuild-v1');
  for(let phase=1;phase<=10;phase++){
    const {schema}=loadPhaseSchema(root,v12,phase);
    assert.equal(schema.phase,phase);
  }
  const directory=path.join(root,'Audit Campaign Directory/campaigns');
  const names=fs.readdirSync(directory).filter(name=>name.endsWith('.json')).sort();
  assert.ok(names.length>0,'campaign directory has entries');
  let oldV11=0,oldV103=0;
  const missingHistoricalReceipts=[];
  for(const name of names){
    const entry=JSON.parse(fs.readFileSync(path.join(directory,name),'utf8'));
    assert.ok(entry.lastSealedReceiptPath,name+' has a receipt path');
    // Campaign bodies are deliberately not part of the sparse clone. Read the
    // exact bound historical receipt blob from Git, not a guessed current file.
    const exists=(()=>{
      try{execFileSync('git',['cat-file','-e','HEAD:'+entry.lastSealedReceiptPath],{cwd:root,stdio:'ignore'});return true;}
      catch{return false;}
    })();
    if(!exists){
      // Archived campaign directories can survive after their workspaces.
      // Record missing evidence without inventing or rebinding a receipt.
      assert.equal(fs.existsSync(path.join(root,entry.workspacePath)),false,
        name+' still has a live workspace with a missing receipt');
      missingHistoricalReceipts.push({name,receipt:entry.lastSealedReceiptPath});
      continue;
    }
    const raw=execFileSync('git',['show','HEAD:'+entry.lastSealedReceiptPath],{cwd:root,encoding:'utf8'});
    const receipt=JSON.parse(raw);
    const boundRoot=authorityRootFromReceipt(receipt);
    const skill=requiredFile(root,boundRoot+'/SKILL.md','campaign bound authority SKILL.md');
    assert.equal(fs.readFileSync(skill,'utf8').length>0,true);
    const phase=Number(entry.currentAssignment?.phaseSequence??receipt.phase?.sequence);
    if(Number.isInteger(phase)&&phase>=1&&phase<=10){
      const result=loadPhaseSchema(root,boundRoot,phase);
      assert.equal(result.schema.phase,phase,name+' phase schema resolves');
    }
    if(boundRoot.endsWith('Audit_Litemode_v11'))oldV11++;
    if(boundRoot.endsWith('Audit_Litemode_v10.3'))oldV103++;
  }
  assert.ok(oldV11>0,'v11-bound campaign remains resolvable after the swap');
  const v103='Audit Skill - Current Authority/Audit_Litemode_v10.3';
  assert.ok(requiredFile(root,v103+'/SKILL.md'));
  assert.equal(loadPhaseSchema(root,v103,1).schema.phase,1);
  for(const row of missingHistoricalReceipts)
    console.warn('HISTORICAL_RECEIPT_ABSENT: '+row.name+' '+row.receipt);
  assert.ok(oldV103>0||missingHistoricalReceipts.length>0,
    'v10.3 requires a bound directory receipt or explicit missing historical evidence');
});
