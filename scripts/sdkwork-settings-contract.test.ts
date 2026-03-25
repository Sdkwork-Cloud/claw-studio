import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relPath: string) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

function exists(relPath: string) {
  return fs.existsSync(path.join(root, relPath));
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

runTest('notification settings SDK contract exposes the app-api notification settings shape', () => {
  const notificationSettingsType = readFromRepo(
    'spring-ai-plus-app-api',
    'sdkwork-sdk-app',
    'sdkwork-app-sdk-typescript',
    'src',
    'types',
    'notification-settings-vo.ts',
  );

  assert.ok(
    existsInRepo(
      'spring-ai-plus-app-api',
      'sdkwork-sdk-app',
      'sdkwork-app-sdk-typescript',
      'src',
      'types',
      'notification-type-settings-vo.ts',
    ),
    'generated notification type settings VO should exist',
  );
  assert.match(notificationSettingsType, /enablePush\?: boolean/);
  assert.match(notificationSettingsType, /enableEmail\?: boolean/);
  assert.match(notificationSettingsType, /enableSms\?: boolean/);
  assert.match(notificationSettingsType, /enableInApp\?: boolean/);
  assert.match(notificationSettingsType, /quietHoursStart\?: string/);
  assert.match(notificationSettingsType, /quietHoursEnd\?: string/);
  assert.match(notificationSettingsType, /notificationSound\?: string/);
  assert.match(notificationSettingsType, /vibrationEnabled\?: boolean/);
  assert.match(notificationSettingsType, /typeSettings\?/);
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
  assert.match(settingsServiceSource, /@sdkwork\/claw-core\/services\/settingsService/);
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
