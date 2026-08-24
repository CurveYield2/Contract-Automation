import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validateStableIdV1, validateRevisionSequenceV1, validateCoreRecordV1, CORE_REQUIRED_FIELDS_V1 } from '../src/core-schemas-v1.mjs';

const schemaPaths = {
  incident: 'packages/adversarial-simulation-kb/schemas/incident-v1.schema.json',
  pattern: 'packages/adversarial-simulation-kb/schemas/attack-pattern-v1.schema.json',
  recipe: 'packages/adversarial-simulation-kb/schemas/recipe-v1.schema.json',
  executable: 'packages/adversarial-simulation-kb/schemas/executable-v1.schema.json',
  proof: 'packages/adversarial-simulation-kb/schemas/proof-v1.schema.json',
};
const valid = {
  incident: {schemaVersion:'adversarial-kb-incident-v1',incidentId:'EXP-2023-0001',revision:1,title:'Verified vault accounting exploit',incidentDate:'2023-01-15',affectedProtocol:'ExampleProtocol',affectedChain:['ethereum'],affectedContracts:[],lossEstimate:{},sourceType:'HISTORICAL_EXPLOIT',incidentStatus:'VERIFIED',rootCauseSummary:'Donation changed balance-derived conversion accounting.',attackSummary:'Attacker donated assets and captured a conversion discrepancy.',preconditions:[],attackSteps:[],violatedProperties:[],affectedPatterns:['PATTERN-0001'],attackPrimitives:['DONATION'],applicabilitySignals:[],nonApplicabilitySignals:[],falsePositiveGuards:[],requiredCapabilities:[],runtimeRequirements:[],references:['SOURCE-0001'],reproductionRefs:['EXEC-0001'],generalizedPatternRefs:['PATTERN-0001'],proofStatusRef:'PROOF-0001',limitations:[]},
  pattern: {schemaVersion:'adversarial-kb-pattern-v1',patternId:'PATTERN-0001',revision:1,name:'Donation-driven share-rate inflation',description:'External donation changes a balance-derived share rate.',rootCauseClass:['DONATION','SHARE_PRICE_INFLATION'],structuralPreconditions:[],runtimePreconditions:[],attackerCapabilities:[],attackSequenceAbstract:[],expectedSecurityPropertyViolation:[],sourceIntelligenceSignals:[],runtimeOverlaySignals:[],nonApplicabilitySignals:[],falsePositiveGuards:['donations excluded from accounted assets'],adaptationRules:[],recommendedBackends:['foundry','anvil'],historicalIncidentRefs:['EXP-2023-0001'],recipeRefs:['RECIPE-0001'],limitations:[]},
  recipe: {schemaVersion:'adversarial-kb-recipe-v1',recipeId:'RECIPE-0001',revision:1,patternRefs:['PATTERN-0001'],targetTopologies:['ERC4626','SHARE_VAULT'],requiredTargetBindings:['asset','vault','depositFunction','withdrawFunction','shareBalanceAccessor','totalAssetsAccessor'],setupSteps:[],attackSteps:[],observations:[],assertions:[],adaptationInputs:[],backendSupport:{medusa:'SUPPORTED',foundry:'SUPPORTED',anvil:'SUPPORTED'},executableRefs:['EXEC-0001'],proofStatusRef:'PROOF-0001'},
  executable: {schemaVersion:'adversarial-kb-executable-v1',executableId:'EXEC-0001',revision:1,incidentRefs:['EXP-2023-0001'],patternRefs:['PATTERN-0001'],recipeRefs:['RECIPE-0001'],knowledgeBindings:[{kind:'incident',id:'EXP-2023-0001',revision:1,digest:'b'.repeat(64)},{kind:'pattern',id:'PATTERN-0001',revision:1,digest:'c'.repeat(64)},{kind:'recipe',id:'RECIPE-0001',revision:1,digest:'d'.repeat(64)}],backend:'foundry',toolVersion:'forge-1.3.1',language:'solidity',sourceFiles:[{path:'test/Donation.t.sol',digest:'a'.repeat(64)}],executionMode:'CONTROLLED',expectedSetup:[{kind:'POSITION_SETUP'}],requiredRpcForkState:{required:false,chain:null,archiveRequired:false,rpcEnvVar:null},requiredBlockIdentity:null,requiredImpersonation:[],requiredTokenBalances:[],expectedResult:{kind:'CONTROLLED_REPRODUCTION'},expectedEvidence:[{kind:'STATE_DELTA',required:true}],proofStatusRef:'PROOF-0001',lastQualification:null},
  proof: {schemaVersion:'adversarial-kb-proof-v1',proofId:'PROOF-0001',knowledgeRef:'EXEC-0001',proofTier:'SCHEMA_VALID',status:'ACTIVE',claim:'Record parses and references are structurally valid.',evidenceRefs:[],artifactDigests:[],runIds:[],qualifiedAtCommit:'468b749076fb5b9c166c14a187fdd29a6f967acd',limitations:[]}
};

test('all stable ID forms accept canonical values and reject malformed values', () => {
  for (const id of ['EXP-2023-0001','PATTERN-0001','RECIPE-0001','EXEC-0001','SOURCE-0001','PROOF-0001']) assert.equal(validateStableIdV1(id).status,'PASS');
  for (const id of ['EXP-23-1','PATTERN-1','RECIPE_0001','EXEC-00001','source-0001','PROOF-0000x']) assert.equal(validateStableIdV1(id).status,'FAIL');
});

test('all schema files are strict JSON schemas with matching schema IDs', () => {
  for (const [kind,path] of Object.entries(schemaPaths)) {
    const schema=JSON.parse(fs.readFileSync(path,'utf8'));
    assert.equal(schema.$schema,'https://json-schema.org/draft/2020-12/schema');
    assert.equal(schema.type,'object');
    assert.equal(schema.additionalProperties,false);
    assert.deepEqual(new Set(schema.required),new Set(CORE_REQUIRED_FIELDS_V1[kind]));
  }
});

test('representative records pass and every required-field omission fails', () => {
  for (const [kind,record] of Object.entries(valid)) {
    assert.equal(validateCoreRecordV1(kind,record).status,'PASS',kind);
    for (const field of CORE_REQUIRED_FIELDS_V1[kind]) {
      const broken=structuredClone(record); delete broken[field];
      assert.equal(validateCoreRecordV1(kind,broken).status,'FAIL',`${kind}:${field}`);
    }
  }
});

test('cross-reference ID classes and proof tiers are enforced', () => {
  const badIncident=structuredClone(valid.incident); badIncident.references=['EXP-2023-0001'];
  assert.equal(validateCoreRecordV1('incident',badIncident).status,'FAIL');
  const badPattern=structuredClone(valid.pattern); badPattern.falsePositiveGuards=[];
  assert.equal(validateCoreRecordV1('pattern',badPattern).status,'FAIL');
  const badProof=structuredClone(valid.proof); badProof.proofTier='JSON_LOOKS_FINE';
  assert.equal(validateCoreRecordV1('proof',badProof).status,'FAIL');
  const badExecutable=structuredClone(valid.executable); badExecutable.toolVersion='latest';
  assert.equal(validateCoreRecordV1('executable',badExecutable).status,'FAIL');
});

test('published revision sequence rejects ID reuse and regression', () => {
  assert.equal(validateRevisionSequenceV1([{id:'EXP-2023-0001',revision:1},{id:'EXP-2023-0001',revision:2}]).status,'PASS');
  assert.equal(validateRevisionSequenceV1([{id:'EXP-2023-0001',revision:1},{id:'EXP-2023-0001',revision:1}]).status,'FAIL');
  assert.equal(validateRevisionSequenceV1([{id:'EXP-2023-0001',revision:2},{id:'EXP-2023-0001',revision:1}]).status,'FAIL');
});
