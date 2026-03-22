import assert from 'node:assert/strict';
import type { HubInstallCatalogEntry } from '@sdkwork/claw-infrastructure';

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

function createCatalogEntry(
  overrides: Partial<HubInstallCatalogEntry> = {},
): HubInstallCatalogEntry {
  return {
    appId: 'app-openclaw',
    title: 'OpenClaw',
    developer: 'OpenClaw',
    category: 'AI Agents',
    summary: 'Install OpenClaw from the embedded hub-installer catalog.',
    description: 'Catalog fixture for OpenClaw install presentation tests.',
    homepage: 'https://docs.openclaw.ai/install',
    tags: ['ai', 'agent', 'gateway'],
    defaultVariantId: 'shared-installer-script',
    defaultSoftwareName: 'openclaw',
    supportedHostPlatforms: ['windows', 'macos', 'ubuntu'],
    variants: [
      {
        id: 'windows-wsl',
        label: 'Windows via WSL',
        summary: 'Install OpenClaw into WSL and bootstrap the daemon automatically.',
        softwareName: 'openclaw-wsl',
        hostPlatforms: ['windows'],
        runtimePlatform: 'wsl',
        manifestName: 'openclaw-wsl',
        manifestDescription: 'OpenClaw WSL profile',
        manifestHomepage: 'https://docs.openclaw.ai/platforms/windows',
        installationMethod: {
          id: 'wsl',
          label: 'WSL',
          type: 'wsl',
          summary: 'Use WSL on Windows.',
          supported: true,
          documentationUrl: 'https://docs.openclaw.ai/platforms/windows',
          notes: [],
        },
        request: {
          softwareName: 'openclaw-wsl',
          effectiveRuntimePlatform: 'wsl',
        },
      },
      {
        id: 'shared-installer-script',
        label: 'Official installer script',
        summary: 'Run the upstream OpenClaw installer script.',
        softwareName: 'openclaw',
        hostPlatforms: ['windows', 'macos', 'ubuntu'],
        runtimePlatform: 'host',
        manifestName: 'openclaw',
        manifestDescription: 'OpenClaw installer profile',
        manifestHomepage: 'https://docs.openclaw.ai/install/installer',
        installationMethod: {
          id: 'installer',
          label: 'Installer script',
          type: 'script',
          summary: 'Use the upstream installer.',
          supported: true,
          documentationUrl: 'https://docs.openclaw.ai/install/installer',
          notes: [],
        },
        request: {
          softwareName: 'openclaw',
        },
      },
      {
        id: 'unix-installer-cli',
        label: 'Installer CLI local prefix',
        summary: 'Install OpenClaw into a local managed prefix.',
        softwareName: 'openclaw-cli-script',
        hostPlatforms: ['macos', 'ubuntu'],
        runtimePlatform: 'host',
        manifestName: 'openclaw-cli-script',
        manifestDescription: 'OpenClaw install-cli profile',
        manifestHomepage: 'https://docs.openclaw.ai/install/installer',
        installationMethod: {
          id: 'install-cli',
          label: 'Installer CLI',
          type: 'script',
          summary: 'Use install-cli.sh with a managed prefix.',
          supported: true,
          documentationUrl: 'https://docs.openclaw.ai/install/installer',
          notes: [],
        },
        request: {
          softwareName: 'openclaw-cli-script',
        },
      },
      {
        id: 'windows-docker-host',
        label: 'Docker workflow (Windows host)',
        summary: 'Use Docker Desktop from the Windows host.',
        softwareName: 'openclaw-docker',
        hostPlatforms: ['windows'],
        runtimePlatform: 'host',
        manifestName: 'openclaw-docker',
        manifestDescription: 'OpenClaw Docker profile',
        manifestHomepage: 'https://docs.openclaw.ai/install/docker',
        installationMethod: {
          id: 'docker-host',
          label: 'Docker host',
          type: 'container',
          summary: 'Use host Docker.',
          supported: true,
          documentationUrl: 'https://docs.openclaw.ai/install/docker',
          notes: [],
        },
        request: {
          softwareName: 'openclaw-docker',
          containerRuntimePreference: 'host',
        },
      },
      {
        id: 'windows-docker-wsl',
        label: 'Docker workflow via WSL',
        summary: 'Use Docker inside WSL.',
        softwareName: 'openclaw-docker',
        hostPlatforms: ['windows'],
        runtimePlatform: 'wsl',
        manifestName: 'openclaw-docker',
        manifestDescription: 'OpenClaw Docker WSL profile',
        manifestHomepage: 'https://docs.openclaw.ai/install/docker',
        installationMethod: {
          id: 'docker-wsl',
          label: 'Docker via WSL',
          type: 'container',
          summary: 'Use Docker inside WSL.',
          supported: true,
          documentationUrl: 'https://docs.openclaw.ai/install/docker',
          notes: [],
        },
        request: {
          softwareName: 'openclaw-docker',
          effectiveRuntimePlatform: 'wsl',
          containerRuntimePreference: 'wsl',
        },
      },
      {
        id: 'unix-podman',
        label: 'Podman workflow',
        summary: 'Use the documented rootless Podman workflow.',
        softwareName: 'openclaw-podman',
        hostPlatforms: ['macos', 'ubuntu'],
        runtimePlatform: 'host',
        manifestName: 'openclaw-podman',
        manifestDescription: 'OpenClaw Podman profile',
        manifestHomepage: 'https://docs.openclaw.ai/install/podman',
        installationMethod: {
          id: 'podman',
          label: 'Podman',
          type: 'container',
          summary: 'Use Podman.',
          supported: true,
          documentationUrl: 'https://docs.openclaw.ai/install/podman',
          notes: [],
        },
        request: {
          softwareName: 'openclaw-podman',
        },
      },
    ],
    ...overrides,
  };
}

await runTest('openClawCatalogService maps hub-installer variants into Linux install choices without duplicating static page enums', async () => {
  const { resolveOpenClawCatalogPresentation } = await import('./openClawCatalogService.ts');

  const presentation = resolveOpenClawCatalogPresentation(createCatalogEntry(), 'linux');

  assert.equal(presentation.recommendedChoiceId, 'shared-installer-script');
  assert.deepEqual(
    presentation.installChoices.map((choice) => choice.id),
    ['shared-installer-script', 'unix-installer-cli', 'unix-podman'],
  );
  assert.equal(presentation.installChoices[0]?.softwareName, 'openclaw');
  assert.deepEqual(presentation.installChoices[0]?.supportedHosts, ['windows', 'macos', 'linux']);
  assert.equal(presentation.installChoices[0]?.iconId, 'sparkles');
  assert.equal(presentation.installChoices[1]?.iconId, 'package');
  assert.equal(presentation.installChoices[2]?.iconId, 'server');
  assert.ok(presentation.installChoices[2]?.tags.includes('podman'));
  assert.equal(presentation.installChoices[2]?.uninstallRequest.softwareName, 'openclaw-podman');
});

await runTest('openClawCatalogService matches install records against software name and effective runtime platform', async () => {
  const { detectOpenClawCatalogChoice, resolveOpenClawCatalogPresentation } = await import(
    './openClawCatalogService.ts'
  );

  const presentation = resolveOpenClawCatalogPresentation(createCatalogEntry(), 'windows');

  assert.equal(
    detectOpenClawCatalogChoice(
      {
        softwareName: 'openclaw-docker',
        effectiveRuntimePlatform: 'wsl',
      },
      presentation.installChoices,
    )?.id,
    'windows-docker-wsl',
  );
  assert.equal(
    detectOpenClawCatalogChoice(
      {
        manifestName: 'openclaw',
        effectiveRuntimePlatform: 'windows',
      },
      presentation.installChoices,
    )?.id,
    'shared-installer-script',
  );
  assert.equal(
    detectOpenClawCatalogChoice(
      {
        softwareName: 'openclaw-docker',
        effectiveRuntimePlatform: 'windows',
      },
      presentation.installChoices,
    )?.id,
    'windows-docker-host',
  );
});

await runTest(
  'openClawCatalogService gives Bun, Ansible, and Nix variants meaningful tags and icons',
  async () => {
    const { resolveOpenClawCatalogPresentation } = await import('./openClawCatalogService.ts');

    const baseEntry = createCatalogEntry();
    const presentation = resolveOpenClawCatalogPresentation(
      createCatalogEntry({
        variants: [
          ...baseEntry.variants,
          {
            id: 'unix-bun',
            label: 'Bun experimental workflow',
            summary: 'Build OpenClaw from source with Bun.',
            softwareName: 'openclaw-bun',
            hostPlatforms: ['macos', 'ubuntu'],
            runtimePlatform: 'host',
            manifestName: 'openclaw-bun',
            manifestDescription: 'OpenClaw Bun profile',
            manifestHomepage: 'https://docs.openclaw.ai/install/bun',
            installationMethod: {
              id: 'bun',
              label: 'Bun',
              type: 'source',
              summary: 'Use Bun for the OpenClaw source workflow.',
              supported: true,
              documentationUrl: 'https://docs.openclaw.ai/install/bun',
              notes: [],
            },
            request: {
              softwareName: 'openclaw-bun',
            },
          },
          {
            id: 'unix-ansible',
            label: 'Ansible workflow',
            summary: 'Install OpenClaw through the openclaw-ansible automation repository.',
            softwareName: 'openclaw-ansible',
            hostPlatforms: ['macos', 'ubuntu'],
            runtimePlatform: 'host',
            manifestName: 'openclaw-ansible',
            manifestDescription: 'OpenClaw Ansible profile',
            manifestHomepage: 'https://docs.openclaw.ai/install/ansible',
            installationMethod: {
              id: 'ansible',
              label: 'Ansible',
              type: 'command',
              summary: 'Use the Ansible automation repository.',
              supported: true,
              documentationUrl: 'https://docs.openclaw.ai/install/ansible',
              notes: [],
            },
            request: {
              softwareName: 'openclaw-ansible',
            },
          },
          {
            id: 'unix-nix',
            label: 'Nix workflow',
            summary: 'Install OpenClaw with nix-openclaw flake workflows.',
            softwareName: 'openclaw-nix',
            hostPlatforms: ['macos', 'ubuntu'],
            runtimePlatform: 'host',
            manifestName: 'openclaw-nix',
            manifestDescription: 'OpenClaw Nix profile',
            manifestHomepage: 'https://docs.openclaw.ai/install/nix',
            installationMethod: {
              id: 'nix',
              label: 'Nix',
              type: 'package',
              summary: 'Use nix flakes.',
              supported: true,
              documentationUrl: 'https://docs.openclaw.ai/install/nix',
              notes: [],
            },
            request: {
              softwareName: 'openclaw-nix',
            },
          },
        ],
      }),
      'macos',
    );

    const bunChoice = presentation.installChoices.find((choice) => choice.softwareName === 'openclaw-bun');
    const ansibleChoice = presentation.installChoices.find(
      (choice) => choice.softwareName === 'openclaw-ansible',
    );
    const nixChoice = presentation.installChoices.find((choice) => choice.softwareName === 'openclaw-nix');

    assert.equal(bunChoice?.iconId, 'package');
    assert.ok(bunChoice?.tags.includes('bun'));
    assert.ok(bunChoice?.tags.includes('experimental'));

    assert.equal(ansibleChoice?.iconId, 'server');
    assert.ok(ansibleChoice?.tags.includes('ansible'));
    assert.ok(ansibleChoice?.tags.includes('automation'));

    assert.equal(nixChoice?.iconId, 'package');
    assert.ok(nixChoice?.tags.includes('nix'));
    assert.ok(nixChoice?.tags.includes('declarative'));
  },
);
