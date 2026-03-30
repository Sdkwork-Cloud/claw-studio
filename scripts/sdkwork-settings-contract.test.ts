import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relPath: string) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

function readJson<T>(relPath: string): T {
  return JSON.parse(read(relPath)) as T;
}

function exists(relPath: string) {
  return fs.existsSync(path.join(root, relPath));
}

function getLocaleValue(locale: Record<string, unknown>, key: string) {
  return key.split('.').reduce<unknown>((current, segment) => {
    if (!current || typeof current !== 'object' || !(segment in current)) {
      return undefined;
    }

    return (current as Record<string, unknown>)[segment];
  }, locale);
}

function readFromRepo(...segments: string[]) {
  return fs.readFileSync(path.resolve(root, '..', '..', ...segments), 'utf8');
}

function existsInRepo(...segments: string[]) {
  return fs.existsSync(path.resolve(root, '..', '..', ...segments));
}

function runTest(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

runTest('notification settings integration keeps the generated update form and the local adapter shape aligned', () => {
  const notificationSettingsUpdateForm = readFromRepo(
    'spring-ai-plus-app-api',
    'sdkwork-sdk-app',
    'sdkwork-app-sdk-typescript',
    'src',
    'types',
    'notification-settings-update-form.ts',
  );
  const notificationTypeSettingsForm = readFromRepo(
    'spring-ai-plus-app-api',
    'sdkwork-sdk-app',
    'sdkwork-app-sdk-typescript',
    'src',
    'types',
    'notification-type-settings-form.ts',
  );
  const coreSettingsServiceSource = read('packages/sdkwork-claw-core/src/services/settingsService.ts');

  assert.ok(
    existsInRepo(
      'spring-ai-plus-app-api',
      'sdkwork-sdk-app',
      'sdkwork-app-sdk-typescript',
      'src',
      'types',
      'notification-settings-update-form.ts',
    ),
    'generated notification settings update form should exist',
  );
  assert.ok(
    existsInRepo(
      'spring-ai-plus-app-api',
      'sdkwork-sdk-app',
      'sdkwork-app-sdk-typescript',
      'src',
      'types',
      'notification-type-settings-form.ts',
    ),
    'generated notification type settings form should exist',
  );
  assert.match(notificationSettingsUpdateForm, /enablePush\?: boolean/);
  assert.match(notificationSettingsUpdateForm, /enableEmail\?: boolean/);
  assert.match(notificationSettingsUpdateForm, /enableSms\?: boolean/);
  assert.match(notificationSettingsUpdateForm, /enableInApp\?: boolean/);
  assert.match(notificationSettingsUpdateForm, /quietHoursStart\?: string/);
  assert.match(notificationSettingsUpdateForm, /quietHoursEnd\?: string/);
  assert.match(notificationSettingsUpdateForm, /notificationSound\?: string/);
  assert.match(notificationSettingsUpdateForm, /vibrationEnabled\?: boolean/);
  assert.match(notificationTypeSettingsForm, /type: string/);
  assert.match(coreSettingsServiceSource, /interface RemoteNotificationTypeSettings/);
  assert.match(coreSettingsServiceSource, /enablePush\?: boolean/);
  assert.match(coreSettingsServiceSource, /enableEmail\?: boolean/);
  assert.match(coreSettingsServiceSource, /enableSms\?: boolean/);
  assert.match(coreSettingsServiceSource, /enableInApp\?: boolean/);
  assert.match(coreSettingsServiceSource, /interface RemoteNotificationSettings/);
  assert.match(coreSettingsServiceSource, /typeSettings\?: Record<string, RemoteNotificationTypeSettings>/);
});

runTest('sdkwork-claw-settings exports Kernel Center through package and service barrels with localized page copy', () => {
  const indexSource = read('packages/sdkwork-claw-settings/src/index.ts');
  const servicesIndexSource = read('packages/sdkwork-claw-settings/src/services/index.ts');
  const kernelCenterSource = read('packages/sdkwork-claw-settings/src/KernelCenter.tsx');
  const enLocale = readJson<Record<string, unknown>>('packages/sdkwork-claw-i18n/src/locales/en.json');
  const zhLocale = readJson<Record<string, unknown>>('packages/sdkwork-claw-i18n/src/locales/zh.json');
  const directKeys = [...kernelCenterSource.matchAll(/\bt\('([^']+)'\)/g)].map((match) => match[1]);
  const uniqueKeys = [...new Set(directKeys)].sort();
  const missingKeys = uniqueKeys.filter(
    (key) => getLocaleValue(enLocale, key) === undefined || getLocaleValue(zhLocale, key) === undefined,
  );

  assert.ok(exists('packages/sdkwork-claw-settings/src/KernelCenter.ts'));
  assert.ok(exists('packages/sdkwork-claw-settings/src/services/kernelCenterService.ts'));
  assert.match(indexSource, /KernelCenter/);
  assert.match(servicesIndexSource, /kernelCenterService/);
  assert.match(kernelCenterSource, /kernelCenterService/);
  assert.doesNotMatch(kernelCenterSource, /@sdkwork\/claw-infrastructure/);
  assert.match(kernelCenterSource, /settings\.kernelCenter\.description/);
  assert.match(kernelCenterSource, /settings\.kernelCenter\.actions\.refresh/);
  assert.match(kernelCenterSource, /settings\.kernelCenter\.actions\.ensureRunning/);
  assert.match(kernelCenterSource, /settings\.kernelCenter\.actions\.restart/);
  assert.match(kernelCenterSource, /settings\.kernelCenter\.metrics\.runtime/);
  assert.match(kernelCenterSource, /settings\.kernelCenter\.sections\.hostOwnership/);
  assert.match(kernelCenterSource, /settings\.kernelCenter\.fields\.serviceManager/);
  assert.match(kernelCenterSource, /settings\.kernelCenter\.capabilityRollup\.ready/);
  assert.match(kernelCenterSource, /settings\.kernelCenter\.bundles\.supervisor/);
  assert.doesNotMatch(kernelCenterSource, /The built-in OpenClaw kernel is treated as mandatory product/);
  assert.doesNotMatch(kernelCenterSource, /Failed to load kernel status\./);
  assert.deepEqual(missingKeys, []);
});

runTest('feedback SDK contract exposes feedback center resources needed by settings', () => {
  const feedbackApiSource = readFromRepo(
    'spring-ai-plus-app-api',
    'sdkwork-sdk-app',
    'sdkwork-app-sdk-typescript',
    'src',
    'api',
    'feedback.ts',
  );
  const feedbackTypeSource = readFromRepo(
    'spring-ai-plus-app-api',
    'sdkwork-sdk-app',
    'sdkwork-app-sdk-typescript',
    'src',
    'types',
    'feedback-submit-form.ts',
  );

  assert.ok(
    existsInRepo(
      'spring-ai-plus-app-api',
      'sdkwork-sdk-app',
      'sdkwork-app-sdk-typescript',
      'src',
      'types',
      'feedback-detail-vo.ts',
    ),
    'generated feedback detail VO should exist',
  );
  assert.match(feedbackApiSource, /listFeedback/);
  assert.match(feedbackApiSource, /submit/);
  assert.match(feedbackApiSource, /getFeedbackDetail/);
  assert.match(feedbackApiSource, /followUp/);
  assert.match(feedbackApiSource, /close/);
  assert.match(feedbackApiSource, /listFaqCategories/);
  assert.match(feedbackApiSource, /listFaqs/);
  assert.match(feedbackApiSource, /searchFaqs/);
  assert.match(feedbackApiSource, /getSupportInfo/);
  assert.match(feedbackTypeSource, /type: string/);
  assert.match(feedbackTypeSource, /content: string/);
});

runTest('sdkwork-claw-settings service uses shared app sdk wrapper instead of infrastructure business http', () => {
  const settingsServiceSource = read('packages/sdkwork-claw-settings/src/services/settingsService.ts');
  const coreSettingsServiceSource = read('packages/sdkwork-claw-core/src/services/settingsService.ts');

  assert.ok(exists('packages/sdkwork-claw-core/src/services/settingsService.ts'));
  assert.match(settingsServiceSource, /from '@sdkwork\/claw-core'/);
  assert.doesNotMatch(settingsServiceSource, /@sdkwork\/claw-core\/services\//);
  assert.doesNotMatch(settingsServiceSource, /getAppSdkClientWithSession/);
  assert.doesNotMatch(settingsServiceSource, /unwrapAppSdkResponse/);
  assert.match(coreSettingsServiceSource, /getAppSdkClientWithSession/);
  assert.match(coreSettingsServiceSource, /unwrapAppSdkResponse/);
  assert.doesNotMatch(settingsServiceSource, /@sdkwork\/claw-infrastructure/);
  assert.doesNotMatch(settingsServiceSource, /studioMockService/);
});

runTest('sdkwork-claw-settings exposes a feedback settings entry backed by claw-core feedbackCenterService', () => {
  const settingsSource = read('packages/sdkwork-claw-settings/src/Settings.tsx');
  const enLocaleSource = read('packages/sdkwork-claw-i18n/src/locales/en.json');
  const zhLocaleSource = read('packages/sdkwork-claw-i18n/src/locales/zh.json');

  assert.ok(
    exists('packages/sdkwork-claw-settings/src/FeedbackSettings.tsx'),
    'Feedback settings page should exist',
  );

  const feedbackSettingsSource = read('packages/sdkwork-claw-settings/src/FeedbackSettings.tsx');

  assert.match(settingsSource, /FeedbackSettings/);
  assert.match(settingsSource, /id: 'feedback'/);
  assert.match(settingsSource, /settings\.tabs\.feedback/);
  assert.match(settingsSource, /activeTab === 'feedback' && <FeedbackSettings \/>/);

  assert.match(feedbackSettingsSource, /@sdkwork\/claw-core/);
  assert.match(feedbackSettingsSource, /feedbackCenterService/);
  assert.doesNotMatch(feedbackSettingsSource, /@sdkwork\/claw-infrastructure/);
  assert.doesNotMatch(feedbackSettingsSource, /\bfetch\(/);
  assert.doesNotMatch(feedbackSettingsSource, /\baxios\./);
  assert.doesNotMatch(feedbackSettingsSource, /getAppSdkClientWithSession/);

  assert.match(enLocaleSource, /"feedback": "Feedback"/);
  assert.match(zhLocaleSource, /"feedback": "反馈"/);
});
runTest('provider center presets and localized copy stay aligned with current OpenClaw provider expectations', () => {
  const providerConfigCenterSource = read(
    'packages/sdkwork-claw-settings/src/services/providerConfigCenterService.ts',
  );
  const llmStoreSource = read('packages/sdkwork-claw-settings/src/store/useLLMStore.ts');
  const i18nIndexSource = read('packages/sdkwork-claw-i18n/src/index.ts');
  const localePatchSource = read('packages/sdkwork-claw-i18n/src/localePatches.ts');
  const enLocale = readJson<Record<string, unknown>>('packages/sdkwork-claw-i18n/src/locales/en.json');

  assert.match(providerConfigCenterSource, /Alibaba Cloud Model Studio \/ DashScope API keys/);
  assert.match(providerConfigCenterSource, /Gemini-compatible Google AI Studio route preset/);
  assert.match(providerConfigCenterSource, /gemini-3\.1-pro-preview/);
  assert.match(providerConfigCenterSource, /GOOGLE_GEMINI_BASE_URL/);
  assert.match(providerConfigCenterSource, /portal\.qwen\.ai OAuth onboarding/);
  assert.match(providerConfigCenterSource, /native Responses API endpoint/);
  assert.match(providerConfigCenterSource, /plugin and tool allowlist/);
  assert.match(providerConfigCenterSource, /reasoningModelId: 'grok-4-fast'/);
  assert.match(providerConfigCenterSource, /id: 'grok-4-1-fast'/);
  assert.match(providerConfigCenterSource, /id: 'minimax'/);
  assert.match(providerConfigCenterSource, /https:\/\/api\.minimax\.io\/anthropic/);
  assert.match(providerConfigCenterSource, /MiniMax-M2\.7/);
  assert.match(providerConfigCenterSource, /image-01/);

  assert.match(llmStoreSource, /https:\/\/generativelanguage\.googleapis\.com\/v1beta/);
  assert.match(llmStoreSource, /gemini-3\.1-pro-preview/);
  assert.match(llmStoreSource, /defaultModelId: 'gpt-5\.4'/);
  assert.match(llmStoreSource, /id: 'deepseek-reasoner'/);
  assert.match(llmStoreSource, /id: 'xai-grok'/);
  assert.match(llmStoreSource, /https:\/\/api\.x\.ai\/v1/);
  assert.match(llmStoreSource, /id: 'minimax'/);
  assert.match(llmStoreSource, /MiniMax-M2\.7/);
  assert.match(llmStoreSource, /name: 'Qwen \(Model Studio\)'/);
  assert.match(llmStoreSource, /defaultModelId: 'qwen-max'/);
  assert.doesNotMatch(llmStoreSource, /qwen-turbo/);
  assert.doesNotMatch(llmStoreSource, /deepseek-coder/);

  assert.equal(
    getLocaleValue(enLocale, 'providerCenter.searchPlaceholder'),
    'Search provider, base URL, model, or API key',
  );
  assert.match(i18nIndexSource, /mergeTranslationTree/);
  assert.match(i18nIndexSource, /zhLocalePatch/);
  assert.match(localePatchSource, /(Provider 配置中心|Provider \\u914d\\u7f6e\\u4e2d\\u5fc3)/);
  assert.match(
    localePatchSource,
    /(搜索 provider、Base URL、模型或 API 密钥|\\u641c\\u7d22 provider\\u3001Base URL\\u3001\\u6a21\\u578b\\u6216 API \\u5bc6\\u94a5)/,
  );
  assert.match(localePatchSource, /(Qwen 推理|Qwen \\u63a8\\u7406)/);
  assert.match(localePatchSource, /Gemini-compatible gateway/);
});
runTest('provider center runtime locale patch is wired through the shared i18n entry', () => {
  const i18nIndexSource = read('packages/sdkwork-claw-i18n/src/index.ts');
  const localePatchSource = read('packages/sdkwork-claw-i18n/src/localePatches.ts');

  assert.match(i18nIndexSource, /mergeTranslationTree/);
  assert.match(i18nIndexSource, /zhLocalePatch/);
  assert.match(localePatchSource, /(Provider 配置中心|Provider \\u914d\\u7f6e\\u4e2d\\u5fc3)/);
  assert.match(
    localePatchSource,
    /(搜索 provider、Base URL、模型或 API 密钥|\\u641c\\u7d22 provider\\u3001Base URL\\u3001\\u6a21\\u578b\\u6216 API \\u5bc6\\u94a5)/,
  );
  assert.match(localePatchSource, /(Qwen 推理|Qwen \\u63a8\\u7406)/);
});
runTest('llm store keeps an upgrade-safe persisted merge for built-in provider defaults', () => {
  const llmStoreSource = read('packages/sdkwork-claw-settings/src/store/useLLMStore.ts');

  assert.match(llmStoreSource, /version: 2/);
  assert.match(llmStoreSource, /mergeBuiltInChannel/);
  assert.match(llmStoreSource, /normalizeInstanceConfigs/);
  assert.match(llmStoreSource, /DEFAULT_CHANNEL_IDS/);
});
