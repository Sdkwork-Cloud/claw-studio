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

  await ensureI18n('zh');
  const catalog = await modelPurchaseCatalogService.listVendors('zh');
  const openaiVendor = catalog.find((vendor) => vendor.id === 'openai');
  const minimaxVendor = catalog.find((vendor) => vendor.id === 'minimax');

  assert.ok(openaiVendor);
  assert.ok(minimaxVendor);
  assert.equal(
    openaiVendor.tagline,
    '面向智能体、对话与推理场景的高阶 GPT 套餐。',
  );
  assert.equal(
    minimaxVendor.heroDescription,
    '适合长会话、多模态应用与富媒体场景。',
  );
  assert.deepEqual(
    openaiVendor.modelHighlights,
    ['GPT-4.1', 'o4-mini', '实时能力'],
  );
});
