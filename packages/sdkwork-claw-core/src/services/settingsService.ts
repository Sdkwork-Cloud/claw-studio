import {
  getAppSdkClientWithSession,
  unwrapAppSdkResponse,
} from '../sdk/index.ts';

export interface UserProfile {
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl?: string;
}

export interface UserPreferences {
  general: {
    launchOnStartup: boolean;
    startMinimized: boolean;
  };
  notifications: {
    systemUpdates: boolean;
    taskFailures: boolean;
    securityAlerts: boolean;
    taskCompletions: boolean;
    newMessages: boolean;
  };
  privacy: {
    shareUsageData: boolean;
    personalizedRecommendations: boolean;
  };
  security: {
    twoFactorAuth: boolean;
    loginAlerts: boolean;
  };
}

export interface ISettingsService {
  getProfile(): Promise<UserProfile>;
  updateProfile(profile: UserProfile): Promise<UserProfile>;
  updatePassword(current: string, newPass: string): Promise<void>;
  getPreferences(): Promise<UserPreferences>;
  updatePreferences(prefs: Partial<UserPreferences>): Promise<UserPreferences>;
}

const SETTINGS_OVERLAY_STORAGE_KEY = 'claw-studio-settings-overlay';

const DEFAULT_GENERAL_PREFERENCES: UserPreferences['general'] = {
  launchOnStartup: false,
  startMinimized: false,
};

const DEFAULT_PRIVACY_PREFERENCES: UserPreferences['privacy'] = {
  shareUsageData: false,
  personalizedRecommendations: false,
};

const DEFAULT_SECURITY_PREFERENCES: UserPreferences['security'] = {
  twoFactorAuth: false,
  loginAlerts: true,
};

interface RemoteNotificationTypeSettings {
  enablePush?: boolean;
  enableInApp?: boolean;
  enableEmail?: boolean;
  enableSms?: boolean;
}

interface RemoteNotificationTypeSettingsUpdate {
  type: string;
  enablePush?: boolean;
  enableInApp?: boolean;
  enableEmail?: boolean;
  enableSms?: boolean;
}

interface RemoteNotificationSettings {
  enablePush?: boolean;
  enableEmail?: boolean;
  enableSms?: boolean;
  enableInApp?: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  notificationSound?: string;
  vibrationEnabled?: boolean;
  typeSettings?: Record<string, RemoteNotificationTypeSettings>;
}

const TASK_NOTIFICATION_TYPE = 'TASK';
const MESSAGE_NOTIFICATION_TYPE = 'MESSAGE';
const ALERT_NOTIFICATION_TYPE_CANDIDATES = ['ALERT', 'SECURITY'];

function getStorage(): Storage | null {
  if (typeof globalThis.localStorage !== 'undefined') {
    return globalThis.localStorage;
  }

  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }

  return null;
}

function readSettingsOverlay(): Pick<UserPreferences, 'general' | 'privacy' | 'security'> {
  const storage = getStorage();
  if (!storage) {
    return {
      general: { ...DEFAULT_GENERAL_PREFERENCES },
      privacy: { ...DEFAULT_PRIVACY_PREFERENCES },
      security: { ...DEFAULT_SECURITY_PREFERENCES },
    };
  }

  const rawValue = storage.getItem(SETTINGS_OVERLAY_STORAGE_KEY);
  if (!rawValue) {
    return {
      general: { ...DEFAULT_GENERAL_PREFERENCES },
      privacy: { ...DEFAULT_PRIVACY_PREFERENCES },
      security: { ...DEFAULT_SECURITY_PREFERENCES },
    };
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<Pick<UserPreferences, 'general' | 'privacy' | 'security'>>;
    return {
      general: { ...DEFAULT_GENERAL_PREFERENCES, ...parsed.general },
      privacy: { ...DEFAULT_PRIVACY_PREFERENCES, ...parsed.privacy },
      security: { ...DEFAULT_SECURITY_PREFERENCES, ...parsed.security },
    };
  } catch {
    return {
      general: { ...DEFAULT_GENERAL_PREFERENCES },
      privacy: { ...DEFAULT_PRIVACY_PREFERENCES },
      security: { ...DEFAULT_SECURITY_PREFERENCES },
    };
  }
}

function writeSettingsOverlay(overlay: Pick<UserPreferences, 'general' | 'privacy' | 'security'>) {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  storage.setItem(SETTINGS_OVERLAY_STORAGE_KEY, JSON.stringify(overlay));
}

function resolveNotificationTypeSetting(
  settings: RemoteNotificationSettings,
  notificationTypes: string[],
  channel: keyof RemoteNotificationTypeSettings,
  fallback: boolean,
): boolean {
  for (const notificationType of notificationTypes) {
    const value = settings.typeSettings?.[notificationType]?.[channel];
    if (value !== undefined) {
      return value;
    }
  }

  return fallback;
}

function buildPreferencesFromNotificationSettings(
  settings: RemoteNotificationSettings,
  overlay = readSettingsOverlay(),
): UserPreferences {
  const emailEnabled = settings.enableEmail ?? true;
  const inAppEnabled = settings.enableInApp ?? true;

  return {
    general: overlay.general,
    notifications: {
      systemUpdates: emailEnabled,
      taskFailures: resolveNotificationTypeSetting(
        settings,
        [TASK_NOTIFICATION_TYPE],
        'enableEmail',
        emailEnabled,
      ),
      securityAlerts: resolveNotificationTypeSetting(
        settings,
        ALERT_NOTIFICATION_TYPE_CANDIDATES,
        'enableEmail',
        emailEnabled,
      ),
      taskCompletions: resolveNotificationTypeSetting(
        settings,
        [TASK_NOTIFICATION_TYPE],
        'enableInApp',
        inAppEnabled,
      ),
      newMessages: resolveNotificationTypeSetting(
        settings,
        [MESSAGE_NOTIFICATION_TYPE],
        'enableInApp',
        inAppEnabled,
      ),
    },
    privacy: overlay.privacy,
    security: {
      ...overlay.security,
    },
  };
}

function toUserProfile(profile: {
  nickname?: string;
  email?: string;
  avatar?: string;
}): UserProfile {
  const [firstName = '', ...rest] = (profile.nickname || '')
    .split(/\s+/)
    .map((value) => value.trim())
    .filter(Boolean);

  return {
    firstName,
    lastName: rest.join(' '),
    email: profile.email || '',
    avatarUrl: profile.avatar,
  };
}

function buildNotificationSettingsUpdate(
  current: RemoteNotificationSettings,
  notifications: Partial<UserPreferences['notifications']>,
): RemoteNotificationSettings {
  return {
    enablePush: current.enablePush,
    enableEmail: notifications.systemUpdates ?? current.enableEmail,
    enableSms: current.enableSms,
    enableInApp: current.enableInApp,
    quietHoursStart: current.quietHoursStart,
    quietHoursEnd: current.quietHoursEnd,
    notificationSound: current.notificationSound,
    vibrationEnabled: current.vibrationEnabled,
  };
}

function resolvePreferredNotificationType(
  settings: RemoteNotificationSettings,
  candidates: string[],
  fallback: string,
): string {
  for (const candidate of candidates) {
    if (settings.typeSettings?.[candidate]) {
      return candidate;
    }
  }

  return fallback;
}

function buildNotificationTypeSettingsUpdate(
  type: string,
  current: RemoteNotificationTypeSettings | undefined,
  updates: Partial<RemoteNotificationTypeSettings>,
): RemoteNotificationTypeSettingsUpdate {
  return {
    type,
    enablePush: updates.enablePush ?? current?.enablePush,
    enableInApp: updates.enableInApp ?? current?.enableInApp,
    enableEmail: updates.enableEmail ?? current?.enableEmail,
    enableSms: updates.enableSms ?? current?.enableSms,
  };
}

function buildNotificationTypeSettingsUpdates(
  currentSettings: RemoteNotificationSettings,
  notifications: Partial<UserPreferences['notifications']>,
): RemoteNotificationTypeSettingsUpdate[] {
  const updates: RemoteNotificationTypeSettingsUpdate[] = [];

  if (
    notifications.taskFailures !== undefined
    || notifications.taskCompletions !== undefined
  ) {
    updates.push(
      buildNotificationTypeSettingsUpdate(
        TASK_NOTIFICATION_TYPE,
        currentSettings.typeSettings?.[TASK_NOTIFICATION_TYPE],
        {
          enableEmail: notifications.taskFailures,
          enableInApp: notifications.taskCompletions,
        },
      ),
    );
  }

  if (notifications.securityAlerts !== undefined) {
    const alertType = resolvePreferredNotificationType(
      currentSettings,
      ALERT_NOTIFICATION_TYPE_CANDIDATES,
      'ALERT',
    );
    updates.push(
      buildNotificationTypeSettingsUpdate(
        alertType,
        currentSettings.typeSettings?.[alertType],
        {
          enableEmail: notifications.securityAlerts,
        },
      ),
    );
  }

  if (notifications.newMessages !== undefined) {
    updates.push(
      buildNotificationTypeSettingsUpdate(
        MESSAGE_NOTIFICATION_TYPE,
        currentSettings.typeSettings?.[MESSAGE_NOTIFICATION_TYPE],
        {
          enableInApp: notifications.newMessages,
        },
      ),
    );
  }

  return updates;
}

class SettingsService implements ISettingsService {
  async getProfile(): Promise<UserProfile> {
    const client = getAppSdkClientWithSession();
    const profile = unwrapAppSdkResponse(
      await client.user.getUserProfile(),
      'Failed to load profile.',
    );

    return toUserProfile(profile);
  }

  async updateProfile(profile: UserProfile): Promise<UserProfile> {
    const client = getAppSdkClientWithSession();
    const updated = unwrapAppSdkResponse(
      await client.user.updateUserProfile({
        nickname:
          [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim() || undefined,
        email: profile.email,
      }),
      'Failed to update profile.',
    );

    return {
      firstName: profile.firstName,
      lastName: profile.lastName,
      email: updated.email || profile.email,
      avatarUrl: updated.avatar || profile.avatarUrl,
    };
  }

  async updatePassword(current: string, newPass: string): Promise<void> {
    const client = getAppSdkClientWithSession();
    unwrapAppSdkResponse(
      await client.user.changePassword({
        oldPassword: current,
        newPassword: newPass,
        confirmPassword: newPass,
      }),
      'Failed to update password.',
    );
  }

  async getPreferences(): Promise<UserPreferences> {
    const client = getAppSdkClientWithSession();
    const settings = unwrapAppSdkResponse(
      await client.notification.getNotificationSettings(),
      'Failed to load preferences.',
    ) as RemoteNotificationSettings;

    return buildPreferencesFromNotificationSettings(settings);
  }

  async updatePreferences(prefs: Partial<UserPreferences>): Promise<UserPreferences> {
    const currentOverlay = readSettingsOverlay();
    const nextOverlay = {
      general: { ...currentOverlay.general, ...prefs.general },
      privacy: { ...currentOverlay.privacy, ...prefs.privacy },
      security: { ...currentOverlay.security, ...prefs.security },
    };
    writeSettingsOverlay(nextOverlay);

    const client = getAppSdkClientWithSession();
    const currentSettings = unwrapAppSdkResponse(
      await client.notification.getNotificationSettings(),
      'Failed to load notification settings.',
    ) as RemoteNotificationSettings;

    if (!prefs.notifications) {
      return buildPreferencesFromNotificationSettings(currentSettings, nextOverlay);
    }

    const updatedSettings = unwrapAppSdkResponse(
      await client.notification.updateNotificationSettings(
        buildNotificationSettingsUpdate(currentSettings, prefs.notifications),
      ),
      'Failed to update preferences.',
    ) as RemoteNotificationSettings;

    const typeSettingsUpdates = buildNotificationTypeSettingsUpdates(
      updatedSettings,
      prefs.notifications,
    );

    for (const typeSettingsUpdate of typeSettingsUpdates) {
      unwrapAppSdkResponse(
        await client.notification.updateTypeSettings(
          typeSettingsUpdate.type,
          typeSettingsUpdate,
        ),
        'Failed to update preferences.',
      );
    }

    const refreshedSettings =
      typeSettingsUpdates.length === 0
        ? updatedSettings
        : (unwrapAppSdkResponse(
            await client.notification.getNotificationSettings(),
            'Failed to load preferences.',
          ) as RemoteNotificationSettings);

    return buildPreferencesFromNotificationSettings(refreshedSettings, nextOverlay);
  }
}

export const settingsService = new SettingsService();
