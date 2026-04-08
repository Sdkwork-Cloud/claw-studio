import assert from 'node:assert/strict';
import type { ClawMallProduct, ClawMallService } from '@sdkwork/claw-core';
import { createClawMallCatalogService } from './clawMallService.ts';

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

function createProduct(overrides: Partial<ClawMallProduct> = {}): ClawMallProduct {
  return {
    id: 'product-1',
    title: 'OpenClaw Console',
    summary: 'A console for operators.',
    description: 'A console for operators.',
    categoryId: '11',
    categoryName: 'Creative Hardware',
    mainImage: 'https://cdn.sdkwork.com/products/default/main.png',
    images: ['https://cdn.sdkwork.com/products/default/main.png'],
    price: 1999,
    status: 'active',
    hot: false,
    recommended: false,
    tags: [],
    attributes: [],
    skus: [],
    ...overrides,
  };
}

await runTest(
  'clawMallCatalogService composes catalog, spotlight, and related product reads through the claw-core mall wrapper',
  async () => {
    const calls: string[] = [];
    const clawMallService: ClawMallService = {
      listCategories: async () => {
        calls.push('categories');
        return [{ id: '11', name: 'Creative Hardware', children: [] }];
      },
      listProducts: async (query) => {
        calls.push(`products:${JSON.stringify(query)}`);
        return {
          items: [createProduct({ id: '7', hot: true, recommended: true, tags: ['console'] })],
          total: 1,
          page: Number(query?.page || 1),
          pageSize: Number(query?.pageSize || 12),
          hasMore: false,
        };
      },
      listLatestProducts: async (limit) => {
        calls.push(`latest:${limit}`);
        return [createProduct({ id: '9', title: 'OpenClaw Beam', summary: 'Newest item.', price: 499 })];
      },
      listHotProducts: async (limit) => {
        calls.push(`hot:${limit}`);
        return [createProduct({ id: '8', title: 'Operator Grid', summary: 'Hottest item.', price: 799, hot: true })];
      },
      getProduct: async (id) => {
        calls.push(`detail:${id}`);
        return createProduct({
          id,
          hot: true,
          recommended: true,
          tags: ['console'],
          mainImage: 'https://cdn.sdkwork.com/products/7/main.png',
          images: ['https://cdn.sdkwork.com/products/7/main.png'],
        });
      },
    };
    const service = createClawMallCatalogService({
      clawMallService,
    });

    const snapshot = await service.getCatalog({
      keyword: 'claw',
      categoryId: '11',
      page: 2,
      pageSize: 5,
    });
    const detail = await service.getProduct('7');
    const related = await service.getRelatedProducts(detail, 4);

    assert.equal(snapshot.categories[0]?.id, '11');
    assert.equal(snapshot.page.items[0]?.id, '7');
    assert.equal(snapshot.hotProducts[0]?.id, '8');
    assert.equal(snapshot.latestProducts[0]?.id, '9');
    assert.equal(detail.id, '7');
    assert.deepEqual(
      related.map((product) => product.id),
      [],
    );
    assert.deepEqual(calls, [
      'categories',
      'products:{"keyword":"claw","categoryId":"11","page":2,"pageSize":5}',
      'hot:6',
      'latest:6',
      'detail:7',
      'products:{"categoryId":"11","page":1,"pageSize":5}',
    ]);
  },
);
