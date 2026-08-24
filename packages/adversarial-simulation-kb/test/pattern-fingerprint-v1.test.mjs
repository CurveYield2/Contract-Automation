import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validateCoreRecordV1 } from '../src/core-schemas-v1.mjs';
import { validatePrimitiveTagsV1 } from '../src/taxonomy/validate-v1.mjs';
import { buildRegistriesV1 } from '../src/registry/build-v1.mjs';
import {
  buildRootCauseFingerprintV1,
  fingerprintKeyV1,
  validateRootCauseFingerprintV1,
} from '../src/patterns/fingerprint-v1.mjs';

const ROOT='packages/adversarial-simulation-kb';
function json(path){ return JSON.parse(fs.readFileSync(path,'utf8')); }

const DIMENSIONS={
  protocolTopology:'COLLATERALIZED_LENDING_LIQUIDATION',
  stateVariableClass:['COLLATERAL_ACCOUNTING','DEBT_ACCOUNTING','RESERVE_ACCOUNTING'],
  assetAccountingModel:'INTERNAL_COLLATERAL_DEBT_LEDGER',
  attackerCapabilities:['ATTACKER_CONTROLLED_LIQUIDATOR','ATTACKER_CONTROLLED_VIOLATOR','TEMPORARY_LIQUIDITY','USER_CALLABLE_COLLATERAL_REDUCTION'],
  triggerAction:'COLLATERAL_REDUCTION_WITHOUT_HEALTH_CHECK',
  incorrectAssumption:'ALL_COLLATERAL_REDUCING_PATHS_PRESERVE_SOLVENCY',
  violatedInvariantClass:'POST_ACTION_SOLVENCY',
  valueExtractionMechanism:'PROFITABLE_SELF_LIQUIDATION',
  externalDependencyRole:'TEMPORARY_LIQUIDITY_AMPLIFICATION',
  primitiveRefs:['ACCOUNTING_DESYNC','COLLATERAL_MANIPULATION','DONATION','FLASH_LIQUIDITY','SOLVENCY_BYPASS'],
};

test('K08 root-cause fingerprint normalizes every v3 dimension deterministically',()=>{
  const fingerprint=buildRootCauseFingerprintV1(DIMENSIONS);
  assert.equal(validateRootCauseFingerprintV1(fingerprint).status,'PASS');
  assert.equal(fingerprint.schemaVersion,'adversarial-kb-root-cause-fingerprint-v1');
  assert.deepEqual(fingerprint.stateVariableClass,[...DIMENSIONS.stateVariableClass].sort());
  assert.deepEqual(fingerprint.attackerCapabilities,[...DIMENSIONS.attackerCapabilities].sort());
  assert.deepEqual(fingerprint.primitiveRefs,[...DIMENSIONS.primitiveRefs].sort());

  const shuffled=structuredClone(DIMENSIONS);
  shuffled.stateVariableClass.reverse();
  shuffled.attackerCapabilities.reverse();
  shuffled.primitiveRefs.reverse();
  assert.equal(fingerprintKeyV1(buildRootCauseFingerprintV1(shuffled)),fingerprintKeyV1(fingerprint));
});

test('K08 PATTERN-0001 is mechanism-general and linked bidirectionally to EXP-2023-0001',()=>{
  const incident=json(`${ROOT}/incidents/EXP-2023-0001/incident.json`);
  const pattern=json(`${ROOT}/patterns/PATTERN-0001/pattern.json`);
  assert.equal(validateCoreRecordV1('pattern',pattern).status,'PASS');
  assert.equal(pattern.patternId,'PATTERN-0001');
  assert.ok(pattern.historicalIncidentRefs.includes(incident.incidentId));
  assert.ok(incident.affectedPatterns.includes(pattern.patternId));
  assert.ok(incident.generalizedPatternRefs.includes(pattern.patternId));
  assert.equal(validatePrimitiveTagsV1(pattern.rootCauseClass).status,'PASS');

  const serialized=JSON.stringify(pattern);
  assert.doesNotMatch(serialized,/Euler|donateToReserves|0x[0-9a-fA-F]{40}|0x[0-9a-fA-F]{64}/);
});

test('K08 applicability, non-applicability, and false-positive guards are explicit and machine-present',()=>{
  const pattern=json(`${ROOT}/patterns/PATTERN-0001/pattern.json`);
  assert.ok(pattern.structuralPreconditions.length>=3);
  assert.ok(pattern.runtimePreconditions.length>=2);
  assert.ok(pattern.sourceIntelligenceSignals.length>=3);
  assert.ok(pattern.runtimeOverlaySignals.length>=2);
  assert.ok(pattern.nonApplicabilitySignals.length>=3);
  assert.ok(pattern.falsePositiveGuards.length>=4);
  assert.ok(pattern.adaptationRules.length>=3);

  const noGuards=structuredClone(pattern);
  noGuards.falsePositiveGuards=[];
  assert.equal(validateCoreRecordV1('pattern',noGuards).status,'FAIL');
});

test('K08 checked-in fingerprint matches pattern semantics and rejects incomplete fingerprints',()=>{
  const fingerprint=json(`${ROOT}/patterns/PATTERN-0001/fingerprint.json`);
  const pattern=json(`${ROOT}/patterns/PATTERN-0001/pattern.json`);
  assert.equal(validateRootCauseFingerprintV1(fingerprint).status,'PASS');
  assert.deepEqual(pattern.rootCauseClass,fingerprint.primitiveRefs.filter(x=>x!=='FLASH_LIQUIDITY'));
  const missing=structuredClone(fingerprint);
  delete missing.valueExtractionMechanism;
  assert.equal(validateRootCauseFingerprintV1(missing).status,'FAIL');
});

test('K08 current incident-pattern corpus regenerates the checked-in deterministic registries',()=>{
  const incident=json(`${ROOT}/incidents/EXP-2023-0001/incident.json`);
  const pattern=json(`${ROOT}/patterns/PATTERN-0001/pattern.json`);
  const proof=json(`${ROOT}/incidents/EXP-2023-0001/proof.json`);
  const generated=buildRegistriesV1({incidents:[incident],patterns:[pattern],recipes:[],executables:[],proofs:[proof],relationships:[]}).registries;
  for(const name of Object.keys(generated)) assert.deepEqual(json(`${ROOT}/registry/${name}.json`),generated[name],name);
});
