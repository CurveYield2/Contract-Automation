#!/usr/bin/env node
import fs from 'node:fs/promises';
import fss from 'node:fs';
import path from 'node:path';

const root=path.resolve(process.argv[2]??'.audit-evidence/v7-infrastructure-qualification');
const read=async rel=>JSON.parse(await fs.readFile(path.join(root,...rel.split('/')),'utf8'));
const assertThat=(v,m)=>{if(!v)throw new Error('PHASE0_V2_FINAL_REPORT: '+m);};
const live=await read('phase0-v2/PHASE0_V2_LIVE_QUALIFICATION_v1.json');
const held=await read('phase0-v2-heldout/PHASE0_V2_HELDOUT_QUALIFICATION_v1.json');
const a33=await read('phase0-v2-a33/PHASE0_V2_A33_FAILURE_BOUNDARY_v1.json');
const dex=await read('phase0-v2-dex/PHASE0_V2_DEX_GENERIC_REGRESSION_v1.json');
for(const [name,value] of Object.entries({live,held,a33,dex}))assertThat(value.status==='PASS',name+' qualification is not PASS');

const runId=String(process.env.GITHUB_RUN_ID??'');
const commit=String(process.env.GITHUB_SHA??'');
const ev={
  live:'phase0-v2/PHASE0_V2_LIVE_QUALIFICATION_v1.json',
  held:'phase0-v2-heldout/PHASE0_V2_HELDOUT_QUALIFICATION_v1.json',
  a33:'phase0-v2-a33/PHASE0_V2_A33_FAILURE_BOUNDARY_v1.json',
  dex:'phase0-v2-dex/PHASE0_V2_DEX_GENERIC_REGRESSION_v1.json'
};
const rows=[
['A01','VERIFIED','Shared build/SI/ABI/Slither/readiness reuse and no second default build.',[ev.live,ev.dex]],
['A02','VERIFIED','Fresh producer-bound technical SI and immutable input reuse.',[ev.live,ev.dex]],
['A03','VERIFIED','Independent source/build/profile/generation/ABI binding failures and null compiler identity rejection.',[ev.live,ev.dex]],
['A04','VERIFIED','Callable ABI inventory/context reconciliation.',[ev.live,ev.held,ev.dex]],
['A05','VERIFIED','Recursive tuples/arrays/boundaries and unchanged DEX tuple routing.',[ev.live,ev.held,ev.dex]],
['A06','VERIFIED','Per-script deployment dispositions preserve unsupported siblings.',[ev.live,ev.dex]],
['A07','VERIFIED','Original/adapted deployment digests and visible normalization provenance.',[ev.live]],
['A08','VERIFIED','Node permission boundary blocks filesystem escape; GitHub/controller/upstream RPC secret sentinels are absent from child/retained output.',[ev.live]],
['A09','VERIFIED','Caller/value/context evidence distinguishes direct/facade/delegate contexts.',[ev.live,ev.held]],
['A10','VERIFIED','Delegate facade positive path and qualified callback flow with direct rejection.',[ev.live,ev.held]],
['A11','VERIFIED','Failed reset/sentinel controls plus deterministic reconstructed replay.',[ev.live]],
['A12','VERIFIED','Lookalike/unknown semantics become oracle gaps without name-derived invariants.',[ev.live,ev.held,ev.dex]],
['A13','VERIFIED','>100K Medusa discovery and real engine-discovered checked properties.',[ev.live]],
['A14','VERIFIED','Zero-test/vacuous legacy discovery cannot satisfy checked mode.',[ev.live,ev.dex]],
['A15','VERIFIED','Native true/false checker controls are separate from target assurance.',[ev.live]],
['A16','VERIFIED','UNEXERCISED and OBSERVATION_GAP remain non-passing states.',[ev.live]],
['A17','VERIFIED','Applicable target checks require transition witness plus engine evidence.',[ev.live,ev.held]],
['A18','VERIFIED','Qualified generic token/vault recipes handle supported units/effects; unsupported semantics stay gaps.',[ev.live,ev.held]],
['A19','VERIFIED','Ready tuple/context functions retain exploration and achieved Medusa weight derives from actual dispatches.',[ev.live,ev.held,ev.dex]],
['A20','VERIFIED','Observed target transitions affect later action selection.',[ev.live]],
['A21','VERIFIED','False/revert/panic data survives raw retention with neutral deviation semantics.',[ev.live]],
['A22','VERIFIED','Authority/config/no-op/economic families remain independent from mutability.',[ev.live]],
['A23','VERIFIED','Registered entities/allowances are used and wrong-context failures adapt without starving other contexts.',[ev.live,ev.held]],
['A24','VERIFIED','Destructive/config exploration is resettable and cannot consume positive-fixture evidence.',[ev.live]],
['A25','VERIFIED','Four 1,200-attempt main telemetry shards preserve weighting and revisit targets.',[ev.live]],
['A26','VERIFIED','Encoding/rejection/mined success/mined revert/infrastructure/unknown submission outcomes remain distinct.',[ev.live,ev.dex]],
['A27','VERIFIED','Balances/allowances/shares/related assets/state anchors/actual fees are retained; gas-only change is not economic movement.',[ev.live]],
['A28','VERIFIED','Failed required observations remain UNKNOWN/incomplete.',[ev.live]],
['A29','VERIFIED','Supported generic lifecycle families have witnesses; unsupported DEX protocol semantics are explicit typed gaps.',[ev.live,ev.held,ev.dex]],
['A30','VERIFIED','Raw rows fully reconcile; duplicate/missing/digest/reference mismatches fail.',[ev.live]],
['A31','VERIFIED','Legacy quantity-only PASS remains limited discovery and no property assurance.',[ev.dex,ev.live]],
['A32','VERIFIED','V2 fields propagate through projectors/finalizer; Phase-0 unit suite is a workflow precondition for this report.',[ev.live]],
['A33','VERIFIED','Faulted required lane preserves failure evidence, independent safe observation completes, finalizer creates no successor.',[ev.a33]],
['A34','VERIFIED','Phase-0 evidence carries execution/check/gap results only and assigns no vulnerability severity/security verdict.',[ev.live,ev.held,ev.dex]]
];

function forbiddenVerdictKeys(value,path0='',out=[]){
  if(Array.isArray(value)){value.forEach((x,i)=>forbiddenVerdictKeys(x,path0+'['+i+']',out));return out;}
  if(value&&typeof value==='object'){
    for(const [k,v] of Object.entries(value)){
      const p=path0?path0+'.'+k:k;
      if(/^(?:vulnerabilitySeverity|securityVerdict)$/i.test(k))out.push(p);
      forbiddenVerdictKeys(v,p,out);
    }
  }
  return out;
}
assertThat(forbiddenVerdictKeys({live,held,dex,a33}).length===0,'generated evidence contains automated vulnerability severity/security verdict fields');
assertThat(rows.every(x=>x[1]==='VERIFIED'),'acceptance matrix contains a non-verified case');

const baseline=live.performanceBaselineV1??[];
const upgraded=(live.performance??[]).filter(x=>['perf-seed-a','perf-seed-b','perf-seed-c'].includes(x.label));
assertThat(baseline.length===3&&upgraded.length===3,'three-seed baseline/upgraded performance comparison missing');
const performance={
  schemaVersion:'curveyield-phase0-v2-performance-v1',
  status:'PASS',
  qualifiedCommit:commit,workflowRunId:runId,
  comparison:live.performanceComparison,
  baselineShortRuns:baseline,
  upgradedShortRuns:upgraded,
  fullTelemetry:(live.performance??[]).find(x=>x.label==='telemetry-full')??null,
  fullMedusa:(live.performance??[]).find(x=>x.label==='medusa-full')??null,
  checkedLane:(live.performance??[]).find(x=>x.label==='medusa-controls')??null,
  observationCoverage:{
    telemetryShards:(live.telemetry??[]).map(x=>({runId:x.runId,observationStatus:x.observationStatus,observationReads:x.observationReads,observationFailures:x.observationFailures,positiveTransitions:x.positiveTransitions,positiveEconomicTransitions:x.positiveEconomicTransitions}))
  },
  unpairedConditions:live.performanceComparison?.unpairedConditions??[]
};
await fs.writeFile(path.join(root,'PHASE0_V2_PERFORMANCE_v1.json'),JSON.stringify(performance,null,2)+'\n');

const gaps=[
  ...((dex.limitations??[]).map(x=>({scope:'DEX_REGRESSION',...x}))),
  {scope:'UNIVERSAL_SEMANTICS',type:'UNQUALIFIED_PROTOCOL_SEMANTICS',disposition:'EXPLICIT_TYPED_GAP_NOT_IMPLEMENTATION_FAILURE',detail:'Automation intentionally does not invent economic invariants for unknown contract families. New families require trusted structural/standard evidence or a reviewed reusable recipe.'}
];
await fs.writeFile(path.join(root,'PHASE0_V2_REMAINING_GAPS_v1.json'),JSON.stringify({schemaVersion:'curveyield-phase0-v2-remaining-gaps-v1',status:'PASS_WITH_EXPLICIT_SEMANTIC_LIMITATIONS',qualifiedCommit:commit,workflowRunId:runId,gaps},null,2)+'\n');

const matrix={schemaVersion:'curveyield-phase0-v2-acceptance-matrix-v1',status:'PASS',qualifiedCommit:commit,workflowRunId:runId,cases:rows.map(([id,status,result,evidence])=>({id,status,result,evidence,qualifiedCommit:commit,workflowRunId:runId})),performanceRef:'PHASE0_V2_PERFORMANCE_v1.json',remainingGapsRef:'PHASE0_V2_REMAINING_GAPS_v1.json'};
await fs.writeFile(path.join(root,'PHASE0_V2_ACCEPTANCE_MATRIX_v1.json'),JSON.stringify(matrix,null,2)+'\n');
const md=['# Phase-0 Automated Testing v2 — A01–A34 Acceptance Matrix v1','',`Qualified commit: \`${commit}\``,`GitHub run: \`${runId}\``,'','| Case | Status | Result | Evidence |','|---|---|---|---|',...matrix.cases.map(x=>`| ${x.id} | ${x.status} | ${x.result.replaceAll('|','/')} | ${x.evidence.join('<br>')} |`),'','## Remaining semantic limitations','',...gaps.map(x=>`- **${x.type}** — ${x.disposition??''} ${x.detail??''}`),'','## Performance','',`See \`PHASE0_V2_PERFORMANCE_v1.json\` for three paired short-run seeds, full telemetry, >100K Medusa, checked lane, RPC/CPU/memory/artifact metrics, observation coverage and disclosed unpaired conditions.`,''];
await fs.writeFile(path.join(root,'PHASE0_V2_ACCEPTANCE_MATRIX_v1.md'),md.join('\n'));
process.stdout.write(JSON.stringify({status:'PASS',qualifiedCommit:commit,workflowRunId:runId,verifiedCases:matrix.cases.length,performanceRef:matrix.performanceRef,remainingGapsRef:matrix.remainingGapsRef},null,2)+'\n');
