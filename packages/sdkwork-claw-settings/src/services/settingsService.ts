import { studioMockService } from '@sdkwork/claw-infrastructure';

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
    return studioMockService.getProfile();
  }

  async updateProfile(profile: UserProfile): Promise<UserProfile> {
    return studioMockService.updateProfile(profile);
  }

  async updatePassword(_current: string, _newPass: string): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 600));
  }

  async signOut(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 300));
  }

  async getPreferences(): Promise<UserPreferences> {
    return studioMockService.getPreferences();
  }

  async updatePreferences(prefs: Partial<UserPreferences>): Promise<UserPreferences> {
    return studioMockService.updatePreferences(prefs);
  }
}

export const settingsService = new SettingsService();
