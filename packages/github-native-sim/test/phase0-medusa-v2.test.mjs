import test from 'node:test';
import assert from 'node:assert/strict';
import { Interface, AbiCoder, getBytes, id, getAddress } from 'ethers';
import { createRequire } from 'node:module';
import { renderMedusaRouterV2, buildMedusaConfigV2, medusaCoverageTimelineV2, medusaVarietyV2 } from '../src/phase0-randomized-simulation-v1.mjs';

const artifact={
  sourceName:'Fixture.sol',contractName:'Fixture',
  abi:[
    'function mutate((uint256,address) x) external',
    'function property_target_consistent() external view returns (bool)'
  ]
};
const iface=new Interface(artifact.abi);
const target={
  qualifiedName:'Fixture.sol:Fixture',
  address:'0x0000000000000000000000000000000000001234',
  artifact,
  functions:[{
    fragment:iface.getFunction('mutate'),
    signature:'mutate((uint256,address))',
    accounting:false,
    semanticFamily:'OTHER_MUTATION',
    semanticBasis:'FIXTURE'
  }],
  recipe:{status:'ORACLE_GAP'}
};

test('A09/A19 Medusa router preserves fuzz sender at target and supports tuple arguments without raw-byte substitution',()=>{
  const router=renderMedusaRouterV2({Interface,id:(x)=>'0x'+('12'.repeat(32)),getAddress:(x)=>x},[target]);
  assert.equal(router.rows.length,1);
  assert.match(router.source,/interface Phase0MedusaCheatCodesV2/);
  assert.match(router.source,/0x7109709ECfa91a80626fF3989D68f67F5b1DD12D/);
  assert.match(router.source,/\.prank\(msg\.sender\)/);
  assert.match(router.source,/struct Phase0TupleV2_0/);
  assert.match(router.source,/function p0_other_0\(Phase0TupleV2_0 calldata\) external/);
  assert.match(router.source,/msg\.data\[4:\]/);
  assert.equal(router.rows[0].wrapperSignature,'Phase0MedusaRouterV1.p0_other_0(((uint256,address)))');
});

test('A13/A14 checked Medusa config enables real checks and fails closed when no tests are discoverable',()=>{
  const checked=buildMedusaConfigV2({anvilUrl:'http://127.0.0.1:8545',blockNumber:123,routerRows:[{wrapperName:'p0_action_0',signature:'mutate((uint256,address))'}],checked:true,callLimit:125000});
  assert.equal(checked.fuzzing.testing.propertyTesting.enabled,true);
  assert.equal(checked.fuzzing.testing.assertionTesting.enabled,true);
  assert.equal(checked.fuzzing.testing.stopOnNoTests,true);
  assert.equal(checked.fuzzing.testLimit,125000);
  const discovery=buildMedusaConfigV2({anvilUrl:'http://127.0.0.1:8545',blockNumber:123,routerRows:[{wrapperName:'p0_action_0',signature:'mutate((uint256,address))'}],checked:false,callLimit:125000});
  assert.equal(discovery.fuzzing.testing.propertyTesting.enabled,false);
  assert.equal(discovery.fuzzing.testing.assertionTesting.enabled,false);
  assert.equal(discovery.fuzzing.testing.stopOnNoTests,false);
});

test('A13/A17 router exposes explicit packet-declared property functions as target-behavior checks, not harness-only controls',()=>{
  const router=renderMedusaRouterV2({Interface,id:(x)=>'0x'+('34'.repeat(32)),getAddress:(x)=>x},[target]);
  assert.equal(router.properties.length,1);
  assert.equal(router.properties[0].category,'TARGET_BEHAVIOR');
  assert.equal(router.properties[0].targetSignature,'property_target_consistent()');
  assert.match(router.source,/function property_p0_target_0\(\) external returns\(bool\)/);
});

const wideAbi=['function create(string name,string symbol,(address,uint8,address,bool)[] tokens,(address,address,address) roles,uint256 swapFee,(uint256,uint256,uint256,bool,bool) params,uint256 a,uint256 b,bytes32 salt) external returns (address)'];
const wideIface=new Interface(wideAbi);
const wideTarget={
  qualifiedName:'Factory.sol:Factory',address:'0x0000000000000000000000000000000000005678',
  artifact:{sourceName:'Factory.sol',contractName:'Factory',abi:wideAbi},
  functions:[{fragment:wideIface.getFunction('create'),signature:wideIface.getFunction('create').format('sighash'),accounting:false,semanticFamily:'UNKNOWN'}],
  recipe:{status:'ORACLE_GAP'}
};

test('Medusa router wrappers for high-arity dynamic functions compile without stack-too-deep',()=>{
  const router=renderMedusaRouterV2({Interface,id,getAddress},[wideTarget]);
  const solc=createRequire(import.meta.url)('solc');
  const out=JSON.parse(solc.compile(JSON.stringify({language:'Solidity',sources:{'R.sol':{content:router.source}},settings:{optimizer:{enabled:true,runs:200},evmVersion:'cancun',outputSelection:{'*':{'*':['evm.bytecode.object']}}}})));
  const errors=(out.errors??[]).filter(x=>x.severity==='error');
  assert.deepEqual(errors.map(x=>x.formattedMessage),[]);
});

test('Medusa router forwards wrapper calldata byte-for-byte as the target call arguments',()=>{
  const router=renderMedusaRouterV2({Interface,id,getAddress},[wideTarget]);
  const row=router.rows[0],fragment=wideIface.getFunction('create');
  const args=['N','S',[['0x0000000000000000000000000000000000000001',1,'0x0000000000000000000000000000000000000002',true]],['0x0000000000000000000000000000000000000003','0x0000000000000000000000000000000000000004','0x0000000000000000000000000000000000000005'],7n,[1n,2n,3n,true,false],8n,9n,'0x'+'ab'.repeat(32)];
  const coder=AbiCoder.defaultAbiCoder();
  const wrapperArgs=coder.encode([`(${fragment.inputs.map(p=>p.format('sighash')).join(',')})`],[args]);
  assert.match(router.source,/msg\.data\[36:\]/);
  const forwarded=getBytes(wrapperArgs).slice(32);
  assert.deepEqual(forwarded,getBytes(coder.encode(fragment.inputs,args)));
  assert.equal(row.wrapperSignature,`Phase0MedusaRouterV1.${row.wrapperName}((${fragment.inputs.map(p=>p.format('sighash')).join(',')}))`);
});

test('Medusa variety gate fails a run whose coverage plateaued and passes one still discovering',()=>{
  const line=(t,c,b,k)=>`fuzz: elapsed: ${t}, calls: ${c} (1/sec), seq/s: 0, branches: ${b}, corpus: ${k}, failures: 0/0, gas/s: 1`;
  const cycling=[line('3s',2817,4549,248),line('12s',45966,4666,259),line('1m30s',138521,4666,259)].join('\n');
  const discovering=[line('3s',160,4496,154),line('2m00s',654,7615,535),line('5m00s',1018,9034,728)].join('\n');
  const timeline=medusaCoverageTimelineV2(cycling);
  assert.equal(timeline.at(-1).elapsedSeconds,90);
  const plateau=medusaVarietyV2({timeline,dispatch:{representedLogicalFunctionCount:10,uniqueCallChainPairs:50}});
  assert.equal(plateau.status,'FAIL');
  assert.ok(plateau.repetitionRate>0.6);
  assert.deepEqual(plateau.failures,['COVERAGE_PLATEAUED_CALLS_ARE_REPEATING']);
  const fresh=medusaVarietyV2({timeline:medusaCoverageTimelineV2(discovering),dispatch:{representedLogicalFunctionCount:10,uniqueCallChainPairs:50}});
  assert.equal(fresh.status,'PASS');
  assert.equal(fresh.repetitionRate,0);
  const narrow=medusaVarietyV2({timeline:medusaCoverageTimelineV2(discovering),dispatch:{representedLogicalFunctionCount:10,uniqueCallChainPairs:3}});
  assert.deepEqual(narrow.failures,['TOO_FEW_UNIQUE_CALL_CHAIN_PAIRS']);
});
