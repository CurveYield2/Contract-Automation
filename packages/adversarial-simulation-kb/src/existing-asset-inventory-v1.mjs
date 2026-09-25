const CLASSIFICATIONS = new Set(['REUSE','ADAPT','ARCHIVE','MISSING']);
const REQUIRED_CATEGORIES = new Set([
  'HARNESS_SKELETON',
  'PHASE7_LIFECYCLE_RECIPE',
  'HISTORICAL_EXPLOIT_FIXTURE',
  'EXECUTION_EVIDENCE_PREFLIGHT',
  'HISTORICAL_CAMPAIGN_SIMULATION',
]);
const SHA40=/^[0-9a-f]{40}$/;
function text(v){return typeof v==='string'&&v.trim().length>0;}
export function validateExistingAssetInventoryV1(inventory){
  const errors=[]; const fail=(ok,code,detail=null)=>{if(!ok)errors.push({code,detail});};
  fail(inventory&&typeof inventory==='object'&&!Array.isArray(inventory),'INVENTORY_OBJECT_REQUIRED');
  if(!inventory||typeof inventory!=='object'||Array.isArray(inventory))return{status:'FAIL',errors};
  fail(inventory.schemaVersion==='adversarial-kb-existing-asset-inventory-v1','SCHEMA_VERSION');
  fail(inventory.repository==='CurveYield2/Contract-Automation','REPOSITORY');
  fail(SHA40.test(inventory.baselineMainSha??''),'BASELINE_SHA');
  fail(Array.isArray(inventory.scannedScopes)&&inventory.scannedScopes.length>0,'SCANNED_SCOPES');
  fail(Array.isArray(inventory.assets)&&inventory.assets.length>0,'ASSETS_REQUIRED');
  const ids=new Set(); const cats=new Set();
  for(const asset of inventory.assets??[]){
    fail(text(asset.assetId),'ASSET_ID'); fail(!ids.has(asset.assetId),'DUPLICATE_ASSET_ID',asset.assetId); ids.add(asset.assetId);
    fail(text(asset.category),'CATEGORY',asset.assetId); cats.add(asset.category);
    fail(CLASSIFICATIONS.has(asset.classification),'CLASSIFICATION',asset.assetId);
    fail(Array.isArray(asset.paths),'PATHS_ARRAY',asset.assetId);
    if(asset.classification!=='MISSING') fail(asset.paths.length>0,'CLASSIFIED_ASSET_PATH_REQUIRED',asset.assetId);
    if(asset.classification==='MISSING') fail(text(asset.reason),'MISSING_REASON_REQUIRED',asset.assetId);
    fail(text(asset.rationale),'RATIONALE_REQUIRED',asset.assetId);
  }
  for(const category of REQUIRED_CATEGORIES) fail(cats.has(category),'REQUIRED_CATEGORY_MISSING',category);
  fail(Array.isArray(inventory.activeOverlaps),'ACTIVE_OVERLAPS_ARRAY');
  for(const overlap of inventory.activeOverlaps??[]){
    fail(Number.isInteger(overlap.pullRequest)&&overlap.pullRequest>0,'OVERLAP_PR',overlap.pullRequest);
    fail(overlap.classification==='ADAPT','OVERLAP_MUST_ADAPT',overlap.pullRequest);
    fail(Array.isArray(overlap.paths)&&overlap.paths.length>0,'OVERLAP_PATHS',overlap.pullRequest);
  }
  fail(inventory.coverageAssertions?.allReusableSimulationScopesClassified===true,'ALL_REUSABLE_SCOPES_CLASSIFIED');
  fail(Array.isArray(inventory.coverageAssertions?.unclassifiedKnownReusableAssets)&&inventory.coverageAssertions.unclassifiedKnownReusableAssets.length===0,'UNCLASSIFIED_REUSABLE_ASSETS');
  return {status:errors.length===0?'PASS':'FAIL',errors};
}
