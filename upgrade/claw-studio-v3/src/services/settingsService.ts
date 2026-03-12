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
  signOut(): Promise<void>;
  getPreferences(): Promise<UserPreferences>;
  updatePreferences(prefs: Partial<UserPreferences>): Promise<UserPreferences>;
}

class SettingsService implements ISettingsService {
  async getProfile(): Promise<UserProfile> {
    const res = await fetch('/api/settings/profile');
    if (!res.ok) throw new Error('Failed to fetch profile');
    return res.json();
  }

  async updateProfile(profile: UserProfile): Promise<UserProfile> {
    const res = await fetch('/api/settings/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile)
    });
    if (!res.ok) throw new Error('Failed to update profile');
    return profile;
  }

  async updatePassword(current: string, newPass: string): Promise<void> {
    // Simulated for now, as we don't have auth implemented
    return new Promise(resolve => setTimeout(resolve, 600));
  }

  async signOut(): Promise<void> {
    // Simulated for now
    return new Promise(resolve => setTimeout(resolve, 300));
  }

  async getPreferences(): Promise<UserPreferences> {
    const res = await fetch('/api/settings/preferences');
    if (!res.ok) throw new Error('Failed to fetch preferences');
    return res.json();
  }

  async updatePreferences(prefs: Partial<UserPreferences>): Promise<UserPreferences> {
    const res = await fetch('/api/settings/preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(prefs)
    });
    if (!res.ok) throw new Error('Failed to update preferences');
    return res.json();
  }
}

export const settingsService = new SettingsService();
