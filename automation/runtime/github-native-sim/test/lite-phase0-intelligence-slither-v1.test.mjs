import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

test('Phase-0 Slither splits multi-profile builds by exact compilation unit',()=>{
  const here=path.dirname(fileURLToPath(import.meta.url));
  const source=fs.readFileSync(path.resolve(here,'../src/lite-phase0-intelligence-v1.mjs'),'utf8');
  assert.match(source,/compilationUnits\.length<=1/);
  assert.match(source,/mode:'PER_COMPILATION_UNIT'/);
  assert.match(source,/compilationUnits:\[unit\]/);
  assert.match(source,/sourceAsts:unit\.sourceAsts/);
  assert.match(source,/artifacts:Array\.isArray\(unit\.artifacts\)/);
  assert.match(source,/for\(const detector of parsed\.detectors/);
  assert.match(source,/detectorSeen/);
});


test('Slither metadata normalizes compiler build strings to numeric semver and never fails on findings',()=>{
  const here=path.dirname(fileURLToPath(import.meta.url));
  const source=fs.readFileSync(path.resolve(here,'../src/lite-phase0-intelligence-v1.mjs'),'utf8');
  assert.match(source,/function slitherCompilerVersion\(v\)/);
  assert.match(source,/version:slitherCompilerVersion\(buildUnit\.compilerVersion\)/);
  assert.match(source,/--fail-none/);
});
