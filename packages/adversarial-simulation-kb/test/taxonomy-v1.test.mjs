import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validateTaxonomyV1, validatePrimitiveTagsV1, isKnownPrimitiveV1 } from '../src/taxonomy/validate-v1.mjs';

const path='packages/adversarial-simulation-kb/registry/ATTACK_PRIMITIVE_TAXONOMY_v1.json';
const REQUIRED = ['REENTRANCY','READ_ONLY_REENTRANCY','CALLBACK_REENTRANCY','PRICE_MANIPULATION','ORACLE_MANIPULATION','FLASH_LIQUIDITY','DONATION','SHARE_PRICE_INFLATION','FIRST_DEPOSITOR','ROUNDING','PRECISION_LOSS','ACCOUNTING_DESYNC','BALANCE_VS_ACCOUNTING','REWARD_INDEX_MANIPULATION','STALE_CHECKPOINT','ACCESS_CONTROL','ROLE_ESCALATION','INITIALIZATION','UPGRADEABILITY','PROXY_MISCONFIGURATION','SIGNATURE_REPLAY','PERMIT_ABUSE','APPROVAL_ABUSE','ARBITRARY_CALL','DELEGATECALL','TOKEN_CALLBACK','FEE_ON_TRANSFER','REBASING_TOKEN','ERC777_CALLBACK','ERC4626_EDGE','LIQUIDATION_BYPASS','SOLVENCY_BYPASS','COLLATERAL_MANIPULATION','BAD_DEBT_SOCIALIZATION','POOL_INDEX_ORIENTATION','SLIPPAGE_BYPASS','SANDWICHABLE_STATE','GOVERNANCE_CAPTURE','VOTE_FLASH_LOAN','CROSS_CHAIN_MESSAGE','REPLAY','FINALITY_ASSUMPTION','KEEPER_FAILURE','OFFCHAIN_AUTOMATION','DOS','GAS_GRIEFING','STORAGE_COLLISION','SELFDESTRUCT_OR_CODE_IDENTITY','EXTERNAL_DEPENDENCY'];

test('v1 taxonomy validates and contains every required initial primitive exactly once',()=>{
 const taxonomy=JSON.parse(fs.readFileSync(path,'utf8'));
 const result=validateTaxonomyV1(taxonomy);
 assert.equal(result.status,'PASS',JSON.stringify(result.errors));
 assert.deepEqual(new Set(taxonomy.primitives.map(x=>x.id)),new Set(REQUIRED));
 assert.equal(taxonomy.primitives.length,REQUIRED.length);
});

test('known multi-primitive classifications pass and unknown active tags fail closed',()=>{
 assert.equal(validatePrimitiveTagsV1(['DONATION','SHARE_PRICE_INFLATION','ACCOUNTING_DESYNC']).status,'PASS');
 assert.equal(validatePrimitiveTagsV1(['DONATION','TYPO_DONATON']).status,'FAIL');
 assert.equal(isKnownPrimitiveV1('ERC4626_EDGE'),true);
 assert.equal(isKnownPrimitiveV1('ERC4626-EDGE'),false);
});

test('taxonomy IDs are uppercase stable tokens and duplicates are rejected',()=>{
 const taxonomy=JSON.parse(fs.readFileSync(path,'utf8'));
 const dup=structuredClone(taxonomy); dup.primitives.push(structuredClone(dup.primitives[0]));
 assert.equal(validateTaxonomyV1(dup).status,'FAIL');
 const malformed=structuredClone(taxonomy); malformed.primitives[0].id='read only reentrancy';
 assert.equal(validateTaxonomyV1(malformed).status,'FAIL');
});

test('extension rules require explicit version lineage and forbid in-place removal',()=>{
 const taxonomy=JSON.parse(fs.readFileSync(path,'utf8'));
 assert.equal(taxonomy.extensionPolicy.mode,'APPEND_OR_NEW_VERSION');
 assert.equal(taxonomy.extensionPolicy.removePublishedPrimitive,'NEW_MAJOR_VERSION_OR_DEPRECATE');
 const bad=structuredClone(taxonomy); delete bad.extensionPolicy;
 assert.equal(validateTaxonomyV1(bad).status,'FAIL');
 const badVersion=structuredClone(taxonomy); badVersion.schemaVersion='adversarial-kb-taxonomy-v2';
 assert.equal(validateTaxonomyV1(badVersion).status,'FAIL');
});
