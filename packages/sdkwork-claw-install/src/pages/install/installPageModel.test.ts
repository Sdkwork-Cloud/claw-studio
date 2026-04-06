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
  'installPageModel keeps the install surface OpenClaw-only while preserving the fallback method matrix',
  async () => {
    const {
      PRODUCTS,
      getVisibleInstallChoices,
      getVisibleUninstallChoices,
      shouldShowProductSidebar,
    } = await import('./installPageModel.ts');

    assert.deepEqual(PRODUCTS.map((item) => item.id), ['openclaw']);
    assert.equal(shouldShowProductSidebar(PRODUCTS.length), false);
    assert.equal(shouldShowProductSidebar(2), true);

    const openclaw = PRODUCTS[0];
    assert.ok(openclaw);

    assert.deepEqual(
      getVisibleInstallChoices(openclaw, 'windows').map((item) => item.id),
      ['wsl', 'installer', 'git', 'npm', 'pnpm', 'source', 'docker'],
    );
    assert.deepEqual(
      getVisibleInstallChoices(openclaw, 'linux').map((item) => item.id),
      [
        'installer',
        'installerCli',
        'git',
        'npm',
        'pnpm',
        'source',
        'docker',
        'podman',
        'bun',
        'ansible',
        'nix',
      ],
    );
    assert.deepEqual(
      getVisibleInstallChoices(openclaw, 'macos').map((item) => item.id),
      ['installer', 'installerCli', 'git', 'npm', 'pnpm', 'source', 'docker', 'podman', 'bun', 'nix'],
    );
    assert.deepEqual(
      getVisibleInstallChoices(openclaw, 'unknown').map((item) => item.id),
      ['installer', 'git', 'npm', 'pnpm', 'source', 'docker'],
    );
    assert.deepEqual(
      getVisibleUninstallChoices(openclaw, 'linux').map((item) => item.id),
      [
        'installer',
        'installerCli',
        'git',
        'npm',
        'pnpm',
        'source',
        'docker',
        'podman',
        'bun',
        'ansible',
        'nix',
      ],
    );
  },
);

await runTest('installPageModel detects the active install method from install records', async () => {
  const { getDetectedMethodId } = await import('./installPageModel.ts');

  assert.equal(getDetectedMethodId({ manifestName: 'openclaw-pnpm' }), 'pnpm');
  assert.equal(getDetectedMethodId({ manifestName: 'openclaw-wsl' }), 'wsl');
  assert.equal(getDetectedMethodId({ manifestName: 'openclaw' }), 'installer');
  assert.equal(getDetectedMethodId({ manifestName: 'openclaw-cli-script' }), 'installerCli');
  assert.equal(getDetectedMethodId({ manifestName: 'openclaw-git' }), 'git');
  assert.equal(getDetectedMethodId({ manifestName: 'openclaw-podman' }), 'podman');
  assert.equal(getDetectedMethodId({ manifestName: 'openclaw-bun' }), 'bun');
  assert.equal(getDetectedMethodId({ manifestName: 'openclaw-ansible' }), 'ansible');
  assert.equal(getDetectedMethodId({ manifestName: 'openclaw-nix' }), 'nix');
  assert.equal(
    getDetectedMethodId({
      softwareName: 'openclaw-pnpm',
      manifestName: 'OpenClaw Install (pnpm)',
    }),
    'pnpm',
  );
  assert.equal(
    getDetectedMethodId({
      softwareName: 'openclaw',
      manifestName: 'OpenClaw Install (Official Installer Script)',
    }),
    'installer',
  );
  assert.equal(
    getDetectedMethodId({
      softwareName: 'openclaw-cli-script',
      manifestName: 'OpenClaw Install (Installer CLI Script)',
    }),
    'installerCli',
  );
  assert.equal(
    getDetectedMethodId({
      softwareName: 'openclaw-git',
      manifestName: 'OpenClaw Install (Installer Script Git Mode)',
    }),
    'git',
  );
  assert.equal(
    getDetectedMethodId({
      softwareName: 'openclaw-docker',
      manifestName: 'OpenClaw Install (Docker)',
    }),
    'docker',
  );
  assert.equal(
    getDetectedMethodId({
      softwareName: 'openclaw-podman',
      manifestName: 'OpenClaw Install (Podman)',
    }),
    'podman',
  );
  assert.equal(
    getDetectedMethodId({
      softwareName: 'openclaw-bun',
      manifestName: 'OpenClaw Install (Bun Experimental)',
    }),
    'bun',
  );
  assert.equal(
    getDetectedMethodId({
      softwareName: 'openclaw-ansible',
      manifestName: 'OpenClaw Install (Ansible)',
    }),
    'ansible',
  );
  assert.equal(
    getDetectedMethodId({
      softwareName: 'openclaw-nix',
      manifestName: 'OpenClaw Install (Nix)',
    }),
    'nix',
  );
  assert.equal(getDetectedMethodId({ manifestName: 'OpenClaw Install (Source Build)' }), 'source');
  assert.equal(getDetectedMethodId({ manifestName: 'unknown-manifest' }), null);
});

await runTest('installPageModel exposes the modal guided install 5-step order', async () => {
  const { GUIDED_INSTALL_STEPS } = await import('./installPageModel.ts');

  assert.deepEqual(GUIDED_INSTALL_STEPS.map((step) => step.id), [
    'dependencies',
    'install',
    'configure',
    'initialize',
    'success',
  ]);
});

await runTest('installPageModel keeps install method grids adaptive by choice count', async () => {
  const { getInstallGridClassName } = await import('./installPageModel.ts');

  assert.equal(getInstallGridClassName(1), 'grid-cols-1');
  assert.equal(getInstallGridClassName(2), 'grid-cols-1 xl:grid-cols-2');
  assert.equal(getInstallGridClassName(3), 'grid-cols-1 md:grid-cols-2 2xl:grid-cols-3');
  assert.equal(getInstallGridClassName(5), 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3');
});
