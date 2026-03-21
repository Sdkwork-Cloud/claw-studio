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

await runTest('model purchase catalog includes default plus curated US and China top vendors', async () => {
  const { ensureI18n } = await import('@sdkwork/claw-i18n');
  const { modelPurchaseCatalogService } = await import('./modelPurchaseCatalog.ts');

  await ensureI18n('en');
  const catalog = await modelPurchaseCatalogService.listVendors('en');
  const ids = catalog.map((vendor) => vendor.id);

  assert.deepEqual(
    ids,
    [
      'default',
      'openai',
      'anthropic',
      'google',
      'xai',
      'meta',
      'mistral',
      'cohere',
      'microsoft',
      'amazon-nova',
      'nvidia',
      'deepseek',
      'qwen',
      'zhipu',
      'baidu',
      'tencent-hunyuan',
      'doubao',
      'moonshot',
      'minimax',
    ],
  );
});

await runTest('model purchase catalog exposes monthly quarterly and yearly plans for default openai and minimax', async () => {
  const { ensureI18n } = await import('@sdkwork/claw-i18n');
  const { modelPurchaseCatalogService } = await import('./modelPurchaseCatalog.ts');

  await ensureI18n('en');
  const catalog = await modelPurchaseCatalogService.listVendors('en');
  const defaultVendor = catalog.find((vendor) => vendor.id === 'default');
  const openaiVendor = catalog.find((vendor) => vendor.id === 'openai');
  const minimaxVendor = catalog.find((vendor) => vendor.id === 'minimax');

  assert.ok(defaultVendor);
  assert.ok(openaiVendor);
  assert.ok(minimaxVendor);

  for (const vendor of [defaultVendor, openaiVendor, minimaxVendor]) {
    assert.deepEqual(
      vendor.billingCycles.map((cycle) => cycle.id),
      ['monthly', 'quarterly', 'yearly'],
    );
    assert.equal(vendor.billingCycles.every((cycle) => cycle.plans.length >= 3), true);
  }

  assert.deepEqual(
    defaultVendor.billingCycles[0]?.plans.map((plan) => plan.name),
    ['Starter Router', 'Growth Router', 'Scale Router'],
  );
  assert.deepEqual(
    openaiVendor.billingCycles[0]?.plans.map((plan) => plan.name),
    ['ChatGPT Launch', 'ChatGPT Pro', 'ChatGPT Max'],
  );
  assert.deepEqual(
    minimaxVendor.billingCycles[0]?.plans.map((plan) => plan.name),
    ['MiniMax Sprint', 'MiniMax Studio', 'MiniMax Infinite'],
  );
});

await runTest('model purchase catalog localizes billing metadata for Chinese', async () => {
  const { ensureI18n } = await import('@sdkwork/claw-i18n');
  const { modelPurchaseCatalogService } = await import('./modelPurchaseCatalog.ts');

  await ensureI18n('zh');
  const catalog = await modelPurchaseCatalogService.listVendors('zh');
  const defaultVendor = catalog.find((vendor) => vendor.id === 'default');

  assert.ok(defaultVendor);
  assert.match(defaultVendor.billingCycles[0]?.label ?? '', /[\p{Script=Han}]/u);
  assert.match(defaultVendor.metrics[0]?.label ?? '', /[\p{Script=Han}]/u);
});

await runTest('model purchase catalog localizes vendor copy for Chinese without falling back to English', async () => {
  const { ensureI18n } = await import('@sdkwork/claw-i18n');
  const { modelPurchaseCatalogService } = await import('./modelPurchaseCatalog.ts');

  await ensureI18n('en');
  const englishCatalog = await modelPurchaseCatalogService.listVendors('en');
  const englishOpenaiVendor = englishCatalog.find((vendor) => vendor.id === 'openai');
  const englishMinimaxVendor = englishCatalog.find((vendor) => vendor.id === 'minimax');

  await ensureI18n('zh');
  const catalog = await modelPurchaseCatalogService.listVendors('zh');
  const openaiVendor = catalog.find((vendor) => vendor.id === 'openai');
  const minimaxVendor = catalog.find((vendor) => vendor.id === 'minimax');

  assert.ok(openaiVendor);
  assert.ok(minimaxVendor);
  assert.ok(englishOpenaiVendor);
  assert.ok(englishMinimaxVendor);
  assert.match(openaiVendor.tagline ?? '', /[\p{Script=Han}]/u);
  assert.notEqual(openaiVendor.tagline, englishOpenaiVendor.tagline);
  assert.match(minimaxVendor.heroDescription ?? '', /[\p{Script=Han}]/u);
  assert.notEqual(minimaxVendor.heroDescription, englishMinimaxVendor.heroDescription);
  assert.equal(openaiVendor.modelHighlights[0], 'GPT-4.1');
  assert.equal(openaiVendor.modelHighlights[1], 'o4-mini');
  assert.match(openaiVendor.modelHighlights[2] ?? '', /[\p{Script=Han}]/u);
});
