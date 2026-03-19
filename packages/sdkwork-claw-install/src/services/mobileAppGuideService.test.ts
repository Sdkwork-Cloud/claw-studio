import assert from 'node:assert/strict';
import { createMobileAppGuide } from './mobileAppGuideService.ts';

function runTest(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

runTest('createMobileAppGuide resolves the sdkwork distribution links for the global distribution', () => {
  const guide = createMobileAppGuide('global');

  assert.equal(guide.distributionId, 'global');
  assert.equal(guide.docsHomeHref, 'https://clawstudio.sdkwork.com/platforms/android');
  assert.equal(
    guide.channels.find((channel) => channel.id === 'android')?.href,
    'https://clawstudio.sdkwork.com/platforms/android',
  );
  assert.equal(
    guide.channels.find((channel) => channel.id === 'ios')?.href,
    'https://clawstudio.sdkwork.com/platforms/ios',
  );
  assert.equal(
    guide.channels.find((channel) => channel.id === 'harmony')?.href,
    'https://clawstudio.sdkwork.com/platforms/harmony',
  );
});

runTest('createMobileAppGuide keeps the same sdkwork distribution links for the cn distribution', () => {
  const guide = createMobileAppGuide('cn');

  assert.equal(guide.distributionId, 'cn');
  assert.equal(guide.docsHomeHref, 'https://clawstudio.sdkwork.com/platforms/android');
  assert.equal(
    guide.channels.find((channel) => channel.id === 'android')?.href,
    'https://clawstudio.sdkwork.com/platforms/android',
  );
  assert.equal(
    guide.channels.find((channel) => channel.id === 'ios')?.href,
    'https://clawstudio.sdkwork.com/platforms/ios',
  );
  assert.equal(
    guide.channels.find((channel) => channel.id === 'harmony')?.href,
    'https://clawstudio.sdkwork.com/platforms/harmony',
  );
});

runTest('createMobileAppGuide exposes Android, iOS, and Harmony download channels with Android recommended', () => {
  const guide = createMobileAppGuide('global');
  const android = guide.channels.find((channel) => channel.id === 'android');
  const ios = guide.channels.find((channel) => channel.id === 'ios');
  const harmony = guide.channels.find((channel) => channel.id === 'harmony');

  assert.equal(android?.status, 'available');
  assert.equal(ios?.status, 'available');
  assert.equal(harmony?.status, 'available');
  assert.equal(guide.recommendedChannelId, 'android');
  assert.equal(guide.channels.length, 3);
});
