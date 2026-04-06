import assert from 'node:assert/strict';
import type { AppCategory, AppInstallSurfaceSummary, AppItem } from '../../services';
import {
  collectInstallableAppIdsFromCategories,
  collectPriorityInstallableAppIds,
  createCatalogMetadataFields,
  createStoreOverview,
  filterCategoriesByKeyword,
} from './appCatalogPresentation.ts';

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

function createApp(overrides: Partial<AppItem> = {}): AppItem {
  return {
    id: 'app-openclaw',
    name: 'OpenClaw',
    developer: 'OpenClaw Labs',
    category: 'AI Agents',
    icon: 'data:image/svg+xml,%3Csvg/%3E',
    description: 'Install OpenClaw from the shared hub-installer catalog.',
    installSummary: 'Rust-backed installer catalog entry.',
    installTags: ['ai', 'assistant'],
    installable: true,
    ...overrides,
  };
}

function createCategory(title: string, apps: AppItem[]): AppCategory {
  return { title, apps };
}

function createInstallSurfaceSummary(
  appId: string,
  overrides: Partial<AppInstallSurfaceSummary> = {},
): AppInstallSurfaceSummary {
  return {
    appId,
    softwareName: `${appId}-pkg`,
    variantId: `${appId}-variant`,
    runtimePlatform: 'host',
    installStatus: null,
    ready: false,
    state: 'attention',
    blockingIssueCount: 0,
    warningIssueCount: 0,
    dependencyAttentionCount: 0,
    autoRemediableDependencyCount: 0,
    ...overrides,
  };
}

await runTest('filterCategoriesByKeyword keeps only real catalog matches and preserves grouping', () => {
  const categories = [
    createCategory('AI Agents', [
      createApp({
        id: 'app-openclaw',
        name: 'OpenClaw',
        installTags: ['gateway', 'docker'],
      }),
      createApp({
        id: 'app-codex',
        name: 'Codex',
        developer: 'OpenAI',
        description: 'Terminal-first coding agent.',
        installTags: ['cli'],
      }),
    ]),
    createCategory('Package Managers', [
      createApp({
        id: 'app-pnpm',
        name: 'pnpm',
        developer: 'pnpm',
        category: 'Package Managers',
        description: 'Fast package manager for JavaScript.',
        installSummary: 'Install pnpm on the current host.',
        installTags: ['package-manager', 'nodejs'],
      }),
    ]),
  ];

  const filtered = filterCategoriesByKeyword(categories, 'docker');

  assert.equal(filtered.length, 1);
  assert.equal(filtered[0]?.title, 'AI Agents');
  assert.deepEqual(
    filtered[0]?.apps.map((app) => app.id),
    ['app-openclaw'],
  );
});

await runTest('priority and full installable id collection are derived only from catalog categories', () => {
  const categories = [
    createCategory('AI Agents', [
      createApp({ id: 'app-openclaw' }),
      createApp({ id: 'app-codex' }),
    ]),
    createCategory('Package Managers', [
      createApp({ id: 'app-nodejs' }),
      createApp({ id: 'app-pnpm', installable: false }),
      createApp({ id: 'app-homebrew' }),
    ]),
  ];

  assert.deepEqual(collectInstallableAppIdsFromCategories(categories), [
    'app-openclaw',
    'app-codex',
    'app-nodejs',
    'app-homebrew',
  ]);
  assert.deepEqual(collectPriorityInstallableAppIds(categories, 2), [
    'app-openclaw',
    'app-codex',
  ]);
});

await runTest('createStoreOverview summarizes catalog totals and install surface states', () => {
  const categories = [
    createCategory('AI Agents', [
      createApp({ id: 'app-openclaw' }),
      createApp({ id: 'app-codex' }),
    ]),
    createCategory('Package Managers', [
      createApp({ id: 'app-nodejs' }),
    ]),
  ];

  const overview = createStoreOverview(categories, {
    'app-openclaw': createInstallSurfaceSummary('app-openclaw', { state: 'installed' }),
    'app-codex': createInstallSurfaceSummary('app-codex', { state: 'ready', ready: true }),
    'app-nodejs': createInstallSurfaceSummary('app-nodejs', {
      state: 'attention',
      blockingIssueCount: 1,
    }),
  });

  assert.deepEqual(overview, {
    totalApps: 3,
    totalCategories: 2,
    installableApps: 3,
    installedApps: 1,
    readyApps: 1,
    attentionApps: 1,
  });
});

await runTest('createCatalogMetadataFields omits missing values instead of inventing fake detail data', () => {
  const fields = createCatalogMetadataFields({
    registryName: 'Hub Installer Official Registry',
    defaultSoftwareName: 'openclaw-wsl',
    selectedSoftwareName: '',
    supportedHostLabels: ['Windows', 'Ubuntu'],
  });

  assert.deepEqual(fields, [
    {
      id: 'registry',
      value: 'Hub Installer Official Registry',
    },
    {
      id: 'defaultSoftwareName',
      value: 'openclaw-wsl',
    },
    {
      id: 'supportedHosts',
      value: 'Windows, Ubuntu',
    },
  ]);
});
