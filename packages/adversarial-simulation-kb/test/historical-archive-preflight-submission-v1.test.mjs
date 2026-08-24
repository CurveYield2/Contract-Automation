import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildEulerHistoricalArchivePreflightRequestV1 } from '../src/historical/archive-preflight-request-v1.mjs';

const SOURCE_COMMIT='488c82399def0cd3428ccf33f87e8d9976cd6f27';
const REQUEST_PATH='github-native-sim/requests/dar-12000000000000000000000000000001/request.json';

test('K13 checked-in atomic controller request exactly binds the historical archive-preflight request',()=>{
  const checkedIn=JSON.parse(fs.readFileSync(REQUEST_PATH,'utf8'));
  assert.deepEqual(checkedIn,buildEulerHistoricalArchivePreflightRequestV1({sourceCommit:SOURCE_COMMIT}));
});
