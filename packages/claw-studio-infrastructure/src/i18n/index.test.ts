import assert from 'node:assert/strict';
import en from './locales/en.json' with { type: 'json' };
import zh from './locales/zh.json' with { type: 'json' };
import { ensureI18n, translationResources } from './index.ts';

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

await runTest('ensureI18n exposes both english and chinese resource bundles', async () => {
  const i18n = await ensureI18n();

  assert.equal(i18n.hasResourceBundle('en', 'translation'), true);
  assert.equal(i18n.hasResourceBundle('zh', 'translation'), true);
});

await runTest('translationResources stay byte-for-byte aligned with the v3 locale json files', () => {
  assert.deepEqual(translationResources.en.translation, en);
  assert.deepEqual(translationResources.zh.translation, zh);
});

await runTest('translationResources expose the v3 account copy used by the migrated account feature', () => {
  assert.equal(translationResources.en.translation.account.title, 'Account & Wallet');
  assert.equal(translationResources.en.translation.account.confirmRecharge, 'Confirm Recharge');
  assert.equal(translationResources.zh.translation.account.title, zh.account.title);
});
