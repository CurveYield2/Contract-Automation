import test from 'node:test';
import assert from 'node:assert/strict';
import { Interface } from 'ethers';
import { renderMedusaRouterV2, buildMedusaConfigV2 } from '../src/phase0-randomized-simulation-v1.mjs';

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
  assert.match(router.source,/Phase0TupleV2_0 calldata a0/);
  assert.doesNotMatch(router.source,/bytes calldata a0/);
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
  assert.match(router.source,/function property_p0_target_0\(\) external view returns\(bool\)/);
});
