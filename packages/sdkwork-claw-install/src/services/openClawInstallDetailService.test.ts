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
  'openClawInstallDetailService resolves legacy aliases and catalog variant ids to canonical OpenClaw methods',
  async () => {
    const { resolveOpenClawInstallDetail } = await import('./openClawInstallDetailService.ts');

    assert.equal(resolveOpenClawInstallDetail('script')?.id, 'installer');
    assert.equal(resolveOpenClawInstallDetail('shared-installer-script')?.id, 'installer');
    assert.equal(resolveOpenClawInstallDetail('windows-wsl')?.id, 'wsl');
    assert.equal(resolveOpenClawInstallDetail('unix-installer-cli')?.id, 'installerCli');
    assert.equal(resolveOpenClawInstallDetail('shared-installer-git')?.id, 'git');
    assert.equal(resolveOpenClawInstallDetail('shared-pnpm')?.id, 'pnpm');
    assert.equal(resolveOpenClawInstallDetail('windows-docker-wsl')?.id, 'docker');
    assert.equal(resolveOpenClawInstallDetail('unix-podman')?.id, 'podman');
    assert.equal(resolveOpenClawInstallDetail('unix-bun')?.id, 'bun');
    assert.equal(resolveOpenClawInstallDetail('unix-ansible')?.id, 'ansible');
    assert.equal(resolveOpenClawInstallDetail('unix-nix')?.id, 'nix');
    assert.equal(resolveOpenClawInstallDetail('cloud')?.id, 'cloud');
    assert.equal(resolveOpenClawInstallDetail('unknown-method'), null);
  },
);

await runTest(
  'openClawInstallDetailService keeps the Windows path aligned with the official WSL-first guidance',
  async () => {
    const { resolveOpenClawInstallDetail } = await import('./openClawInstallDetailService.ts');

    const detail = resolveOpenClawInstallDetail('wsl');
    assert.ok(detail);

    assert.deepEqual(detail.supportedHosts, ['windows']);
    assert.ok(detail.platformNotes.some((note) => note.includes('WSL2')));
    assert.ok(detail.prerequisites.some((note) => note.includes('Node 24')));
    assert.equal(detail.docs[0]?.url, 'https://docs.openclaw.ai/platforms/windows');
    assert.equal(detail.docs[1]?.url, 'https://docs.openclaw.ai/install');
  },
);

await runTest(
  'openClawInstallDetailService keeps package-manager and container methods linked to official docs',
  async () => {
    const { resolveOpenClawInstallDetail } = await import('./openClawInstallDetailService.ts');

    const pnpm = resolveOpenClawInstallDetail('openclaw-pnpm');
    const docker = resolveOpenClawInstallDetail('unix-docker');
    const cloud = resolveOpenClawInstallDetail('cloud');

    assert.ok(pnpm);
    assert.ok(docker);
    assert.ok(cloud);

    assert.equal(pnpm.docs[0]?.url, 'https://docs.openclaw.ai/install');
    assert.ok(pnpm.prerequisites.some((note) => note.includes('pnpm approve-builds -g')));

    assert.equal(docker.docs[0]?.url, 'https://docs.openclaw.ai/install/docker');
    assert.ok(docker.bestFor.some((note) => note.toLowerCase().includes('headless')));

    assert.equal(cloud.docs[0]?.url, 'https://docs.openclaw.ai/install/digitalocean');
    assert.ok(cloud.docs.some((link) => link.url === 'https://docs.openclaw.ai/install/azure'));
  },
);

await runTest(
  'openClawInstallDetailService keeps the Ansible workflow constrained to Debian and Ubuntu style Linux hosts',
  async () => {
    const { resolveOpenClawInstallDetail } = await import('./openClawInstallDetailService.ts');

    const ansible = resolveOpenClawInstallDetail('openclaw-ansible');

    assert.ok(ansible);
    assert.deepEqual(ansible.supportedHosts, ['linux']);
    assert.ok(ansible.prerequisites.some((note) => note.includes('Debian 11+')));
    assert.ok(ansible.platformNotes.some((note) => note.includes('Ubuntu 20.04+')));
    assert.equal(ansible.docs[0]?.url, 'https://docs.openclaw.ai/install/ansible');
  },
);
