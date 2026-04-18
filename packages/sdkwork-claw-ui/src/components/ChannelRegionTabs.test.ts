import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function runTest(name: string, callback: () => void) {
  try {
    callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

runTest('ChannelRegionTabs renders with a tighter tab rail radius', () => {
  const source = readFileSync(resolve(import.meta.dirname, 'ChannelRegionTabs.tsx'), 'utf8');

  assert.match(source, /data-slot="channel-region-tabs"/);
  assert.match(source, /gap-1/);
  assert.match(source, /rounded-\[0\.875rem\]/);
  assert.match(source, /p-1/);
  assert.match(source, /h-9 min-w-\[9rem\]/);
  assert.match(source, /rounded-\[0\.75rem\] px-3 text-left text-\[13px\]/);
  assert.match(source, /rounded-full px-1\.5 py-0\.5 text-\[11px\]/);
  assert.doesNotMatch(source, /rounded-\[1rem\]/);
  assert.doesNotMatch(source, /inline-flex w-full/);
  assert.doesNotMatch(source, /min-w-\[11rem\] flex-1 items-center/);
});
