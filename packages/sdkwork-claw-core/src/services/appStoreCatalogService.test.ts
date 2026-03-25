import assert from 'node:assert/strict';
import { createClient } from '@sdkwork/app-sdk';
import { createAppStoreCatalogService } from './appStoreCatalogService.ts';

function runTest(name: string, callback: () => void | Promise<void>) {
  return Promise.resolve()
    .then(callback)
    .then(() => {
      console.log(`ok - ${name}`);
    })
    .catch((error) => {
      console.error(`not ok - ${name}`);
      throw error;
    });
}

await runTest(
  'appStoreCatalogService maps generated app sdk store payloads into AppStore catalog objects',
  async () => {
    const service = createAppStoreCatalogService({
      getClient: () =>
        ({
          app: {
            listStoreApps: async (params?: Record<string, unknown>) => {
              assert.equal(params?.keyword, 'claw');
              assert.equal(params?.category, 'SDK');
              assert.equal(params?.page, 2);
              assert.equal(params?.size, 5);
              return {
                code: '2000',
                data: {
                  content: [
                    {
                      appId: '1001',
                      name: 'OpenClaw Desktop',
                      description: 'Desktop automation app.',
                      developer: 'SDKWork',
                      category: 'SDK',
                      iconUrl: 'https://cdn.sdkwork.com/openclaw/icon.png',
                      version: '1.0.0',
                    },
                  ],
                  totalElements: 6,
                  number: 1,
                  size: 5,
                  last: false,
                },
              };
            },
            listStoreCategories: async () => ({
              code: '2000',
              data: [
                {
                  code: 'sdk',
                  name: 'SDK',
                  count: 2,
                },
              ],
            }),
            retrieveStore: async (appId: string | number) => {
              assert.equal(appId, '1001');
              return {
                code: '2000',
                data: {
                  appId: '1001',
                  name: 'OpenClaw Desktop',
                  description: 'Desktop automation app.',
                  developer: 'SDKWork',
                  category: 'SDK',
                  iconUrl: 'https://cdn.sdkwork.com/openclaw/icon.png',
                  version: '1.0.1',
                  storeUrl: 'https://store.sdkwork.com/openclaw',
                  downloadUrl: 'https://cdn.sdkwork.com/openclaw/download.zip',
                },
              };
            },
          },
        }) as any,
    });

    const page = await service.listApps({
      keyword: 'claw',
      category: 'SDK',
      page: 2,
      pageSize: 5,
    });
    const categories = await service.listCategories();
    const app = await service.getApp('1001');

    assert.equal(page.total, 6);
    assert.equal(page.page, 2);
    assert.equal(page.pageSize, 5);
    assert.equal(page.hasMore, true);
    assert.equal(page.items[0]?.developer, 'SDKWork');
    assert.equal(categories[0]?.code, 'sdk');
    assert.equal(app.id, '1001');
    assert.equal(app.storeUrl, 'https://store.sdkwork.com/openclaw');
    assert.equal(app.downloadUrl, 'https://cdn.sdkwork.com/openclaw/download.zip');
  },
);

await runTest(
  'appStoreCatalogService issues generated app sdk HTTP requests for public store resources',
  async () => {
    const originalFetch = globalThis.fetch;
    const fetchCalls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      fetchCalls.push({ input, init });

      const rawUrl =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      const url = new URL(rawUrl);

      if (url.pathname === '/app/v3/api/app/store/categories') {
        return new Response(JSON.stringify({ code: '2000', data: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.pathname === '/app/v3/api/app/store/1001') {
        return new Response(JSON.stringify({ code: '2000', data: { appId: '1001' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(
        JSON.stringify({
          code: '2000',
          data: {
            content: [],
            totalElements: 0,
            number: 0,
            size: 20,
            last: true,
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }) as typeof fetch;

    try {
      const service = createAppStoreCatalogService({
        getClient: () =>
          createClient({
            baseUrl: 'https://api.sdkwork.test',
            accessToken: 'access-token',
          }) as any,
      });

      await service.listApps({
        keyword: 'claw',
        category: 'SDK',
        page: 2,
        pageSize: 5,
      });
      await service.listCategories();
      await service.getApp('1001');
    } finally {
      globalThis.fetch = originalFetch;
    }

    assert.equal(fetchCalls.length, 3);

    const urls = fetchCalls.map(({ input }) => {
      const rawUrl =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      return new URL(rawUrl);
    });

    assert.ok(
      urls.some(
        (url) =>
          url.pathname === '/app/v3/api/app/store' &&
          url.searchParams.get('keyword') === 'claw' &&
          url.searchParams.get('category') === 'SDK' &&
          url.searchParams.get('page') === '2' &&
          url.searchParams.get('size') === '5',
      ),
    );
    assert.ok(urls.some((url) => url.pathname === '/app/v3/api/app/store/categories'));
    assert.ok(urls.some((url) => url.pathname === '/app/v3/api/app/store/1001'));
  },
);
