import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {scoreFilesV1} from '../src/adr-seeded-score-cli-v1.mjs';

test('private manifest scorer reproduces 14/1/26/0, never returns manifest path or case IDs',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'seeded-private-'));
  try{
    const manifestPath=path.join(root,'DO_NOT_LEAK_truth.json');
    const cases=Array.from({length:41},(_,i)=>({caseId:'PRIVATE-X'+i,kind:'defect',
      severity:'HIGH',classId:'ACCESS_CONTROL',contract:'Vault'}));
    cases.push({caseId:'DECOY-PRIVATE',kind:'decoy'});
    const findings=cases.slice(0,14).map((c,i)=>({findingId:'F'+i,caseRefs:[c.caseId],severity:'HIGH'}));
    const decisions=cases.slice(0,14).map((c,i)=>({caseId:c.caseId,findingId:'F'+i,match:'MATCH'}));
    const inputs=[
      ['manifest',{schemaVersion:'curveyield-private-seeded-truth-v1',cases}],
      ['findings',findings],['decisions',decisions],['partial',['PRIVATE-X14']]
    ];
    for(const [p,o] of inputs)fs.writeFileSync(path.join(root,p+'.json'),JSON.stringify(o));
    fs.renameSync(path.join(root,'manifest.json'),manifestPath);
    const args={privateManifestPath:manifestPath,
      findingsPath:path.join(root,'findings.json'),adjudicationsPath:path.join(root,'decisions.json'),
      partialPath:path.join(root,'partial.json')};
    const result=scoreFilesV1(args);
    assert.deepEqual([result.caught,result.partial,result.missed,result.decoysFlagged],[14,1,26,0]);
    assert.equal(result.gate.passed,false);
    assert.ok(!JSON.stringify(result).includes('PRIVATE-X'));
    assert.ok(!JSON.stringify(result).includes('DO_NOT_LEAK'));
    assert.throws(()=>scoreFilesV1({...args,privateManifestPath:'relative-truth.json'}),/absolute private/);
    let out;
    try{
      execFileSync(process.execPath,[new URL('../src/adr-seeded-score-cli-v1.mjs',import.meta.url).pathname,
        args.findingsPath,args.adjudicationsPath,args.partialPath],{
        cwd:root,env:{...process.env,PRIVATE_SEEDED_TRUTH_FILE:manifestPath},encoding:'utf8'});
    }catch(error){out=error.stdout;assert.equal(error.status,2);}
    const cli=JSON.parse(out);
    assert.equal(cli.caught,14);
    assert.equal(cli.cleanControlCriticalHighFalsePositiveCount,0);
    assert.ok(!out.includes(manifestPath));
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
