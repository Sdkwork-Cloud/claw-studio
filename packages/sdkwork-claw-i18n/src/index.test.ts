import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import en from './locales/en.json' with { type: 'json' };
import zh from './locales/zh.json' with { type: 'json' };
import {
  APP_STORE_STORAGE_KEY,
  DEFAULT_LANGUAGE,
  I18N_STORAGE_KEY,
  SUPPORTED_LANGUAGES,
  detectBrowserLanguage,
  detectRequestLanguage,
  ensureI18n,
  formatCurrency,
  formatDate,
  formatNumber,
  formatRelativeTime,
  formatTime,
  getAppStoreLanguageFromSnapshot,
  localizeValue,
  localizedText,
  normalizeLanguage,
  resolveLocalizedText,
  translationResources,
} from './index.ts';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(currentDirectory, '../../..');
const packagesRoot = join(workspaceRoot, 'packages');
const approvedLocaleDirectory = join(packagesRoot, 'sdkwork-claw-i18n', 'src', 'locales');

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

function flattenKeys(value: unknown, prefix = ''): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return prefix ? [prefix] : [];
  }

  return Object.entries(value).flatMap(([key, nestedValue]) => {
    const nextPrefix = prefix ? `${prefix}.${key}` : key;
    return flattenKeys(nestedValue, nextPrefix);
  });
}

function collectWorkspaceFiles(directory: string, results: string[] = []) {
  for (const entry of readdirSync(directory)) {
    const nextPath = join(directory, entry);
    const stats = statSync(nextPath);

    if (stats.isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist') {
        continue;
      }

      collectWorkspaceFiles(nextPath, results);
      continue;
    }

    if (['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json'].includes(extname(nextPath))) {
      results.push(nextPath);
    }
  }

  return results;
}

await runTest('supported languages are limited to english and simplified chinese', () => {
  assert.deepEqual(SUPPORTED_LANGUAGES, ['en', 'zh']);
  assert.equal(DEFAULT_LANGUAGE, 'en');
});

await runTest('normalizeLanguage collapses locale variants and rejects unsupported values', () => {
  assert.equal(normalizeLanguage('en-US'), 'en');
  assert.equal(normalizeLanguage('zh-CN'), 'zh');
  assert.equal(normalizeLanguage('ja-JP'), 'en');
  assert.equal(normalizeLanguage(undefined), 'en');
});

await runTest('getAppStoreLanguageFromSnapshot safely parses persisted Zustand state', () => {
  assert.equal(getAppStoreLanguageFromSnapshot('{"state":{"language":"zh"}}'), 'zh');
  assert.equal(getAppStoreLanguageFromSnapshot('{"language":"en"}'), 'en');
  assert.equal(
    getAppStoreLanguageFromSnapshot('{"state":{"languagePreference":"system","language":"zh"}}'),
    undefined,
  );
  assert.equal(
    getAppStoreLanguageFromSnapshot('{"state":{"languagePreference":"en","language":"zh"}}'),
    'en',
  );
  assert.equal(getAppStoreLanguageFromSnapshot('{"state":{"language":1}}'), undefined);
  assert.equal(getAppStoreLanguageFromSnapshot('not-json'), undefined);
});

await runTest(
  'browser language detection prefers the request cookie over persisted app state and browser hints',
  () => {
    const storage = {
      getItem(key: string) {
        if (key === APP_STORE_STORAGE_KEY) {
          return '{"state":{"language":"zh"}}';
        }

        if (key === I18N_STORAGE_KEY) {
          return 'en-US';
        }

        return null;
      },
    };

    assert.equal(
      detectBrowserLanguage({
        storage,
        cookie: 'claw_lang=en',
        htmlLanguage: 'en-US',
        navigatorLanguage: 'en-US',
      }),
      'en',
    );
  },
);

await runTest(
  'browser language detection still prefers persisted app state over detector cache when no cookie exists',
  () => {
    const storage = {
      getItem(key: string) {
        if (key === APP_STORE_STORAGE_KEY) {
          return '{"state":{"language":"zh"}}';
        }

        if (key === I18N_STORAGE_KEY) {
          return 'en-US';
        }

        return null;
      },
    };

    assert.equal(
      detectBrowserLanguage({
        storage,
        htmlLanguage: 'en-US',
        navigatorLanguage: 'en-US',
      }),
      'zh',
    );
  },
);

await runTest('request language detection falls back cleanly to the default language', () => {
  assert.equal(detectRequestLanguage('zh-CN,zh;q=0.9,en;q=0.8'), 'zh');
  assert.equal(detectRequestLanguage('ja-JP,ja;q=0.9'), 'en');
  assert.equal(detectRequestLanguage(undefined), 'en');
});

await runTest('ensureI18n exposes both resource bundles and shared utility keys', async () => {
  const instance = await ensureI18n('zh-CN');

  assert.equal(instance.hasResourceBundle('en', 'translation'), true);
  assert.equal(instance.hasResourceBundle('zh', 'translation'), true);
  assert.equal(instance.language, 'zh');
  assert.equal(translationResources.en.translation.account.title, 'Account & Wallet');
  assert.equal(typeof translationResources.en.translation.account.confirmRecharge, 'string');
  assert.equal(typeof translationResources.zh.translation.account.confirmRecharge, 'string');
  assert.equal(typeof translationResources.zh.translation.account.title, 'string');
  assert.equal(translationResources.zh.translation.providerCenter.page.title, 'Provider 配置中心');
  assert.equal(
    translationResources.zh.translation.providerCenter.searchPlaceholder,
    '搜索 provider、Base URL、模型或 API 密钥',
  );
  assert.equal(
    translationResources.zh.translation.modelPurchase.providerProfiles.vendors.qwen.modelHighlights[0],
    'Qwen 推理',
  );
  assert.equal(
    translationResources.zh.translation.settings.apiKeys.searchPlaceholder,
    '搜索密钥名称、令牌或 ID',
  );
  assert.equal(
    translationResources.zh.translation.apiRouterPage.quickSetup.reasons.requiresGoogleIssuedGeminiKey,
    '如果你要走 Google 官方直连凭证模式，请改用 Google 直接签发的 Gemini API Key；通过统一 API Key 的路由化安装请使用 Gemini-compatible gateway。',
  );
});

await runTest('i18n interpolation formats numeric counts using the active locale', async () => {
  const english = await ensureI18n('en');
  assert.equal(english.t('market.labels.installCount', { count: 12345 }), '12,345 installs');

  const chinese = await ensureI18n('zh');
  assert.equal(
    chinese.t('community.postDetail.meta.views', { count: 12345 }),
    '12,345 \u6d4f\u89c8\u6b21\u6570',
  );
});

await runTest('english and chinese locale key sets remain aligned', () => {
  assert.deepEqual(flattenKeys(en).sort(), flattenKeys(zh).sort());
});

await runTest('formatting helpers use the selected application language', () => {
  assert.equal(formatNumber(1234567, 'en'), '1,234,567');
  assert.equal(formatNumber(1234567, 'zh'), '1,234,567');
  assert.equal(formatCurrency(42.2, 'en'), '$42.20');
  assert.equal(formatCurrency(42.2, 'zh', 'USD').length > 0, true);
  assert.equal(formatDate('2026-03-17T00:00:00.000Z', 'en').length > 0, true);
  assert.equal(formatTime('2026-03-17T14:35:00.000Z', 'zh').length > 0, true);
  assert.equal(
    formatRelativeTime(
      '2026-03-17T14:33:00.000Z',
      'en',
      '2026-03-17T14:35:00.000Z',
    ),
    '2 minutes ago',
  );
  assert.equal(
    formatRelativeTime(
      '2026-03-17T14:33:00.000Z',
      'zh',
      '2026-03-17T14:35:00.000Z',
    ).includes('2'),
    true,
  );
});

await runTest('localized text helpers resolve the active language and deep-map nested structures', () => {
  assert.equal(
    resolveLocalizedText(localizedText('Settings', '\u8bbe\u7f6e'), 'en-US'),
    'Settings',
  );
  assert.equal(
    resolveLocalizedText(localizedText('Settings', '\u8bbe\u7f6e'), 'zh-CN'),
    '\u8bbe\u7f6e',
  );
  assert.equal(
    resolveLocalizedText(localizedText('Settings', '\u8bbe\u7f6e'), 'ja-JP'),
    'Settings',
  );

  assert.deepEqual(
    localizeValue(
      {
        title: localizedText('Security', '\u5b89\u5168'),
        actions: [localizedText('Save', '\u4fdd\u5b58')],
        nested: {
          subtitle: localizedText(
            'Protect your account',
            '\u4fdd\u62a4\u4f60\u7684\u8d26\u6237',
          ),
        },
      },
      'zh-CN',
    ),
    {
      title: '\u5b89\u5168',
      actions: ['\u4fdd\u5b58'],
      nested: {
        subtitle: '\u4fdd\u62a4\u4f60\u7684\u8d26\u6237',
      },
    },
  );
});

await runTest('infrastructure no longer ships duplicate locale files', () => {
  const duplicateLocaleDirectory = join(
    packagesRoot,
    'sdkwork-claw-infrastructure',
    'src',
    'i18n',
    'locales',
  );
  const duplicateLocaleFiles = existsSync(duplicateLocaleDirectory)
    ? readdirSync(duplicateLocaleDirectory)
    : [];

  assert.deepEqual(duplicateLocaleFiles, []);
});

await runTest('only approved locale resource files contain Chinese characters or mojibake', () => {
  const offenders = collectWorkspaceFiles(packagesRoot)
    .filter((filePath) => {
      if (!filePath.split(/[/\\]/).includes('src')) {
        return false;
      }

      if (filePath.includes('.test.')) {
        return false;
      }

      if (filePath.startsWith(approvedLocaleDirectory)) {
        return false;
      }

      const content = readFileSync(filePath, 'utf8');
      return /[\p{Script=Han}]|\uFFFD/u.test(content);
    })
    .map((filePath) => relative(workspaceRoot, filePath));

  assert.deepEqual(offenders, []);
});
