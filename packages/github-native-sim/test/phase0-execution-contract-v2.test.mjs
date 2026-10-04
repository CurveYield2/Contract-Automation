import test from 'node:test';
import assert from 'node:assert/strict';
import { ParamType } from 'ethers';
import {
  CAPABILITY_CONTRACT_VERSION_V2,
  TERMINAL_OUTCOMES_V2,
  buildCallableInventoryV2,
  generateTypedValueV2,
  classifySemanticFamilyV2,
  classifyExecutionOutcomeV2,
  observationDeltaV2,
  assessMedusaV2,
  validateTelemetryCountersV2,
  migrateLegacyCapabilityV2,
  qualifyRecipeV2
} from '../src/phase0-execution-contract-v2.mjs';

const zero='0x0000000000000000000000000000000000000000';
const actor='0x0000000000000000000000000000000000000011';
const token='0x0000000000000000000000000000000000000022';

test('A03/A04 capability v2 inventory preserves overloads receive fallback and context dispositions',()=>{
  assert.equal(CAPABILITY_CONTRACT_VERSION_V2,'curveyield-phase0-execution-capability-v2');
  const abi=[
    'function f(uint256) external',
    'function f(address) external',
    'receive() external payable',
    'fallback() external payable'
  ];
  const rows=buildCallableInventoryV2({contractId:'c1',qualifiedName:'X.sol:X',abi,instantiated:true});
  assert.deepEqual(rows.map(x=>x.surfaceKind),['FUNCTION','FUNCTION','RECEIVE','FALLBACK']);
  assert.equal(new Set(rows.map(x=>x.executionKey)).size,4);
  assert.ok(rows.every(x=>['READY','CONTEXT_REQUIRED','FIXTURE_GAP','ABI_RESOURCE_LIMIT','UNSUPPORTED','NOT_EXTERNALLY_CALLABLE'].includes(x.disposition)));
});

test('A05 recursive ABI generator preserves fixed lengths, tuples, signed boundary and bytesN',()=>{
  const rng=()=>0;
  const ctx={addresses:[actor,token],limits:{maxDynamicArrayLength:3,maxDepth:8,maxTotalElements:64}};
  const fixed=generateTypedValueV2(ParamType.from('uint256[6]'),rng,ctx);
  assert.equal(fixed.value.length,6);
  assert.equal(fixed.limitation,null);
  const nested=generateTypedValueV2(ParamType.from('(int8,bytes7,address,(uint16,bool)[])[2]'),rng,ctx);
  assert.equal(nested.value.length,2);
  assert.equal(nested.value[0].length,4);
  assert.equal(nested.value[0][1].length,16);
  assert.equal(nested.limitation,null);
  const signed=generateTypedValueV2(ParamType.from('int8'),()=>0.99,ctx);
  assert.ok(['-128','127'].includes(String(signed.value)));
  const overflow=generateTypedValueV2(ParamType.from('uint256[100]'),rng,{...ctx,limits:{...ctx.limits,maxTotalElements:32}});
  assert.equal(overflow.value,null);
  assert.equal(overflow.limitation.code,'ABI_RESOURCE_LIMIT');
});

test('A12/A18 recipe qualification requires evidence and rejects standard-looking lookalikes',()=>{
  const erc20=[
    'function totalSupply() view returns (uint256)',
    'function balanceOf(address) view returns (uint256)',
    'function transfer(address,uint256) returns (bool)',
    'function approve(address,uint256) returns (bool)',
    'function allowance(address,address) view returns (uint256)',
    'function transferFrom(address,address,uint256) returns (bool)'
  ];
  const lookalike=qualifyRecipeV2({qualifiedName:'Custom.sol:Custom',abi:erc20,declaredStandards:[],implementationIdentity:null});
  assert.equal(lookalike.status,'ORACLE_GAP');
  const declared=qualifyRecipeV2({qualifiedName:'Token.sol:Token',abi:erc20,declaredStandards:['ERC20'],implementationIdentity:null});
  assert.equal(declared.status,'QUALIFIED');
  assert.equal(declared.recipeId,'erc20-standard-v1');
});

test('A22 semantic family separates mutability, authority/config and qualified economics',()=>{
  assert.equal(classifySemanticFamilyV2({signature:'transferOwnership(address)',stateMutability:'nonpayable'}).semanticFamily,'AUTHORITY_CONFIG');
  assert.equal(classifySemanticFamilyV2({signature:'multicall(bytes[])',stateMutability:'nonpayable'}).semanticFamily,'OTHER_MUTATION');
  assert.equal(classifySemanticFamilyV2({signature:'deposit(uint256,address)',stateMutability:'nonpayable'}).semanticFamily,'UNKNOWN');
  assert.equal(classifySemanticFamilyV2({signature:'deposit(uint256,address)',stateMutability:'nonpayable',recipe:{recipeId:'erc4626-standard-v1',functionFamilies:{'deposit(uint256,address)':'ECONOMIC'}}}).semanticFamily,'ECONOMIC');
  assert.equal(classifySemanticFamilyV2({signature:'balanceOf(address)',stateMutability:'view'}).semanticFamily,'VIEW');
});

test('A26 execution outcomes keep planning, simulated rejection, infrastructure, submitted unknown and mined results disjoint',()=>{
  assert.equal(new Set(TERMINAL_OUTCOMES_V2).size,7);
  assert.equal(classifyExecutionOutcomeV2({argumentGeneration:{success:false}}),'NOT_EXECUTED_ENCODING_OR_PLANNING');
  assert.equal(classifyExecutionOutcomeV2({argumentGeneration:{success:true},preflight:{success:false,kind:'PROTOCOL_REJECTION'}}),'SIMULATED_REJECTION');
  assert.equal(classifyExecutionOutcomeV2({argumentGeneration:{success:true},preflight:{success:false,kind:'INFRASTRUCTURE'}}),'SIMULATION_INFRASTRUCTURE_ERROR');
  assert.equal(classifyExecutionOutcomeV2({argumentGeneration:{success:true},preflight:{success:true},submission:{success:false}}),'SUBMISSION_INFRASTRUCTURE_ERROR');
  assert.equal(classifyExecutionOutcomeV2({argumentGeneration:{success:true},preflight:{success:true},submission:{success:true},receipt:null}),'SUBMITTED_OUTCOME_UNKNOWN');
  assert.equal(classifyExecutionOutcomeV2({argumentGeneration:{success:true},preflight:{success:true},submission:{success:true},receipt:{status:1}}),'MINED_SUCCESS');
  assert.equal(classifyExecutionOutcomeV2({argumentGeneration:{success:true},preflight:{success:true},submission:{success:true},receipt:{status:0}}),'MINED_REVERT');
});

test('A27/A28 observation delta is UNKNOWN when either comparable reading failed',()=>{
  assert.deepEqual(observationDeltaV2({status:'OK',value:'10',quantityId:'q',unit:'wei'},{status:'OK',value:'13',quantityId:'q',unit:'wei'}),{status:'KNOWN',value:'3'});
  assert.equal(observationDeltaV2({status:'FAILED',value:null,quantityId:'q',unit:'wei'},{status:'OK',value:'13',quantityId:'q',unit:'wei'}).status,'UNKNOWN');
  assert.equal(observationDeltaV2({status:'OK',value:'10',quantityId:'q',unit:'wei'},{status:'OK',value:'13',quantityId:'other',unit:'wei'}).status,'UNKNOWN');
});

test('A14/A16/A17 Medusa checked acceptance rejects zero tests, vacuity and missing observations',()=>{
  assert.equal(assessMedusaV2({mode:'CHECKED_DISCOVERY',observedCalls:138521,engineProperties:[],properties:[]}).checkStatus,'NO_PROPERTY_ASSURANCE');
  assert.equal(assessMedusaV2({mode:'CHECKED_DISCOVERY',observedCalls:100001,engineProperties:[{name:'property_x',status:'passed'}],properties:[{propertyId:'p1',category:'TARGET_BEHAVIOR',discoveredByEngine:true,preconditionWitnessRefs:[],executionEvidenceRefs:['e'],result:'CHECKED_NO_DEVIATION_OBSERVED'}]}).checkStatus,'PARTIAL');
  assert.equal(assessMedusaV2({mode:'CHECKED_DISCOVERY',observedCalls:100001,engineProperties:[{name:'property_x',status:'passed'}],properties:[{propertyId:'p1',category:'TARGET_BEHAVIOR',discoveredByEngine:true,preconditionWitnessRefs:['w'],executionEvidenceRefs:['e'],result:'OBSERVATION_GAP'}]}).checkStatus,'PARTIAL');
  assert.equal(assessMedusaV2({mode:'CHECKED_DISCOVERY',observedCalls:100001,engineProperties:[{name:'property_x',status:'passed'}],properties:[{propertyId:'p1',category:'TARGET_BEHAVIOR',discoveredByEngine:true,preconditionWitnessRefs:['w'],executionEvidenceRefs:['e'],result:'CHECKED_NO_DEVIATION_OBSERVED'}]}).checkStatus,'CHECKED');
});

test('A30 telemetry summary must exactly reconcile disjoint raw outcomes',()=>{
  const rows=[
    {executionOutcome:'MINED_SUCCESS',semanticFamily:'ECONOMIC',positiveTransition:true},
    {executionOutcome:'MINED_REVERT',semanticFamily:'ECONOMIC',positiveTransition:false},
    {executionOutcome:'SIMULATED_REJECTION',semanticFamily:'AUTHORITY_CONFIG',positiveTransition:false},
    {executionOutcome:'NOT_EXECUTED_ENCODING_OR_PLANNING',semanticFamily:'UNKNOWN',positiveTransition:false}
  ];
  const good={plannedActions:4,terminalActions:4,submittedActions:2,minedSuccess:1,minedRevert:1,simulatedRejection:1,notExecutedEncodingOrPlanning:1,positiveEconomicTransitions:1};
  assert.equal(validateTelemetryCountersV2(good,rows).status,'PASS');
  assert.throws(()=>validateTelemetryCountersV2({...good,minedSuccess:2},rows));
});

test('A31 legacy quantity-only PASS is retained as discovery-only and cannot satisfy v2 gates',()=>{
  const migrated=migrateLegacyCapabilityV2({schemaVersion:'curveyield-phase0-randomized-simulation-summary-v1',status:'PASS',medusa:{observedCalls:138521,status:'PASS'},telemetry:[{calls:1200,status:'PASS'}]});
  assert.equal(migrated.capabilityContractVersion,CAPABILITY_CONTRACT_VERSION_V2);
  assert.equal(migrated.legacyDisposition,'LEGACY_LIMITED');
  assert.equal(migrated.checkStatus,'NO_PROPERTY_ASSURANCE');
  assert.notEqual(migrated.reachabilityStatus,'REACHABLE');
});

test('A34 Phase-0 capability helpers never assign vulnerability severity or security verdicts',()=>{
  const values=[
    classifySemanticFamilyV2({signature:'transferOwnership(address)',stateMutability:'nonpayable'}),
    assessMedusaV2({mode:'DISCOVERY_ONLY',observedCalls:100001,engineProperties:[],properties:[]}),
    migrateLegacyCapabilityV2({status:'PASS',medusa:{observedCalls:1},telemetry:[]})
  ];
  const serialized=JSON.stringify(values).toLowerCase();
  assert.doesNotMatch(serialized,/"severity"/);
  assert.doesNotMatch(serialized,/"securityverdict"/);
});
