import test from 'node:test';
import assert from 'node:assert/strict';
import { runGitHubNativeJob } from '../src/run-job-file.mjs';

function request(){return{
  schemaVersion:'deep-assurance-github-request-v2',processId:'audit-v7-independent-review',
  contractAutomationRelease:{repository:'CurveYield2/Contract-Automation',branch:'recovery/v7-execution-layer-v1',commit:'612fa50264e587e3f24550bf4dae35719b04211c',contractVersion:'contract-automation-v7-relocated-v1'},
  runnerRelease:{version:'deep-assurance-github-bridge-v1',manifestSha256:'2bebd99bb8ae770eb2feca0de7dc7e54596127a0c768922189e907e6658773dc'},
  campaignId:'slither-boundary-v1',assignmentId:'reviewer-2-phase6-slither-boundary-v1',phaseId:'build-and-test',gateId:'exact-build-and-tests-complete',profileId:'github-native-compile-v2',
  source:{repository:'CurveYield2/Audits',commit:'1'.repeat(40),projectPath:'audit-targets/example'},
  configuration:{compilers:[{language:'solidity',version:'0.8.28'}],timeoutMinutes:20,analysis:{slither:{version:'0.11.6'}}},
  requestId:`dar-${'2'.repeat(32)}`,requestDigest:'3'.repeat(64),
};}

function common(calls){return{
  checkoutSource:async()=>{calls.push('checkout');return{checkoutRoot:'/tmp/slither-boundary',projectRoot:'/tmp/slither-boundary/project',commit:'1'.repeat(40)};},
  buildProject:async()=>{calls.push('build');return{status:'completed',system:'solc-standard-json',compilerVersion:'0.8.28',sourceInventory:['contracts/A.sol'],artifacts:[]};},
};}

test('Slither targeted preflight executes after accepted build and immediately before substantive Slither',async()=>{
  const calls=[];
  const result=await runGitHubNativeJob(request(),{
    ...common(calls),
    preflightSlither:async({build,projectRoot})=>{calls.push('slither-preflight');assert.equal(build.status,'completed');assert.equal(projectRoot,'/tmp/slither-boundary/project');return{status:'PREFLIGHT_PASS',firstFailure:null};},
    runSlither:async()=>{calls.push('slither');return{backend:'slither',status:'completed',terminal:true,componentStatus:'COMPLETED',continuationDisposition:'COMPLETE_EVIDENCE'};},
  });
  assert.equal(result.status,'completed');
  assert.deepEqual(calls,['checkout','build','slither-preflight','slither']);
});

test('Slither targeted preflight failure blocks Slither but preserves continuation and exact diagnostic receipt',async()=>{
  const calls=[];
  const receipt={status:'PREFLIGHT_FAIL',firstFailure:'SLITHER_BUILD_VIEW_INCOMPATIBLE',diagnostics:[{failureCode:'SLITHER_BUILD_VIEW_INCOMPATIBLE',summary:'crytic compile cannot consume accepted project view',remediation:'repair project view'}]};
  const result=await runGitHubNativeJob(request(),{
    ...common(calls),
    preflightSlither:async()=>{calls.push('slither-preflight');return receipt;},
    runSlither:async()=>{calls.push('slither');throw new Error('substantive Slither must not execute');},
  });
  assert.equal(result.status,'completed');
  assert.equal(result.analysis.slither.status,'preflight_blocked');
  assert.equal(result.analysis.slither.failureKind,'SLITHER_BUILD_VIEW_INCOMPATIBLE');
  assert.equal(result.analysis.slither.preflight.firstFailure,'SLITHER_BUILD_VIEW_INCOMPATIBLE');
  assert.equal(result.continuityDisposition,'CONTINUE_WITH_LIMITATION');
  assert.deepEqual(calls,['checkout','build','slither-preflight']);
});
