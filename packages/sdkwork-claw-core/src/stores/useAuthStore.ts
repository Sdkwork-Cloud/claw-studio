import { create, type StateCreator } from 'zustand';
import { createStore } from 'zustand/vanilla';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import { appAuthService } from '../services/index.ts';

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
  sendPasswordReset: (email: string) => Promise<void>;
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

function toAuthUserFromIdentity(profile: {
  nickname?: string;
  username?: string;
  email?: string;
  avatar?: string;
}): AuthUser {
  const fallbackName = profile.nickname?.trim() || profile.username?.trim() || 'Claw Operator';
  const nameParts = splitDisplayName(fallbackName);

  return toAuthUser({
    firstName: nameParts.firstName,
    lastName: nameParts.lastName,
    email: profile.email?.trim() || profile.username?.trim() || '',
    avatarUrl: profile.avatar,
  });
}

const createAuthStoreState: StateCreator<AuthStoreState, [], [], AuthStoreState> = (set) => ({
  isAuthenticated: false,
  user: null,
  async signIn(credentials) {
    const result = await appAuthService.login({
      username: credentials.email.trim(),
      password: credentials.password,
    });
    const user = toAuthUserFromIdentity(
      result.userInfo ?? {
        email: credentials.email.trim(),
        username: credentials.email.trim(),
      },
    );
    set({ isAuthenticated: true, user });
    return user;
  },
  async register(payload) {
    const result = await appAuthService.register({
      username: payload.email.trim(),
      password: payload.password,
      confirmPassword: payload.password,
      email: payload.email.trim(),
    });
    const user = toAuthUserFromIdentity(
      result.userInfo ?? {
        nickname: payload.name,
        email: payload.email.trim(),
      },
    );
    set({ isAuthenticated: true, user });
    return user;
  },
  async sendPasswordReset(email) {
    await appAuthService.requestPasswordReset({
      account: email.trim(),
      channel: 'EMAIL',
    });
  },
  async signOut() {
    try {
      await appAuthService.logout();
    } finally {
      set({ isAuthenticated: false, user: null });
    }
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
