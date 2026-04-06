import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  createAuthStore,
  createAuthStorePersistOptions,
  createAuthStoreState,
  synchronizeAuthStoreSession,
  type AuthStoreState,
} from './authStore.ts';

export {
  createAuthStore,
  type AuthUser,
  type EmailCodeSignInInput,
  type OAuthSignInInput,
  type PasswordResetInput,
  type PasswordResetRequestInput,
  type PhoneCodeSignInInput,
  type RegisterInput,
  type SignInInput,
} from './authStore.ts';

const authStore = create<AuthStoreState>()(
  persist(createAuthStoreState, createAuthStorePersistOptions()),
);

synchronizeAuthStoreSession(authStore);

export const useAuthStore = authStore;
