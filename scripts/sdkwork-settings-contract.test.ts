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

runTest('sdkwork-claw-settings service uses shared app sdk wrapper instead of infrastructure business http', () => {
  const settingsServiceSource = read('packages/sdkwork-claw-settings/src/services/settingsService.ts');

  assert.match(settingsServiceSource, /@sdkwork\/claw-core\/sdk/);
  assert.match(settingsServiceSource, /getAppSdkClientWithSession/);
  assert.match(settingsServiceSource, /unwrapAppSdkResponse/);
  assert.doesNotMatch(settingsServiceSource, /@sdkwork\/claw-infrastructure/);
  assert.doesNotMatch(settingsServiceSource, /studioMockService/);
});
