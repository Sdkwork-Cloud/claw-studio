import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  defaultLanguage,
  normalizeLanguage,
  resolveInitialLanguage,
  type SupportedLanguage,
} from '@sdkwork/claw-i18n';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ThemeColor = 'lobster' | 'tech-blue' | 'green-tech' | 'zinc' | 'violet' | 'rose';
export type Language = SupportedLanguage;
export type LanguagePreference = Language | 'system';

interface AppState {
  isSidebarCollapsed: boolean;
  sidebarWidth: number;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setSidebarWidth: (width: number) => void;
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
  | 'hiddenSidebarItems'
  | 'themeMode'
  | 'themeColor'
  | 'language'
  | 'languagePreference'
  | 'hasSeenMobileAppPrompt'
>;

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

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      isSidebarCollapsed: false,
      sidebarWidth: 252,
      toggleSidebar: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
      setSidebarCollapsed: (collapsed) => set({ isSidebarCollapsed: collapsed }),
      setSidebarWidth: (sidebarWidth) => set({ sidebarWidth }),
      hiddenSidebarItems: [],
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

        return {
          ...currentState,
          ...nextState,
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
