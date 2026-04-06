import assert from 'node:assert/strict';
import {
  flattenMallCategories,
  selectRelatedProducts,
} from './mallCatalogPresentation.ts';

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

await runTest('flattenMallCategories preserves depth-first order and depth metadata', () => {
  const categories = flattenMallCategories([
    {
      id: '11',
      name: 'Creative Hardware',
      children: [
        {
          id: '12',
          name: 'Input Devices',
          children: [],
        },
      ],
    },
  ] as any);

  assert.deepEqual(
    categories.map((category) => ({ id: category.id, depth: category.depth })),
    [
      { id: '11', depth: 0 },
      { id: '12', depth: 1 },
    ],
  );
});

await runTest('selectRelatedProducts drops the current product and keeps the requested limit', () => {
  const related = selectRelatedProducts(
    '7',
    [
      { id: '7', title: 'OpenClaw Console' },
      { id: '8', title: 'Operator Grid' },
      { id: '9', title: 'Workflow Dock' },
    ] as any,
    1,
  );

  assert.deepEqual(related.map((product) => product.id), ['8']);
});
