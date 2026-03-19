import assert from 'node:assert/strict';
import type { ApiRouterUsageRecord } from '@sdkwork/claw-types';
import {
  buildUsagePaginationItems,
  buildUsageRecordsCsv,
  buildUsageRecordsCsvFilename,
  hasInvalidUsageRecordsDateRange,
} from './usageRecordsViewService.ts';

function runTest(name: string, callback: () => void) {
  try {
    callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

const fixtureRecord: ApiRouterUsageRecord = {
  id: 'usage-record-fixture',
  apiKeyId: 'team-web-dev',
  apiKeyName: 'Team Web Dev',
  model: 'gpt-5.4',
  reasoningEffort: 'xhigh',
  endpoint: '/responses',
  type: 'streaming',
  promptTokens: 1200,
  completionTokens: 800,
  cachedTokens: 40,
  costUsd: 0.045678,
  ttftMs: 321,
  durationMs: 2450,
  startedAt: '2026-03-19T09:30:00.000Z',
  userAgent: 'Codex CLI/0.41.0, Node/22 "quoted"',
};

runTest('hasInvalidUsageRecordsDateRange only flags invalid custom ranges', () => {
  assert.equal(hasInvalidUsageRecordsDateRange('7d', '2026-03-10', '2026-03-01'), false);
  assert.equal(hasInvalidUsageRecordsDateRange('custom', '', ''), false);
  assert.equal(hasInvalidUsageRecordsDateRange('custom', '2026-03-01', '2026-03-10'), false);
  assert.equal(hasInvalidUsageRecordsDateRange('custom', '2026-03-10', '2026-03-01'), true);
});

runTest('buildUsagePaginationItems keeps current context while exposing first and last pages', () => {
  assert.deepEqual(buildUsagePaginationItems(1, 3), [1, 2, 3]);
  assert.deepEqual(buildUsagePaginationItems(2, 5), [1, 2, 3, 4, 5]);
  assert.deepEqual(buildUsagePaginationItems(5, 10), [1, 'ellipsis-left', 4, 5, 6, 'ellipsis-right', 10]);
  assert.deepEqual(buildUsagePaginationItems(9, 10), [1, 'ellipsis-left', 8, 9, 10]);
});

runTest('buildUsageRecordsCsv escapes commas, quotes, and preserves fixed-precision cost values', () => {
  const csv = buildUsageRecordsCsv([fixtureRecord]);

  assert.match(csv, /API Key,API Key ID,Model/);
  assert.match(csv, /0\.045678/);
  assert.match(csv, /"Codex CLI\/0\.41\.0, Node\/22 ""quoted"""/);
});

runTest('buildUsageRecordsCsvFilename is date-stamped and deterministic for a provided clock', () => {
  assert.equal(
    buildUsageRecordsCsvFilename(new Date('2026-03-19T10:11:12.000Z')),
    'api-router-usage-records-2026-03-19.csv',
  );
});
