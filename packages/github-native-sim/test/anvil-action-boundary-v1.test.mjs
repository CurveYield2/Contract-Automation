import test from 'node:test';
import assert from 'node:assert/strict';
import { runGitHubNativeJob } from '../src/run-job-file.mjs';

const sourceCommit='1'.repeat(40);
function request(){return{
  schemaVersion:'deep-assurance-github-request-v2',processId:'audit-v7-independent-review',
  contractAutomationRelease:{repository:'CurveYield2/Contract-Automation',branch:'recovery/v7-execution-layer-v1',commit:'612fa50264e587e3f24550bf4dae35719b04211c',contractVersion:'contract-automation-v7-relocated-v1'},
  runnerRelease:{version:'deep-assurance-github-bridge-v1',manifestSha256:'2bebd99bb8ae770eb2feca0de7dc7e54596127a0c768922189e907e6658773dc'},
  campaignId:'anvil-boundary-v1',assignmentId:'phase7-anvil-boundary-v1',phaseId:'fork-simulation-lifecycle',gateId:'phase7-anvil-only',profileId:'github-native-simulate-v2',
  source:{repository:'CurveYield2/Solo-Audit-Controller',commit:sourceCommit,projectPath:'target'},
  configuration:{
    compilers:[{language:'solidity',version:'0.8.28'}],analysis:{slither:false,medusa:false,nativeFuzz:false},optimizer:{enabled:true,runs:200},evmVersion:'cancun',viaIR:true,timeoutMinutes:20,
    deploymentGas:{deployableContracts:[{sourceName:'contracts/Vault.sol',contractName:'Vault'}]},
    simulation:{chain:'ethereum',block:25817400,workflow:{steps:[{action:'mine',blocks:1}]}}
  },
  requestId:`dar-${'2'.repeat(32)}`,requestDigest:'3'.repeat(64)
};}
const checkoutSource=async()=>({commit:sourceCommit,projectRoot:'/tmp/anvil-boundary',checkoutRoot:'/tmp/checkout'});
const buildProject=async()=>({status:'completed',system:'solc-standard-json',compilerVersion:'0.8.28',sourceInventory:['contracts/Vault.sol'],artifacts:[{sourceName:'contracts/Vault.sol',contractName:'Vault',abi:[],bytecode:'0x6000',deployedBytecode:'0x6000',gasEstimates:{creation:{totalCost:'12345'}}}]});

test('Anvil targeted preflight runs after accepted build and immediately before fork-engine launch',async()=>{
  const calls=[];
  const result=await runGitHubNativeJob(request(),{
    checkoutSource,
    buildProject:async(input)=>{calls.push('build');return buildProject(input);},
    environment:{SIM_ARCHIVE_PRIMARY_ETHEREUM_01:'https://archive.example'},
    preflightSimulation:async({build,request:observed})=>{calls.push('anvil-preflight');assert.equal(build.status,'completed');assert.equal(observed.configuration.simulation.block,25817400);return{status:'PREFLIGHT_PASS',firstFailure:null};},
    startSimulationEngine:async()=>{calls.push('anvil-start');return{engine:'anvil',runtime:{},aliases:{},async close(){}};},
    executeSimulationWorkflow:async()=>{calls.push('lifecycle');return{steps:[{index:0,action:'mine',status:'completed'}],context:{deployments:{}}};},
  });
  assert.equal(result.status,'completed');
  assert.deepEqual(calls,['build','anvil-preflight','anvil-start','lifecycle']);
});

test('Anvil targeted preflight failure blocks engine launch and all lifecycle mutations with exact diagnostic receipt',async()=>{
  const calls=[];
  const receipt={status:'PREFLIGHT_FAIL',firstFailure:'ABI_SIGNATURE_MISMATCH',diagnostics:[{failureCode:'ABI_SIGNATURE_MISMATCH',summary:'workflow call is absent from accepted artifact ABI',historicalSignatureId:'ANVIL-006',remediation:'repair exact ABI/function signature'}]};
  const result=await runGitHubNativeJob(request(),{
    checkoutSource,
    buildProject:async(input)=>{calls.push('build');return buildProject(input);},
    environment:{SIM_ARCHIVE_PRIMARY_ETHEREUM_01:'https://archive.example'},
    preflightSimulation:async()=>{calls.push('anvil-preflight');return receipt;},
    startSimulationEngine:async()=>{calls.push('anvil-start');throw new Error('Anvil must not launch after failed target preflight');},
    executeSimulationWorkflow:async()=>{calls.push('lifecycle');throw new Error('lifecycle must not run after failed target preflight');},
  });
  assert.equal(result.status,'failed');
  assert.equal(result.error.kind,'ABI_SIGNATURE_MISMATCH');
  assert.equal(result.simulation.status,'preflight_blocked');
  assert.equal(result.simulation.preflight.firstFailure,'ABI_SIGNATURE_MISMATCH');
  assert.deepEqual(calls,['build','anvil-preflight']);
});
