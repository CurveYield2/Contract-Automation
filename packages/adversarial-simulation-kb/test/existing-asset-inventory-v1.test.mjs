import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validateExistingAssetInventoryV1 } from '../src/existing-asset-inventory-v1.mjs';

const inventoryPath = 'process/ADVERSARIAL_KB_EXISTING_ASSET_INVENTORY_v1.json';

test('K01 inventory is complete, classified, and tied to the scanned baseline', () => {
  const inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
  const result = validateExistingAssetInventoryV1(inventory);
  assert.equal(result.status, 'PASS', JSON.stringify(result.errors));
  assert.equal(inventory.baselineMainSha, '468b749076fb5b9c166c14a187fdd29a6f967acd');
  assert.ok(inventory.assets.some((a) => a.assetId === 'ASSET-HARNESS-SKELETONS-V2' && a.classification === 'REUSE'));
  assert.ok(inventory.assets.some((a) => a.assetId === 'ASSET-HISTORICAL-EXPLOIT-FIXTURE-CORPUS' && a.classification === 'MISSING'));
  assert.ok(inventory.activeOverlaps.some((a) => a.pullRequest === 126 && a.classification === 'ADAPT'));
  assert.ok(inventory.activeOverlaps.some((a) => a.pullRequest === 122 && a.classification === 'ADAPT'));
});

test('unknown classifications and missing K01 categories are rejected', () => {
  const inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
  const bad = structuredClone(inventory);
  bad.assets[0].classification = 'COPY_IT';
  assert.equal(validateExistingAssetInventoryV1(bad).status, 'FAIL');
  const incomplete = structuredClone(inventory);
  incomplete.assets = incomplete.assets.filter((a) => a.category !== 'HISTORICAL_CAMPAIGN_SIMULATION');
  assert.equal(validateExistingAssetInventoryV1(incomplete).status, 'FAIL');
});

test('MISSING entries require an explicit reason and reusable scopes cannot be empty', () => {
  const inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
  const missing = structuredClone(inventory);
  const gap = missing.assets.find((a) => a.classification === 'MISSING');
  delete gap.reason;
  assert.equal(validateExistingAssetInventoryV1(missing).status, 'FAIL');
  const empty = structuredClone(inventory);
  const reusable = empty.assets.find((a) => a.classification === 'REUSE');
  reusable.paths = [];
  assert.equal(validateExistingAssetInventoryV1(empty).status, 'FAIL');
});
