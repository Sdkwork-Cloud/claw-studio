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

function delay(ms = 300) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let currentPreferences: UserPreferences = {
  general: {
    launchOnStartup: true,
    startMinimized: false,
  },
  notifications: {
    systemUpdates: true,
    taskFailures: true,
    securityAlerts: true,
    taskCompletions: false,
    newMessages: true,
  },
  privacy: {
    shareUsageData: false,
    personalizedRecommendations: true,
  },
  security: {
    twoFactorAuth: false,
    loginAlerts: true,
  },
};

function mergePreferences(
  current: UserPreferences,
  patch: Partial<UserPreferences>,
): UserPreferences {
  return {
    general: {
      ...current.general,
      ...patch.general,
    },
    notifications: {
      ...current.notifications,
      ...patch.notifications,
    },
    privacy: {
      ...current.privacy,
      ...patch.privacy,
    },
    security: {
      ...current.security,
      ...patch.security,
    },
  };
}

export const settingsService = {
  getProfile: async (): Promise<UserProfile> => {
    await delay();

    return {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
    };
  },

  updateProfile: async (profile: UserProfile): Promise<UserProfile> => {
    await delay(500);
    return profile;
  },

  updatePassword: async (_current: string, _newPass: string): Promise<void> => {
    await delay(600);
  },

  signOut: async (): Promise<void> => {
    await delay();
  },

  getPreferences: async (): Promise<UserPreferences> => {
    await delay();
    return currentPreferences;
  },

  updatePreferences: async (prefs: Partial<UserPreferences>): Promise<UserPreferences> => {
    await delay(500);
    currentPreferences = mergePreferences(currentPreferences, prefs);
    return currentPreferences;
  },
};

