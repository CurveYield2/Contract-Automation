import test from 'node:test';
import assert from 'node:assert/strict';
import {scoreQualificationV1 as score} from '../src/adr-detection-qualification-v1.mjs';
const defect=(caseId,severity='HIGH',classId='ACCESS_CONTROL',contract='Vault')=>({caseId,kind:'defect',severity,classId,contract});
const decoy=caseId=>({caseId,kind:'decoy',severity:'LOW',classId:'ACCESS_CONTROL',contract:'Vault'});
const clean=caseId=>({caseId,kind:'clean_control',severity:'LOW',classId:'NONE',contract:'Vault'});
const finding=(findingId,caseRefs,severity='HIGH')=>({findingId,caseRefs,severity});
const match=(caseId,findingId,more={})=>({caseId,findingId,match:'MATCH',severityReadjudicated:false,reason:'Evidence establishes issue',...more});
test('zero denominators are NOT_EVALUATED, including severity agreement',()=>{
 const r=score({truth:[],findings:[],adjudications:[]});
 assert.equal(r.recall.overall,'NOT_EVALUATED');
 assert.equal(r.precision,'NOT_EVALUATED');
 assert.equal(r.severityAgreement,'NOT_EVALUATED');
 assert.deepEqual(r.criticalHighMisses,[]);
});
test('adjudicated MATCH controls recall by severity, defect class, and contract',()=>{
 const truth=[defect('c1','CRITICAL','ACCESS_CONTROL','Vault'),defect('c2','MEDIUM','ACCOUNTING_MATH','Router'),defect('c3','LOW','STATE_MACHINE','Router')];
 const findings=[finding('f1',['c1'],'CRITICAL'),finding('f2',['c2'],'MEDIUM')];
 const r=score({truth,findings,adjudications:[match('c1','f1'),match('c2','f2')]});
 assert.deepEqual(r.recall.overall,{matched:2,total:3});
 assert.deepEqual(r.recall.bySeverity.CRITICAL,{matched:1,total:1});
 assert.deepEqual(r.recall.bySeverity.LOW,{matched:0,total:1});
 assert.deepEqual(r.recall.byClassId.ACCOUNTING_MATH,{matched:1,total:1});
 assert.deepEqual(r.recall.byContract.Router,{matched:1,total:2});
});
test('finding title or caseRefs without explicit MATCH is not a true-positive',()=>{
 const r=score({truth:[defect('c1')],findings:[finding('f1',['c1'],'HIGH')],adjudications:[{...match('c1','f1'),match:'NO_MATCH'}]});
 assert.deepEqual(r.recall.overall,{matched:0,total:1});
 assert.deepEqual(r.precision,{matched:0,total:1});
 assert.equal(r.criticalHighMisses[0].reason,'NOT_FOUND');
});
test('duplicates for one defect count once in recall, separate matched findings once in precision',()=>{
 const r=score({truth:[defect('c1')],findings:[finding('f1',['c1']),finding('f2',['c1'])],adjudications:[match('c1','f1'),match('c1','f2')]});
 assert.deepEqual(r.recall.overall,{matched:1,total:1});
 assert.deepEqual(r.precision,{matched:2,total:2});
});
test('decoy hit lowers precision, clean-control Critical/High false positives are visible',()=>{
 const r=score({truth:[defect('c1'),decoy('d1'),clean('clean')],findings:[finding('f1',['c1']),finding('f2',['d1'],'MEDIUM'),finding('f3',['clean'],'CRITICAL')],adjudications:[match('c1','f1'),match('d1','f2'),match('clean','f3')]});
 assert.deepEqual(r.recall.overall,{matched:1,total:1});
 assert.deepEqual(r.precision,{matched:1,total:3});
 assert.deepEqual(r.decoyHits,['d1']);
 assert.deepEqual(r.cleanControlCriticalHighFalsePositives,[{caseId:'clean',findingId:'f3'}]);
});
test('Critical defect rated Medium remains a Critical/High miss',()=>{
 const r=score({truth:[defect('c1','CRITICAL')],findings:[finding('f1',['c1'],'MEDIUM')],adjudications:[match('c1','f1')]});
 assert.deepEqual(r.recall.overall,{matched:1,total:1});
 assert.deepEqual(r.criticalHighMisses.map(x=>x.caseId),['c1']);
 assert.deepEqual(r.severityAgreement,{matched:0,total:1});
});
test('documented severity readjudication exempts under-rated match from Critical/High miss',()=>{
 const r=score({truth:[defect('c1','CRITICAL')],findings:[finding('f1',['c1'],'LOW')],adjudications:[match('c1','f1',{severityReadjudicated:true,reason:'Source evidence establishes the lower economic impact'})]});
 assert.deepEqual(r.criticalHighMisses,[]);
 assert.deepEqual(r.severityAgreement,{matched:0,total:1});
});
test('Critical and High without any matched finding are reported as misses',()=>{
 const r=score({truth:[defect('C','CRITICAL'),defect('H','HIGH'),defect('M','MEDIUM')],findings:[],adjudications:[]});
 assert.deepEqual(r.criticalHighMisses.map(x=>x.caseId),['C','H']);
});
test('missing readjudication reason, duplicate adjudications, wrong references fail closed',()=>{
 const truth=[defect('c1')],findings=[finding('f1',['c1'])],adjudications=[match('c1','f1')];
 assert.throws(()=>score({truth,findings,adjudications:[match('c1','f1',{severityReadjudicated:true,reason:' '})]}),/nonblank reason/);
 assert.throws(()=>score({truth,findings,adjudications:[...adjudications,...adjudications]}),/duplicate adjudication/);
 assert.throws(()=>score({truth,findings,adjudications:[match('c2','f1')]}),/unknown adjudication/);
 assert.throws(()=>score({truth,findings:[finding('f1',[])],adjudications}),/not in finding.caseRefs/);
});
test('zero defects with decoys still have NOT_EVALUATED recall and zero true precision',()=>{
 const r=score({truth:[decoy('d1')],findings:[finding('f1',['d1'])],adjudications:[match('d1','f1')]});
 assert.equal(r.recall.overall,'NOT_EVALUATED');
 assert.deepEqual(r.precision,{matched:0,total:1});
 assert.deepEqual(r.decoyHits,['d1']);
});
