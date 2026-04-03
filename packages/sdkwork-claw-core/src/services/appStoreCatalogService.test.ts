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
  'appStoreCatalogService maps current generated app sdk app payloads into AppStore catalog objects',
  async () => {
    let searchRequestCount = 0;

    const service = createAppStoreCatalogService({
      getClient: () =>
        ({
          app: {
            searchApps: async (params?: Record<string, unknown>) => {
              searchRequestCount += 1;

              if (params?.keyword) {
                assert.equal(params?.keyword, 'claw');
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
                        appType: 'APP_SDK',
                        installSkill: {
                          name: 'SDKWork',
                        },
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
              }

              assert.equal(params?.page, 1);

              return {
                code: '2000',
                data: {
                  content: [
                    {
                      appId: '1001',
                      name: 'OpenClaw Desktop',
                      appType: 'APP_SDK',
                    },
                    {
                      appId: '1002',
                      name: 'ZeroClaw Ops',
                      appType: 'APP_TOOLING',
                    },
                  ],
                  totalElements: 2,
                  number: 0,
                  size: 100,
                  last: true,
                },
              };
            },
            retrieve: async (appId: string | number) => {
              assert.equal(appId, '1001');

              return {
                code: '2000',
                data: {
                  appId: '1001',
                  name: 'OpenClaw Desktop',
                  description: 'Desktop automation app.',
                  appType: 'APP_SDK',
                  installSkill: {
                    name: 'SDKWork',
                  },
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
      page: 2,
      pageSize: 5,
    });
    const categories = await service.listCategories();
    const app = await service.getApp('1001');

    assert.equal(searchRequestCount, 2);
    assert.equal(page.total, 6);
    assert.equal(page.page, 2);
    assert.equal(page.pageSize, 5);
    assert.equal(page.hasMore, true);
    assert.equal(page.items[0]?.developer, 'SDKWork');
    assert.equal(page.items[0]?.category, 'SDK');
    assert.deepEqual(categories, [
      {
        code: 'sdk',
        name: 'SDK',
        count: 1,
      },
      {
        code: 'tooling',
        name: 'Tooling',
        count: 1,
      },
    ]);
    assert.equal(app.id, '1001');
    assert.equal(app.category, 'SDK');
    assert.equal(app.storeUrl, 'https://store.sdkwork.com/openclaw');
    assert.equal(app.downloadUrl, 'https://cdn.sdkwork.com/openclaw/download.zip');
  },
);

await runTest(
  'appStoreCatalogService filters category results on the client when store-specific sdk endpoints are unavailable',
  async () => {
    const requestedPages: number[] = [];

    const service = createAppStoreCatalogService({
      getClient: () =>
        ({
          app: {
            searchApps: async (params?: Record<string, unknown>) => {
              requestedPages.push(Number(params?.page || 1));

              if (Number(params?.page || 1) === 1) {
                return {
                  code: '2000',
                  data: {
                    content: [
                      {
                        appId: '1001',
                        name: 'OpenClaw Desktop',
                        appType: 'APP_SDK',
                      },
                      {
                        appId: '1002',
                        name: 'ZeroClaw Ops',
                        appType: 'APP_TOOLING',
                      },
                    ],
                    totalElements: 4,
                    number: 0,
                    size: 2,
                    last: false,
                  },
                };
              }

              return {
                code: '2000',
                data: {
                  content: [
                    {
                      appId: '1003',
                      name: 'IronClaw Studio',
                      appType: 'APP_SDK',
                    },
                    {
                      appId: '1004',
                      name: 'Signal Center',
                      appType: 'APP_COMMUNITY',
                    },
                  ],
                  totalElements: 4,
                  number: 1,
                  size: 2,
                  last: true,
                },
              };
            },
          },
        }) as any,
    });

    const page = await service.listApps({
      category: 'SDK',
      page: 1,
      pageSize: 5,
    });

    assert.deepEqual(requestedPages, [1, 2]);
    assert.equal(page.total, 2);
    assert.equal(page.page, 1);
    assert.equal(page.pageSize, 5);
    assert.equal(page.hasMore, false);
    assert.deepEqual(
      page.items.map((item) => item.id),
      ['1001', '1003'],
    );
    assert.ok(page.items.every((item) => item.category === 'SDK'));
  },
);

await runTest(
  'appStoreCatalogService issues generated app sdk HTTP requests for current public app resources',
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

      if (url.pathname === '/app/v3/api/app/manage/1001') {
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
        page: 2,
        pageSize: 5,
      });
      await service.listCategories();
      await service.getApp('1001');
    } finally {
      globalThis.fetch = originalFetch;
    }

    assert.ok(fetchCalls.length >= 3);

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
          url.pathname === '/app/v3/api/app/manage/search' &&
          url.searchParams.get('keyword') === 'claw' &&
          url.searchParams.get('page') === '2' &&
          url.searchParams.get('size') === '5',
      ),
    );
    assert.ok(urls.some((url) => url.pathname === '/app/v3/api/app/manage/1001'));
    assert.ok(urls.every((url) => !url.pathname.startsWith('/app/v3/api/app/store')));
  },
);
