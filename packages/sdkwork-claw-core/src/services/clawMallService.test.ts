import assert from 'node:assert/strict';
import { createClient } from '@sdkwork/app-sdk';
import { createClawMallService } from './clawMallService.ts';

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
  'clawMallService maps generated app sdk product payloads into mall catalog objects',
  async () => {
    const service = createClawMallService({
      getClient: () =>
        ({
          product: {
            getProductCategoryTree: async () => ({
              code: '2000',
              data: [
                {
                  id: '11',
                  name: 'Creative Hardware',
                  description: 'Devices and hardware add-ons.',
                  icon: 'cpu',
                  children: [
                    {
                      id: '12',
                      parentId: '11',
                      name: 'Input Devices',
                      description: 'Keyboards and controllers.',
                    },
                  ],
                },
              ],
            }),
            getProducts: async (params?: Record<string, unknown>) => {
              assert.equal(params?.page, 2);
              assert.equal(params?.size, 5);
              assert.equal(params?.status, 'ACTIVE');
              return {
                code: '2000',
                data: {
                  content: [
                    {
                      id: '7',
                      title: 'OpenClaw Console',
                      summary: 'A console for workflow orchestration.',
                      mainImage: 'https://cdn.sdkwork.com/products/7/main.png',
                      price: 1999,
                      originalPrice: 2499,
                      sales: 320,
                      status: 'ACTIVE',
                      hot: true,
                      categoryName: 'Creative Hardware',
                      tags: ['console', 'workflow'],
                    },
                  ],
                  totalElements: 9,
                  number: 1,
                  size: 5,
                  last: false,
                },
              };
            },
            getProductsByCategory: async (
              categoryId: string | number,
              params?: Record<string, unknown>,
            ) => {
              assert.equal(categoryId, '11');
              assert.equal(params?.page, 1);
              assert.equal(params?.size, 4);
              assert.equal(params?.status, 'ACTIVE');
              return {
                code: '2000',
                data: {
                  content: [
                    {
                      id: '8',
                      title: 'Workflow Dock',
                      summary: 'A dock for operators.',
                      price: 899,
                      status: 'ACTIVE',
                      categoryName: 'Creative Hardware',
                    },
                  ],
                  totalElements: 1,
                  number: 0,
                  size: 4,
                  last: true,
                },
              };
            },
            searchProducts: async (params?: Record<string, unknown>) => {
              assert.equal(params?.keyword, 'claw');
              assert.equal(params?.categoryId, '11');
              assert.equal(params?.page, 1);
              assert.equal(params?.size, 6);
              return {
                code: '2000',
                data: {
                  content: [
                    {
                      id: '9',
                      title: 'Claw Runtime Hub',
                      summary: 'Search result item.',
                      price: 1299,
                      status: 'ACTIVE',
                      categoryName: 'Creative Hardware',
                    },
                  ],
                  totalElements: 1,
                  number: 0,
                  size: 6,
                  last: true,
                },
              };
            },
            getLatestProducts: async (params?: Record<string, unknown>) => {
              assert.equal(params?.limit, 3);
              return {
                code: '2000',
                data: [
                  {
                    id: '10',
                    title: 'OpenClaw Beam',
                    summary: 'Newest product.',
                    price: 499,
                    status: 'ACTIVE',
                  },
                ],
              };
            },
            getHotProducts: async (params?: Record<string, unknown>) => {
              assert.equal(params?.limit, 4);
              return {
                code: '2000',
                data: [
                  {
                    id: '11',
                    title: 'Operator Grid',
                    summary: 'Most popular product.',
                    price: 799,
                    status: 'ACTIVE',
                    hot: true,
                  },
                ],
              };
            },
            getProductDetail: async (productId: string | number) => {
              assert.equal(productId, '7');
              return {
                code: '2000',
                data: {
                  id: '7',
                  title: 'OpenClaw Console',
                  summary: 'A console for workflow orchestration.',
                  description: 'A console built for workflow orchestration.',
                  categoryId: '11',
                  categoryName: 'Creative Hardware',
                  mainImage: 'https://cdn.sdkwork.com/products/7/main.png',
                  images: [
                    'https://cdn.sdkwork.com/products/7/main.png',
                    'https://cdn.sdkwork.com/products/7/side.png',
                  ],
                  videoUrl: 'https://cdn.sdkwork.com/products/7/intro.mp4',
                  price: 1999,
                  originalPrice: 2499,
                  stock: 16,
                  sales: 320,
                  status: 'ACTIVE',
                  tags: ['console', 'workflow'],
                  attributes: [
                    {
                      id: 'memory',
                      name: 'Memory',
                      values: ['32 GB'],
                    },
                  ],
                  skus: [
                    {
                      id: 'sku-1',
                      skuCode: 'console-standard',
                      skuName: 'Standard',
                      price: 1999,
                      stock: 16,
                    },
                  ],
                },
              };
            },
          },
        }) as any,
    });

    const categories = await service.listCategories();
    const page = await service.listProducts({ page: 2, pageSize: 5 });
    const categoryPage = await service.listProducts({ categoryId: '11', page: 1, pageSize: 4 });
    const searchPage = await service.listProducts({
      keyword: 'claw',
      categoryId: '11',
      page: 1,
      pageSize: 6,
    });
    const latest = await service.listLatestProducts(3);
    const hot = await service.listHotProducts(4);
    const detail = await service.getProduct('7');

    assert.equal(categories[0]?.id, '11');
    assert.equal(categories[0]?.children[0]?.id, '12');
    assert.equal(page.total, 9);
    assert.equal(page.page, 2);
    assert.equal(page.pageSize, 5);
    assert.equal(page.hasMore, true);
    assert.equal(page.items[0]?.id, '7');
    assert.equal(page.items[0]?.title, 'OpenClaw Console');
    assert.equal(page.items[0]?.status, 'active');
    assert.equal(categoryPage.items[0]?.id, '8');
    assert.equal(searchPage.items[0]?.id, '9');
    assert.equal(latest[0]?.id, '10');
    assert.equal(hot[0]?.id, '11');
    assert.equal(detail.images[1], 'https://cdn.sdkwork.com/products/7/side.png');
    assert.equal(detail.videoUrl, 'https://cdn.sdkwork.com/products/7/intro.mp4');
    assert.equal(detail.attributes[0]?.name, 'Memory');
    assert.equal(detail.skus[0]?.skuName, 'Standard');
  },
);

await runTest(
  'clawMallService issues generated app sdk HTTP requests for categories, product pages, and detail resources',
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

      if (url.pathname === '/app/v3/api/products/categories/tree') {
        return new Response(JSON.stringify({ code: '2000', data: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.pathname === '/app/v3/api/products/latest') {
        return new Response(JSON.stringify({ code: '2000', data: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.pathname === '/app/v3/api/products/hot') {
        return new Response(JSON.stringify({ code: '2000', data: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.pathname === '/app/v3/api/products/7') {
        return new Response(JSON.stringify({ code: '2000', data: { id: '7', status: 'ACTIVE' } }), {
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
      const service = createClawMallService({
        getClient: () =>
          createClient({
            baseUrl: 'https://api.sdkwork.test',
            accessToken: 'access-token',
          }) as any,
      });

      await service.listCategories();
      await service.listProducts({ page: 2, pageSize: 5 });
      await service.listProducts({ categoryId: '11', page: 1, pageSize: 4 });
      await service.listProducts({ keyword: 'claw', categoryId: '11', page: 1, pageSize: 6 });
      await service.listLatestProducts(3);
      await service.listHotProducts(4);
      await service.getProduct('7');
    } finally {
      globalThis.fetch = originalFetch;
    }

    assert.equal(fetchCalls.length, 7);

    const urls = fetchCalls.map(({ input }) => {
      const rawUrl =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      return new URL(rawUrl);
    });

    assert.ok(urls.some((url) => url.pathname === '/app/v3/api/products/categories/tree'));
    assert.ok(
      urls.some(
        (url) =>
          url.pathname === '/app/v3/api/products' &&
          url.searchParams.get('page') === '2' &&
          url.searchParams.get('size') === '5' &&
          url.searchParams.get('status') === 'ACTIVE',
      ),
    );
    assert.ok(
      urls.some(
        (url) =>
          url.pathname === '/app/v3/api/products/category/11' &&
          url.searchParams.get('page') === '1' &&
          url.searchParams.get('size') === '4' &&
          url.searchParams.get('status') === 'ACTIVE',
      ),
    );
    assert.ok(
      urls.some(
        (url) =>
          url.pathname === '/app/v3/api/products/search' &&
          url.searchParams.get('keyword') === 'claw' &&
          url.searchParams.get('categoryId') === '11' &&
          url.searchParams.get('page') === '1' &&
          url.searchParams.get('size') === '6',
      ),
    );
    assert.ok(
      urls.some(
        (url) =>
          url.pathname === '/app/v3/api/products/latest' &&
          url.searchParams.get('limit') === '3',
      ),
    );
    assert.ok(
      urls.some(
        (url) =>
          url.pathname === '/app/v3/api/products/hot' &&
          url.searchParams.get('limit') === '4',
      ),
    );
    assert.ok(urls.some((url) => url.pathname === '/app/v3/api/products/7'));
  },
);
