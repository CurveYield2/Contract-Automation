import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validateCoreRecordV1 } from '../src/core-schemas-v1.mjs';
import { buildRegistriesV1 } from '../src/registry/build-v1.mjs';
import {
  inspectRecipeBindingsV1,
  instantiateRecipeV1,
  validateRecipeTemplateV1,
} from '../src/recipes/bind-v1.mjs';

const ROOT='packages/adversarial-simulation-kb';
function json(path){ return JSON.parse(fs.readFileSync(path,'utf8')); }

const COMPLETE_BINDINGS={
  target:'fixture://lending-market',
  collateralAsset:'fixture://collateral-token',
  debtAsset:'fixture://debt-token',
  positionSetupAction:'fixture.setupPosition',
  collateralReductionAction:'fixture.reduceCollateralExceptionalPath',
  healthMetric:'fixture.accountHealth',
  liquidationAction:'fixture.liquidate',
  attackerValueObservation:'fixture.attackerNetValue',
};

test('K09 RECIPE-0001 is strict, generalized, backend-declared, and contains no historical target identity',()=>{
  const recipe=json(`${ROOT}/recipes/RECIPE-0001/recipe.json`);
  assert.equal(validateCoreRecordV1('recipe',recipe).status,'PASS');
  assert.equal(validateRecipeTemplateV1(recipe).status,'PASS');
  assert.equal(recipe.recipeId,'RECIPE-0001');
  assert.deepEqual(recipe.patternRefs,['PATTERN-0001']);
  assert.ok(recipe.requiredTargetBindings.length>=8);
  assert.ok(recipe.setupSteps.length>=2);
  assert.ok(recipe.attackSteps.length>=3);
  assert.ok(recipe.observations.length>=3);
  assert.ok(recipe.assertions.length>=2);
  assert.equal(recipe.backendSupport.foundry,'SUPPORTED');
  assert.equal(recipe.backendSupport.anvil,'SUPPORTED');

  const serialized=JSON.stringify(recipe);
  assert.doesNotMatch(serialized,/Euler|donateToReserves|0x[0-9a-fA-F]{40}|0x[0-9a-fA-F]{64}/);
});

test('K09 unresolved required bindings fail closed instead of partially instantiating',()=>{
  const recipe=json(`${ROOT}/recipes/RECIPE-0001/recipe.json`);
  const partial={...COMPLETE_BINDINGS};
  delete partial.liquidationAction;
  const inspection=inspectRecipeBindingsV1(recipe,partial);
  assert.equal(inspection.status,'BLOCKED');
  assert.deepEqual(inspection.missingRequired,['liquidationAction']);
  assert.throws(()=>instantiateRecipeV1(recipe,partial),/unresolved required recipe bindings/i);
});

test('K09 complete bindings instantiate mechanically and leave no unresolved placeholders',()=>{
  const recipe=json(`${ROOT}/recipes/RECIPE-0001/recipe.json`);
  const inspection=inspectRecipeBindingsV1(recipe,COMPLETE_BINDINGS);
  assert.equal(inspection.status,'READY');
  assert.deepEqual(inspection.missingRequired,[]);

  const instantiated=instantiateRecipeV1(recipe,COMPLETE_BINDINGS);
  assert.equal(instantiated.status,'READY');
  assert.equal(instantiated.recipeId,recipe.recipeId);
  assert.deepEqual(instantiated.bindings,COMPLETE_BINDINGS);
  assert.doesNotMatch(JSON.stringify(instantiated.steps),/\$\{binding:[^}]+\}/);
  assert.match(JSON.stringify(instantiated.steps),/fixture\.liquidate/);
  assert.match(JSON.stringify(instantiated.steps),/fixture\.attackerNetValue/);
});

test('K09 template validation rejects undeclared binding placeholders and historical hard-coded addresses',()=>{
  const recipe=json(`${ROOT}/recipes/RECIPE-0001/recipe.json`);
  const undeclared=structuredClone(recipe);
  undeclared.attackSteps.push({action:'${binding:notDeclared}'});
  assert.equal(validateRecipeTemplateV1(undeclared).status,'FAIL');

  const historical=structuredClone(recipe);
  historical.setupSteps.push({target:'0x27182842E098f60e3D576794A5bFFb0777E025d3'});
  assert.equal(validateRecipeTemplateV1(historical).status,'FAIL');
});

test('K09 recipe and SCHEMA_VALID recipe proof regenerate the checked-in current corpus registries',()=>{
  const incident=json(`${ROOT}/incidents/EXP-2023-0001/incident.json`);
  const incidentProof=json(`${ROOT}/incidents/EXP-2023-0001/proof.json`);
  const pattern=json(`${ROOT}/patterns/PATTERN-0001/pattern.json`);
  const recipe=json(`${ROOT}/recipes/RECIPE-0001/recipe.json`);
  const recipeProof=json(`${ROOT}/recipes/RECIPE-0001/proof.json`);
  const generated=buildRegistriesV1({incidents:[incident],patterns:[pattern],recipes:[recipe],executables:[],proofs:[incidentProof,recipeProof],relationships:[]}).registries;
  for(const name of Object.keys(generated)) assert.deepEqual(json(`${ROOT}/registry/${name}.json`),generated[name],name);
});
