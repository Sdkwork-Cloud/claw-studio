import assert from 'node:assert/strict';

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

await runTest(
  'installRecordDiscoveryService selects the newest installed OpenClaw profile record from the install-records directory',
  async () => {
    const {
      selectProductInstallRecord,
      shouldReadProductInstallRecordEntry,
    } = await import('./installRecordDiscoveryService.ts');

    assert.equal(shouldReadProductInstallRecordEntry('openclaw', 'openclaw.json'), true);
    assert.equal(shouldReadProductInstallRecordEntry('openclaw', 'openclaw-pnpm.json'), true);
    assert.equal(shouldReadProductInstallRecordEntry('openclaw', 'openclaw-custom.json'), true);
    assert.equal(shouldReadProductInstallRecordEntry('openclaw', 'zeroclaw-source.json'), false);

    const selected = selectProductInstallRecord('openclaw', [
      {
        softwareName: 'openclaw',
        manifestName: 'OpenClaw Install (Recommended Installer Script)',
        status: 'installed',
        updatedAt: '2026-03-23T00:00:00Z',
      },
      {
        softwareName: 'openclaw-pnpm',
        manifestName: 'OpenClaw Install (pnpm)',
        status: 'installed',
        updatedAt: '2026-03-23T01:00:00Z',
      },
      {
        softwareName: 'openclaw-docker',
        manifestName: 'OpenClaw Install (Docker)',
        status: 'uninstalled',
        updatedAt: '2026-03-23T02:00:00Z',
      },
    ]);

    assert.equal(selected?.softwareName, 'openclaw-pnpm');
    assert.equal(selected?.manifestName, 'OpenClaw Install (pnpm)');
  },
);
