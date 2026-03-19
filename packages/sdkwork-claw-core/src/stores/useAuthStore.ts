import { create, type StateCreator } from 'zustand';
import { createStore } from 'zustand/vanilla';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import { studioMockService } from '@sdkwork/claw-infrastructure';

const STORAGE_KEY = 'claw-studio-auth-storage';

export interface AuthUser {
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl?: string;
  displayName: string;
  initials: string;
}

export interface SignInInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

export interface AuthStoreState {
  isAuthenticated: boolean;
  user: AuthUser | null;
  signIn: (credentials: SignInInput) => Promise<AuthUser>;
  register: (payload: RegisterInput) => Promise<AuthUser>;
  signOut: () => Promise<void>;
  syncUserProfile: (profile: {
    firstName: string;
    lastName: string;
    email: string;
    avatarUrl?: string;
  }) => void;
  reset: () => void;
}

function splitDisplayName(name: string) {
  const normalized = name.trim().replace(/\s+/g, ' ');
  if (!normalized) {
    return { firstName: 'Claw', lastName: 'Operator' };
  }

  const [firstName, ...rest] = normalized.split(' ');
  return {
    firstName,
    lastName: rest.join(' '),
  };
}

function buildInitials(firstName: string, lastName: string) {
  return [firstName, lastName]
    .map((value) => value.trim().charAt(0))
    .filter(Boolean)
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'CS';
}

function toAuthUser(profile: {
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl?: string;
}): AuthUser {
  const firstName = profile.firstName.trim() || 'Claw';
  const lastName = profile.lastName.trim();
  const displayName = [firstName, lastName].filter(Boolean).join(' ').trim();

  return {
    firstName,
    lastName,
    email: profile.email.trim(),
    avatarUrl: profile.avatarUrl,
    displayName: displayName || 'Claw Operator',
    initials: buildInitials(firstName, lastName),
  };
}

const createAuthStoreState: StateCreator<AuthStoreState, [], [], AuthStoreState> = (set) => ({
  isAuthenticated: false,
  user: null,
  async signIn(credentials) {
    const currentProfile = await studioMockService.getProfile();
    const nextProfile = await studioMockService.updateProfile({
      ...currentProfile,
      email: credentials.email.trim() || currentProfile.email,
    });
    const user = toAuthUser(nextProfile);
    set({ isAuthenticated: true, user });
    return user;
  },
  async register(payload) {
    const currentProfile = await studioMockService.getProfile();
    const nameParts = splitDisplayName(payload.name);
    const nextProfile = await studioMockService.updateProfile({
      ...currentProfile,
      firstName: nameParts.firstName,
      lastName: nameParts.lastName,
      email: payload.email.trim() || currentProfile.email,
    });
    const user = toAuthUser(nextProfile);
    set({ isAuthenticated: true, user });
    return user;
  },
  async signOut() {
    set({ isAuthenticated: false, user: null });
  },
  syncUserProfile(profile) {
    set((state) => ({
      user: state.isAuthenticated ? toAuthUser(profile) : state.user,
    }));
  },
  reset() {
    set({ isAuthenticated: false, user: null });
  },
});

function createPersistOptions(storage?: StateStorage) {
  return storage
    ? {
        name: STORAGE_KEY,
        storage: createJSONStorage(() => storage),
        partialize: (state: AuthStoreState) => ({
          isAuthenticated: state.isAuthenticated,
          user: state.user,
        }),
      }
    : {
        name: STORAGE_KEY,
        partialize: (state: AuthStoreState) => ({
          isAuthenticated: state.isAuthenticated,
          user: state.user,
        }),
      };
}

export function createAuthStore(storage?: StateStorage) {
  return createStore<AuthStoreState>()(persist(createAuthStoreState, createPersistOptions(storage)));
}

export const useAuthStore = create<AuthStoreState>()(
  persist(createAuthStoreState, createPersistOptions()),
);
