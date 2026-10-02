import test from 'node:test';
import assert from 'node:assert/strict';
import { getV7LifecycleRecipeV1, validateWorkflowAgainstV7RecipeV1, registerV7LifecycleRecipeExtensionV1, V7_LIFECYCLE_RECIPES_V1 } from '../src/lifecycle-recipes-v1.mjs';

test('repeated-lifecycle-v1 requires fresh deployment and permits repeated deterministic state/time actions',()=>{
  const resolved=getV7LifecycleRecipeV1('repeated-lifecycle-v1');
  assert.equal(resolved.status,'SUPPORTED');
  assert.equal(resolved.recipe.requiresFreshDeployment,true);
  const workflow={steps:[
    {action:'snapshot',label:'cycle baseline'},
    {action:'deploy',alias:'vault',contract:'CurveYieldVault',source:'contracts/CurveYieldVault.sol',args:[],from:'$account0',label:'deploy audited vault'},
    {action:'call',target:'$vault',function:'harvest()',args:[],from:'$account0',label:'cycle 1 action'},
    {action:'increaseTime',seconds:3600,label:'cycle 1 time'},
    {action:'mine',blocks:1,label:'cycle 1 mine'},
    {action:'call',target:'$vault',function:'harvest()',args:[],from:'$account0',label:'cycle 2 action'},
    {action:'increaseTime',seconds:3600,label:'cycle 2 time'},
    {action:'mine',blocks:1,label:'cycle 2 mine'},
    {action:'revertSnapshot',snapshot:'$cycleBaseline',label:'restore baseline'}
  ]};
  const result=validateWorkflowAgainstV7RecipeV1('repeated-lifecycle-v1',workflow);
  assert.equal(result.status,'SUPPORTED');
  assert.equal(result.deploymentPrerequisite?.status,'SATISFIED');
  assert.deepEqual(result.repeatedLifecycleFailures,[]);
});

test('repeated lifecycle cannot bypass deployment-first policy',()=>{
  const result=validateWorkflowAgainstV7RecipeV1('repeated-lifecycle-v1',{steps:[
    {action:'call',target:'$vault',label:'cycle 1 action'},
    {action:'call',target:'$vault',label:'cycle 2 action'}
  ]});
  assert.equal(result.status,'RECIPE_GAP');
  assert.equal(result.deploymentPrerequisite?.status,'MISSING_FRESH_DEPLOYMENT');
});

test('unsupported action remains RECIPE_GAP',()=>{
  const result=validateWorkflowAgainstV7RecipeV1('repeated-lifecycle-v1',{steps:[{action:'shell',label:'bad'}]});
  assert.equal(result.status,'RECIPE_GAP');
});

test('extension registration cannot mutate or replace canonical recipes',()=>{
  assert.throws(()=>registerV7LifecycleRecipeExtensionV1(V7_LIFECYCLE_RECIPES_V1,{id:'repeated-lifecycle-v1',allowedActions:['call'],requiredLabels:[]}),/duplicate|canonical/i);
  assert.throws(()=>registerV7LifecycleRecipeExtensionV1(V7_LIFECYCLE_RECIPES_V1,{id:'custom-v1',allowedActions:['shell'],requiredLabels:[]}),/unsupported action/i);
  const registry=registerV7LifecycleRecipeExtensionV1(V7_LIFECYCLE_RECIPES_V1,{id:'custom-v1',purpose:'reviewed extension',allowedActions:['call','staticCall'],requiredLabels:['required check']});
  assert.ok(registry['custom-v1']);
  assert.ok(registry['repeated-lifecycle-v1']);
});
