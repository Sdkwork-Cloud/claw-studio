import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  defaultLanguage,
  normalizeLanguage,
  resolveInitialLanguage,
  type SupportedLanguage,
} from '@sdkwork/claw-i18n';
import { resolveAutoSidebarCollapsed } from './sidebarAutoCollapse.ts';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ThemeColor = 'lobster' | 'tech-blue' | 'green-tech' | 'zinc' | 'violet' | 'rose';
export type Language = SupportedLanguage;
export type LanguagePreference = Language | 'system';
export type SidebarCollapsePreference = 'auto' | 'user';

interface AppState {
  isSidebarCollapsed: boolean;
  sidebarWidth: number;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setSidebarWidth: (width: number) => void;
  sidebarCollapsePreference: SidebarCollapsePreference;
  sidebarVisibilityVersion: number;
  hiddenSidebarItems: string[];
  toggleSidebarItem: (id: string) => void;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  themeColor: ThemeColor;
  setThemeColor: (color: ThemeColor) => void;
  language: Language;
  languagePreference: LanguagePreference;
  setLanguage: (lang: LanguagePreference) => void;
  isMobileAppDialogOpen: boolean;
  hasSeenMobileAppPrompt: boolean;
  openMobileAppDialog: () => void;
  closeMobileAppDialog: () => void;
  markMobileAppPromptSeen: () => void;
}

type PersistedAppState = Pick<
  AppState,
  | 'isSidebarCollapsed'
  | 'sidebarWidth'
  | 'sidebarCollapsePreference'
  | 'sidebarVisibilityVersion'
  | 'hiddenSidebarItems'
  | 'themeMode'
  | 'themeColor'
  | 'language'
  | 'languagePreference'
  | 'hasSeenMobileAppPrompt'
>;

const SIDEBAR_VISIBILITY_VERSION = 5;
const DEFAULT_HIDDEN_SIDEBAR_ITEMS = ['apps', 'extensions', 'github', 'huggingface', 'mall', 'api-router'] as const;

function dedupeSidebarItems(items: readonly string[]) {
  return Array.from(new Set(items));
}

function migrateHiddenSidebarItems(hiddenSidebarItems?: string[]) {
  return dedupeSidebarItems([
    ...(hiddenSidebarItems || []).filter(
      (item) => item !== 'market' && item !== 'apps' && item !== 'claw-center',
    ),
    ...DEFAULT_HIDDEN_SIDEBAR_ITEMS,
  ]);
}

const getDefaultLanguage = (): Language => {
  return resolveInitialLanguage();
};

const normalizeLanguagePreference = (value?: string | null): LanguagePreference => {
  if (value === 'system') {
    return 'system';
  }

  return normalizeLanguage(value);
};

const resolveLanguageFromPreference = (preference: LanguagePreference): Language => {
  if (preference === 'system') {
    return getDefaultLanguage();
  }

  return normalizeLanguage(preference);
};

function resolveSidebarCollapsePreference(
  nextState: Partial<PersistedAppState>,
  currentState: AppState,
): SidebarCollapsePreference {
  if (
    nextState.sidebarCollapsePreference === 'auto' ||
    nextState.sidebarCollapsePreference === 'user'
  ) {
    return nextState.sidebarCollapsePreference;
  }

  if (typeof nextState.isSidebarCollapsed === 'boolean') {
    return 'user';
  }

  return currentState.sidebarCollapsePreference;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      isSidebarCollapsed: resolveAutoSidebarCollapsed(),
      sidebarWidth: 252,
      toggleSidebar: () =>
        set((state) => ({
          isSidebarCollapsed: !state.isSidebarCollapsed,
          sidebarCollapsePreference: 'user',
        })),
      setSidebarCollapsed: (collapsed) =>
        set({ isSidebarCollapsed: collapsed, sidebarCollapsePreference: 'user' }),
      setSidebarWidth: (sidebarWidth) => set({ sidebarWidth }),
      sidebarCollapsePreference: 'auto',
      sidebarVisibilityVersion: SIDEBAR_VISIBILITY_VERSION,
      hiddenSidebarItems: [...DEFAULT_HIDDEN_SIDEBAR_ITEMS],
      toggleSidebarItem: (id) =>
        set((state) => ({
          hiddenSidebarItems: state.hiddenSidebarItems.includes(id)
            ? state.hiddenSidebarItems.filter((itemId) => itemId !== id)
            : [...state.hiddenSidebarItems, id],
        })),
      themeMode: 'system',
      setThemeMode: (themeMode) => set({ themeMode }),
      themeColor: 'lobster',
      setThemeColor: (themeColor) => set({ themeColor }),
      languagePreference: 'system',
      language: getDefaultLanguage(),
      setLanguage: (languagePreference) => {
        const nextLanguagePreference = normalizeLanguagePreference(languagePreference);
        set({
          languagePreference: nextLanguagePreference,
          language: resolveLanguageFromPreference(nextLanguagePreference),
        });
      },
      isMobileAppDialogOpen: false,
      hasSeenMobileAppPrompt: false,
      openMobileAppDialog: () => set({ isMobileAppDialogOpen: true }),
      closeMobileAppDialog: () => set({ isMobileAppDialogOpen: false }),
      markMobileAppPromptSeen: () => set({ hasSeenMobileAppPrompt: true }),
    }),
    {
      name: 'claw-studio-app-storage',
      partialize: (state): PersistedAppState => ({
        isSidebarCollapsed: state.isSidebarCollapsed,
        sidebarWidth: state.sidebarWidth,
        sidebarCollapsePreference: state.sidebarCollapsePreference,
        sidebarVisibilityVersion: state.sidebarVisibilityVersion,
        hiddenSidebarItems: state.hiddenSidebarItems,
        themeMode: state.themeMode,
        themeColor: state.themeColor,
        language: state.language,
        languagePreference: state.languagePreference,
        hasSeenMobileAppPrompt: state.hasSeenMobileAppPrompt,
      }),
      merge: (persistedState, currentState) => {
        const nextState = (persistedState as Partial<PersistedAppState>) || {};
        const languagePreference = normalizeLanguagePreference(
          nextState.languagePreference ?? nextState.language ?? 'system',
        );
        const sidebarCollapsePreference = resolveSidebarCollapsePreference(nextState, currentState);
        const isSidebarCollapsed =
          sidebarCollapsePreference === 'auto'
            ? resolveAutoSidebarCollapsed()
            : nextState.isSidebarCollapsed ?? currentState.isSidebarCollapsed;
        const hiddenSidebarItems =
          nextState.sidebarVisibilityVersion === SIDEBAR_VISIBILITY_VERSION
            ? dedupeSidebarItems(nextState.hiddenSidebarItems ?? currentState.hiddenSidebarItems)
            : migrateHiddenSidebarItems(nextState.hiddenSidebarItems);

        return {
          ...currentState,
          ...nextState,
          isSidebarCollapsed,
          sidebarCollapsePreference,
          sidebarVisibilityVersion: SIDEBAR_VISIBILITY_VERSION,
          hiddenSidebarItems,
          languagePreference,
          language: resolveLanguageFromPreference(languagePreference ?? defaultLanguage),
          isMobileAppDialogOpen: false,
          hasSeenMobileAppPrompt:
            nextState.hasSeenMobileAppPrompt ?? currentState.hasSeenMobileAppPrompt ?? false,
        };
      },
    },
  ),
);
