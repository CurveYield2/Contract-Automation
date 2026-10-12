import { classesForTriggersV1 } from './adr-taxonomy-v1.mjs';

const OPEN_REVIEWS = new Set(['GAP', 'CONTRADICTED', 'PENDING']);
const OPEN_TESTS = new Set(['NOT_ACHIEVED', 'INCONCLUSIVE', 'PENDING']);
const TEST_STATUSES = new Set(['PASSED','PROPERTY_FAILED','NOT_APPLICABLE_CONFIRMED','INCONCLUSIVE','NOT_ACHIEVED','NOT_REQUIRED','PENDING']);

function statusFor(phase6Results, inventory, contextId, classId) {
  if (!phase6Results) return 'PENDING';
  const key = contextId + ':' + classId;
  const obligations = inventory.payload?.baselineObligations ?? phase6Results.baselineObligations ?? [];
  const obligation = obligations.find(o => (o.contextId === contextId || (o.contextIds ?? []).includes(contextId)) && o.classId === classId);
  const id = obligation?.obligationId;
  const value = (id && phase6Results[id]) ?? phase6Results[key] ??
    phase6Results.byContextClass?.[contextId]?.[classId] ?? phase6Results.byContextClass?.[key];
  const status = typeof value === 'string' ? value : value?.testStatus ?? value?.status;
  return TEST_STATUSES.has(status) ? status : 'NOT_ACHIEVED';
}

function summary(rows) {
  const stats = {contexts: new Set(), accepted:0, contradicted:0, notApplicableClaims:0, gaps:0, testsPassed:0, propertyFailures:0, notAchieved:0};
  for (const row of rows) {
    stats.contexts.add(row.contextId);
    if (row.reviewStatus === 'ACCEPTED') stats.accepted++;
    if (row.reviewStatus === 'CONTRADICTED') stats.contradicted++;
    if (row.reviewStatus === 'NOT_APPLICABLE_CLAIMED') stats.notApplicableClaims++;
    if (row.reviewStatus === 'GAP') stats.gaps++;
    if (row.testStatus === 'PASSED') stats.testsPassed++;
    if (row.testStatus === 'PROPERTY_FAILED') stats.propertyFailures++;
    if (row.testStatus === 'NOT_ACHIEVED') stats.notAchieved++;
  }
  return {...stats, contexts:stats.contexts.size};
}

export function buildCoverageMatrixV1({inventory, taxonomy, discoveryState = null, phase6Results = null}) {
  const rows = [], byContract = {}, byClass = {};
  const gaps = new Set((discoveryState?.gaps ?? []).map(x => typeof x === 'string' ? x : x.contextId));
  const contradictions = new Set((discoveryState?.attackContradictions ?? []).map(x => x.contextId + ':' + x.classId));
  const classes = new Map(taxonomy.classes.map(x => [x.classId, x]));
  const contexts = [...(inventory.payload?.contexts ?? [])].sort((a,b) =>
    a.path.localeCompare(b.path) || a.lineStart-b.lineStart || a.contextId.localeCompare(b.contextId));
  for (const ctx of contexts) {
    if (ctx.scopeTier && !['IN_SCOPE','INHERITED_DEPENDENCY'].includes(ctx.scopeTier)) continue;
    const contract = ctx.qualifiedContainer || ctx.effectiveIn?.[0] || ctx.path;
    for (const classId of classesForTriggersV1(taxonomy, inventory.payload?.triggers?.[ctx.contextId] ?? [])) {
      const assessment = discoveryState?.reviewChecks?.[ctx.contextId]?.[classId];
      let testStatus = classes.get(classId)?.testRequired === false ? 'NOT_REQUIRED' :
        statusFor(phase6Results, inventory, ctx.contextId, classId);
      let reviewStatus = !discoveryState ? 'PENDING' : gaps.has(ctx.contextId) ? 'GAP' :
        contradictions.has(ctx.contextId + ':' + classId) && testStatus !== 'PASSED' ? 'CONTRADICTED' :
        assessment === 'NOT_APPLICABLE' || assessment?.assessment === 'NOT_APPLICABLE' ? 'NOT_APPLICABLE_CLAIMED' : 'ACCEPTED';
      rows.push({contextId:ctx.contextId,contract,classId,reviewStatus,testStatus});
    }
  }
  rows.sort((a,b) => a.contract.localeCompare(b.contract) || a.classId.localeCompare(b.classId) || a.contextId.localeCompare(b.contextId));
  for (const name of [...new Set(rows.map(x => x.contract))].sort())
    byContract[name] = summary(rows.filter(x => x.contract === name));
  for (const name of [...new Set(rows.map(x => x.classId))].sort())
    byClass[name] = summary(rows.filter(x => x.classId === name));
  const gapCount = rows.filter(x => OPEN_REVIEWS.has(x.reviewStatus) || OPEN_TESTS.has(x.testStatus)).length;
  return {rows, byContract, byClass, gapCount, label:gapCount ? 'PARTIAL_COVERAGE' : 'FULL_COVERAGE'};
}

export function renderCoverageMarkdownV1(matrix) {
  const headings = '| Contract | Class | Contexts | Accepted | Contradicted | Not-applicable claims | Gaps | Tests passed | Property failures | Not achieved |';
  const separator = '|---|---|---:|---:|---:|---:|---:|---:|---:|---:|';
  const lines = [headings, separator];
  for (const contract of Object.keys(matrix.byContract).sort()) {
    for (const classId of [...new Set(matrix.rows.filter(x=>x.contract === contract).map(x=>x.classId))].sort()) {
      const s = summary(matrix.rows.filter(x => x.contract===contract && x.classId===classId));
      lines.push('| ' + [contract,classId,s.contexts,s.accepted,s.contradicted,s.notApplicableClaims,s.gaps,s.testsPassed,s.propertyFailures,s.notAchieved].join(' | ') + ' |');
    }
  }
  lines.push('', '**Assurance: ' + matrix.label + '**');
  return lines.join('\n') + '\n';
}
