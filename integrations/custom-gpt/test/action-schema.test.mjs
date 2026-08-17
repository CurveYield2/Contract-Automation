import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const schemaPath = new URL('../action-schema.json', import.meta.url);

test('Custom GPT action schema exposes only authenticated public PreflightSim operations', async () => {
  const schema = JSON.parse(await fs.readFile(schemaPath, 'utf8'));
  assert.equal(schema.openapi, '3.1.0');
  assert.equal(schema.servers[0].url, 'https://preflight.curveyield.online');
  assert.equal(schema.components.securitySchemes.bearerAuth.type, 'http');
  assert.equal(schema.components.securitySchemes.bearerAuth.scheme, 'bearer');

  const operations = Object.values(schema.paths).flatMap((path) =>
    Object.values(path).filter((operation) => operation && typeof operation === 'object' && operation.operationId)
  );
  const operationIds = operations.map((operation) => operation.operationId).sort();
  assert.deepEqual(operationIds, [
    'createSimulationJob',
    'getJobResult',
    'getJobStatus',
    'getJobSummary',
    'listSupportedChains'
  ]);
  assert.equal(Object.keys(schema.paths).some((path) => path.startsWith('/internal/')), false);
  const projectSchema = schema.components.schemas.Project;
  assert.deepEqual(projectSchema.oneOf.map((item) => item.$ref).sort(), [
    '#/components/schemas/GithubProject',
    '#/components/schemas/InlineProject'
  ]);
});
