import { createHash } from 'node:crypto';

const SHA=/^[0-9a-f]{40}$/;
const REQUEST_ID='dar-13000000000000000000000000000001';

function digest(value){
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export function buildEulerHistoricalArchivePreflightRequestV1({sourceCommit}={}){
  if(typeof sourceCommit!=='string'||!SHA.test(sourceCommit)) throw new Error('sourceCommit must be an exact lowercase 40-character commit SHA');
  const request={
    schemaVersion:'deep-assurance-github-request-v2',
    processId:'audit-v7-independent-review',
    contractAutomationRelease:{
      repository:'CurveYield2/Contract-Automation',
      branch:'recovery/v7-execution-layer-v1',
      commit:'612fa50264e587e3f24550bf4dae35719b04211c',
      contractVersion:'contract-automation-v7-relocated-v1',
    },
    runnerRelease:{
      version:'deep-assurance-github-bridge-v1',
      manifestSha256:'2bebd99bb8ae770eb2feca0de7dc7e54596127a0c768922189e907e6658773dc',
    },
    campaignId:'adversarial-kb-k13-exp-2023-0001',
    assignmentId:'k13-euler-pre-exploit-archive-preflight',
    phaseId:'fork-simulation-lifecycle',
    gateId:'K13-HISTORICAL-ARCHIVE-PREFLIGHT',
    profileId:'github-native-simulate-v2',
    source:{
      repository:'CurveYield2/Contract-Automation',
      commit:sourceCommit,
      projectPath:'packages/adversarial-simulation-kb/fixtures/pattern-0001-controlled-v1',
    },
    configuration:{
      compilers:[{language:'solidity',version:'0.8.24'}],
      timeoutMinutes:20,
      analysis:{slither:false,medusa:false,nativeFuzz:false},
      optimizer:{enabled:true,runs:200},
      evmVersion:'paris',
      viaIR:false,
      deploymentGas:{deployableContracts:[
        {sourceName:'src/ControlledLendingFixture.sol',contractName:'ControlledLendingFixture'},
      ]},
      harness:{recipeId:'external-readiness-v1'},
      simulation:{chain:'ethereum',block:16817995,workflow:{steps:[
        {action:'staticCall',target:'0x27182842e098f60e3d576794a5bffb0777e025d3',function:'moduleId() view returns (bytes32)',args:[],label:'read Euler V1 module identity at pre-exploit block'},
      ]}},
    },
    requestId:REQUEST_ID,
  };
  return {...request,requestDigest:digest(request)};
}
