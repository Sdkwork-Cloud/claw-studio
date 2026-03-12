import assert from 'node:assert/strict';
import { settingsService } from './settingsService.ts';

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

await runTest('settings service exposes the v3 preferences contract', async () => {
  assert.equal(typeof settingsService.getPreferences, 'function');
  assert.equal(typeof settingsService.updatePreferences, 'function');

  const preferences = await settingsService.getPreferences();

  assert.equal(typeof preferences.general.launchOnStartup, 'boolean');
  assert.equal(typeof preferences.general.startMinimized, 'boolean');
  assert.equal(typeof preferences.notifications.systemUpdates, 'boolean');
  assert.equal(typeof preferences.security.twoFactorAuth, 'boolean');
});

await runTest('settings service persists partial preference updates like v3', async () => {
  const before = await settingsService.getPreferences();
  const updated = await settingsService.updatePreferences({
    general: {
      ...before.general,
      launchOnStartup: !before.general.launchOnStartup,
    },
  });

  assert.equal(updated.general.launchOnStartup, !before.general.launchOnStartup);

  const after = await settingsService.getPreferences();
  assert.equal(after.general.launchOnStartup, !before.general.launchOnStartup);
});
