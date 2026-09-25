#!/usr/bin/env node

const LIGHT_PATTERNS = [
  /^\.github\/workflows\/audit-controller-execution\.yml$/,
  /^\.github\/workflows\/browser-agent-wake\.yml$/,
  /^\.github\/workflows\/browser-agent-watchdog\.yml$/,
  /^\.github\/workflows\/agent-zip-import-v1\.yml$/,
  /^scripts\/browser-agent-wake\.mjs$/,
  /^scripts\/select-audit-controller-token\.sh$/,
  /^scripts\/classify-v7-qualification-change\.mjs$/,
  /^docs\//,
  /^process\/browser-agent-wake\//,
  /^process\/browser-agent-watchdog\//,
  /^process\/V7_QUALIFICATION_STATUS\.json$/,
  /^process\/V7_QUALIFICATION_LAST_RUN\.json$/,
  /^protocol\/schemas\/curveyield-lite-interphase-.*\.schema\.json$/,
  /^packages\/github-native-sim\/test\/browser-agent-.*\.test\.mjs$/,
  /^packages\/github-native-sim\/test\/audit-controller-token-selection-v1\.test\.mjs$/,
  /^packages\/github-native-sim\/test\/atomic-request-bridge-v1\.test\.mjs$/,
  /^packages\/github-native-sim\/test\/execution-workflow-v2\.test\.mjs$/,
];

export function classifyV7QualificationChanges(paths, { forceFull = false } = {}) {
  const normalized = [...new Set((paths ?? []).map((value) => String(value).trim()).filter(Boolean))].sort();
  if (forceFull || normalized.length === 0) {
    return { lane: 'FULL', paths: normalized, reason: forceFull ? 'EXPLICIT_FULL' : 'NO_CHANGED_PATHS' };
  }
  const nonLight = normalized.filter((file) => !LIGHT_PATTERNS.some((pattern) => pattern.test(file)));
  return nonLight.length === 0
    ? { lane: 'CONTROL_LIGHT', paths: normalized, reason: 'ALL_PATHS_CONTROL_PLANE' }
    : { lane: 'FULL', paths: normalized, reason: 'RUNNER_OR_UNKNOWN_PATH', escalatedPaths: nonLight };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const forceFull = process.argv.includes('--full');
  let input = '';
  for await (const chunk of process.stdin) input += chunk;
  const result = classifyV7QualificationChanges(input.split(/\r?\n/), { forceFull });
  process.stdout.write(`${JSON.stringify(result)}\n`);
}
