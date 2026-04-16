import assert from 'node:assert/strict';
import test from 'node:test';

test('kernel release catalog resolves openclaw and hermes from config/kernel-releases', async () => {
  const catalog = await import('./kernelReleaseCatalog.ts');

  assert.equal(typeof catalog.resolveKernelReleaseConfig, 'function');
  assert.equal(typeof catalog.listKernelReleaseConfigs, 'function');

  const openclaw = catalog.resolveKernelReleaseConfig('openclaw');
  const hermes = catalog.resolveKernelReleaseConfig('hermes');

  assert.equal(openclaw.kernelId, 'openclaw');
  assert.equal(openclaw.stableVersion, '2026.4.9');
  assert.equal(openclaw.sourcePath.endsWith('config/kernel-releases/openclaw.json'), true);

  assert.equal(hermes.kernelId, 'hermes');
  assert.equal(typeof hermes.stableVersion, 'string');
  assert.equal(Boolean(hermes.stableVersion), true);
  assert.equal(hermes.sourcePath.endsWith('config/kernel-releases/hermes.json'), true);
});
