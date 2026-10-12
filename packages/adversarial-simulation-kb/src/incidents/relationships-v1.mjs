const INCIDENT_ID=/^EXP-[0-9]{4}-[0-9]{4}$/;
export const INCIDENT_RELATIONSHIP_TYPES_V1=Object.freeze([
  'VARIANT_OF',
  'SAME_ROOT_CAUSE_AS',
  'INSPIRED_BY',
  'REPLAY_OF',
  'FORK_OF_PROTOCOL_INCIDENT',
  'SUPERSEDES',
  'DISPUTED_WITH',
]);
const TYPES=new Set(INCIDENT_RELATIONSHIP_TYPES_V1);
const SYMMETRIC=new Set(['SAME_ROOT_CAUSE_AS','DISPUTED_WITH']);

export function canonicalizeIncidentRelationshipV1(edge){
  if(!edge||typeof edge!=='object'||Array.isArray(edge)) return null;
  const from=edge.from; const to=edge.to; const type=edge.type;
  if(!INCIDENT_ID.test(from??'')||!INCIDENT_ID.test(to??'')||!TYPES.has(type)||from===to) return null;
  if(SYMMETRIC.has(type)){
    const [left,right]=[from,to].sort();
    return {from:left,type,to:right};
  }
  return {from,type,to};
}

export function validateIncidentRelationshipsV1(relationships=[],knownIncidentIds=new Set()){
  const errors=[];
  if(!Array.isArray(relationships)) return {status:'FAIL',errors:[{code:'RELATIONSHIPS_ARRAY'}],relationships:[]};
  if(!(knownIncidentIds instanceof Set)) return {status:'FAIL',errors:[{code:'KNOWN_INCIDENT_SET_REQUIRED'}],relationships:[]};
  const canonical=[]; const seen=new Set();
  for(let index=0;index<relationships.length;index+=1){
    const edge=relationships[index];
    if(!edge||typeof edge!=='object'||Array.isArray(edge)){errors.push({code:'RELATIONSHIP_OBJECT',index});continue;}
    if(!INCIDENT_ID.test(edge.from??'')) errors.push({code:'FROM_ID',index,value:edge.from??null});
    if(!INCIDENT_ID.test(edge.to??'')) errors.push({code:'TO_ID',index,value:edge.to??null});
    if(!TYPES.has(edge.type)) errors.push({code:'RELATIONSHIP_TYPE',index,value:edge.type??null});
    if(edge.from===edge.to) errors.push({code:'SELF_RELATIONSHIP',index,value:edge.from??null});
    if(INCIDENT_ID.test(edge.from??'')&&!knownIncidentIds.has(edge.from)) errors.push({code:'DANGLING_FROM',index,value:edge.from});
    if(INCIDENT_ID.test(edge.to??'')&&!knownIncidentIds.has(edge.to)) errors.push({code:'DANGLING_TO',index,value:edge.to});
    const normalized=canonicalizeIncidentRelationshipV1(edge);
    if(normalized){
      const key=`${normalized.from}|${normalized.type}|${normalized.to}`;
      if(seen.has(key)) errors.push({code:'DUPLICATE_RELATIONSHIP',index,value:key});
      else {seen.add(key);canonical.push(normalized);}
    }
  }
  canonical.sort((a,b)=>`${a.from}|${a.type}|${a.to}`.localeCompare(`${b.from}|${b.type}|${b.to}`));
  return {status:errors.length?'FAIL':'PASS',errors,relationships:canonical};
}
