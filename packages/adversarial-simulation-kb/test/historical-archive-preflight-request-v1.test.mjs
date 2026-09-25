import test from 'node:test';
import assert from 'node:assert/strict';
import { buildEulerHistoricalArchivePreflightRequestV1 } from '../src/historical/archive-preflight-request-v1.mjs';

const SOURCE_COMMIT='ea28ee5f5eceb3f056517e2da17f357f49d97ae4';

test('K13 archive preflight request pins Euler pre-exploit state through the canonical Phase 7 runner',()=>{
  const request=buildEulerHistoricalArchivePreflightRequestV1({sourceCommit:SOURCE_COMMIT});
  assert.equal(request.phaseId,'fork-simulation-lifecycle');
  assert.equal(request.profileId,'github-native-simulate-v2');
  assert.deepEqual(request.configuration.harness,{recipeId:'external-readiness-v1'});
  assert.deepEqual(request.configuration.simulation,{chain:'ethereum',block:16817995,workflow:{steps:[
    {action:'staticCall',target:'0x27182842e098f60e3d576794a5bffb0777e025d3',function:'moduleId() view returns (bytes32)',args:[],label:'read Euler V1 module identity at pre-exploit block'}
  ]}});
  assert.deepEqual(request.configuration.deploymentGas,{deployableContracts:[
    {sourceName:'src/ControlledLendingFixture.sol',contractName:'ControlledLendingFixture'}
  ]});
  assert.equal(request.source.commit,SOURCE_COMMIT);
  assert.equal(request.source.projectPath,'packages/adversarial-simulation-kb/fixtures/pattern-0001-controlled-v1');
  assert.match(request.requestId,/^dar-[0-9a-f]{32}$/);
  assert.match(request.requestDigest,/^[0-9a-f]{64}$/);
});
