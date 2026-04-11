import assert from 'node:assert/strict';
import { createAppStoreService } from './appStoreService.ts';

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

interface RemoteCatalogApp {
  id: string;
  name: string;
  developer: string;
  category: string;
  description?: string;
  iconUrl?: string;
  storeUrl?: string;
  downloadUrl?: string;
}

interface RemoteCatalogCategory {
  code: string;
  name: string;
  count: number;
}

function createRemoteApp(overrides: Partial<RemoteCatalogApp> = {}): RemoteCatalogApp {
  return {
    id: 'app-openclaw',
    name: 'OpenClaw Desktop',
    developer: 'SDKWork',
    category: 'AI Agents',
    description: 'Remote catalog entry for OpenClaw Desktop.',
    iconUrl: 'https://cdn.sdkwork.com/openclaw/icon.png',
    storeUrl: 'https://store.sdkwork.com/openclaw',
    downloadUrl: 'https://downloads.sdkwork.com/openclaw',
    ...overrides,
  };
}

function createRemoteCategory(
  overrides: Partial<RemoteCatalogCategory> = {},
): RemoteCatalogCategory {
  return {
    code: 'ai-agents',
    name: 'AI Agents',
    count: 1,
    ...overrides,
  };
}

function createCatalogService(options: {
  items?: RemoteCatalogApp[];
  categories?: RemoteCatalogCategory[];
} = {}) {
  const items = options.items ?? [createRemoteApp()];
  const categories = options.categories ?? [createRemoteCategory({ count: items.length })];
  const listQueries: Array<Record<string, unknown> | undefined> = [];
  const itemsById = new Map(items.map((item) => [item.id, item] as const));

  return {
    listQueries,
    service: {
      async listApps(params?: Record<string, unknown>) {
        listQueries.push(params);
        return {
          items,
          total: items.length,
          page: Number(params?.page ?? 1),
          pageSize: Number(params?.pageSize ?? items.length),
          hasMore: false,
        };
      },
      async listCategories() {
        return categories;
      },
      async getApp(id: string) {
        const item = itemsById.get(id);
        if (!item) {
          throw new Error(`missing app ${id}`);
        }

        return item;
      },
    },
  };
}

await runTest(
  'remote app metadata remains available without inventing embedded install fields',
  async () => {
    const { listQueries, service: remoteCatalogService } = createCatalogService({
      items: [
        createRemoteApp(),
        createRemoteApp({
          id: 'app-codex',
          name: 'Codex',
          developer: 'OpenAI',
          category: 'Developer Tools',
          description: 'Terminal-first coding agent.',
          downloadUrl: undefined,
        }),
      ],
      categories: [
        createRemoteCategory({ code: 'developer-tools', name: 'Developer Tools', count: 1 }),
        createRemoteCategory({ code: 'ai-agents', name: 'AI Agents', count: 1 }),
      ],
    });
    const service = createAppStoreService({
      appStoreCatalogService: remoteCatalogService,
    });

    const page = await service.getList({ page: 2, pageSize: 1, keyword: 'claw' });
    const categories = await service.getCategories();
    const app = await service.getApp('app-openclaw');

    assert.equal(listQueries[0]?.keyword, 'claw');
    assert.equal(listQueries[0]?.page, 2);
    assert.equal(listQueries[0]?.pageSize, 1);
    assert.ok(
      listQueries.some(
        (query) =>
          query?.keyword === undefined && query?.page === 1 && query?.pageSize === 100,
      ),
    );
    assert.equal(page.items[0]?.id, 'app-openclaw');
    assert.equal(page.items[0]?.downloadUrl, 'https://downloads.sdkwork.com/openclaw');
    assert.equal(page.items[0]?.installSummary, undefined);
    assert.equal(page.items[0]?.installHomepage, undefined);
    assert.equal(page.items[0]?.installable, undefined);
    assert.equal(categories.length, 2);
    assert.equal(categories[0]?.title, 'Developer Tools');
    assert.equal(categories[0]?.apps[0]?.id, 'app-codex');
    assert.equal(categories[1]?.title, 'AI Agents');
    assert.equal(categories[1]?.apps[0]?.id, 'app-openclaw');
    assert.equal(app.id, 'app-openclaw');
    assert.equal(app.storeUrl, 'https://store.sdkwork.com/openclaw');
    assert.equal(app.installSummary, undefined);
  },
);

await runTest(
  'install catalog lookups stay empty after embedded install orchestration removal',
  async () => {
    const { service: remoteCatalogService } = createCatalogService();
    const service = createAppStoreService({
      appStoreCatalogService: remoteCatalogService,
    });

    assert.deepEqual(await service.getInstallCatalog({ hostPlatform: 'windows' }), []);
    await assert.rejects(
      service.getInstallDefinition('app-openclaw', { hostPlatform: 'windows' }),
      /No installer catalog entry exists for app: app-openclaw/,
    );
    await assert.rejects(
      service.resolveInstallTarget('app-openclaw', { hostPlatform: 'windows' }),
      /No installer catalog entry exists for app: app-openclaw/,
    );
  },
);

await runTest(
  'install surface summaries stay empty when no embedded install descriptors are exposed',
  async () => {
    const { service: remoteCatalogService } = createCatalogService();
    const service = createAppStoreService({
      appStoreCatalogService: remoteCatalogService,
    });

    const summaries = await service.getInstallSurfaceSummaries(
      ['app-openclaw', 'app-codex'],
      { hostPlatform: 'windows' },
    );

    assert.equal(summaries.size, 0);
  },
);

await runTest(
  'guided install navigation falls back through external download, store, and docs links',
  async () => {
    const { service: remoteCatalogService } = createCatalogService({
      items: [
        createRemoteApp({
          id: 'app-download',
          downloadUrl: 'https://downloads.sdkwork.com/app-download',
          storeUrl: 'https://store.sdkwork.com/app-download',
        }),
        createRemoteApp({
          id: 'app-store',
          downloadUrl: undefined,
          storeUrl: 'https://store.sdkwork.com/app-store',
        }),
        createRemoteApp({
          id: 'app-docs',
          downloadUrl: undefined,
          storeUrl: undefined,
        }),
      ],
      categories: [createRemoteCategory({ count: 3 })],
    });
    const service = createAppStoreService({
      appStoreCatalogService: remoteCatalogService,
    });

    assert.equal(
      await service.getGuidedInstallNavigation('app-download'),
      'https://downloads.sdkwork.com/app-download',
    );
    assert.equal(
      await service.getGuidedInstallNavigation('app-store'),
      'https://store.sdkwork.com/app-store',
    );
    assert.equal(await service.getGuidedInstallNavigation('app-docs'), '/docs#script');
    assert.equal(await service.getGuidedInstallNavigation('missing-app'), '/docs#script');
  },
);

await runTest(
  'install lifecycle methods reject with the removed embedded install integration message',
  async () => {
    const { service: remoteCatalogService } = createCatalogService();
    const service = createAppStoreService({
      appStoreCatalogService: remoteCatalogService,
    });

    await assert.rejects(
      service.installDependencies('app-openclaw', { hostPlatform: 'windows' }),
      /Embedded install integration was removed\./,
    );
    await assert.rejects(
      service.installApp('app-openclaw', { hostPlatform: 'windows' }),
      /Embedded install integration was removed\./,
    );
    await assert.rejects(
      service.uninstallApp('app-openclaw', { hostPlatform: 'windows' }),
      /Embedded install integration was removed\./,
    );
  },
);
