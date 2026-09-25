const PLACEHOLDER=/\$\{binding:([A-Za-z][A-Za-z0-9_]*)\}/g;
const ADDRESS=/0x[0-9a-fA-F]{40}/;
const TX=/0x[0-9a-fA-F]{64}/;

function text(value){ return typeof value==='string'&&value.trim().length>0; }
function sortedUnique(values){ return [...new Set(values)].sort(); }
function declaredBindings(recipe){ return Array.isArray(recipe?.requiredTargetBindings)?recipe.requiredTargetBindings:[]; }
function collectPlaceholders(value,out=[]){
  if(typeof value==='string'){
    for(const match of value.matchAll(PLACEHOLDER)) out.push(match[1]);
    return out;
  }
  if(Array.isArray(value)){
    for(const entry of value) collectPlaceholders(entry,out);
    return out;
  }
  if(value&&typeof value==='object') for(const entry of Object.values(value)) collectPlaceholders(entry,out);
  return out;
}
function resolvedBinding(value){ return text(value); }
function replaceBindings(value,bindings){
  if(typeof value==='string'){
    const exact=value.match(/^\$\{binding:([A-Za-z][A-Za-z0-9_]*)\}$/);
    if(exact) return structuredClone(bindings[exact[1]]);
    return value.replace(PLACEHOLDER,(_,name)=>String(bindings[name]));
  }
  if(Array.isArray(value)) return value.map(entry=>replaceBindings(entry,bindings));
  if(value&&typeof value==='object') return Object.fromEntries(Object.entries(value).map(([key,entry])=>[key,replaceBindings(entry,bindings)]));
  return value;
}

export function validateRecipeTemplateV1(recipe){
  const errors=[];
  if(!recipe||typeof recipe!=='object'||Array.isArray(recipe)) return {status:'FAIL',errors:[{code:'RECIPE_OBJECT_REQUIRED'}]};
  const required=declaredBindings(recipe);
  if(required.length===0) errors.push({code:'REQUIRED_BINDINGS_EMPTY'});
  if(required.some(name=>!text(name))) errors.push({code:'INVALID_BINDING_NAME'});
  if(new Set(required).size!==required.length) errors.push({code:'DUPLICATE_BINDING_NAME'});

  const placeholders=sortedUnique(collectPlaceholders({
    setupSteps:recipe.setupSteps,
    attackSteps:recipe.attackSteps,
    observations:recipe.observations,
    assertions:recipe.assertions,
    adaptationInputs:recipe.adaptationInputs,
  }));
  const declared=new Set(required);
  for(const name of placeholders) if(!declared.has(name)) errors.push({code:'UNDECLARED_BINDING_PLACEHOLDER',binding:name});
  for(const name of required) if(!placeholders.includes(name)) errors.push({code:'UNUSED_REQUIRED_BINDING',binding:name});

  const serialized=JSON.stringify(recipe);
  if(ADDRESS.test(serialized)||TX.test(serialized)) errors.push({code:'HARDCODED_ONCHAIN_IDENTITY'});
  return {status:errors.length?'FAIL':'PASS',errors,placeholders};
}

export function inspectRecipeBindingsV1(recipe,bindings={}){
  const template=validateRecipeTemplateV1(recipe);
  if(template.status!=='PASS') return {status:'BLOCKED',missingRequired:[],unknownBindings:[],templateErrors:template.errors};
  if(!bindings||typeof bindings!=='object'||Array.isArray(bindings)) return {status:'BLOCKED',missingRequired:[...declaredBindings(recipe)].sort(),unknownBindings:[],templateErrors:[]};
  const required=declaredBindings(recipe);
  const missingRequired=required.filter(name=>!resolvedBinding(bindings[name])).sort();
  const requiredSet=new Set(required);
  const unknownBindings=Object.keys(bindings).filter(name=>!requiredSet.has(name)).sort();
  return {status:missingRequired.length?'BLOCKED':'READY',missingRequired,unknownBindings,templateErrors:[]};
}

export function instantiateRecipeV1(recipe,bindings={}){
  const inspection=inspectRecipeBindingsV1(recipe,bindings);
  if(inspection.status!=='READY') throw new Error(`unresolved required recipe bindings: ${inspection.missingRequired.join(',')||'invalid template'}`);
  const source={
    setupSteps:recipe.setupSteps,
    attackSteps:recipe.attackSteps,
    observations:recipe.observations,
    assertions:recipe.assertions,
    adaptationInputs:recipe.adaptationInputs,
  };
  return {
    schemaVersion:'adversarial-kb-recipe-instance-v1',
    recipeId:recipe.recipeId,
    patternRefs:structuredClone(recipe.patternRefs),
    status:'READY',
    bindings:structuredClone(bindings),
    steps:replaceBindings(source,bindings),
    backendSupport:structuredClone(recipe.backendSupport),
  };
}
