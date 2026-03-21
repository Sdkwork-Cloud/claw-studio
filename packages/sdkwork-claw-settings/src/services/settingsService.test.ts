import assert from 'node:assert/strict';
import { settingsService } from './settingsService.ts';

function createStorage() {
  const store = new Map<string, string>();

  return {
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
    removeItem(key: string) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}

const storage = createStorage();
Object.defineProperty(globalThis, 'localStorage', {
  value: storage,
  configurable: true,
});

function createNotificationSettingsState() {
  return {
    enablePush: true,
    enableEmail: true,
    enableInApp: true,
    typeSettings: {
      TASK: { enableEmail: true, enableInApp: true },
      SECURITY: { enableEmail: true, enablePush: true },
      MESSAGE: { enableInApp: true },
    },
  };
}

let notificationSettingsState = createNotificationSettingsState();
let notificationRequestLog: Array<{
  url: string;
  method: string;
  body?: Record<string, unknown>;
}> = [];

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function resetNotificationFetchState() {
  notificationSettingsState = createNotificationSettingsState();
  notificationRequestLog = [];

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined;

    notificationRequestLog.push({
      url,
      method,
      body,
    });

    if (url.endsWith('/app/v3/api/notification/settings') && method === 'GET') {
      return jsonResponse({
        code: 0,
        data: notificationSettingsState,
      });
    }

    if (url.endsWith('/app/v3/api/notification/settings') && method === 'PUT') {
      notificationSettingsState = {
        ...notificationSettingsState,
        ...(body ?? {}),
      };
      return jsonResponse({
        code: 0,
        data: notificationSettingsState,
      });
    }

    const typeSettingsMatch = url.match(/\/app\/v3\/api\/notification\/settings\/([^/?#]+)$/);
    if (typeSettingsMatch && method === 'PUT') {
      const type = decodeURIComponent(typeSettingsMatch[1] || '');
      notificationSettingsState = {
        ...notificationSettingsState,
        typeSettings: {
          ...notificationSettingsState.typeSettings,
          [type]: {
            ...(notificationSettingsState.typeSettings[type as keyof typeof notificationSettingsState.typeSettings] ?? {}),
            ...(body ?? {}),
          },
        },
      };

      return jsonResponse({ code: 0, data: null });
    }

    return jsonResponse({ code: 404, message: 'Not found' }, 404);
  }) as typeof fetch;
}

async function runTest(name: string, fn: () => Promise<void> | void) {
  storage.clear();
  resetNotificationFetchState();
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

await runTest('settingsService persists general preferences across reads', async () => {
  const initial = await settingsService.getPreferences();
  assert.equal(initial.general.launchOnStartup, false);

  const updated = await settingsService.updatePreferences({
    general: {
      launchOnStartup: true,
      startMinimized: true,
    },
  });

  assert.equal(updated.general.launchOnStartup, true);
  assert.equal(updated.general.startMinimized, true);

  const reloaded = await settingsService.getPreferences();
  assert.equal(reloaded.general.launchOnStartup, true);
  assert.equal(reloaded.general.startMinimized, true);
});

await runTest('settingsService keeps security and privacy overlays when notification settings reload', async () => {
  await settingsService.updatePreferences({
    privacy: {
      shareUsageData: true,
      personalizedRecommendations: true,
    },
    security: {
      twoFactorAuth: true,
      loginAlerts: false,
    },
  });

  const reloaded = await settingsService.getPreferences();
  assert.equal(reloaded.privacy.shareUsageData, true);
  assert.equal(reloaded.privacy.personalizedRecommendations, true);
  assert.equal(reloaded.security.twoFactorAuth, true);
  assert.equal(reloaded.security.loginAlerts, false);
});

await runTest('settingsService updates notification globals and per-type switches through app sdk routes', async () => {
  const updated = await settingsService.updatePreferences({
    notifications: {
      systemUpdates: false,
      taskFailures: false,
      securityAlerts: false,
      taskCompletions: false,
      newMessages: true,
    },
  });

  assert.equal(notificationSettingsState.enableEmail, false);
  assert.equal(notificationSettingsState.enableInApp, true);
  assert.equal(notificationSettingsState.typeSettings.TASK.enableEmail, false);
  assert.equal(notificationSettingsState.typeSettings.TASK.enableInApp, false);
  assert.equal(notificationSettingsState.typeSettings.SECURITY.enableEmail, false);
  assert.equal(notificationSettingsState.typeSettings.MESSAGE.enableInApp, true);

  assert.deepEqual(
    notificationRequestLog
      .filter((entry) => entry.method === 'PUT')
      .map((entry) => entry.url.replace(/^.*\/app\/v3\/api/, '')),
    [
      '/notification/settings',
      '/notification/settings/TASK',
      '/notification/settings/SECURITY',
      '/notification/settings/MESSAGE',
    ],
  );

  assert.equal(updated.notifications.systemUpdates, false);
  assert.equal(updated.notifications.taskFailures, false);
  assert.equal(updated.notifications.securityAlerts, false);
  assert.equal(updated.notifications.taskCompletions, false);
  assert.equal(updated.notifications.newMessages, true);
});

await runTest('settingsService surfaces remote profile failures instead of falling back to mock data', async () => {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);

    if (url.endsWith('/app/v3/api/user/profile') && (!init?.method || init.method === 'GET')) {
      return new Response(JSON.stringify({ code: '5000', msg: 'Profile lookup failed' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ code: 404, message: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;

  await assert.rejects(
    settingsService.getProfile(),
    /Profile lookup failed|500/,
  );
});
