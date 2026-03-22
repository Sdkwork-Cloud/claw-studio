import assert from 'node:assert/strict';
import {
  createCatalogGridStyle,
  createMySkillsCatalogGridStyle,
  createPackCatalogGridStyle,
  createSkillCatalogGridStyle,
} from './marketLayout.ts';

function runTest(name: string, callback: () => void) {
  try {
    callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

await runTest('createCatalogGridStyle keeps a single skill card at a readable width', () => {
  assert.deepEqual(
    createCatalogGridStyle({
      itemCount: 1,
      minCardWidthRem: 19,
      singleCardMaxWidthRem: 24,
    }),
    {
      gridTemplateColumns: 'minmax(min(100%, 19rem), 24rem)',
      justifyContent: 'start',
    },
  );
});

await runTest('createCatalogGridStyle keeps multi-card layouts fluid across wider widths', () => {
  assert.deepEqual(
    createCatalogGridStyle({
      itemCount: 3,
      minCardWidthRem: 19,
      singleCardMaxWidthRem: 24,
    }),
    {
      gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 19rem), 1fr))',
    },
  );
});

await runTest('createSkillCatalogGridStyle keeps sparse skill layouts readable instead of stretching every card', () => {
  assert.deepEqual(createSkillCatalogGridStyle(2), {
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 19rem), 24rem))',
    justifyContent: 'start',
  });
});

await runTest('createMySkillsCatalogGridStyle matches the skill-card width policy', () => {
  assert.deepEqual(createMySkillsCatalogGridStyle(2), createSkillCatalogGridStyle(2));
});

await runTest('createPackCatalogGridStyle supports wider pack cards without full-width single-card stretching', () => {
  assert.deepEqual(createPackCatalogGridStyle(1), {
    gridTemplateColumns: 'minmax(min(100%, 23rem), 29rem)',
    justifyContent: 'start',
  });
});

await runTest('createPackCatalogGridStyle keeps sparse pack layouts readable instead of stretching every card', () => {
  assert.deepEqual(createPackCatalogGridStyle(2), {
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 23rem), 29rem))',
    justifyContent: 'start',
  });
});

await runTest('createCatalogGridStyle supports wider pack cards without full-width single-card stretching', () => {
  assert.deepEqual(
    createCatalogGridStyle({
      itemCount: 1,
      minCardWidthRem: 23,
      singleCardMaxWidthRem: 29,
    }),
    {
      gridTemplateColumns: 'minmax(min(100%, 23rem), 29rem)',
      justifyContent: 'start',
    },
  );
});
