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

runTest('ChannelCatalog management cards keep link actions in the title row instead of the primary action rail', () => {
  const source = readFileSync(resolve(import.meta.dirname, 'ChannelCatalog.tsx'), 'utf8');

  assert.match(source, /data-slot="channel-catalog-management-heading"/);
  assert.match(source, /data-slot="channel-catalog-management-link-action"/);
  assert.match(source, /data-slot="channel-catalog-management-actions"/);
  assert.doesNotMatch(
    source,
    /data-slot="channel-catalog-management-actions"[\s\S]*<OfficialLinkButton/,
  );
});
