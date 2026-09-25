const TX=/^0x[0-9a-fA-F]{64}$/i;
const ADDRESS=/^0x[0-9a-fA-F]{40}$/i;
const DATE=/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;

function normalizeText(value){
  return typeof value==='string' ? value.trim().toLowerCase().replace(/\s+/g,' ') : '';
}
function uniqueSorted(values){ return [...new Set(values)].sort(); }
function normalizeHashes(values=[]){
  return uniqueSorted((Array.isArray(values)?values:[]).map((value)=>{
    if(typeof value!=='string'||!TX.test(value)) throw new Error(`invalid transaction hash: ${value}`);
    return `0x${value.slice(2).toLowerCase()}`;
  }));
}
function normalizeAddresses(values=[]){
  return uniqueSorted((Array.isArray(values)?values:[]).map((value)=>{
    if(typeof value!=='string'||!ADDRESS.test(value)) throw new Error(`invalid contract address: ${value}`);
    return `0x${value.slice(2).toLowerCase()}`;
  }));
}
function normalizeChains(value){
  const values=Array.isArray(value)?value:[value];
  return uniqueSorted(values.filter((entry)=>typeof entry==='string'&&entry.trim()).map(normalizeText));
}
function normalizeFingerprint(value){
  if(typeof value!=='string') return '';
  return value.trim().toLowerCase().split('|').map((part)=>part.trim().replace(/\s+/g,' ')).filter(Boolean).join('|');
}
function intersects(left,right){ const set=new Set(left); return right.some((value)=>set.has(value)); }
function contextualAgreement(a,b){
  return a.protocol!=='' && a.protocol===b.protocol
    && a.incidentDate!=='' && a.incidentDate===b.incidentDate
    && intersects(a.chains,b.chains)
    && intersects(a.primaryAffectedContracts,b.primaryAffectedContracts)
    && a.rootCauseFingerprint!=='' && a.rootCauseFingerprint===b.rootCauseFingerprint;
}

export function buildIncidentDedupKeyV1(incident={}){
  const incidentDate=typeof incident.incidentDate==='string'?incident.incidentDate.trim():'';
  if(incidentDate && !DATE.test(incidentDate)) throw new Error(`invalid incident date: ${incidentDate}`);
  return {
    chains:normalizeChains(incident.affectedChain??[]),
    protocol:normalizeText(incident.affectedProtocol),
    incidentDate,
    transactionHashes:normalizeHashes(incident.transactionHashes??incident.exploitTransactionHashes??[]),
    primaryAffectedContracts:normalizeAddresses(incident.primaryAffectedContract?[incident.primaryAffectedContract]:(incident.affectedContracts??[])),
    rootCauseFingerprint:normalizeFingerprint(incident.rootCauseFingerprint??''),
  };
}

export function compareIncidentsForDedupV1(left,right){
  const a=buildIncidentDedupKeyV1(left); const b=buildIncidentDedupKeyV1(right);
  const sharedTransactions=a.transactionHashes.filter((hash)=>b.transactionHashes.includes(hash));
  if(sharedTransactions.length){
    return {classification:'SAME_INCIDENT',reason:'EXACT_TRANSACTION_MATCH',sharedTransactions,keyA:a,keyB:b};
  }

  const bothHaveTransactions=a.transactionHashes.length>0&&b.transactionHashes.length>0;
  const oneHasTransactions=(a.transactionHashes.length>0)!==(b.transactionHashes.length>0);
  if(bothHaveTransactions){
    if(a.rootCauseFingerprint!==''&&a.rootCauseFingerprint===b.rootCauseFingerprint){
      return {classification:'VARIANT_OR_RELATED',reason:'DISTINCT_TRANSACTIONS_SHARED_ROOT_CAUSE',sharedTransactions:[],keyA:a,keyB:b};
    }
    return {classification:'DISTINCT',reason:'DISTINCT_TRANSACTIONS',sharedTransactions:[],keyA:a,keyB:b};
  }
  if(oneHasTransactions&&a.rootCauseFingerprint!==''&&a.rootCauseFingerprint===b.rootCauseFingerprint){
    return {classification:'VARIANT_OR_RELATED',reason:'ASYMMETRIC_TRANSACTION_EVIDENCE_SHARED_ROOT_CAUSE',sharedTransactions:[],keyA:a,keyB:b};
  }

  if(contextualAgreement(a,b)){
    return {classification:'PROBABLE_SAME_INCIDENT',reason:'CONTEXTUAL_ROOT_CAUSE_MATCH',sharedTransactions:[],keyA:a,keyB:b};
  }
  if(a.rootCauseFingerprint!==''&&a.rootCauseFingerprint===b.rootCauseFingerprint){
    return {classification:'VARIANT_OR_RELATED',reason:'SHARED_ROOT_CAUSE_ONLY',sharedTransactions:[],keyA:a,keyB:b};
  }
  return {classification:'DISTINCT',reason:'INSUFFICIENT_DUPLICATE_EVIDENCE',sharedTransactions:[],keyA:a,keyB:b};
}

function mergeReferences(left=[],right=[]){ return uniqueSorted([...(left??[]),...(right??[])]); }

export function deduplicateIncidentCandidatesV1(candidates=[]){
  if(!Array.isArray(candidates)) throw new Error('incident candidates must be an array');
  const incidents=[]; const mergedIncidentIds=[]; const probableDuplicates=[]; const relatedVariants=[];
  for(const candidate of candidates){
    let merged=false;
    for(let i=0;i<incidents.length;i+=1){
      const comparison=compareIncidentsForDedupV1(incidents[i],candidate);
      if(comparison.classification==='SAME_INCIDENT'){
        const canonical=structuredClone(incidents[i]);
        canonical.references=mergeReferences(canonical.references,candidate.references);
        canonical.aliasIncidentIds=uniqueSorted([...(canonical.aliasIncidentIds??[]),candidate.incidentId].filter(Boolean));
        incidents[i]=canonical;
        if(candidate.incidentId) mergedIncidentIds.push(candidate.incidentId);
        merged=true; break;
      }
      if(comparison.classification==='PROBABLE_SAME_INCIDENT') probableDuplicates.push({left:incidents[i].incidentId??null,right:candidate.incidentId??null,reason:comparison.reason});
      if(comparison.classification==='VARIANT_OR_RELATED') relatedVariants.push({left:incidents[i].incidentId??null,right:candidate.incidentId??null,reason:comparison.reason});
    }
    if(!merged) incidents.push(structuredClone(candidate));
  }
  return {
    incidents,
    mergedIncidentIds:uniqueSorted(mergedIncidentIds),
    probableDuplicates,
    relatedVariants,
  };
}
