import assert from 'node:assert/strict';
import test from 'node:test';

import {
  listKernelReleaseConfigs,
  resolveKernelReleaseConfig,
} from './kernelReleaseCatalog.ts';

test('kernel release catalog canonicalizes configured kernel ids', () => {
  const kernelIds = listKernelReleaseConfigs()
    .map((config) => config.kernelId)
    .sort();

  assert.deepEqual(kernelIds, ['hermes', 'openclaw']);
  assert.equal(resolveKernelReleaseConfig('openclaw').kernelId, 'openclaw');
  assert.equal(resolveKernelReleaseConfig('hermes').kernelId, 'hermes');
});

test('kernel release catalog returns defensive clones', () => {
  const openclaw = resolveKernelReleaseConfig('openclaw');
  openclaw.stableVersion = 'mutated';

  assert.notEqual(
    resolveKernelReleaseConfig('openclaw').stableVersion,
    'mutated',
  );
});
