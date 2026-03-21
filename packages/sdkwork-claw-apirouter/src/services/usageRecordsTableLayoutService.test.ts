import assert from 'node:assert/strict';
import { getUsageRecordsTableLayout } from './usageRecordsTableLayoutService.ts';

function runTest(name: string, callback: () => void) {
  try {
    callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

runTest('usage records table prefers full-width rendering with a compact overflow fallback', () => {
  const layout = getUsageRecordsTableLayout();

  assert.ok(layout.tableClassName.includes('w-full'));
  assert.ok(layout.tableClassName.includes('min-w-[960px]'));
  assert.ok(layout.tableClassName.includes('table-fixed'));
  assert.equal(layout.columns.length, 11);
});

runTest('usage records table lets text-heavy columns shrink while keeping metrics legible', () => {
  const layout = getUsageRecordsTableLayout();
  const columnById = Object.fromEntries(layout.columns.map((column) => [column.id, column] as const));

  assert.match(columnById.apiKey.contentClassName || '', /\btruncate\b/);
  assert.match(columnById.apiKey.metaClassName || '', /\btruncate\b/);
  assert.match(columnById.model.contentClassName || '', /\btruncate\b/);
  assert.match(columnById.endpoint.contentClassName || '', /\btruncate\b/);
  assert.match(columnById.userAgent.contentClassName || '', /\btruncate\b/);
  assert.match(columnById.tokenDetail.cellClassName || '', /\bwhitespace-nowrap\b/);
  assert.match(columnById.cost.cellClassName || '', /\bwhitespace-nowrap\b/);
  assert.match(columnById.time.cellClassName || '', /\bwhitespace-nowrap\b/);
});
