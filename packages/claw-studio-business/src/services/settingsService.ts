export interface UserProfile {
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl?: string;
}

export const settingsService = {
  getProfile: async (): Promise<UserProfile> => {
    return new Promise(resolve => setTimeout(() => resolve({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com'
    }), 300));
  },

  updateProfile: async (profile: UserProfile): Promise<UserProfile> => {
    return new Promise(resolve => setTimeout(() => resolve(profile), 500));
  },

  updatePassword: async (current: string, newPass: string): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, 600));
  },

  signOut: async (): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, 300));
  }
};
